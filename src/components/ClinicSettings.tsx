import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { 
  Building2, 
  Layers, 
  CreditCard, 
  Users, 
  UserPlus, 
  Activity, 
  Check, 
  AlertCircle, 
  Sparkles, 
  ChevronRight, 
  MapPin, 
  Phone, 
  Mail, 
  Key, 
  FileText,
  Shield,
  Trash2,
  Lock,
  DollarSign,
  Globe,
  Clock,
  Calendar,
  Percent,
  Save,
  Plus,
  MessageSquare,
  MessageCircle
} from 'lucide-react';

const SAAS_PLAN_TIERS = [
  {
    name: 'Free',
    price: 0,
    maxUsers: 2,
    maxPatients: 10,
    features: ['Single Practitioner', 'Basic Clinical Reports', 'Standard Support', 'Daily EMR Backup'],
    color: 'from-slate-400 to-slate-500',
  },
  {
    name: 'Starter',
    price: 49,
    maxUsers: 5,
    maxPatients: 50,
    features: ['Up to 5 Staff Members', 'Dynamic Queue & Reception Management', 'Advanced Pharmacy Integration', 'Priority Support'],
    color: 'from-blue-400 to-blue-600',
  },
  {
    name: 'Professional',
    price: 149,
    maxUsers: 15,
    maxPatients: 200,
    features: ['Up to 15 Staff Members', 'Multi-user Concurrent Schedulers', 'Full Laboratory Orders Dispatch', 'SMS & WhatsApp Auto Reminders', '24/7 Phone Support'],
    color: 'from-teal-400 to-teal-600',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 399,
    maxUsers: 100000,
    maxPatients: 100000,
    features: ['Unlimited Doctors & Users', 'Unlimited Clinical Registries', 'Custom PDF Clinic Reports Styling', 'Dedicated SaaS Account Representative', '99.9% Uptime SLA'],
    color: 'from-purple-500 to-indigo-600',
  },
];

