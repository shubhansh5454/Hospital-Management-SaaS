import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { InsuranceService } from '../services/insurance.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class InsuranceController {
  // ================= COMPANIES CONTROLLER =================
  public static async getCompanies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companies = InsuranceService.getCompanies();
      res.json(companies);
    } catch (error) {
      next(error);
    }
  }

  public static async createCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'receptionist' && req.user?.role !== 'doctor') {
        throw new AppError('Unauthorized: only clinical staff can configure insurance', 403);
      }
      const newCompany = InsuranceService.createCompany(req.body);
      res.status(201).json(newCompany);
    } catch (error) {
      next(error);
    }
  }

  public static async updateCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'receptionist' && req.user?.role !== 'doctor') {
        throw new AppError('Unauthorized', 403);
      }
      const updated = InsuranceService.updateCompany(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'receptionist') {
        throw new AppError('Unauthorized', 403);
      }
      InsuranceService.deleteCompany(req.params.id);
      res.json({ success: true, message: 'Company successfully deleted' });
    } catch (error) {
      next(error);
    }
  }

  // ================= PLANS CONTROLLER =================
  public static async getPlans(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = InsuranceService.getPlans();
      res.json(plans);
    } catch (error) {
      next(error);
    }
  }

  public static async createPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'receptionist' && req.user?.role !== 'doctor') {
        throw new AppError('Unauthorized', 403);
      }
      const newPlan = InsuranceService.createPlan(req.body);
      res.status(201).json(newPlan);
    } catch (error) {
      next(error);
    }
  }

  public static async updatePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'receptionist' && req.user?.role !== 'doctor') {
        throw new AppError('Unauthorized', 403);
      }
      const updated = InsuranceService.updatePlan(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  public static async deletePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'receptionist') {
        throw new AppError('Unauthorized', 403);
      }
      InsuranceService.deletePlan(req.params.id);
      res.json({ success: true, message: 'Insurance plan successfully deleted' });
    } catch (error) {
      next(error);
    }
  }

  // ================= POLICIES CONTROLLER =================
  public static async getPolicies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Patients can only view their own policy files
      let filterPatientId: number | undefined;
      if (req.user?.role === 'patient') {
        filterPatientId = req.user.id;
      } else if (req.query.patientId) {
        filterPatientId = parseInt(req.query.patientId as string);
      }

      const policies = await InsuranceService.getPatientInsurances(filterPatientId);
      res.json(policies);
    } catch (error) {
      next(error);
    }
  }

  public static async createPolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const policyData = { ...req.body };
      // Secure patient link
      if (req.user.role === 'patient') {
        policyData.patientId = req.user.id;
        policyData.status = 'pending_verification';
      }

      const newPolicy = await InsuranceService.createPatientInsurance(policyData);
      res.status(201).json(newPolicy);
    } catch (error) {
      next(error);
    }
  }

  public static async updatePolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const currentRole = req.user.role;
      const updates = { ...req.body };

      // Verification controls restrict to admin/receptionist/doctor
      if (updates.status === 'active' || updates.verifiedAt) {
        if (currentRole === 'patient') {
          throw new AppError('Unauthorized: only clinic staff can verify policies', 403);
        }
        updates.verifiedAt = new Date().toISOString();
        updates.verifiedBy = req.user.name || 'Staff';
      }

      const updated = InsuranceService.updatePatientInsurance(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  public static async deletePolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role === 'patient') {
        throw new AppError('Unauthorized: patients cannot delete insurance records', 403);
      }
      InsuranceService.deletePatientInsurance(req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // ================= CLAIMS CONTROLLER =================
  public static async getClaims(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let filterPatientId: number | undefined;
      if (req.user?.role === 'patient') {
        filterPatientId = req.user.id;
      } else if (req.query.patientId) {
        filterPatientId = parseInt(req.query.patientId as string);
      }

      const claims = await InsuranceService.getClaims(filterPatientId);
      res.json(claims);
    } catch (error) {
      next(error);
    }
  }

  public static async createClaim(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const claimData = { ...req.body };
      if (req.user.role === 'patient') {
        claimData.patientId = req.user.id;
      }

      const newClaim = await InsuranceService.createClaim(claimData);
      res.status(201).json(newClaim);
    } catch (error) {
      next(error);
    }
  }

  public static async updateClaim(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const updaterName = req.user.name || 'Anonymous';
      const updated = InsuranceService.updateClaim(req.params.id, req.body, updaterName);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteClaim(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      InsuranceService.deleteClaim(req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}
