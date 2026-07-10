import { InventoryRepository, CreateCategoryInput, CreateVendorInput, CreateProductInput, CreatePOInput, StockMovementInput } from '../repositories/inventory.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class InventoryService {
  // --- CATEGORIES ---
  public static async createCategory(data: CreateCategoryInput) {
    if (!data.name || data.name.trim() === '') {
      throw new AppError('Category name is required', 400);
    }
    return InventoryRepository.createCategory(data);
  }

  public static async getCategoryById(id: number) {
    const category = await InventoryRepository.findCategoryById(id);
    if (!category) throw new AppError('Category not found', 404);
    return category;
  }

  public static async getAllCategories() {
    return InventoryRepository.findAllCategories();
  }

  public static async updateCategory(id: number, data: Partial<CreateCategoryInput>) {
    await this.getCategoryById(id);
    return InventoryRepository.updateCategory(id, data);
  }

  public static async deleteCategory(id: number) {
    await this.getCategoryById(id);
    // Note: If we have cascading or dependent products, check beforehand
    return InventoryRepository.deleteCategory(id);
  }

  // --- VENDORS ---
  public static async createVendor(data: CreateVendorInput) {
    if (!data.name || data.name.trim() === '') {
      throw new AppError('Vendor name is required', 400);
    }
    return InventoryRepository.createVendor(data);
  }

  public static async getVendorById(id: number) {
    const vendor = await InventoryRepository.findVendorById(id);
    if (!vendor) throw new AppError('Vendor not found', 404);
    return vendor;
  }

  public static async getAllVendors() {
    return InventoryRepository.findAllVendors();
  }

  public static async updateVendor(id: number, data: Partial<CreateVendorInput>) {
    await this.getVendorById(id);
    return InventoryRepository.updateVendor(id, data);
  }

  public static async deleteVendor(id: number) {
    await this.getVendorById(id);
    return InventoryRepository.deleteVendor(id);
  }

  // --- PRODUCTS ---
  public static async createProduct(data: CreateProductInput) {
    if (!data.name || data.name.trim() === '') {
      throw new AppError('Product name is required', 400);
    }
    if (!data.sku || data.sku.trim() === '') {
      throw new AppError('Product SKU/Code is required', 400);
    }
    if (!data.categoryId) {
      throw new AppError('Product Category is required', 400);
    }
    if (!data.unit || data.unit.trim() === '') {
      throw new AppError('Unit of measurement is required', 400);
    }

    const existingSku = await InventoryRepository.findProductBySku(data.sku);
    if (existingSku) {
      throw new AppError(`A product with SKU "${data.sku.toUpperCase()}" already exists`, 400);
    }

    if (data.barcode) {
      const existingBarcode = await InventoryRepository.findProductByBarcode(data.barcode);
      if (existingBarcode) {
        throw new AppError(`A product with barcode "${data.barcode}" already exists`, 400);
      }
    }

    const product = await InventoryRepository.createProduct(data);

    // If starting stock is greater than 0, create an initial stock movement log
    if (data.stock && data.stock > 0) {
      await InventoryRepository.recordStockMovement({
        productId: product.id,
        type: 'IN',
        quantity: data.stock,
        reason: 'INITIAL_STOCK',
        movementDate: new Date().toISOString().split('T')[0],
        notes: 'Initial stock recorded upon product registration',
      });
    }

    return product;
  }

  public static async getProductById(id: number) {
    const product = await InventoryRepository.findProductById(id);
    if (!product) throw new AppError('Product not found', 404);
    return product;
  }

  public static async getAllProducts(filters: { search?: string; categoryId?: number }) {
    return InventoryRepository.findAllProducts(filters);
  }

  public static async updateProduct(id: number, data: Partial<CreateProductInput>) {
    const current = await this.getProductById(id);

    if (data.sku && data.sku.toUpperCase() !== current.sku) {
      const existingSku = await InventoryRepository.findProductBySku(data.sku);
      if (existingSku && existingSku.id !== id) {
        throw new AppError(`SKU "${data.sku.toUpperCase()}" is already allocated to another product`, 400);
      }
    }

    if (data.barcode && data.barcode !== current.barcode) {
      const existingBarcode = await InventoryRepository.findProductByBarcode(data.barcode);
      if (existingBarcode && existingBarcode.id !== id) {
        throw new AppError(`Barcode "${data.barcode}" is already registered to another product`, 400);
      }
    }

    return InventoryRepository.updateProduct(id, data);
  }

  public static async deleteProduct(id: number) {
    await this.getProductById(id);
    return InventoryRepository.deleteProduct(id);
  }

  // --- PURCHASE ORDERS ---
  public static async createPurchaseOrder(data: CreatePOInput) {
    if (!data.vendorId) throw new AppError('Vendor selection is required', 400);
    if (!data.orderNumber) throw new AppError('Order Number is required', 400);
    if (!data.items || data.items.length === 0) {
      throw new AppError('Purchase order must contain at least one item', 400);
    }

    await this.getVendorById(data.vendorId);

    // Verify all products exist
    for (const item of data.items) {
      await this.getProductById(item.productId);
      if (item.quantity <= 0) throw new AppError('Order item quantity must be positive', 400);
      if (item.unitCost < 0) throw new AppError('Unit cost cannot be negative', 400);
    }

    return InventoryRepository.createPurchaseOrder(data);
  }

  public static async getPOById(id: number) {
    const po = await InventoryRepository.findPOById(id);
    if (!po) throw new AppError('Purchase order not found', 404);
    return po;
  }

  public static async getAllPOs(filters: { vendorId?: number; status?: string }) {
    return InventoryRepository.findAllPOs(filters);
  }

  public static async updatePOStatus(id: number, status: string) {
    await this.getPOById(id);
    if (!['PENDING', 'ORDERED', 'RECEIVED', 'CANCELLED'].includes(status)) {
      throw new AppError('Invalid Purchase Order status value', 400);
    }
    return InventoryRepository.updatePOStatus(id, status);
  }

  public static async receivePurchaseOrder(id: number, itemReceivedQtys: Record<number, { received: number; batch?: string; expiry?: string }>) {
    const po = await this.getPOById(id);
    if (po.status === 'RECEIVED') {
      throw new AppError('Purchase Order has already been fully received', 400);
    }
    if (po.status === 'CANCELLED') {
      throw new AppError('Cannot receive a cancelled Purchase Order', 400);
    }

    // Validate quantities
    for (const item of po.items) {
      const recvData = itemReceivedQtys[item.id];
      if (recvData) {
        if (recvData.received < 0) {
          throw new AppError('Received quantity cannot be negative', 400);
        }
        if (item.receivedQty + recvData.received > item.quantity) {
          throw new AppError(`Received count overflows order quantity for item ${item.product.name}`, 400);
        }
      }
    }

    return InventoryRepository.receivePO(id, itemReceivedQtys);
  }

  // --- STOCK MOVEMENTS ---
  public static async recordStockMovement(data: StockMovementInput) {
    const product = await this.getProductById(data.productId);

    if (data.quantity <= 0) {
      throw new AppError('Stock movement quantity must be greater than zero', 400);
    }

    if (data.type === 'OUT' && product.stock < data.quantity) {
      throw new AppError(`Insufficient stock. Available: ${product.stock}, Requested: ${data.quantity}`, 400);
    }

    return InventoryRepository.recordStockMovement(data);
  }

  public static async getAllStockMovements(filters: { productId?: number; type?: string; search?: string }) {
    return InventoryRepository.findAllStockMovements(filters);
  }

  // --- METRICS ---
  public static async getInventoryMetrics() {
    return InventoryRepository.getInventoryStats();
  }
}
