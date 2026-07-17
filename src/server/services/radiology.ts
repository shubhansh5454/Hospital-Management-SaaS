import { RadiologyRepository, CreateImagingOrderInput, SaveRadiologyReportInput } from '../repositories/radiology.ts';
import { PatientRepository } from '../repositories/patient.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class RadiologyService {
  /**
   * Create a new radiology imaging order
   */
  public static async createOrder(input: CreateImagingOrderInput, clinicId?: number) {
    const patient = await PatientRepository.findById(input.patientId);
    if (!patient) {
      throw new AppError('Patient profile not found', 404);
    }

    if (clinicId && patient.clinicId && patient.clinicId !== clinicId) {
      throw new AppError('Patient profile not found', 404);
    }

    if (!input.modality || input.modality.trim() === '') {
      throw new AppError('Modality (e.g., MRI, CT, X-RAY) is required', 400);
    }

    if (!input.bodyPart || input.bodyPart.trim() === '') {
      throw new AppError('Target body part is required', 400);
    }

    if (!input.reason || input.reason.trim() === '') {
      throw new AppError('Reason for order is required', 400);
    }

    return RadiologyRepository.createOrder(input);
  }

  /**
   * Fetch all radiology orders
   */
  public static async getAllOrders(filters: { patientId?: number; status?: string; search?: string }, clinicId?: number) {
    if (clinicId) {
      // If patientId is specified, ensure it belongs to the clinic
      if (filters.patientId) {
        const patient = await PatientRepository.findById(filters.patientId);
        if (!patient || (patient.clinicId && patient.clinicId !== clinicId)) {
          return [];
        }
      }
    }
    return RadiologyRepository.findAllOrders({ ...filters, clinicId });
  }

  /**
   * Fetch specific radiology order
   */
  public static async getOrderById(id: number, clinicId?: number) {
    const order = await RadiologyRepository.findOrderById(id);
    if (!order) {
      throw new AppError('Radiology order not found', 404);
    }

    if (clinicId && order.patient?.clinicId && order.patient.clinicId !== clinicId) {
      throw new AppError('Radiology order not found', 404);
    }

    return order;
  }

  /**
   * Update order status
   */
  public static async updateOrderStatus(id: number, status: string, clinicId?: number) {
    await this.getOrderById(id, clinicId);
    return RadiologyRepository.updateOrderStatus(id, status);
  }

  /**
   * Acquire Image / Associate DICOM metadata with Order
   * (Simulates the work done by a PACS acquisition modality)
   */
  public static async acquireImage(id: number, dicomData: { imageUrl: string; seriesUid?: string; studyUid?: string }, clinicId?: number) {
    const order = await this.getOrderById(id, clinicId);

    // Generate random series/study UIDs if not provided
    const seriesUid = dicomData.seriesUid || `1.2.840.113619.2.${Math.floor(Math.random() * 100000000)}`;
    const studyUid = dicomData.studyUid || `1.2.840.113619.6.${Math.floor(Math.random() * 100000000)}`;

    // Update order status to ACQUIRED
    await RadiologyRepository.updateOrderStatus(id, 'ACQUIRED');

    // Initialize or update report with image references
    return RadiologyRepository.saveReport({
      orderId: id,
      patientId: order.patientId,
      doctorId: order.doctorId,
      findings: '',
      impression: '',
      status: 'DRAFT',
      dicomImageUrl: dicomData.imageUrl,
      dicomSeriesUid: seriesUid,
      dicomStudyUid: studyUid,
    });
  }

  /**
   * Save report as Draft or Sign-Off
   */
  public static async saveReport(orderId: number, input: { findings: string; impression: string; recommendations?: string; status?: string; doctorId: number }, clinicId?: number) {
    const order = await this.getOrderById(orderId, clinicId);

    const reportStatus = input.status || 'DRAFT';

    const report = await RadiologyRepository.saveReport({
      orderId,
      patientId: order.patientId,
      doctorId: input.doctorId,
      findings: input.findings,
      impression: input.impression,
      recommendations: input.recommendations,
      status: reportStatus,
    });

    // If report is signed off or approved, set order status to REPORTED
    if (reportStatus === 'APPROVED' || reportStatus === 'SIGNED_OFF') {
      await RadiologyRepository.updateOrderStatus(orderId, 'REPORTED');
    }

    return report;
  }

  /**
   * Clinician / Radiologist Report Approval
   */
  public static async approveReport(orderId: number, approverId: number, approverName: string, clinicId?: number) {
    const order = await this.getOrderById(orderId, clinicId);

    const report = await RadiologyRepository.findReportByOrderId(orderId);
    if (!report) {
      throw new AppError('No radiology report exists yet for this order to approve', 400);
    }

    // Update report to APPROVED status and record signature details
    const approvedReport = await RadiologyRepository.saveReport({
      orderId,
      patientId: order.patientId,
      doctorId: report.doctorId,
      findings: report.findings,
      impression: report.impression,
      recommendations: report.recommendations || undefined,
      status: 'APPROVED',
      signerName: approverName,
      signedAt: new Date(),
    });

    // Enforce order status is REPORTED
    await RadiologyRepository.updateOrderStatus(orderId, 'REPORTED');

    return approvedReport;
  }

  /**
   * Fetch specific report by order ID
   */
  public static async getReportByOrderId(orderId: number, clinicId?: number) {
    const report = await RadiologyRepository.findReportByOrderId(orderId);
    if (!report) {
      throw new AppError('Radiology report not found for this order', 404);
    }

    if (clinicId && report.patient?.clinicId && report.patient.clinicId !== clinicId) {
      throw new AppError('Radiology report not found for this order', 404);
    }

    return report;
  }

  /**
   * Fetch reports history for a specific patient
   */
  public static async getPatientHistory(patientId: number, clinicId?: number) {
    const patient = await PatientRepository.findById(patientId);
    if (!patient) {
      throw new AppError('Patient profile not found', 404);
    }

    if (clinicId && patient.clinicId && patient.clinicId !== clinicId) {
      throw new AppError('Patient profile not found', 404);
    }

    return RadiologyRepository.findReportsByPatientId(patientId);
  }
}
