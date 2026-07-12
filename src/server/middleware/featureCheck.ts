import { Response, NextFunction } from 'express';
import { SaasService } from '../services/saas.ts';
import { AppError } from './errorHandler.ts';

export function requireFeature(featureKey: 'ai_assistant' | 'laboratory' | 'reports' | 'backup') {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        throw new AppError('Forbidden: No active clinic association.', 403);
      }

      const activeSub = await SaasService.getSubscription(clinicId);
      const planName = activeSub?.planName || 'Free';

      let allowed = false;

      switch (featureKey) {
        case 'ai_assistant':
          allowed = ['Professional', 'Enterprise'].includes(planName);
          break;
        case 'laboratory':
          allowed = ['Starter', 'Professional', 'Enterprise'].includes(planName);
          break;
        case 'reports':
          allowed = ['Starter', 'Professional', 'Enterprise'].includes(planName);
          break;
        case 'backup':
          allowed = ['Professional', 'Enterprise'].includes(planName);
          break;
        default:
          allowed = false;
      }

      if (!allowed) {
        throw new AppError(
          `Feature limit exceeded: The "${featureKey === 'ai_assistant' ? 'AI Clinical Assistant' : featureKey}" feature is not available on your current "${planName}" plan. Please upgrade your subscription in Settings.`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
