import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { env } from './src/server/config/env.ts';
import { logger } from './src/server/utils/logger.ts';
import { requestLogger } from './src/server/middleware/requestLogger.ts';
import apiRouter from './src/server/routes/index.ts';
import { errorHandler } from './src/server/middleware/errorHandler.ts';

async function startServer() {
  const app = express();
  
  // Basic middlewares
  app.use(express.json());
  
  // Request execution logging middleware
  app.use(requestLogger);

  // Mount clean, modular API routes under /api prefix
  app.use('/api', apiRouter);

  // Vite development or production static asset server setup
  if (env.NODE_ENV !== 'production') {
    logger.info('Initializing Vite middleware in development mode...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    logger.info('Serving static dashboard assets in production mode...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler (must be placed after all other app.use() and routes calls)
  app.use(errorHandler);

  const PORT = parseInt(env.PORT, 10);
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🏥 Hospital SaaS Server running successfully on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  logger.error('Critical failure during server startup sequence:', err);
  process.exit(1);
});
