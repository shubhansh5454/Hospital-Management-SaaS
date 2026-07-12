import { Request, Response, NextFunction } from 'express';
import { MedicineService } from '../services/medicine.ts';
import { RolesService } from '../services/roles.ts';
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

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'CREATE_MEDICINE',
          'pharmacy',
          { id: medicine.id, name: medicine.name, code: medicine.code }
        );
      } catch (logErr) {
        console.error('Audit logging failed for medicine creation:', logErr);
      }

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

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'UPDATE_MEDICINE',
          'pharmacy',
          { id, name: medicine.name, updates: validated }
        );
      } catch (logErr) {
        console.error('Audit logging failed for medicine update:', logErr);
      }

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

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'DELETE_MEDICINE',
          'pharmacy',
          { id, result }
        );
      } catch (logErr) {
        console.error('Audit logging failed for medicine deletion:', logErr);
      }

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

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'RESTOCK_MEDICINE',
          'pharmacy',
          { id: purchase.id, medicineId: purchase.medicineId, quantity: purchase.quantity, batch: purchase.batchNumber }
        );
      } catch (logErr) {
        console.error('Audit logging failed for medicine restocking:', logErr);
      }

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

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'SELL_MEDICINE',
          'pharmacy',
          { id: sale.id, medicineId: sale.medicineId, quantity: sale.quantity, totalPrice: sale.totalPrice }
        );
      } catch (logErr) {
        console.error('Audit logging failed for medicine sale:', logErr);
      }

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
