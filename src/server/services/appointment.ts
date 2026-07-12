import { AppointmentRepository, AppointmentFilterInput } from '../repositories/appointment.ts';
import { prisma } from '../../db/prisma.ts';
import { CreateAppointmentInput, UpdateAppointmentInput, FilterAppointmentQuery } from '../validation/appointment.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { NotificationService } from './notification.ts';
import { logger } from '../utils/logger.ts';

export class AppointmentService {
  /**
   * Create a new appointment
   */
  public static async createAppointment(input: CreateAppointmentInput & { clinicId?: number }) {
    const { doctorId, patientId, date, time, clinicId } = input;

    // 1. Verify doctor exists and has the 'doctor' role
    const doctor = await prisma.user.findFirst({
      where: { id: doctorId, role: 'doctor' },
    });
    if (!doctor) {
      throw new AppError('The assigned doctor was not found or is invalid', 404);
    }

    // 2. Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new AppError('The selected patient profile was not found', 404);
    }

    // 3. Double-Booking Check (Doctor Availability)
    const overlap = await AppointmentRepository.checkOverlap(doctorId, date, time);
    if (overlap) {
      throw new AppError(`Dr. ${doctor.name} is already booked at ${time} on ${date}. Please select another time slot.`, 400);
    }

    const created = await AppointmentRepository.create({ ...input, clinicId });

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
        const doctor = await prisma.user.findFirst({
          where: { id: docId, role: 'doctor' },
        });
        if (!doctor) {
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
      const patient = await prisma.patient.findUnique({
        where: { id: input.patientId },
      });
      if (!patient) {
        throw new AppError('The selected patient profile was not found', 404);
      }
    }

    const updated = await AppointmentRepository.update(id, input);

    // Trigger update or cancellation notifications asynchronously
    try {
      const patient = await prisma.patient.findUnique({ where: { id: updated.patientId } });
      const doctor = await prisma.user.findFirst({ where: { id: updated.doctorId, role: 'doctor' } });
      if (patient && doctor) {
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
    await this.getAppointmentById(id);
    await AppointmentRepository.delete(id);
    return { success: true, message: 'Appointment successfully deleted' };
  }
}
