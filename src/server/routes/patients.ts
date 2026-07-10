import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { PatientController } from '../controllers/patient.ts';

const router = Router();

// Apply auth and role-based checks globally for all Patient CRUD actions
router.use(requireAuth);
router.use(requireRoles(['admin', 'doctor', 'receptionist']));

// CRUD Route definitions
router.get('/', PatientController.getAll);
router.get('/:id', PatientController.getById);
router.post('/', PatientController.create);
router.put('/:id', PatientController.update);
router.delete('/:id', PatientController.delete);

export const patientsRouter = router;


