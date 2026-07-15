import { Router, Request, Response, NextFunction } from 'express';
import os from 'os';
import { prisma } from '../../db/prisma.ts';
import { performanceMetrics } from '../utils/metrics.ts';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';

const router = Router();

// Track event loop delay
let eventLoopLag = 0;
const startLoop = Date.now();
setInterval(() => {
  const now = Date.now();
  eventLoopLag = Math.max(0, now - startLoop - 1000); // 1-second interval
}, 1000).unref();

/**
 * Helper to measure DB query speed
 */
async function getDbQueryLatency(): Promise<number> {
  const start = Date.now();
  await prisma.$executeRawUnsafe('SELECT 1');
  return Date.now() - start;
}

/**
 * @route GET /api/monitoring/live
 * @desc Liveness Check - lightweight ping to verify container/process is running.
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * @route GET /api/monitoring/ready
 * @desc Readiness Check - verifies that downstream systems (Database) are connected.
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const latency = await getDbQueryLatency();
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'CONNECTED',
          latencyMs: latency,
        },
      },
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'DISCONNECTED',
          error: err.message || 'Unable to ping PostgreSQL',
        },
      },
    });
  }
});

/**
 * @route GET /api/monitoring/health
 * @desc Full Health Check - aggregates database, system, and queue metrics.
 */
router.get('/health', async (req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  let dbStatus: 'UP' | 'DOWN' = 'UP';
  let dbLatency = 0;
  let dbError: string | undefined;

  try {
    dbLatency = await getDbQueryLatency();
  } catch (err: any) {
    dbStatus = 'DOWN';
    dbError = err.message || 'Database ping failed';
  }

  // Get Queue health
  let lobbyQueueWaiting = 0;
  let failedNotificationsCount = 0;
  try {
    lobbyQueueWaiting = await prisma.queueToken.count({ where: { status: 'WAITING' } });
    failedNotificationsCount = await prisma.notification.count({ where: { status: 'FAILED' } });
  } catch (qErr) {
    // Suppress db fetch errors if db is already DOWN
  }

  const memoryUsage = process.memoryUsage();
  const cpuCount = os.cpus().length;
  const loadAvg = os.loadavg();

  const isHealthy = dbStatus === 'UP';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'UP' : 'DEGRADED',
    timestamp,
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
        ...(dbError && { error: dbError }),
      },
      queues: {
        lobbyTokensWaiting: lobbyQueueWaiting,
        notificationFailures: failedNotificationsCount,
        status: 'UP'
      },
      system: {
        memoryHeapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        memoryHeapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        cpuCores: cpuCount,
        loadAverage1m: loadAvg[0],
        eventLoopLagMs: eventLoopLag
      }
    }
  });
});

/**
 * Advanced routes (Requires Admin Auth for production telemetry panel)
 */

/**
 * @route GET /api/monitoring/metrics
 * @desc Get real-time process details and cumulative request metrics
 */
router.get('/metrics', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memory = process.memoryUsage();
    const loadAvg = os.loadavg();
    const systemSummary = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      loadAverage: {
        '1m': loadAvg[0],
        '5m': loadAvg[1],
        '15m': loadAvg[2]
      },
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024),
        systemFree: Math.round(os.freemem() / 1024 / 1024),
        systemTotal: Math.round(os.totalmem() / 1024 / 1024),
      },
      uptime: process.uptime(),
      eventLoopLagMs: eventLoopLag
    };

    res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      system: systemSummary,
      requests: performanceMetrics.getSummary()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/monitoring/db
 * @desc Database health statistics, execution speed, and table records count
 */
router.get('/db', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const start = Date.now();
    await prisma.$executeRawUnsafe('SELECT 1');
    const latency = Date.now() - start;

    // Fetch dynamic table metadata aggregates for enterprise visibility
    const [
      patientsCount,
      usersCount,
      appointmentsCount,
      clinicsCount,
      auditLogsCount,
    ] = await Promise.all([
      prisma.patient.count().catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.appointment.count().catch(() => 0),
      prisma.clinic.count().catch(() => 0),
      prisma.auditLog.count().catch(() => 0),
    ]);

    res.status(200).json({
      status: 'success',
      database: {
        provider: 'postgresql',
        status: 'CONNECTED',
        latencyMs: latency,
        aggregates: {
          patientsCount,
          usersCount,
          appointmentsCount,
          clinicsCount,
          auditLogsCount
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      database: {
        status: 'DISCONNECTED',
        error: error.message || 'Database is unreachable'
      }
    });
  }
});

/**
 * @route GET /api/monitoring/queues
 * @desc Queue health: Lobby Wait Tokens and Message Notifications backlog
 */
router.get('/queues', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Lobby Waiting Queue metrics
    const [
      totalTokens,
      waitingTokens,
      callingTokens,
      completedTokens,
      skippedTokens
    ] = await Promise.all([
      prisma.queueToken.count().catch(() => 0),
      prisma.queueToken.count({ where: { status: 'WAITING' } }).catch(() => 0),
      prisma.queueToken.count({ where: { status: 'CALLING' } }).catch(() => 0),
      prisma.queueToken.count({ where: { status: 'COMPLETED' } }).catch(() => 0),
      prisma.queueToken.count({ where: { status: 'SKIPPED' } }).catch(() => 0),
    ]);

    // Compute lobby queue congestion rating
    let queueCongestionLevel: 'NORMAL' | 'MODERATE' | 'HIGH' = 'NORMAL';
    if (waitingTokens > 15) {
      queueCongestionLevel = 'HIGH';
    } else if (waitingTokens > 5) {
      queueCongestionLevel = 'MODERATE';
    }

    // 2. Notification Dispatch Queue metrics
    const [
      totalNotifications,
      pendingNotifications,
      sentNotifications,
      deliveredNotifications,
      failedNotifications,
    ] = await Promise.all([
      prisma.notification.count().catch(() => 0),
      prisma.notification.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.notification.count({ where: { status: 'SENT' } }).catch(() => 0),
      prisma.notification.count({ where: { status: 'DELIVERED' } }).catch(() => 0),
      prisma.notification.count({ where: { status: 'FAILED' } }).catch(() => 0),
    ]);

    // Calculate delivery success rate
    const totalProcessed = sentNotifications + deliveredNotifications + failedNotifications;
    const deliverySuccessRate = totalProcessed > 0
      ? Math.round(((sentNotifications + deliveredNotifications) / totalProcessed) * 100)
      : 100;

    res.status(200).json({
      status: 'success',
      lobbyQueue: {
        totalTokens,
        waiting: waitingTokens,
        calling: callingTokens,
        completed: completedTokens,
        skipped: skippedTokens,
        congestionLevel: queueCongestionLevel,
      },
      notificationQueue: {
        total: totalNotifications,
        pending: pendingNotifications,
        sent: sentNotifications,
        delivered: deliveredNotifications,
        failed: failedNotifications,
        successRatePercentage: deliverySuccessRate,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/monitoring/errors
 * @desc Get list of recent server error logs from in-memory accumulator
 */
router.get('/errors', requireAuth, (req: Request, res: Response) => {
  const summary = performanceMetrics.getSummary();
  res.status(200).json({
    status: 'success',
    recentErrors: summary.recentErrors
  });
});

export const monitoringRouter = router;
export default monitoringRouter;
