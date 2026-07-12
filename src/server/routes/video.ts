import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { VideoController } from '../controllers/video.ts';

const router = Router();

router.use(requireAuth);

// Recordings catalog
router.get('/recordings', VideoController.getAllRecordings);

// Video session detail and controls
router.get('/session/:appointmentId', VideoController.getSession);
router.post('/session/:appointmentId/join', VideoController.joinSession);
router.post('/session/:appointmentId/admit', VideoController.admitPatient);
router.post('/session/:appointmentId/chat', VideoController.sendChatMessage);
router.post('/session/:appointmentId/file', VideoController.shareFile);
router.post('/session/:appointmentId/notes', VideoController.updateNotes);
router.post('/session/:appointmentId/notes/ai-assist', VideoController.aiEnhanceNotes);
router.post('/session/:appointmentId/record/start', VideoController.startRecording);
router.post('/session/:appointmentId/record/stop', VideoController.stopRecording);

export const videoRouter = router;
