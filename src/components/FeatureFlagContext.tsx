import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext.tsx';

export interface ClinicFeature {
  key: string;
  name: string;
  description: string;
  globallyEnabled: boolean;
  plansEnabled: string[];
  planEnabled: boolean;
  hasOverride: boolean;
  overrideValue: boolean;
  isEnabled: boolean;
}

interface FeatureFlagContextProps {
  features: ClinicFeature[];
  loading: boolean;
  error: string | null;
  isFeatureEnabled: (key: string) => boolean;
  refreshFeatures: () => Promise<void>;
}

const FeatureFlagContext = createContext<FeatureFlagContextProps | undefined>(undefined);

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [features, setFeatures] = useState<ClinicFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = async () => {
    if (!user) {
      setFeatures([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/features/active', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch active feature flags');
      }

      const data = await response.json();
      setFeatures(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching feature flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, [user]);

  const isFeatureEnabled = (key: string): boolean => {
    const feature = features.find(f => f.key === key);
    return feature ? feature.isEnabled : false;
  };

  return (
    <FeatureFlagContext.Provider
      value={{
        features,
        loading,
        error,
        isFeatureEnabled,
        refreshFeatures: fetchFeatures,
      }}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
}
