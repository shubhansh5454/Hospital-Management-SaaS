import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './components/AuthContext.tsx';
import AuthScreen from './components/AuthScreen.tsx';
import Layout from './components/Layout.tsx';
import Dashboard from './components/Dashboard.tsx';
import Reception from './components/Reception.tsx';
import Doctors from './components/Doctors.tsx';
import Patients from './components/Patients.tsx';
import Appointments from './components/Appointments.tsx';
import Emr from './components/Emr.tsx';
import Billing from './components/Billing.tsx';
import Pharmacy from './components/Pharmacy.tsx';
import Laboratory from './components/Laboratory.tsx';
import Inventory from './components/Inventory.tsx';
import Notifications from './components/Notifications.tsx';
import Reports from './components/Reports.tsx';
import SaaSAdmin from './components/SaaSAdmin.tsx';
import ClinicSettings from './components/ClinicSettings.tsx';
import AccessManagement from './components/AccessManagement.tsx';
import Documents from './components/Documents.tsx';
import { HeartPulse } from 'lucide-react';



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useState(() => {
    if (profile?.role === 'superadmin') {
      setActiveTab('saas');
    }
  });

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
    return <AuthScreen />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
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
      {activeTab === 'inventory' && <Inventory />}
      {activeTab === 'notifications' && <Notifications />}
      {activeTab === 'reports' && <Reports />}
      {activeTab === 'documents' && <Documents />}
    </Layout>


  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
