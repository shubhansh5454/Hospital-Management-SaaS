import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoice.ts';
import { createInvoiceSchema, recordPaymentSchema } from '../validation/invoice.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { AuthRequest } from '../../middleware/auth.ts';
import { RolesService } from '../services/roles.ts';

export class InvoiceController {
  /**
   * Create a new invoice
   */
  public static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createInvoiceSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      // Automatically associate the doctor if requested or if user is a doctor
      let doctorId = parsed.data.doctorId;
      if (!doctorId && req.user && req.user.role === 'doctor') {
        doctorId = req.user.id;
      }

      const newInvoice = await InvoiceService.createInvoice({
        ...parsed.data,
        doctorId,
      });

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'CREATE_INVOICE',
          'billing',
          { id: newInvoice.id, total: newInvoice.totalAmount, patientId: newInvoice.patientId }
        );
      } catch (logErr) {
        console.error('Audit logging failed for invoice creation:', logErr);
      }

      res.status(201).json(newInvoice);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all invoices
   */
  public static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized: User identity not verified', 401);
      }

      const patientId = req.query.patientId ? parseInt(req.query.patientId as string, 10) : undefined;
      const status = req.query.status ? (req.query.status as string) : undefined;

      const invoices = await InvoiceService.getAllInvoices(req.user, { patientId, status });
      res.status(200).json(invoices);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get invoice by ID
   */
  public static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized: User identity not verified', 401);
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid invoice ID format', 400);
      }

      const invoice = await InvoiceService.getInvoiceById(id, req.user);
      res.status(200).json(invoice);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record a payment against an invoice
   */
  public static async recordPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid invoice ID format', 400);
      }

      const parsed = recordPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const result = await InvoiceService.recordPayment(id, parsed.data);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'RECORD_PAYMENT',
          'billing',
          { id, amount: parsed.data.amount, method: parsed.data.paymentMethod }
        );
      } catch (logErr) {
        console.error('Audit logging failed for payment recording:', logErr);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update invoice details
   */
  public static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid invoice ID format', 400);
      }

      const { status, notes, dueDate } = req.body;
      const updated = await InvoiceService.updateInvoice(id, { status, notes, dueDate });

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'UPDATE_INVOICE',
          'billing',
          { id, status, notes, dueDate }
        );
      } catch (logErr) {
        console.error('Audit logging failed for invoice update:', logErr);
      }

      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an invoice
   */
  public static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid invoice ID format', 400);
      }

      const result = await InvoiceService.deleteInvoice(id);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'DELETE_INVOICE',
          'billing',
          { id, result }
        );
      } catch (logErr) {
        console.error('Audit logging failed for invoice deletion:', logErr);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
