import { Router } from 'express';
import { prisma } from '../../db/prisma.ts';
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
import { aiRouter } from './ai.ts';
import { aiCdsRouter } from './aiCds.ts';
import { videoRouter } from './video.ts';
import { insuranceRouter } from './insurance.ts';
import { hrRouter } from './hr.ts';
import { backupRouter } from './backup.ts';
import { portalRouter } from './portal.ts';
import { searchRouter } from './search.ts';
import { settingsRouter } from './settings.ts';
import { v1Router } from './v1/index.ts';
import { v2Router } from './v2/index.ts';
import { featureRouter } from './features.ts';
import { monitoringRouter } from './monitoring.ts';

const apiRouter = Router();

// Health Check Endpoint (DB connectivity, uptime, memory, status)
apiRouter.get('/health', async (req, res) => {
  const healthData: {
    status: 'UP' | 'DOWN' | 'DEGRADED';
    timestamp: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    database: { status: 'CONNECTED' | 'DISCONNECTED'; error?: string };
  } = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: { status: 'DISCONNECTED' }
  };

  try {
    // Run simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    healthData.database.status = 'CONNECTED';
  } catch (err: any) {
    healthData.status = 'DEGRADED';
    healthData.database.status = 'DISCONNECTED';
    healthData.database.error = err.message || 'Database connection error';
  }

  const statusCode = healthData.status === 'UP' ? 200 : 503;
  res.status(statusCode).json(healthData);
});

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
apiRouter.use('/ai', aiRouter);
apiRouter.use('/cds', aiCdsRouter);
apiRouter.use('/video', videoRouter);
apiRouter.use('/insurance', insuranceRouter);
apiRouter.use('/hr', hrRouter);
apiRouter.use('/backup', backupRouter);
apiRouter.use('/portal', portalRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/v1', v1Router);
apiRouter.use('/v2', v2Router);
apiRouter.use('/features', featureRouter);
apiRouter.use('/monitoring', monitoringRouter);

export default apiRouter;
