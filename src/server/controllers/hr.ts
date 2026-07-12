import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { HRService } from '../services/hr.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class HRController {
  
  // ================= DEPARTMENTS CONTROLLER =================
  public static async getDepartments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const depts = HRService.getDepartments();
      res.json(depts);
    } catch (error) {
      next(error);
    }
  }

  public static async createDepartment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized: Access restricted to administrative roles', 403);
      }
      const dept = HRService.createDepartment(req.body);
      res.status(201).json(dept);
    } catch (error) {
      next(error);
    }
  }

  public static async updateDepartment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      const updated = HRService.updateDepartment(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteDepartment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      HRService.deleteDepartment(req.params.id);
      res.json({ success: true, message: 'Department successfully removed' });
    } catch (error) {
      next(error);
    }
  }

  // ================= STAFF CONTROLLER =================
  public static async getStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffList = await HRService.getStaff();
      res.json(staffList);
    } catch (error) {
      next(error);
    }
  }

  public static async createStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      const staff = HRService.createStaff(req.body);
      res.status(201).json(staff);
    } catch (error) {
      next(error);
    }
  }

  public static async updateStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      const updated = HRService.updateStaff(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      HRService.deleteStaff(req.params.id);
      res.json({ success: true, message: 'Staff profile successfully removed' });
    } catch (error) {
      next(error);
    }
  }

  // ================= ATTENDANCE CONTROLLER =================
  public static async getAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.query.date as string;
      const att = HRService.getAttendance(date);
      res.json(att);
    } catch (error) {
      next(error);
    }
  }

  public static async getAllAttendanceLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const att = HRService.getAllAttendanceLogs();
      res.json(att);
    } catch (error) {
      next(error);
    }
  }

  public static async clockIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { staffId, clockInTime, notes } = req.body;
      const record = HRService.clockIn(staffId, clockInTime, notes);
      res.json(record);
    } catch (error) {
      next(error);
    }
  }

  public static async clockOut(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { staffId, clockOutTime } = req.body;
      const record = HRService.clockOut(staffId, clockOutTime);
      res.json(record);
    } catch (error) {
      next(error);
    }
  }

  public static async updateAttendanceBulk(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      HRService.updateAttendanceBulk(req.body.records);
      res.json({ success: true, message: 'Attendance records synchronized' });
    } catch (error) {
      next(error);
    }
  }

  // ================= LEAVES CONTROLLER =================
  public static async getLeaves(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const leaves = HRService.getLeaves();
      res.json(leaves);
    } catch (error) {
      next(error);
    }
  }

  public static async applyLeave(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const leave = HRService.applyLeave(req.body);
      res.status(201).json(leave);
    } catch (error) {
      next(error);
    }
  }

  public static async reviewLeave(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized: only HR administration can review leave requests', 403);
      }
      const reviewer = req.user?.name || 'Administrator';
      const { status, notes } = req.body;
      const reviewed = HRService.reviewLeave(req.params.id, status, reviewer, notes);
      res.json(reviewed);
    } catch (error) {
      next(error);
    }
  }

  // ================= SHIFTS CONTROLLER =================
  public static async getShifts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const shifts = HRService.getShifts();
      res.json(shifts);
    } catch (error) {
      next(error);
    }
  }

  public static async createShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      const shift = HRService.createShift(req.body);
      res.status(201).json(shift);
    } catch (error) {
      next(error);
    }
  }

  public static async updateShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      const updated = HRService.updateShift(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      HRService.deleteShift(req.params.id);
      res.json({ success: true, message: 'Shift schedule removed' });
    } catch (error) {
      next(error);
    }
  }

  // ================= PAYROLL CONTROLLER =================
  public static async getPayrolls(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const month = req.query.month as string;
      const pay = HRService.getPayrolls(month);
      res.json(pay);
    } catch (error) {
      next(error);
    }
  }

  public static async generatePayroll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      const { month } = req.body;
      if (!month) {
        throw new AppError('A valid Month (YYYY-MM) is required for payroll generation', 400);
      }
      const pay = HRService.generateMonthlyPayroll(month);
      res.json(pay);
    } catch (error) {
      next(error);
    }
  }

  public static async updatePayrollStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      const { status, paymentMethod, notes } = req.body;
      const pay = HRService.updatePayrollStatus(req.params.id, status, paymentMethod, notes);
      res.json(pay);
    } catch (error) {
      next(error);
    }
  }

  // ================= HOLIDAYS CONTROLLER =================
  public static async getHolidays(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hols = HRService.getHolidays();
      res.json(hols);
    } catch (error) {
      next(error);
    }
  }

  public static async createHoliday(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      const hol = HRService.createHoliday(req.body);
      res.status(201).json(hol);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteHoliday(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      HRService.deleteHoliday(req.params.id);
      res.json({ success: true, message: 'Holiday successfully removed' });
    } catch (error) {
      next(error);
    }
  }

  // ================= STAFF DOCUMENTS CONTROLLER =================
  public static async getStaffDocuments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffId = req.query.staffId as string;
      const docs = HRService.getStaffDocuments(staffId);
      res.json(docs);
    } catch (error) {
      next(error);
    }
  }

  public static async createStaffDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      const doc = HRService.addStaffDocument(req.body);
      res.status(201).json(doc);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteStaffDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        throw new AppError('Unauthorized', 403);
      }
      HRService.deleteStaffDocument(req.params.id);
      res.json({ success: true, message: 'Staff Document removed' });
    } catch (error) {
      next(error);
    }
  }
}
