import { AppointmentRepository, AppointmentFilterInput } from '../repositories/appointment.ts';
import { UserRepository } from '../repositories/user.ts';
import { PatientRepository } from '../repositories/patient.ts';
import { CreateAppointmentInput, UpdateAppointmentInput, FilterAppointmentQuery } from '../validation/appointment.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { NotificationService } from './notification.ts';
import { logger } from '../utils/logger.ts';
import { doctorsCache } from '../utils/cache.ts';
import { prisma } from '../../db/prisma.ts';

export class AppointmentService {
  /**
   * Create a new appointment
   */
  public static async createAppointment(input: CreateAppointmentInput & { clinicId?: number }) {
    const { doctorId, patientId, date, time, clinicId } = input;

    // 1. Verify doctor exists and has the 'doctor' role
    const doctor = await UserRepository.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      throw new AppError('The assigned doctor was not found or is invalid', 404);
    }

    // 2. Verify patient exists
    const patient = await PatientRepository.findById(patientId);
    if (!patient) {
      throw new AppError('The selected patient profile was not found', 404);
    }

    // 3. Double-Booking Check (Doctor Availability)
    const overlap = await AppointmentRepository.checkOverlap(doctorId, date, time);
    if (overlap) {
      throw new AppError(`Dr. ${doctor.name} is already booked at ${time} on ${date}. Please select another time slot.`, 400);
    }

    const created = await AppointmentRepository.create({ ...input, clinicId });

    // Broadcast appointment creation in real-time
    if (created.clinicId) {
      try {
        const { RealTimeService } = await import('./realtime.ts');
        RealTimeService.broadcastAppointmentUpdate(created.clinicId, 'created', created);
      } catch (wsErr) {
        logger.error('Failed to broadcast real-time appointment:created event:', wsErr);
      }
    }

    // Trigger confirmation notification asynchronously
    try {
      await NotificationService.sendNotification({
        patientId,
        clinicId,
        title: 'Appointment Booked Successfully',
        message: `Dear ${patient.name}, your appointment with Dr. ${doctor.name} has been scheduled for ${date} at ${time}.`,
        type: 'APPOINTMENT_REMINDER',
        channels: ['IN_APP', 'EMAIL'],
      });
    } catch (err) {
      logger.error('Failed to trigger automatic appointment booking notification:', err);
    }

    return created;
  }

  /**
   * Get all appointments with pagination & query filters
   */
  public static async getAllAppointments(query: FilterAppointmentQuery & { clinicId?: number }) {
    const { page, limit, doctorId, patientId, date, status, search, clinicId } = query;
    const skip = (page - 1) * limit;

    const filters: AppointmentFilterInput = {
      doctorId,
      patientId,
      date,
      status,
      search,
      skip,
      take: limit,
      clinicId,
    };

    const [appointments, totalCount] = await Promise.all([
      AppointmentRepository.findAll(filters),
      AppointmentRepository.countAll({ doctorId, patientId, date, status, search, clinicId }),
    ]);

    return {
      appointments,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Get single appointment by ID
   */
  public static async getAppointmentById(id: number) {
    const appointment = await AppointmentRepository.findById(id);
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }
    return appointment;
  }

  /**
   * Update an appointment
   */
  public static async updateAppointment(id: number, input: UpdateAppointmentInput) {
    const appointment = await this.getAppointmentById(id);

    const docId = input.doctorId ?? appointment.doctorId;
    const dateVal = input.date ?? appointment.date;
    const timeVal = input.time ?? appointment.time;

    // Check if we are updating doctor/date/time and verify double booking
    if (
      (input.doctorId !== undefined && input.doctorId !== appointment.doctorId) ||
      (input.date !== undefined && input.date !== appointment.date) ||
      (input.time !== undefined && input.time !== appointment.time)
    ) {
      // 1. Verify doctor role if doctor updated
      if (input.doctorId !== undefined) {
        const doctor = await UserRepository.findById(docId);
        if (!doctor || doctor.role !== 'doctor') {
          throw new AppError('The assigned doctor was not found or is invalid', 404);
        }
      }

      // 2. Double-Booking Check
      const overlap = await AppointmentRepository.checkOverlap(docId, dateVal, timeVal, id);
      if (overlap) {
        throw new AppError(`The selected doctor is already booked at ${timeVal} on ${dateVal}. Please select another time slot.`, 400);
      }
    }

    // 3. Verify patient if updating patient
    if (input.patientId !== undefined && input.patientId !== appointment.patientId) {
      const patient = await PatientRepository.findById(input.patientId);
      if (!patient) {
        throw new AppError('The selected patient profile was not found', 404);
      }
    }

    const updated = await AppointmentRepository.update(id, input);

    // Broadcast appointment update in real-time
    if (updated.clinicId) {
      try {
        const { RealTimeService } = await import('./realtime.ts');
        const changeType = input.status === 'cancelled' ? 'cancelled' : 'updated';
        RealTimeService.broadcastAppointmentUpdate(updated.clinicId, changeType, updated);
      } catch (wsErr) {
        logger.error('Failed to broadcast real-time appointment:updated event:', wsErr);
      }
    }

    // Trigger update or cancellation notifications asynchronously
    try {
      const patient = await PatientRepository.findById(updated.patientId);
      const doctor = await UserRepository.findById(updated.doctorId);
      if (patient && doctor && doctor.role === 'doctor') {
        let title = 'Appointment Updated';
        let message = `Dear ${patient.name}, your appointment with Dr. ${doctor.name} has been updated to ${updated.date} at ${updated.time}.`;

        if (input.status === 'cancelled') {
          title = 'Appointment Cancelled';
          message = `Dear ${patient.name}, your appointment with Dr. ${doctor.name} scheduled for ${updated.date} has been cancelled.`;
        }

        await NotificationService.sendNotification({
          patientId: updated.patientId,
          clinicId: updated.clinicId || undefined,
          title,
          message,
          type: 'APPOINTMENT_REMINDER',
          channels: ['IN_APP', 'EMAIL'],
        });
      }
    } catch (err) {
      logger.error('Failed to trigger automatic appointment update notification:', err);
    }

    return updated;
  }

  /**
   * Delete an appointment
   */
  public static async deleteAppointment(id: number) {
    const appointment = await this.getAppointmentById(id);
    await AppointmentRepository.delete(id);

    // Broadcast appointment deletion/update in real-time
    if (appointment.clinicId) {
      try {
        const { RealTimeService } = await import('./realtime.ts');
        RealTimeService.broadcastAppointmentUpdate(appointment.clinicId, 'updated', { id, deleted: true });
      } catch (wsErr) {
        logger.error('Failed to broadcast real-time appointment:deleted event:', wsErr);
      }
    }

    return { success: true, message: 'Appointment successfully deleted' };
  }

  /**
   * Get list of physicians for appointment scheduling dropdowns.
   * Implements high performance TTL caching to prevent database overload.
   */
  public static async getDoctorsList() {
    const cacheKey = 'appointments_physicians_list';
    const cached = doctorsCache.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const doctors = await prisma.user.findMany({
      where: { role: 'doctor' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    doctorsCache.set(cacheKey, doctors, 60); // Cache for 60 seconds
    return doctors;
  }
}
