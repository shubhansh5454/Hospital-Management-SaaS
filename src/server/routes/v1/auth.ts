import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../../../middleware/auth.ts';
import { AuthController } from '../../controllers/auth.ts';
import { strictAuthRateLimiter } from '../../middleware/rateLimiter.ts';

const router = Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', strictAuthRateLimiter, AuthController.register);

/**
 * @route POST /api/v1/auth/login
 * @desc Log in with email and password
 * @access Public
 */
router.post('/login', strictAuthRateLimiter, AuthController.login);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh JWT tokens using valid Refresh Token
 * @access Public
 */
router.post('/refresh', strictAuthRateLimiter, AuthController.refresh);

/**
 * @route POST /api/v1/auth/logout
 * @desc Log out and revoke Refresh Token
 * @access Private
 */
router.post('/logout', requireAuth, AuthController.logout);

/**
 * @route GET /api/v1/auth/me
 * @desc Get current logged-in user profile
 * @access Private
 */
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.status(200).json({
    status: 'success',
    data: req.user,
  });
});

export const v1AuthRouter = router;
