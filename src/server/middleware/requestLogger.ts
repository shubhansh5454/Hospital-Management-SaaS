import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.ts';
import { performanceMetrics } from '../utils/metrics.ts';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms`;
    
    // Track in our telemetry collector
    performanceMetrics.recordRequest(req.method, req.originalUrl, res.statusCode, duration);

    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
};
