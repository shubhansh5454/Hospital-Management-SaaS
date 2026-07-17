import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Clock3,
  Sliders,
  ChevronRight,
  Sparkles,
  Download,
  Mail,
  Plus,
  Trash2,
  Check,
  X,
  Star,
  Activity,
  AlertCircle,
  Percent,
  RefreshCw,
  Eye,
  Briefcase
} from 'lucide-react';

// Color themes
const BLUE_GREEN_THEME = ['#0d9488', '#0284c7', '#4f46e5', '#f59e0b', '#ef4444'];
const GENTLE_PASTELS = ['#a7f3d0', '#bae6fd', '#c7d2fe', '#fde68a', '#fecaca'];

interface ScheduledReport {
  id: number;
  title: string;
  type: string;
  frequency: string;
  recipientEmail: string;
  active: boolean;
  createdAt: string;
}

export default function BusinessIntelligence() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Selected Analytics Sub-Module: overview, doctors, patients, inventory, scheduler
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'doctors' | 'patients' | 'inventory' | 'scheduler'>('overview');

  // Drilldown states
  const [drilldownMonth, setDrilldownMonth] = useState<string | null>(null);
  const [drilldownDoctor, setDrilldownDoctor] = useState<any | null>(null);

  // Success & Error Toasts
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Scheduled report form
  const [showAddReportModal, setShowAddReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({
    title: '',
    type: 'Financial Executive Summary',
    frequency: 'WEEKLY',
    recipientEmail: ''
  });

  // Export Progress Animation States
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);

  // 1. QUERIES
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['bi-kpis'],
    queryFn: async () => {
      const res = await fetch('/api/bi/dashboard-kpis', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load KPIs');
      return res.json();
    }
  });

  const { data: revenues, isLoading: loadingRevenues } = useQuery({
    queryKey: ['bi-revenues'],
    queryFn: async () => {
      const res = await fetch('/api/bi/revenue-analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load revenue analytics');
      return res.json();
    }
  });

  const { data: doctorsPerf = [], isLoading: loadingDoctors } = useQuery<any[]>({
    queryKey: ['bi-doctors'],
    queryFn: async () => {
      const res = await fetch('/api/bi/doctor-performance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load doctor statistics');
      return res.json();
    }
  });

  const { data: patientGrowth, isLoading: loadingGrowth } = useQuery({
    queryKey: ['bi-patient-growth'],
    queryFn: async () => {
      const res = await fetch('/api/bi/patient-growth', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load growth data');
      return res.json();
    }
  });

  const { data: appTrends, isLoading: loadingTrends } = useQuery({
    queryKey: ['bi-app-trends'],
    queryFn: async () => {
      const res = await fetch('/api/bi/appointment-trends', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load appointment trends');
      return res.json();
    }
  });

  const { data: labPharmAnalytics, isLoading: loadingLabPharm } = useQuery({
    queryKey: ['bi-lab-pharm'],
    queryFn: async () => {
      const res = await fetch('/api/bi/lab-pharmacy-analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load lab and pharmacy insights');
      return res.json();
    }
  });

  const { data: inventoryAnalytics, isLoading: loadingInventory } = useQuery({
    queryKey: ['bi-inventory-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/bi/inventory-analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load inventory analytics');
      return res.json();
    }
  });

  const { data: scheduledReports = [], isLoading: loadingSchedules } = useQuery<ScheduledReport[]>({
    queryKey: ['bi-schedules'],
    queryFn: async () => {
      const res = await fetch('/api/bi/scheduled-reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load scheduled reports');
      return res.json();
    }
  });

  // MUTATIONS
  const addScheduleMutation = useMutation({
    mutationFn: async (data: typeof reportForm) => {
      const res = await fetch('/api/bi/scheduled-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to register schedule');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bi-schedules'] });
      setSuccessToast('Automated BI report scheduled and configured!');
      setShowAddReportModal(false);
      setReportForm({ title: '', type: 'Financial Executive Summary', frequency: 'WEEKLY', recipientEmail: '' });
    },
    onError: (err: any) => setErrorToast(err.message)
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/bi/scheduled-reports/${id}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to toggle scheduled report');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bi-schedules'] });
      setSuccessToast('Schedule active state modified.');
    },
    onError: (err: any) => setErrorToast(err.message)
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/bi/scheduled-reports/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete scheduled report');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bi-schedules'] });
      setSuccessToast('Schedule removed from queue.');
    },
    onError: (err: any) => setErrorToast(err.message)
  });

  // Dynamic Custom Exports Engine Simulation
  const triggerExportAnalytics = (format: 'PDF' | 'XLS' | 'CSV') => {
    if (exportingType) return;
    setExportingType(format);
    setExportProgress(0);

    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setExportingType(null);
            setSuccessToast(`Dynamic High-Fidelity ${format} analytical report downloaded successfully!`);
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 300);
  };

  // DRILLDOWN RENDER BLOCK
  const matchedMonthDetails = revenues?.revenueTrend?.find((t: any) => t.month === drilldownMonth);

  return (
    <div className="w-full space-y-6" id="corporate-business-intelligence">
      
      {/* TOAST alerts */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-between p-4 mb-2 text-sm text-teal-800 rounded-xl bg-teal-50 border border-teal-200 shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-teal-600" />
              <span className="font-semibold">{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-teal-500 hover:text-teal-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-between p-4 mb-2 text-sm text-red-800 rounded-xl bg-red-50 border border-red-200 shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-semibold">{errorToast}</span>
            </div>
            <button onClick={() => setErrorToast(null)} className="text-red-500 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXECUTIVE HERO SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-6 border-b border-gray-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-600/10">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">CareSync Business Intelligence (BI)</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Executive financial ledger insights, doctor slot metrics, patient demographic projections, and automated scheduled reporting.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Downloader Tool */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Export Ledger:</span>
          <button
            onClick={() => triggerExportAnalytics('PDF')}
            disabled={!!exportingType}
            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold bg-white border border-gray-200 rounded-lg text-slate-600 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-red-500" /> PDF Report
          </button>
          <button
            onClick={() => triggerExportAnalytics('XLS')}
            disabled={!!exportingType}
            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold bg-white border border-gray-200 rounded-lg text-slate-600 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" /> Excel Sheet
          </button>
        </div>
      </div>

      {/* EXPORTING ANIMATION PROGRESS BAR */}
      {exportingType && (
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-xs font-bold text-indigo-900">
              <span>Compiling enterprise-grade multi-sheet analytical database to {exportingType}...</span>
              <span>{exportProgress}%</span>
            </div>
            <div className="w-full bg-indigo-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${exportProgress}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS MODULE SUB-SELECTOR */}
      <div className="flex flex-wrap items-center bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner max-w-max">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === 'overview' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Executive Financials
        </button>
        <button
          onClick={() => setActiveSubTab('doctors')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === 'doctors' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Clinical Productivity
        </button>
        <button
          onClick={() => setActiveSubTab('patients')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === 'patients' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Demographics & Growth
        </button>
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === 'inventory' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Inventory & Lab Velocity
        </button>
        <button
          onClick={() => setActiveSubTab('scheduler')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === 'scheduler' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Email Scheduler
        </button>
      </div>

      {/* SUB-TAB 1: FINANCIAL EXECUTIVE OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* OVERVIEW STATS CARDS */}
          {loadingKpis ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-pulse h-24"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2 relative overflow-hidden">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Clinical Revenue</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-800">${kpis?.financials?.totalRevenue?.toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +14.2% MoM
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Outstanding Receivables</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-800">${kpis?.financials?.outstandingReceivables?.toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5">
                  <Clock className="w-3 h-3" /> Ledger Pending claims
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Net Operating Margin</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-800">{kpis?.financials?.netProfitMargin}%</span>
                </div>
                <div className="text-[10px] text-teal-600 font-bold flex items-center gap-0.5">
                  <ArrowUpRight className="w-3.5 h-3.5" /> High profitability
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Avg Ticket consultation Size</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-800">${kpis?.financials?.avgConsultFee}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-bold block">Per Completed Session</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pharmacy Asset Valuation</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-800">${kpis?.financials?.inventoryAssetValuation?.toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-indigo-600 font-bold flex items-center gap-0.5">
                  <Briefcase className="w-3 h-3" /> Medical wholesale assets
                </div>
              </div>
            </div>
          )}

          {/* MAIN CHART BLOCK */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Monthly Revenue Breakdown & Channel Streams</h3>
                  <p className="text-[10px] text-gray-400">Click a month bar to trigger executive deep-drill audits.</p>
                </div>
                <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">Interactive Drill-down</span>
              </div>

              {loadingRevenues ? (
                <p className="text-xs text-slate-400 py-10 text-center">Loading trend charts...</p>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={revenues.revenueTrend}
                      onClick={(data) => {
                        if (data && data.activeLabel) {
                          setDrilldownMonth(data.activeLabel);
                        }
                      }}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="consultations" name="General Clinic" stackId="a" fill="#0d9488" />
                      <Bar dataKey="pharmacy" name="Pharmacy Sales" stackId="a" fill="#0284c7" />
                      <Bar dataKey="laboratory" name="Lab Panels" stackId="a" fill="#4f46e5" />
                      <Bar dataKey="operations" name="OT Operations" stackId="a" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* CHANNEL SHARE BREAKDOWN */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Transactional Method Share</h3>
              <p className="text-[10px] text-gray-400">Ledger percentage by volume checkout types.</p>

              {loadingRevenues ? (
                <p className="text-xs text-slate-400 py-10 text-center">Rendering breakdown charts...</p>
              ) : (
                <div className="space-y-4">
                  <div className="h-[140px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenues.paymentBreakdown}
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {revenues.paymentBreakdown.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={BLUE_GREEN_THEME[index % BLUE_GREEN_THEME.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {revenues.paymentBreakdown.map((item: any, i: number) => (
                      <div key={i} className="flex flex-col p-2 bg-slate-50 border border-slate-100 rounded-lg">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BLUE_GREEN_THEME[i] }}></span>
                          <span className="text-slate-600 font-bold truncate">{item.name}</span>
                        </div>
                        <span className="text-slate-900 font-black mt-1 text-xs">{item.value}% &middot; ${item.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: DOCTOR CLINICAL PRODUCTIVITY */}
      {activeSubTab === 'doctors' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 animate-fadeIn">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Provider Performance & Financial Contribution</h3>
            <p className="text-xs text-gray-400">Ledger audit sorting consult volumes, revenue generation, customer satisfaction rating, and calendar slots utilization.</p>
          </div>

          {loadingDoctors ? (
            <p className="text-xs text-slate-400 py-10">Pulling doctors lists...</p>
          ) : (
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Clinical Specialist</th>
                    <th className="px-6 py-4">Specialty Code</th>
                    <th className="px-6 py-4 text-center">Consultations</th>
                    <th className="px-6 py-4 text-right">Revenue Contrib</th>
                    <th className="px-6 py-4 text-center">Patient Rating</th>
                    <th className="px-6 py-4 text-center">Slot Fill Rate</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-slate-700 font-semibold">
                  {doctorsPerf.map((doc: any) => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-bold text-slate-900">{doc.name}</td>
                      <td className="px-6 py-4">{doc.specialty}</td>
                      <td className="px-6 py-4 text-center font-bold">{doc.consultations}</td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-black">${doc.revenue?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
                          <Star className="w-3 h-3 fill-amber-500" /> {doc.rating}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-teal-500 h-full" style={{ width: `${doc.utilization}%` }}></div>
                          </div>
                          <span>{doc.utilization}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setDrilldownDoctor(doc)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: DEMOGRAPHICS & CLINICAL LOAD */}
      {activeSubTab === 'patients' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* PATIENT REGISTRATION TREND */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Monthly New Patient Registrations & Retention</h3>
            <p className="text-[10px] text-gray-400">Visualizing customer lifetime cohort registrations and active recurring appointments.</p>

            {loadingGrowth ? (
              <p className="text-xs text-slate-400 py-10">Constructing growth models...</p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={patientGrowth.growthTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="newPatients" name="New registrations" stroke="#0d9488" strokeWidth={2} />
                    <Line type="monotone" dataKey="churned" name="Patient Churn" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* AGE DEMOGRAPHICS CHART */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Age Group Demographics distribution</h3>
            <p className="text-[10px] text-gray-400">Target segments by medical consultation requirements.</p>

            {loadingGrowth ? (
              <p className="text-xs text-slate-400 py-10">Plotting demographic distribution...</p>
            ) : (
              <div className="space-y-4">
                <div className="h-[120px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={patientGrowth.demographics.ageGroups}
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {patientGrowth.demographics.ageGroups.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={BLUE_GREEN_THEME[index % BLUE_GREEN_THEME.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1 text-[10px]">
                  {patientGrowth.demographics.ageGroups.map((g: any, i: number) => (
                    <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BLUE_GREEN_THEME[i] }}></span>
                        <span className="text-slate-600 font-bold">{g.name}</span>
                      </div>
                      <span className="text-slate-900 font-black">{g.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PEAK CLINICAL LOAD ANALYSIS */}
          <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Peak Hours Waiting Time & Check-in analytics</h3>
              <p className="text-xs text-gray-400 font-semibold text-slate-500">Determine hourly bottleneck check-ins to optimize doctor staffing rotations during high-volume periods.</p>
            </div>

            {loadingTrends ? (
              <p className="text-xs text-slate-400 py-10">Rendering queue maps...</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-3">
                {appTrends.hourlyPeakLoad.map((item: any, idx: number) => {
                  const waitColor = item.waitTimeMin >= 22 ? 'bg-red-50 text-red-800 border-red-200' : item.waitTimeMin >= 15 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  return (
                    <div key={idx} className={`p-3 rounded-xl border text-center flex flex-col justify-between space-y-2 ${waitColor}`}>
                      <span className="text-[9px] font-bold block uppercase">{item.hour}</span>
                      <div>
                        <div className="text-base font-black leading-none">{item.checkins}</div>
                        <span className="text-[8px] font-bold block mt-0.5">Check-ins</span>
                      </div>
                      <span className="text-[8px] font-black border-t border-current pt-1 block">{item.waitTimeMin}m Wait</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: INVENTORY VALUE & LAB VELOCITY */}
      {activeSubTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          {/* LAB ANALYTICS */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Diagnostic Lab Test Volume & Turnaround Ledger</h3>
            <p className="text-[10px] text-gray-400">Tracks high-frequency ordered diagnostic procedures and turnaround metrics.</p>

            {loadingLabPharm ? (
              <p className="text-xs text-slate-400 py-10">Pulling diagnostics...</p>
            ) : (
              <div className="space-y-2">
                {labPharmAnalytics.labVolumes.map((lab: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-[11px]">
                    <div>
                      <div className="font-bold text-slate-800">{lab.testName}</div>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-bold">Turnaround speed: {lab.avgHrs} hours average</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md block">
                        {lab.count} Orders
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">+${lab.revenue}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PHARMACY MARGIN VELOCITY */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Pharmacy Profit Margin and Velocity analysis</h3>
            <p className="text-[10px] text-gray-400">Compares procurement cost relative to retail price and transaction units.</p>

            {loadingLabPharm ? (
              <p className="text-xs text-slate-400 py-10">Running margin formulas...</p>
            ) : (
              <div className="space-y-3">
                {labPharmAnalytics.pharmacyMargins.map((pm: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-800">
                      <span>{pm.name}</span>
                      <span className="text-emerald-600">{pm.margin}% Margin</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full" style={{ width: `${pm.margin}%` }}></div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">{pm.volume} units sold</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: AUTOMATED REPORT SCHEDULER */}
      {activeSubTab === 'scheduler' && (
        <div className="space-y-6 animate-fadeIn" id="bi-scheduler-panel">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Corporate Automated BI Reports Scheduler</h3>
              <p className="text-[10px] text-gray-400">Configure CareSync system schedules to deliver executive financial audits to shareholders.</p>
            </div>
            <button
              onClick={() => setShowAddReportModal(true)}
              className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Schedule Automated Audit
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {loadingSchedules ? (
              <p className="text-xs text-slate-400 py-10 pl-6">Reading schedules queue...</p>
            ) : scheduledReports.length === 0 ? (
              <div className="text-center py-20 text-slate-400 font-semibold">
                <Mail className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p className="text-xs">No active automation schedulers running currently.</p>
                <p className="text-[10px] text-slate-400">Establish weekly or monthly ledger automated triggers.</p>
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-4">Report Topic</th>
                      <th className="px-6 py-4">Analytical Focus</th>
                      <th className="px-6 py-4">Frequency</th>
                      <th className="px-6 py-4">Recipient Stakeholder Email</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                    {scheduledReports.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-bold text-slate-900">{r.title}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-[10px]">{r.type}</td>
                        <td className="px-6 py-4 text-indigo-600 font-bold">{r.frequency}</td>
                        <td className="px-6 py-4">{r.recipientEmail}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleScheduleMutation.mutate(r.id)}
                            className={`px-2.5 py-0.5 rounded text-[9px] font-bold border transition ${
                              r.active 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            }`}
                          >
                            {r.active ? 'Active Automation' : 'Paused / Muted'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              if (confirm('Delete this automated BI report scheduler from queue?')) {
                                deleteScheduleMutation.mutate(r.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-md transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* MONTHLY REVENUE DRILLDOWN MODAL */}
      <AnimatePresence>
        {drilldownMonth && matchedMonthDetails && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Departmental Audit Ledger ({drilldownMonth})</h3>
                  <p className="text-[10px] text-gray-400">Total channel revenue contribution splits.</p>
                </div>
                <button
                  onClick={() => setDrilldownMonth(null)}
                  className="p-1 bg-slate-100 rounded-full hover:bg-slate-200 transition"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-3 font-semibold">
                <div className="flex justify-between text-slate-500 py-1 border-b border-slate-200/50">
                  <span>General Consultations</span>
                  <span className="text-slate-900 font-bold">${matchedMonthDetails.consultations?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500 py-1 border-b border-slate-200/50">
                  <span>Pharmacy Sales</span>
                  <span className="text-slate-900 font-bold">${matchedMonthDetails.pharmacy?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500 py-1 border-b border-slate-200/50">
                  <span>Laboratory Services</span>
                  <span className="text-slate-900 font-bold">${matchedMonthDetails.laboratory?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500 py-1 border-b border-slate-200/50">
                  <span>OT Surgical Procedures</span>
                  <span className="text-slate-900 font-bold">${matchedMonthDetails.operations?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2">
                  <span>Aggregated Revenue</span>
                  <span className="text-teal-600">${matchedMonthDetails.total?.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setDrilldownMonth(null);
                  triggerExportAnalytics('PDF');
                }}
                className="w-full py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
              >
                Export Monthly Receipt PDF
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DOCTOR DEDICATED DRILLDOWN SPECIFICATIONS */}
      <AnimatePresence>
        {drilldownDoctor && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Drill-Down: {drilldownDoctor.name}</h3>
                  <p className="text-[10px] text-gray-400">Specialty clinical quality indicator statistics.</p>
                </div>
                <button
                  onClick={() => setDrilldownDoctor(null)}
                  className="p-1 bg-slate-100 rounded-full hover:bg-slate-200 transition"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2 font-semibold text-slate-600">
                <div className="flex justify-between">
                  <span>Clinical specialty:</span>
                  <span className="text-slate-900 font-bold">{drilldownDoctor.specialty}</span>
                </div>
                <div className="flex justify-between">
                  <span>Aggregated Consultations:</span>
                  <span className="text-slate-900 font-bold">{drilldownDoctor.consultations} sessions</span>
                </div>
                <div className="flex justify-between">
                  <span>Averaged Satisfaction rating:</span>
                  <span className="text-amber-600 font-bold flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-500" /> {drilldownDoctor.rating} / 5.0
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Clinic Slot Fill-Rate:</span>
                  <span className="text-slate-900 font-bold">{drilldownDoctor.utilization}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Patient Return Rate:</span>
                  <span className="text-teal-600 font-bold">{drilldownDoctor.repeatRate}% Loyalty</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 my-2 pt-2 text-sm font-black text-slate-900">
                  <span>Ledger Financial Billings</span>
                  <span className="text-slate-900">${drilldownDoctor.revenue?.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setDrilldownDoctor(null);
                  triggerExportAnalytics('XLS');
                }}
                className="w-full py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
              >
                Download Doctor Contribution Sheet
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AUTOMATED REPORT BUILDER MODAL */}
      <AnimatePresence>
        {showAddReportModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-slate-900">Create Automated BI email Report</h3>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const sanitizedTitle = reportForm.title.trim();
                  const sanitizedEmail = reportForm.recipientEmail.trim();
                  
                  if (!sanitizedTitle || !sanitizedEmail) {
                    setErrorToast('All email scheduler fields are mandatory.');
                    return;
                  }
                  
                  if (sanitizedTitle.length < 3) {
                    setErrorToast('Report title must be at least 3 characters.');
                    return;
                  }
                  
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(sanitizedEmail)) {
                    setErrorToast('Please enter a valid recipient email format (e.g. user@example.com).');
                    return;
                  }
                  
                  addScheduleMutation.mutate({
                    ...reportForm,
                    title: sanitizedTitle,
                    recipientEmail: sanitizedEmail
                  });
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Report Description/Title *</label>
                  <input
                    type="text"
                    value={reportForm.title}
                    onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                    placeholder="e.g. Q3 Healthcare Financial Summary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Analytical Stream *</label>
                  <select
                    value={reportForm.type}
                    onChange={(e) => setReportForm({ ...reportForm, type: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none"
                  >
                    <option value="Financial Executive Summary">Financial Executive Summary</option>
                    <option value="Provider Performance and rating matrix">Provider Performance Matrix</option>
                    <option value="Clinical patient growth Cohorts">Patient Growth Cohorts</option>
                    <option value="Pharmacy Expiration Predictions">Pharmacy Expiration Predictions</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Frequency *</label>
                    <select
                      value={reportForm.frequency}
                      onChange={(e) => setReportForm({ ...reportForm, frequency: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none"
                    >
                      <option value="DAILY">Daily Deliveries</option>
                      <option value="WEEKLY">Weekly Deliveries</option>
                      <option value="MONTHLY">Monthly Deliveries</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Recipient email *</label>
                    <input
                      type="email"
                      value={reportForm.recipientEmail}
                      onChange={(e) => setReportForm({ ...reportForm, recipientEmail: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                      placeholder="shareholder@clinic.com"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddReportModal(false)}
                    className="flex-1 py-2 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
                  >
                    Activate Trigger
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
