import { LabRepository, CreateLabTestInput, BookTestInput, CollectSampleInput, RecordResultInput } from '../repositories/lab.ts';
import { PatientRepository } from '../repositories/patient.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class LabService {
  /**
   * Register a new lab test catalog definition
   */
  public static async createLabTest(input: CreateLabTestInput) {
    if (!input.name || input.name.trim() === '') {
      throw new AppError('Lab test name is required', 400);
    }
    if (!input.code || input.code.trim() === '') {
      throw new AppError('Lab test code is required', 400);
    }
    if (!input.category || input.category.trim() === '') {
      throw new AppError('Category is required', 400);
    }
    if (input.price < 0) {
      throw new AppError('Test price cannot be negative', 400);
    }

    const existing = await LabRepository.findTestByCode(input.code);
    if (existing) {
      throw new AppError(`A lab test with code ${input.code.toUpperCase()} already exists`, 400);
    }

    return LabRepository.createTest(input);
  }

  /**
   * Fetch lab tests
   */
  public static async getAllTests(filters: { search?: string; category?: string }) {
    return LabRepository.findAllTests(filters);
  }

  /**
   * Fetch specific lab test
   */
  public static async getTestById(id: number) {
    const test = await LabRepository.findTestById(id);
    if (!test) {
      throw new AppError('Lab test definition not found', 404);
    }
    return test;
  }

  /**
   * Update lab test definition
   */
  public static async updateLabTest(id: number, data: Partial<CreateLabTestInput>) {
    const test = await LabRepository.findTestById(id);
    if (!test) {
      throw new AppError('Lab test not found', 404);
    }

    if (data.code) {
      const existing = await LabRepository.findTestByCode(data.code);
      if (existing && existing.id !== id) {
        throw new AppError(`A lab test with code ${data.code.toUpperCase()} already exists`, 400);
      }
    }

    if (data.price !== undefined && data.price < 0) {
      throw new AppError('Test pricing cannot be negative', 400);
    }

    return LabRepository.updateTest(id, data);
  }

  /**
   * Delete lab test
   */
  public static async deleteLabTest(id: number) {
    const test = await LabRepository.findTestById(id);
    if (!test) {
      throw new AppError('Lab test definition not found', 404);
    }
    await LabRepository.deleteTest(id);
    return { success: true, message: 'Lab test definition deleted successfully from catalog' };
  }

  /**
   * Book/order a lab test for a patient
   */
  public static async bookTestOrder(input: BookTestInput, clinicId?: number) {
    const patient = await PatientRepository.findById(input.patientId);
    if (!patient) {
      throw new AppError('Patient profile not found', 404);
    }

    if (clinicId && patient.clinicId && patient.clinicId !== clinicId) {
      throw new AppError('Patient profile not found', 404);
    }

    const test = await LabRepository.findTestById(input.testId);
    if (!test) {
      throw new AppError('Selected lab test definition not found', 404);
    }

    return LabRepository.bookOrder({ ...input, clinicId });
  }

  /**
   * Fetch all lab orders
   */
  public static async getAllOrders(filters: { status?: string; patientId?: number; search?: string }, clinicId?: number) {
    if (clinicId && filters.patientId) {
      const patient = await PatientRepository.findById(filters.patientId);
      if (!patient || (patient.clinicId && patient.clinicId !== clinicId)) {
        return [];
      }
    }
    return LabRepository.findAllOrders({ ...filters, clinicId });
  }

  /**
   * Fetch specific lab order
   */
  public static async getOrderById(id: number, clinicId?: number) {
    const order = await LabRepository.findOrderById(id);
    if (!order) {
      throw new AppError('Lab order not found', 404);
    }

    if (clinicId && order.patient?.clinicId && order.patient.clinicId !== clinicId) {
      throw new AppError('Lab order not found', 404);
    }

    return order;
  }

  /**
   * Record sample collection for a booked order
   */
  public static async collectSample(id: number, input: CollectSampleInput, clinicId?: number) {
    const order = await this.getOrderById(id, clinicId);

    if (order.status !== 'BOOKED') {
      throw new AppError(`Cannot collect sample. Order is in status ${order.status}`, 400);
    }

    if (!input.barcode || input.barcode.trim() === '') {
      throw new AppError('Sample barcode/tracking-ID is required', 400);
    }

    if (!input.collector || input.collector.trim() === '') {
      throw new AppError('Sample collector name is required', 400);
    }

    return LabRepository.recordSampleCollection(id, input);
  }

  /**
   * Transition order to In Progress status
   */
  public static async startAnalysis(id: number, clinicId?: number) {
    const order = await this.getOrderById(id, clinicId);

    if (order.status !== 'SAMPLE_COLLECTED') {
      throw new AppError(`Cannot start analysis. Order status is ${order.status} (requires SAMPLE_COLLECTED)`, 400);
    }

    return LabRepository.updateOrderStatus(id, 'IN_PROGRESS');
  }

  /**
   * Input lab test findings, perform validation/approval, and finalize
   */
  public static async completeOrderAndValidate(id: number, input: RecordResultInput, clinicId?: number) {
    const order = await this.getOrderById(id, clinicId);

    if (order.status === 'BOOKED') {
      throw new AppError('Cannot fill results before sample has been collected', 400);
    }

    if (!input.resultValue || input.resultValue.trim() === '') {
      throw new AppError('Result value is required to complete lab analysis', 400);
    }

    if (!input.validatedBy || input.validatedBy.trim() === '') {
      throw new AppError('Validator/Approving practitioner name is required for result validation', 400);
    }

    return LabRepository.saveResultsAndComplete(id, input);
  }

  /**
   * Get Lab Dashboard Stats
   */
  public static async getDashboardMetrics(clinicId?: number) {
    return LabRepository.getLabStats(clinicId);
  }
}
