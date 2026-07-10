import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { prisma } from '../../db/prisma.ts';
import { AppError } from '../middleware/errorHandler.ts';

const router = Router();

// Secure all reception endpoints with Auth & appropriate roles
router.use(requireAuth);
router.use(requireRoles(['admin', 'receptionist', 'doctor']));

/**
 * GET /api/reception/dashboard
 * Fetch all initial reception dashboard state: Today's appointments, Active Queue, and Stats
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Fetch Today's Appointments (scheduled, completed, cancelled, checked_in)
    const appointments = await prisma.appointment.findMany({
      where: {
        date: todayStr,
      },
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, email: true },
        },
        queueToken: true,
      },
      orderBy: {
        time: 'asc',
      },
    });

    // 2. Fetch Active Queue for Today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const queueTokens = await prisma.queueToken.findMany({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true },
        },
        appointment: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    // 3. Compute Stats
    const totalWaiting = queueTokens.filter(q => q.status === 'WAITING').length;
    const totalCalling = queueTokens.filter(q => q.status === 'CALLING').length;
    const totalInConsultation = queueTokens.filter(q => q.status === 'IN_CONSULTATION').length;
    const totalCompleted = queueTokens.filter(q => q.status === 'COMPLETED').length;
    const totalSkipped = queueTokens.filter(q => q.status === 'SKIPPED').length;

    res.json({
      appointments,
      queue: queueTokens,
      stats: {
        totalWaiting,
        totalCalling,
        totalInConsultation,
        totalCompleted,
        totalSkipped,
        totalQueue: queueTokens.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reception/patients/search
 * Search patients by name, email, or phone
 */
router.get('/patients/search', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.json([]);
    }

    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
      take: 20,
    });

    res.json(patients);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reception/checkin
 * Check-in a patient for a scheduled appointment and issue a Queue Token
 */
router.post('/checkin', async (req, res, next) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) {
      throw new AppError('Appointment ID is required', 400);
    }

    // 1. Find the appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id: Number(appointmentId) },
      include: { queueToken: true },
    });

    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    if (appointment.status === 'checked_in' || appointment.queueToken) {
      throw new AppError('Patient is already checked in and has a token.', 400);
    }

    // 2. Generate new Token Number
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tokenCount = await prisma.queueToken.count({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
    });

    const tokenNumber = `T-${String(tokenCount + 1).padStart(3, '0')}`;

    // 3. Create QueueToken and update appointment status within a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create token
      const token = await tx.queueToken.create({
        data: {
          tokenNumber,
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
          status: 'WAITING',
        },
        include: {
          patient: true,
          doctor: { select: { id: true, name: true } },
        },
      });

      // Update appointment status
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'checked_in' },
      });

      return token;
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reception/token/manual
 * Generate a manual/walk-in Token directly for an existing patient without preset appointment
 */
router.post('/token/manual', async (req, res, next) => {
  try {
    const { patientId, doctorId, reason, notes } = req.body;
    if (!patientId || !doctorId) {
      throw new AppError('Patient ID and Doctor ID are required', 400);
    }

    // Generate Token Number
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tokenCount = await prisma.queueToken.count({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
    });

    const tokenNumber = `T-${String(tokenCount + 1).padStart(3, '0')}`;
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0].substring(0, 5);

    // Create walk-in appointment and issue token
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create walk-in appointment
      const appointment = await tx.appointment.create({
        data: {
          patientId: Number(patientId),
          doctorId: Number(doctorId),
          date: todayStr,
          time: timeStr,
          reason: reason || 'Walk-in Consultation',
          status: 'checked_in',
          notes: notes || 'Walk-in client check-in',
        },
      });

      // 2. Create Token
      const token = await tx.queueToken.create({
        data: {
          tokenNumber,
          patientId: Number(patientId),
          appointmentId: appointment.id,
          doctorId: Number(doctorId),
          status: 'WAITING',
          notes: notes || '',
        },
        include: {
          patient: true,
          doctor: { select: { id: true, name: true } },
        },
      });

      return token;
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reception/walkin
 * Full Walk-in Registration: Create a new Patient record, book walk-in appointment, and issue Token
 */
router.post('/walkin', async (req, res, next) => {
  try {
    const { name, email, phone, dob, gender, bloodGroup, address, doctorId, reason, notes } = req.body;

    if (!name || !email || !phone || !dob || !gender || !doctorId) {
      throw new AppError('Name, email, phone, DOB, gender, and Doctor ID are required.', 400);
    }

    // 1. Check if patient already exists (exact name + DOB or phone match to avoid duplicates)
    let patient = await prisma.patient.findFirst({
      where: {
        OR: [
          { phone },
          { AND: [ { name: { equals: name, mode: 'insensitive' } }, { dob } ] }
        ]
      }
    });

    // 2. If not found, create new Patient
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name,
          email: email.toLowerCase(),
          phone,
          dob,
          gender,
          bloodGroup: bloodGroup || null,
          address: address || null,
        }
      });
    }

    // 3. Generate Token Number
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tokenCount = await prisma.queueToken.count({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
    });

    const tokenNumber = `T-${String(tokenCount + 1).padStart(3, '0')}`;
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0].substring(0, 5);

    // 4. Create appointment and token in transaction
    const result = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: Number(doctorId),
          date: todayStr,
          time: timeStr,
          reason: reason || 'Walk-in Registration & Consultation',
          status: 'checked_in',
          notes: notes || 'Registered as walk-in patient',
        }
      });

      const token = await tx.queueToken.create({
        data: {
          tokenNumber,
          patientId: patient.id,
          appointmentId: appointment.id,
          doctorId: Number(doctorId),
          status: 'WAITING',
          notes: notes || '',
        },
        include: {
          patient: true,
          doctor: { select: { id: true, name: true } },
        }
      });

      return { patient, appointment, token };
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/reception/token/:id/status
 * Update status of an active Queue Token (WAITING, CALLING, IN_CONSULTATION, COMPLETED, SKIPPED)
 */
router.put('/token/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body;

    if (!status) {
      throw new AppError('Status is required', 400);
    }

    const validStatuses = ['WAITING', 'CALLING', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED'];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const token = await prisma.queueToken.findUnique({
      where: { id },
    });

    if (!token) {
      throw new AppError('Queue token not found', 404);
    }

    const updatedToken = await prisma.$transaction(async (tx) => {
      const updated = await tx.queueToken.update({
        where: { id },
        data: {
          status,
          notes: notes !== undefined ? notes : token.notes,
        },
        include: {
          patient: true,
          doctor: { select: { id: true, name: true } },
        },
      });

      // Mirror state changes back to the appointment if applicable
      if (token.appointmentId) {
        let appointmentStatus = 'checked_in';
        if (status === 'IN_CONSULTATION') {
          appointmentStatus = 'in_consultation';
        } else if (status === 'COMPLETED') {
          appointmentStatus = 'completed';
        } else if (status === 'SKIPPED') {
          appointmentStatus = 'cancelled';
        }
        await tx.appointment.update({
          where: { id: token.appointmentId },
          data: { status: appointmentStatus },
        });
      }

      return updated;
    });

    res.json(updatedToken);
  } catch (error) {
    next(error);
  }
});

export const receptionRouter = router;
