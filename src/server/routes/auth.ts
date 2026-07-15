import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { AuthController } from '../controllers/auth.ts';

const router = Router();

// Public Authentication Endpoints
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);

// Authenticated Endpoints
router.post('/logout', requireAuth, AuthController.logout);

// Get current user profile
router.get('/me', requireAuth, AuthController.me);

// Update role (sandbox feature for quick testing)
router.post('/role', requireAuth, AuthController.updateRole);

export const authRouter = router;

