import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { DoctorService } from '../services/doctor.ts';
import { createDoctorSchema, updateDoctorSchema, scheduleSchema, leaveSchema } from '../validation/doctor.ts';

const router = Router();

// Get unique specializations list (must be before /:id)
router.get('/specializations', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const specializations = await DoctorService.getSpecializations();
    res.json(specializations);
  } catch (error) {
    next(error);
  }
});

// List Doctors with Search and Pagination
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const search = req.query.search as string | undefined;
    const specialization = req.query.specialization as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const result = await DoctorService.getAllDoctors({
      search,
      specialization,
      page,
      limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get Doctor by ID
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const doctor = await DoctorService.getDoctorById(id);
    res.json(doctor);
  } catch (error) {
    next(error);
  }
});

// Create a new Doctor (Admin or Receptionist role typically)
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const validated = createDoctorSchema.parse(req.body);
    const doctor = await DoctorService.createDoctor(validated);
    res.status(201).json(doctor);
  } catch (error) {
    next(error);
  }
});

// Update an existing Doctor
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const validated = updateDoctorSchema.parse(req.body);
    const doctor = await DoctorService.updateDoctor(id, validated);
    res.json(doctor);
  } catch (error) {
    next(error);
  }
});

// Delete a Doctor
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await DoctorService.deleteDoctor(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Add a Schedule to Doctor Profile
router.post('/:id/schedules', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const doctorId = parseInt(req.params.id, 10);
    const validated = scheduleSchema.parse(req.body);
    const schedule = await DoctorService.addSchedule(doctorId, validated);
    res.status(201).json(schedule);
  } catch (error) {
    next(error);
  }
});

// Delete a Schedule from Doctor Profile
router.delete('/:id/schedules/:scheduleId', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const doctorId = parseInt(req.params.id, 10);
    const scheduleId = parseInt(req.params.scheduleId, 10);
    const result = await DoctorService.deleteSchedule(doctorId, scheduleId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Add a Leave Record
router.post('/:id/leaves', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const doctorId = parseInt(req.params.id, 10);
    const validated = leaveSchema.parse(req.body);
    const leave = await DoctorService.addLeave(doctorId, validated);
    res.status(201).json(leave);
  } catch (error) {
    next(error);
  }
});

// Delete a Leave Record
router.delete('/:id/leaves/:leaveId', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const doctorId = parseInt(req.params.id, 10);
    const leaveId = parseInt(req.params.leaveId, 10);
    const result = await DoctorService.deleteLeave(doctorId, leaveId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export const doctorsRouter = router;
