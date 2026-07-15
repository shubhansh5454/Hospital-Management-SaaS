import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../../../middleware/auth.ts';
import { prisma } from '../../../db/prisma.ts';
import { strictAuthRateLimiter } from '../../middleware/rateLimiter.ts';
import { AuthService } from '../../services/auth.ts';
import { loginSchema, registerSchema } from '../../validation/auth.ts';
import { AppError } from '../../middleware/errorHandler.ts';

const router = Router();

/**
 * @route POST /api/v2/auth/login
 * @desc Modernized Login - returns JWT tokens and enriched active clinic settings
 */
router.post('/login', strictAuthRateLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const authResult = await AuthService.login(parsed.data);

    // Enriched V2 response: fetch associated clinic brand properties
    let clinicSettings = null;
    if (authResult.user.clinicId) {
      clinicSettings = await prisma.clinicSetting.findUnique({
        where: { clinicId: authResult.user.clinicId }
      });
    }

    res.status(200).json({
      status: 'success',
      apiVersion: '2.0.0',
      data: {
        user: {
          id: authResult.user.id,
          email: authResult.user.email,
          name: authResult.user.name,
          role: authResult.user.role,
          clinicId: authResult.user.clinicId,
          createdAt: authResult.user.createdAt
        },
        tokens: {
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken
        },
        clinic: clinicSettings ? {
          name: clinicSettings.hospitalName || 'CareSync',
          logoUrl: clinicSettings.logoUrl,
          primaryColor: clinicSettings.primaryColor,
          secondaryColor: clinicSettings.secondaryColor,
          customDomain: clinicSettings.customDomain
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/auth/me
 * @desc Get current authenticated profile with permissions map and active environment details
 */
router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const clinicId = req.user.clinicId;

    // Fetch user with clinic settings details
    const user = (await prisma.user.findUnique({
      where: { id: userId },
      include: {
        clinic: {
          include: {
            settings: true
          }
        }
      }
    })) as any;

    if (!user) {
      throw new AppError('User profile not found', 404);
    }

    // Role-based permissions map
    const permissions: string[] = [];
    if (userRole === 'admin' || userRole === 'superadmin') {
      permissions.push('read:patients', 'write:patients', 'read:appointments', 'write:appointments', 'manage:billing', 'manage:settings');
    } else if (userRole === 'doctor') {
      permissions.push('read:patients', 'read:appointments', 'write:appointments', 'write:emr');
    } else if (userRole === 'receptionist') {
      permissions.push('read:patients', 'write:patients', 'read:appointments', 'write:appointments');
    } else if (userRole === 'patient') {
      permissions.push('read:own_profile', 'read:own_appointments', 'read:own_bills');
    }

    res.status(200).json({
      status: 'success',
      apiVersion: '2.0.0',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt
        },
        permissions,
        clinic: user.clinic ? {
          id: user.clinic.id,
          name: user.clinic.name,
          slug: user.clinic.slug,
          settings: user.clinic.settings ? {
            hospitalName: user.clinic.settings.hospitalName,
            logoUrl: user.clinic.settings.logoUrl,
            primaryColor: user.clinic.settings.primaryColor,
            secondaryColor: user.clinic.settings.secondaryColor
          } : null
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

export const v2AuthRouter = router;
