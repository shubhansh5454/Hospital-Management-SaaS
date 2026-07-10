import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { EmrController } from '../controllers/emr.ts';

const router = Router();

// Secure all EMR endpoints with token verification
router.use(requireAuth);

router.post('/', EmrController.create);
router.get('/patient/:patientId', EmrController.getByPatientId);
router.get('/:id', EmrController.getById);
router.put('/:id', EmrController.update);
router.delete('/:id', EmrController.delete);

export const emrRouter = router;
