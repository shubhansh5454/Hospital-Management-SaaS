import { prisma } from '../../db/prisma.ts';

export interface CreateInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceInput {
  patientId: number;
  doctorId?: number;
  date: string;
  dueDate?: string;
  status?: string;
  taxRate?: number;
  discount?: number;
  notes?: string;
  items: CreateInvoiceItemInput[];
}

export class InvoiceRepository {
  /**
   * Create a new invoice and calculate totals, tax, and item lines
   */
  public static async create(data: CreateInvoiceInput) {
    // Generate unique invoice number: INV-YYYYMMDD-XXXX
    const dateStr = data.date.replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${rand}`;

    // Calculations
    let subTotal = 0;
    const itemsData = data.items.map(item => {
      const total = item.quantity * item.unitPrice;
      subTotal += total;
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: total,
      };
    });

    const taxRate = data.taxRate ?? 0;
    const taxAmount = parseFloat((subTotal * (taxRate / 100)).toFixed(2));
    const discount = data.discount ?? 0;
    const totalAmount = parseFloat((subTotal + taxAmount - discount).toFixed(2));

    return prisma.invoice.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId ?? null,
        invoiceNumber,
        date: data.date,
        dueDate: data.dueDate ?? null,
        status: data.status ?? 'pending',
        taxRate,
        taxAmount,
        discount,
        subTotal,
        totalAmount,
        notes: data.notes ?? null,
        items: {
          create: itemsData,
        },
      },
      include: {
        patient: true,
        items: true,
        payments: true,
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
    });
  }

  /**
   * Find all invoices with filters
   */
  public static async findAll(filters: { patientId?: number; status?: string }) {
    const where: any = {};
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) where.status = filters.status;

    return prisma.invoice.findMany({
      where,
      include: {
        patient: true,
        items: true,
        payments: true,
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find an invoice by ID
   */
  public static async findById(id: number) {
    return prisma.invoice.findUnique({
      where: { id },
      include: {
        patient: true,
        items: true,
        payments: true,
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
    });
  }

  /**
   * Update an invoice status or properties
   */
  public static async update(id: number, data: { status?: string; notes?: string; dueDate?: string }) {
    return prisma.invoice.update({
      where: { id },
      data,
      include: {
        patient: true,
        items: true,
        payments: true,
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
    });
  }

  /**
   * Delete an invoice
   */
  public static async delete(id: number) {
    return prisma.invoice.delete({
      where: { id },
    });
  }

  /**
   * Record a payment against an invoice and update invoice total amount paid and status
   */
  public static async recordPayment(invoiceId: number, data: {
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    referenceNo?: string;
    notes?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch current invoice details
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // 2. Create the payment
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: data.amount,
          paymentDate: data.paymentDate,
          paymentMethod: data.paymentMethod,
          referenceNo: data.referenceNo ?? null,
          notes: data.notes ?? null,
        }
      });

      // 3. Calculate new total amount paid
      const previousPaid = invoice.amountPaid;
      const newPaid = parseFloat((previousPaid + data.amount).toFixed(2));

      // 4. Update status based on paid amount
      let newStatus = 'partially_paid';
      if (newPaid >= invoice.totalAmount) {
        newStatus = 'paid';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newPaid,
          status: newStatus,
          paymentMethod: data.paymentMethod, // last used method
        },
        include: {
          patient: true,
          items: true,
          payments: true,
          doctor: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
        }
      });

      return { payment, invoice: updatedInvoice };
    });
  }
}
