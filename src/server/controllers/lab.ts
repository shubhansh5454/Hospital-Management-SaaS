import { Request, Response, NextFunction } from 'express';
import { LabService } from '../services/lab.ts';
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
      const order = await LabService.bookTestOrder(validated);
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
      const orders = await LabService.getAllOrders(filters);
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
      const order = await LabService.getOrderById(id);
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
      const order = await LabService.collectSample(id, {
        barcode: validated.barcode,
        collector: validated.collector,
        collectedAt: new Date(validated.collectedAt),
      });
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
      const order = await LabService.startAnalysis(id);
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
      const order = await LabService.completeOrderAndValidate(id, {
        resultValue: validated.resultValue,
        normalRange: validated.normalRange ?? undefined,
        unit: validated.unit ?? undefined,
        comments: validated.comments ?? undefined,
        reportAttachmentUrl: validated.reportAttachmentUrl ?? undefined,
        validatedBy: validated.validatedBy,
        validatedAt: new Date(),
      });
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
      const stats = await LabService.getDashboardMetrics();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}
