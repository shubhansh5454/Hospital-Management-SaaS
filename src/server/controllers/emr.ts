import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { EmrService } from '../services/emr.ts';
import { PatientRepository } from '../repositories/patient.ts';
import { createEmrRecordSchema, updateEmrRecordSchema } from '../validation/emr.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class EmrController {
  /**
   * Helper to verify if user has access to a patient's records
   */
  private static async verifyPatientAccess(req: AuthRequest, patientId: number) {
    if (!req.user) throw new AppError('Unauthorized', 401);

    // Doctors, admins, and receptionists can access all records
    if (req.user.role === 'admin' || req.user.role === 'doctor' || req.user.role === 'receptionist') {
      return true;
    }

    // Patients can only access their own records
    if (req.user.role === 'patient') {
      const patient = await PatientRepository.findByEmail(req.user.email);
      if (!patient || patient.id !== patientId) {
        throw new AppError('Forbidden: You can only access your own medical records', 403);
      }
      return true;
    }

    throw new AppError('Forbidden', 403);
  }

  /**
   * Create a new EMR record
   */
  public static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'doctor')) {
        throw new AppError('Forbidden: Only doctors and admins can create medical records', 403);
      }

      const parsed = createEmrRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const record = await EmrService.createRecord(req.user.id, parsed.data);
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all EMR records for a patient
   */
  public static async getByPatientId(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = parseInt(req.params.patientId, 10);
      if (isNaN(patientId)) {
        throw new AppError('Invalid patient ID', 400);
      }

      await EmrController.verifyPatientAccess(req, patientId);

      const records = await EmrService.getPatientRecords(patientId);
      res.status(200).json(records);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single EMR record by ID
   */
  public static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid record ID', 400);
      }

      const record = await EmrService.getRecordById(id);
      
      // Perform security check
      await EmrController.verifyPatientAccess(req, record.patientId);

      res.status(200).json(record);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an EMR record
   */
  public static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'doctor')) {
        throw new AppError('Forbidden: Only doctors and admins can update medical records', 403);
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid record ID', 400);
      }

      const parsed = updateEmrRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const updated = await EmrService.updateRecord(id, parsed.data);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an EMR record
   */
  public static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'doctor')) {
        throw new AppError('Forbidden: Only doctors and admins can delete medical records', 403);
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid record ID', 400);
      }

      const result = await EmrService.deleteRecord(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
