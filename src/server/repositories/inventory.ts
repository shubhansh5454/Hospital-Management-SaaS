import { prisma } from '../../db/prisma.ts';

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export interface CreateVendorInput {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  barcode?: string;
  categoryId: number;
  unit: string;
  stock?: number;
  minStockAlert?: number;
  description?: string;
}

export interface CreatePOItemInput {
  productId: number;
  quantity: number;
  unitCost: number;
}

export interface CreatePOInput {
  vendorId: number;
  orderNumber: string;
  orderDate: string;
  notes?: string;
  items: CreatePOItemInput[];
}

export interface StockMovementInput {
  productId: number;
  type: 'IN' | 'OUT';
  quantity: number;
  batchNumber?: string;
  expiryDate?: string; // YYYY-MM-DD
  reason: string;
  movementDate: string; // YYYY-MM-DD
  notes?: string;
}

export class InventoryRepository {
  // --- CATEGORIES ---
  public static async createCategory(data: CreateCategoryInput) {
    return prisma.inventoryCategory.create({
      data,
    });
  }

  public static async findCategoryById(id: number) {
    return prisma.inventoryCategory.findUnique({
      where: { id },
    });
  }

  public static async findAllCategories() {
    return prisma.inventoryCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  public static async updateCategory(id: number, data: Partial<CreateCategoryInput>) {
    return prisma.inventoryCategory.update({
      where: { id },
      data,
    });
  }

  public static async deleteCategory(id: number) {
    return prisma.inventoryCategory.delete({
      where: { id },
    });
  }

  // --- VENDORS ---
  public static async createVendor(data: CreateVendorInput) {
    return prisma.vendor.create({
      data,
    });
  }

  public static async findVendorById(id: number) {
    return prisma.vendor.findUnique({
      where: { id },
    });
  }

  public static async findAllVendors() {
    return prisma.vendor.findMany({
      orderBy: { name: 'asc' },
    });
  }

  public static async updateVendor(id: number, data: Partial<CreateVendorInput>) {
    return prisma.vendor.update({
      where: { id },
      data,
    });
  }

  public static async deleteVendor(id: number) {
    return prisma.vendor.delete({
      where: { id },
    });
  }

  // --- PRODUCTS ---
  public static async createProduct(data: CreateProductInput) {
    return prisma.inventoryProduct.create({
      data: {
        name: data.name,
        sku: data.sku.toUpperCase(),
        barcode: data.barcode || null,
        categoryId: data.categoryId,
        unit: data.unit,
        stock: data.stock ?? 0,
        minStockAlert: data.minStockAlert ?? 10,
        description: data.description ?? null,
      },
      include: {
        category: true,
      },
    });
  }

  public static async findProductById(id: number) {
    return prisma.inventoryProduct.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  public static async findProductBySku(sku: string) {
    return prisma.inventoryProduct.findUnique({
      where: { sku: sku.toUpperCase() },
      include: {
        category: true,
      },
    });
  }

  public static async findProductByBarcode(barcode: string) {
    return prisma.inventoryProduct.findUnique({
      where: { barcode },
      include: {
        category: true,
      },
    });
  }

  public static async findAllProducts(filters: { search?: string; categoryId?: number }) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { barcode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    return prisma.inventoryProduct.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  public static async updateProduct(id: number, data: Partial<CreateProductInput>) {
    return prisma.inventoryProduct.update({
      where: { id },
      data: {
        ...data,
        sku: data.sku ? data.sku.toUpperCase() : undefined,
      },
      include: {
        category: true,
      },
    });
  }

  public static async deleteProduct(id: number) {
    return prisma.inventoryProduct.delete({
      where: { id },
    });
  }

  // --- PURCHASE ORDERS ---
  public static async createPurchaseOrder(data: CreatePOInput) {
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

    return prisma.purchaseOrder.create({
      data: {
        vendorId: data.vendorId,
        orderNumber: data.orderNumber.toUpperCase(),
        orderDate: data.orderDate,
        status: 'PENDING',
        totalAmount,
        notes: data.notes ?? null,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            receivedQty: 0,
          })),
        },
      },
      include: {
        vendor: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  public static async findPOById(id: number) {
    return prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  public static async findAllPOs(filters: { vendorId?: number; status?: string }) {
    const where: any = {};

    if (filters.vendorId) {
      where.vendorId = filters.vendorId;
    }

    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    return prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public static async updatePOStatus(id: number, status: string) {
    return prisma.purchaseOrder.update({
      where: { id },
      data: { status },
      include: {
        vendor: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  public static async receivePO(id: number, itemReceivedQtys: Record<number, { received: number; batch?: string; expiry?: string }>) {
    // This is a transaction-like workflow where we update POItems, update overall PO status, and record StockMovement (In)
    const po = await this.findPOById(id);
    if (!po) throw new Error('Purchase order not found');

    const movements: any[] = [];
    let allReceived = true;

    for (const item of po.items) {
      const recvData = itemReceivedQtys[item.id];
      const receivedNow = recvData ? recvData.received : 0;
      const totalReceived = item.receivedQty + receivedNow;

      if (totalReceived < item.quantity) {
        allReceived = false;
      }

      // Update PO Item received count
      await prisma.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: totalReceived },
      });

      // Record stock movement & update inventory stock if receivedNow > 0
      if (receivedNow > 0) {
        // Record Stock Movement
        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: receivedNow,
            batchNumber: recvData?.batch || `BATCH-PO-${po.id}`,
            expiryDate: recvData?.expiry || null,
            reason: 'PURCHASE',
            movementDate: new Date().toISOString().split('T')[0],
            notes: `Received from Purchase Order #${po.orderNumber}`,
          },
        });

        // Update product stock directly
        await prisma.inventoryProduct.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: receivedNow,
            },
          },
        });
      }
    }

