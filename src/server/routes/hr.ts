import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { HRController } from '../controllers/hr.ts';

const router = Router();

router.use(requireAuth);

// Departments
router.get('/departments', HRController.getDepartments);
router.post('/departments', HRController.createDepartment);
router.put('/departments/:id', HRController.updateDepartment);
router.delete('/departments/:id', HRController.deleteDepartment);

// Staff
router.get('/staff', HRController.getStaff);
router.post('/staff', HRController.createStaff);
router.put('/staff/:id', HRController.updateStaff);
router.delete('/staff/:id', HRController.deleteStaff);

// Attendance
router.get('/attendance', HRController.getAttendance);
router.get('/attendance/all', HRController.getAllAttendanceLogs);
router.post('/attendance/clock-in', HRController.clockIn);
router.post('/attendance/clock-out', HRController.clockOut);
router.post('/attendance/bulk', HRController.updateAttendanceBulk);

// Leave Requests
router.get('/leaves', HRController.getLeaves);
router.post('/leaves', HRController.applyLeave);
router.put('/leaves/:id/review', HRController.reviewLeave);

// Shifts
router.get('/shifts', HRController.getShifts);
router.post('/shifts', HRController.createShift);
router.put('/shifts/:id', HRController.updateShift);
router.delete('/shifts/:id', HRController.deleteShift);

// Payroll
router.get('/payroll', HRController.getPayrolls);
router.post('/payroll/generate', HRController.generatePayroll);
router.put('/payroll/:id', HRController.updatePayrollStatus);

// Holiday Calendar
router.get('/holidays', HRController.getHolidays);
router.post('/holidays', HRController.createHoliday);
router.delete('/holidays/:id', HRController.deleteHoliday);

// Staff Documents
router.get('/documents', HRController.getStaffDocuments);
router.post('/documents', HRController.createStaffDocument);
router.delete('/documents/:id', HRController.deleteStaffDocument);

export const hrRouter = router;
