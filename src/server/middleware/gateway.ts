import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.ts';
import { performanceMetrics } from '../utils/metrics.ts';

// In-Memory Simple Cache for Gateway Caching
const gatewayCache: Record<string, { body: any; expiry: number; headers: Record<string, string> }> = {};

/**
 * API Gateway & Observability Orchestrator Middleware
 */
export function apiGatewayOrchestrator(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime();

  // 1. Correlation ID (Distributed Tracing / Trace Parent)
  let correlationId = req.header('X-Correlation-Id') || req.header('x-request-id');
  if (!correlationId) {
    correlationId = `corr-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
  
  // Attach correlation ID to both request context and response headers
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  // 2. Gateway API Version Routing Header
  const pathParts = req.path.split('/');
  const versionSegment = pathParts.find(p => /^v[1-9]$/.test(p)) || 'v1';
  res.setHeader('X-API-Version', versionSegment);

  // 3. Simple Gateway Caching logic for GET requests
  const cacheKey = `${req.method}:${req.originalUrl}`;
  const now = Date.now();
  
  // Automatic Cache Invalidation for State-Modifying operations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const pathParts = req.path.split('/').filter(p => p && p !== 'api');
    pathParts.forEach(part => {
      invalidateGatewayCache(part);
    });
  }
  
  if (req.method === 'GET' && gatewayCache[cacheKey] && gatewayCache[cacheKey].expiry > now) {
    logger.info(`[API Gateway] Cache HIT on: ${cacheKey} (Correlation ID: ${correlationId})`);
    res.setHeader('X-Cache', 'HIT');
    
    // Set cached headers
    Object.entries(gatewayCache[cacheKey].headers).forEach(([k, v]) => {
      res.setHeader(k, v);
    });
    
    res.status(200).json(gatewayCache[cacheKey].body);
    return;
  }

  res.setHeader('X-Cache', 'MISS');

  // Override res.send / res.json to capture response payload for caching and profiling
  const originalJson = res.json;
  res.json = function (body: any): Response {
    // Save to cache if it's a safe queryable GET endpoint
    if (req.method === 'GET' && (req.originalUrl.includes('/settings') || req.originalUrl.includes('/templates') || req.originalUrl.includes('/integrations'))) {
      gatewayCache[cacheKey] = {
        body,
        expiry: Date.now() + 1000 * 15, // Cache for 15 seconds
        headers: {
          'Content-Type': 'application/json'
        }
      };
    }
    return originalJson.call(this, body);
  };

  // 4. Hook response finish event for Observability and Metrics
  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    // Track slow queries/requests (Slow response threshold: 500ms)
    if (durationMs > 500) {
      logger.warn(`⚠️ [Slow Query Alert] Slow request detected! Method: ${req.method} | URL: ${req.originalUrl} | Duration: ${durationMs}ms | Code: ${res.statusCode} | CorrID: ${correlationId}`);
    }

    // Record Metrics telemetry
    performanceMetrics.recordRequest(req.method, req.originalUrl, res.statusCode, durationMs);

    // Structured logging with context correlation IDs
    logger.info(`[Gateway Router] HTTP ${req.method} ${req.originalUrl}`, {
      correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      apiVersion: versionSegment,
      userAgent: req.header('user-agent') || 'Unknown'
    });
  });

  next();
}

/**
 * Flush cache helper for state modifying actions (POST/PUT/DELETE)
 */
export function invalidateGatewayCache(pathSnippet: string) {
  Object.keys(gatewayCache).forEach(key => {
    if (key.includes(pathSnippet)) {
      delete gatewayCache[key];
      logger.info(`[API Gateway] Cache invalidated for: ${key}`);
    }
  });
}
