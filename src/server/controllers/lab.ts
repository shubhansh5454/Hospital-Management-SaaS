import { Request, Response, NextFunction } from 'express';
import { LabService } from '../services/lab.ts';
import { RolesService } from '../services/roles.ts';
import {
  createLabTestSchema,
  updateLabTestSchema,
  bookLabTestSchema,
  collectSampleSchema,
  recordResultSchema,
} from '../validation/lab.ts';

export class LabController {
  /**
   * Create a new lab test catalog definition
   */
  public static async createTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createLabTestSchema.parse(req.body);
      const test = await LabService.createLabTest(validated);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'CREATE_LAB_TEST',
          'lab',
          { id: test.id, name: test.name, code: test.code }
        );
      } catch (logErr) {
        console.error('Audit logging failed for lab test creation:', logErr);
      }

      res.status(201).json(test);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch lab tests dictionary
   */
  public static async listTests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, category } = req.query;
      const filters = {
        search: typeof search === 'string' ? search : undefined,
        category: typeof category === 'string' ? category : undefined,
      };
      const tests = await LabService.getAllTests(filters);
      res.json(tests);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch specific lab test
   */
  public static async getTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const test = await LabService.getTestById(id);
      res.json(test);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update lab test properties
   */
  public static async updateTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const validated = updateLabTestSchema.parse(req.body);
      const test = await LabService.updateLabTest(id, validated);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'UPDATE_LAB_TEST',
          'lab',
          { id, name: test.name, updates: validated }
        );
      } catch (logErr) {
        console.error('Audit logging failed for lab test update:', logErr);
      }

      res.json(test);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete lab test
   */
  public static async deleteTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const result = await LabService.deleteLabTest(id);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'DELETE_LAB_TEST',
          'lab',
          { id, result }
        );
      } catch (logErr) {
        console.error('Audit logging failed for lab test deletion:', logErr);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Book a lab test order
   */
  public static async bookTestOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = bookLabTestSchema.parse(req.body);
      const clinicId = req.user?.clinicId;
      const order = await LabService.bookTestOrder(validated, clinicId);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'BOOK_LAB_ORDER',
          'lab',
          { id: order.id, patientId: order.patientId, testId: order.testId }
        );
      } catch (logErr) {
        console.error('Audit logging failed for lab booking:', logErr);
      }

      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch lab orders (Sample collection requests & lab reports)
   */
  public static async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, patientId, search } = req.query;
      const filters = {
        status: typeof status === 'string' ? status : undefined,
        patientId: typeof patientId === 'string' ? parseInt(patientId) : undefined,
        search: typeof search === 'string' ? search : undefined,
      };
      const clinicId = req.user?.clinicId;
      const orders = await LabService.getAllOrders(filters, clinicId);
      res.json(orders);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch single order details
   */
  public static async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const clinicId = req.user?.clinicId;
      const order = await LabService.getOrderById(id, clinicId);
      res.json(order);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process and log sample collection
   */
  public static async collectSample(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const validated = collectSampleSchema.parse(req.body);
      const clinicId = req.user?.clinicId;
      const order = await LabService.collectSample(id, {
        barcode: validated.barcode,
        collector: validated.collector,
        collectedAt: new Date(validated.collectedAt),
      }, clinicId);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'COLLECT_LAB_SAMPLE',
          'lab',
          { id, barcode: validated.barcode, collector: validated.collector }
        );
      } catch (logErr) {
        console.error('Audit logging failed for sample collection:', logErr);
      }

      res.json(order);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Advance sample state to "IN_PROGRESS"
   */
  public static async startAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const clinicId = req.user?.clinicId;
      const order = await LabService.startAnalysis(id, clinicId);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'START_LAB_ANALYSIS',
          'lab',
          { id }
        );
      } catch (logErr) {
        console.error('Audit logging failed for starting analysis:', logErr);
      }

      res.json(order);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Save result findings, validate and complete order
   */
  public static async finalizeResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const validated = recordResultSchema.parse(req.body);
      const clinicId = req.user?.clinicId;
      const order = await LabService.completeOrderAndValidate(id, {
        resultValue: validated.resultValue,
        normalRange: validated.normalRange ?? undefined,
        unit: validated.unit ?? undefined,
        comments: validated.comments ?? undefined,
        reportAttachmentUrl: validated.reportAttachmentUrl ?? undefined,
        validatedBy: validated.validatedBy,
        validatedAt: new Date(),
      }, clinicId);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'FINALIZE_LAB_RESULTS',
          'lab',
          { id, validatedBy: validated.validatedBy, resultValue: validated.resultValue }
        );
      } catch (logErr) {
        console.error('Audit logging failed for finalizing results:', logErr);
      }

      res.json(order);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieve aggregated metrics for the dashboard
   */
  public static async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clinicId = req.user?.clinicId;
      const stats = await LabService.getDashboardMetrics(clinicId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}
