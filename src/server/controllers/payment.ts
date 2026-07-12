import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { PaymentService } from '../services/payment.ts';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
} from '../validation/payment.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { RolesService } from '../services/roles.ts';
import { prisma } from '../../db/prisma.ts';

export class PaymentController {
  /**
   * Create a new payment order for an invoice
   */
  public static async createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createPaymentOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const { invoiceId, amount, paymentMethod, notes } = parsed.data;

      // Access control: Patients can only create payment orders for their own invoices
      if (req.user?.role === 'patient') {
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: { patient: true },
        });

        if (!invoice) {
          throw new AppError('The specified invoice was not found', 404);
        }

        if (invoice.patient.email !== req.user.email) {
          throw new AppError('Access Denied: You cannot create a payment order for another patient\'s invoice', 403);
        }
      }

      const order = await PaymentService.createPaymentOrder(invoiceId, amount, paymentMethod, notes);

      res.status(201).json({
        status: 'success',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify and commit payment order transaction
   */
  public static async verifyPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = verifyPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const { orderId, referenceNo, paymentMethod, amount, signature, gatewayStatus } = parsed.data;

      const result = await PaymentService.verifyPayment(
        orderId,
        referenceNo,
        paymentMethod,
        amount,
        signature,
        gatewayStatus
      );

      // Log request in the Audit log
      try {
        await RolesService.logRequest(req, 'VERIFY_PAYMENT', 'billing', {
          orderId,
          referenceNo,
          amount,
          invoiceId: result.invoice.id,
        });
      } catch (logErr) {
        console.error('Audit log failed for payment verification:', logErr);
      }

      res.status(200).json({
        status: 'success',
        message: 'Payment verified and recorded successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Initiate full or partial refund
   */
  public static async refund(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Refund is restricted to billing roles (admin, receptionist)
      const allowedRoles = ['admin', 'receptionist'];
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        throw new AppError('Access Denied: You are not authorized to issue refunds.', 403);
      }

      const parsed = refundPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const { invoiceId, paymentId, amount, reason } = parsed.data;

      const result = await PaymentService.processRefund(invoiceId, amount, reason, paymentId);

      // Log in Audit Trail
      try {
        await RolesService.logRequest(req, 'ISSUE_REFUND', 'billing', {
          invoiceId,
          paymentId,
          amount,
          reason,
          refundReferenceNo: result.refundPayment.referenceNo,
        });
      } catch (logErr) {
        console.error('Audit log failed for refund creation:', logErr);
      }

      res.status(200).json({
        status: 'success',
        message: 'Refund successfully processed',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List paginated and searchable payment transaction history
   */
  public static async getHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized access', 401);
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const paymentMethod = req.query.paymentMethod as string | undefined;
      const search = req.query.search as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await PaymentService.getPaymentHistory(req.user, {
        page,
        limit,
        paymentMethod,
        search,
        startDate,
        endDate,
      });

      res.status(200).json({
        status: 'success',
        data: result.payments,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get custom integrated billing stats and invoices for integration
   */
  public static async getInvoiceDetailsWithPayments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const invoiceId = parseInt(req.params.id, 10);
      if (isNaN(invoiceId)) {
        throw new AppError('Invalid invoice ID format', 400);
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          patient: {
            select: { id: true, name: true, email: true, phone: true },
          },
          items: true,
          payments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      // Security check: patients can only access their own invoices
      if (req.user?.role === 'patient') {
        const patient = await prisma.patient.findFirst({
          where: { email: req.user.email },
        });
        if (!patient || invoice.patientId !== patient.id) {
          throw new AppError('Access Denied: You do not have permission to view this invoice', 403);
        }
      }

      const remainingAmount = parseFloat((invoice.totalAmount - invoice.amountPaid).toFixed(2));

      res.status(200).json({
        status: 'success',
        data: {
          ...invoice,
          remainingAmount,
          integratedStatus: {
            isFullyPaid: invoice.amountPaid >= invoice.totalAmount,
            isOverpaid: invoice.amountPaid > invoice.totalAmount,
            hasRefunds: invoice.payments.some((p) => p.amount < 0),
            totalRefunded: Math.abs(
              invoice.payments.filter((p) => p.amount < 0).reduce((sum, p) => sum + p.amount, 0)
            ),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
