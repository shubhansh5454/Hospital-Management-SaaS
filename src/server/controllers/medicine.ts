import { Request, Response, NextFunction } from 'express';
import { MedicineService } from '../services/medicine.ts';
import {
  createMedicineSchema,
  updateMedicineSchema,
  purchaseStockSchema,
  saleMedicineSchema
} from '../validation/medicine.ts';

export class MedicineController {
  /**
   * Create new medicine definitions (Medicine Master)
   */
  public static async createMedicine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createMedicineSchema.parse(req.body);
      const medicine = await MedicineService.createMedicine(validated);
      res.status(201).json(medicine);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch list of medicines (with filters)
   */
  public static async listMedicines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, category, lowStock, expired } = req.query;
      const filters = {
        search: typeof search === 'string' ? search : undefined,
        category: typeof category === 'string' ? category : undefined,
        lowStock: lowStock === 'true',
        expired: expired === 'true',
      };
      const medicines = await MedicineService.getAllMedicines(filters);
      res.json(medicines);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch specific medicine by ID
   */
  public static async getMedicine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const medicine = await MedicineService.getMedicineById(id);
      res.json(medicine);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update medicine master properties
   */
  public static async updateMedicine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const validated = updateMedicineSchema.parse(req.body);
      const medicine = await MedicineService.updateMedicine(id, validated);
      res.json(medicine);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete medicine master
   */
  public static async deleteMedicine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const result = await MedicineService.deleteMedicine(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Restock purchase transaction
   */
  public static async purchaseStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = purchaseStockSchema.parse(req.body);
      const purchase = await MedicineService.purchaseStock(validated);
      res.status(201).json(purchase);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sale transaction
   */
  public static async sellMedicine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = saleMedicineSchema.parse(req.body);
      const sale = await MedicineService.sellMedicine(validated);
      res.status(201).json(sale);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dynamic Stock Report endpoint (with valuations, alerts, near-expiry metrics)
   */
  public static async getStockReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await MedicineService.generateStockReport();
      res.json(report);
    } catch (error) {
      next(error);
    }
  }
}
