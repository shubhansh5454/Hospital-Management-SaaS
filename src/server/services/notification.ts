import { prisma } from '../../db/prisma.ts';
import { logger } from '../utils/logger.ts';

export interface SendNotificationInput {
  patientId?: number;
  userId?: number;
  title: string;
  message: string;
  type: 'APPOINTMENT_REMINDER' | 'PRESCRIPTION_REMINDER' | 'PAYMENT_REMINDER' | 'GENERAL';
  channels: ('EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH')[];
}

export class NotificationService {
  /**
   * Core reusable dispatch function
   */
  public static async sendNotification(input: SendNotificationInput) {
    const { patientId, userId, title, message, type, channels } = input;
    const results: any[] = [];

    // Fetch patient or user to get destination details (email, phone, etc.)
    let patientDetails: any = null;
    let userDetails: any = null;

    if (patientId) {
      patientDetails = await prisma.patient.findUnique({ where: { id: patientId } });
    }
    if (userId) {
      userDetails = await prisma.user.findUnique({ where: { id: userId } });
    }

    const emailDest = patientDetails?.email || userDetails?.email || '';
    const phoneDest = patientDetails?.phone || '';
    const recipientName = patientDetails?.name || userDetails?.name || 'Valued Recipient';

    for (const channel of channels) {
      try {
        let status = 'SENT';
        let deliveryDetails = '';

        if (channel === 'EMAIL') {
          // Simulated Email Dispatch
          deliveryDetails = JSON.stringify({
            gateway: 'SendGrid / SMTP',
            recipient: emailDest,
            subject: title,
            body: message,
            sentAt: new Date().toISOString(),
          });
          logger.info(`[Notification - EMAIL] Sent to ${emailDest}: ${title}`);
        } else if (channel === 'SMS') {
          // Simulated SMS Dispatch
          deliveryDetails = JSON.stringify({
            gateway: 'Twilio SMS',
            recipient: phoneDest,
            body: message,
            sentAt: new Date().toISOString(),
          });
          logger.info(`[Notification - SMS] Sent to ${phoneDest}: ${message}`);
        } else if (channel === 'WHATSAPP') {
          // Simulated WhatsApp Dispatch
          deliveryDetails = JSON.stringify({
            gateway: 'Meta WhatsApp Business API',
            recipient: phoneDest,
            template: 'general_reminder',
            body: message,
            sentAt: new Date().toISOString(),
          });
          logger.info(`[Notification - WHATSAPP] Sent to WhatsApp ${phoneDest}: ${message}`);
        } else if (channel === 'PUSH') {
          // Simulated Web Push Notification
          deliveryDetails = JSON.stringify({
            gateway: 'WebPush Webhook',
            recipient: emailDest || 'active_session',
            payload: { title, body: message, icon: '/favicon.ico' },
            sentAt: new Date().toISOString(),
          });
          logger.info(`[Notification - PUSH] Sent WebPush to ${emailDest || 'Active Client'}: ${title}`);
        } else if (channel === 'IN_APP') {
          // In-App Notification (marked as PENDING until read, or SENT by default)
          status = 'SENT';
          deliveryDetails = JSON.stringify({
            container: 'in_app_feed',
            recipientId: userId || patientId,
            recipientType: userId ? 'user' : 'patient',
            sentAt: new Date().toISOString(),
          });
          logger.info(`[Notification - IN_APP] Logged for recipient: ${recipientName}`);
        }

        // Persist notification log to the database
        const createdNotification = await prisma.notification.create({
          data: {
            patientId: patientId || null,
            userId: userId || null,
            title,
            message,
            type,
            channel,
            status,
            deliveryDetails,
          },
        });

        results.push(createdNotification);
      } catch (err: any) {
        logger.error(`Failed to send notification via ${channel}:`, err);
        
        // Log the failure to the database as well
        const failedNotification = await prisma.notification.create({
          data: {
            patientId: patientId || null,
            userId: userId || null,
            title,
            message,
            type,
            channel,
            status: 'FAILED',
            deliveryDetails: JSON.stringify({
              error: err?.message || 'Unknown network error',
              timestamp: new Date().toISOString(),
            }),
          },
        });

        results.push(failedNotification);
      }
    }

    return results;
  }

