import { Request, Response, NextFunction } from 'express';
import { PatientService } from '../services/patient.ts';
import { createPatientSchema, updatePatientSchema } from '../validation/patient.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { AuthRequest } from '../../middleware/auth.ts';
import { RolesService } from '../services/roles.ts';

export class PatientController {
  /**
   * Create a new patient
   */
  public static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createPatientSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const clinicId = req.user?.clinicId;
      const newPatient = await PatientService.createPatient(parsed.data, clinicId || undefined);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'CREATE_PATIENT',
          'patients',
          { id: newPatient.id, name: newPatient.name }
        );
      } catch (logErr) {
        console.error('Audit logging failed for patient creation:', logErr);
      }

      res.status(211).json(newPatient); // 211 status represents Created in our server flow
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all patients
   */
  public static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.clinicId;
      const patients = await PatientService.getAllPatients(clinicId || undefined);
      res.status(200).json(patients);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get patient by ID
   */
  public static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid patient ID format', 400);
      }

      const clinicId = req.user?.clinicId;
      const patient = await PatientService.getPatientById(id, clinicId || undefined);
      res.status(200).json(patient);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update patient by ID
   */
  public static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid patient ID format', 400);
      }

      const parsed = updatePatientSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const clinicId = req.user?.clinicId;
      const updatedPatient = await PatientService.updatePatient(id, parsed.data, clinicId || undefined);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'UPDATE_PATIENT',
          'patients',
          { id: updatedPatient.id, name: updatedPatient.name, updates: parsed.data }
        );
      } catch (logErr) {
        console.error('Audit logging failed for patient update:', logErr);
      }

      res.status(200).json(updatedPatient);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete patient by ID
   */
  public static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid patient ID format', 400);
      }

      const clinicId = req.user?.clinicId;
      const result = await PatientService.deletePatient(id, clinicId || undefined);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'DELETE_PATIENT',
          'patients',
          { id, result }
        );
      } catch (logErr) {
        console.error('Audit logging failed for patient deletion:', logErr);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export patient record in HL7 FHIR and CCDA formats
   */
  public static async exportRecord(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid patient ID format', 400);
      }

      const clinicId = req.user?.clinicId;
      const exportedData = await PatientService.exportClinicalData(id, clinicId || undefined);

      // Log security audit for sensitive patient record access/download (CCDA / FHIR compliance audit trail)
      try {
        await RolesService.logRequest(
          req,
          'EXPORT_PATIENT_RECORD',
          'patients',
          { id, fhirDocId: exportedData.fhirBundle.id }
        );
      } catch (logErr) {
        console.error('Audit logging failed for patient record export:', logErr);
      }

      res.status(200).json(exportedData);
    } catch (error) {
      next(error);
    }
  }
}
