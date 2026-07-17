import { prisma } from '../../db/prisma.ts';

export interface CreateLabTestInput {
  name: string;
  code: string;
  category: string;
  price: number;
  sampleType: string;
  turnaroundTime: string;
  description?: string;
}

export interface BookTestInput {
  patientId: number;
  testId: number;
  bookingDate: string;
}

export interface CollectSampleInput {
  barcode: string;
  collector: string;
  collectedAt: Date;
}

export interface RecordResultInput {
  resultValue: string;
  normalRange?: string;
  unit?: string;
  comments?: string;
  reportAttachmentUrl?: string;
  validatedBy: string;
  validatedAt: Date;
}

export class LabRepository {
  /**
   * Create a new Lab Test master
   */
  public static async createTest(data: CreateLabTestInput) {
    return prisma.labTest.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        category: data.category,
        price: data.price,
        sampleType: data.sampleType,
        turnaroundTime: data.turnaroundTime,
        description: data.description ?? null,
      },
    });
  }

  /**
   * Find lab test by code
   */
  public static async findTestByCode(code: string) {
    return prisma.labTest.findUnique({
      where: { code: code.toUpperCase() },
    });
  }

  /**
   * Find lab test by ID
   */
  public static async findTestById(id: number) {
    return prisma.labTest.findUnique({
      where: { id },
    });
  }

  /**
   * Find all lab tests with optional category & search filter
   */
  public static async findAllTests(filters: { search?: string; category?: string }) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.category && filters.category !== 'all') {
      where.category = filters.category;
    }

    return prisma.labTest.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update lab test details
   */
  public static async updateTest(id: number, data: Partial<CreateLabTestInput>) {
    return prisma.labTest.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete lab test definition
   */
  public static async deleteTest(id: number) {
    return prisma.labTest.delete({
      where: { id },
    });
  }

  /**
   * Book a lab test for a patient (Creates LabOrder)
   */
  public static async bookOrder(data: BookTestInput & { clinicId?: number }) {
    return prisma.labOrder.create({
      data: {
        patientId: data.patientId,
        testId: data.testId,
        bookingDate: data.bookingDate,
        status: 'BOOKED',
        clinicId: data.clinicId,
      },
      include: {
        patient: true,
        test: true,
      },
    });
  }

  /**
   * Find a specific lab order by ID
   */
  public static async findOrderById(id: number) {
    return prisma.labOrder.findUnique({
      where: { id },
      include: {
        patient: true,
        test: true,
      },
    });
  }

  /**
   * List all lab orders with status, patient, or date filtering
   */
  public static async findAllOrders(filters: {
    status?: string;
    patientId?: number;
    search?: string;
    clinicId?: number;
  }) {
    const where: any = {};

    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    if (filters.search) {
      where.AND = [
        filters.clinicId ? { patient: { clinicId: filters.clinicId } } : {},
        {
          OR: [
            {
              patient: {
                name: { contains: filters.search, mode: 'insensitive' },
              },
            },
            {
              test: {
                name: { contains: filters.search, mode: 'insensitive' },
              },
            },
            {
              sampleBarcode: { contains: filters.search, mode: 'insensitive' },
            },
          ]
        }
      ];
    } else if (filters.clinicId) {
      where.patient = {
        clinicId: filters.clinicId
      };
    }

    return prisma.labOrder.findMany({
      where,
      include: {
        patient: true,
        test: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update Order Status directly
   */
  public static async updateOrderStatus(id: number, status: string) {
    return prisma.labOrder.update({
      where: { id },
      data: { status },
      include: {
        patient: true,
        test: true,
      },
    });
  }

  /**
   * Record Sample Collection for Lab Order
   */
  public static async recordSampleCollection(id: number, data: CollectSampleInput) {
    return prisma.labOrder.update({
      where: { id },
      data: {
        status: 'SAMPLE_COLLECTED',
        sampleBarcode: data.barcode,
        sampleCollector: data.collector,
        sampleCollectedAt: data.collectedAt,
      },
      include: {
        patient: true,
        test: true,
      },
    });
  }

  /**
   * Enter Results, approve/validate and complete order
   */
  public static async saveResultsAndComplete(id: number, data: RecordResultInput) {
    return prisma.labOrder.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        resultValue: data.resultValue,
        normalRange: data.normalRange ?? null,
        unit: data.unit ?? null,
        comments: data.comments ?? null,
        reportAttachmentUrl: data.reportAttachmentUrl ?? null,
        validatedBy: data.validatedBy,
        validatedAt: data.validatedAt,
      },
      include: {
        patient: true,
        test: true,
      },
    });
  }

  /**
   * Lab dashboard KPI statistics
   */
  public static async getLabStats(clinicId?: number) {
    const whereClause = clinicId ? { patient: { clinicId } } : {};

    const totalOrders = await prisma.labOrder.count({ where: whereClause });
    const bookedCount = await prisma.labOrder.count({ where: { status: 'BOOKED', ...whereClause } });
    const collectedCount = await prisma.labOrder.count({ where: { status: 'SAMPLE_COLLECTED', ...whereClause } });
    const progressCount = await prisma.labOrder.count({ where: { status: 'IN_PROGRESS', ...whereClause } });
    const completedCount = await prisma.labOrder.count({ where: { status: 'COMPLETED', ...whereClause } });

    // Grouping by category
    const categoryCounts = await prisma.labTest.groupBy({
      by: ['category'],
      _count: {
        id: true,
      },
    });

    // Recent orders
    const recentOrders = await prisma.labOrder.findMany({
      where: whereClause,
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        test: true,
      },
    });

    return {
      kpi: {
        totalOrders,
        pendingCollection: bookedCount,
        sampleCollected: collectedCount,
        inProgress: progressCount,
        completed: completedCount,
      },
      categories: categoryCounts.map(c => ({
        category: c.category,
        count: c._count.id,
      })),
      recentOrders,
    };
  }
}
