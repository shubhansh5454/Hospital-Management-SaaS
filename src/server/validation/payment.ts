import { z } from 'zod';

export const paymentMethodsEnum = z.enum([
  'UPI',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'NET_BANKING',
  'cash',
  'card',
  'upi'
]);

export const createPaymentOrderSchema = z.object({
  invoiceId: z.number().int().positive('Invoice ID is required'),
  amount: z.number().positive('Order amount must be greater than 0'),
  paymentMethod: paymentMethodsEnum,
  notes: z.string().max(500, 'Notes are too long').optional(),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  referenceNo: z.string().min(1, 'Reference number is required'),
  paymentMethod: paymentMethodsEnum,
  amount: z.number().positive('Verified amount must be greater than 0'),
  signature: z.string().optional(),
  gatewayStatus: z.enum(['SUCCESS', 'FAILURE']).default('SUCCESS'),
});

export const refundPaymentSchema = z.object({
  invoiceId: z.number().int().positive('Invoice ID is required'),
  paymentId: z.number().int().positive().optional(),
  amount: z.number().positive('Refund amount must be greater than 0'),
  reason: z.string().min(5, 'Reason for refund must be at least 5 characters').max(500),
});
