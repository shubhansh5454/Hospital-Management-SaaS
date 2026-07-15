import { Request, Response, NextFunction } from 'express';

export interface DeprecationOptions {
  sunsetDate?: string; // e.g., "2027-01-01"
  successorUrl?: string; // e.g., "/api/v2/patients"
  message?: string;
}

/**
 * Middleware to inject RFC-compliant API Deprecation & Sunset headers.
 * Aligns with the IETF standards for Deprecation and Sunset headers.
 */
export function deprecateApi(options: DeprecationOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Indicate that the API is deprecated
    res.setHeader('Deprecation', 'true');
    
    // Set 'Sunset' date if specified
    if (options.sunsetDate) {
      const date = new Date(options.sunsetDate);
      if (!isNaN(date.getTime())) {
        res.setHeader('Sunset', date.toUTCString());
      }
    }
    
    // Set 'Link' header to redirect clients to successor versions
    if (options.successorUrl) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fullSuccessorUrl = options.successorUrl.startsWith('http') 
        ? options.successorUrl 
        : `${baseUrl}${options.successorUrl}`;
      res.setHeader('Link', `<${fullSuccessorUrl}>; rel="successor-version"`);
    }

    // Set standard HTTP Warning header
    const host = req.get('host') || 'localhost';
    const warningMsg = options.message || 'This API version is deprecated and will be retired. Please upgrade to the successor version.';
    res.setHeader('Warning', `299 ${host} "${warningMsg}"`);

    // We can also inject deprecation metadata into response headers or bodies (optional)
    next();
  };
}
