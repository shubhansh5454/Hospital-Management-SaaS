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

      // 1. Total Patients
      const totalPatients = await prisma.patient.count();

      // 2. Today's Registered Patients
      const todaysPatients = await prisma.patient.count({
        where: {
          createdAt: {
            gte: startOfToday,
          }
        }
      });

      // 3. Today's Revenue (Invoice Payments + Medicine Sales today)
      const invoicePaymentsToday = await prisma.payment.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          paymentDate: todayStr,
        }
      });

      const medicineSalesToday = await prisma.medicineSale.aggregate({
        _sum: {
          totalPrice: true,
        },
        where: {
          saleDate: todayStr,
        }
      });

      const todaysRevenue = (invoicePaymentsToday._sum.amount || 0) + (medicineSalesToday._sum.totalPrice || 0);

      // 4. Monthly Revenue (Invoice Payments + Medicine Sales this month)
      const invoicePaymentsThisMonth = await prisma.payment.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          paymentDate: {
            startsWith: currentMonthStr,
          }
        }
      });

      const medicineSalesThisMonth = await prisma.medicineSale.aggregate({
        _sum: {
          totalPrice: true,
        },
        where: {
          saleDate: {
            startsWith: currentMonthStr,
          }
        }
      });

      const monthlyRevenue = (invoicePaymentsThisMonth._sum.amount || 0) + (medicineSalesThisMonth._sum.totalPrice || 0);

      // 5. Total Doctors Count
      const doctorsCount = await prisma.user.count({
        where: {
          role: 'doctor',
        }
      });

      // 6. Appointments Widgets
      const appointmentsCount = await prisma.appointment.count();
      const todaysAppointmentsCount = await prisma.appointment.count({
        where: {
          date: todayStr,
        }
      });

      // 7. Lab Statistics
      const labTotalCount = await prisma.labOrder.count();
      const labCompletedCount = await prisma.labOrder.count({
        where: {
          status: 'COMPLETED',
        }
      });
      const labPendingCount = await prisma.labOrder.count({
        where: {
          status: {
            in: ['BOOKED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'],
          }
        }
      });

      // 8. Pharmacy Sales
      const pharmacySalesCount = await prisma.medicineSale.count();
      const pharmacySalesRevenueAggregate = await prisma.medicineSale.aggregate({
        _sum: {
          totalPrice: true,
        }
      });
      const pharmacySalesRevenue = pharmacySalesRevenueAggregate._sum.totalPrice || 0;

      // 9. Inventory Alerts (Products or Medicines with low stock)
      const products = await prisma.inventoryProduct.findMany({
        select: {
          stock: true,
          minStockAlert: true,
        }
      });
      const lowStockProductsCount = products.filter(p => p.stock <= p.minStockAlert).length;

      const medicines = await prisma.medicine.findMany({
        select: {
          stock: true,
          minStockAlert: true,
        }
      });
      const lowStockMedicinesCount = medicines.filter(m => m.stock <= m.minStockAlert).length;

      const inventoryAlertsCount = lowStockProductsCount + lowStockMedicinesCount;

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
      
      const payments = await prisma.payment.findMany({
        where: {
          paymentDate: {
            gte: `${oldestMonthKey}-01`,
          }
        },
        select: {
          amount: true,
          paymentDate: true,
        }
      });

      const medSales = await prisma.medicineSale.findMany({
        where: {
          saleDate: {
            gte: `${oldestMonthKey}-01`,
          }
        },
        select: {
          totalPrice: true,
          saleDate: true,
        }
      });

      const appointments = await prisma.appointment.findMany({
        where: {
          date: {
            gte: `${oldestMonthKey}-01`,
          }
        },
        select: {
          status: true,
          date: true,
        }
      });

      const patients = await prisma.patient.findMany({
        where: {
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
          }
        },
        select: {
          createdAt: true,
        }
      });

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

      // Fetch inventory details for low stock alert alerts
      const lowStockProducts = await prisma.inventoryProduct.findMany({
        where: {
          stock: {
            lte: 10, // approximate, or fetch and filter
          }
        },
        include: {
          category: true,
        },
        take: 5,
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

      const lowStockMedicines = await prisma.medicine.findMany({
        where: {
          stock: {
            lte: 15,
          }
        },
        take: 5,
      });

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
        },
        activeAlerts,
      });
    } catch (error) {
      next(error);
    }
  }
}
