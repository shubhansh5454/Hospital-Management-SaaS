import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRoles, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { patients } from '../../db/schema.ts';
import { desc } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler.ts';

const router = Router();

const patientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(6, "Phone must be at least 6 characters"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
  gender: z.string().min(1, "Gender is required"),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  medicalHistory: z.string().optional(),
});

// List Patients (restricted to admin, doctor, receptionist)
router.get('/', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), async (req: AuthRequest, res: Response, next) => {
  try {
    const allPatients = await db.select().from(patients).orderBy(desc(patients.createdAt));
    res.json(allPatients);
  } catch (error) {
    next(error);
  }
});

// Create Patient (restricted to admin, doctor, receptionist)
router.post('/', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), async (req: AuthRequest, res: Response, next) => {
  try {
    const parsed = patientSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const [newPatient] = await db.insert(patients).values(parsed.data).returning();
    res.status(211).json(newPatient); // 201 Created
  } catch (error) {
    next(error);
  }
});

export const patientsRouter = router;
