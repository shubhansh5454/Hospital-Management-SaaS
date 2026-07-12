import { prisma } from '../../db/prisma.ts';

export class ReportsService {
  /**
   * Helper to parse dates for filtering
   */
  private static getDateFilter(startDate?: string, endDate?: string, dbField: string = 'createdAt') {
    const filter: any = {};
    if (startDate || endDate) {
      filter[dbField] = {};
      if (startDate) {
        filter[dbField].gte = new Date(startDate);
      }
      if (endDate) {
        // Set to end of day to include all records on that date
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter[dbField].lte = end;
      }
    }
    return filter;
  }

  /**
   * Patient Report
   */
  public static async getPatientReport(clinicId?: number, startDate?: string, endDate?: string) {
    const dateFilter = this.getDateFilter(startDate, endDate, 'createdAt');
    const whereClause: any = { ...dateFilter };
    if (clinicId) {
      whereClause.clinicId = clinicId;
    }

    // 1. Fetch Patients
    const patients = await prisma.patient.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    const totalPatients = patients.length;

    // 2. Demographics - Gender breakdown
    const genderBreakdown: Record<string, number> = {};
    patients.forEach(p => {
      const g = p.gender || 'Unknown';
      genderBreakdown[g] = (genderBreakdown[g] || 0) + 1;
    });

    // Demographics - Blood Group breakdown
    const bloodGroupBreakdown: Record<string, number> = {};
    patients.forEach(p => {
      const bg = p.bloodGroup || 'Not Specified';
      bloodGroupBreakdown[bg] = (bloodGroupBreakdown[bg] || 0) + 1;
    });

    // 3. Age Brackets (using DOB YYYY-MM-DD)
    const ageBrackets = {
      '0-12 (Child)': 0,
      '13-19 (Teen)': 0,
      '20-39 (Adult)': 0,
      '40-59 (Middle Aged)': 0,
      '60+ (Senior)': 0,
      'Unknown': 0,
    };

    const currentYear = new Date().getFullYear();
    patients.forEach(p => {
      if (!p.dob) {
        ageBrackets['Unknown']++;
        return;
      }
      const dobYear = parseInt(p.dob.split('-')[0], 10);
      if (isNaN(dobYear)) {
        ageBrackets['Unknown']++;
        return;
      }
      const age = currentYear - dobYear;
      if (age <= 12) ageBrackets['0-12 (Child)']++;
      else if (age <= 19) ageBrackets['13-19 (Teen)']++;
      else if (age <= 39) ageBrackets['20-39 (Adult)']++;
      else if (age <= 59) ageBrackets['40-59 (Middle Aged)']++;
      else ageBrackets['60+ (Senior)']++;
    });

    // 4. Common Diagnoses from EMRs
    const emrs = await prisma.emrRecord.findMany({
      where: {
        ...(clinicId ? { patient: { clinicId } } : {}),
        ...(startDate || endDate ? {
          date: {
            gte: startDate || undefined,
            lte: endDate || undefined,
          }
        } : {})
      },
      select: { diagnosis: true },
    });

    const diagnosisBreakdown: Record<string, number> = {};
    emrs.forEach(e => {
      const parts = e.diagnosis.split(',').map(d => d.trim()).filter(Boolean);
      parts.forEach(p => {
        diagnosisBreakdown[p] = (diagnosisBreakdown[p] || 0) + 1;
      });
    });

    const topDiagnoses = Object.entries(diagnosisBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      summary: {
        totalPatients,
      },
      charts: {
        gender: Object.entries(genderBreakdown).map(([name, value]) => ({ name, value })),
        bloodGroup: Object.entries(bloodGroupBreakdown).map(([name, value]) => ({ name, value })),
        ageBrackets: Object.entries(ageBrackets).map(([name, value]) => ({ name, value })),
        topDiagnoses,
      },
      rows: patients.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        dob: p.dob,
        gender: p.gender,
        bloodGroup: p.bloodGroup || 'N/A',
        createdAt: p.createdAt.toISOString().split('T')[0],
      })),
    };
  }

  /**
   * Doctor Report
   */
  public static async getDoctorReport(clinicId?: number, startDate?: string, endDate?: string) {
    // 1. Fetch Users with Role Admin/Doctor that have DoctorProfile
    const doctors = await prisma.user.findMany({
      where: {
        role: { in: ['doctor', 'admin'] },
        doctorProfile: { isNot: null },
        ...(clinicId ? { clinicId } : {}),
      },
      include: {
        doctorProfile: true,
      },
    });

    // 2. Specialization counts
    const specializationBreakdown: Record<string, number> = {};
    doctors.forEach(d => {
      const spec = d.doctorProfile?.specialization || 'General Practice';
      specializationBreakdown[spec] = (specializationBreakdown[spec] || 0) + 1;
    });

    // 3. Appointments & Revenue per doctor
    const docStats = [];
    for (const d of doctors) {
      const apptsCount = await prisma.appointment.count({
        where: {
          doctorId: d.id,
          ...(clinicId ? { clinicId } : {}),
          ...(startDate || endDate ? {
            date: {
              gte: startDate || undefined,
              lte: endDate || undefined,
            }
          } : {})
        }
      });

      const invoiceSum = await prisma.invoice.aggregate({
        where: {
          doctorId: d.id,
          status: 'paid',
          ...(clinicId ? { clinicId } : {}),
          ...(startDate || endDate ? {
            date: {
              gte: startDate || undefined,
              lte: endDate || undefined,
            }
          } : {})
        },
        _sum: {
          totalAmount: true,
        }
      });

      docStats.push({
        id: d.id,
        name: d.name,
        email: d.email,
        specialization: d.doctorProfile?.specialization || 'N/A',
        experienceYrs: d.doctorProfile?.experienceYrs || 0,
        appointmentCount: apptsCount,
        revenueGenerated: invoiceSum._sum.totalAmount || 0,
      });
    }

    const totalDoctors = doctors.length;
    const totalAppointments = docStats.reduce((sum, d) => sum + d.appointmentCount, 0);
    const totalRevenue = docStats.reduce((sum, d) => sum + d.revenueGenerated, 0);

    return {
      summary: {
        totalDoctors,
        totalAppointments,
        totalRevenue,
      },
      charts: {
        specializations: Object.entries(specializationBreakdown).map(([name, value]) => ({ name, value })),
        doctorAppointments: docStats.map(d => ({ name: d.name, value: d.appointmentCount })),
        doctorRevenue: docStats.map(d => ({ name: d.name, value: d.revenueGenerated })),
      },
      rows: docStats,
    };
  }

  /**
   * Appointment Report
   */
  public static async getAppointmentReport(clinicId?: number, startDate?: string, endDate?: string) {
    const filters: any = {};
    if (startDate || endDate) {
      filters.date = {};
      if (startDate) filters.date.gte = startDate;
      if (endDate) filters.date.lte = endDate;
    }
    if (clinicId) {
      filters.clinicId = clinicId;
    }

    const appointments = await prisma.appointment.findMany({
      where: filters,
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: { date: 'asc' },
    });

    const totalAppointments = appointments.length;

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    appointments.forEach(a => {
      const s = a.status || 'scheduled';
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    });

    // Reason for visit breakdown
    const reasonBreakdown: Record<string, number> = {};
    appointments.forEach(a => {
      const r = a.reason || 'General Checkup';
      reasonBreakdown[r] = (reasonBreakdown[r] || 0) + 1;
    });

    // Chronological activity
    const dailyTrend: Record<string, number> = {};
    appointments.forEach(a => {
      const d = a.date;
      dailyTrend[d] = (dailyTrend[d] || 0) + 1;
    });

    return {
      summary: {
        totalAppointments,
        completed: statusBreakdown['completed'] || 0,
        scheduled: statusBreakdown['scheduled'] || 0,
        cancelled: statusBreakdown['cancelled'] || 0,
      },
      charts: {
        status: Object.entries(statusBreakdown).map(([name, value]) => ({ name, value })),
        reasons: Object.entries(reasonBreakdown)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5),
        dailyTrend: Object.entries(dailyTrend).map(([name, value]) => ({ date: name, count: value })),
      },
      rows: appointments.map(a => ({
        id: a.id,
        patientName: a.patient?.name || 'N/A',
        doctorName: a.doctor?.name || 'N/A',
        date: a.date,
        time: a.time,
        reason: a.reason,
        status: a.status,
        notes: a.notes || '',
      })),
    };
  }

  /**
   * Billing Report
   */
  public static async getBillingReport(clinicId?: number, startDate?: string, endDate?: string) {
    const filters: any = {};
    if (startDate || endDate) {
      filters.date = {};
      if (startDate) filters.date.gte = startDate;
      if (endDate) filters.date.lte = endDate;
    }
    if (clinicId) {
      filters.clinicId = clinicId;
    }

    const invoices = await prisma.invoice.findMany({
      where: filters,
      include: {
        patient: true,
        payments: true,
      },
      orderBy: { date: 'asc' },
    });

    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalDiscount = 0;

    const statusBreakdown: Record<string, number> = {};
    const methodBreakdown: Record<string, number> = {};
    const dailyInvoiced: Record<string, number> = {};
    const dailyCollected: Record<string, number> = {};

    invoices.forEach(inv => {
      totalInvoiced += inv.totalAmount;
      totalCollected += inv.amountPaid;
      totalDiscount += inv.discount;

      statusBreakdown[inv.status] = (statusBreakdown[inv.status] || 0) + 1;

      if (inv.paymentMethod) {
        methodBreakdown[inv.paymentMethod] = (methodBreakdown[inv.paymentMethod] || 0) + inv.amountPaid;
      }

      dailyInvoiced[inv.date] = (dailyInvoiced[inv.date] || 0) + inv.totalAmount;
      dailyCollected[inv.date] = (dailyCollected[inv.date] || 0) + inv.amountPaid;
    });

    const outstanding = totalInvoiced - totalCollected;

    return {
      summary: {
        totalInvoiced,
        totalCollected,
        outstanding,
        totalDiscount,
      },
      charts: {
        invoiceStatuses: Object.entries(statusBreakdown).map(([name, value]) => ({ name, value })),
        paymentMethods: Object.entries(methodBreakdown).map(([name, value]) => ({ name, value })),
        dailyTrend: Object.keys({ ...dailyInvoiced, ...dailyCollected }).sort().map(d => ({
          date: d,
          invoiced: dailyInvoiced[d] || 0,
          collected: dailyCollected[d] || 0,
        })),
      },
      rows: invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        patientName: inv.patient?.name || 'N/A',
        date: inv.date,
        dueDate: inv.dueDate || 'N/A',
        subTotal: inv.subTotal,
        totalAmount: inv.totalAmount,
        amountPaid: inv.amountPaid,
        discount: inv.discount,
        status: inv.status,
        paymentMethod: inv.paymentMethod || 'N/A',
      })),
    };
  }

  /**
   * Pharmacy Report
   */
  public static async getPharmacyReport(clinicId?: number, startDate?: string, endDate?: string) {
    const medicines = await prisma.medicine.findMany({
      where: clinicId ? { clinicId } : {}
    });
    const totalMedicines = medicines.length;

    // Filtered sales
    const salesFilter: any = {};
    if (startDate || endDate) {
      salesFilter.saleDate = {};
      if (startDate) salesFilter.saleDate.gte = startDate;
      if (endDate) salesFilter.saleDate.lte = endDate;
    }
    if (clinicId) {
      salesFilter.medicine = { clinicId };
    }

    const sales = await prisma.medicineSale.findMany({
      where: salesFilter,
      include: {
        medicine: true,
        patient: true,
      },
    });

    const totalSalesRevenue = sales.reduce((sum, s) => sum + s.totalPrice, 0);
    const totalSalesQty = sales.reduce((sum, s) => sum + s.quantity, 0);

    // High and Low Stock
    const lowStockMedicines = medicines.filter(m => m.stock <= m.minStockAlert).length;

    // Top selling medicines
    const salesBreakdown: Record<string, { qty: number; revenue: number; name: string }> = {};
    sales.forEach(s => {
      const mId = s.medicineId;
      if (!salesBreakdown[mId]) {
        salesBreakdown[mId] = { qty: 0, revenue: 0, name: s.medicine?.name || 'Unknown' };
      }
      salesBreakdown[mId].qty += s.quantity;
      salesBreakdown[mId].revenue += s.totalPrice;
    });

    const topSelling = Object.values(salesBreakdown)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Expiry breakdown (medicines expiring soon, e.g., in next 180 days)
    const today = new Date();
    const halfYearLater = new Date();
    halfYearLater.setDate(today.getDate() + 180);

    const expiringSoon = medicines.filter(m => {
      if (!m.expiryDate) return false;
      const exp = new Date(m.expiryDate);
      return exp >= today && exp <= halfYearLater;
    }).length;

    return {
      summary: {
        totalMedicines,
        totalSalesRevenue,
        totalSalesQty,
        lowStockMedicines,
        expiringSoon,
      },
      charts: {
        topMedicines: topSelling.map(item => ({ name: item.name, value: item.revenue, quantity: item.qty })),
        stockStatus: [
          { name: 'In Stock (Healthy)', value: medicines.filter(m => m.stock > m.minStockAlert).length },
          { name: 'Low Stock', value: lowStockMedicines },
          { name: 'Out of Stock', value: medicines.filter(m => m.stock === 0).length }
        ],
      },
      rows: sales.map(s => ({
        id: s.id,
        medicineName: s.medicine?.name || 'N/A',
        category: s.medicine?.category || 'N/A',
        quantity: s.quantity,
        saleDate: s.saleDate,
        totalPrice: s.totalPrice,
        patientName: s.patient?.name || 'Walk-in',
        paymentMethod: s.paymentMethod,
      })),
    };
  }

  /**
   * Lab Report
   */
  public static async getLabReport(clinicId?: number, startDate?: string, endDate?: string) {
    const filters: any = {};
    if (startDate || endDate) {
      filters.bookingDate = {};
      if (startDate) filters.bookingDate.gte = startDate;
      if (endDate) filters.bookingDate.lte = endDate;
    }
    if (clinicId) {
      filters.clinicId = clinicId;
    }

    const labOrders = await prisma.labOrder.findMany({
      where: filters,
      include: {
        patient: true,
        test: true,
      },
      orderBy: { bookingDate: 'asc' },
    });

    const totalOrders = labOrders.length;

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    labOrders.forEach(o => {
      const s = o.status || 'BOOKED';
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    });

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    labOrders.forEach(o => {
      const cat = o.test?.category || 'General';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    // Top ordered tests
    const testCounts: Record<string, number> = {};
    labOrders.forEach(o => {
      const tName = o.test?.name || 'Unknown';
      testCounts[tName] = (testCounts[tName] || 0) + 1;
    });

    const topTests = Object.entries(testCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const totalRevenue = labOrders.reduce((sum, o) => sum + (o.test?.price || 0), 0);

    return {
      summary: {
        totalOrders,
        totalRevenue,
        completed: statusBreakdown['COMPLETED'] || 0,
        booked: statusBreakdown['BOOKED'] || 0,
        inProgress: statusBreakdown['IN_PROGRESS'] || 0,
      },
      charts: {
        statuses: Object.entries(statusBreakdown).map(([name, value]) => ({ name, value })),
        categories: Object.entries(categoryBreakdown).map(([name, value]) => ({ name, value })),
        topTests,
      },
      rows: labOrders.map(o => ({
        id: o.id,
        patientName: o.patient?.name || 'N/A',
        testName: o.test?.name || 'N/A',
        category: o.test?.category || 'N/A',
        price: o.test?.price || 0,
        status: o.status,
        bookingDate: o.bookingDate,
        resultValue: o.resultValue || 'Pending',
        normalRange: o.normalRange || 'N/A',
      })),
    };
  }

  /**
   * Inventory Report
   */
  public static async getInventoryReport(clinicId?: number, startDate?: string, endDate?: string) {
    const products = await prisma.inventoryProduct.findMany({
      where: clinicId ? { clinicId } : {},
      include: {
        category: true,
      },
    });

    const totalProducts = products.length;

    // Low stock items
    const lowStockProducts = products.filter(p => p.stock <= p.minStockAlert).length;
    const outOfStockProducts = products.filter(p => p.stock === 0).length;

    // Filtered Stock Movements
    const movementFilter: any = {};
    if (startDate || endDate) {
      movementFilter.movementDate = {};
      if (startDate) movementFilter.movementDate.gte = startDate;
      if (endDate) movementFilter.movementDate.lte = endDate;
    }
    if (clinicId) {
      movementFilter.product = { clinicId };
    }

    const movements = await prisma.stockMovement.findMany({
      where: movementFilter,
      include: {
        product: true,
      },
    });

    const totalStockIn = movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.quantity, 0);
    const totalStockOut = movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.quantity, 0);

    // Categories breakdown
    const categoryCounts: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.category?.name || 'General';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Reason breakdown for stock changes
    const reasonBreakdown: Record<string, number> = {};
    movements.forEach(m => {
      const r = m.reason || 'ADJUSTMENT';
      reasonBreakdown[r] = (reasonBreakdown[r] || 0) + m.quantity;
    });

    return {
      summary: {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        totalStockIn,
        totalStockOut,
      },
      charts: {
        categories: Object.entries(categoryCounts).map(([name, value]) => ({ name, value })),
        reasons: Object.entries(reasonBreakdown).map(([name, value]) => ({ name, value })),
        stockStatus: [
          { name: 'Healthy Stock', value: products.filter(p => p.stock > p.minStockAlert).length },
          { name: 'Low Stock', value: lowStockProducts },
          { name: 'Out of Stock', value: outOfStockProducts }
        ],
      },
      rows: products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name || 'N/A',
        unit: p.unit,
        stock: p.stock,
        minStockAlert: p.minStockAlert,
        status: p.stock === 0 ? 'Out of Stock' : p.stock <= p.minStockAlert ? 'Low Stock' : 'In Stock',
      })),
    };
  }
}
