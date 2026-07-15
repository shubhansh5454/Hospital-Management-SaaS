import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { FeatureFlagController } from '../controllers/featureFlags.ts';

const router = Router();

// 1. Get evaluated features for the active clinic (Authenticated users)
router.get('/active', requireAuth, FeatureFlagController.getClinicFeatureFlags);

// 2. Super Admin administrative routes
router.get('/admin', requireAuth, requireRoles(['superadmin']), FeatureFlagController.getAllFeatureFlags);
router.put('/admin/:key', requireAuth, requireRoles(['superadmin']), FeatureFlagController.updateFeatureFlag);
router.post('/admin/:key/override', requireAuth, requireRoles(['superadmin']), FeatureFlagController.setTenantOverride);

export const featureRouter = router;
