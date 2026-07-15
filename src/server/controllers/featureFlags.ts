import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { FeatureFlagService } from '../services/featureFlags.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class FeatureFlagController {
  /**
   * Get features evaluated for the currently logged-in user's clinic
   */
  public static async getClinicFeatureFlags(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        // If no clinic is associated yet (onboarding), return empty list or defaults
        return res.json([]);
      }

      const features = await FeatureFlagService.getFeaturesForClinic(clinicId);
      res.status(200).json(features);
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all feature flags with full configurations (Super Admin only)
   */
  public static async getAllFeatureFlags(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const flags = await FeatureFlagService.listFeatureFlags();
      res.status(200).json(flags);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a global toggle or enabled plans list (Super Admin only)
   */
  public static async updateFeatureFlag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const { globallyEnabled, plansEnabled } = req.body;

      if (globallyEnabled === undefined && !plansEnabled) {
        throw new AppError('Missing globallyEnabled or plansEnabled in request body', 400);
      }

      const updated = await FeatureFlagService.updateFeatureFlag(key, {
        globallyEnabled,
        plansEnabled,
      });

      res.status(200).json({
        status: 'success',
        message: `Feature flag "${key}" updated successfully.`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set or clear a tenant override (Super Admin only)
   */
  public static async setTenantOverride(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const { clinicId, overrideState } = req.body;

      if (clinicId === undefined || overrideState === undefined) {
        throw new AppError('Missing clinicId or overrideState (boolean or null) in request body', 400);
      }

      const updated = await FeatureFlagService.setTenantOverride(
        key,
        parseInt(clinicId, 10),
        overrideState
      );

      res.status(200).json({
        status: 'success',
        message: `Tenant override set for clinic ${clinicId} on feature "${key}".`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}
