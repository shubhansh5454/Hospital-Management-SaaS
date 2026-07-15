import { Request, Response, NextFunction } from 'express';
import { RadiologyService } from '../services/radiology.ts';
import { RolesService } from '../services/roles.ts';
import { AppError } from '../middleware/errorHandler.ts';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    name: string;
    clinicId?: number;
  };
}

export class RadiologyController {
  /**
   * Create a new radiology imaging order
   */
  public static async createOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId, modality, bodyPart, reason, priority, orderDate, notes } = req.body;
      const doctorId = req.user?.id || 1; // Fallback for test sandbox

      if (!patientId) {
        throw new AppError('patientId is required', 400);
      }

      const order = await RadiologyService.createOrder({
        patientId: Number(patientId),
        doctorId,
        modality,
        bodyPart,
        reason,
        priority,
        orderDate: orderDate || new Date().toISOString().split('T')[0],
        notes,
      });

      // Audit Log
      try {
        await RolesService.logRequest(req, 'CREATE_IMAGING_ORDER', 'radiology', {
          orderId: order.id,
          patientId: order.patientId,
          modality: order.modality,
          bodyPart: order.bodyPart,
        });
      } catch (logErr) {
        console.error('Audit logging failed for imaging order creation:', logErr);
      }

      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch all imaging orders with optional filters
   */
  public static async listOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId, status, search } = req.query;
      
      const filters = {
        patientId: patientId ? Number(patientId) : undefined,
        status: typeof status === 'string' ? status : undefined,
        search: typeof search === 'string' ? search : undefined,
      };

      const orders = await RadiologyService.getAllOrders(filters);
      res.json(orders);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific imaging order details including report and patient context
   */
  public static async getOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const order = await RadiologyService.getOrderById(id);
      res.json(order);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update the status of an imaging order
   */
  public static async updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (!status) {
        throw new AppError('Status value is required', 400);
      }

      const updatedOrder = await RadiologyService.updateOrderStatus(id, status);
      res.json(updatedOrder);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PACS Image acquisition / simulated DICOM series uploading
   */
  public static async acquireImage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { imageUrl, seriesUid, studyUid } = req.body;

      if (!imageUrl) {
        throw new AppError('dicomImageUrl / imageUrl is required', 400);
      }

      const result = await RadiologyService.acquireImage(id, {
        imageUrl,
        seriesUid,
        studyUid,
      });

      // Audit Log
      try {
        await RolesService.logRequest(req, 'PACS_IMAGE_ACQUIRED', 'radiology', {
          orderId: id,
          imageUrl,
          seriesUid,
          studyUid,
        });
      } catch (logErr) {
        console.error('Audit logging failed for PACS image acquisition:', logErr);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create or update report draft / sign-off report
   */
  public static async saveReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const { findings, impression, recommendations, status } = req.body;
      const doctorId = req.user?.id || 1;

      if (findings === undefined || impression === undefined) {
        throw new AppError('Findings and Impression fields are required to draft/save report', 400);
      }

      const report = await RadiologyService.saveReport(orderId, {
        findings,
        impression,
        recommendations,
        status: status || 'DRAFT',
        doctorId,
      });

      // Audit Log
      try {
        await RolesService.logRequest(req, 'SAVE_RADIOLOGY_REPORT', 'radiology', {
          orderId,
          reportId: report.id,
          status: report.status,
        });
      } catch (logErr) {
        console.error('Audit logging failed for radiology report saving:', logErr);
      }

      res.json(report);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Final approve and lock radiology report
   */
  public static async approveReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const approverId = req.user?.id || 1;
      const approverName = req.user?.name || 'Systems Admin';

      const approvedReport = await RadiologyService.approveReport(orderId, approverId, approverName);

      // Audit Log
      try {
        await RolesService.logRequest(req, 'APPROVE_RADIOLOGY_REPORT', 'radiology', {
          orderId,
          reportId: approvedReport.id,
          approvedBy: approverName,
        });
      } catch (logErr) {
        console.error('Audit logging failed for radiology report approval:', logErr);
      }

      res.json(approvedReport);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch specific report by order ID
   */
  public static async getReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const report = await RadiologyService.getReportByOrderId(orderId);
      res.json(report);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get reports history for specific patient ID
   */
  public static async getHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = parseInt(req.params.patientId);
      const history = await RadiologyService.getPatientHistory(patientId);
      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Draft a complete clinical radiology report using server-side Gemini AI
   */
  public static async generateAiReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const order = await RadiologyService.getOrderById(orderId);
      
      const prompt = `
You are an expert board-certified Radiologist. Draft a comprehensive, professional, structured radiology report for the following imaging order:

Modality: ${order.modality}
Body Part: ${order.bodyPart}
Priority: ${order.priority}
Clinical Indication / Reason for scan: "${order.reason}"
Additional clinician notes: "${order.notes || 'None'}"

Please generate three specific sections:
1. **Findings**: A detailed, organ-by-organ or tissue-by-tissue objective description of the scan, written in high-fidelity professional medical terminology appropriate for the modality and body part specified. Since this is a simulated scan, construct realistic findings that would correspond with the clinical indication (describe both normal structures and minor/major pathological structures linked to the reason for scan).
2. **Impression**: A concise diagnostic synthesis summing up the key clinical findings.
3. **Recommendations**: Helpful next steps (e.g. clinical correlation, follow-up imaging in X months, or specialist consultation) if applicable.

Format your output as a raw JSON object with the following keys so we can parse it cleanly:
{
  "findings": "your detailed findings text",
  "impression": "your concise impression text",
  "recommendations": "your recommendations text"
}
Ensure the JSON is perfectly valid and does not contain markdown code block wrappers (like \`\`\`json) or extra characters. Just raw JSON.
`;

      const { AIService } = await import('../services/ai.ts');
      const responseText = await AIService.generate(prompt, {
        temperature: 0.2,
        systemInstruction: "You are a professional clinical radiology reporter. Always output raw JSON conforming to the requested schema."
      });

      // Clean up the response text in case markdown block syntax is returned anyway
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7);
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.substring(3);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      cleanText = cleanText.trim();

      const parsedReport = JSON.parse(cleanText);
      res.json(parsedReport);
    } catch (error) {
      next(error);
    }
  }
}
