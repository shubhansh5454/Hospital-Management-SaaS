import { useState, useEffect, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './components/AuthContext.tsx';
import { RealTimeProvider } from './components/RealTimeContext.tsx';
import { FeatureFlagProvider } from './components/FeatureFlagContext.tsx';
import { HeartPulse } from 'lucide-react';

// Eager load layout because it defines the shell of the application
import Layout from './components/Layout.tsx';

// Lazy load screens for route-based chunk splitting
const AuthScreen = lazy(() => import('./components/AuthScreen.tsx'));
const PatientPortal = lazy(() => import('./components/PatientPortal.tsx'));
const Dashboard = lazy(() => import('./components/Dashboard.tsx'));
const Reception = lazy(() => import('./components/Reception.tsx'));
const Doctors = lazy(() => import('./components/Doctors.tsx'));
const Patients = lazy(() => import('./components/Patients.tsx'));
const Appointments = lazy(() => import('./components/Appointments.tsx'));
const Emr = lazy(() => import('./components/Emr.tsx'));
const Billing = lazy(() => import('./components/Billing.tsx'));
const Pharmacy = lazy(() => import('./components/Pharmacy.tsx'));
const Laboratory = lazy(() => import('./components/Laboratory.tsx'));
const Radiology = lazy(() => import('./components/Radiology.tsx'));
const Inventory = lazy(() => import('./components/Inventory.tsx'));
const Notifications = lazy(() => import('./components/Notifications.tsx'));
const Reports = lazy(() => import('./components/Reports.tsx'));
const BusinessIntelligence = lazy(() => import('./components/BusinessIntelligence.tsx'));
const SaaSAdmin = lazy(() => import('./components/SaaSAdmin.tsx'));
const ClinicSettings = lazy(() => import('./components/ClinicSettings.tsx'));
const AccessManagement = lazy(() => import('./components/AccessManagement.tsx'));
const Documents = lazy(() => import('./components/Documents.tsx'));
const AIAssistant = lazy(() => import('./components/AIAssistant.tsx'));
const VideoConsultation = lazy(() => import('./components/VideoConsultation.tsx'));
const Insurance = lazy(() => import('./components/Insurance.tsx'));
const HRManagement = lazy(() => import('./components/HRManagement.tsx'));
const BackupManagement = lazy(() => import('./components/BackupManagement.tsx'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 30, // Keep data fresh for 30 seconds to prevent redundant fetch storm on navigation
    },
  },
});

function TabLoader() {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse min-h-[400px]">
      <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center mb-3">
        <HeartPulse className="w-5 h-5 animate-bounce" />
      </div>
      <p className="text-xs text-slate-500 font-medium font-sans">Syncing screen module...</p>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useState(() => {
    if (profile?.role === 'superadmin') {
      setActiveTab('saas');
    }
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('join')) {
      setActiveTab('video-consultation');
    }
  }, []);

  if (loading) {
    return (
      <div id="loading_screen" className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-teal-500 text-white rounded-2xl flex items-center justify-center shadow-md animate-pulse">
            <HeartPulse className="w-7 h-7" />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-sm font-display font-bold text-slate-800 tracking-tight">Syncing clinical files...</p>
            <p className="text-[10px] text-slate-400">Loading electronic health registry database</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<TabLoader />}>
        <AuthScreen />
      </Suspense>
    );
  }

  if (profile?.role === 'patient') {
    return (
      <Suspense fallback={<TabLoader />}>
        <PatientPortal />
      </Suspense>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <Suspense fallback={<TabLoader />}>
        {activeTab === 'saas' && <SaaSAdmin />}
        {activeTab === 'clinic-settings' && <ClinicSettings />}
        {activeTab === 'roles-permissions' && <AccessManagement />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'reception' && <Reception />}
        {activeTab === 'emr' && <Emr />}
        {activeTab === 'doctors' && <Doctors />}
        {activeTab === 'patients' && <Patients />}
        {activeTab === 'appointments' && <Appointments />}
        {activeTab === 'billing' && <Billing />}
        {activeTab === 'pharmacy' && <Pharmacy />}
        {activeTab === 'laboratory' && <Laboratory />}
        {activeTab === 'radiology' && <Radiology />}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'notifications' && <Notifications />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'business-intelligence' && <BusinessIntelligence />}
        {activeTab === 'documents' && <Documents />}
        {activeTab === 'ai-assistant' && <AIAssistant />}
        {activeTab === 'video-consultation' && <VideoConsultation />}
        {activeTab === 'insurance' && <Insurance />}
        {activeTab === 'hr' && <HRManagement />}
        {activeTab === 'backup' && <BackupManagement />}
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FeatureFlagProvider>
          <RealTimeProvider>
            <AppContent />
          </RealTimeProvider>
        </FeatureFlagProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
