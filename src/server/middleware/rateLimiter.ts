import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.ts';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime <= now) {
      delete store[key];
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}

/**
 * Factory to create rate-limiting Express middlewares
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message = 'Too many requests, please try again later.', keyPrefix = 'rl' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Generate unique key based on client IP and optional prefix
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown-ip';
    const key = `${keyPrefix}:${ip}:${req.path}`;
    const now = Date.now();

    if (!store[key] || store[key].resetTime <= now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
    } else {
      store[key].count += 1;
    }

    const currentLimit = store[key];
    const remaining = Math.max(0, max - currentLimit.count);
    const resetTimeSeconds = Math.ceil((currentLimit.resetTime - now) / 1000);

    // Set standard rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

    if (currentLimit.count > max) {
      res.setHeader('Retry-After', resetTimeSeconds);
      next(new AppError(message, 429));
      return;
    }

    next();
  };
}

// Default standard rate limit: 100 requests per 1 minute
export const standardRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP. Please try again in a minute.',
  keyPrefix: 'standard',
});

// Strict rate limit for auth endpoints: 15 requests per 15 minutes
export const strictAuthRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  keyPrefix: 'auth',
});

// Moderate rate limit for resource creation and file uploads: 30 requests per 5 minutes
export const writeRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Too many creation/upload requests. Please wait a few minutes.',
  keyPrefix: 'write',
});
