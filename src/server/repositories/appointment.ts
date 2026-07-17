import { prisma } from '../../db/prisma.ts';

export interface AppointmentFilterInput {
  doctorId?: number;
  patientId?: number;
  date?: string;
  status?: string;
  search?: string;
  skip?: number;
  take?: number;
  clinicId?: number;
}

export class AppointmentRepository {
  /**
   * Consistently build query conditions across find and count operations (DRY)
   */
  private static buildWhereClause(filters: AppointmentFilterInput) {
    const { doctorId, patientId, date, status, search, clinicId } = filters;
    const whereClause: any = {};

    if (clinicId !== undefined) {
      whereClause.clinicId = clinicId;
    }

    if (doctorId !== undefined) {
      whereClause.doctorId = doctorId;
    }

    if (patientId !== undefined) {
      whereClause.patientId = patientId;
    }

    if (date) {
      whereClause.date = date;
    }

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        whereClause.OR = [
          {
            reason: {
              contains: trimmedSearch,
              mode: 'insensitive',
            },
          },
          {
            notes: {
              contains: trimmedSearch,
              mode: 'insensitive',
            },
          },
          {
            patient: {
              name: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
          },
          {
            doctor: {
              name: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
          },
        ];
      }
    }

    return whereClause;
  }

  /**
   * Create a new appointment
   */
  public static async create(data: {
    patientId: number;
    doctorId: number;
    date: string;
    time: string;
    reason: string;
    notes?: string;
    status?: string;
    clinicId?: number;
  }, tx?: any) {
    const client = tx || prisma;
    return client.appointment.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        date: data.date,
        time: data.time,
        reason: data.reason,
        notes: data.notes ?? null,
        status: data.status ?? 'scheduled',
        clinicId: data.clinicId ?? null,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Find all appointments based on filters, pagination, and search queries
   */
  public static async findAll(filters: AppointmentFilterInput) {
    const { skip = 0, take = 50 } = filters;
    const whereClause = this.buildWhereClause(filters);

    return prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      skip,
      take,
    });
  }

  /**
   * Count total appointments matching the filter conditions
   */
  public static async countAll(filters: Omit<AppointmentFilterInput, 'skip' | 'take'>) {
    const whereClause = this.buildWhereClause(filters);
    return prisma.appointment.count({
      where: whereClause,
    });
  }

  /**
   * Find a single appointment by ID
   */
  public static async findById(id: number) {
    return prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Update an appointment
   */
  public static async update(
    id: number,
    data: {
      patientId?: number;
      doctorId?: number;
      date?: string;
      time?: string;
      reason?: string;
      notes?: string;
      status?: string;
    },
    tx?: any
  ) {
    const client = tx || prisma;
    return client.appointment.update({
      where: { id },
      data,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Check for any active (not cancelled) appointments overlapping for a doctor.
   * Optimizes query performance by returning only the ID projection instead of fetching the entire record.
   */
  public static async checkOverlap(
    doctorId: number,
    date: string,
    time: string,
    excludeId?: number,
    tx?: any
  ) {
    const client = tx || prisma;
    return client.appointment.findFirst({
      where: {
        doctorId,
        date,
        time,
        status: {
          not: 'cancelled',
        },
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
      },
    });
  }

  /**
   * Delete an appointment
   */
  public static async delete(id: number) {
    return prisma.appointment.delete({
      where: { id },
    });
  }
}
