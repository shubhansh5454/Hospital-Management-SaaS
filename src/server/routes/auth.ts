import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { prisma } from '../../db/prisma.ts';
import { AppError } from '../middleware/errorHandler.ts';

const router = Router();

// Get current user profile
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('User profile not found', 404);
  }
  res.json(req.user);
});

// Update role (sandbox feature for quick testing)
router.post('/role', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const roleSchema = z.object({
      role: z.enum(['admin', 'doctor', 'receptionist', 'patient']),
    });

    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { role: parsed.data.role },
    });

    res.json({ message: 'Role updated successfully', role: parsed.data.role });
  } catch (error) {
    next(error);
  }
});

export const authRouter = router;

