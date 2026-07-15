import { prisma } from '../../db/prisma.ts';
import { SaasService } from './saas.ts';

export interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  defaultPlans: string[]; // plans where this feature is enabled by default
}

export const STANDARD_FEATURES: FeatureDefinition[] = [
  {
    key: 'ai_assistant',
    name: 'AI Clinical Assistant',
    description: 'Generates AI prescription suggestions, medical summaries, and helps write clinical notes.',
    defaultPlans: ['Professional', 'Enterprise'],
  },
  {
    key: 'laboratory',
    name: 'Laboratory Integration',
    description: 'Enables custom lab tests, placing lab orders, and managing test results.',
    defaultPlans: ['Starter', 'Professional', 'Enterprise'],
  },
  {
    key: 'reports',
    name: 'Advanced Analytics & Reports',
    description: 'Provides deep visual analytics, patient load reports, and revenue summaries.',
    defaultPlans: ['Starter', 'Professional', 'Enterprise'],
  },
  {
    key: 'backup',
    name: 'Automated Backups & Cloud Sync',
    description: 'Secures clinical database with automatic backup configurations and cloud storage options.',
    defaultPlans: ['Professional', 'Enterprise'],
  },
  {
    key: 'inventory',
    name: 'Pharmacy & Inventory Control',
    description: 'Tracks medical products, vendor purchases, stock movements, and medicines sales.',
    defaultPlans: ['Starter', 'Professional', 'Enterprise'],
  },
  {
    key: 'telehealth',
    name: 'Video Consultations & Telehealth',
    description: 'Allows doctors to host remote high-definition video calls directly within the platform.',
    defaultPlans: ['Enterprise'],
  },
];

export class FeatureFlagService {
  /**
   * Seed standard features if they do not exist
   */
  public static async seedFeatureFlags() {
    for (const f of STANDARD_FEATURES) {
      const existing = await prisma.featureFlag.findUnique({
        where: { key: f.key },
      });

      if (!existing) {
        await prisma.featureFlag.create({
          data: {
            key: f.key,
            name: f.name,
            description: f.description,
            globallyEnabled: true,
            plansEnabled: f.defaultPlans.join(','),
            tenantOverrides: '{}',
          },
        });
      }
    }
  }

  /**
   * Check if a feature is enabled for a clinic
   */
  public static async isFeatureEnabled(clinicId: number, featureKey: string): Promise<boolean> {
    const flag = await prisma.featureFlag.findUnique({
      where: { key: featureKey },
    });

    if (!flag) {
      // If the feature is not defined, we default to false to be secure
      return false;
    }

    // 1. Global toggle check
    if (!flag.globallyEnabled) {
      return false;
    }

    // 2. Tenant override check
    let overrides: Record<string, boolean> = {};
    try {
      overrides = JSON.parse(flag.tenantOverrides || '{}');
    } catch {
      overrides = {};
    }

    // Tenant overrides take precedence (either explicitly true or explicitly false)
    if (overrides[clinicId.toString()] !== undefined) {
      return overrides[clinicId.toString()];
    }

    // 3. Fallback to subscription plan check
    const subscription = await SaasService.getSubscription(clinicId);
    const planName = subscription?.planName || 'Free';

    const enabledPlans = flag.plansEnabled.split(',').map(p => p.trim());
    return enabledPlans.includes(planName);
  }

  /**
   * Fetch all features along with their evaluation context for a specific clinic
   */
  public static async getFeaturesForClinic(clinicId: number) {
    const flags = await prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });

    const subscription = await SaasService.getSubscription(clinicId);
    const planName = subscription?.planName || 'Free';

    return flags.map(flag => {
      let overrides: Record<string, boolean> = {};
      try {
        overrides = JSON.parse(flag.tenantOverrides || '{}');
      } catch {
        overrides = {};
      }

      const hasOverride = overrides[clinicId.toString()] !== undefined;
      const overrideVal = overrides[clinicId.toString()] || false;
      const enabledPlans = flag.plansEnabled.split(',').map(p => p.trim());
      const planEnabled = enabledPlans.includes(planName);

      const isEnabled = flag.globallyEnabled && (hasOverride ? overrideVal : planEnabled);

      return {
        key: flag.key,
        name: flag.name,
        description: flag.description,
        globallyEnabled: flag.globallyEnabled,
        plansEnabled: enabledPlans,
        planEnabled,
        hasOverride,
        overrideValue: overrideVal,
        isEnabled,
      };
    });
  }

  /**
   * Get all feature flags in the system (Super Admin)
   */
  public static async listFeatureFlags() {
    return await prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Update a feature flag (Global settings & Plan defaults)
   */
  public static async updateFeatureFlag(key: string, data: { globallyEnabled?: boolean; plansEnabled?: string[] }) {
    const updateData: any = {};
    if (data.globallyEnabled !== undefined) {
      updateData.globallyEnabled = data.globallyEnabled;
    }
    if (data.plansEnabled !== undefined) {
      updateData.plansEnabled = data.plansEnabled.join(',');
    }

    return await prisma.featureFlag.update({
      where: { key },
      data: updateData,
    });
  }

  /**
   * Toggle override for a specific tenant/clinic
   */
  public static async setTenantOverride(key: string, clinicId: number, overrideState: boolean | null) {
    const flag = await prisma.featureFlag.findUnique({
      where: { key },
    });

    if (!flag) {
      throw new Error(`Feature flag with key "${key}" not found`);
    }

    let overrides: Record<string, boolean> = {};
    try {
      overrides = JSON.parse(flag.tenantOverrides || '{}');
    } catch {
      overrides = {};
    }

    if (overrideState === null) {
      delete overrides[clinicId.toString()];
    } else {
      overrides[clinicId.toString()] = overrideState;
    }

    return await prisma.featureFlag.update({
      where: { key },
      data: {
        tenantOverrides: JSON.stringify(overrides),
      },
    });
  }
}
