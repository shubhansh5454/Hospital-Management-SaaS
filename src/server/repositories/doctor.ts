import { prisma } from '../../db/prisma.ts';
import { CreateDoctorInput, UpdateDoctorInput, ScheduleInput, LeaveInput } from '../validation/doctor.ts';
import bcrypt from 'bcryptjs';

export class DoctorRepository {
  /**
   * Create a new Doctor (User + DoctorProfile + initial schedules)
   */
  public static async create(data: CreateDoctorInput) {
    // Generate a secure password if not provided
    const rawPassword = data.password || 'DoctorPass123!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    // Create Firebase UID mapping or generate a unique random UID
    const randomUid = 'doc_' + Math.random().toString(36).substring(2, 15);

    return prisma.user.create({
      data: {
        uid: randomUid,
        email: data.email.toLowerCase(),
        name: data.name,
        password: hashedPassword,
        role: 'doctor',
        doctorProfile: {
          create: {
            specialization: data.specialization,
            biography: data.biography ?? null,
            experienceYrs: data.experienceYrs ?? 0,
            schedules: data.schedules ? {
              createMany: {
                data: data.schedules.map(s => ({
                  dayOfWeek: s.dayOfWeek,
                  startTime: s.startTime,
                  endTime: s.endTime,
                }))
              }
            } : undefined
          }
        }
      },
      include: {
        doctorProfile: {
          include: {
            schedules: true,
            leaves: true,
          }
        }
      }
    });
  }

  /**
   * Find all doctors with search, specialization filter, and pagination
   */
  public static async findAll(params: {
    search?: string;
    specialization?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      role: 'doctor',
    };

    if (params.specialization) {
      where.doctorProfile = {
        specialization: {
          equals: params.specialization,
          mode: 'insensitive',
        }
      };
    }

    if (params.search) {
      const searchLower = params.search.toLowerCase();
      where.OR = [
        { name: { contains: searchLower, mode: 'insensitive' } },
        { email: { contains: searchLower, mode: 'insensitive' } },
        {
          doctorProfile: {
            specialization: { contains: searchLower, mode: 'insensitive' }
          }
        }
      ];
    }

    const [total, doctors] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          name: 'asc'
        },
        include: {
          doctorProfile: {
            include: {
              schedules: true,
              leaves: true,
            }
          }
        }
      })
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      doctors,
    };
  }

  /**
   * Find doctor by User ID (including details)
   */
  public static async findById(id: number) {
    return prisma.user.findFirst({
      where: {
        id,
        role: 'doctor'
      },
      include: {
        doctorProfile: {
          include: {
            schedules: {
              orderBy: [
                { dayOfWeek: 'asc' },
                { startTime: 'asc' }
              ]
            },
            leaves: {
              orderBy: {
                startDate: 'desc'
              }
            },
          }
        },
        appointments: {
          orderBy: [
            { date: 'desc' },
            { time: 'desc' }
          ]
        }
      }
    });
  }

  /**
   * Find doctor by email
   */
  public static async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
      }
    });
  }

  /**
   * Update a doctor
   */
  public static async update(id: number, data: UpdateDoctorInput) {
    return prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email ? data.email.toLowerCase() : undefined,
        doctorProfile: {
          update: {
            specialization: data.specialization,
            biography: data.biography,
            experienceYrs: data.experienceYrs,
          }
        }
      },
      include: {
        doctorProfile: {
          include: {
            schedules: true,
            leaves: true,
          }
        }
      }
    });
  }

  /**
   * Delete a doctor
   */
  public static async delete(id: number) {
    return prisma.user.delete({
      where: { id }
    });
  }

  /**
   * Add a schedule to doctor's profile
   */
  public static async addSchedule(profileId: number, schedule: ScheduleInput) {
    return prisma.doctorAvailability.create({
      data: {
        doctorProfileId: profileId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      }
    });
  }

  /**
   * Delete a schedule from doctor's profile
   */
  public static async deleteSchedule(id: number) {
    return prisma.doctorAvailability.delete({
      where: { id }
    });
  }

  /**
   * Add a leave record
   */
  public static async addLeave(profileId: number, leave: LeaveInput) {
    return prisma.doctorLeave.create({
      data: {
        doctorProfileId: profileId,
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason ?? null,
      }
    });
  }

  /**
   * Delete a leave record
   */
  public static async deleteLeave(id: number) {
    return prisma.doctorLeave.delete({
      where: { id }
    });
  }
}
