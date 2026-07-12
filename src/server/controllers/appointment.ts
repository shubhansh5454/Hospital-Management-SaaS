import { Request, Response, NextFunction } from 'express';
import { AppointmentService } from '../services/appointment.ts';
import { createAppointmentSchema, updateAppointmentSchema, filterAppointmentQuerySchema } from '../validation/appointment.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { AuthRequest } from '../../middleware/auth.ts';
import { RolesService } from '../services/roles.ts';

export class AppointmentController {
  /**
   * Create an appointment
   */
  public static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const clinicId = req.user?.clinicId;
      const appointment = await AppointmentService.createAppointment({
        ...parsed.data,
        clinicId: clinicId || undefined,
      });

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'CREATE_APPOINTMENT',
          'appointments',
          { id: appointment.id, date: appointment.date, time: appointment.time, patientId: appointment.patientId }
        );
      } catch (logErr) {
        console.error('Audit logging failed for appointment creation:', logErr);
      }

      res.status(211).json(appointment); // status 211 is mapped to Created in this app's API workflow
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all appointments with filtering, searching, and pagination
   */
  public static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Build filters based on logged in user's role to preserve security constraints
      const role = req.user?.role;
      const userId = req.user?.id;
      const userEmail = req.user?.email;
      const clinicId = req.user?.clinicId;

      const rawQuery = { ...req.query };

      // Filter based on user roles
      if (role === 'doctor') {
        // Doctors only see their own appointments
        rawQuery.doctorId = String(userId);
      } else if (role === 'patient') {
        // Patients see their own appointments. Let's find patient profile matched with email first.
        const matchedPatients = await import('../../db/prisma.ts').then(m => 
          m.prisma.patient.findMany({ where: { email: userEmail } })
        );
        if (matchedPatients.length === 0) {
          return res.status(200).json({
            appointments: [],
            pagination: { total: 0, page: 1, limit: 10, totalPages: 0 }
          });
        }
        rawQuery.patientId = String(matchedPatients[0].id);
      }

      const parsed = filterAppointmentQuerySchema.safeParse(rawQuery);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const result = await AppointmentService.getAllAppointments({
        ...parsed.data,
        clinicId: clinicId || undefined,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single appointment by ID
   */
  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid appointment ID format', 400);
      }

      const appointment = await AppointmentService.getAppointmentById(id);
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an appointment by ID
   */
  public static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid appointment ID format', 400);
      }

      const parsed = updateAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.issues[0].message, 400);
      }

      const updated = await AppointmentService.updateAppointment(id, parsed.data);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'UPDATE_APPOINTMENT',
          'appointments',
          { id: updated.id, updates: parsed.data }
        );
      } catch (logErr) {
        console.error('Audit logging failed for appointment update:', logErr);
      }

      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an appointment by ID
   */
  public static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        throw new AppError('Invalid appointment ID format', 400);
      }

      const result = await AppointmentService.deleteAppointment(id);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'DELETE_APPOINTMENT',
          'appointments',
          { id, result }
        );
      } catch (logErr) {
        console.error('Audit logging failed for appointment deletion:', logErr);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
