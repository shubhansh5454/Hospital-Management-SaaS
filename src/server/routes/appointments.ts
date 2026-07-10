import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { prisma } from '../../db/prisma.ts';
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
    const allDoctors = await prisma.user.findMany({
      where: { role: 'doctor' }
    });
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
      queryResult = await prisma.appointment.findMany({
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          doctor: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      });
    } else if (role === 'doctor') {
      queryResult = await prisma.appointment.findMany({
        where: {
          doctorId: userId
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          doctor: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      });
    } else {
      // Patients look up their appointments based on patient records matching email
      const matchedPatients = await prisma.patient.findMany({
        where: { email: userEmail }
      });
      if (matchedPatients.length === 0) {
        queryResult = [];
      } else {
        const patientIds = matchedPatients.map(p => p.id);
        queryResult = await prisma.appointment.findMany({
          where: {
            patientId: patientIds[0] // Simplification
          },
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            },
            doctor: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            }
          },
          orderBy: {
            date: 'desc'
          }
        });
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

    const newAppointment = await prisma.appointment.create({
      data: parsed.data
    });
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

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: parsed.data.status }
    });

    res.json({ message: 'Appointment updated successfully', status: updated.status });
  } catch (error) {
    next(error);
  }
});

export const appointmentsRouter = router;

