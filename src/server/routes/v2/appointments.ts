import { Router, Response } from 'express';
import { requireAuth } from '../../../middleware/auth.ts';
import { prisma } from '../../../db/prisma.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { standardRateLimiter, writeRateLimiter } from '../../middleware/rateLimiter.ts';
import { createAppointmentSchema } from '../../validation/appointment.ts';
import { AppointmentRepository } from '../../repositories/appointment.ts';
import { RolesService } from '../../services/roles.ts';

const router = Router();

// Apply auth globally to all appointment endpoints
router.use(requireAuth);

/**
 * @route GET /api/v2/appointments
 * @desc Get list of appointments formatted in standard JSend structure with modern Telehealth tags
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

    if (role === 'doctor') {
      where.doctorId = userId;
    } else if (role === 'patient') {
      const matchedPatients = await prisma.patient.findMany({
        where: { email: req.user.email },
      });
      if (matchedPatients.length === 0) {
        return res.status(200).json({
          status: 'success',
          apiVersion: '2.0.0',
          data: { appointments: [] },
          pagination: { totalCount: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        });
      }
      where.patientId = { in: matchedPatients.map((p) => p.id) };
    } else {
      if (doctorIdQuery) where.doctorId = doctorIdQuery;
      if (patientIdQuery) where.patientId = patientIdQuery;
    }

    if (search) {
      const searchLower = search.toLowerCase();
      where.OR = [
        { reason: { contains: searchLower, mode: 'insensitive' } },
        { notes: { contains: searchLower, mode: 'insensitive' } },
        { patient: { name: { contains: searchLower, mode: 'insensitive' } } },
        { doctor: { name: { contains: searchLower, mode: 'insensitive' } } },
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
            select: { id: true, name: true, email: true },
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
      apiVersion: '2.0.0',
      data: {
        appointments: appointments.map(app => {
          const isTelehealth = app.notes?.toLowerCase().includes('video') || app.notes?.toLowerCase().includes('telehealth') || app.notes?.toLowerCase().includes('online');
          const isUrgent = app.reason.toLowerCase().includes('urgent') || app.reason.toLowerCase().includes('emergency') || app.reason.toLowerCase().includes('acute');

          return {
            id: app.id,
            patientId: app.patientId,
            doctorId: app.doctorId,
            date: app.date,
            time: app.time,
            status: app.status,
            reason: app.reason,
            notes: app.notes,
            clinicId: app.clinicId,
            createdAt: app.createdAt,
            patient: app.patient,
            doctor: app.doctor,
            // V2 additions: telehealth link matching, priority metadata
            delivery: {
              type: isTelehealth ? 'TELEHEALTH' : 'IN_PERSON',
              virtualRoomUrl: isTelehealth ? `https://meet.jit.si/caresync-${app.id}-${app.patientId}` : null
            },
            priority: isUrgent ? 'HIGH' : 'NORMAL'
          };
        })
      },
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
 * @route POST /api/v2/appointments
 * @desc Book a new appointment under Version 2 with extended telehealth metadata
 */
router.post('/', writeRateLimiter, async (req: any, res: Response, next) => {
  try {
    const parsed = createAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { doctorId, patientId, date, time, reason, notes, status } = parsed.data;
    const clinicId = req.user?.clinicId;

    // Verify doctor exists
    const doctor = await prisma.user.findFirst({
      where: { id: doctorId, role: 'doctor' },
    });
    if (!doctor) {
      throw new AppError('The specified doctor is invalid or not found', 404);
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new AppError('The specified patient was not found', 404);
    }

    if (req.user.role === 'patient' && patient.email !== req.user.email) {
      throw new AppError('Access Denied: You cannot schedule an appointment for another patient', 403);
    }

    // Overlap check
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
      await RolesService.logRequest(req, 'CREATE_APPOINTMENT_V2', 'appointments', {
        id: appointment.id,
        date: appointment.date,
        time: appointment.time,
        patientId: appointment.patientId,
      });
    } catch (logErr) {
      console.error('Audit log failed for create appointment v2:', logErr);
    }

    const isTelehealth = notes?.toLowerCase().includes('video') || notes?.toLowerCase().includes('telehealth') || notes?.toLowerCase().includes('online');

    res.status(201).json({
      status: 'success',
      apiVersion: '2.0.0',
      data: {
        appointment: {
          id: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          date: appointment.date,
          time: appointment.time,
          status: appointment.status,
          reason: appointment.reason,
          notes: appointment.notes,
          clinicId: appointment.clinicId,
          createdAt: appointment.createdAt,
          doctor: appointment.doctor,
          patient: appointment.patient,
          delivery: {
            type: isTelehealth ? 'TELEHEALTH' : 'IN_PERSON',
            virtualRoomUrl: isTelehealth ? `https://meet.jit.si/caresync-${appointment.id}-${appointment.patientId}` : null
          },
          priority: reason.toLowerCase().includes('urgent') ? 'HIGH' : 'NORMAL'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export const v2AppointmentsRouter = router;
