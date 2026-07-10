import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { 
  Users, 
  Calendar, 
  Activity, 
  CheckCircle, 
  HeartPulse, 
  Stethoscope, 
  Clock,
  Sparkles,
  ClipboardList
} from 'lucide-react';

export default function Dashboard() {
  const { profile, token } = useAuth();
  const role = profile?.role || 'patient';

  // Fetch Patients
  const { data: patientsList = [], isLoading: loadingPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      return [];
    },
    enabled: !!token && ['admin', 'doctor', 'receptionist'].includes(role)
  });

  // Fetch Appointments
  const { data: appointmentsList = [], isLoading: loadingAppointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const res = await fetch('/api/appointments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      return [];
    },
    enabled: !!token
  });

  // Derived statistics
  const totalPatientsCount = patientsList.length;
  const totalAppointmentsCount = appointmentsList.length;
  const activeAppointments = appointmentsList.filter((app: any) => app.status === 'scheduled');
  const completedAppointmentsCount = appointmentsList.filter((app: any) => app.status === 'completed').length;

  const cards = [
    {
      title: 'Total Active Patients',
      value: totalPatientsCount,
      description: 'Registered clinical records',
      icon: Users,
      color: 'text-teal-600 bg-teal-50 border-teal-100/50',
      roles: ['admin', 'doctor', 'receptionist']
    },
    {
      title: 'Total Appointments',
      value: totalAppointmentsCount,
      description: 'Scheduled, completed & cancelled',
      icon: Calendar,
      color: 'text-blue-600 bg-blue-50 border-blue-100/50',
      roles: ['admin', 'doctor', 'receptionist', 'patient']
    },
    {
      title: 'Pending Sessions',
      value: activeAppointments.length,
      description: 'Scheduled appointments pending action',
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 border-amber-100/50',
      roles: ['admin', 'doctor', 'receptionist', 'patient']
    },
    {
      title: 'Completed Treatments',
      value: completedAppointmentsCount,
      description: 'Successfully checked out sessions',
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50 border-green-100/50',
      roles: ['admin', 'doctor', 'receptionist']
    }
  ].filter(card => card.roles.includes(role));

  return (
    <div className="space-y-8 font-sans">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-500 to-emerald-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase bg-white/20 px-2.5 py-1 rounded-full w-max">
            <HeartPulse className="w-3.5 h-3.5" />
            <span>Clinic Portal Status Active</span>
          </div>
          <h3 className="text-2xl font-display font-bold">Welcome back, {profile?.name || 'Practitioner'}</h3>
          <p className="text-sm text-teal-50/90 max-w-xl">
            This workspace provides unified access to clinical pipelines. You are logged in with role privilege:{' '}
            <strong className="capitalize underline">{role}</strong>.
          </p>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 block">{card.title}</span>
                <span className="text-2xl font-display font-bold text-slate-800 block">
                  {loadingPatients || loadingAppointments ? (
                    <div className="w-8 h-6 bg-slate-100 animate-pulse rounded" />
                  ) : (
                    card.value
                  )}
                </span>
                <span className="text-[11px] text-slate-400 block">{card.description}</span>
              </div>
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${card.color}`}>
                <Icon className="w-5.5 h-5.5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Clinical Dashboard View (Split View) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Dynamic Scheduler Feed */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <div>
              <h4 className="text-base font-display font-bold text-slate-800">Clinic Schedule Feed</h4>
              <p className="text-xs text-slate-400">Chronological timeline of upcoming events</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-teal-600 bg-teal-50 font-semibold px-2.5 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <span>{activeAppointments.length} Scheduled</span>
            </div>
          </div>

          {loadingAppointments ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : activeAppointments.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-500">No scheduled appointments found</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">Create a patient or book an appointment to see live clinical entries.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAppointments.slice(0, 5).map((app: any) => (
                <div key={app.id} className="p-4 border border-slate-100/60 rounded-xl hover:border-slate-200 bg-[#fafafa]/50 transition-colors flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex flex-col items-center justify-center text-center p-1">
                      <span className="text-[10px] font-bold text-teal-600 uppercase">
                        {new Date(app.date).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-xs font-bold text-slate-700 -mt-0.5">
                        {new Date(app.date).toLocaleDateString('en-US', { day: '2-digit' })}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-slate-800 block truncate">
                        Patient: {app.patient?.name}
                      </span>
                      <span className="text-[11px] text-slate-400 block truncate">
                        Reason: {app.reason}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-700 block">{app.time}</span>
                      <span className="text-[10px] text-slate-400 block">Dr. {app.doctor?.name}</span>
                    </div>
                    <div className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      Scheduled
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info widgets and logs panel */}
        <div className="space-y-6">
          {/* Quick clinical overview info */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
              <Stethoscope className="w-5 h-5 text-teal-500" />
              <h4 className="text-sm font-display font-bold text-slate-800">SaaS Module Directory</h4>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#fafafa] rounded-xl border border-slate-100/50 flex gap-3">
                <ClipboardList className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-700 block">Patients Directory</span>
                  <span className="text-slate-400 leading-relaxed block mt-0.5">
                    Maintain electronic health records, diagnostic histories, and contact coordinates.
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#fafafa] rounded-xl border border-slate-100/50 flex gap-3">
                <Calendar className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-700 block">Scheduler Module</span>
                  <span className="text-slate-400 leading-relaxed block mt-0.5">
                    Live schedule management with real-time assignment of licensed clinic practitioners.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sandbox Controls info */}
          <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-800">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider">SaaS Demo Controls</span>
            </div>
            <p className="text-xs text-amber-900/80 leading-relaxed">
              Toggle roles in the top-right toolbar. This immediately adapts the client views and API endpoint authorization barriers:
            </p>
            <ul className="space-y-1 text-xs text-amber-800 list-disc list-inside opacity-90">
              <li><strong>Admin / Receptionist:</strong> Manage both Patients & Appointments.</li>
              <li><strong>Doctor:</strong> View assigned patients & schedule list.</li>
              <li><strong>Patient:</strong> Book appointments and view history.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
