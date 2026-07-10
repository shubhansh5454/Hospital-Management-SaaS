import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  Clock, 
  Search, 
  Plus, 
  Check, 
  Play, 
  X, 
  SkipForward, 
  AlertCircle, 
  RefreshCw, 
  Printer, 
  DollarSign, 
  PlusCircle, 
  Trash, 
  Stethoscope, 
  CheckCircle2, 
  UserCheck, 
  HeartPulse,
  ChevronRight,
  ClipboardList
} from 'lucide-react';

// Form validation schemas for Reception workflow
const walkinRegistrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(6, "Phone number must be at least 6 characters"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use format YYYY-MM-DD"),
  gender: z.string().min(1, "Please select gender"),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  doctorId: z.string().min(1, "Please select a doctor"),
  reason: z.string().min(2, "Reason must be at least 2 characters"),
  notes: z.string().optional(),
});

const quickAppointmentSchema = z.object({
  patientId: z.string().min(1, "Please select a patient"),
  doctorId: z.string().min(1, "Please select a doctor"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Use format HH:MM"),
  reason: z.string().min(2, "Reason is required"),
  notes: z.string().optional(),
});

const billingItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().int().positive("Must be at least 1"),
  unitPrice: z.coerce.number().nonnegative("Must be 0 or greater"),
});

const billingShortcutSchema = z.object({
  patientId: z.string().min(1, "Please select a patient"),
  doctorId: z.string().optional(),
  status: z.enum(['pending', 'paid']),
  notes: z.string().optional(),
  items: z.array(billingItemSchema).min(1, "Must add at least 1 line item"),
  taxRate: z.coerce.number().nonnegative().default(0),
  discount: z.coerce.number().nonnegative().default(0),
});

