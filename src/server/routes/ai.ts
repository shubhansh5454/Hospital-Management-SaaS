import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { requireFeature } from '../middleware/featureCheck.ts';
import { AIController } from '../controllers/ai.ts';

const router = Router();

// Secure all AI routes with Auth and Feature limits checking
router.use(requireAuth);
router.use(requireFeature('ai_assistant'));

// 1. AI Appointment Assistant
router.post('/appointment', AIController.appointmentAssistant);

// 2. AI Prescription Suggestions
router.post('/prescription', AIController.prescriptionSuggestions);

// 3. AI Medical Summary
router.post('/medical-summary', AIController.medicalSummary);

// 4. AI Patient History Summary
router.post('/patient-history/:patientId', AIController.patientHistorySummary);

// 5. AI Follow-up Suggestions
router.post('/follow-up', AIController.followUpSuggestions);

// 6. AI Clinical Notes Assistant
router.post('/clinical-notes', AIController.clinicalNotesAssistant);

export const aiRouter = router;
