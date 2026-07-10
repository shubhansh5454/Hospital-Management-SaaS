import { PatientRepository } from '../repositories/patient.ts';
import { CreatePatientInput, UpdatePatientInput } from '../validation/patient.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class PatientService {
  /**
   * Create a new patient with email uniqueness check (optional check)
   */
  public static async createPatient(input: CreatePatientInput) {
    // If we want uniqueness for patient emails, we can check it. Let's make sure we don't block
    // registering different family members with same email, but let's do a friendly log or optional check if needed.
    // Let's assume emails don't necessarily have to be unique for patients (e.g. family email), but let's check
    // if there's an exact match on name + email + dob, to prevent absolute duplicates.
    const existing = await PatientRepository.findByEmail(input.email);
    if (existing && existing.name.toLowerCase() === input.name.toLowerCase() && existing.dob === input.dob) {
      throw new AppError('A patient with the same name, email, and date of birth already exists.', 400);
    }

    return PatientRepository.create(input);
  }

  /**
   * Get all patients
   */
  public static async getAllPatients() {
    return PatientRepository.findAll();
  }

  /**
   * Get patient by ID
   */
  public static async getPatientById(id: number) {
    const patient = await PatientRepository.findById(id);
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }
    return patient;
  }

  /**
   * Update a patient
   */
  public static async updatePatient(id: number, input: UpdatePatientInput) {
    // Verify patient exists first
    await this.getPatientById(id);

    return PatientRepository.update(id, input);
  }

  /**
   * Delete a patient
   */
  public static async deletePatient(id: number) {
    // Verify patient exists first
    await this.getPatientById(id);

    await PatientRepository.delete(id);
    return { success: true, message: 'Patient successfully deleted' };
  }
}
