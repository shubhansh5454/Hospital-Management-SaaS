import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Calendar, 
  Clock, 
  Stethoscope, 
  User, 
  Plus, 
  Check, 
  X, 
  AlertCircle, 
  TrendingUp, 
  Sparkles,
  RefreshCw
} from 'lucide-react';

const appointmentFormSchema = z.object({
  patientId: z.number(),
  doctorId: z.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  reason: z.string().min(2, "Reason must be at least 2 characters"),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

export default function Appointments() {
  const { token, profile } = useAuth();
  const role = profile?.role || 'patient';
  const queryClient = useQueryClient();
  const [showBookForm, setShowBookForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // TanStack Query: Fetch Appointments
  const { data: appointments = [], isLoading: loadingApps } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const res = await fetch('/api/appointments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load appointments');
      return res.json();
    },
    enabled: !!token
  });

  // TanStack Query: Fetch Doctors (all users with doctor role)
  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const res = await fetch('/api/doctors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      return [];
    },
    enabled: !!token
  });

  // TanStack Query: Fetch Patients (to bind to appointments)
  const { data: patients = [] } = useQuery({
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

  // react-hook-form setup
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      reason: '',
      notes: '',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
    }
  });

  // TanStack Query Mutation: Create Appointment
  const bookMutation = useMutation({
    mutationFn: async (values: AppointmentFormValues) => {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to book session');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setSuccessMessage('Appointment booked and mapped successfully!');
      setShowBookForm(false);
      reset();
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  });

  // TanStack Query Mutation: Update Status
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setSuccessMessage('Appointment status updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  });

  const onSubmit = (data: AppointmentFormValues) => {
    // For patient role, register as primary patient if profile is matched, else error or help.
    // In our system, if user is patient, we dynamically map them. For demo purposes, they select patient or doctor.
    bookMutation.mutate(data);
  };

  const handleUpdateStatus = (id: number, status: 'completed' | 'cancelled') => {
    statusMutation.mutate({ id, status });
  };

  // If the user role is patient, and we have the list of patients, let's find the patient matched with their email to auto-fill
  const matchedPatientForUser = patients.find((p: any) => p.email === profile?.email);

  const handleOpenBookForm = () => {
    setShowBookForm(true);
    if (role === 'patient' && matchedPatientForUser) {
      setValue('patientId', matchedPatientForUser.id);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Banner Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h3 className="text-base font-display font-bold text-slate-800">Clinical Appointments</h3>
          <p className="text-xs text-slate-400">Schedule check-ups, diagnostics, and doctor visitations</p>
        </div>
        <button
          onClick={handleOpenBookForm}
          className="h-10 px-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Book Session</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex gap-3 text-xs font-medium">
          <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {bookMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl flex gap-3 text-xs font-medium">
          <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
          <span>{bookMutation.error?.message || 'Failed to submit booking.'}</span>
        </div>
      )}

      {showBookForm ? (
        /* Create appointment form */
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h4 className="text-sm font-display font-bold text-slate-800 border-b border-slate-50 pb-3 mb-5">
            Appointment Details & Practitioner Allocation
          </h4>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Select Patient */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Patient Profile *</label>
                {role === 'patient' && matchedPatientForUser ? (
                  <div className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold flex items-center text-slate-700">
                    {matchedPatientForUser.name} ({matchedPatientForUser.email})
                  </div>
                ) : (
                  <select
                    {...register('patientId', { valueAsNumber: true })}
                    className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all bg-white"
                  >
                    <option value="">Choose Patient</option>
                    {patients.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                    ))}
                  </select>
                )}
                {errors.patientId && <p className="text-[10px] text-red-500 font-medium">{errors.patientId.message}</p>}
                
                {role === 'patient' && !matchedPatientForUser && (
                  <p className="text-[10px] text-amber-600 font-medium bg-amber-50 p-2 rounded-lg border border-amber-100">
                    💡 Warning: Your email has not been linked to an EHR Patient profile yet. 
                    Please ask an Admin or Receptionist to register you under <strong className="underline">{profile?.email}</strong>.
                  </p>
                )}
              </div>

              {/* Select Doctor */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Assigned Doctor *</label>
                <select
                  {...register('doctorId', { valueAsNumber: true })}
                  className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all bg-white"
                >
                  <option value="">Choose Physician</option>
                  {doctors.map((doc: any) => (
                    <option key={doc.id} value={doc.id}>Dr. {doc.name} ({doc.email})</option>
                  ))}
                </select>
                {errors.doctorId && <p className="text-[10px] text-red-500 font-medium">{errors.doctorId.message}</p>}
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Appointment Date (YYYY-MM-DD) *</label>
                <input
                  {...register('date')}
                  type="text"
                  placeholder="YYYY-MM-DD"
                  className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all"
                />
                {errors.date && <p className="text-[10px] text-red-500 font-medium">{errors.date.message}</p>}
              </div>

              {/* Time */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Time Slot (HH:MM) *</label>
                <input
                  {...register('time')}
                  type="text"
                  placeholder="HH:MM"
                  className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all"
                />
                {errors.time && <p className="text-[10px] text-red-500 font-medium">{errors.time.message}</p>}
              </div>

            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Consultation Reason *</label>
              <input
                {...register('reason')}
                type="text"
                placeholder="e.g. Annual physical, cardiovascular check, follow-up"
                className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all"
              />
              {errors.reason && <p className="text-[10px] text-red-500 font-medium">{errors.reason.message}</p>}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Additional Comments / Symptoms</label>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Additional notes, medications currently being taken, or other symptoms."
                className="w-full p-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none transition-all"
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
              <button
                type="button"
                onClick={() => setShowBookForm(false)}
                className="h-10 px-5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Request Booking Slot</span>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* List layout */
        <div className="space-y-4">
          {loadingApps ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white border border-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-600">No scheduled sessions found</p>
              <p className="text-xs text-slate-400">
                Book an appointment slot to sync your live PostgreSQL cloud database records.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {appointments.map((app: any) => (
                <div key={app.id} className="bg-white border border-slate-100/60 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:border-slate-200 transition-all flex flex-col justify-between gap-5 relative overflow-hidden">
                  {/* Subtle status indicator strip */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    app.status === 'completed' ? 'bg-green-500' :
                    app.status === 'cancelled' ? 'bg-red-400' : 'bg-amber-400'
                  }`} />
                  
                  <div className="space-y-4">
                    {/* Header: Date, Time & Status */}
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-50 text-slate-600 border border-slate-100 rounded-lg flex items-center justify-center">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">{app.date}</span>
                          <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {app.time}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        app.status === 'completed' ? 'bg-green-50 text-green-700' :
                        app.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {app.status}
                      </span>
                    </div>

                    {/* Body: Patient and Doctor */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Patient</span>
                          <span className="font-semibold text-slate-700 block">{app.patient?.name}</span>
                          <span className="text-[10px] text-slate-400 block">{app.patient?.email}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Stethoscope className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Physician</span>
                          <span className="font-semibold text-slate-700 block">Dr. {app.doctor?.name}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Reason</span>
                        <p className="text-slate-600 font-medium">{app.reason}</p>
                      </div>

                      {app.notes && (
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100/60 mt-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Clinical Notes</span>
                          <p className="text-slate-500 italic text-[11px] leading-relaxed">{app.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions for Clinic Workers */}
                  {['admin', 'doctor', 'receptionist'].includes(role) && app.status === 'scheduled' && (
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
                      <button
                        onClick={() => handleUpdateStatus(app.id, 'cancelled')}
                        className="h-8 border border-red-100 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(app.id, 'completed')}
                        className="h-8 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-100/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Complete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
