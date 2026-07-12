import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { prisma } from '../../db/prisma.ts';

export class NotificationController {
  /**
   * Get history of sent / received notifications
   */
  public static async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user; // Set by requireAuth
      const role = user.role;
      const { type, channel, status, page = '1', limit = '50', patientId } = req.query;

      const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
      const take = parseInt(limit as string, 10);

      const filters: any = { skip, take };

      if (type) filters.type = type as string;
      if (channel) filters.channel = channel as string;
      if (status) filters.status = status as string;

      // Clinic tenant isolation
      if (role !== 'superadmin') {
        filters.clinicId = user.clinicId;
      } else if (req.query.clinicId) {
        filters.clinicId = parseInt(req.query.clinicId as string, 10);
      }

      // If patient, restrict to their own notifications
      if (role === 'patient') {
        const patientProfile = await prisma.patient.findFirst({
          where: { email: user.email },
        });
        if (!patientProfile) {
          return res.json({ notifications: [], total: 0 });
        }
        filters.patientId = patientProfile.id;
      } else if (patientId) {
        // Staff can filter by specific patient
        filters.patientId = parseInt(patientId as string, 10);
      }

      const result = await NotificationService.getHistory(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Send a custom notification manually (Staff only)
   */
  public static async sendCustom(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId, userId, title, message, type = 'GENERAL', channels } = req.body;
      const user = (req as any).user;

      if (!title || !message || !channels || !Array.isArray(channels) || channels.length === 0) {
        throw new AppError('Missing title, message, or at least one delivery channel', 400);
      }

      const input = {
        patientId: patientId ? parseInt(patientId, 10) : undefined,
        userId: userId ? parseInt(userId, 10) : undefined,
        clinicId: user?.clinicId || undefined,
        title,
        message,
        type,
        channels,
      };

      const result = await NotificationService.sendNotification(input);
      res.status(201).json({
        success: true,
        message: 'Notification(s) processed successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark a specific notification as read
   */
  public static async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid notification ID', 400);
      }

      const user = (req as any).user;

      // If patient, make sure they own the notification
      if (user.role === 'patient') {
        const notification = await prisma.notification.findUnique({
          where: { id },
          include: { patient: true },
        });

        if (!notification) {
          throw new AppError('Notification not found', 404);
        }

        if (notification.patient?.email !== user.email && notification.userId !== user.id) {
          throw new AppError('Unauthorized access to this notification', 403);
        }
      }

      const updated = await NotificationService.markAsRead(id);
      res.json({ success: true, notification: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark all notifications as read
   */
  public static async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;

      if (user.role === 'patient') {
        const patientProfile = await prisma.patient.findFirst({
          where: { email: user.email },
        });

        if (patientProfile) {
          await NotificationService.markAllAsRead({ patientId: patientProfile.id, userId: user.id });
        } else {
          await NotificationService.markAllAsRead({ userId: user.id });
        }
      } else {
        // Staff can mark all of theirs as read
        await NotificationService.markAllAsRead({ userId: user.id });
      }

      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Manually trigger an Appointment Reminder
   */
  public static async triggerAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const { appointmentId, channels } = req.body;
      if (!appointmentId) {
        throw new AppError('Appointment ID is required', 400);
      }

      const result = await NotificationService.sendAppointmentReminder(
        parseInt(appointmentId, 10),
        channels
      );

      res.json({
        success: true,
        message: 'Appointment reminder dispatched',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Manually trigger a Prescription Reminder
   */
  public static async triggerPrescription(req: Request, res: Response, next: NextFunction) {
    try {
      const { emrRecordId, channels } = req.body;
      if (!emrRecordId) {
        throw new AppError('EMR Record ID is required', 400);
      }

      const result = await NotificationService.sendPrescriptionReminder(
        parseInt(emrRecordId, 10),
        channels
      );

      res.json({
        success: true,
        message: 'Prescription reminder dispatched',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Manually trigger a Payment Reminder
   */
  public static async triggerPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { invoiceId, channels } = req.body;
      if (!invoiceId) {
        throw new AppError('Invoice ID is required', 400);
      }

      const result = await NotificationService.sendPaymentReminder(
        parseInt(invoiceId, 10),
        channels
      );

      res.json({
        success: true,
        message: 'Payment reminder dispatched',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
