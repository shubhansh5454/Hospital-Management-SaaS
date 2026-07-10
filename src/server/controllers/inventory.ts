import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/inventory.ts';
import {
  createCategorySchema,
  updateCategorySchema,
  createVendorSchema,
  updateVendorSchema,
  createProductSchema,
  updateProductSchema,
  createPOSchema,
  receivePOSchema,
  recordStockMovementSchema,
} from '../validation/inventory.ts';

export class InventoryController {
  // --- CATEGORIES ---
  public static async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createCategorySchema.parse(req.body);
      const category = await InventoryService.createCategory(validated);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  }

  public static async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await InventoryService.getAllCategories();
      res.json(categories);
    } catch (error) {
      next(error);
    }
  }

  public static async getCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const category = await InventoryService.getCategoryById(id);
      res.json(category);
    } catch (error) {
      next(error);
    }
  }

  public static async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const validated = updateCategorySchema.parse(req.body);
      const category = await InventoryService.updateCategory(id, validated);
      res.json(category);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await InventoryService.deleteCategory(id);
      res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // --- VENDORS ---
  public static async createVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createVendorSchema.parse(req.body);
      const vendor = await InventoryService.createVendor(validated);
      res.status(201).json(vendor);
    } catch (error) {
      next(error);
    }
  }

  public static async listVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendors = await InventoryService.getAllVendors();
      res.json(vendors);
    } catch (error) {
      next(error);
    }
  }

  public static async getVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const vendor = await InventoryService.getVendorById(id);
      res.json(vendor);
    } catch (error) {
      next(error);
    }
  }

  public static async updateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const validated = updateVendorSchema.parse(req.body);
      const vendor = await InventoryService.updateVendor(id, validated);
      res.json(vendor);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await InventoryService.deleteVendor(id);
      res.json({ success: true, message: 'Vendor deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // --- PRODUCTS ---
  public static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createProductSchema.parse(req.body);
      const product = await InventoryService.createProduct(validated);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }

  public static async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, categoryId } = req.query;
      const filters = {
        search: typeof search === 'string' ? search : undefined,
        categoryId: typeof categoryId === 'string' ? parseInt(categoryId) : undefined,
      };
      const products = await InventoryService.getAllProducts(filters);
      res.json(products);
    } catch (error) {
      next(error);
    }
  }

  public static async getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const product = await InventoryService.getProductById(id);
      res.json(product);
    } catch (error) {
      next(error);
    }
  }

  public static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const validated = updateProductSchema.parse(req.body);
      const product = await InventoryService.updateProduct(id, validated);
      res.json(product);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await InventoryService.deleteProduct(id);
      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // --- PURCHASE ORDERS ---
  public static async createPO(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createPOSchema.parse(req.body);
      const po = await InventoryService.createPurchaseOrder(validated);
      res.status(201).json(po);
    } catch (error) {
      next(error);
    }
  }

  public static async listPOs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vendorId, status } = req.query;
      const filters = {
        vendorId: typeof vendorId === 'string' ? parseInt(vendorId) : undefined,
        status: typeof status === 'string' ? status : undefined,
      };
      const pos = await InventoryService.getAllPOs(filters);
      res.json(pos);
    } catch (error) {
      next(error);
    }
  }

  public static async getPO(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const po = await InventoryService.getPOById(id);
      res.json(po);
    } catch (error) {
      next(error);
    }
  }

  public static async updatePOStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const po = await InventoryService.updatePOStatus(id, status);
      res.json(po);
    } catch (error) {
      next(error);
    }
  }

  public static async receivePO(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const validated = receivePOSchema.parse(req.body);

      // Transmute key indexes to numeric keys for service layer logic
      const itemReceivedQtys: Record<number, { received: number; batch?: string; expiry?: string }> = {};
      for (const [key, val] of Object.entries(validated.itemReceivedQtys)) {
        itemReceivedQtys[parseInt(key)] = {
          received: val.received,
          batch: val.batch,
          expiry: val.expiry || undefined,
        };
      }

      const po = await InventoryService.receivePurchaseOrder(id, itemReceivedQtys);
      res.json(po);
    } catch (error) {
      next(error);
    }
  }

  // --- STOCK MOVEMENTS ---
  public static async recordStockMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = recordStockMovementSchema.parse(req.body);
      const movement = await InventoryService.recordStockMovement({
        ...validated,
        batchNumber: validated.batchNumber || undefined,
        expiryDate: validated.expiryDate || undefined,
        notes: validated.notes || undefined,
      });
      res.status(201).json(movement);
    } catch (error) {
      next(error);
    }
  }

  public static async listStockMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, type, search } = req.query;
      const filters = {
        productId: typeof productId === 'string' ? parseInt(productId) : undefined,
        type: typeof type === 'string' ? type : undefined,
        search: typeof search === 'string' ? search : undefined,
      };
      const movements = await InventoryService.getAllStockMovements(filters);
      res.json(movements);
    } catch (error) {
      next(error);
    }
  }

  // --- ANALYTICS DASHBOARD ---
  public static async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await InventoryService.getInventoryMetrics();
      res.json(metrics);
    } catch (error) {
      next(error);
    }
  }
}
