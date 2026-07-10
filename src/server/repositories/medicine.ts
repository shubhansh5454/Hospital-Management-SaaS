import { prisma } from '../../db/prisma.ts';

export interface CreateMedicineInput {
  name: string;
  category: string;
  code: string;
  minStockAlert?: number;
  expiryDate: string;
  unitPrice: number;
  purchasePrice: number;
  rackLocation?: string;
}

export interface PurchaseMedicineInput {
  medicineId: number;
  quantity: number;
  supplier: string;
  purchaseDate: string;
  batchNumber: string;
  expiryDate: string;
  totalCost: number;
}

export interface SaleMedicineInput {
  medicineId: number;
  quantity: number;
  patientId?: number;
  saleDate: string;
  totalPrice: number;
  paymentMethod: string;
  notes?: string;
}

export class MedicineRepository {
  /**
   * Create a new Medicine in Master List
   */
  public static async create(data: CreateMedicineInput) {
    return prisma.medicine.create({
      data: {
        name: data.name,
        category: data.category,
        code: data.code.toUpperCase(),
        minStockAlert: data.minStockAlert ?? 10,
        expiryDate: data.expiryDate,
        unitPrice: data.unitPrice,
        purchasePrice: data.purchasePrice,
        rackLocation: data.rackLocation ?? null,
        stock: 0, // initially zero stock until purchased
      }
    });
  }

  /**
   * Find a specific medicine by ID
   */
  public static async findById(id: number) {
    return prisma.medicine.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { createdAt: 'desc' }
        },
        sales: {
          include: { patient: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  /**
   * Find a specific medicine by code
   */
  public static async findByCode(code: string) {
    return prisma.medicine.findUnique({
      where: { code: code.toUpperCase() }
    });
  }

  /**
   * List all medicines with comprehensive filtering
   */
  public static async findAll(filters: {
    search?: string;
    category?: string;
    lowStock?: boolean;
    expired?: boolean;
  }) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.category && filters.category !== 'all') {
      where.category = filters.category;
    }

    const currentDate = new Date().toISOString().split('T')[0];

    if (filters.expired) {
      where.expiryDate = { lt: currentDate };
    }

    const list = await prisma.medicine.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    if (filters.lowStock) {
      // Filter in-memory as prisma doesn't support col reference direct comparisons easily without raw queries
      return list.filter(med => med.stock <= med.minStockAlert);
    }

    return list;
  }

  /**
   * Update medicine master properties
   */
  public static async update(id: number, data: Partial<CreateMedicineInput> & { stock?: number }) {
    return prisma.medicine.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete medicine master
   */
  public static async delete(id: number) {
    return prisma.medicine.delete({
      where: { id },
    });
  }

  /**
   * Record a restocking purchase and increment current medicine stock
   */
  public static async recordPurchase(data: PurchaseMedicineInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Log the purchase
      const purchase = await tx.medicinePurchase.create({
        data: {
          medicineId: data.medicineId,
          quantity: data.quantity,
          supplier: data.supplier,
          purchaseDate: data.purchaseDate,
          batchNumber: data.batchNumber,
          expiryDate: data.expiryDate,
          totalCost: data.totalCost,
        }
      });

      // 2. Fetch current medicine to update stock
      const med = await tx.medicine.findUnique({
        where: { id: data.medicineId }
      });

      if (!med) {
        throw new Error('Medicine not found');
      }

      // 3. Update stock and prices/expiry if the purchase is newer or standard update
      const newStock = med.stock + data.quantity;
      const calculatedPurchasePrice = parseFloat((data.totalCost / data.quantity).toFixed(2));

      await tx.medicine.update({
        where: { id: data.medicineId },
        data: {
          stock: newStock,
          purchasePrice: calculatedPurchasePrice,
          // Update expiry to the newer purchase's expiry
          expiryDate: data.expiryDate,
        }
      });

      return purchase;
    });
  }

  /**
   * Record a sale of medicine and decrement stock
   */
  public static async recordSale(data: SaleMedicineInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch current medicine stock
      const med = await tx.medicine.findUnique({
        where: { id: data.medicineId }
      });

      if (!med) {
        throw new Error('Medicine not found in inventory');
      }

      if (med.stock < data.quantity) {
        throw new Error(`Insufficient stock. Available: ${med.stock}, Requested: ${data.quantity}`);
      }

      // 2. Log the sale transaction
      const sale = await tx.medicineSale.create({
        data: {
          medicineId: data.medicineId,
          quantity: data.quantity,
          patientId: data.patientId ?? null,
          saleDate: data.saleDate,
          totalPrice: data.totalPrice,
          paymentMethod: data.paymentMethod,
          notes: data.notes ?? null,
        },
        include: {
          patient: true,
          medicine: true,
        }
      });

      // 3. Decrement medicine stock
      await tx.medicine.update({
        where: { id: data.medicineId },
        data: {
          stock: med.stock - data.quantity,
        }
      });

      return sale;
    });
  }

  /**
   * Get Category Statistics
   */
  public static async getCategoryStats() {
    return prisma.medicine.groupBy({
      by: ['category'],
      _count: {
        id: true,
      },
      _sum: {
        stock: true,
      }
    });
  }
}
