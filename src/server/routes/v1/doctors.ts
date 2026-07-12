import { Router, Response } from 'express';
import { requireAuth } from '../../../middleware/auth.ts';
import { prisma } from '../../../db/prisma.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { standardRateLimiter } from '../../middleware/rateLimiter.ts';

const router = Router();

router.use(requireAuth);

/**
 * @route GET /api/v1/doctors
 * @desc Get list of doctors with search, filtering, and pagination
 * @access Private
 */
router.get('/', standardRateLimiter, async (req: any, res: Response, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const skip = (page - 1) * limit;

    const specialization = req.query.specialization as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {
      role: 'doctor',
    };

    if (specialization) {
      where.doctorProfile = {
        specialization: {
          equals: specialization,
          mode: 'insensitive',
        },
      };
    }

    if (search) {
      const searchLower = search.toLowerCase();
      where.OR = [
        { name: { contains: searchLower, mode: 'insensitive' } },
        { email: { contains: searchLower, mode: 'insensitive' } },
        {
          doctorProfile: {
            specialization: { contains: searchLower, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, doctors] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          name: 'asc',
        },
        include: {
          doctorProfile: {
            include: {
              schedules: true,
              leaves: true,
            },
          },
        },
      }),
    ]);

    // Format output to remove password hashes for security
    const sanitizedDoctors = doctors.map((doc) => {
      const { password, refreshToken, ...rest } = doc;
      return rest;
    });

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: 'success',
      data: sanitizedDoctors,
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
 * @route GET /api/v1/doctors/specializations
 * @desc Get unique list of doctor specializations
 * @access Private
 */
router.get('/specializations', standardRateLimiter, async (req: any, res: Response, next) => {
  try {
    const profiles = await prisma.doctorProfile.findMany({
      select: {
        specialization: true,
      },
      distinct: ['specialization'],
    });

    const specializations = profiles.map((p) => p.specialization).filter(Boolean);

    res.status(200).json({
      status: 'success',
      data: specializations,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/doctors/:id
 * @desc Get doctor profile by ID including full schedule and leave calendar
 * @access Private
 */
router.get('/:id', standardRateLimiter, async (req: any, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid doctor ID format', 400);
    }

    const doctor = await prisma.user.findFirst({
      where: {
        id,
        role: 'doctor',
      },
      include: {
        doctorProfile: {
          include: {
            schedules: {
              orderBy: [
                { dayOfWeek: 'asc' },
                { startTime: 'asc' },
              ],
            },
            leaves: {
              orderBy: {
                startDate: 'desc',
              },
            },
          },
        },
      },
    });

    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }

    const { password, refreshToken, ...sanitizedDoctor } = doctor;

    res.status(200).json({
      status: 'success',
      data: sanitizedDoctor,
    });
  } catch (error) {
    next(error);
  }
});

export const v1DoctorsRouter = router;
