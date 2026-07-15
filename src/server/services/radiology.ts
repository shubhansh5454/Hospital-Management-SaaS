import { RadiologyRepository, CreateImagingOrderInput, SaveRadiologyReportInput } from '../repositories/radiology.ts';
import { PatientRepository } from '../repositories/patient.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class RadiologyService {
  /**
   * Create a new radiology imaging order
   */
  public static async createOrder(input: CreateImagingOrderInput) {
    const patient = await PatientRepository.findById(input.patientId);
    if (!patient) {
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
  public static async getAllOrders(filters: { patientId?: number; status?: string; search?: string }) {
    return RadiologyRepository.findAllOrders(filters);
  }

  /**
   * Fetch specific radiology order
   */
  public static async getOrderById(id: number) {
    const order = await RadiologyRepository.findOrderById(id);
    if (!order) {
      throw new AppError('Radiology order not found', 404);
    }
    return order;
  }

  /**
   * Update order status
   */
  public static async updateOrderStatus(id: number, status: string) {
    const order = await RadiologyRepository.findOrderById(id);
    if (!order) {
      throw new AppError('Radiology order not found', 404);
    }
    return RadiologyRepository.updateOrderStatus(id, status);
  }

  /**
   * Acquire Image / Associate DICOM metadata with Order
   * (Simulates the work done by a PACS acquisition modality)
   */
  public static async acquireImage(id: number, dicomData: { imageUrl: string; seriesUid?: string; studyUid?: string }) {
    const order = await RadiologyRepository.findOrderById(id);
    if (!order) {
      throw new AppError('Radiology order not found', 404);
    }

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
  public static async saveReport(orderId: number, input: { findings: string; impression: string; recommendations?: string; status?: string; doctorId: number }) {
    const order = await RadiologyRepository.findOrderById(orderId);
    if (!order) {
      throw new AppError('Radiology order not found', 404);
    }

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
  public static async approveReport(orderId: number, approverId: number, approverName: string) {
    const order = await RadiologyRepository.findOrderById(orderId);
    if (!order) {
      throw new AppError('Radiology order not found', 404);
    }

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
  public static async getReportByOrderId(orderId: number) {
    const report = await RadiologyRepository.findReportByOrderId(orderId);
    if (!report) {
      throw new AppError('Radiology report not found for this order', 404);
    }
    return report;
  }

  /**
   * Fetch reports history for a specific patient
   */
  public static async getPatientHistory(patientId: number) {
    return RadiologyRepository.findReportsByPatientId(patientId);
  }
}
