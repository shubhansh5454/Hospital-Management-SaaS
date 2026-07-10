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

      const start = startDate ? String(startDate) : undefined;
      const end = endDate ? String(endDate) : undefined;

      let data;
      switch (type) {
        case 'patient':
          data = await ReportsService.getPatientReport(start, end);
          break;
        case 'doctor':
          data = await ReportsService.getDoctorReport(start, end);
          break;
        case 'appointment':
          data = await ReportsService.getAppointmentReport(start, end);
          break;
        case 'billing':
          data = await ReportsService.getBillingReport(start, end);
          break;
        case 'pharmacy':
          data = await ReportsService.getPharmacyReport(start, end);
          break;
        case 'lab':
          data = await ReportsService.getLabReport(start, end);
          break;
        case 'inventory':
          data = await ReportsService.getInventoryReport(start, end);
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
