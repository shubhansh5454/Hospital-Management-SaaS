import { Request, Response, NextFunction } from 'express';
import { performanceMetrics } from '../utils/metrics.ts';
import { logger } from '../utils/logger.ts';
import { prisma } from '../../db/prisma.ts';

// Helper to log security violations directly into the Database Audit Log
async function logSecurityIncident(req: Request, action: string, details: string) {
  try {
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown-ip').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';
    
    // Quick user-agent parser
    let browser = 'Unknown Browser';
    let device = 'Desktop';
    const uaLower = ua.toLowerCase();
    
    if (uaLower.includes('chrome')) browser = 'Chrome';
    else if (uaLower.includes('firefox')) browser = 'Firefox';
    else if (uaLower.includes('safari')) browser = 'Safari';
    else if (uaLower.includes('edge')) browser = 'Edge';
    
    if (uaLower.includes('iphone')) device = 'Mobile (iPhone)';
    else if (uaLower.includes('android')) device = 'Mobile (Android)';
    else if (uaLower.includes('ipad')) device = 'Tablet';

    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id || null,
        clinicId: (req as any).user?.clinicId || null,
        action,
        resource: 'security_sandbox',
        details,
        ipAddress: ip,
        device,
        browser,
      },
    });
  } catch (err) {
    logger.error('Failed to log security incident to AuditLog:', err);
  }
}

// ==========================================
// 1. SECURE HEADERS MIDDLEWARE
// ==========================================
export const secureHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove X-Powered-By
  res.removeHeader('X-Powered-By');
  
  // Set security-enhancing response headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Strict-Transport-Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  
  // Frame protection: Allow embedding in same origin and AI Studio workspace preview frames
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Content Security Policy (CSP) tailored for the application dashboard, charts, and preview
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: referrer",
    "connect-src 'self' wss: https:",
    "frame-src 'self' https://ai.studio https://*.google.com https://*.run.app",
    "frame-ancestors 'self' https://ai.studio https://*.google.com https://*.run.app",
    "media-src 'self' blob: data:"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', cspDirectives);
  
  // Permissions Policy: restrict powerful browser features except if requested
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), payment=()');
  
  next();
};

// ==========================================
// 2. RATE LIMITING MIDDLEWARE
// ==========================================
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const rateLimitStore: Record<string, RateLimitBucket> = {};
const cleanupInterval = 5 * 60 * 1000; // 5 minutes

// Periodic store cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const ip in rateLimitStore) {
    if (now - rateLimitStore[ip].lastRefill > 10 * 60 * 1000) {
      delete rateLimitStore[ip];
    }
  }
}, cleanupInterval).unref();

export const rateLimiter = (limitType: 'auth' | 'api' | 'public') => {
  // Configuration
  const limits = {
    auth: { capacity: 15, refillRate: 15 / 60000 },  // 15 requests per minute (token refill rate per ms)
    api: { capacity: 150, refillRate: 150 / 60000 }, // 150 requests per minute
    public: { capacity: 60, refillRate: 60 / 60000 } // 60 requests per minute
  };
  
  const { capacity, refillRate } = limits[limitType];
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Standard reverse proxy client IP detection
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown-ip').split(',')[0].trim();
    const key = `${limitType}:${ip}`;
    const now = Date.now();
    
    if (!rateLimitStore[key]) {
      rateLimitStore[key] = {
        tokens: capacity,
        lastRefill: now
      };
    }
    
    const bucket = rateLimitStore[key];
    const elapsedTime = now - bucket.lastRefill;
    
    // Add new tokens based on elapsed time
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedTime * refillRate);
    bucket.lastRefill = now;
    
    // Set headers
    res.setHeader('X-RateLimit-Limit', capacity);
    res.setHeader('X-RateLimit-Remaining', Math.floor(bucket.tokens));
    
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      next();
    } else {
      performanceMetrics.recordError(`Rate limit exceeded for IP: ${ip} on route ${req.originalUrl}`);
      logger.warn(`Rate limit triggered: ${ip} on path ${req.originalUrl}`);
      
      // Persistent audit logging for monitoring
      logSecurityIncident(req, 'SECURITY_RATE_LIMIT', `IP rate limit exceeded (${limitType} bucket) on path ${req.originalUrl}`);
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: `You have exceeded the request quota for this endpoint. Please try again in a moment.`,
        retryAfterSeconds: Math.ceil((1 - bucket.tokens) / (refillRate * 1000))
      });
    }
  };
};

