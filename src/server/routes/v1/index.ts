import { Router } from 'express';
import { v1AuthRouter } from './auth.ts';
import { v1PatientsRouter } from './patients.ts';
import { v1AppointmentsRouter } from './appointments.ts';
import { v1DoctorsRouter } from './doctors.ts';
import { v1UploadRouter } from './upload.ts';
import { v1DocsRouter } from './docs.ts';
import { v1PaymentsRouter } from './payments.ts';
import { deprecateApi } from '../../middleware/deprecation.ts';

const router = Router();

// Inject HTTP header-based API deprecation and sunset policies for all V1 client queries
router.use(deprecateApi({
  sunsetDate: '2027-12-31',
  successorUrl: '/api/v2',
  message: 'API v1 is deprecated and will be sunset on 2027-12-31. Please upgrade your application to v2.'
}));

// Versioned Route Groupings
router.use('/auth', v1AuthRouter);
router.use('/patients', v1PatientsRouter);
router.use('/appointments', v1AppointmentsRouter);
router.use('/doctors', v1DoctorsRouter);
router.use('/upload', v1UploadRouter);
router.use('/docs', v1DocsRouter);
router.use('/payments', v1PaymentsRouter);

export const v1Router = router;
export default v1Router;
