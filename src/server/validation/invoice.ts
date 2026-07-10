import { z } from 'zod';

export const createInvoiceItemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().int().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
});

export const createInvoiceSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  doctorId: z.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format').optional(),
  status: z.enum(['pending', 'paid', 'partially_paid', 'cancelled']).optional(),
  taxRate: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  notes: z.string().nullable().optional(),
  items: z.array(createInvoiceItemSchema).min(1, 'Invoice must have at least 1 item'),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format'),
  paymentMethod: z.enum(['cash', 'card', 'upi']),
  referenceNo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
