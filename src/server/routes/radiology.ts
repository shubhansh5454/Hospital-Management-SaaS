import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { RadiologyController } from '../controllers/radiology.ts';

const router = Router();

// Enforce authentication on all radiology endpoints
router.use(requireAuth);

// Create and query imaging orders
router.post('/orders', requireRoles(['doctor', 'admin']), RadiologyController.createOrder);
router.get('/orders', requireRoles(['doctor', 'admin', 'receptionist', 'patient']), RadiologyController.listOrders);
router.get('/orders/:id', requireRoles(['doctor', 'admin', 'receptionist', 'patient']), RadiologyController.getOrder);
router.put('/orders/:id/status', requireRoles(['doctor', 'admin']), RadiologyController.updateStatus);

// PACS Integration: Acquire images/DICOM and write report drafts
router.post('/orders/:id/acquire', requireRoles(['doctor', 'admin']), RadiologyController.acquireImage);
router.post('/orders/:id/report', requireRoles(['doctor', 'admin']), RadiologyController.saveReport);
router.post('/orders/:id/approve', requireRoles(['doctor', 'admin']), RadiologyController.approveReport);
router.post('/orders/:id/ai-draft', requireRoles(['doctor', 'admin']), RadiologyController.generateAiReport);
router.get('/orders/:id/report', requireRoles(['doctor', 'admin', 'receptionist', 'patient']), RadiologyController.getReport);

// History queries
router.get('/patient/:patientId/history', requireRoles(['doctor', 'admin', 'receptionist', 'patient']), RadiologyController.getHistory);

export const radiologyRouter = router;
