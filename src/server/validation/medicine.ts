import { z } from 'zod';

export const createMedicineSchema = z.object({
  name: z.string().min(1, 'Medicine name is required'),
  category: z.string().min(1, 'Category is required'),
  code: z.string().min(1, 'Medicine code is required'),
  minStockAlert: z.number().int().nonnegative().optional().default(10),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be in YYYY-MM-DD format'),
  unitPrice: z.number().nonnegative('Selling unit price cannot be negative'),
  purchasePrice: z.number().nonnegative('Purchase cost price cannot be negative'),
  rackLocation: z.string().nullable().optional(),
});

export const updateMedicineSchema = z.object({
  name: z.string().min(1, 'Medicine name cannot be empty').optional(),
  category: z.string().min(1, 'Category cannot be empty').optional(),
  code: z.string().min(1, 'Medicine code cannot be empty').optional(),
  minStockAlert: z.number().int().nonnegative().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be in YYYY-MM-DD format').optional(),
  unitPrice: z.number().nonnegative('Selling price cannot be negative').optional(),
  purchasePrice: z.number().nonnegative('Purchase price cannot be negative').optional(),
  rackLocation: z.string().nullable().optional(),
  stock: z.number().int().nonnegative().optional(),
});

export const purchaseStockSchema = z.object({
  medicineId: z.number().int().positive('Medicine ID is required'),
  quantity: z.number().int().positive('Quantity purchased must be greater than 0'),
  supplier: z.string().min(1, 'Supplier is required'),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Purchase date must be in YYYY-MM-DD format'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be in YYYY-MM-DD format'),
  totalCost: z.number().nonnegative('Total cost cannot be negative'),
});

export const saleMedicineSchema = z.object({
  medicineId: z.number().int().positive('Medicine ID is required'),
  quantity: z.number().int().positive('Quantity sold must be greater than 0'),
  patientId: z.number().int().positive().nullable().optional(),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sale date must be in YYYY-MM-DD format'),
  totalPrice: z.number().nonnegative('Total sale price cannot be negative'),
  paymentMethod: z.enum(['cash', 'card', 'upi']),
  notes: z.string().nullable().optional(),
});
