import { Router } from 'express';
import { v1AuthRouter } from './auth.ts';
import { v1PatientsRouter } from './patients.ts';
import { v1AppointmentsRouter } from './appointments.ts';
import { v1DoctorsRouter } from './doctors.ts';
import { v1UploadRouter } from './upload.ts';
import { v1DocsRouter } from './docs.ts';

const router = Router();

// Versioned Route Groupings
router.use('/auth', v1AuthRouter);
router.use('/patients', v1PatientsRouter);
router.use('/appointments', v1AppointmentsRouter);
router.use('/doctors', v1DoctorsRouter);
router.use('/upload', v1UploadRouter);
router.use('/docs', v1DocsRouter);

export const v1Router = router;
export default v1Router;
