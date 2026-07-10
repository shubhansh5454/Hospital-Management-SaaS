import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.ts';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validation/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { AuthRequest } from '../../middleware/auth.ts';

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
      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
