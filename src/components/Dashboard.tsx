import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { 
  Users, 
  UserPlus,
  Calendar, 
  Activity, 
  CheckCircle, 
  HeartPulse, 
  Stethoscope, 
  Clock,
  Sparkles,
  DollarSign,
  TrendingUp,
  Beaker,
  Pill,
  AlertTriangle,
  Package,
  TrendingDown,
  ArrowUpRight,
  ClipboardList
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

export default function Dashboard() {
  const { profile, token } = useAuth();
  const role = profile?.role || 'patient';
  const isStaff = ['admin', 'doctor', 'receptionist'].includes(role);

  // 1. Fetch Admin Dashboard Statistics (Only for Staff roles)
  const { data: stats, isLoading: loadingStats, error: statsError, refetch } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      return res.json();
    },
    enabled: !!token && isStaff,
  });

  // 2. Fetch Patients (for fallback/generic views)
  const { data: patientsList = [], isLoading: loadingPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      return [];
    },
    enabled: !!token && isStaff && !stats
  });

  // 3. Fetch Appointments (for patient views or fallback feed)
  const { data: appointmentsList = [], isLoading: loadingAppointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const res = await fetch('/api/appointments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : (data.appointments || []);
      }
      return [];
    },
    enabled: !!token
  });

  // Derived patient statistics (fallback)
  const totalPatientsCount = patientsList.length;
  const totalAppointmentsCount = appointmentsList.length;
  const activeAppointments = appointmentsList.filter((app: any) => app.status === 'scheduled');
  const completedAppointmentsCount = appointmentsList.filter((app: any) => app.status === 'completed').length;

  // Render Patient-Specific Portal
  if (role === 'patient') {
    return (
      <div className="space-y-8 font-sans">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-teal-500 to-emerald-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase bg-white/20 px-2.5 py-1 rounded-full w-max">
              <HeartPulse className="w-3.5 h-3.5" />
              <span>Patient Portal Active</span>
            </div>
            <h3 className="text-2xl font-display font-bold">Welcome back, {profile?.name || 'Patient'}</h3>
            <p className="text-sm text-teal-50/90 max-w-xl">
              Access your medical history, view upcoming schedules, and manage clinical appointments instantly.
            </p>
          </div>
        </div>

        {/* Patient Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 block">My Appointments</span>
              <span className="text-2xl font-display font-bold text-slate-800 block">{totalAppointmentsCount}</span>
              <span className="text-[11px] text-slate-400 block">Total consultations scheduled</span>
            </div>
            <div className="w-11 h-11 rounded-xl border border-blue-100 bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-5.5 h-5.5" />
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 block">Pending Sessions</span>
              <span className="text-2xl font-display font-bold text-slate-800 block">{activeAppointments.length}</span>
              <span className="text-[11px] text-slate-400 block">Awaiting medical consultation</span>
            </div>
            <div className="w-11 h-11 rounded-xl border border-amber-100 bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5.5 h-5.5" />
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 block">Completed Visits</span>
              <span className="text-2xl font-display font-bold text-slate-800 block">{completedAppointmentsCount}</span>
              <span className="text-[11px] text-slate-400 block">Past health records synced</span>
            </div>
            <div className="w-11 h-11 rounded-xl border border-green-100 bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle className="w-5.5 h-5.5" />
            </div>
          </div>
        </div>

        {/* Appointment Feed */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-4">
            <div>
              <h4 className="text-base font-display font-bold text-slate-800">My Consultation Schedule</h4>
              <p className="text-xs text-slate-400">Chronological history of your appointments</p>
            </div>
          </div>

          {loadingAppointments ? (
            <div className="space-y-3">
              <div className="h-14 bg-slate-50 animate-pulse rounded-xl" />
              <div className="h-14 bg-slate-50 animate-pulse rounded-xl" />
            </div>
          ) : activeAppointments.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-500">No scheduled appointments</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">Use the appointments tab to book a consultation with our clinicians.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAppointments.map((app: any) => (
                <div key={app.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-slate-100 rounded-lg flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] font-bold text-teal-600 uppercase">
                        {new Date(app.date).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-xs font-bold text-slate-700 -mt-0.5">
                        {new Date(app.date).toLocaleDateString('en-US', { day: '2-digit' })}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-slate-800 block">Dr. {app.doctor?.name}</span>
                      <span className="text-[11px] text-slate-400 block">{app.reason}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-slate-700 block">{app.time}</span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      Scheduled
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Admin / Staff Dashboard View
  const adminWidgets = [
    {
      title: 'Total Patients',
      value: stats?.widgets?.totalPatients ?? 0,
      subtext: `+${stats?.widgets?.todaysPatients ?? 0} registered today`,
      icon: Users,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      title: "Today's Patients",
      value: stats?.widgets?.todaysPatients ?? 0,
      subtext: 'Admitted registrations',
      icon: UserPlus,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      title: "Today's Revenue",
      value: `$${(stats?.widgets?.todaysRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtext: 'Invoices & drug retail',
      icon: DollarSign,
      color: 'bg-teal-50 text-teal-600 border-teal-100',
    },
    {
      title: 'Monthly Revenue',
      value: `$${(stats?.widgets?.monthlyRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtext: 'Current calendar month',
      icon: TrendingUp,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
    {
      title: 'Doctors',
      value: stats?.widgets?.doctorsCount ?? 0,
      subtext: 'On-duty practitioners',
      icon: Stethoscope,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
    },
    {
      title: 'Appointments',
      value: stats?.widgets?.appointmentsCount ?? 0,
      subtext: `${stats?.widgets?.todaysAppointmentsCount ?? 0} scheduled today`,
      icon: Calendar,
      color: 'bg-sky-50 text-sky-600 border-sky-100',
    },
    {
      title: 'Lab Statistics',
      value: stats?.widgets?.labTotalCount ?? 0,
      subtext: `${stats?.widgets?.labPendingCount ?? 0} pending, ${stats?.widgets?.labCompletedCount ?? 0} done`,
      icon: Beaker,
      color: 'bg-pink-50 text-pink-600 border-pink-100',
    },
    {
      title: 'Pharmacy Sales',
      value: `$${(stats?.widgets?.pharmacySalesRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtext: `${stats?.widgets?.pharmacySalesCount ?? 0} items dispensed`,
      icon: Pill,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
      title: 'Inventory Alerts',
      value: stats?.widgets?.inventoryAlertsCount ?? 0,
      subtext: (stats?.widgets?.inventoryAlertsCount ?? 0) > 0 ? 'Reorder threshold breached' : 'All stocks fully sufficient',
      icon: AlertTriangle,
      color: (stats?.widgets?.inventoryAlertsCount ?? 0) > 0 ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : 'bg-slate-50 text-slate-500 border-slate-100',
    }
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Welcome & Admin Privilege Banner */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase bg-white/20 px-3 py-1 rounded-full w-max">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Unified Hospital Administration Dashboard</span>
          </div>
          <h3 className="text-2xl font-display font-bold">Administrative Command Console</h3>
          <p className="text-sm text-teal-50/90 max-w-2xl leading-relaxed">
            Welcome back, <strong className="font-semibold">{profile?.name}</strong>. Here is the operational intelligence feed for your facility. You have full oversight of clinical queues, lab workloads, financial pipelines, and pharmacy stocks.
          </p>
        </div>
      </div>

      {/* 9 Admin Metric Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {adminWidgets.map((widget, idx) => {
          const Icon = widget.icon;
          return (
            <div 
              key={idx} 
              id={`widget-card-${idx}`}
              className="bg-white border border-slate-100/80 hover:border-slate-200 hover:shadow-md rounded-2xl p-5 transition-all duration-200 flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 block">{widget.title}</span>
                <span className="text-2xl font-display font-bold text-slate-800 block">
                  {loadingStats ? (
                    <div className="w-12 h-7 bg-slate-100 animate-pulse rounded" />
                  ) : (
                    widget.value
                  )}
                </span>
                <span className="text-[11px] text-slate-400 block leading-tight">{widget.subtext}</span>
              </div>
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${widget.color}`}>
                <Icon className="w-5.5 h-5.5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Operational Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        
        {/* Chart 1: Revenue Trends (6 months) */}
        <div id="chart-card-revenue" className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col space-y-4 lg:col-span-2 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Financial Revenue Performance</h4>
              <p className="text-xs text-slate-400">Monthly invoice collection vs retail pharmacy sales</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 font-bold px-2.5 py-1 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Revenue Tracking Active</span>
            </div>
          </div>
          <div className="h-80 w-full pt-4">
            {loadingStats ? (
              <div className="w-full h-full bg-slate-50 animate-pulse rounded-xl" />
            ) : stats?.charts?.revenueTrend?.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Activity className="w-8 h-8 mb-2 stroke-1" />
                <span>No revenue data available</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.charts?.revenueTrend}>
                  <defs>
                    <linearGradient id="colorBilling" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPharmacy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                    labelStyle={{ fontWeight: 'bold', fontSize: '11px', color: '#1e293b' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" name="Invoices & Consultations ($)" dataKey="billing" stroke="#3b82f6" fillOpacity={1} fill="url(#colorBilling)" strokeWidth={2} />
                  <Area type="monotone" name="Pharmacy Sales ($)" dataKey="pharmacy" stroke="#10b981" fillOpacity={1} fill="url(#colorPharmacy)" strokeWidth={2} />
                  <Line type="monotone" name="Unified Revenue ($)" dataKey="total" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Patient Growth Trends */}
        <div id="chart-card-growth" className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Patient Registration Growth</h4>
              <p className="text-xs text-slate-400">Monthly new patient clinical directory additions</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="h-80 w-full pt-4">
            {loadingStats ? (
              <div className="w-full h-full bg-slate-50 animate-pulse rounded-xl" />
            ) : stats?.charts?.patientGrowthTrend?.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Users className="w-8 h-8 mb-2 stroke-1" />
                <span>No growth statistics available</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.charts?.patientGrowthTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    labelStyle={{ fontWeight: 'bold', fontSize: '11px', color: '#1e293b' }}
                  />
                  <Bar name="Registered Patients" dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Appointment Trends (Full-Width lower row) */}
        <div id="chart-card-appointments" className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col space-y-4 lg:col-span-2 xl:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Appointment Volumes & Pipeline</h4>
              <p className="text-xs text-slate-400">Monthly scheduled vs completed consults</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="h-80 w-full pt-4">
            {loadingStats ? (
              <div className="w-full h-full bg-slate-50 animate-pulse rounded-xl" />
            ) : stats?.charts?.appointmentTrend?.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Calendar className="w-8 h-8 mb-2 stroke-1" />
                <span>No appointment trends available</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.charts?.appointmentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    labelStyle={{ fontWeight: 'bold', fontSize: '11px', color: '#1e293b' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar name="Scheduled / Active" dataKey="scheduled" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar name="Completed" dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar name="Cancelled" dataKey="cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Inventory & Pharmacy Stock Alerts Panel */}
      <div id="alerts-panel" className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-50 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <Package className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Warehouse & Dispensary Low Stock Alerts</h4>
              <p className="text-xs text-slate-400">Inventory and pharmaceutical items requiring urgent reordering</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1 rounded-full">
            {stats?.widgets?.inventoryAlertsCount ?? 0} Alerts Active
          </span>
        </div>

        {loadingStats ? (
          <div className="space-y-3">
            <div className="h-12 bg-slate-50 animate-pulse rounded-xl" />
            <div className="h-12 bg-slate-50 animate-pulse rounded-xl" />
          </div>
        ) : !stats?.activeAlerts || stats.activeAlerts.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">All supplies at optimal inventory levels</p>
            <p className="text-[11px] text-slate-400">No low stock warnings are registered for medicines or logistics assets.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2.5 font-medium">Item Name</th>
                  <th className="py-2.5 font-medium">Category / Section</th>
                  <th className="py-2.5 font-medium">SKU / Code</th>
                  <th className="py-2.5 font-medium">Source Tab</th>
                  <th className="py-2.5 font-medium text-right">Current Stock</th>
                  <th className="py-2.5 font-medium text-right">Min Threshold</th>
                  <th className="py-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.activeAlerts.map((alert: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-[#fafafa]/80 transition-colors">
                    <td className="py-3 font-semibold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {alert.name}
                    </td>
                    <td className="py-3 text-slate-500 capitalize">{alert.category}</td>
                    <td className="py-3 font-mono text-[10px] text-slate-400">{alert.sku}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${alert.type === 'pharmacy' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                        {alert.type}
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold text-red-600">{alert.stock} units</td>
                    <td className="py-3 text-right text-slate-400">{alert.minStock} units</td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 font-bold rounded-full text-[9px] uppercase tracking-wider animate-pulse">
                        Reorder
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
