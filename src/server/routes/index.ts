import { Router } from 'express';
import { authRouter } from './auth.ts';
import { patientsRouter } from './patients.ts';
import { appointmentsRouter } from './appointments.ts';
import { doctorsRouter } from './doctors.ts';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/patients', patientsRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/doctors', doctorsRouter);

export default apiRouter;
