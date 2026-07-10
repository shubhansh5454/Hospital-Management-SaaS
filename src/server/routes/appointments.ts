import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { appointments, patients, users } from '../../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler.ts';

const router = Router();

const appointmentSchema = z.object({
  patientId: z.number(),
  doctorId: z.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  reason: z.string().min(2, "Reason must be at least 2 characters"),
  notes: z.string().optional(),
});

const statusSchema = z.object({
  status: z.enum(['scheduled', 'completed', 'cancelled']),
});

// List Doctors (available to all logged-in roles to book or assign appointments)
router.get('/doctors', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const allDoctors = await db.select().from(users).where(eq(users.role, 'doctor'));
    res.json(allDoctors);
  } catch (error) {
    next(error);
  }
});

// List Appointments (based on role)
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    let queryResult;
    const { role, id: userId, email: userEmail } = req.user!;

    if (role === 'admin' || role === 'receptionist') {
      queryResult = await db.select({
        id: appointments.id,
        date: appointments.date,
        time: appointments.time,
        status: appointments.status,
        reason: appointments.reason,
        notes: appointments.notes,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        patient: {
          id: patients.id,
          name: patients.name,
          email: patients.email,
        },
        doctor: {
          id: users.id,
          name: users.name,
          email: users.email,
        }
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(appointments.doctorId, users.id))
      .orderBy(desc(appointments.date));
    } else if (role === 'doctor') {
      queryResult = await db.select({
        id: appointments.id,
        date: appointments.date,
        time: appointments.time,
        status: appointments.status,
        reason: appointments.reason,
        notes: appointments.notes,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        patient: {
          id: patients.id,
          name: patients.name,
          email: patients.email,
        },
        doctor: {
          id: users.id,
          name: users.name,
          email: users.email,
        }
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(appointments.doctorId, users.id))
      .where(eq(appointments.doctorId, userId))
      .orderBy(desc(appointments.date));
    } else {
      // Patients look up their appointments based on patient records matching email
      const matchedPatients = await db.select().from(patients).where(eq(patients.email, userEmail));
      if (matchedPatients.length === 0) {
        queryResult = [];
      } else {
        const patientIds = matchedPatients.map(p => p.id);
        queryResult = await db.select({
          id: appointments.id,
          date: appointments.date,
          time: appointments.time,
          status: appointments.status,
          reason: appointments.reason,
          notes: appointments.notes,
          patientId: appointments.patientId,
          doctorId: appointments.doctorId,
          patient: {
            id: patients.id,
            name: patients.name,
            email: patients.email,
          },
          doctor: {
            id: users.id,
            name: users.name,
            email: users.email,
          }
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(users, eq(appointments.doctorId, users.id))
        .where(eq(appointments.patientId, patientIds[0])) // Simplification
        .orderBy(desc(appointments.date));
      }
    }

    res.json(queryResult);
  } catch (error) {
    next(error);
  }
});

// Create Appointment
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const parsed = appointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const [newAppointment] = await db.insert(appointments).values(parsed.data).returning();
    res.status(211).json(newAppointment);
  } catch (error) {
    next(error);
  }
});

// Update status
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid status', 400);
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new AppError('Invalid appointment ID', 400);
    }

    await db.update(appointments)
      .set({ status: parsed.data.status })
      .where(eq(appointments.id, id));

    res.json({ message: 'Appointment updated successfully', status: parsed.data.status });
  } catch (error) {
    next(error);
  }
});

export const appointmentsRouter = router;
