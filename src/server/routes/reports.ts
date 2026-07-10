import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { ReportsController } from '../controllers/reports.ts';

const router = Router();

// Reports are secured for Staff Roles only
router.get(
  '/:type',
  requireAuth,
  requireRoles(['admin', 'doctor', 'receptionist']),
  ReportsController.getReport
);

export const reportsRouter = router;