export default function ClinicSettings() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Staff registration form state
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<'admin' | 'doctor' | 'receptionist'>('doctor');
  const [staffPassword, setStaffPassword] = useState('');

  // Active tab inside settings
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'plans' | 'billing' | 'staff' | 'system'>('overview');

  // System Settings Form States
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalCode, setHospitalCode] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDept, setNewDept] = useState('');
  const [consultationFees, setConsultationFees] = useState(50.0);
  const [slotDuration, setSlotDuration] = useState(15);
  const [maxSlotsPerDay, setMaxSlotsPerDay] = useState(30);
  const [workingHours, setWorkingHours] = useState<any>({});
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [taxRate, setTaxRate] = useState(0.0);
  const [taxName, setTaxName] = useState('GST');
  const [currency, setCurrency] = useState('USD');
  const [language, setLanguage] = useState('en');

  // Email Settings
  const [emailHost, setEmailHost] = useState('');
  const [emailPort, setEmailPort] = useState('');
  const [emailUser, setEmailUser] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);

  // SMS Settings
  const [smsGateway, setSmsGateway] = useState('twilio');
  const [smsSid, setSmsSid] = useState('');
  const [smsToken, setSmsToken] = useState('');
  const [smsFrom, setSmsFrom] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);

  // WhatsApp Settings
  const [waGateway, setWaGateway] = useState('whatsapp');
  const [waToken, setWaToken] = useState('');
  const [waNumber, setWaNumber] = useState('');
  const [waEnabled, setWaEnabled] = useState(false);

  // Inner tab inside System Settings
  const [systemActiveTab, setSystemActiveTab] = useState<'info' | 'clinical' | 'timing' | 'billing' | 'comms'>('info');

  // Query: Fetch system settings
  const { data: systemSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load system settings');
      return res.json();
    },
    enabled: !!token && !!profile?.clinicId
  });

  // Mutation: Save system settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: any) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedSettings)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save system settings');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      setSuccessMessage('System settings updated successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  });

  // Load system settings into form state
  useEffect(() => {
    if (systemSettings) {
      setHospitalName(systemSettings.hospitalName || '');
      setHospitalCode(systemSettings.hospitalCode || '');
      setAddress(systemSettings.address || '');
      setContactNumber(systemSettings.contactNumber || '');
      setWebsite(systemSettings.website || '');
      
      try {
        setDepartments(JSON.parse(systemSettings.departments || '[]'));
      } catch (e) {
        setDepartments([]);
      }
      
      setConsultationFees(systemSettings.consultationFees ?? 50.0);
      setSlotDuration(systemSettings.slotDuration ?? 15);
      setMaxSlotsPerDay(systemSettings.maxSlotsPerDay ?? 30);
      
      try {
        setWorkingHours(JSON.parse(systemSettings.workingHours || '{}'));
      } catch (e) {
        setWorkingHours({});
      }
      
      try {
        setHolidays(JSON.parse(systemSettings.holidays || '[]'));
      } catch (e) {
        setHolidays([]);
      }
      
      setTaxRate(systemSettings.taxRate ?? 0.0);
      setTaxName(systemSettings.taxName || 'GST');
      setCurrency(systemSettings.currency || 'USD');
      setLanguage(systemSettings.language || 'en');
      
      setEmailHost(systemSettings.emailHost || '');
      setEmailPort(systemSettings.emailPort?.toString() || '');
      setEmailUser(systemSettings.emailUser || '');
      setEmailPassword(systemSettings.emailPassword || '');
      setEmailFrom(systemSettings.emailFrom || '');
      setEmailEnabled(!!systemSettings.emailEnabled);
      
      setSmsGateway(systemSettings.smsGateway || 'twilio');
      setSmsSid(systemSettings.smsSid || '');
      setSmsToken(systemSettings.smsToken || '');
      setSmsFrom(systemSettings.smsFrom || '');
      setSmsEnabled(!!systemSettings.smsEnabled);
      
      setWaGateway(systemSettings.waGateway || 'whatsapp');
      setWaToken(systemSettings.waToken || '');
      setWaNumber(systemSettings.waNumber || '');
      setWaEnabled(!!systemSettings.waEnabled);
    }
  }, [systemSettings]);

  const handleSaveSystemSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveSettingsMutation.mutate({
      hospitalName,
      hospitalCode,
      address,
      contactNumber,
      website,
      departments,
      consultationFees,
      slotDuration,
      maxSlotsPerDay,
      workingHours,
      holidays,
      taxRate,
      taxName,
      currency,
      language,
      emailHost,
      emailPort,
      emailUser,
      emailPassword,
      emailFrom,
      emailEnabled,
      smsGateway,
      smsSid,
      smsToken,
      smsFrom,
      smsEnabled,
      waGateway,
      waToken,
      waNumber,
      waEnabled
    });
  };

  const handleAddDept = () => {
    if (newDept.trim() && !departments.includes(newDept.trim())) {
      setDepartments([...departments, newDept.trim()]);
      setNewDept('');
    }
  };

  const handleRemoveDept = (deptName: string) => {
    setDepartments(departments.filter(d => d !== deptName));
  };

  const handleAddHoliday = () => {
    if (newHolidayDate && newHolidayName.trim()) {
      if (!holidays.some(h => h.date === newHolidayDate)) {
        setHolidays([...holidays, { date: newHolidayDate, name: newHolidayName.trim() }]);
        setNewHolidayDate('');
        setNewHolidayName('');
      }
    }
  };

  const handleRemoveHoliday = (date: string) => {
    setHolidays(holidays.filter(h => h.date !== date));
  };

  const handleToggleDay = (day: string) => {
    setWorkingHours((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day]?.enabled
      }
    }));
  };

  const handleWorkingHourChange = (day: string, field: 'start' | 'end', value: string) => {
    setWorkingHours((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  // Query: Fetch Clinic Profile info
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['my-clinic'],
    queryFn: async () => {
      const res = await fetch('/api/saas/clinic', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No clinic associated with your account yet.');
      return res.json();
    },
    enabled: !!token && !!profile?.clinicId
  });

  // Query: Fetch Dynamic SaaS Usage Stats
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['clinic-usage'],
    queryFn: async () => {
      const res = await fetch('/api/saas/usage', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load clinic usage statistics');
      return res.json();
    },
    enabled: !!token && !!profile?.clinicId
  });

  // Query: Fetch Billing history
  const { data: billings = [], isLoading: billingLoading } = useQuery({
    queryKey: ['saas-billing'],
    queryFn: async () => {
      const res = await fetch('/api/saas/billings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load billing history');
      return res.json();
    },
    enabled: !!token && !!profile?.clinicId
  });

  // Query: Fetch staff list
  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['clinic-staff'],
    queryFn: async () => {
      const res = await fetch('/api/saas/staff', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load clinic staff directory');
      return res.json();
    },
    enabled: !!token && !!profile?.clinicId
  });

  // Mutation: Change Plan Subscription
  const changePlanMutation = useMutation({
    mutationFn: async (planData: { planName: string, billingCycle: 'monthly' | 'yearly' }) => {
      const res = await fetch('/api/saas/subscription/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(planData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update subscription');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-clinic'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-usage'] });
      queryClient.invalidateQueries({ queryKey: ['saas-billing'] });
      setSuccessMessage('Subscription updated successfully! Your fresh SaaS invoice has been generated.');
      setActiveSubTab('overview');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  });

  // Mutation: Pay SaaS Invoice
  const payInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const res = await fetch(`/api/saas/billings/${invoiceId}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Invoice checkout processing failed.');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-billing'] });
      setSuccessMessage('Invoice successfully settled! Your active subscription status is in good standing.');
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  });

  // Mutation: Add Staff member
  const addStaffMutation = useMutation({
    mutationFn: async (newStaff: any) => {
      const res = await fetch('/api/saas/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newStaff)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add staff member');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-staff'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-usage'] });
      setSuccessMessage('Staff member added successfully to your clinic directory!');
      setShowAddStaff(false);
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  });

  // Mutation: Update Staff Role
  const updateStaffRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number, role: string }) => {
      const res = await fetch(`/api/saas/staff/${id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });
      if (!res.ok) throw new Error('Failed to update staff role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-staff'] });
      setSuccessMessage('Staff authorization updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  });

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    addStaffMutation.mutate({
      name: staffName,
      email: staffEmail,
      role: staffRole,
      password: staffPassword || undefined
    });
  };

  const handleRegisterClinicPrompt = async () => {
    // Convenient automatic setup for testing in sandbox mode
    const clinicPayload = {
      name: `${profile?.name || 'My'} Wellness Practice`,
      slug: `${profile?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'my'}-wellness-${Math.floor(10 + Math.random() * 90)}`,
      email: profile?.email,
      phone: '+1 555-0100',
      address: '100 Healthcare Dr, Medical Park',
      planName: 'Starter',
      billingCycle: 'monthly'
    };

    try {
      const res = await fetch('/api/saas/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(clinicPayload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to auto-register clinic');
      }
      setSuccessMessage('Welcome! Your clinic sandbox instance has been provisioned.');
      queryClient.invalidateQueries({ queryKey: ['my-clinic'] });
      // Reload profile
      await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(() => window.location.reload());
    } catch (e: any) {
      setErrorMessage(e.message);
    }
  };

  if (!profile?.clinicId) {
    return (
      <div id="no_clinic_view" className="max-w-2xl mx-auto py-16 text-center space-y-6 animate-fadeIn">
        <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
          <Building2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-display font-bold text-slate-800">Your Account is Clinic-Free</h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
            You currently do not belong to any medical clinic workspace. You can easily bootstrap a fresh clinic tenant with instant SaaS plans subscription.
          </p>
        </div>
        <button
          onClick={handleRegisterClinicPrompt}
          className="px-6 h-11 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition shadow-md shadow-teal-500/15 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Provision Sandbox Clinic Now</span>
        </button>
      </div>
    );
  }

  if (clinicLoading) {
    return <div className="text-center py-12 text-slate-400 text-xs font-medium">Loading clinic SaaS config profile...</div>;
  }

  const activeSub = clinic?.subscriptions?.[0] || null;

  return (
    <div id="clinic_settings_root" className="max-w-7xl mx-auto space-y-8">
      {/* Messages */}
      {successMessage && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-emerald-800 text-sm shadow-sm animate-fadeIn">
          <Check className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 p-4 rounded-2xl text-rose-800 text-sm shadow-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header Profile Summary banner */}
      <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner">
            {clinic?.name?.substring(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-display font-bold text-slate-800">{clinic?.name}</h1>
              {clinic?.status === 'active' ? (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100/60 px-2 py-0.5 rounded-full">
                  ACTIVE TENANT
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-100/60 px-2 py-0.5 rounded-full">
                  SUSPENDED
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {clinic?.address || 'No Address'}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {clinic?.phone || 'No Phone'}</span>
              <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-50 px-1.5 py-0.5 rounded text-slate-500">/{clinic?.slug}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeSub ? (
            <div className="text-right border-l border-slate-100 pl-6">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">SaaS Plan Tier</span>
              <span className="text-lg font-display font-extrabold text-indigo-700">{activeSub.planName}</span>
              <span className="text-xs text-slate-400 block mt-0.5">Expires: {activeSub.endDate}</span>
            </div>
          ) : (
            <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl text-xs font-semibold">No active plan</div>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-100 gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeSubTab === 'overview' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Overview & Limits
        </button>
        <button
          onClick={() => setActiveSubTab('plans')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeSubTab === 'plans' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Change SaaS Plan
        </button>
        <button
          onClick={() => setActiveSubTab('billing')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeSubTab === 'billing' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Billing & Invoices
        </button>
        <button
          onClick={() => setActiveSubTab('staff')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeSubTab === 'staff' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Staff & Roles
        </button>
        <button
          onClick={() => setActiveSubTab('system')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeSubTab === 'system' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          System Settings
        </button>
      </div>

      {/* Overview and Limit Progress Section */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {usageLoading ? (
            <div className="text-center py-12 text-xs text-slate-400">Syncing subscription usage data...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Users Limit */}
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs text-slate-400 font-medium">Clinic Users</span>
                    <h4 className="text-lg font-bold text-slate-800">
                      {usage?.usersCount} <span className="text-slate-400 font-normal">/ {usage?.planConfig?.maxUsers === 100000 ? 'Unlimited' : usage?.planConfig?.maxUsers}</span>
                    </h4>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all" 
                    style={{ width: `${Math.min(100, (usage?.usersCount / (usage?.planConfig?.maxUsers || 1)) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">Total clinic administrators, doctors, and receptionist profiles.</p>
              </div>

              {/* Patients Limit */}
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs text-slate-400 font-medium">Patient Registries</span>
                    <h4 className="text-lg font-bold text-slate-800">
                      {usage?.patientsCount} <span className="text-slate-400 font-normal">/ {usage?.planConfig?.maxPatients === 100000 ? 'Unlimited' : usage?.planConfig?.maxPatients}</span>
                    </h4>
                  </div>
                  <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-teal-500 transition-all" 
                    style={{ width: `${Math.min(100, (usage?.patientsCount / (usage?.planConfig?.maxPatients || 1)) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">Cumulative patient records added across EMR services.</p>
              </div>

              {/* Core Volume Stats */}
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs text-slate-400 font-medium">Appointments booked</span>
                    <h4 className="text-lg font-bold text-slate-800">{usage?.appointmentsCount}</h4>
                  </div>
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>
                <div className="pt-2 text-[10px] text-slate-500 space-y-1">
                  <p>Storage Used: <strong>{usage?.storageUsed} MB</strong> / Unlimited</p>
                  <p>Active Subscription Status: <strong className="text-emerald-600 uppercase">ACTIVE</strong></p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plans comparison list */}
      {activeSubTab === 'plans' && (
        <div className="space-y-6">
          <div className="text-center space-y-1.5 max-w-md mx-auto mb-4">
            <h3 className="text-base font-bold text-slate-800">Flexible SaaS Subscription Tiers</h3>
            <p className="text-xs text-slate-400">Scale dynamically as your patient volume grows. Instantly change tier limits down below.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {SAAS_PLAN_TIERS.map((tier) => {
              const isCurrent = activeSub?.planName === tier.name;
              return (
                <div 
                  key={tier.name} 
                  className={`bg-white border rounded-2xl p-6 relative flex flex-col justify-between transition-all ${
                    isCurrent 
                      ? 'border-teal-500 shadow-md ring-1 ring-teal-500/20' 
                      : 'border-slate-100 shadow-sm hover:border-slate-200'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute top-0 right-6 -translate-y-1/2 bg-teal-500 text-white text-[9px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                      Active Plan
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plan Tier</span>
                      <h4 className="text-lg font-bold text-slate-800">{tier.name}</h4>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-display font-extrabold text-slate-800">${tier.price}</span>
                      <span className="text-xs text-slate-400 font-medium">/ month</span>
                    </div>

                    <ul className="space-y-2 border-t border-slate-50 pt-4">
                      <li className="text-[11px] text-slate-600 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-teal-500" />
                        <span>Max Users: <strong>{tier.maxUsers === 100000 ? 'Unlimited' : tier.maxUsers}</strong></span>
                      </li>
                      <li className="text-[11px] text-slate-600 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-teal-500" />
                        <span>Max Patients: <strong>{tier.maxPatients === 100000 ? 'Unlimited' : tier.maxPatients}</strong></span>
                      </li>
                      {tier.features.map((feat) => (
                        <li key={feat} className="text-[11px] text-slate-500 flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-teal-500 mt-0.5 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    {isCurrent ? (
                      <button 
                        disabled 
                        className="w-full h-10 bg-slate-100 text-slate-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Subscribed</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => changePlanMutation.mutate({ planName: tier.name, billingCycle: 'monthly' })}
                        disabled={changePlanMutation.isPending}
                        className="w-full h-10 border border-teal-500 text-teal-600 hover:bg-teal-50 rounded-xl text-xs font-semibold cursor-pointer transition"
                      >
                        {changePlanMutation.isPending ? 'Updating...' : `Subscribe to ${tier.name}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Billings and Invoices Section */}
      {activeSubTab === 'billing' && (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">SaaS Billing & Invoices History</h3>
            <p className="text-xs text-slate-400">Track all subscription statements, pending invoice payments, and historical payment receipts.</p>
          </div>

          {billingLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Fetching payment history...</div>
          ) : billings.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">No SaaS billing statements registered yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-6">Invoice Number</th>
                    <th className="py-3 px-6">Billing Date</th>
                    <th className="py-3 px-6">Due Date</th>
                    <th className="py-3 px-6">Amount</th>
                    <th className="py-3 px-6">Payment Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs text-slate-600">
                  {billings.map((bill: any) => (
                    <tr key={bill.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono font-semibold text-slate-700">{bill.invoiceNo}</td>
                      <td className="py-4 px-6">{bill.billingDate}</td>
                      <td className="py-4 px-6">{bill.dueDate}</td>
                      <td className="py-4 px-6 font-semibold text-slate-800">${bill.amount?.toFixed(2)}</td>
                      <td className="py-4 px-6">
                        {bill.status === 'paid' ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Paid</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Pending Settlement</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {bill.status !== 'paid' && (
                          <button
                            onClick={() => payInvoiceMutation.mutate(bill.id)}
                            disabled={payInvoiceMutation.isPending}
                            className="h-7 px-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 inline-flex cursor-pointer transition shadow-sm"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Settle Invoice</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Staff and Roles management directory */}
      {activeSubTab === 'staff' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-slate-800">Clinic Staff Directory</h3>
                <p className="text-xs text-slate-400">Manage authorization roles (Admin, Doctor, Receptionist) for clinic team members.</p>
              </div>

              <button
                onClick={() => setShowAddStaff(!showAddStaff)}
                className="h-9 px-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite Team Member</span>
              </button>
            </div>

            {/* Direct Add Staff member */}
            {showAddStaff && (
              <div className="p-6 bg-slate-50/50 border-b border-slate-100 animate-fadeIn">
                <h4 className="text-xs font-bold text-slate-700 mb-4 uppercase tracking-wider">Direct Invite Registration</h4>
                <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Full Name <span className="text-rose-500">*</span></label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Dr. Alexis Mercer"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Work Email <span className="text-rose-500">*</span></label>
                    <input 
                      type="email"
                      required
                      placeholder="e.g. alexis@clinic.com"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Default Authorization <span className="text-rose-500">*</span></label>
                    <select 
                      value={staffRole}
                      onChange={(e: any) => setStaffRole(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="doctor">Doctor / Clinician</option>
                      <option value="receptionist">Receptionist / Desk Staff</option>
                      <option value="admin">Clinic Administrator</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Account Password</label>
                    <input 
                      type="password"
                      placeholder="Leave blank for Staff123!"
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div className="md:col-span-4 flex justify-end gap-2.5 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setShowAddStaff(false)} 
                      className="h-9 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={addStaffMutation.isPending}
                      className="h-9 px-5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {addStaffMutation.isPending ? 'Inviting...' : 'Direct Enroll Member'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Staff list directories table */}
            {staffLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Syncing active clinician list...</div>
            ) : staff.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">No clinical team members found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-6">Staff Member</th>
                      <th className="py-3 px-6">Work Email</th>
                      <th className="py-3 px-6">Role Authorization</th>
                      <th className="py-3 px-6">Enrollment Date</th>
                      <th className="py-3 px-6 text-right">Authorize</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs text-slate-600">
                    {staff.map((member: any) => (
                      <tr key={member.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-6 font-semibold text-slate-800">{member.name}</td>
                        <td className="py-4 px-6">{member.email}</td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            member.role === 'admin' 
                              ? 'text-indigo-700 bg-indigo-50' 
                              : member.role === 'doctor' 
                                ? 'text-teal-700 bg-teal-50' 
                                : 'text-amber-700 bg-amber-50'
                          }`}>
                            {member.role === 'admin' ? 'Clinic Admin' : member.role}
                          </span>
                        </td>
                        <td className="py-4 px-6">{new Date(member.createdAt).toLocaleDateString()}</td>
                        <td className="py-4 px-6 text-right">
                          <select
                            value={member.role}
                            onChange={(e) => updateStaffRoleMutation.mutate({ id: member.id, role: e.target.value })}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-bold rounded-lg px-2 py-1 text-slate-700 cursor-pointer"
                          >
                            <option value="doctor">Doctor</option>
                            <option value="receptionist">Receptionist</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* System Settings Form Area */}
      {activeSubTab === 'system' && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">System & Hospital Configuration</h3>
              <p className="text-[11px] text-slate-400">Configure core hospital behaviors, scheduling limits, consultation fees, regional preferences, and notification channels.</p>
            </div>
            {profile?.role === 'admin' || profile?.role === 'superadmin' ? (
              <button
                onClick={() => handleSaveSystemSettings()}
                disabled={saveSettingsMutation.isPending}
                className="h-9 px-4 bg-teal-50 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4" />
                {saveSettingsMutation.isPending ? 'Saving Configuration...' : 'Save Configuration'}
              </button>
            ) : (
              <div className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                <span>View-only (Admin privileges required to save)</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 min-h-[500px]">
            {/* Sidebar navigation for system configurations */}
            <div className="border-r border-slate-100 p-4 space-y-1 bg-slate-50/30">
              <button
                type="button"
                onClick={() => setSystemActiveTab('info')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                  systemActiveTab === 'info' ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Hospital & Departments</span>
              </button>
              <button
                type="button"
                onClick={() => setSystemActiveTab('clinical')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                  systemActiveTab === 'clinical' ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Fees & Scheduling Slots</span>
              </button>
              <button
                type="button"
                onClick={() => setSystemActiveTab('timing')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                  systemActiveTab === 'timing' ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Working Hours & Holidays</span>
              </button>
              <button
                type="button"
                onClick={() => setSystemActiveTab('billing')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                  systemActiveTab === 'billing' ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Percent className="w-4 h-4" />
                <span>Taxes & Localization</span>
              </button>
              <button
                type="button"
                onClick={() => setSystemActiveTab('comms')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                  systemActiveTab === 'comms' ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Notification Settings</span>
              </button>
            </div>

            {/* Config details section */}
            <div className="md:col-span-3 p-6">
              {settingsLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-xs">
                  <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500 mb-2"></span>
                  Loading system specifications...
                </div>
              ) : (
                <form onSubmit={handleSaveSystemSettings} className="space-y-6">
                  {/* TAB 1: Hospital Info */}
                  {systemActiveTab === 'info' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="border-b border-slate-50 pb-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hospital Registry Details</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Define standard details for printed invoices, prescription headers, and outgoing reports.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hospital/Clinic Name</label>
                          <input
                            type="text"
                            value={hospitalName}
                            onChange={(e) => setHospitalName(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500"
                            placeholder="e.g. City General Hospital"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unique Code (Prefix)</label>
                          <input
                            type="text"
                            value={hospitalCode}
                            onChange={(e) => setHospitalCode(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500"
                            placeholder="e.g. CGH"
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Complete Physical Address</label>
                          <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500"
                            placeholder="e.g. 101 medical road, suite 4B"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Contact Number</label>
                          <input
                            type="text"
                            value={contactNumber}
                            onChange={(e) => setContactNumber(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500"
                            placeholder="e.g. +1 (555) 019-2834"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Official Website (URL)</label>
                          <input
                            type="text"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500"
                            placeholder="e.g. https://cityhospital.com"
                          />
                        </div>
                      </div>

                      {/* Departments Management */}
                      <div className="border-t border-slate-50 pt-5 space-y-4">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Clinical Departments</h4>
                          <p className="text-[10px] text-slate-400">List of departments active in this facility. Used for doctor classification and scheduling routing.</p>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newDept}
                            onChange={(e) => setNewDept(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDept(); } }}
                            className="flex-1 h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                            placeholder="Add department name..."
                          />
                          <button
                            type="button"
                            onClick={handleAddDept}
                            className="h-9 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200/60 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {departments.length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic">No departments listed. Use the builder above to register departments.</span>
                          ) : (
                            departments.map((dept) => (
                              <span key={dept} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/30">
                                {dept}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDept(dept)}
                                  className="text-slate-400 hover:text-red-500 rounded-full transition-colors ml-1 focus:outline-none"
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Clinical & Fees */}
                  {systemActiveTab === 'clinical' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="border-b border-slate-50 pb-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Clinical Consultations & Scheduling Constraints</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Control pricing metrics, booking slot windows, and daily patient constraints.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default Consultation Fee ({currency})</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">{currency}</span>
                            <input
                              type="number"
                              step="0.01"
                              value={consultationFees}
                              onChange={(e) => setConsultationFees(parseFloat(e.target.value) || 0)}
                              className="w-full h-9 pl-12 pr-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <p className="text-[9px] text-slate-400">Baseline charge for physical and tele-consult appointments.</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Appointment Slot Duration (Minutes)</label>
                          <select
                            value={slotDuration}
                            onChange={(e) => setSlotDuration(parseInt(e.target.value))}
                            className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500 cursor-pointer"
                          >
                            <option value={10}>10 Minutes</option>
                            <option value={15}>15 Minutes</option>
                            <option value={20}>20 Minutes</option>
                            <option value={30}>30 Minutes</option>
                            <option value={45}>45 Minutes</option>
                            <option value={60}>60 Minutes (1 hour)</option>
                          </select>
                          <p className="text-[9px] text-slate-400">Standard consulting slot duration allocated for scheduling timelines.</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Max Slots per Day (Per Clinician)</label>
                          <input
                            type="number"
                            value={maxSlotsPerDay}
                            onChange={(e) => setMaxSlotsPerDay(parseInt(e.target.value) || 0)}
                            className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500"
                          />
                          <p className="text-[9px] text-slate-400">Hard limit on daily automated slots generated to protect doctor bandwidth.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Timing & Holidays */}
                  {systemActiveTab === 'timing' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="border-b border-slate-50 pb-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Working Hours & Holiday Blackouts</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Control the clinic's operating days, timing boundaries, and scheduled blackout dates.</p>
                      </div>

                      {/* Daily times */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operating Hours</label>
                        <div className="space-y-2 border border-slate-100/80 rounded-xl p-4 bg-slate-50/20">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                            const config = workingHours[day] || { enabled: false, start: '09:00', end: '17:00' };
                            return (
                              <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                <div className="flex items-center gap-2 w-32 shrink-0">
                                  <input
                                    type="checkbox"
                                    id={`day-${day}`}
                                    checked={config.enabled}
                                    onChange={() => handleToggleDay(day)}
                                    className="rounded border-slate-200 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                  />
                                  <label htmlFor={`day-${day}`} className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                    {day}
                                  </label>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <input
                                    type="time"
                                    value={config.start || '09:00'}
                                    disabled={!config.enabled}
                                    onChange={(e) => handleWorkingHourChange(day, 'start', e.target.value)}
                                    className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                                  />
                                  <span className="text-xs text-slate-400 font-medium">to</span>
                                  <input
                                    type="time"
                                    value={config.end || '17:00'}
                                    disabled={!config.enabled}
                                    onChange={(e) => handleWorkingHourChange(day, 'end', e.target.value)}
                                    className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Holidays */}
                      <div className="border-t border-slate-50 pt-5 space-y-4">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Holidays & Maintenance Shutdowns</h4>
                          <p className="text-[10px] text-slate-400">Blackout dates during which appointments cannot be booked on the scheduler.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="date"
                            value={newHolidayDate}
                            onChange={(e) => setNewHolidayDate(e.target.value)}
                            className="h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                          />
                          <input
                            type="text"
                            value={newHolidayName}
                            onChange={(e) => setNewHolidayName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddHoliday(); } }}
                            className="flex-1 h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                            placeholder="Holiday name / Occasion..."
                          />
                          <button
                            type="button"
                            onClick={handleAddHoliday}
                            className="h-9 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200/60 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Blackout</span>
                          </button>
                        </div>

                        <div className="space-y-1">
                          {holidays.length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic">No custom clinic holiday blackouts listed.</span>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {holidays.map((h) => (
                                <div key={h.date} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/30 rounded-xl text-xs">
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-slate-700">{h.name}</span>
                                    <p className="text-[9px] font-mono text-slate-400">{new Date(h.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveHoliday(h.date)}
                                    className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Taxes & Localization */}
                  {systemActiveTab === 'billing' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="border-b border-slate-50 pb-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Taxes & Localization Settings</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Configure billing variables, tax applications, currencies, and languages.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax ID Name (e.g., GST / VAT / Sales Tax)</label>
                          <input
                            type="text"
                            value={taxName}
                            onChange={(e) => setTaxName(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500"
                            placeholder="e.g. GST"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax Rate (%)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={taxRate}
                              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                              className="w-full h-9 pr-8 pl-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500"
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Currency Profile</label>
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500 cursor-pointer"
                          >
                            <option value="USD">USD ($) - United States Dollar</option>
                            <option value="EUR">EUR (€) - Euro</option>
                            <option value="GBP">GBP (£) - British Pound Sterling</option>
                            <option value="INR">INR (₹) - Indian Rupee</option>
                            <option value="AUD">AUD ($) - Australian Dollar</option>
                            <option value="CAD">CAD ($) - Canadian Dollar</option>
                            <option value="SGD">SGD ($) - Singapore Dollar</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Interface Language</label>
                          <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl text-xs text-slate-800 transition focus:outline-none focus:border-teal-500 cursor-pointer"
                          >
                            <option value="en">English (US)</option>
                            <option value="es">Español (Spanish)</option>
                            <option value="fr">Français (French)</option>
                            <option value="hi">हिन्दी (Hindi)</option>
                            <option value="ar">العربية (Arabic)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: Comms Integrations */}
                  {systemActiveTab === 'comms' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="border-b border-slate-50 pb-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Outgoing Alerts & Communication Gateways</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Configure transactional relays for dispatching appointment receipts, prescription summaries, and clinical updates.</p>
                      </div>

                      {/* Outgoing Email Gateway Settings */}
                      <div className="space-y-4 border border-slate-100/80 rounded-xl p-4 bg-slate-50/20">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Mail className="w-4 h-4 text-sky-500" />
                              SMTP Email Delivery
                            </span>
                            <p className="text-[9px] text-slate-400">Used for emailing prescription transcripts and appointment cards.</p>
                          </div>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="emailEnabled"
                              checked={emailEnabled}
                              onChange={(e) => setEmailEnabled(e.target.checked)}
                              className="rounded border-slate-200 text-teal-600 focus:ring-teal-500 cursor-pointer w-4 h-4"
                            />
                            <label htmlFor="emailEnabled" className="text-xs font-bold text-slate-500 ml-1.5 cursor-pointer select-none">Enable Relay</label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1 col-span-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">SMTP Server Host</label>
                            <input
                              type="text"
                              value={emailHost}
                              onChange={(e) => setEmailHost(e.target.value)}
                              disabled={!emailEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                              placeholder="smtp.gmail.com"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">SMTP Port</label>
                            <input
                              type="number"
                              value={emailPort}
                              onChange={(e) => setEmailPort(e.target.value)}
                              disabled={!emailEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                              placeholder="587"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Authorized Username</label>
                            <input
                              type="text"
                              value={emailUser}
                              onChange={(e) => setEmailUser(e.target.value)}
                              disabled={!emailEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                              placeholder="noreply@hospital.com"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Secret Password</label>
                            <input
                              type="password"
                              value={emailPassword}
                              onChange={(e) => setEmailPassword(e.target.value)}
                              disabled={!emailEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                              placeholder="••••••••"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Sender Address</label>
                            <input
                              type="text"
                              value={emailFrom}
                              onChange={(e) => setEmailFrom(e.target.value)}
                              disabled={!emailEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                              placeholder="noreply@hospital.com"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SMS Configuration */}
                      <div className="space-y-4 border border-slate-100/80 rounded-xl p-4 bg-slate-50/20">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <MessageSquare className="w-4 h-4 text-emerald-500" />
                              SMS Service Gateway
                            </span>
                            <p className="text-[9px] text-slate-400">Used for dispatching real-time appointment reminders and check-in tokens.</p>
                          </div>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="smsEnabled"
                              checked={smsEnabled}
                              onChange={(e) => setSmsEnabled(e.target.checked)}
                              className="rounded border-slate-200 text-teal-600 focus:ring-teal-500 cursor-pointer w-4 h-4"
                            />
                            <label htmlFor="smsEnabled" className="text-xs font-bold text-slate-500 ml-1.5 cursor-pointer select-none">Enable Relay</label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Provider Gateway</label>
                            <select
                              value={smsGateway}
                              onChange={(e) => setSmsGateway(e.target.value)}
                              disabled={!smsEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50 cursor-pointer"
                            >
                              <option value="twilio">Twilio Messaging API</option>
                              <option value="infobip">Infobip API Gateway</option>
                              <option value="aws">Amazon SNS Gateway</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Sender Mobile / SID</label>
                            <input
                              type="text"
                              value={smsFrom}
                              onChange={(e) => setSmsFrom(e.target.value)}
                              disabled={!smsEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                              placeholder="+15550192"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Account SID / API Key</label>
                            <input
                              type="text"
                              value={smsSid}
                              onChange={(e) => setSmsSid(e.target.value)}
                              disabled={!smsEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                              placeholder="AC..."
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Auth Secret Token</label>
                            <input
                              type="password"
                              value={smsToken}
                              onChange={(e) => setSmsToken(e.target.value)}
                              disabled={!smsEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                              placeholder="••••••••"
                            />
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp API Configuration */}
                      <div className="space-y-4 border border-slate-100/80 rounded-xl p-4 bg-slate-50/20">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <MessageCircle className="w-4 h-4 text-green-500" />
                              WhatsApp Business Alerts
                            </span>
                            <p className="text-[9px] text-slate-400">Used for interactive digital prescriptions and live clinic updates.</p>
                          </div>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="waEnabled"
                              checked={waEnabled}
                              onChange={(e) => setWaEnabled(e.target.checked)}
                              className="rounded border-slate-200 text-teal-600 focus:ring-teal-500 cursor-pointer w-4 h-4"
                            />
                            <label htmlFor="waEnabled" className="text-xs font-bold text-slate-500 ml-1.5 cursor-pointer select-none">Enable Relay</label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Provider Gateway</label>
                            <select
                              value={waGateway}
                              onChange={(e) => setWaGateway(e.target.value)}
                              disabled={!waEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50 cursor-pointer"
                            >
                              <option value="whatsapp">Meta Official Cloud API</option>
                              <option value="twilio">Twilio Sandbox for WhatsApp</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Business Number ID</label>
                            <input
                              type="text"
                              value={waNumber}
                              onChange={(e) => setWaNumber(e.target.value)}
                              disabled={!waEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                              placeholder="+15551234"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Permanent Access Token</label>
                            <input
                              type="password"
                              value={waToken}
                              onChange={(e) => setWaToken(e.target.value)}
                              disabled={!waEnabled}
                              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                              placeholder="EAAC..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
