import { Router, Response } from 'express';
import { requireAuth, requireRoles } from '../../../middleware/auth.ts';
import { prisma } from '../../../db/prisma.ts';
import { createPatientSchema, updatePatientSchema } from '../../validation/patient.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { standardRateLimiter, writeRateLimiter } from '../../middleware/rateLimiter.ts';
import { RolesService } from '../../services/roles.ts';
import { SaasService } from '../../services/saas.ts';

const router = Router();

// Apply auth to all patient endpoints
router.use(requireAuth);

/**
 * @route GET /api/v1/patients
 * @desc List patients with search, filtering (gender, bloodGroup), and pagination
 * @access Private (Admin, Doctor, Receptionist)
 */
router.get('/', requireRoles(['admin', 'doctor', 'receptionist']), standardRateLimiter, async (req: any, res: Response, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const skip = (page - 1) * limit;

    const search = req.query.search as string | undefined;
    const gender = req.query.gender as string | undefined;
    const bloodGroup = req.query.bloodGroup as string | undefined;
    const clinicId = req.user?.clinicId;

    const where: any = {};
    
    if (clinicId) {
      where.clinicId = clinicId;
    }

    if (gender) {
      where.gender = { equals: gender, mode: 'insensitive' };
    }

    if (bloodGroup) {
      where.bloodGroup = { equals: bloodGroup, mode: 'insensitive' };
    }

    if (search) {
      const searchLower = search.toLowerCase();
      where.OR = [
        { name: { contains: searchLower, mode: 'insensitive' } },
        { email: { contains: searchLower, mode: 'insensitive' } },
        { phone: { contains: searchLower, mode: 'insensitive' } },
        { address: { contains: searchLower, mode: 'insensitive' } },
      ];
    }

    const [total, patients] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: 'success',
      data: patients,
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
 * @route GET /api/v1/patients/:id
 * @desc Get patient by ID with full health file and clinical records
 * @access Private (Admin, Doctor, Receptionist, Patient)
 */
router.get('/:id', standardRateLimiter, async (req: any, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid patient ID format', 400);
    }

    // Security check: If role is patient, they can only view their own profile
    if (req.user.role === 'patient' && req.user.email !== req.query.email) {
      // Find matched patients for current user's email
      const matched = await prisma.patient.findMany({
        where: { email: req.user.email },
      });
      const allowedIds = matched.map((p) => p.id);
      if (!allowedIds.includes(id)) {
        throw new AppError('Access denied: You are not authorized to view this profile', 403);
      }
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          include: {
            doctor: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { date: 'desc' },
          take: 10,
        },
        emrRecords: {
          include: {
            doctor: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { date: 'desc' },
          take: 10,
        },
        files: {
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
      },
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: patient,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v1/patients
 * @desc Create a new patient profile
 * @access Private (Admin, Doctor, Receptionist)
 */
router.post('/', requireRoles(['admin', 'doctor', 'receptionist']), writeRateLimiter, async (req: any, res: Response, next) => {
  try {
    const parsed = createPatientSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const existing = await prisma.patient.findFirst({
      where: {
        email: parsed.data.email.toLowerCase(),
        name: { equals: parsed.data.name, mode: 'insensitive' },
        dob: parsed.data.dob,
      },
    });

    if (existing) {
      throw new AppError('A patient profile with this name, email, and date of birth already exists.', 400);
    }

    const clinicId = req.user?.clinicId;
    if (clinicId) {
      const stats = await SaasService.getUsageStats(clinicId);
      if (stats.patientsCount >= stats.planConfig.maxPatients) {
        throw new AppError(`Your clinic is at the registered patient limit (${stats.planConfig.maxPatients}) for the "${stats.planConfig.name}" plan. Please upgrade to register more patients.`, 403);
      }
    }

    const newPatient = await prisma.patient.create({
      data: {
        ...parsed.data,
        email: parsed.data.email.toLowerCase(),
        clinicId: clinicId || null,
      },
    });

    // Write audit log
    try {
      await RolesService.logRequest(req, 'CREATE_PATIENT', 'patients', { id: newPatient.id, name: newPatient.name });
    } catch (logErr) {
      console.error('Audit log failed for create patient:', logErr);
    }

    res.status(201).json({
      status: 'success',
      data: newPatient,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/v1/patients/:id
 * @desc Update patient information
 * @access Private (Admin, Doctor, Receptionist)
 */
router.put('/:id', requireRoles(['admin', 'doctor', 'receptionist']), writeRateLimiter, async (req: any, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid patient ID format', 400);
    }

    const parsed = updatePatientSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Patient profile not found', 404);
    }

    const updated = await prisma.patient.update({
      where: { id },
      data: parsed.data,
    });

    // Write audit log
    try {
      await RolesService.logRequest(req, 'UPDATE_PATIENT', 'patients', { id, updates: parsed.data });
    } catch (logErr) {
      console.error('Audit log failed for update patient:', logErr);
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
 * @route DELETE /api/v1/patients/:id
 * @desc Hard or soft delete patient record
 * @access Private (Admin)
 */
router.delete('/:id', requireRoles(['admin']), writeRateLimiter, async (req: any, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid patient ID format', 400);
    }

    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Patient profile not found', 404);
    }

    await prisma.patient.delete({ where: { id } });

    // Write audit log
    try {
      await RolesService.logRequest(req, 'DELETE_PATIENT', 'patients', { id, name: existing.name });
    } catch (logErr) {
      console.error('Audit log failed for delete patient:', logErr);
    }

    res.status(200).json({
      status: 'success',
      message: 'Patient profile deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

export const v1PatientsRouter = router;