    const finalStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

    return prisma.purchaseOrder.update({
      where: { id },
      data: { status: finalStatus },
      include: {
        vendor: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  // --- STOCK MOVEMENTS ---
  public static async recordStockMovement(data: StockMovementInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Create Stock Movement entry
      const movement = await tx.stockMovement.create({
        data: {
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          batchNumber: data.batchNumber ?? null,
          expiryDate: data.expiryDate ?? null,
          reason: data.reason,
          movementDate: data.movementDate,
          notes: data.notes ?? null,
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });

      // 2. Adjust Product Stock
      const stockChange = data.type === 'IN' ? data.quantity : -data.quantity;

      await tx.inventoryProduct.update({
        where: { id: data.productId },
        data: {
          stock: {
            increment: stockChange,
          },
        },
      });

      return movement;
    });
  }

  public static async findAllStockMovements(filters: { productId?: number; type?: string; search?: string }) {
    const where: any = {};

    if (filters.productId) {
      where.productId = filters.productId;
    }

    if (filters.type && filters.type !== 'all') {
      where.type = filters.type;
    }

    if (filters.search) {
      where.product = {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { sku: { contains: filters.search, mode: 'insensitive' } },
          { barcode: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    return prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- ANALYTICS / DASHBOARD STATS ---
  public static async getInventoryStats() {
    const totalProducts = await prisma.inventoryProduct.count();
    const categoriesCount = await prisma.inventoryCategory.count();
    const vendorsCount = await prisma.vendor.count();

    // Low stock items (stock <= minStockAlert)
    const lowStockItems = await prisma.inventoryProduct.findMany({
      where: {
        stock: {
          lte: prisma.inventoryProduct.fields.minStockAlert,
        },
      },
      include: {
        category: true,
      },
      orderBy: { stock: 'asc' },
    });

    // Recent stock movements
    const recentMovements = await prisma.stockMovement.findMany({
      take: 10,
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Count of incoming purchase orders
    const pendingPO = await prisma.purchaseOrder.count({
      where: {
        status: {
          in: ['PENDING', 'ORDERED', 'PARTIALLY_RECEIVED'],
        },
      },
    });

    // Expiry warnings (items expiring in next 90 days)
    const todayStr = new Date().toISOString().split('T')[0];
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const ninetyDaysStr = ninetyDaysFromNow.toISOString().split('T')[0];

    // Find all stock movements where type is 'IN' and expiryDate is within next 90 days, or already expired
    // Let's filter on the database movements
    const expiringSoon = await prisma.stockMovement.findMany({
      where: {
        type: 'IN',
        expiryDate: {
          not: null,
          lte: ninetyDaysStr,
        },
      },
      include: {
        product: true,
      },
      orderBy: { expiryDate: 'asc' },
    });

    // Filter down to only items with active stock (or we can just show expiring soon batch logs)
    const uniqueExpiringBatches = expiringSoon.map(m => ({
      id: m.id,
      productName: m.product.name,
      sku: m.product.sku,
      batchNumber: m.batchNumber || 'N/A',
      expiryDate: m.expiryDate!,
      quantity: m.quantity,
      daysLeft: Math.ceil((new Date(m.expiryDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
    }));

    return {
      totalProducts,
      categoriesCount,
      vendorsCount,
      pendingPO,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      recentMovements,
      expiringSoon: uniqueExpiringBatches,
    };
  }
}
