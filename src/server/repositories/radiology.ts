import { prisma } from '../../db/prisma.ts';

export interface CreateImagingOrderInput {
  patientId: number;
  doctorId: number;
  modality: string;
  bodyPart: string;
  reason: string;
  priority?: string;
  orderDate: string;
  notes?: string;
}

export interface SaveRadiologyReportInput {
  orderId: number;
  patientId: number;
  doctorId: number;
  findings: string;
  impression: string;
  recommendations?: string;
  status?: string; // DRAFT, SIGNED_OFF, APPROVED
  dicomImageUrl?: string;
  dicomSeriesUid?: string;
  dicomStudyUid?: string;
  signerName?: string;
  signedAt?: Date;
}

export class RadiologyRepository {
  /**
   * Create a new radiology imaging order
   */
  public static async createOrder(data: CreateImagingOrderInput) {
    return prisma.imagingOrder.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        modality: data.modality,
        bodyPart: data.bodyPart,
        reason: data.reason,
        priority: data.priority ?? 'ROUTINE',
        orderDate: data.orderDate,
        notes: data.notes ?? null,
        status: 'REQUESTED',
      },
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  /**
   * Find imaging order by ID
   */
  public static async findOrderById(id: number) {
    return prisma.imagingOrder.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, email: true }
        },
        reports: {
          include: {
            doctor: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
    });
  }

  /**
   * Find all imaging orders with optional patientId, search, or clinicId filters
   */
  public static async findAllOrders(filters: { patientId?: number; status?: string; search?: string; clinicId?: number }) {
    const where: any = {};

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    if (filters.search) {
      where.AND = [
        filters.clinicId ? { patient: { clinicId: filters.clinicId } } : {},
        {
          OR: [
            { modality: { contains: filters.search, mode: 'insensitive' } },
            { bodyPart: { contains: filters.search, mode: 'insensitive' } },
            { reason: { contains: filters.search, mode: 'insensitive' } },
            {
              patient: {
                name: { contains: filters.search, mode: 'insensitive' },
              },
            },
          ]
        }
      ];
    } else if (filters.clinicId) {
      where.patient = {
        clinicId: filters.clinicId
      };
    }

    return prisma.imagingOrder.findMany({
      where,
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, email: true }
        },
        reports: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update imaging order status
   */
  public static async updateOrderStatus(id: number, status: string) {
    return prisma.imagingOrder.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Create or update a radiology report (upsert based on orderId)
   */
  public static async saveReport(data: SaveRadiologyReportInput) {
    const existing = await prisma.radiologyReport.findUnique({
      where: { orderId: data.orderId },
    });

    if (existing) {
      return prisma.radiologyReport.update({
        where: { orderId: data.orderId },
        data: {
          findings: data.findings,
          impression: data.impression,
          recommendations: data.recommendations ?? null,
          status: data.status ?? existing.status,
          dicomImageUrl: data.dicomImageUrl ?? existing.dicomImageUrl,
          dicomSeriesUid: data.dicomSeriesUid ?? existing.dicomSeriesUid,
          dicomStudyUid: data.dicomStudyUid ?? existing.dicomStudyUid,
          signerName: data.signerName ?? existing.signerName,
          signedAt: data.signedAt ?? existing.signedAt,
        },
        include: {
          patient: true,
          doctor: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    }

    return prisma.radiologyReport.create({
      data: {
        orderId: data.orderId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        findings: data.findings,
        impression: data.impression,
        recommendations: data.recommendations ?? null,
        status: data.status ?? 'DRAFT',
        dicomImageUrl: data.dicomImageUrl ?? null,
        dicomSeriesUid: data.dicomSeriesUid ?? null,
        dicomStudyUid: data.dicomStudyUid ?? null,
        signerName: data.signerName ?? null,
        signedAt: data.signedAt ?? null,
      },
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  /**
   * Find radiology report by order ID
   */
  public static async findReportByOrderId(orderId: number) {
    return prisma.radiologyReport.findUnique({
      where: { orderId },
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, email: true }
        },
        order: true,
      },
    });
  }

  /**
   * Find reports for a specific patient
   */
  public static async findReportsByPatientId(patientId: number) {
    return prisma.radiologyReport.findMany({
      where: { patientId },
      include: {
        order: true,
        doctor: {
          select: { id: true, name: true, email: true }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
