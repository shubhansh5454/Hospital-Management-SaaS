import { DoctorRepository } from '../repositories/doctor.ts';
import { CreateDoctorInput, UpdateDoctorInput, ScheduleInput, LeaveInput } from '../validation/doctor.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { prisma } from '../../db/prisma.ts';
import { logger } from '../utils/logger.ts';

export class DoctorService {
  /**
   * Create a new doctor with email uniqueness check
   */
  public static async createDoctor(input: CreateDoctorInput) {
    const existing = await DoctorRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError('A user with this email address already exists.', 400);
    }
    return DoctorRepository.create(input);
  }

  /**
   * Get all doctors with search, specialization filter, and pagination
   */
  public static async getAllDoctors(params: {
    search?: string;
    specialization?: string;
    page?: number;
    limit?: number;
  }) {
    return DoctorRepository.findAll(params);
  }

  /**
   * Get doctor by ID with safety checks
   */
  public static async getDoctorById(id: number) {
    const doctor = await DoctorRepository.findById(id);
    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }
    return doctor;
  }

  /**
   * Update doctor
   */
  public static async updateDoctor(id: number, input: UpdateDoctorInput) {
    await this.getDoctorById(id); // Throws 404 if not found

    if (input.email) {
      const existing = await DoctorRepository.findByEmail(input.email);
      if (existing && existing.id !== id) {
        throw new AppError('A user with this email address already exists.', 400);
      }
    }

    return DoctorRepository.update(id, input);
  }

  /**
   * Delete doctor
   */
  public static async deleteDoctor(id: number) {
    await this.getDoctorById(id); // Throws 404 if not found
    await DoctorRepository.delete(id);
    return { success: true, message: 'Doctor successfully deleted' };
  }

  /**
   * Add a schedule
   */
  public static async addSchedule(doctorId: number, schedule: ScheduleInput) {
    const doctor = await this.getDoctorById(doctorId);
    if (!doctor.doctorProfile) {
      throw new AppError('Doctor profile does not exist', 400);
    }
    const result = await DoctorRepository.addSchedule(doctor.doctorProfile.id, schedule);

    // Broadcast doctor availability change in real-time
    if (doctor.clinicId) {
      try {
        const { RealTimeService } = await import('./realtime.ts');
        RealTimeService.broadcastDoctorAvailabilityUpdate(doctor.clinicId, doctor.doctorProfile.id, 'schedule_added');
      } catch (wsErr) {
        logger.error('Failed to broadcast real-time doctor availability:', wsErr);
      }
    }

    return result;
  }

  /**
   * Delete a schedule
   */
  public static async deleteSchedule(doctorId: number, scheduleId: number) {
    const doctor = await this.getDoctorById(doctorId);
    if (!doctor.doctorProfile) {
      throw new AppError('Doctor profile does not exist', 400);
    }

    // Verify schedule belongs to this doctor
    const belongs = doctor.doctorProfile.schedules.some(s => s.id === scheduleId);
    if (!belongs) {
      throw new AppError('Schedule not found or does not belong to this doctor', 404);
    }

    await DoctorRepository.deleteSchedule(scheduleId);

    // Broadcast doctor availability change in real-time
    if (doctor.clinicId) {
      try {
        const { RealTimeService } = await import('./realtime.ts');
        RealTimeService.broadcastDoctorAvailabilityUpdate(doctor.clinicId, doctor.doctorProfile.id, 'schedule_deleted');
      } catch (wsErr) {
        logger.error('Failed to broadcast real-time doctor availability:', wsErr);
      }
    }

    return { success: true, message: 'Schedule successfully deleted' };
  }

  /**
   * Add a leave record
   */
  public static async addLeave(doctorId: number, leave: LeaveInput) {
    const doctor = await this.getDoctorById(doctorId);
    if (!doctor.doctorProfile) {
      throw new AppError('Doctor profile does not exist', 400);
    }
    const result = await DoctorRepository.addLeave(doctor.doctorProfile.id, leave);

    // Broadcast doctor availability change in real-time
    if (doctor.clinicId) {
      try {
        const { RealTimeService } = await import('./realtime.ts');
        RealTimeService.broadcastDoctorAvailabilityUpdate(doctor.clinicId, doctor.doctorProfile.id, 'leave_added');
      } catch (wsErr) {
        logger.error('Failed to broadcast real-time doctor availability:', wsErr);
      }
    }

    return result;
  }

  /**
   * Delete a leave record
   */
  public static async deleteLeave(doctorId: number, leaveId: number) {
    const doctor = await this.getDoctorById(doctorId);
    if (!doctor.doctorProfile) {
      throw new AppError('Doctor profile does not exist', 400);
    }

    // Verify leave belongs to this doctor
    const belongs = doctor.doctorProfile.leaves.some(l => l.id === leaveId);
    if (!belongs) {
      throw new AppError('Leave record not found or does not belong to this doctor', 404);
    }

    await DoctorRepository.deleteLeave(leaveId);

    // Broadcast doctor availability change in real-time
    if (doctor.clinicId) {
      try {
        const { RealTimeService } = await import('./realtime.ts');
        RealTimeService.broadcastDoctorAvailabilityUpdate(doctor.clinicId, doctor.doctorProfile.id, 'leave_deleted');
      } catch (wsErr) {
        logger.error('Failed to broadcast real-time doctor availability:', wsErr);
      }
    }

    return { success: true, message: 'Leave record successfully deleted' };
  }

  /**
   * Get all unique specializations
   */
  public static async getSpecializations() {
    const profiles = await prisma.doctorProfile.findMany({
      select: {
        specialization: true,
      },
      distinct: ['specialization'],
    });
    return profiles.map(p => p.specialization).filter(Boolean);
  }
}
