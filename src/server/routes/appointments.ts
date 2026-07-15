import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { AppointmentController } from '../controllers/appointment.ts';

const router = Router();

// Apply requireAuth globally to ensure secure clinical data access
router.use(requireAuth);

/**
 * @route GET /api/appointments/doctors
 * @desc Retrieve list of physicians for appointment allocation dropdowns (Cached)
 * @access Private (authenticated users)
 */
router.get('/doctors', AppointmentController.getDoctors);

/**
 * @route GET /api/appointments
 * @desc Fetch appointments list based on user roles with support for filtering, sorting, search, and pagination
 * @access Private (role-specific scoping handled by Controller)
 */
router.get('/', AppointmentController.getAll);

/**
 * @route GET /api/appointments/:id
 * @desc Get details of a single appointment by ID
 * @access Private
 */
router.get('/:id', AppointmentController.getById);

/**
 * @route POST /api/appointments
 * @desc Create a new appointment slot with double-booking check validation
 * @access Private
 */
router.post('/', AppointmentController.create);

/**
 * @route PUT /api/appointments/:id
 * @desc Update appointment fields or status with availability conflict checks
 * @access Private
 */
router.put('/:id', AppointmentController.update);

/**
 * @route DELETE /api/appointments/:id
 * @desc Terminate/remove an appointment record
 * @access Private
 */
router.delete('/:id', AppointmentController.delete);

export const appointmentsRouter = router;
