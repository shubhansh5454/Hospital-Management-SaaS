import { Request, Response, NextFunction } from 'express';
import { ReportsService } from '../services/reports.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class ReportsController {
  /**
   * Get specific report type
   */
  public static async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;
      const { startDate, endDate } = req.query;
      const user = (req as any).user;

      const start = startDate ? String(startDate) : undefined;
      const end = endDate ? String(endDate) : undefined;

      let clinicId: number | undefined = undefined;
      if (user?.role !== 'superadmin') {
        clinicId = user?.clinicId || undefined;
      } else if (req.query.clinicId) {
        clinicId = parseInt(req.query.clinicId as string, 10);
      }

      let data;
      switch (type) {
        case 'patient':
          data = await ReportsService.getPatientReport(clinicId, start, end);
          break;
        case 'doctor':
          data = await ReportsService.getDoctorReport(clinicId, start, end);
          break;
        case 'appointment':
          data = await ReportsService.getAppointmentReport(clinicId, start, end);
          break;
        case 'billing':
          data = await ReportsService.getBillingReport(clinicId, start, end);
          break;
        case 'pharmacy':
          data = await ReportsService.getPharmacyReport(clinicId, start, end);
          break;
        case 'lab':
          data = await ReportsService.getLabReport(clinicId, start, end);
          break;
        case 'inventory':
          data = await ReportsService.getInventoryReport(clinicId, start, end);
          break;
        default:
          throw new AppError(`Invalid report type: ${type}`, 400);
      }

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}
