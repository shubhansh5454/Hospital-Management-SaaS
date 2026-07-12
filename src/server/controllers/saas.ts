import { Request, Response, NextFunction } from 'express';
import { SaasService } from '../services/saas.ts';
import { AuthRequest } from '../../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { RolesService } from '../services/roles.ts';

export class SaasController {
  /**
   * Register a new clinic
   */
  public static async registerClinic(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { name, slug, email, phone, address, planName, billingCycle } = req.body;
      if (!name || !slug || !planName || !billingCycle) {
        throw new AppError('Missing required fields: name, slug, planName, billingCycle', 400);
      }

      const clinic = await SaasService.registerClinic({
        name,
        slug,
        email,
        phone,
        address,
        planName,
        billingCycle,
        userId: req.user.id,
      });

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'REGISTER_CLINIC',
          'settings',
          { id: clinic.id, name: clinic.name, slug: clinic.slug },
          req.user.id,
          clinic.id
        );
      } catch (logErr) {
        console.error('Audit logging failed for clinic registration:', logErr);
      }

      res.status(201).json({
        status: 'success',
        message: 'Clinic registered successfully. You are now the Clinic Admin!',
        data: clinic,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all clinics (Super Admin only)
   */
  public static async listClinics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'superadmin') {
        throw new AppError('Forbidden: Super Admin only', 403);
      }

      const clinics = await SaasService.listClinics();
      res.status(200).json(clinics);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get clinic info
   */
  public static async getClinicDetails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.role === 'superadmin' 
        ? parseInt(req.params.id) 
        : req.user?.clinicId;

      if (!clinicId) {
        throw new AppError('No clinic associated with your user', 400);
      }

      const clinic = await SaasService.getClinicDetails(clinicId);
      res.status(200).json(clinic);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update clinic info
   */
  public static async updateClinic(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.role === 'superadmin' 
        ? parseInt(req.params.id) 
        : req.user?.clinicId;

      if (!clinicId) {
        throw new AppError('Forbidden: No clinic associated with your user', 400);
      }

      const updated = await SaasService.updateClinic(clinicId, req.body);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'UPDATE_CLINIC_SETTINGS',
          'settings',
          { clinicId, updates: req.body }
        );
      } catch (logErr) {
        console.error('Audit logging failed for clinic settings update:', logErr);
      }
      res.status(200).json({ status: 'success', data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change Subscription
   */
  public static async changeSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        throw new AppError('Forbidden: No clinic associated with your user', 403);
      }

      const { planName, billingCycle } = req.body;
      if (!planName || !billingCycle) {
        throw new AppError('Missing planName or billingCycle', 400);
      }

      const sub = await SaasService.changeSubscription(clinicId, planName, billingCycle);

      // Log audit
      try {
        await RolesService.logRequest(
          req,
          'CHANGE_SUBSCRIPTION',
          'settings',
          { clinicId, planName, billingCycle }
        );
      } catch (logErr) {
        console.error('Audit logging failed for subscription change:', logErr);
      }
      res.status(200).json({
        status: 'success',
        message: 'Subscription updated successfully',
        data: sub,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get billing history
   */
  public static async getBillingHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        throw new AppError('Forbidden: No clinic associated', 403);
      }

      const billings = await SaasService.getBillingHistory(clinicId);
      res.status(200).json(billings);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pay SaaS Invoice
   */
  public static async payInvoice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        throw new AppError('Forbidden: No clinic associated', 403);
      }

      const invoiceId = parseInt(req.params.id);
      const updated = await SaasService.paySaaSInvoice(clinicId, invoiceId);
      res.status(200).json({ status: 'success', data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get dynamic usage statistics
   */
  public static async getUsageStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.role === 'superadmin' && req.query.clinicId
        ? parseInt(req.query.clinicId as string)
        : req.user?.clinicId;

      if (!clinicId) {
        throw new AppError('No clinic context found', 400);
      }

      const usage = await SaasService.getUsageStats(clinicId);
      res.status(200).json(usage);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get master stats overview for Super Admin
   */
  public static async getSuperAdminDashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'superadmin') {
        throw new AppError('Forbidden: Super Admin only', 403);
      }

      const masterStats = await SaasService.getSuperAdminDashboardStats();
      res.status(200).json(masterStats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get staff members in clinic
   */
  public static async getStaff(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        throw new AppError('No clinic associated with your profile', 400);
      }

      const staff = await SaasService.getStaff(clinicId);
      res.status(200).json(staff);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update staff role
   */
  public static async updateStaffRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        throw new AppError('No clinic associated with your profile', 400);
      }

      const staffUserId = parseInt(req.params.id);
      const { role } = req.body;

      if (!['admin', 'doctor', 'receptionist'].includes(role)) {
        throw new AppError('Invalid staff role target', 400);
      }

      const updated = await SaasService.updateStaffRole(clinicId, staffUserId, role);
      res.status(200).json({ status: 'success', data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add / Invite staff member
   */
  public static async addStaffMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        throw new AppError('No clinic associated with your profile', 400);
      }

      const { name, email, role, password } = req.body;
      if (!name || !email || !role) {
        throw new AppError('Missing name, email, or role', 400);
      }

      const newUser = await SaasService.addStaffMember(clinicId, {
        name,
        email,
        role,
        password,
      });

      res.status(201).json({ status: 'success', data: newUser });
    } catch (error) {
      next(error);
    }
  }
}
