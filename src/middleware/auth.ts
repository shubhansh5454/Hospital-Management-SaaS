import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import { verifyAccessToken } from '../server/utils/jwt.ts';
import { prisma } from '../db/prisma.ts';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    uid: string;
    email: string;
    name: string;
    role: 'superadmin' | 'admin' | 'doctor' | 'receptionist' | 'patient';
    clinicId?: number | null;
    tenantId?: number | null;
  };
}

export const resolveTenant = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next();
    }

    // Fetch the freshest tenantId and clinicId from the database
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { tenantId: true, clinicId: true, role: true },
    });

    if (dbUser) {
      req.user.tenantId = dbUser.tenantId;
      req.user.clinicId = dbUser.clinicId;
    }

    // Check for Tenant / Clinic Switching headers (both case sensitivities)
    const tenantHeader = req.headers['x-tenant-id'] || 
                         req.headers['x-clinic-id'] || 
                         req.headers['X-Tenant-ID'] || 
                         req.headers['X-Clinic-ID'];

    if (tenantHeader) {
      const targetTenantId = parseInt(tenantHeader as string, 10);
      if (isNaN(targetTenantId)) {
        return res.status(400).json({ error: 'Tenant Isolation: Invalid tenant identifier format' });
      }

      if (req.user.role === 'superadmin') {
        // Super Admin Tenant Switching: override active tenant context
        const targetClinic = await prisma.clinic.findUnique({
          where: { id: targetTenantId },
          select: { id: true, tenantId: true },
        });

        if (!targetClinic) {
          return res.status(404).json({ error: `Tenant Isolation: Switched clinic/tenant with ID ${targetTenantId} does not exist` });
        }

        req.user.clinicId = targetClinic.id;
        req.user.tenantId = targetClinic.tenantId;
      } else {
        // Strict Isolation: standard users must match the target context exactly
        if (req.user.clinicId !== targetTenantId) {
          return res.status(403).json({
            error: 'Tenant isolation violation: Access denied. You do not belong to the requested tenant context.'
          });
        }
      }
    }

    // 3. Enforce onboarding: Non-superadmin users without an active clinic/tenant context must onboard first
    if (req.user.role !== 'superadmin' && !req.user.clinicId) {
      const allowedPaths = [
        '/api/saas/register',
        '/api/auth',
        '/api/v1/auth',
        '/saas/register',
        '/auth',
        '/v1/auth'
      ];

      const isAllowed = allowedPaths.some(p => req.originalUrl.startsWith(p));
      if (!isAllowed) {
        return res.status(403).json({
          error: 'Tenant onboarding required: You must register or join a clinic first to access this resource.',
          onboardingRequired: true
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error resolving tenant context:', error);
    res.status(500).json({ error: 'Internal server error resolving tenant context' });
  }
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    // 1. Try local custom JWT authentication first
    try {
      const decodedLocal = verifyAccessToken(token);
      const dbUser = await prisma.user.findUnique({
        where: { id: decodedLocal.id },
      });

      if (dbUser) {
        req.user = {
          id: dbUser.id,
          uid: dbUser.uid,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role as any,
          clinicId: dbUser.clinicId,
          tenantId: dbUser.tenantId,
        };
        return resolveTenant(req, res, next);
      }
    } catch (localJwtError) {
      // If verification failed because it's not a valid local JWT, fall through to Firebase verification
    }

    // 2. Fallback to Firebase authentication
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Sync with PostgreSQL
    const email = decodedToken.email || '';
    const name = decodedToken.name || email.split('@')[0] || 'User';
    const dbUser = await getOrCreateUser(decodedToken.uid, email, name);

    req.user = {
      id: dbUser.id,
      uid: dbUser.uid,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as any,
      clinicId: dbUser.clinicId,
      tenantId: dbUser.tenantId,
    };

    return resolveTenant(req, res, next);
  } catch (error) {
    console.error('Error verifying token or syncing user:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token or user profile out of sync' });
  }
};

// Role authorization checks
export const requireRoles = (allowedRoles: ('superadmin' | 'admin' | 'doctor' | 'receptionist' | 'patient')[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User identity not verified' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Access restricted to roles: [${allowedRoles.join(', ')}]` });
    }
    
    next();
  };
};

import { RolesService } from '../server/services/roles.ts';

/**
 * Enterprise permission middleware. Automatically checks user custom roles and direct overrides.
 */
export const requirePermission = (permissionCode: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User identity not verified' });
    }

    try {
      // Superadmins have full root access to everything
      if (req.user.role === 'superadmin') {
        return next();
      }

      const permissions = await RolesService.getUserPermissions(req.user.id, req.user.clinicId || null);
      const perm = permissions.find(p => p.code === permissionCode);

      if (!perm || !perm.allowed) {
        // Log access denied audit log
        await RolesService.logAudit(
          req.user.id,
          req.user.clinicId || null,
          'ACCESS_DENIED',
          permissionCode,
          `User attempted to access an API requiring permission: ${permissionCode}`,
          req.ip
        );

        return res.status(403).json({
          error: `Forbidden: You do not have the required permission (${permissionCode}) to perform this action.`
        });
      }

      next();
    } catch (error) {
      console.error(`Permission check error for ${permissionCode}:`, error);
      res.status(500).json({ error: 'Internal server error checking permissions' });
    }
  };
};
