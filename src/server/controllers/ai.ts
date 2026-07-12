import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { AIService } from '../services/ai.ts';
import { DoctorRepository } from '../repositories/doctor.ts';
import { RolesService } from '../services/roles.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class AIController {
  /**
   * 1. AI Appointment Assistant
   * POST /api/ai/appointment
   */
  public static async appointmentAssistant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const { symptomsAndPreferences, config } = req.body;
      if (!symptomsAndPreferences) {
        throw new AppError('Symptoms and preferences are required', 400);
      }

      // Fetch list of doctors to provide contextual recommendations
      const doctorsResult = await DoctorRepository.findAll({ limit: 50 });
      const doctorsContext = doctorsResult.doctors.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        specialization: doc.doctorProfile?.specialization || 'General Practice',
        experienceYrs: doc.doctorProfile?.experienceYrs || 0,
        biography: doc.doctorProfile?.biography || '',
      }));

      const response = await AIService.appointmentAssistant(symptomsAndPreferences, doctorsContext, config);

      // Audit log the request
      try {
        await RolesService.logRequest(req, 'AI_APPOINTMENT_ASSISTANT', 'appointments', {
          symptomsAndPreferencesLength: symptomsAndPreferences.length,
          configUsed: config,
        });
      } catch (err) {
        console.error('Audit logging failed for AI Appointment Assistant:', err);
      }

      res.json({ success: true, text: response });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 2. AI Prescription Suggestions
   * POST /api/ai/prescription
   */
  public static async prescriptionSuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // Enforce clinical roles (doctor/admin) for prescriptions
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        throw new AppError('Unauthorized: AI prescription recommendations are only available for authorized clinicians.', 403);
      }

      const { diagnosisAndSymptoms, allergiesAndHistory, config } = req.body;
      if (!diagnosisAndSymptoms) {
        throw new AppError('Diagnosis and symptoms are required', 400);
      }

      const response = await AIService.prescriptionSuggestions(
        diagnosisAndSymptoms,
        allergiesAndHistory || 'None documented',
        config
      );

      // Audit log
      try {
        await RolesService.logRequest(req, 'AI_PRESCRIPTION_SUGGESTION', 'patients', {
          diagnosisAndSymptomsLength: diagnosisAndSymptoms.length,
          configUsed: config,
        });
      } catch (err) {
        console.error('Audit logging failed for AI Prescription Suggestions:', err);
      }

      res.json({ success: true, text: response });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 3. AI Medical Summary
   * POST /api/ai/medical-summary
   */
  public static async medicalSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const { emrRecordData, config } = req.body;
      if (!emrRecordData) {
        throw new AppError('EMR record data is required', 400);
      }

      const response = await AIService.medicalSummary(emrRecordData, config);

      // Audit log
      try {
        await RolesService.logRequest(req, 'AI_MEDICAL_SUMMARY', 'patients', {
          emrRecordDataLength: emrRecordData.length,
          configUsed: config,
        });
      } catch (err) {
        console.error('Audit logging failed for AI Medical Summary:', err);
      }

      res.json({ success: true, text: response });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 4. AI Patient History Summary
   * POST /api/ai/patient-history/:patientId
   */
  public static async patientHistorySummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) {
        throw new AppError('Invalid patient ID format', 400);
      }

      const { config } = req.body;
      const response = await AIService.patientHistorySummary(patientId, config);

      // Audit log
      try {
        await RolesService.logRequest(req, 'AI_PATIENT_HISTORY_SUMMARY', 'patients', {
          patientId,
          configUsed: config,
        });
      } catch (err) {
        console.error('Audit logging failed for AI Patient History Summary:', err);
      }

      res.json({ success: true, text: response });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 5. AI Follow-up Suggestions
   * POST /api/ai/follow-up
   */
  public static async followUpSuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const { currentCondition, vitalsAndMeds, config } = req.body;
      if (!currentCondition) {
        throw new AppError('Current condition description is required', 400);
      }

      const response = await AIService.followUpSuggestions(
        currentCondition,
        vitalsAndMeds || 'Not recorded',
        config
      );

      // Audit log
      try {
        await RolesService.logRequest(req, 'AI_FOLLOW_UP_SUGGESTION', 'patients', {
          currentConditionLength: currentCondition.length,
          configUsed: config,
        });
      } catch (err) {
        console.error('Audit logging failed for AI Follow-up Suggestions:', err);
      }

      res.json({ success: true, text: response });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 6. AI Clinical Notes Assistant
   * POST /api/ai/clinical-notes
   */
  public static async clinicalNotesAssistant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const { messyNotes, config } = req.body;
      if (!messyNotes) {
        throw new AppError('Messy clinical notes / transcripts are required', 400);
      }

      const response = await AIService.clinicalNotesAssistant(messyNotes, config);

      // Audit log
      try {
        await RolesService.logRequest(req, 'AI_CLINICAL_NOTES_ASSISTANT', 'patients', {
          messyNotesLength: messyNotes.length,
          configUsed: config,
        });
      } catch (err) {
        console.error('Audit logging failed for AI Clinical Notes Assistant:', err);
      }

      res.json({ success: true, text: response });
    } catch (error) {
      next(error);
    }
  }
}
