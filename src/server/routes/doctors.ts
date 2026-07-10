import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { users } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';

const router = Router();

// List Doctors (available to all authenticated users)
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const allDoctors = await db.select().from(users).where(eq(users.role, 'doctor'));
    res.json(allDoctors);
  } catch (error) {
    next(error);
  }
});

export const doctorsRouter = router;