  /**
   * Helper: Dispatch Appointment Reminder
   */
  public static async sendAppointmentReminder(appointmentId: number, channels: ('EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH')[] = ['EMAIL', 'IN_APP']) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!appointment) {
      throw new Error(`Appointment with ID ${appointmentId} was not found`);
    }

    const patientName = appointment.patient.name;
    const doctorName = appointment.doctor.name;
    const dateFormatted = appointment.date;
    const timeFormatted = appointment.time;

    const title = `Consultation Reminder: Dr. ${doctorName}`;
    const message = `Dear ${patientName}, this is a reminder for your upcoming clinical consultation with Dr. ${doctorName} on ${dateFormatted} at ${timeFormatted}. Please arrive 10 minutes prior to your slot.`;

    // Map patient record link or associated user profile link
    const userProfile = await prisma.user.findFirst({
      where: { email: appointment.patient.email }
    });

    return this.sendNotification({
      patientId: appointment.patientId,
      userId: userProfile?.id,
      title,
      message,
      type: 'APPOINTMENT_REMINDER',
      channels,
    });
  }

  /**
   * Helper: Dispatch Prescription Reminder
   */
  public static async sendPrescriptionReminder(emrRecordId: number, channels: ('EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH')[] = ['EMAIL', 'IN_APP', 'WHATSAPP']) {
    const record = await prisma.emrRecord.findUnique({
      where: { id: emrRecordId },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!record) {
      throw new Error(`EMR Record with ID ${emrRecordId} was not found`);
    }

    let medsList = 'prescribed medication';
    try {
      if (record.prescriptions) {
        const meds = JSON.parse(record.prescriptions);
        if (Array.isArray(meds) && meds.length > 0) {
          medsList = meds.map((m: any) => `${m.medication} (${m.dosage || ''} - ${m.frequency || ''})`).join(', ');
        }
      }
    } catch (e) {
      // JSON parse fallback
    }

    const patientName = record.patient.name;
    const doctorName = record.doctor.name;

    const title = `Prescription Intake Reminder: CareSync Clinic`;
    const message = `Dear ${patientName}, here is a daily reminder for your prescription prescribed by Dr. ${doctorName}: ${medsList}. Please adhere closely to the instructions.`;

    const userProfile = await prisma.user.findFirst({
      where: { email: record.patient.email }
    });

    return this.sendNotification({
      patientId: record.patientId,
      userId: userProfile?.id,
      title,
      message,
      type: 'PRESCRIPTION_REMINDER',
      channels,
    });
  }

  /**
   * Helper: Dispatch Payment Reminder
   */
  public static async sendPaymentReminder(invoiceId: number, channels: ('EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP')[] = ['EMAIL', 'SMS', 'IN_APP']) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        patient: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} was not found`);
    }

    const patientName = invoice.patient.name;
    const pendingAmount = invoice.totalAmount - invoice.amountPaid;
    const invoiceNum = invoice.invoiceNumber;
    const dueDate = invoice.dueDate || 'N/A';

    const title = `Outstanding Payment Reminder: Invoice #${invoiceNum}`;
    const message = `Dear ${patientName}, this is a reminder that Invoice #${invoiceNum} of $${invoice.totalAmount.toFixed(2)} is currently ${invoice.status}. The outstanding balance is $${pendingAmount.toFixed(2)}, due on ${dueDate}. Please settle the payment at your earliest convenience.`;

    const userProfile = await prisma.user.findFirst({
      where: { email: invoice.patient.email }
    });

    return this.sendNotification({
      patientId: invoice.patientId,
      userId: userProfile?.id,
      title,
      message,
      type: 'PAYMENT_REMINDER',
      channels,
    });
  }

  /**
   * Fetch notification history with filters
   */
  public static async getHistory(filters: {
    patientId?: number;
    userId?: number;
    type?: string;
    channel?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    const { patientId, userId, type, channel, status, skip = 0, take = 50 } = filters;

    const whereClause: any = {};
    if (patientId) whereClause.patientId = patientId;
    if (userId) whereClause.userId = userId;
    if (type) whereClause.type = type;
    if (channel) whereClause.channel = channel;
    if (status) whereClause.status = status;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: { name: true, email: true, phone: true }
          },
          user: {
            select: { name: true, email: true }
          }
        },
        skip,
        take,
      }),
      prisma.notification.count({ where: whereClause }),
    ]);

    return { notifications, total };
  }

  /**
   * Mark a notification as read
   */
  public static async markAsRead(notificationId: number) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'READ' },
    });
  }

  /**
   * Mark all notifications as read for a specific patient / user
   */
  public static async markAllAsRead(params: { patientId?: number; userId?: number }) {
    const whereClause: any = { status: { not: 'READ' } };
    if (params.patientId) whereClause.patientId = params.patientId;
    if (params.userId) whereClause.userId = params.userId;

    return prisma.notification.updateMany({
      where: whereClause,
      data: { status: 'READ' },
    });
  }
}
