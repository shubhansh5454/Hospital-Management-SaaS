import { Response, NextFunction } from 'express';
import { FeatureFlagService } from '../services/featureFlags.ts';
import { SaasService } from '../services/saas.ts';
import { AppError } from './errorHandler.ts';

export function requireFeature(featureKey: 'ai_assistant' | 'laboratory' | 'reports' | 'backup' | 'inventory' | 'telehealth') {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        throw new AppError('Forbidden: No active clinic association.', 403);
      }

      const isAllowed = await FeatureFlagService.isFeatureEnabled(clinicId, featureKey);

      if (!isAllowed) {
        const subscription = await SaasService.getSubscription(clinicId);
        const planName = subscription?.planName || 'Free';
        
        let readableFeatureName = featureKey.replace('_', ' ');
        readableFeatureName = readableFeatureName.charAt(0).toUpperCase() + readableFeatureName.slice(1);
        if (featureKey === 'ai_assistant') readableFeatureName = 'AI Clinical Assistant';

        throw new AppError(
          `Feature limit exceeded: The "${readableFeatureName}" feature is currently disabled or is not available on your "${planName}" plan. Please upgrade your subscription in Settings.`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
