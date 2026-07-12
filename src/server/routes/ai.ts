import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { AIController } from '../controllers/ai.ts';

const router = Router();

// 1. AI Appointment Assistant
router.post('/appointment', requireAuth, AIController.appointmentAssistant);

// 2. AI Prescription Suggestions
router.post('/prescription', requireAuth, AIController.prescriptionSuggestions);

// 3. AI Medical Summary
router.post('/medical-summary', requireAuth, AIController.medicalSummary);

// 4. AI Patient History Summary
router.post('/patient-history/:patientId', requireAuth, AIController.patientHistorySummary);

// 5. AI Follow-up Suggestions
router.post('/follow-up', requireAuth, AIController.followUpSuggestions);

// 6. AI Clinical Notes Assistant
router.post('/clinical-notes', requireAuth, AIController.clinicalNotesAssistant);

export const aiRouter = router;
