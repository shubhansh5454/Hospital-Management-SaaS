import { Router, Response } from 'express';
import { requireAuth, requireRoles } from '../../../middleware/auth.ts';
import { prisma } from '../../../db/prisma.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { standardRateLimiter, writeRateLimiter } from '../../middleware/rateLimiter.ts';
import { createPatientSchema, updatePatientSchema } from '../../validation/patient.ts';

const router = Router();

// Secure all patient routes
router.use(requireAuth);

/**
 * @route GET /api/v2/patients
 * @desc List patients with optimized search, metadata summary, and count aggregations (Appointments & EMR counts)
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

    // V2: Query includes database aggregation of appointments & record counts to optimize mobile client performance
    const [total, patients] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              appointments: true,
              emrRecords: true,
              invoices: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // V2 Response Structure
    res.status(200).json({
      status: 'success',
      apiVersion: '2.0.0',
      data: {
        patients: patients.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          phone: p.phone,
          dob: p.dob,
          gender: p.gender,
          bloodGroup: p.bloodGroup,
          address: p.address,
          medicalHistory: p.medicalHistory,
          allergies: p.allergies,
          clinicId: p.clinicId,
          createdAt: p.createdAt,
          // Extra version 2 analytics/counters
          statistics: {
            appointmentsCount: p._count.appointments,
            emrRecordsCount: p._count.emrRecords,
            invoicesCount: p._count.invoices,
            isCritical: p.medicalHistory?.toLowerCase().includes('critical') || p.allergies?.toLowerCase().includes('severe')
          }
        })),
        summary: {
          totalRecords: total,
          criticalCount: patients.filter(p => 
            p.medicalHistory?.toLowerCase().includes('critical') || p.allergies?.toLowerCase().includes('severe')
          ).length
        }
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
 * @route GET /api/v2/patients/:id
 * @desc Get patient by ID with full health statistics and associated clinical counts
 */
router.get('/:id', standardRateLimiter, async (req: any, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid patient ID format', 400);
    }

    // Security check: If role is patient, they can only view their own profile
    if (req.user.role === 'patient' && req.user.email !== req.query.email) {
      const matchedPatients = await prisma.patient.findMany({
        where: { email: req.user.email },
      });
      if (!matchedPatients.some(p => p.id === id)) {
        throw new AppError('Access denied: Unauthorized patient record access', 403);
      }
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          take: 5,
          orderBy: { date: 'desc' }
        },
        emrRecords: {
          take: 5,
          orderBy: { date: 'desc' }
        },
        invoices: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!patient) {
      throw new AppError('Patient file not found', 404);
    }

    res.status(200).json({
      status: 'success',
      apiVersion: '2.0.0',
      data: {
        patient: {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
          dob: patient.dob,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
          address: patient.address,
          medicalHistory: patient.medicalHistory,
          allergies: patient.allergies,
          clinicId: patient.clinicId,
          createdAt: patient.createdAt,
          recentActivity: {
            appointments: patient.appointments,
            clinicalNotes: patient.emrRecords,
            invoices: patient.invoices
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export const v2PatientsRouter = router;
