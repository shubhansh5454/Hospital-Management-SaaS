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
  }) {
    return prisma.appointment.create({
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
    const { doctorId, patientId, date, status, search, skip = 0, take = 50, clinicId } = filters;

    // Build query conditions
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
      whereClause.OR = [
        {
          reason: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          notes: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          patient: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          doctor: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

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
      whereClause.OR = [
        {
          reason: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          notes: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          patient: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          doctor: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

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
    }
  ) {
    return prisma.appointment.update({
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
   * Check for any active (not cancelled) appointments overlapping for a doctor
   */
  public static async checkOverlap(
    doctorId: number,
    date: string,
    time: string,
    excludeId?: number
  ) {
    return prisma.appointment.findFirst({
      where: {
        doctorId,
        date,
        time,
        status: {
          not: 'cancelled',
        },
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
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
