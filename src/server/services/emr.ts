import { EmrRepository } from '../repositories/emr.ts';
import { PatientRepository } from '../repositories/patient.ts';
import { CreateEmrRecordInput, UpdateEmrRecordInput } from '../validation/emr.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class EmrService {
  /**
   * Create an EMR record for a patient
   */
  public static async createRecord(doctorId: number, input: CreateEmrRecordInput) {
    // Check if patient exists
    const patient = await PatientRepository.findById(input.patientId);
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    return EmrRepository.create(doctorId, input);
  }

  /**
   * Get all EMR records for a patient
   */
  public static async getPatientRecords(patientId: number) {
    const patient = await PatientRepository.findById(patientId);
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    return EmrRepository.findAllByPatientId(patientId);
  }

  /**
   * Get a single EMR record by ID
   */
  public static async getRecordById(id: number) {
    const record = await EmrRepository.findById(id);
    if (!record) {
      throw new AppError('EMR record not found', 404);
    }
    return record;
  }

  /**
   * Update an EMR record
   */
  public static async updateRecord(id: number, input: UpdateEmrRecordInput) {
    const record = await EmrRepository.findById(id);
    if (!record) {
      throw new AppError('EMR record not found', 404);
    }

    return EmrRepository.update(id, input);
  }

  /**
   * Delete an EMR record
   */
  public static async deleteRecord(id: number) {
    const record = await EmrRepository.findById(id);
    if (!record) {
      throw new AppError('EMR record not found', 404);
    }

    await EmrRepository.delete(id);
    return { success: true, message: 'EMR record successfully deleted' };
  }
}
