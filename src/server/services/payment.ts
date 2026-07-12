import { prisma } from '../../db/prisma.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { NotificationService } from './notification.ts';
import { logger } from '../utils/logger.ts';
import crypto from 'crypto';

export interface PaymentOrder {
  orderId: string;
  invoiceId: number;
  amount: number;
  paymentMethod: string;
  status: 'created' | 'verified' | 'failed';
  createdAt: number;
  expiresAt: number;
  signature: string;
}

// Thread-safe in-memory order registry for digital signature generation & payment handshakes
const orderRegistry = new Map<string, PaymentOrder>();

// Secret key for generating secure HMAC signatures for API payment handshakes
const HMAC_SECRET = process.env.JWT_SECRET || 'sanctuary-hospital-clinical-jwt-secret-2026';

// Purge expired payment orders every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, order] of orderRegistry.entries()) {
    if (order.expiresAt <= now && order.status === 'created') {
      orderRegistry.delete(id);
    }
  }
}, 15 * 60 * 1000);

export class PaymentService {
  /**
   * Create a payment order for a specific invoice
   */
  public static async createPaymentOrder(invoiceId: number, amount: number, paymentMethod: string, notes?: string): Promise<PaymentOrder> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { patient: true },
    });

    if (!invoice) {
      throw new AppError('The specified invoice was not found', 404);
    }

    if (invoice.status === 'paid') {
      throw new AppError('This invoice is already fully paid', 400);
    }

    if (invoice.status === 'cancelled') {
      throw new AppError('Cannot create a payment order for a cancelled invoice', 400);
    }

    const remaining = parseFloat((invoice.totalAmount - invoice.amountPaid).toFixed(2));
    if (amount <= 0) {
      throw new AppError('Payment amount must be greater than 0', 400);
    }

    if (amount > remaining) {
      throw new AppError(`Payment amount ($${amount.toFixed(2)}) exceeds the remaining balance ($${remaining.toFixed(2)})`, 400);
    }

    const orderId = `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const timestamp = Date.now();
    const expiresAt = timestamp + 20 * 60 * 1000; // 20 minutes expiration

    // Generate secure HMAC digital signature to prevent tampering
    const signatureData = `${orderId}|${invoiceId}|${amount}|${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(signatureData)
      .digest('hex');

    const order: PaymentOrder = {
      orderId,
      invoiceId,
      amount,
      paymentMethod,
      status: 'created',
      createdAt: timestamp,
      expiresAt,
      signature,
    };

    orderRegistry.set(orderId, order);

    logger.info(`Payment order created: ${orderId} for Invoice #${invoice.invoiceNumber} ($${amount})`);
    return order;
  }

  /**
   * Verify transaction signature & record verified payment inside a transaction
   */
  public static async verifyPayment(
    orderId: string,
    referenceNo: string,
    paymentMethod: string,
    amount: number,
    signature?: string,
    gatewayStatus: 'SUCCESS' | 'FAILURE' = 'SUCCESS'
  ) {
    const order = orderRegistry.get(orderId);
    if (!order) {
      throw new AppError('Payment order not found or expired', 400);
    }

    if (order.status !== 'created') {
      throw new AppError(`This payment order has already been processed with status: ${order.status}`, 400);
    }

    if (Date.now() > order.expiresAt) {
      order.status = 'failed';
      throw new AppError('Payment order has expired. Please create a new order.', 400);
    }

    // Double-verification of amount to prevent parameter tampering
    if (Math.abs(order.amount - amount) > 0.01) {
      throw new AppError('Verification failed: Amount discrepancy detected', 400);
    }

    // Verify digital signature if supplied by the payment SDK gateway
    if (signature) {
      const signatureData = `${orderId}|${order.invoiceId}|${order.amount}|${order.expiresAt}`;
      const expectedSignature = crypto
        .createHmac('sha256', HMAC_SECRET)
        .update(signatureData)
        .digest('hex');

      if (signature !== expectedSignature) {
        order.status = 'failed';
        throw new AppError('Invalid digital signature verification. Transaction untrusted.', 400);
      }
    }

    if (gatewayStatus === 'FAILURE') {
      order.status = 'failed';
      throw new AppError('Payment verification aborted: Gateway reported a failed transaction', 400);
    }

    // Proceed to securely commit the payment and update the balance ledger inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: order.invoiceId },
        include: { patient: true },
      });

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      // Safeguard against overpaying due to race conditions
      const remaining = parseFloat((invoice.totalAmount - invoice.amountPaid).toFixed(2));
      if (amount > remaining) {
        throw new AppError(`Verification failed: Amount ($${amount.toFixed(2)}) exceeds remaining balance ($${remaining.toFixed(2)})`, 400);
      }

      // 1. Create a payment record
      const todayDate = new Date().toISOString().split('T')[0];
      const payment = await tx.payment.create({
        data: {
          invoiceId: order.invoiceId,
          amount,
          paymentDate: todayDate,
          paymentMethod: paymentMethod,
          referenceNo,
          notes: `Verified mobile transaction. Order: ${orderId}`,
        },
      });

      // 2. Calculate new amountPaid
      const newPaid = parseFloat((invoice.amountPaid + amount).toFixed(2));
      const newStatus = newPaid >= invoice.totalAmount ? 'paid' : 'partially_paid';

      // 3. Update Invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: order.invoiceId },
        data: {
          amountPaid: newPaid,
          status: newStatus,
          paymentMethod,
        },
        include: {
          patient: true,
          items: true,
          payments: true,
        },
      });

      return { payment, invoice: updatedInvoice };
    });

    // Update order status
    order.status = 'verified';

    // Disptach patient receipt notification
    try {
      await NotificationService.sendNotification({
        patientId: result.invoice.patientId,
        clinicId: result.invoice.clinicId || undefined,
        title: 'Payment Receipt Confirmed',
        message: `Hello ${result.invoice.patient.name}, we have successfully verified your payment of $${amount.toFixed(2)} via ${paymentMethod} (Ref: ${referenceNo}) for Invoice #${result.invoice.invoiceNumber}. Thank you!`,
        type: 'PAYMENT_REMINDER',
        channels: ['EMAIL', 'IN_APP'],
      });
    } catch (err) {
      logger.error('Failed to dispatch verification receipt notification:', err);
    }

    return result;
  }

  /**
   * Process a partial or full Refund
   */
  public static async processRefund(invoiceId: number, refundAmount: number, reason: string, paymentId?: number) {
    if (refundAmount <= 0) {
      throw new AppError('Refund amount must be greater than 0', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true, patient: true },
      });

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      if (invoice.amountPaid <= 0) {
        throw new AppError('No payment recorded on this invoice. Cannot process refund.', 400);
      }

      if (refundAmount > invoice.amountPaid) {
        throw new AppError(`Refund amount ($${refundAmount.toFixed(2)}) exceeds the total paid amount ($${invoice.amountPaid.toFixed(2)})`, 400);
      }

      // If a specific paymentId is specified, ensure it belongs to this invoice and is large enough
      if (paymentId) {
        const specificPayment = await tx.payment.findFirst({
          where: { id: paymentId, invoiceId },
        });
        if (!specificPayment) {
          throw new AppError(`The specified payment record #${paymentId} was not found on this invoice`, 404);
        }
        if (specificPayment.amount <= 0) {
          throw new AppError('Cannot refund an already refunded or negative payment entry', 400);
        }
        if (refundAmount > specificPayment.amount) {
          throw new AppError(`Refund amount ($${refundAmount.toFixed(2)}) exceeds the specified payment amount ($${specificPayment.amount.toFixed(2)})`, 400);
        }
      }

      // 1. Create a negative payment record (Refund transaction) inside the ledger
      const todayDate = new Date().toISOString().split('T')[0];
      const refundRefNo = `REF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const refundPayment = await tx.payment.create({
        data: {
          invoiceId,
          amount: -refundAmount, // Negative amount for perfect ledger balance calculation
          paymentDate: todayDate,
          paymentMethod: 'refund',
          referenceNo: refundRefNo,
          notes: `Refund processed. Reason: ${reason}.` + (paymentId ? ` Original Payment ID: ${paymentId}` : ''),
        },
      });

      // 2. Adjust invoice totals
      const newPaid = parseFloat((invoice.amountPaid - refundAmount).toFixed(2));
      let newStatus = 'partially_paid';
      if (newPaid <= 0) {
        newStatus = 'pending';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newPaid,
          status: newStatus,
          notes: invoice.notes ? `${invoice.notes}\n[REFUND] $${refundAmount.toFixed(2)} refunded on ${todayDate}` : `[REFUND] $${refundAmount.toFixed(2)} refunded on ${todayDate}`,
        },
        include: {
          patient: true,
          items: true,
          payments: true,
        },
      });

      return { refundPayment, invoice: updatedInvoice };
    });

    // Notify Patient of the Refund
    try {
      await NotificationService.sendNotification({
        patientId: result.invoice.patientId,
        clinicId: result.invoice.clinicId || undefined,
        title: 'Refund Processed successfully',
        message: `Hello ${result.invoice.patient.name}, a refund of $${refundAmount.toFixed(2)} has been processed for Invoice #${result.invoice.invoiceNumber}. Reference number: ${result.refundPayment.referenceNo}.`,
        type: 'PAYMENT_REMINDER',
        channels: ['EMAIL', 'IN_APP'],
      });
    } catch (err) {
      logger.error('Failed to dispatch refund notification:', err);
    }

    return result;
  }

  /**
   * Get filtered, paginated payment logs
   */
  public static async getPaymentHistory(
    user: { id: number; email: string; role: string; clinicId?: number | null },
    query: {
      page?: number;
      limit?: number;
      paymentMethod?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Clinic boundaries
    if (user.clinicId) {
      where.invoice = { clinicId: user.clinicId };
    }

    // Role boundaries: Patients can only view their own payment histories
    if (user.role === 'patient') {
      const patient = await prisma.patient.findFirst({
        where: { email: user.email },
      });
      if (!patient) {
        return {
          payments: [],
          pagination: { totalCount: 0, page, limit, totalPages: 0 },
        };
      }
      where.invoice = {
        ...where.invoice,
        patientId: patient.id,
      };
    }

    // Filter by payment method
    if (query.paymentMethod) {
      where.paymentMethod = { equals: query.paymentMethod, mode: 'insensitive' };
    }

    // Filter by date range
    if (query.startDate || query.endDate) {
      where.paymentDate = {};
      if (query.startDate) where.paymentDate.gte = query.startDate;
      if (query.endDate) where.paymentDate.lte = query.endDate;
    }

    // Search term mapping (matches reference number, notes, invoice number, or patient name)
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      where.OR = [
        { referenceNo: { contains: searchLower, mode: 'insensitive' } },
        { notes: { contains: searchLower, mode: 'insensitive' } },
        {
          invoice: {
            invoiceNumber: { contains: searchLower, mode: 'insensitive' },
          },
        },
        {
          invoice: {
            patient: {
              name: { contains: searchLower, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            include: {
              patient: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      payments,
      pagination: {
        totalCount: total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}
