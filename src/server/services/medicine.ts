import { MedicineRepository, CreateMedicineInput, PurchaseMedicineInput, SaleMedicineInput } from '../repositories/medicine.ts';
import { PatientRepository } from '../repositories/patient.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { NotificationService } from './notification.ts';

export class MedicineService {
  /**
   * Create new medicine in inventory master
   */
  public static async createMedicine(input: CreateMedicineInput) {
    if (!input.name || input.name.trim() === '') {
      throw new AppError('Medicine name is required', 400);
    }
    if (!input.category || input.category.trim() === '') {
      throw new AppError('Category is required', 400);
    }
    if (!input.code || input.code.trim() === '') {
      throw new AppError('Medicine code is required', 400);
    }

    const existing = await MedicineRepository.findByCode(input.code);
    if (existing) {
      throw new AppError(`A medicine with code ${input.code.toUpperCase()} already exists`, 400);
    }

    if (input.unitPrice < 0 || input.purchasePrice < 0) {
      throw new AppError('Prices cannot be negative values', 400);
    }

    return MedicineRepository.create(input);
  }

  /**
   * Fetch a single medicine
   */
  public static async getMedicineById(id: number) {
    const med = await MedicineRepository.findById(id);
    if (!med) {
      throw new AppError('Medicine not found', 404);
    }
    return med;
  }

  /**
   * Fetch all medicines with filters
   */
  public static async getAllMedicines(filters: {
    search?: string;
    category?: string;
    lowStock?: boolean;
    expired?: boolean;
  }) {
    return MedicineRepository.findAll(filters);
  }

  /**
   * Update medicine master record
   */
  public static async updateMedicine(id: number, data: Partial<CreateMedicineInput>) {
    const med = await MedicineRepository.findById(id);
    if (!med) {
      throw new AppError('Medicine not found', 404);
    }

    if (data.code) {
      const existing = await MedicineRepository.findByCode(data.code);
      if (existing && existing.id !== id) {
        throw new AppError(`A medicine with code ${data.code.toUpperCase()} already exists`, 400);
      }
    }

    if (data.unitPrice !== undefined && data.unitPrice < 0) {
      throw new AppError('Unit price cannot be negative', 400);
    }
    if (data.purchasePrice !== undefined && data.purchasePrice < 0) {
      throw new AppError('Purchase price cannot be negative', 400);
    }

    return MedicineRepository.update(id, data);
  }

  /**
   * Delete medicine master record
   */
  public static async deleteMedicine(id: number) {
    const med = await MedicineRepository.findById(id);
    if (!med) {
      throw new AppError('Medicine not found', 404);
    }
    await MedicineRepository.delete(id);
    return { success: true, message: 'Medicine successfully deleted from database' };
  }

  /**
   * Purchase stock
   */
  public static async purchaseStock(input: PurchaseMedicineInput) {
    const med = await MedicineRepository.findById(input.medicineId);
    if (!med) {
      throw new AppError('Medicine not found', 404);
    }

    if (input.quantity <= 0) {
      throw new AppError('Quantity purchased must be greater than 0', 400);
    }
    if (input.totalCost < 0) {
      throw new AppError('Total cost cannot be negative', 400);
    }

    return MedicineRepository.recordPurchase(input);
  }

  /**
   * Sale transaction
   */
  public static async sellMedicine(input: SaleMedicineInput) {
    const med = await MedicineRepository.findById(input.medicineId);
    if (!med) {
      throw new AppError('Medicine not found in master registry', 404);
    }

    if (input.quantity <= 0) {
       throw new AppError('Quantity sold must be greater than 0', 400);
    }

    // Verify patient profile if linked
    if (input.patientId) {
      const patient = await PatientRepository.findById(input.patientId);
      if (!patient) {
        throw new AppError('The specified patient profile does not exist', 404);
      }
    }

    // Expiry check warn/block
    const currentDate = new Date().toISOString().split('T')[0];
    if (med.expiryDate < currentDate) {
      throw new AppError('This medicine has expired! Selling expired products is prohibited.', 400);
    }

    const sale = await MedicineRepository.recordSale(input);

    // Dynamic stock-level check for restocking triggers
    try {
      const updatedMed = await MedicineRepository.findById(input.medicineId);
      if (updatedMed && updatedMed.stock <= updatedMed.minStockAlert) {
        await NotificationService.sendNotification({
          title: `⚠️ Pharmacy Low Stock Alert: ${updatedMed.name}`,
          message: `The pharmacy stock level for ${updatedMed.name} (${updatedMed.code}) has dropped to ${updatedMed.stock} units, which is below the minimum safety threshold of ${updatedMed.minStockAlert} units. Please authorize restocking immediately.`,
          type: 'GENERAL',
          channels: ['EMAIL', 'IN_APP']
        });
      }
    } catch (err) {
      console.error('Failed to trigger automatic pharmacy low stock restocking alert:', err);
    }

    return sale;
  }

  /**
   * Generate a comprehensive Stock Report with Alerts and valuations
   */
  public static async generateStockReport() {
    const medicines = await MedicineRepository.findAll({});
    const currentDateStr = new Date().toISOString().split('T')[0];
    const currentDate = new Date(currentDateStr);
    
    let totalItems = 0;
    let totalStockVolume = 0;
    let inventoryValuationAtPurchase = 0;
    let potentialSalesValuation = 0;
    let lowStockCount = 0;
    let expiredCount = 0;
    let nearExpiryCount = 0; // within 90 days

    const reportItems = medicines.map(med => {
      totalItems++;
      totalStockVolume += med.stock;
      inventoryValuationAtPurchase += (med.stock * med.purchasePrice);
      potentialSalesValuation += (med.stock * med.unitPrice);

      const isLowStock = med.stock <= med.minStockAlert;
      if (isLowStock) lowStockCount++;

      const isExpired = med.expiryDate < currentDateStr;
      let isNearExpiry = false;

      if (isExpired) {
        expiredCount++;
      } else {
        const expDate = new Date(med.expiryDate);
        const timeDiff = expDate.getTime() - currentDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        if (daysDiff <= 90) {
          nearExpiryCount++;
          isNearExpiry = true;
        }
      }

      return {
        id: med.id,
        name: med.name,
        code: med.code,
        category: med.category,
        stock: med.stock,
        minStockAlert: med.minStockAlert,
        expiryDate: med.expiryDate,
        purchasePrice: med.purchasePrice,
        unitPrice: med.unitPrice,
        isLowStock,
        isExpired,
        isNearExpiry,
        holdingCost: med.stock * med.purchasePrice
      };
    });

    const categorySummary = await MedicineRepository.getCategoryStats();

    return {
      summary: {
        totalTypesOfMedicines: totalItems,
        totalStockQty: totalStockVolume,
        inventoryValuationAtCost: parseFloat(inventoryValuationAtPurchase.toFixed(2)),
        potentialRevenue: parseFloat(potentialSalesValuation.toFixed(2)),
        lowStockItemsCount: lowStockCount,
        expiredItemsCount: expiredCount,
        nearExpiryItemsCount: nearExpiryCount,
      },
      categorySummary: categorySummary.map(c => ({
        category: c.category,
        totalMedicines: c._count.id,
        totalStock: c._sum.stock || 0
      })),
      medicinesList: reportItems
    };
  }
}
