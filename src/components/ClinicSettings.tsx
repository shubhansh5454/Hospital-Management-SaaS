import React, { useState } from 'react';
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
  DollarSign
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
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'plans' | 'billing' | 'staff'>('overview');

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
    </div>
  );
}
