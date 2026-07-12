import { Router } from 'express';
import { authRouter } from './auth.ts';
import { patientsRouter } from './patients.ts';
import { appointmentsRouter } from './appointments.ts';
import { doctorsRouter } from './doctors.ts';
import { emrRouter } from './emr.ts';
import { invoicesRouter } from './invoice.ts';
import { pharmacyRouter } from './pharmacy.ts';
import { labRouter } from './lab.ts';
import { inventoryRouter } from './inventory.ts';
import { receptionRouter } from './reception.ts';
import { dashboardRouter } from './dashboard.ts';
import { notificationRouter } from './notification.ts';
import { reportsRouter } from './reports.ts';
import { saasRouter } from './saas.ts';
import { rolesRouter } from './roles.ts';
import { filesRouter } from './files.ts';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/patients', patientsRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/doctors', doctorsRouter);
apiRouter.use('/emr', emrRouter);
apiRouter.use('/invoices', invoicesRouter);
apiRouter.use('/pharmacy', pharmacyRouter);
apiRouter.use('/lab', labRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/reception', receptionRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/saas', saasRouter);
apiRouter.use('/roles', rolesRouter);
apiRouter.use('/files', filesRouter);



export default apiRouter;
