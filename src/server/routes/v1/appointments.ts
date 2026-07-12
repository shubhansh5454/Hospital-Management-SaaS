import { Router, Response } from 'express';
import { requireAuth } from '../../../middleware/auth.ts';
import { prisma } from '../../../db/prisma.ts';
import { createAppointmentSchema, updateAppointmentSchema } from '../../validation/appointment.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { standardRateLimiter, writeRateLimiter } from '../../middleware/rateLimiter.ts';
import { RolesService } from '../../services/roles.ts';
import { AppointmentRepository } from '../../repositories/appointment.ts';
import { NotificationService } from '../../services/notification.ts';

const router = Router();

// Apply auth globally to all appointment endpoints
router.use(requireAuth);

/**
 * @route GET /api/v1/appointments
 * @desc Get list of appointments with robust search, filters (doctorId, patientId, status, date), and pagination
 * @access Private
 */
router.get('/', standardRateLimiter, async (req: any, res: Response, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const skip = (page - 1) * limit;

    const doctorIdQuery = req.query.doctorId ? parseInt(req.query.doctorId as string, 10) : undefined;
    const patientIdQuery = req.query.patientId ? parseInt(req.query.patientId as string, 10) : undefined;
    const status = req.query.status as string | undefined;
    const date = req.query.date as string | undefined;
    const search = req.query.search as string | undefined;

    const role = req.user?.role;
    const userId = req.user?.id;
    const clinicId = req.user?.clinicId;

    const where: any = {};

    if (clinicId) {
      where.clinicId = clinicId;
    }

    if (status) {
      where.status = { equals: status, mode: 'insensitive' };
    }

    if (date) {
      where.date = date;
    }

    // Role-based filtering constraints
    if (role === 'doctor') {
      where.doctorId = userId;
    } else if (role === 'patient') {
      const matchedPatients = await prisma.patient.findMany({
        where: { email: req.user.email },
      });
      if (matchedPatients.length === 0) {
        return res.status(200).json({
          status: 'success',
          data: [],
          pagination: { totalCount: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        });
      }
      where.patientId = { in: matchedPatients.map((p) => p.id) };
    } else {
      // Receptionist/Admin can specify doctors/patients
      if (doctorIdQuery) where.doctorId = doctorIdQuery;
      if (patientIdQuery) where.patientId = patientIdQuery;
    }

    // Text search (search in doctor's name, patient's name, reason, or notes)
    if (search) {
      const searchLower = search.toLowerCase();
      where.OR = [
        { reason: { contains: searchLower, mode: 'insensitive' } },
        { notes: { contains: searchLower, mode: 'insensitive' } },
        {
          patient: {
            name: { contains: searchLower, mode: 'insensitive' },
          },
        },
        {
          doctor: {
            name: { contains: searchLower, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, appointments] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { date: 'desc' },
          { time: 'desc' },
        ],
        include: {
          doctor: {
            select: { id: true, name: true, email: true, role: true },
          },
          patient: {
            select: { id: true, name: true, email: true, phone: true, dob: true, gender: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: 'success',
      data: appointments,
      pagination: {
        totalCount: total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/appointments/:id
 * @desc Get individual appointment details
 * @access Private
 */
router.get('/:id', standardRateLimiter, async (req: any, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid appointment ID format', 400);
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        doctor: {
          select: { id: true, name: true, email: true },
        },
        patient: {
          select: { id: true, name: true, email: true, phone: true, dob: true, gender: true },
        },
      },
    });

    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    // Role security check
    const role = req.user?.role;
    const userId = req.user?.id;
    if (role === 'doctor' && appointment.doctorId !== userId) {
      throw new AppError('Access denied: You are not scheduled for this appointment', 403);
    }
    if (role === 'patient' && appointment.patient.email !== req.user.email) {
      throw new AppError('Access denied: You cannot view another patient\'s appointment details', 403);
    }

    res.status(200).json({
      status: 'success',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v1/appointments
 * @desc Book a new appointment with validation & overlap checks
 * @access Private
 */
router.post('/', writeRateLimiter, async (req: any, res: Response, next) => {
  try {
    const parsed = createAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { doctorId, patientId, date, time, reason, notes, status } = parsed.data;
    const clinicId = req.user?.clinicId;

    // 1. Verify doctor exists and is a doctor
    const doctor = await prisma.user.findFirst({
      where: { id: doctorId, role: 'doctor' },
    });
    if (!doctor) {
      throw new AppError('The specified doctor is invalid or not found', 404);
    }

    // 2. Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new AppError('The specified patient was not found', 404);
    }

    // 3. Prevent appointment booking by patients for other users
    if (req.user.role === 'patient' && patient.email !== req.user.email) {
      throw new AppError('Access Denied: You cannot schedule an appointment for another patient', 403);
    }

    // 4. Double booking (overlap) check
    const isOverlapping = await AppointmentRepository.checkOverlap(doctorId, date, time);
    if (isOverlapping) {
      throw new AppError(`Dr. ${doctor.name} is already booked at ${time} on ${date}. Please choose another time slot.`, 400);
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        date,
        time,
        reason,
        notes: notes ?? null,
        status,
        clinicId: clinicId || null,
      },
      include: {
        doctor: { select: { id: true, name: true, email: true } },
        patient: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    // Write audit log
    try {
      await RolesService.logRequest(req, 'CREATE_APPOINTMENT', 'appointments', {
        id: appointment.id,
        date: appointment.date,
        time: appointment.time,
        patientId: appointment.patientId,
      });
    } catch (logErr) {
      console.error('Audit log failed for create appointment:', logErr);
    }

    // Send notifications
    try {
      await NotificationService.sendNotification({
        patientId: appointment.patientId,
        clinicId: appointment.clinicId || undefined,
        title: 'New Appointment Booked',
        message: `Dear ${patient.name}, your appointment with Dr. ${doctor.name} has been booked for ${appointment.date} at ${appointment.time}.`,
        type: 'APPOINTMENT_REMINDER',
        channels: ['IN_APP', 'EMAIL'],
      });
    } catch (notifErr) {
      console.error('Notification failed for booked appointment:', notifErr);
    }

    res.status(211).json({
      status: 'success',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/v1/appointments/:id
 * @desc Reschedule or update appointment
 * @access Private
 */
router.put('/:id', writeRateLimiter, async (req: any, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid appointment ID format', 400);
    }

    const parsed = updateAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    // Access control
    const role = req.user?.role;
    if (role === 'patient' && appointment.patient.email !== req.user.email) {
      throw new AppError('Access Denied: You cannot update this appointment', 403);
    }

    const finalDoctorId = parsed.data.doctorId ?? appointment.doctorId;
    const finalDate = parsed.data.date ?? appointment.date;
    const finalTime = parsed.data.time ?? appointment.time;

    // Overlap checks
    if (
      (parsed.data.doctorId !== undefined && parsed.data.doctorId !== appointment.doctorId) ||
      (parsed.data.date !== undefined && parsed.data.date !== appointment.date) ||
      (parsed.data.time !== undefined && parsed.data.time !== appointment.time)
    ) {
      const isOverlapping = await AppointmentRepository.checkOverlap(finalDoctorId, finalDate, finalTime, id);
      if (isOverlapping) {
        throw new AppError(`The assigned doctor is already booked at ${finalTime} on ${finalDate}. Please select another slot.`, 400);
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: parsed.data,
      include: {
        doctor: { select: { id: true, name: true, email: true } },
        patient: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    // Write audit log
    try {
      await RolesService.logRequest(req, 'UPDATE_APPOINTMENT', 'appointments', { id, updates: parsed.data });
    } catch (logErr) {
      console.error('Audit log failed for update appointment:', logErr);
    }

    // Trigger Notification
    try {
      let notifTitle = 'Appointment Updated';
      let notifMessage = `Dear ${updated.patient.name}, your appointment with Dr. ${updated.doctor.name} has been updated to ${updated.date} at ${updated.time}.`;

      if (parsed.data.status === 'cancelled') {
        notifTitle = 'Appointment Cancelled';
        notifMessage = `Dear ${updated.patient.name}, your appointment with Dr. ${updated.doctor.name} scheduled for ${updated.date} has been cancelled.`;
      }

      await NotificationService.sendNotification({
        patientId: updated.patientId,
        clinicId: updated.clinicId || undefined,
        title: notifTitle,
        message: notifMessage,
        type: 'APPOINTMENT_REMINDER',
        channels: ['IN_APP', 'EMAIL'],
      });
    } catch (notifErr) {
      console.error('Notification failed for update appointment:', notifErr);
    }

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/v1/appointments/:id
 * @desc Cancel/Delete appointment
 * @access Private
 */
router.delete('/:id', writeRateLimiter, async (req: any, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid appointment ID format', 400);
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    // Access control
    if (req.user.role === 'patient' && appointment.patient.email !== req.user.email) {
      throw new AppError('Access Denied: You are not authorized to cancel this appointment', 403);
    }

    await prisma.appointment.delete({ where: { id } });

    // Write audit log
    try {
      await RolesService.logRequest(req, 'DELETE_APPOINTMENT', 'appointments', { id, patientId: appointment.patientId });
    } catch (logErr) {
      console.error('Audit log failed for delete appointment:', logErr);
    }

    res.status(200).json({
      status: 'success',
      message: 'Appointment deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

export const v1AppointmentsRouter = router;
