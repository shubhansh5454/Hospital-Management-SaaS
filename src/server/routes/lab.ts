import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { LabController } from '../controllers/lab.ts';

const router = Router();

// Test Definition Catalog CRUD (Allowed for lab technicians, doctors, or administrative staff)
router.get('/tests', requireAuth, LabController.listTests);
router.get('/tests/:id', requireAuth, LabController.getTest);
router.post('/tests', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), LabController.createTest);
router.put('/tests/:id', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), LabController.updateTest);
router.delete('/tests/:id', requireAuth, requireRoles(['admin']), LabController.deleteTest);

// Lab Orders & Bookings
router.get('/orders', requireAuth, LabController.listOrders);
router.get('/orders/metrics', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), LabController.getMetrics);
router.get('/orders/:id', requireAuth, LabController.getOrder);
router.post('/orders', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), LabController.bookTestOrder);

// Sample Tracking, Collection, & Results Validation
router.post('/orders/:id/collect', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), LabController.collectSample);
router.post('/orders/:id/start', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), LabController.startAnalysis);
router.post('/orders/:id/finalize', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), LabController.finalizeResults);

export const labRouter = router;