export default function Reception() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Selected state tabs and modals
  const [activeTab, setActiveTab] = useState<'appointments' | 'queue'>('queue');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  
  // Modals visibility
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [showQuickApptModal, setShowQuickApptModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  
  // Status messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active printed token context
  const [printedToken, setPrintedToken] = useState<any | null>(null);

  // Today's Date String
  const todayDateString = new Date().toISOString().split('T')[0];

  // 1. React Query: Fetch Reception Dashboard state
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['receptionDashboard'],
    queryFn: async () => {
      const res = await fetch('/api/reception/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load reception dashboard metrics.');
      return res.json();
    },
    refetchInterval: 10000, // Poll every 10 seconds for real-time queue updates
    enabled: !!token
  });

  // 2. React Query: Fetch Doctors List
  const { data: doctors = [] } = useQuery({
    queryKey: ['receptionDoctors'],
    queryFn: async () => {
      const res = await fetch('/api/doctors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load doctors.');
      return res.json();
    },
    enabled: !!token
  });

  // 3. React Query: Search Patients
  const { data: searchedPatients = [], refetch: searchPatients } = useQuery({
    queryKey: ['receptionPatientSearch', patientSearchQuery],
    queryFn: async () => {
      if (!patientSearchQuery.trim()) return [];
      const res = await fetch(`/api/reception/patients/search?q=${encodeURIComponent(patientSearchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Patient lookup failed.');
      return res.json();
    },
    enabled: !!token && patientSearchQuery.trim().length > 1
  });

  // React hook forms (no explicit generic type parameters to let zodResolver infer cleanly)
  const walkinForm = useForm({
    resolver: zodResolver(walkinRegistrationSchema),
    defaultValues: {
      name: '', email: '', phone: '', dob: '', gender: 'Male',
      bloodGroup: '', address: '', doctorId: '', reason: 'Walk-in Consultation', notes: ''
    }
  });

  const quickApptForm = useForm({
    resolver: zodResolver(quickAppointmentSchema),
    defaultValues: {
      patientId: '', doctorId: '',
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      reason: 'General Medical Consultation', notes: ''
    }
  });

  const billingForm = useForm({
    resolver: zodResolver(billingShortcutSchema),
    defaultValues: {
      patientId: '', doctorId: '',
      status: 'pending' as 'pending' | 'paid', taxRate: 0, discount: 0, notes: '',
      items: [{ description: 'General Doctor Consultation', quantity: 1, unitPrice: 150 }]
    }
  });

  const { fields: billingItems, append: appendBillingItem, remove: removeBillingItem } = useFieldArray({
    control: billingForm.control,
    name: "items" as never
  });


  // MUTATIONS

  // Check-in Mutation
  const checkinMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      const res = await fetch('/api/reception/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appointmentId })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Check-in failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['receptionDashboard'] });
      setPrintedToken(data);
      triggerSuccess('Patient checked in successfully! Token printed.');
    },
    onError: (err: any) => triggerError(err.message)
  });

  // Walk-in Registration Mutation
  const walkinMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch('/api/reception/walkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...values,
          doctorId: Number(values.doctorId)
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Walk-in registration failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['receptionDashboard'] });
      setPrintedToken(data.token);
      setShowWalkinModal(false);
      walkinForm.reset();
      triggerSuccess('New patient registered and checked in successfully!');
    },
    onError: (err: any) => triggerError(err.message)
  });

  // Quick Appointment Mutation
  const quickApptMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: Number(values.patientId),
          doctorId: Number(values.doctorId),
          date: todayDateString,
          time: values.time,
          reason: values.reason,
          notes: values.notes,
          status: 'scheduled'
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Appointment booking failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receptionDashboard'] });
      setShowQuickApptModal(false);
      quickApptForm.reset();
      triggerSuccess('Quick appointment scheduled successfully!');
    },
    onError: (err: any) => triggerError(err.message)
  });

  // Manual Token Direct Booking
  const manualTokenMutation = useMutation({
    mutationFn: async (payload: { patientId: number, doctorId: number, reason?: string }) => {
      const res = await fetch('/api/reception/token/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Token creation failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['receptionDashboard'] });
      setPrintedToken(data);
      triggerSuccess('Direct Token issued and printed!');
    },
    onError: (err: any) => triggerError(err.message)
  });

  // Update Token Status Mutation
  const updateTokenStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await fetch(`/api/reception/token/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Status update failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receptionDashboard'] });
      triggerSuccess('Queue board updated!');
    },
    onError: (err: any) => triggerError(err.message)
  });

  // Create Invoice Mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: Number(values.patientId),
          doctorId: values.doctorId ? Number(values.doctorId) : undefined,
          date: todayDateString,
          status: values.status,
          taxRate: Number(values.taxRate),
          discount: Number(values.discount),
          notes: values.notes,
          items: values.items.map((item: any) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          }))
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create invoice');
      }
      return res.json();
    },
    onSuccess: () => {
      setShowBillingModal(false);
      billingForm.reset({
        status: 'pending', taxRate: 0, discount: 0, notes: '',
        items: [{ description: 'General Doctor Consultation', quantity: 1, unitPrice: 150 }]
      });
      triggerSuccess('Clinic Invoice generated successfully!');
    },
    onError: (err: any) => triggerError(err.message)
  });

  // Helpers
  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  // Billing math
  const watchItems = billingForm.watch('items') || [];
  const watchTax = Number(billingForm.watch('taxRate') || 0);
  const watchDiscount = Number(billingForm.watch('discount') || 0);

  const subTotal = watchItems.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
  const taxAmount = (subTotal * watchTax) / 100;
  const grandTotal = Math.max(0, subTotal + taxAmount - watchDiscount);

  // Active state counters
  const stats = dashboardData?.stats || {
    totalWaiting: 0,
    totalCalling: 0,
    totalInConsultation: 0,
    totalCompleted: 0,
    totalSkipped: 0,
    totalQueue: 0
  };

  const appointmentsList = dashboardData?.appointments || [];
  const queueList = dashboardData?.queue || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" id="reception-dashboard-root">
      
      {/* Header with Title and Quick Refresh */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <HeartPulse className="h-8 w-8 text-emerald-600 animate-pulse" />
            Reception & Queue Operations
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time walk-in, check-in, token generation, and clinic queue management board.
          </p>
        </div>
        
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => refetchDashboard()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Live Sync
          </button>
          
          <button
            onClick={() => { walkinForm.reset(); setShowWalkinModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            Walk-in Entry
          </button>

          <button
            onClick={() => { quickApptForm.reset(); setShowQuickApptModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
          >
            <Calendar className="h-4 w-4" />
            Quick Appt
          </button>

          <button
            onClick={() => { billingForm.reset(); setShowBillingModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition"
          >
            <DollarSign className="h-4 w-4" />
            Billing Shortcut
          </button>
        </div>
      </div>

      {/* Success and Error Alerts */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-3 text-sm mb-6 shadow-sm"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg flex items-center gap-3 text-sm mb-6 shadow-sm"
          >
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time Statistics / Queue Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-slate-150 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Today</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{appointmentsList.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">Scheduled appointments</div>
        </div>
        <div className="bg-white border border-slate-150 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">In Queue</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{stats.totalWaiting + stats.totalCalling + stats.totalInConsultation}</div>
          <div className="text-[10px] text-slate-400 mt-1">Total active inside clinic</div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Waiting</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{stats.totalWaiting}</div>
          <div className="text-[10px] text-emerald-500 mt-1">In reception lounge</div>
        </div>
        <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-amber-600 uppercase tracking-wider">Calling</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{stats.totalCalling}</div>
          <div className="text-[10px] text-amber-500 mt-1">Being called to cabin</div>
        </div>
        <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-purple-600 uppercase tracking-wider">In Cabin</div>
          <div className="text-2xl font-black text-purple-700 mt-1">{stats.totalInConsultation}</div>
          <div className="text-[10px] text-purple-500 mt-1">Active consultation</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Done / Skipped</div>
          <div className="text-2xl font-black text-slate-700 mt-1">
            {stats.totalCompleted} <span className="text-slate-400 text-sm">/ {stats.totalSkipped}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Completed / Missed visits</div>
        </div>
      </div>

      {/* Main Split Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column - Live Appointments / Quick Patient Directory Finder */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Quick Search Patient Finder */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-emerald-600" />
              Patient & Token Launcher
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient name, email, phone..."
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
              />
            </div>

            {/* Patients Search Results */}
            {patientSearchQuery.trim().length > 1 && (
              <div className="mt-4 border border-slate-100 rounded-lg bg-slate-50 divide-y divide-slate-200 max-h-60 overflow-y-auto">
                {searchedPatients.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No matching patients found in clinical registry.
                  </div>
                ) : (
                  searchedPatients.map((pat: any) => (
                    <div key={pat.id} className="p-3 hover:bg-white flex justify-between items-center transition gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-700">{pat.name}</div>
                        <div className="text-[10px] text-slate-400">{pat.phone} • {pat.dob}</div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            const docId = doctors[0]?.id;
                            if (!docId) {
                              triggerError('Configure at least one doctor first.');
                              return;
                            }
                            manualTokenMutation.mutate({ patientId: pat.id, doctorId: docId });
                          }}
                          className="px-2 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs transition"
                        >
                          Issue Token
                        </button>
                        <button
                          onClick={() => {
                            billingForm.reset({
                              patientId: pat.id,
                              doctorId: doctors[0]?.id,
                              status: 'pending',
                              items: [{ description: 'Consultation Charge', quantity: 1, unitPrice: 150 }],
                              taxRate: 0,
                              discount: 0
                            });
                            setShowBillingModal(true);
                          }}
                          className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition"
                        >
                          Invoice
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Today's Scheduled Appointments Panel */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                Today's Appointments
              </h2>
              <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-full border border-slate-200">
                {appointmentsList.length} total
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto">
              {appointmentsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <ClipboardList className="h-8 w-8 text-slate-300" />
                  No appointments scheduled for today.
                </div>
              ) : (
                appointmentsList.map((appt: any) => {
                  const isCheckedIn = appt.status === 'checked_in' || appt.queueToken;
                  const isCompleted = appt.status === 'completed';
                  const isCancelled = appt.status === 'cancelled';

                  return (
                    <div key={appt.id} className="p-4 hover:bg-slate-50/30 transition flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-sm">
                            {appt.time}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {appt.patient.name}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Stethoscope className="h-3 w-3" />
                          Dr. {appt.doctor?.name} • <span className="italic">{appt.reason}</span>
                        </div>
                        
                        {/* Token Indicator if checked in */}
                        {appt.queueToken && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-100 rounded-md text-[9px] font-bold text-blue-700">
                            Active Token: {appt.queueToken.tokenNumber} ({appt.queueToken.status})
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 pt-0.5">
                        {isCheckedIn ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <Check className="h-3.5 w-3.5" /> Checked In
                          </span>
                        ) : isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600">
                            Completed
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500">
                            Cancelled
                          </span>
                        ) : (
                          <button
                            onClick={() => checkinMutation.mutate(appt.id)}
                            disabled={checkinMutation.isPending}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-md shadow-xs transition"
                          >
                            Check In
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right column - Real-time Queue Board Management */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
            
            {/* Queue Board Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-md font-extrabold text-slate-800 flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-emerald-600" />
                  Live Queue Board
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Manage patient sequence, room calls, and departures.</p>
              </div>

              {/* Status Tabs filtering */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'queue' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'}`}
                >
                  Active Queue ({queueList.filter((t: any) => ['WAITING', 'CALLING', 'IN_CONSULTATION'].includes(t.status)).length})
                </button>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'appointments' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'}`}
                >
                  Completed Today ({queueList.filter((t: any) => ['COMPLETED', 'SKIPPED'].includes(t.status)).length})
                </button>
              </div>
            </div>

            {/* Queue List Board */}
            <div className="divide-y divide-slate-100 min-h-[450px]">
              {queueList.filter((t: any) => {
                if (activeTab === 'queue') {
                  return ['WAITING', 'CALLING', 'IN_CONSULTATION'].includes(t.status);
                } else {
                  return ['COMPLETED', 'SKIPPED'].includes(t.status);
                }
              }).length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Users className="h-10 w-10 text-slate-300" />
                  No patients matching this queue status.
                </div>
              ) : (
                queueList.filter((t: any) => {
                  if (activeTab === 'queue') {
                    return ['WAITING', 'CALLING', 'IN_CONSULTATION'].includes(t.status);
                  } else {
                    return ['COMPLETED', 'SKIPPED'].includes(t.status);
                  }
                }).map((tok: any, idx: number) => {
                  
                  // Status Badge class helpers
                  let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  let showPulsing = false;
                  
                  if (tok.status === 'CALLING') {
                    badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                    showPulsing = true;
                  } else if (tok.status === 'IN_CONSULTATION') {
                    badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
                  } else if (tok.status === 'COMPLETED') {
                    badgeClass = "bg-blue-50 text-blue-700 border-blue-100";
                  } else if (tok.status === 'SKIPPED') {
                    badgeClass = "bg-rose-50 text-rose-700 border-rose-100";
                  }

                  return (
                    <div 
                      key={tok.id} 
                      className={`p-4 hover:bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition ${showPulsing ? 'bg-amber-50/20' : ''}`}
                    >
                      {/* Left: Token Number and Patient Metadata */}
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg border border-slate-200 bg-slate-50 text-center shrink-0">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Token</span>
                          <span className="text-sm font-black text-slate-800">{tok.tokenNumber}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">{tok.patient.name}</span>
                            <span className={`px-2 py-0.5 border rounded-full text-[10px] font-bold ${badgeClass}`}>
                              {tok.status} {showPulsing && <span className="inline-block w-1.5 h-1.5 bg-amber-600 rounded-full animate-ping ml-1" />}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Allocated: Dr. {tok.doctor.name} • Registered: {new Date(tok.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {/* Right: Interactive Actions */}
                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        {tok.status === 'WAITING' && (
                          <>
                            <button
                              onClick={() => updateTokenStatusMutation.mutate({ id: tok.id, status: 'CALLING' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-md shadow-xs transition"
                            >
                              <Play className="h-3 w-3" /> Call Room
                            </button>
                            <button
                              onClick={() => updateTokenStatusMutation.mutate({ id: tok.id, status: 'SKIPPED' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition"
                            >
                              <SkipForward className="h-3 w-3" /> Skip
                            </button>
                          </>
                        )}

                        {tok.status === 'CALLING' && (
                          <>
                            <button
                              onClick={() => updateTokenStatusMutation.mutate({ id: tok.id, status: 'IN_CONSULTATION' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md shadow-xs transition"
                            >
                              <Stethoscope className="h-3 w-3" /> Start Consultation
                            </button>
                            <button
                              onClick={() => updateTokenStatusMutation.mutate({ id: tok.id, status: 'SKIPPED' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition"
                            >
                              <SkipForward className="h-3 w-3" /> Skip
                            </button>
                          </>
                        )}

                        {tok.status === 'IN_CONSULTATION' && (
                          <>
                            <button
                              onClick={() => updateTokenStatusMutation.mutate({ id: tok.id, status: 'COMPLETED' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition"
                            >
                              <Check className="h-3.5 w-3.5" /> Mark Completed
                            </button>
                            <button
                              onClick={() => {
                                billingForm.reset({
                                  patientId: tok.patientId,
                                  doctorId: tok.doctorId,
                                  status: 'pending',
                                  items: [{ description: 'Clinic Consultation Fee', quantity: 1, unitPrice: 150 }],
                                  taxRate: 0,
                                  discount: 0
                                });
                                setShowBillingModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md transition"
                            >
                              <DollarSign className="h-3 w-3 text-amber-600" /> Bill Patient
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setPrintedToken(tok)}
                          title="Print Ticket"
                          className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-100 rounded-md hover:bg-slate-50 transition"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Ticket/Token Printing Modal Overlay */}
      {printedToken && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xl max-w-sm w-full text-center relative">
            <button 
              onClick={() => setPrintedToken(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="border-b border-dashed border-slate-200 pb-4 mb-4">
              <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider">HOSPITAL CLINIC TICKET</h3>
              <p className="text-xl font-bold text-slate-800 mt-1">Token Queue System</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Date: {todayDateString}</p>
            </div>

            <div className="py-4 my-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">YOUR QUEUE NUMBER</span>
              <span className="text-6xl font-black text-slate-900 tracking-tight block my-2">
                {printedToken.tokenNumber}
              </span>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 inline-block">
                {printedToken.status || 'WAITING'}
              </span>
            </div>

            <div className="border-t border-dashed border-slate-200 pt-4 text-xs space-y-1 text-slate-600 text-left">
              <div className="flex justify-between">
                <span className="font-medium text-slate-400">Patient:</span>
                <span className="font-extrabold text-slate-800">{printedToken.patient?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-400">Doctor Assigned:</span>
                <span className="font-extrabold text-slate-800">Dr. {printedToken.doctor?.name}</span>
              </div>
              {printedToken.notes && (
                <div className="flex justify-between">
                  <span className="font-medium text-slate-400">Notes:</span>
                  <span className="text-slate-500 italic text-right max-w-[200px] truncate">{printedToken.notes}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 inline-flex justify-center items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-850 rounded-lg shadow-xs transition"
              >
                <Printer className="h-3.5 w-3.5" /> Print Ticket
              </button>
              <button
                onClick={() => setPrintedToken(null)}
                className="flex-1 px-4 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Walk-In Registration & Token Assignment */}
      {showWalkinModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative">
            <button 
              onClick={() => setShowWalkinModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-extrabold text-slate-800 mb-2 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              Unified Walk-in Patient Entry
            </h2>
            <p className="text-xs text-slate-400 mb-6 border-b border-slate-100 pb-3">
              Register a new patient record and automatically issue an active check-in token in one transaction.
            </p>

            <form onSubmit={walkinForm.handleSubmit((data) => walkinMutation.mutate(data))} className="space-y-4 text-left">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Full Name *</label>
                  <input
                    type="text"
                    {...walkinForm.register('name')}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
                  />
                  {walkinForm.formState.errors.name && (
                    <p className="text-[11px] text-rose-500 mt-0.5">{walkinForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Email Address *</label>
                  <input
                    type="email"
                    {...walkinForm.register('email')}
                    placeholder="john@example.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
                  />
                  {walkinForm.formState.errors.email && (
                    <p className="text-[11px] text-rose-500 mt-0.5">{walkinForm.formState.errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    {...walkinForm.register('phone')}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
                  />
                  {walkinForm.formState.errors.phone && (
                    <p className="text-[11px] text-rose-500 mt-0.5">{walkinForm.formState.errors.phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    {...walkinForm.register('dob')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
                  />
                  {walkinForm.formState.errors.dob && (
                    <p className="text-[11px] text-rose-500 mt-0.5">{walkinForm.formState.errors.dob.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Gender *</label>
                  <select
                    {...walkinForm.register('gender')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Blood Group (Optional)</label>
                  <input
                    type="text"
                    {...walkinForm.register('bloodGroup')}
                    placeholder="O+ / AB-"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Clinic Address (Optional)</label>
                  <input
                    type="text"
                    {...walkinForm.register('address')}
                    placeholder="Street, City"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
                  />
                </div>
              </div>

              <div className="border-t border-slate-150 pt-4 space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Queue Allocation & Reason</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Select Physician *</label>
                    <select
                      {...walkinForm.register('doctorId')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700 bg-white"
                    >
                      <option value="">-- Choose Doctor --</option>
                      {doctors.map((doc: any) => (
                        <option key={doc.id} value={doc.id}>Dr. {doc.name}</option>
                      ))}
                    </select>
                    {walkinForm.formState.errors.doctorId && (
                      <p className="text-[11px] text-rose-500 mt-0.5">{walkinForm.formState.errors.doctorId.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Reason for Visit *</label>
                    <input
                      type="text"
                      {...walkinForm.register('reason')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
                    />
                    {walkinForm.formState.errors.reason && (
                      <p className="text-[11px] text-rose-500 mt-0.5">{walkinForm.formState.errors.reason.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Front desk comments</label>
                  <textarea
                    {...walkinForm.register('notes')}
                    placeholder="Patient requests immediate room check due to pain..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowWalkinModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={walkinMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  {walkinMutation.isPending ? 'Registering...' : 'Register & Check In'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Quick Appointment Booking */}
      {showQuickApptModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xl max-w-md w-full relative">
            <button 
              onClick={() => setShowQuickApptModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-extrabold text-slate-800 mb-2 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              Quick Appointment Booking
            </h2>
            <p className="text-xs text-slate-400 mb-6 border-b border-slate-100 pb-3">
              Quickly allocate an appointment slot for today.
            </p>

            <form onSubmit={quickApptForm.handleSubmit((data) => quickApptMutation.mutate(data))} className="space-y-4 text-left">
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Select Patient *</label>
                <select
                  {...quickApptForm.register('patientId')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700 bg-white"
                >
                  <option value="">-- Choose Patient --</option>
                  {appointmentsList.map((a: any) => a.patient).filter((val, idx, self) => self.findIndex(t => t.id === val.id) === idx).map((pat: any) => (
                    <option key={pat.id} value={pat.id}>{pat.name} ({pat.phone})</option>
                  ))}
                  {/* Fallback to searched patients or list */}
                  {searchedPatients.map((pat: any) => (
                    <option key={pat.id} value={pat.id}>{pat.name} (Search Result)</option>
                  ))}
                </select>
                {quickApptForm.formState.errors.patientId && (
                  <p className="text-[11px] text-rose-500 mt-0.5">{quickApptForm.formState.errors.patientId.message}</p>
                )}
                <p className="text-[9px] text-slate-400 mt-1">If patient is not listed, use the "Patient & Token Launcher" search box on the left first.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Select Doctor *</label>
                <select
                  {...quickApptForm.register('doctorId')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700 bg-white"
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map((doc: any) => (
                    <option key={doc.id} value={doc.id}>Dr. {doc.name}</option>
                  ))}
                </select>
                {quickApptForm.formState.errors.doctorId && (
                  <p className="text-[11px] text-rose-500 mt-0.5">{quickApptForm.formState.errors.doctorId.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Date</label>
                  <input
                    type="text"
                    disabled
                    value={todayDateString}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-400 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Slot Time (HH:MM) *</label>
                  <input
                    type="text"
                    {...quickApptForm.register('time')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
                  />
                  {quickApptForm.formState.errors.time && (
                    <p className="text-[11px] text-rose-500 mt-0.5">{quickApptForm.formState.errors.time.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Reason for Appointment *</label>
                <input
                  type="text"
                  {...quickApptForm.register('reason')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700"
                />
                {quickApptForm.formState.errors.reason && (
                  <p className="text-[11px] text-rose-500 mt-0.5">{quickApptForm.formState.errors.reason.message}</p>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowQuickApptModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickApptMutation.isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  {quickApptMutation.isPending ? 'Booking...' : 'Book Slot'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Billing Shortcut / Quick Invoice Maker */}
      {showBillingModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto relative">
            <button 
              onClick={() => setShowBillingModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-extrabold text-slate-800 mb-2 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Quick Billing & Invoicing Shortcut
            </h2>
            <p className="text-xs text-slate-400 mb-6 border-b border-slate-100 pb-3">
              Instantly create a payment record or request for consultation fees, medicine cost, or tests.
            </p>

            <form onSubmit={billingForm.handleSubmit((data) => createInvoiceMutation.mutate(data))} className="space-y-4 text-left">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Target Patient *</label>
                  <select
                    {...billingForm.register('patientId')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700 bg-white"
                  >
                    <option value="">-- Select Patient --</option>
                    {appointmentsList.map((a: any) => a.patient).filter((val, idx, self) => self.findIndex(t => t.id === val.id) === idx).map((pat: any) => (
                      <option key={pat.id} value={pat.id}>{pat.name} ({pat.phone})</option>
                    ))}
                    {searchedPatients.map((pat: any) => (
                      <option key={pat.id} value={pat.id}>{pat.name} (Search Result)</option>
                    ))}
                  </select>
                  {billingForm.formState.errors.patientId && (
                    <p className="text-[11px] text-rose-500 mt-0.5">{billingForm.formState.errors.patientId.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Attending Doctor (Optional)</label>
                  <select
                    {...billingForm.register('doctorId')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700 bg-white"
                  >
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map((doc: any) => (
                      <option key={doc.id} value={doc.id}>Dr. {doc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Line Items</h3>
                  <button
                    type="button"
                    onClick={() => appendBillingItem({ description: 'General Medicine/Fees', quantity: 1, unitPrice: 50 })}
                    className="text-xs font-extrabold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Add Row
                  </button>
                </div>

                <div className="space-y-2">
                  {billingItems.map((item, index) => (
                    <div key={item.id} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="General Consultation Fee, Laboratory Test..."
                          {...billingForm.register(`items.${index}.description` as const)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700"
                        />
                      </div>
                      <div className="w-16">
                        <input
                          type="number"
                          placeholder="Qty"
                          {...billingForm.register(`items.${index}.quantity` as const)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 text-center"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Unit Price"
                          {...billingForm.register(`items.${index}.unitPrice` as const)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700"
                        />
                      </div>
                      {billingItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBillingItem(index)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 transition"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Invoice Calculations and Payment Status */}
              <div className="border-t border-slate-150 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          value="pending"
                          {...billingForm.register('status')}
                          className="text-emerald-600"
                        />
                        Pending Payment
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          value="paid"
                          {...billingForm.register('status')}
                          className="text-emerald-600"
                        />
                        Paid Immediately
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Admin Notes</label>
                    <input
                      type="text"
                      {...billingForm.register('notes')}
                      placeholder="Consultation + General checkup"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-xs text-slate-600 border border-slate-100">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-bold">${subTotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Tax (e.g. 5%):</span>
                    <input
                      type="number"
                      {...billingForm.register('taxRate')}
                      className="w-12 px-1 text-right border border-slate-200 bg-white rounded-sm text-xs py-0.5"
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Discount ($):</span>
                    <input
                      type="number"
                      {...billingForm.register('discount')}
                      className="w-16 px-1 text-right border border-slate-200 bg-white rounded-sm text-xs py-0.5"
                    />
                  </div>

                  <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-800">
                    <span>Grand Total:</span>
                    <span className="text-emerald-600">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>

              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowBillingModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createInvoiceMutation.isPending}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  {createInvoiceMutation.isPending ? 'Processing...' : 'Generate Invoice'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
