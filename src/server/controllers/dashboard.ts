import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.ts';

export class DashboardController {
  /**
   * Get clinic overview statistics for the Admin Dashboard
   */
  public static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      
      // Helper to get local date strings (YYYY-MM-DD)
      const getLocalDateStr = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      const getLocalMonthStr = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}`;
      };

      const todayStr = getLocalDateStr(now);
      const currentMonthStr = getLocalMonthStr(now);

      // Start of today for timestamp-based creations (Patient.createdAt is a full timestamp)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Tenant isolation: filter by user's clinicId unless they are superadmin
      const user = (req as any).user;
      const userClinicId = user?.clinicId;
      const userRole = user?.role;

      let filterClinicId: number | undefined = undefined;

      if (userRole !== 'superadmin') {
        filterClinicId = userClinicId || undefined;
      } else if (req.query.clinicId) {
        filterClinicId = parseInt(req.query.clinicId as string, 10);
      }

      // --- HISTORICAL TREND GENERATION (Last 6 Months) ---
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      interface MonthLabel {
        key: string;
        label: string;
      }
      const monthLabels: MonthLabel[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = getLocalMonthStr(d);
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        monthLabels.push({ key, label });
      }

      // Fetch invoice payments & pharmacy sales for the 6-month window to build trends
      const oldestMonthKey = monthLabels[0].key; // e.g., "2026-02"

      // Execute all 22 database queries concurrently to eliminate sequential waiting bottlenecks
      const [
        totalPatients,
        todaysPatients,
        invoicePaymentsToday,
        medicineSalesToday,
        invoicePaymentsThisMonth,
        medicineSalesThisMonth,
        doctorsCount,
        appointmentsCount,
        todaysAppointmentsCount,
        labTotalCount,
        labCompletedCount,
        labPendingCount,
        pharmacySalesCount,
        pharmacySalesRevenueAggregate,
        products,
        medicines,
        payments,
        medSales,
        appointments,
        patients,
        lowStockProducts,
        lowStockMedicines,
      ] = await Promise.all([
        prisma.patient.count({
          where: filterClinicId ? { clinicId: filterClinicId } : {}
        }),
        prisma.patient.count({
          where: {
            createdAt: {
              gte: startOfToday,
            },
            ...(filterClinicId ? { clinicId: filterClinicId } : {})
          }
        }),
        prisma.payment.aggregate({
          _sum: {
            amount: true,
          },
          where: {
            paymentDate: todayStr,
            ...(filterClinicId ? { invoice: { clinicId: filterClinicId } } : {})
          }
        }),
        prisma.medicineSale.aggregate({
          _sum: {
            totalPrice: true,
          },
          where: {
            saleDate: todayStr,
            ...(filterClinicId ? { medicine: { clinicId: filterClinicId } } : {})
          }
        }),
        prisma.payment.aggregate({
          _sum: {
            amount: true,
          },
          where: {
            paymentDate: {
              startsWith: currentMonthStr,
            },
            ...(filterClinicId ? { invoice: { clinicId: filterClinicId } } : {})
          }
        }),
        prisma.medicineSale.aggregate({
          _sum: {
            totalPrice: true,
          },
          where: {
            saleDate: {
              startsWith: currentMonthStr,
            },
            ...(filterClinicId ? { medicine: { clinicId: filterClinicId } } : {})
          }
        }),
        prisma.user.count({
          where: {
            role: 'doctor',
            ...(filterClinicId ? { clinicId: filterClinicId } : {})
          }
        }),
        prisma.appointment.count({
          where: filterClinicId ? { clinicId: filterClinicId } : {}
        }),
        prisma.appointment.count({
          where: {
            date: todayStr,
            ...(filterClinicId ? { clinicId: filterClinicId } : {})
          }
        }),
        prisma.labOrder.count({
          where: filterClinicId ? { clinicId: filterClinicId } : {}
        }),
        prisma.labOrder.count({
          where: {
            status: 'COMPLETED',
            ...(filterClinicId ? { clinicId: filterClinicId } : {})
          }
        }),
        prisma.labOrder.count({
          where: {
            status: {
              in: ['BOOKED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'],
            },
            ...(filterClinicId ? { clinicId: filterClinicId } : {})
          }
        }),
        prisma.medicineSale.count({
          where: filterClinicId ? { medicine: { clinicId: filterClinicId } } : {}
        }),
        prisma.medicineSale.aggregate({
          _sum: {
            totalPrice: true,
          },
          where: filterClinicId ? { medicine: { clinicId: filterClinicId } } : {}
        }),
        prisma.inventoryProduct.findMany({
          where: filterClinicId ? { clinicId: filterClinicId } : {},
          select: {
            stock: true,
            minStockAlert: true,
          }
        }),
        prisma.medicine.findMany({
          where: filterClinicId ? { clinicId: filterClinicId } : {},
          select: {
            stock: true,
            minStockAlert: true,
          }
        }),
        prisma.payment.findMany({
          where: {
            paymentDate: {
              gte: `${oldestMonthKey}-01`,
            },
            ...(filterClinicId ? { invoice: { clinicId: filterClinicId } } : {})
          },
          select: {
            amount: true,
            paymentDate: true,
          }
        }),
        prisma.medicineSale.findMany({
          where: {
            saleDate: {
              gte: `${oldestMonthKey}-01`,
            },
            ...(filterClinicId ? { medicine: { clinicId: filterClinicId } } : {})
          },
          select: {
            totalPrice: true,
            saleDate: true,
          }
        }),
        prisma.appointment.findMany({
          where: {
            date: {
              gte: `${oldestMonthKey}-01`,
            },
            ...(filterClinicId ? { clinicId: filterClinicId } : {})
          },
          select: {
            status: true,
            date: true,
          }
        }),
        prisma.patient.findMany({
          where: {
            createdAt: {
              gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
            },
            ...(filterClinicId ? { clinicId: filterClinicId } : {})
          },
          select: {
            createdAt: true,
          }
        }),
        prisma.inventoryProduct.findMany({
          where: {
            stock: {
              lte: 10,
            },
            ...(filterClinicId ? { clinicId: filterClinicId } : {})
          },
          include: {
            category: true,
          },
          take: 5,
        }),
        prisma.medicine.findMany({
          where: {
            stock: {
              lte: 15,
            },
            ...(filterClinicId ? { clinicId: filterClinicId } : {})
          },
          take: 5,
        }),
      ]);

      const todaysRevenue = (invoicePaymentsToday._sum.amount || 0) + (medicineSalesToday._sum.totalPrice || 0);
      const monthlyRevenue = (invoicePaymentsThisMonth._sum.amount || 0) + (medicineSalesThisMonth._sum.totalPrice || 0);
      const pharmacySalesRevenue = pharmacySalesRevenueAggregate._sum.totalPrice || 0;

      const lowStockProductsCount = products.filter(p => p.stock <= p.minStockAlert).length;
      const lowStockMedicinesCount = medicines.filter(m => m.stock <= m.minStockAlert).length;
      const inventoryAlertsCount = lowStockProductsCount + lowStockMedicinesCount;

      // Build Revenue Trend
      const revenueTrend = monthLabels.map(m => {
        const billingAmt = payments
          .filter(p => p.paymentDate.startsWith(m.key))
          .reduce((sum, p) => sum + p.amount, 0);

        const pharmacyAmt = medSales
          .filter(s => s.saleDate.startsWith(m.key))
          .reduce((sum, s) => sum + s.totalPrice, 0);

        return {
          name: m.label,
          billing: parseFloat(billingAmt.toFixed(2)),
          pharmacy: parseFloat(pharmacyAmt.toFixed(2)),
          total: parseFloat((billingAmt + pharmacyAmt).toFixed(2)),
        };
      });

      // Build Patient Growth Trend
      const patientGrowthTrend = monthLabels.map(m => {
        const count = patients.filter(p => {
          const pMonthStr = getLocalMonthStr(p.createdAt);
          return pMonthStr === m.key;
        }).length;

        return {
          name: m.label,
          count,
        };
      });

      // Build Appointment Trend
      const appointmentTrend = monthLabels.map(m => {
        const monthAppts = appointments.filter(a => a.date.startsWith(m.key));
        const scheduled = monthAppts.filter(a => a.status === 'scheduled').length;
        const completed = monthAppts.filter(a => a.status === 'completed').length;
        const cancelled = monthAppts.filter(a => a.status === 'cancelled').length;

        return {
          name: m.label,
          scheduled,
          completed,
          cancelled,
          total: monthAppts.length,
        };
      });

      const activeLowStockProducts = lowStockProducts
        .filter(p => p.stock <= p.minStockAlert)
        .map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: p.stock,
          minStock: p.minStockAlert,
          type: 'inventory',
          category: p.category.name,
        }));

      const activeLowStockMedicines = lowStockMedicines
        .filter(m => m.stock <= m.minStockAlert)
        .map(m => ({
          id: m.id,
          name: m.name,
          sku: m.code,
          stock: m.stock,
          minStock: m.minStockAlert,
          type: 'pharmacy',
          category: m.category,
        }));

      const activeAlerts = [...activeLowStockProducts, ...activeLowStockMedicines].slice(0, 5);

      res.status(200).json({
        widgets: {
          totalPatients,
          todaysPatients,
          todaysRevenue,
          monthlyRevenue,
          doctorsCount,
          appointmentsCount,
          todaysAppointmentsCount,
          labPendingCount,
          labCompletedCount,
          labTotalCount,
          pharmacySalesCount,
          pharmacySalesRevenue,
          inventoryAlertsCount,
        },
        charts: {
          revenueTrend,
          patientGrowthTrend,
          appointmentTrend,
          revenueTrendData: revenueTrend, // For compatibility
        },
        activeAlerts,
      });
    } catch (error) {
      next(error);
    }
  }
}