// ==========================================
// 3. CSRF PROTECTION MIDDLEWARE (Origin Verification)
// ==========================================
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }
  
  const origin = req.headers.origin || req.headers.referer;
  const host = req.headers.host;
  
  if (origin && host) {
    // If origin is defined, verify it matches our host
    try {
      const originUrl = new URL(origin.startsWith('http') ? origin : `https://${origin}`);
      const originHost = originUrl.host;
      
      // Allow localhost, the server host, and standard sandbox preview URLs (.run.app)
      const isAllowed = 
        originHost === host || 
        originHost.includes('localhost') || 
        originHost.includes('127.0.0.1') || 
        originHost.endsWith('.run.app') ||
        originHost.endsWith('studio.google.com') ||
        originHost.endsWith('ai.studio');
        
      if (!isAllowed) {
        performanceMetrics.recordError(`CSRF Blocked: Origin ${originHost} does not match host ${host}`);
        logger.error(`Potential CSRF attack blocked. Request origin: ${originHost}, Host: ${host}`);
        
        // Persistent audit logging for monitoring
        logSecurityIncident(req, 'SECURITY_CSRF_BLOCKED', `CSRF Origin verification failed: Origin ${originHost} attempted to access host ${host}`);
        
        return res.status(403).json({
          error: 'CSRF Protection',
          message: 'Security Violation: Cross-Site Request Blocked. Verification failed.'
        });
      }
    } catch (e) {
      // Invalid URL in origin/referer - safe to block
      return res.status(400).json({ error: 'CSRF Protection: Invalid origin/referer format' });
    }
  }
  
  next();
};

// ==========================================
// 4. XSS SANITIZATION MIDDLEWARE
// ==========================================
const sanitizeString = (val: string): string => {
  if (typeof val !== 'string') return val;
  
  // Strip script tags and alert codes recursively
  return val
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove <script>...</script>
    .replace(/javascript\s*:/gi, '')                  // Remove javascript: uris
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')              // Remove inline event handlers like onload, onclick
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, (match) => {           // HTML escape tag characters safely
      return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });
};

const sanitizeObject = (obj: any): any => {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
};

export const xssSanitizer = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

// ==========================================
// 5. SQL INJECTION DEFENSE SYSTEM
// ==========================================
const SQL_INJECTION_PATTERNS = [
  /(\b(select|union|insert|update|delete|drop|alter|truncate|create)\b\s+.*?\b(from|into|table|where|values|join)\b)/gi,
  /('|")\s*(or|and)\s*('|")?\d+('|")?\s*=\s*('|")?\d+/gi, // ' OR '1'='1
  /(--|#|\/\*|\*\/)/g, // SQL Comments
  /\bEXEC(\s+|\()/gi,
  /UNION\s+ALL\s+SELECT/gi
];

export const sqlInjectionDefense = (req: Request, res: Response, next: NextFunction) => {
  const checkValue = (val: any): boolean => {
    if (typeof val === 'string') {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(val)) {
          // Double check if it's a false positive on safe strings
          // Allow simple SELECT statements for telemetry dashboard or system executions
          if (req.path.startsWith('/api/monitoring') && val.toUpperCase() === 'SELECT 1') {
            continue;
          }
          return true; // Match found
        }
      }
    } else if (val && typeof val === 'object') {
      for (const k in val) {
        if (Object.prototype.hasOwnProperty.call(val, k)) {
          if (checkValue(val[k])) return true;
        }
      }
    }
    return false;
  };

  const hasAttack = checkValue(req.body) || checkValue(req.query) || checkValue(req.params);
  
  if (hasAttack) {
    performanceMetrics.recordError(`SQL Injection Attempt Blocked from IP ${req.ip} on path ${req.originalUrl}`);
    logger.error(`🚨 Security Alert: Blocked SQL Injection pattern on path ${req.originalUrl} from IP ${req.ip}`);
    
    // Persistent audit logging for monitoring
    logSecurityIncident(req, 'SECURITY_SQL_INJECTION', `SQL Injection pattern matched on endpoint ${req.originalUrl}`);
    
    return res.status(403).json({
      error: 'Security Exception',
      message: 'Malicious payload detected: SQL Injection attempt blocked by system IPS.'
    });
  }
  
  next();
};

// ==========================================
// 6. COOKIE SECURITY CONFIGURATOR (FOR EXPRESS RESPONSES)
// ==========================================
export const secureCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};
