import { InvoiceRepository, CreateInvoiceInput } from '../repositories/invoice.ts';
import { PatientRepository } from '../repositories/patient.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class InvoiceService {
  /**
   * Create a new invoice and ensure patient exists
   */
  public static async createInvoice(input: CreateInvoiceInput) {
    const patient = await PatientRepository.findById(input.patientId);
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    if (!input.items || input.items.length === 0) {
      throw new AppError('Invoice must contain at least one item', 400);
    }

    for (const item of input.items) {
      if (!item.description || item.description.trim() === '') {
        throw new AppError('Item description is required', 400);
      }
      if (item.quantity <= 0) {
        throw new AppError('Item quantity must be greater than 0', 400);
      }
      if (item.unitPrice < 0) {
        throw new AppError('Item unit price cannot be negative', 400);
      }
    }

    return InvoiceRepository.create(input);
  }

  /**
   * Retrieve all invoices, applying patient role boundary checks if necessary
   */
  public static async getAllInvoices(user: { id: number; email: string; role: string }, filters: { patientId?: number; status?: string }) {
    let activePatientId = filters.patientId;

    if (user.role === 'patient') {
      const patientProfile = await PatientRepository.findByEmail(user.email);
      if (!patientProfile) {
        return []; // Return empty list if no patient profile matches current authenticated email
      }
      activePatientId = patientProfile.id;
    }

    return InvoiceRepository.findAll({ patientId: activePatientId, status: filters.status });
  }

  /**
   * Fetch a specific invoice by ID with patient boundary validation
   */
  public static async getInvoiceById(id: number, user: { email: string; role: string }) {
    const invoice = await InvoiceRepository.findById(id);
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (user.role === 'patient') {
      const patientProfile = await PatientRepository.findByEmail(user.email);
      if (!patientProfile || invoice.patientId !== patientProfile.id) {
        throw new AppError('Access denied: This invoice belongs to another patient', 403);
      }
    }

    return invoice;
  }

  /**
   * Update invoice details (status, notes, etc.)
   */
  public static async updateInvoice(id: number, data: { status?: string; notes?: string; dueDate?: string }) {
    const existing = await InvoiceRepository.findById(id);
    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }
    return InvoiceRepository.update(id, data);
  }

  /**
   * Delete an invoice
   */
  public static async deleteInvoice(id: number) {
    const existing = await InvoiceRepository.findById(id);
    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }
    await InvoiceRepository.delete(id);
    return { success: true, message: 'Invoice successfully deleted' };
  }

  /**
   * Record a payment and enforce remaining balance checks
   */
  public static async recordPayment(invoiceId: number, data: {
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    referenceNo?: string;
    notes?: string;
  }) {
    const invoice = await InvoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (data.amount <= 0) {
      throw new AppError('Payment amount must be greater than 0', 400);
    }

    const remaining = parseFloat((invoice.totalAmount - invoice.amountPaid).toFixed(2));
    if (data.amount > remaining) {
      throw new AppError(`Payment amount (${data.amount}) exceeds the remaining balance (${remaining})`, 400);
    }

    return InvoiceRepository.recordPayment(invoiceId, data);
  }
}
