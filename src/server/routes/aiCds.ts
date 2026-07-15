import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { AiCdsController } from '../controllers/aiCds.ts';

const router = Router();

// Secure all clinical decision support endpoints with authentication
router.use(requireAuth);

// Doctors and administrative staffs can query and view CDS analyses
router.post('/analyze', requireRoles(['doctor', 'admin']), AiCdsController.analyze);
router.post('/approve/:id', requireRoles(['doctor', 'admin']), AiCdsController.approve);
router.get('/history', requireRoles(['doctor', 'admin', 'receptionist']), AiCdsController.getHistory);

// Configurations & audit telemetry logs can only be read/written by clinical administrators
router.get('/config', requireRoles(['admin']), AiCdsController.getConfigs);
router.put('/config/provider/:id', requireRoles(['admin']), AiCdsController.updateProvider);
router.post('/config/prompt', requireRoles(['admin']), AiCdsController.createPromptTemplateVersion);
router.get('/audit', requireRoles(['admin']), AiCdsController.getAuditLogs);

export const aiCdsRouter = router;
