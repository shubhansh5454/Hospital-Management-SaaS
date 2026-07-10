import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().nullable().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  contactPerson: z.string().nullable().optional(),
  email: z.string().email('Invalid email address').nullable().or(z.string().length(0)).optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU/Product code is required'),
  barcode: z.string().nullable().optional(),
  categoryId: z.number().int().positive('Category selection is required'),
  unit: z.string().min(1, 'Unit of measurement is required'),
  stock: z.number().int().nonnegative('Starting stock cannot be negative').optional().default(0),
  minStockAlert: z.number().int().nonnegative('Min stock alert cannot be negative').optional().default(10),
  description: z.string().nullable().optional(),
});

export const updateProductSchema = createProductSchema.partial();

const poItemSchema = z.object({
  productId: z.number().int().positive('Product is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitCost: z.number().nonnegative('Unit cost cannot be negative'),
});

export const createPOSchema = z.object({
  vendorId: z.number().int().positive('Vendor selection is required'),
  orderNumber: z.string().min(1, 'Order Number is required'),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Order date must be YYYY-MM-DD'),
  notes: z.string().nullable().optional(),
  items: z.array(poItemSchema).min(1, 'Purchase order must have at least one item'),
});

export const receivePOSchema = z.object({
  // Record mapping item ID (number) to receiving quantity & info
  itemReceivedQtys: z.record(
    z.string(), // key is POItem ID (stringified number)
    z.object({
      received: z.number().int().nonnegative('Received count cannot be negative'),
      batch: z.string().optional(),
      expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD').optional().or(z.string().length(0)),
    })
  ),
});

export const recordStockMovementSchema = z.object({
  productId: z.number().int().positive('Product is required'),
  type: z.enum(['IN', 'OUT']),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  batchNumber: z.string().nullable().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD').nullable().optional().or(z.string().length(0)),
  reason: z.string().min(1, 'Reason for movement is required'),
  movementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Movement date must be YYYY-MM-DD').optional().default(() => new Date().toISOString().split('T')[0]),
  notes: z.string().nullable().optional(),
});
