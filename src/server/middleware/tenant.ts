import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { prisma } from '../../db/prisma.ts';
import { logger } from '../utils/logger.ts';

export const tenantMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  try {
    // 1. Fetch user to get current tenant/clinic context from the database
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { tenantId: true, clinicId: true, role: true },
    });

    if (dbUser) {
      req.user.tenantId = dbUser.tenantId;
      req.user.clinicId = dbUser.clinicId;
    }

    // 2. Check for Tenant / Clinic Switching headers
    const tenantHeader = req.headers['x-tenant-id'] || req.headers['x-clinic-id'];

    if (tenantHeader) {
      const targetTenantId = parseInt(tenantHeader as string, 10);

      if (isNaN(targetTenantId)) {
        return res.status(400).json({ error: 'Tenant isolation: Invalid tenant identifier format' });
      }

      if (req.user.role === 'superadmin') {
        // Super Admin Switching Context
        const targetClinic = await prisma.clinic.findUnique({
          where: { id: targetTenantId },
          select: { id: true, tenantId: true, name: true },
        });

        if (!targetClinic) {
          return res.status(404).json({ error: `Tenant isolation: Requested clinic/tenant with ID ${targetTenantId} does not exist` });
        }

        // Apply switched context
        req.user.clinicId = targetClinic.id;
        req.user.tenantId = targetClinic.tenantId;

        logger.info(`Super Admin ${req.user.email} switched tenant context to Clinic ID ${targetClinic.id} (${targetClinic.name})`);
      } else {
        // Enforce strict isolation for non-superadmins
        if (req.user.clinicId !== targetTenantId) {
          logger.warn(`Security alert: User ${req.user.email} (Tenant: ${req.user.clinicId}) attempted to access Tenant ID ${targetTenantId}`);
          return res.status(403).json({
            error: 'Tenant isolation violation: Access denied. You do not belong to the requested tenant context.'
          });
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Error in tenantMiddleware resolution:', error);
    res.status(500).json({ error: 'Internal server error resolving tenant isolation' });
  }
};
