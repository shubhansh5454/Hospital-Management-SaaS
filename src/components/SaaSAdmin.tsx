import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { 
  Building2, 
  ShieldAlert, 
  Plus, 
  Search, 
  Sparkles, 
  Layers, 
  CreditCard, 
  Users, 
  Activity, 
  TrendingUp, 
  Check, 
  AlertCircle, 
  Ban, 
  Play, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  DollarSign,
  Briefcase
} from 'lucide-react';

export default function SaaSAdmin() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New clinic form state
  const [clinicName, setClinicName] = useState('');
  const [clinicSlug, setClinicSlug] = useState('');
  const [clinicEmail, setClinicEmail] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('Free');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Query: Get Super Admin Overview Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['saas-stats'],
    queryFn: async () => {
      const res = await fetch('/api/saas/superadmin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load Super Admin stats');
      return res.json();
    },
    enabled: !!token
  });

  // Query: Get Clinics List
  const { data: clinics = [], isLoading: clinicsLoading } = useQuery({
    queryKey: ['saas-clinics'],
    queryFn: async () => {
      const res = await fetch('/api/saas/clinics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load registered clinics');
      return res.json();
    },
    enabled: !!token
  });

  // Mutation: Register a New Clinic
  const registerMutation = useMutation({
    mutationFn: async (newClinic: any) => {
      const res = await fetch('/api/saas/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newClinic)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to register clinic');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saas-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['saas-stats'] });
      setSuccessMessage(data.message || 'Clinic registered successfully!');
      setShowRegisterForm(false);
      // Reset form
      setClinicName('');
      setClinicSlug('');
      setClinicEmail('');
      setClinicPhone('');
      setClinicAddress('');
      setSelectedPlan('Free');
      setBillingCycle('monthly');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  });

  // Mutation: Toggle Clinic Status (Suspend/Activate)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await fetch(`/api/saas/clinics/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update clinic status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['saas-stats'] });
      setSuccessMessage('Clinic status updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  });

  const handleRegisterClinic = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({
      name: clinicName,
      slug: clinicSlug,
      email: clinicEmail,
      phone: clinicPhone,
      address: clinicAddress,
      planName: selectedPlan,
      billingCycle
    });
  };

  const filteredClinics = clinics.filter((c: any) => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div id="saas_admin_root" className="space-y-8 max-w-7xl mx-auto">
      {/* Upper Alerts */}
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

      {/* Hero Welcome banner */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg shadow-slate-900/10">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Layers className="w-48 h-48 text-white" />
        </div>
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>SaaS Core Operations</span>
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Super Admin Hub</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Monitor clinic subscriptions, analyze usage metrics across active tenants, and directly provision fresh clinics in our multi-tenant cloud environment.
          </p>
        </div>
      </div>

      {/* Stats Summary Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-32 bg-white rounded-2xl border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400">Total Clinics</span>
              <h3 className="text-2xl font-display font-bold text-slate-800">{stats?.totalClinics || 0}</h3>
              <span className="text-[10px] text-teal-600 font-medium">
                Active: {stats?.activeClinics || 0} | Suspended: {stats?.suspendedClinics || 0}
              </span>
            </div>
            <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400">Active Tenant Users</span>
              <h3 className="text-2xl font-display font-bold text-slate-800">{stats?.totalUsers || 0}</h3>
              <span className="text-[10px] text-slate-400">Doctors, Staff & Administrators</span>
            </div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400">Aggregated Patients</span>
              <h3 className="text-2xl font-display font-bold text-slate-800">{stats?.totalPatients || 0}</h3>
              <span className="text-[10px] text-slate-400">Total active EMR registry profiles</span>
            </div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400">Total SaaS Revenue</span>
              <h3 className="text-2xl font-display font-bold text-slate-800">
                ${stats?.totalRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </h3>
              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Fully Collected Payments
              </span>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Plan Distributions & SaaS Analytics banner */}
      {!statsLoading && stats?.planDistribution && (
        <div className="bg-white border border-slate-100 p-6 rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-500" />
              <span>Subscription Plan Distribution</span>
            </h3>
            <span className="text-xs text-slate-400">Live active subscriptions counts</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.planDistribution).map(([planName, count]: [string, any]) => {
              const percentages: Record<string, string> = {
                Free: 'bg-slate-300',
                Starter: 'bg-blue-400',
                Professional: 'bg-teal-400',
                Enterprise: 'bg-purple-500',
              };
              return (
                <div key={planName} className="border border-slate-50 p-4 rounded-xl space-y-2 bg-slate-50/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">{planName}</span>
                    <span className="text-xs font-bold text-slate-800">{count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${percentages[planName] || 'bg-teal-500'}`} 
                      style={{ width: `${Math.min(100, (count / (stats.totalClinics || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main interactive directory */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        {/* Header toolbar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-display font-bold text-slate-800">Clinic Directory</h2>
            <p className="text-xs text-slate-400">Search and manage registered clinic instances, suspend access, or register new tenants.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text"
                placeholder="Search clinic by name, slug or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 h-9 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white transition-all"
              />
            </div>

            <button 
              onClick={() => setShowRegisterForm(!showRegisterForm)}
              className="h-9 px-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Provision Clinic</span>
            </button>
          </div>
        </div>

        {/* Register Clinic Form modal/drawer */}
        {showRegisterForm && (
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 animate-fadeIn">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Briefcase className="w-4.5 h-4.5 text-teal-600" />
              <span>Provision New Multi-Clinic Tenant</span>
            </h3>
            <form onSubmit={handleRegisterClinic} className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 block">Clinic Name <span className="text-rose-500">*</span></label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Hope Wellness Medical"
                  value={clinicName}
                  onChange={(e) => {
                    setClinicName(e.target.value);
                    // auto generate slug
                    setClinicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }}
                  className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 block">Subdomain / Tenant Slug <span className="text-rose-500">*</span></label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. hope-wellness"
                  value={clinicSlug}
                  onChange={(e) => setClinicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
                  className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 block">Clinic Contact Email</label>
                <input 
                  type="email"
                  placeholder="e.g. contact@hopewellness.com"
                  value={clinicEmail}
                  onChange={(e) => setClinicEmail(e.target.value)}
                  className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 block">Clinic Phone</label>
                <input 
                  type="text"
                  placeholder="e.g. +1 555-0199"
                  value={clinicPhone}
                  onChange={(e) => setClinicPhone(e.target.value)}
                  className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 block">Subscription Plan <span className="text-rose-500">*</span></label>
                <select 
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="Free">Free Plan ($0/mo - 2 Users, 10 Patients)</option>
                  <option value="Starter">Starter Plan ($49/mo - 5 Users, 50 Patients)</option>
                  <option value="Professional">Professional Plan ($149/mo - 15 Users, 200 Patients)</option>
                  <option value="Enterprise">Enterprise Plan ($399/mo - Custom limits)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 block">Billing Interval <span className="text-rose-500">*</span></label>
                <select 
                  value={billingCycle}
                  onChange={(e: any) => setBillingCycle(e.target.value)}
                  className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="monthly">Monthly Cycle</option>
                  <option value="yearly">Yearly Cycle (20% Off)</option>
                </select>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 block">Physical Address</label>
                <input 
                  type="text"
                  placeholder="e.g. 100 Health Science Blvd, suite 4"
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="md:col-span-3 flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowRegisterForm(false)}
                  className="h-9 px-4 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-medium text-slate-600 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="h-9 px-5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {registerMutation.isPending ? 'Provisioning...' : 'Register and Activate'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Clinic Directories Table */}
        {clinicsLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            Loading tenant registry databases...
          </div>
        ) : filteredClinics.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No clinics matched your query filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-6">Clinic Info</th>
                  <th className="py-3 px-6">Subdomain Slug</th>
                  <th className="py-3 px-6">Active Subscription</th>
                  <th className="py-3 px-6">Calculated Usage</th>
                  <th className="py-3 px-6">Platform Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredClinics.map((clinic: any) => {
                  const activeSub = clinic.subscriptions?.[0] || null;
                  const usage = clinic.usages?.[0] || null;

                  return (
                    <tr key={clinic.id} className="hover:bg-slate-50/50 text-xs text-slate-600 transition-colors">
                      <td className="py-4.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center font-bold text-sm">
                            {clinic.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block leading-tight">{clinic.name}</span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3" /> {clinic.email || 'No Email'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4.5 px-6 font-mono text-[11px] text-slate-500">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md">/{clinic.slug}</span>
                      </td>

                      <td className="py-4.5 px-6">
                        {activeSub ? (
                          <div>
                            <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full text-[10px] uppercase">
                              {activeSub.planName}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              ${activeSub.price}/{activeSub.billingCycle === 'yearly' ? 'yr' : 'mo'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">No active plan</span>
                        )}
                      </td>

                      <td className="py-4.5 px-6">
                        {usage ? (
                          <div className="space-y-0.5 text-[10px] text-slate-500">
                            <p>Users: <strong>{usage.usersCount}</strong></p>
                            <p>Patients: <strong>{usage.patientsCount}</strong></p>
                            <p>Appointments: <strong>{usage.appointmentsCount}</strong></p>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-4.5 px-6">
                        {clinic.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                            <span className="w-1 h-1 rounded-full bg-rose-500" /> Suspended
                          </span>
                        )}
                      </td>

                      <td className="py-4.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {clinic.status === 'active' ? (
                            <button
                              onClick={() => toggleStatusMutation.mutate({ id: clinic.id, status: 'suspended' })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Suspend Clinic Instance"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleStatusMutation.mutate({ id: clinic.id, status: 'active' })}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              title="Reactivate Clinic Instance"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
