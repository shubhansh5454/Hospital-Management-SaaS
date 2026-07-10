import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { prisma } from '../../db/prisma.ts';

const router = Router();

// List Doctors (available to all authenticated users)
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const allDoctors = await prisma.user.findMany({
      where: { role: 'doctor' }
    });
    res.json(allDoctors);
  } catch (error) {
    next(error);
  }
});

export const doctorsRouter = router;

