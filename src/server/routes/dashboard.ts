import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { DashboardController } from '../controllers/dashboard.ts';

const router = Router();

// Apply auth globally for dashboard stats
router.use(requireAuth);

// Only administrators, doctors, or receptionist are allowed to view the clinic-wide stats
router.get('/stats', requireRoles(['admin', 'doctor', 'receptionist']), DashboardController.getStats);

export const dashboardRouter = router;
