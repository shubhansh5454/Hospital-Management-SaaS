import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.ts';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validation/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { AuthRequest } from '../../middleware/auth.ts';
import { RolesService } from '../services/roles.ts';
import { UserRepository } from '../repositories/user.ts';
import { userProfileCache } from '../utils/cache.ts';

export class AuthController {
  /**
   * Register a new user
   */
  public static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const result = await AuthService.register(parsed.data);
      res.status(211).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Log in an existing user
   */
  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const result = await AuthService.login(parsed.data);

      // Track successful login in Audit Log
      try {
        await RolesService.logRequest(
          req,
          'LOGIN',
          'auth',
          `User logged in: ${result.user.email}`,
          result.user.id,
          result.user.clinicId || undefined
        );
      } catch (logErr) {
        console.error('Audit logging failed for login:', logErr);
      }

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh a user's access token
   */
  public static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = refreshTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const result = await AuthService.refresh(parsed.data.refreshToken);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user by revoking refresh token
   */
  public static async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      const result = await AuthService.logout(req.user.id);

      // Track successful logout in Audit Log
      try {
        await RolesService.logRequest(
          req,
          'LOGOUT',
          'auth',
          `User logged out: ${req.user.email}`
        );
      } catch (logErr) {
        console.error('Audit logging failed for logout:', logErr);
      }

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile context
   */
  public static async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('User profile not found', 404);
      }
      res.status(200).json(req.user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user role (sandbox feature for quick testing)
   */
  public static async updateRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      const roleSchema = z.object({
        role: z.enum(['admin', 'doctor', 'receptionist', 'patient']),
      });

      const parsed = roleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      await UserRepository.updateRole(req.user.id, parsed.data.role);

      // Invalidate the cache for user profile session
      const cacheKey = `user_profile_${req.user.id}`;
      userProfileCache.delete(cacheKey);

      res.status(200).json({
        status: 'success',
        message: 'Role updated successfully',
        role: parsed.data.role,
      });
    } catch (error) {
      next(error);
    }
  }
}
