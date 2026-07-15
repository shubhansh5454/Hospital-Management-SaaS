import { Router } from 'express';
import { v2AuthRouter } from './auth.ts';
import { v2PatientsRouter } from './patients.ts';
import { v2AppointmentsRouter } from './appointments.ts';
import { v2DocsRouter } from './docs.ts';

const router = Router();

// Version 2 Sub-Routers Mounting
router.use('/auth', v2AuthRouter);
router.use('/patients', v2PatientsRouter);
router.use('/appointments', v2AppointmentsRouter);
router.use('/docs', v2DocsRouter);

// High-level service registry mapping
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    apiVersion: '2.0.0',
    services: {
      auth: '/api/v2/auth',
      patients: '/api/v2/patients',
      appointments: '/api/v2/appointments',
      docs: '/api/v2/docs'
    }
  });
});

export const v2Router = router;
export default v2Router;
