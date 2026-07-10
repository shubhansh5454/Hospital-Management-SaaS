import { Router } from 'express';
import { authRouter } from './auth.ts';
import { patientsRouter } from './patients.ts';
import { appointmentsRouter } from './appointments.ts';
import { doctorsRouter } from './doctors.ts';
import { emrRouter } from './emr.ts';
import { invoicesRouter } from './invoice.ts';
import { pharmacyRouter } from './pharmacy.ts';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/patients', patientsRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/doctors', doctorsRouter);
apiRouter.use('/emr', emrRouter);
apiRouter.use('/invoices', invoicesRouter);
apiRouter.use('/pharmacy', pharmacyRouter);

export default apiRouter;
