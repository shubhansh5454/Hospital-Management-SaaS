import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  Stethoscope, 
  User, 
  Plus, 
  Check, 
  X, 
  AlertCircle, 
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Grid,
  List as ListIcon,
  Trash2,
  Pencil,
  RotateCcw,
  BookOpen,
  UserCheck,
  CheckSquare,
  XSquare,
  AlertTriangle
} from 'lucide-react';

// Form validation schema
const appointmentFormSchema = z.object({
  patientId: z.number().min(1, "Please choose a patient"),
  doctorId: z.number().min(1, "Please choose a doctor"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  reason: z.string().min(2, "Reason must be at least 2 characters"),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']),
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

export default function Appointments() {
  const { token, profile } = useAuth();
  const role = profile?.role || 'patient';
  const queryClient = useQueryClient();

  // Search, Filters & Pagination State
  const [search, setSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(6);

  // View Mode: 'list' or 'calendar'
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Form Modals State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null);
  
  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);

  // Success & Error Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // TanStack Query: Fetch Doctors (all physicians)
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

  // TanStack Query: Fetch Patients list (for allocations)
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

  // TanStack Query: Fetch Appointments with paginated filter params
  const { data: appData = { appointments: [], pagination: { total: 0, page: 1, limit: 6, totalPages: 0 } }, isLoading: loadingApps, refetch } = useQuery({
    queryKey: ['appointments', page, search, doctorFilter, dateFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (search) params.append('search', search);
      if (doctorFilter) params.append('doctorId', doctorFilter);
      if (dateFilter) params.append('date', dateFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/appointments?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load appointments');
      return res.json();
    },
    enabled: !!token
  });

  // react-hook-form Setup
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      reason: '',
      notes: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      status: 'scheduled',
    }
  });

  // Auto-fill patient role profile
  const matchedPatientForUser = useMemo(() => {
    return patients.find((p: any) => p.email.toLowerCase() === profile?.email?.toLowerCase());
  }, [patients, profile]);

  // Handle open modal for creation
  const handleOpenCreate = () => {
    setEditingAppointment(null);
    reset({
      reason: '',
      notes: '',
      date: selectedDayStr || new Date().toISOString().split('T')[0],
      time: '09:00',
      status: 'scheduled',
    });
    if (role === 'patient' && matchedPatientForUser) {
      setValue('patientId', matchedPatientForUser.id);
    }
    setShowFormModal(true);
  };

  // Handle open modal for editing
  const handleOpenEdit = (app: any) => {
    setEditingAppointment(app);
    reset({
      patientId: app.patientId,
      doctorId: app.doctorId,
      date: app.date,
      time: app.time,
      reason: app.reason,
      notes: app.notes || '',
      status: app.status,
    });
    setShowFormModal(true);
  };

  // TanStack Query Mutation: Create or Update Appointment
  const saveMutation = useMutation({
    mutationFn: async (values: AppointmentFormValues) => {
      const url = editingAppointment 
        ? `/api/appointments/${editingAppointment.id}` 
        : '/api/appointments';
      const method = editingAppointment ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save appointment slot');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setSuccessMessage(editingAppointment ? 'Appointment updated successfully!' : 'Appointment booked successfully!');
      setShowFormModal(false);
      reset();
      setEditingAppointment(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'An error occurred while booking');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  });

  // TanStack Query Mutation: Update Status only (Complete/Cancel)
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
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update status');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setSuccessMessage('Appointment status has been updated.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Error updating status');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  });

  // TanStack Query Mutation: Delete Appointment
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete appointment');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setSuccessMessage('Appointment deleted successfully.');
      setDeletingId(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Error deleting appointment');
      setDeletingId(null);
      setTimeout(() => setErrorMessage(null), 4000);
    }
  });

  const onSubmit = (data: AppointmentFormValues) => {
    saveMutation.mutate(data);
  };

  const handleUpdateStatus = (id: number, status: 'completed' | 'cancelled' | 'scheduled') => {
    statusMutation.mutate({ id, status });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleResetFilters = () => {
    setSearch('');
    setDoctorFilter('');
    setDateFilter('');
    setStatusFilter('');
    setSelectedDayStr(null);
    setPage(1);
  };

  // Calendar Logic Definitions
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Fetch all appointments for the current month to render dots on calendar days
  // We can fetch a broader set of appointments, or we can use the main appData if not paginated.
  // For standard user UX, we query appointments on the currently rendered month.
  const { data: monthAppsData } = useQuery({
    queryKey: ['appointments-calendar', year, month],
    queryFn: async () => {
      const startOfMonStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const params = new URLSearchParams({
        limit: '100', // Load enough for calendar rendering
      });
      const res = await fetch(`/api/appointments?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      return { appointments: [] };
    },
    enabled: !!token
  });

  const monthAppointments = monthAppsData?.appointments || [];

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const daysArray = [];
    
    // Previous month padding days
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      daysArray.push({
        day: prevMonthTotalDays - i,
        isCurrentMonth: false,
        dateString: `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(prevMonthTotalDays - i).padStart(2, '0')}`
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      daysArray.push({
        day: d,
        isCurrentMonth: true,
        dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      });
    }

    // Next month padding days to fill 42 cells grid
    const remainingCells = 42 - daysArray.length;
    for (let n = 1; n <= remainingCells; n++) {
      daysArray.push({
        day: n,
        isCurrentMonth: false,
        dateString: `${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-${String(n).padStart(2, '0')}`
      });
    }

    return daysArray;
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDaySelect = (dateString: string) => {
    setSelectedDayStr(dateString);
    setDateFilter(dateString);
    setPage(1);
  };

  // Quick stats computed
  const stats = useMemo(() => {
    const list = appData?.appointments || [];
    const scheduled = list.filter((a: any) => a.status === 'scheduled').length;
    const completed = list.filter((a: any) => a.status === 'completed').length;
    const cancelled = list.filter((a: any) => a.status === 'cancelled').length;
    return { scheduled, completed, cancelled, total: appData?.pagination?.total || 0 };
  }, [appData]);

  return (
    <div className="space-y-6 font-sans">
      {/* Banner / Premium Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-500 text-white rounded-xl flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-base font-display font-bold text-slate-800">Appointment Ledger</h3>
          </div>
          <p className="text-xs text-slate-400 pl-10">Allocate schedules, verify practitioner availability, and optimize time slots</p>
        </div>

        {/* View Toggle and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-50 border border-slate-100 p-1 rounded-xl flex items-center">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'list' 
                  ? 'bg-white text-teal-600 shadow-xs border border-slate-100/50' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>List Grid</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'calendar' 
                  ? 'bg-white text-teal-600 shadow-xs border border-slate-100/50' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="h-9 px-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Book Session</span>
          </button>
        </div>
      </div>

      {/* Mini Stats Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Scheduled</span>
            <span className="text-sm font-bold text-slate-700">{stats.total} entries</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Pending Actions</span>
            <span className="text-sm font-bold text-slate-700">{stats.scheduled} scheduled</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Visits Completed</span>
            <span className="text-sm font-bold text-slate-700">{stats.completed} done</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <X className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Cancellations</span>
            <span className="text-sm font-bold text-slate-700">{stats.cancelled} cancelled</span>
          </div>
        </div>
      </div>

      {/* Success / Error Toast Notifications */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex gap-3 text-xs font-medium"
          >
            <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}

        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex gap-3 text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Search, Filters and Sorting rail */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Text Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by patient, doctor or diagnosis reason..."
              className="w-full h-9 pl-10 pr-4 border border-slate-200 focus:border-teal-500 rounded-xl text-xs font-medium focus:outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Filter options */}
          <div className="grid grid-cols-2 md:flex gap-2">
            {/* Doctor Filter */}
            <select
              value={doctorFilter}
              onChange={(e) => { setDoctorFilter(e.target.value); setPage(1); }}
              className="h-9 px-3 border border-slate-200 focus:border-teal-500 rounded-xl text-xs font-medium bg-white focus:outline-none transition-all"
            >
              <option value="">All Doctors</option>
              {doctors.map((doc: any) => (
                <option key={doc.id} value={doc.id}>Dr. {doc.name}</option>
              ))}
            </select>

            {/* Date Filter */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="h-9 px-3 border border-slate-200 focus:border-teal-500 rounded-xl text-xs font-medium bg-white focus:outline-none transition-all"
            />

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-9 px-3 border border-slate-200 focus:border-teal-500 rounded-xl text-xs font-medium bg-white focus:outline-none transition-all"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Clear Filters */}
            {(search || doctorFilter || dateFilter || statusFilter) && (
              <button
                onClick={handleResetFilters}
                className="h-9 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Selected date helper badge */}
        {selectedDayStr && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-teal-50 border border-teal-100 rounded-lg text-teal-800 text-[11px] font-semibold animate-fadeIn">
            <span>Filtering by date: {selectedDayStr}</span>
            <button 
              onClick={() => { setSelectedDayStr(null); setDateFilter(''); }}
              className="hover:bg-teal-100 rounded p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Calendar View Dashboard */}
      {viewMode === 'calendar' && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-500" />
              <h4 className="text-sm font-bold text-slate-800 font-display">
                {monthNames[month]} {year}
              </h4>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 h-8 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Calendar Grid Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-50">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, idx) => {
              // Check if any appointments fall on this cell's date
              const dayApps = monthAppointments.filter((a: any) => a.date === cell.dateString);
              const isToday = cell.dateString === new Date().toISOString().split('T')[0];
              const isSelected = cell.dateString === selectedDayStr;

              return (
                <div
                  key={idx}
                  onClick={() => handleDaySelect(cell.dateString)}
                  className={`min-h-20 p-2 border border-slate-50 rounded-xl flex flex-col justify-between transition-all cursor-pointer select-none relative group ${
                    cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 opacity-40'
                  } ${
                    isSelected ? 'ring-2 ring-teal-500 bg-teal-50/10' : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Day Number */}
                  <div className="flex justify-between items-center">
                    <span className={`text-[11px] font-bold ${
                      isToday 
                        ? 'w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-xs' 
                        : isSelected ? 'text-teal-600' : 'text-slate-500'
                    }`}>
                      {cell.day}
                    </span>

                    {/* Show Count badge if multiple */}
                    {dayApps.length > 0 && (
                      <span className="text-[9px] font-extrabold text-teal-600 bg-teal-50 px-1 py-0.5 rounded">
                        {dayApps.length}
                      </span>
                    )}
                  </div>

                  {/* Cell Appointments mini-list (Max 2 shown) */}
                  <div className="space-y-1 mt-1 max-h-12 overflow-hidden">
                    {dayApps.slice(0, 2).map((app: any) => (
                      <div
                        key={app.id}
                        className={`text-[9px] px-1 py-0.5 rounded truncate font-medium border ${
                          app.status === 'completed' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : app.status === 'cancelled' 
                              ? 'bg-rose-50 text-rose-700 border-rose-100' 
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}
                        title={`Patient: ${app.patient?.name} | Dr. ${app.doctor?.name}`}
                      >
                        {app.time} - {app.patient?.name ? app.patient.name : 'Unknown'}
                      </div>
                    ))}
                    {dayApps.length > 2 && (
                      <div className="text-[8px] text-slate-400 font-bold italic text-center">
                        + {dayApps.length - 2} more
                      </div>
                    )}
                  </div>

                  {/* Add Appointment inline click hover button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDaySelect(cell.dateString);
                      handleOpenCreate();
                    }}
                    className="absolute right-1 bottom-1 opacity-0 group-hover:opacity-100 transition-opacity bg-teal-500 text-white p-1 rounded-md hover:bg-teal-600"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main List Mode */}
      <div className="space-y-4">
        {loadingApps ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-white border border-slate-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : appData.appointments.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center space-y-3 shadow-xs">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600 font-display">No scheduled ledger rows found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Try updating search queries, checking different doctor assignments, or clicking "Book Session" to schedule a slot.
            </p>
            {(search || doctorFilter || dateFilter || statusFilter) && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          /* Responsive Layout */
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {appData.appointments.map((app: any) => (
                <div 
                  key={app.id} 
                  className="bg-white border border-slate-100/60 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:border-slate-200 hover:shadow-xs transition-all flex flex-col justify-between gap-4 relative overflow-hidden"
                >
                  {/* Status strip */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    app.status === 'completed' ? 'bg-emerald-500' :
                    app.status === 'cancelled' ? 'bg-rose-400' : 'bg-amber-400'
                  }`} />
                  
                  <div className="space-y-3.5">
                    {/* Header: Date, Time & Badges */}
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-50 text-slate-600 border border-slate-100 rounded-lg flex items-center justify-center">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">{app.date}</span>
                          <span className="text-[10px] text-slate-400 font-medium block flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {app.time}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          app.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                          app.status === 'cancelled' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                    </div>

                    {/* Patient & Doctor details */}
                    <div className="space-y-3 text-xs">
                      {/* Patient info */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                          {app.patient?.name ? app.patient.name[0] : 'P'}
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Patient</span>
                          <span className="font-bold text-slate-700 block">{app.patient?.name || 'Unknown'}</span>
                          <span className="text-[10px] text-slate-400 block">{app.patient?.email || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Doctor info */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Stethoscope className="w-3 h-3" />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Practitioner</span>
                          <span className="font-bold text-slate-700 block">Dr. {app.doctor?.name || 'Unknown'}</span>
                        </div>
                      </div>

                      {/* Consultation reason */}
                      <div className="pt-1.5 border-t border-slate-50">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Consultation Reason</span>
                        <p className="text-slate-600 font-semibold">{app.reason}</p>
                      </div>

                      {/* Clinical Notes if specified */}
                      {app.notes && (
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100/60 mt-1">
                          <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Clinical Notes</span>
                          <p className="text-slate-500 italic text-[11px] leading-relaxed">{app.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50 gap-2">
                    {/* Common CRUD Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(app)}
                        className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-teal-600 hover:border-teal-200 hover:bg-teal-50 flex items-center justify-center cursor-pointer transition-colors"
                        title="Edit appointment"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(app.id)}
                        className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors"
                        title="Delete appointment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Complete / Cancel workflow triggers for authorized roles */}
                    {['admin', 'doctor', 'receptionist'].includes(role) && app.status === 'scheduled' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUpdateStatus(app.id, 'cancelled')}
                          className="h-7 px-2.5 border border-rose-100 hover:bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(app.id, 'completed')}
                          className="h-7 px-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-100/30 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Check className="w-3 h-3" />
                          <span>Complete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination controls */}
            {appData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-4">
                <span className="text-xs text-slate-400">
                  Showing page <strong className="text-slate-600">{appData.pagination.page}</strong> of <strong className="text-slate-600">{appData.pagination.totalPages}</strong>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= appData.pagination.totalPages}
                    onClick={() => setPage(p => Math.min(p + 1, appData.pagination.totalPages))}
                    className="h-8 px-3 bg-teal-500 text-white hover:bg-teal-600 text-xs font-semibold rounded-lg disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Book / Edit Slide-over Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xl w-full max-w-lg space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h4 className="text-sm font-display font-bold text-slate-800">
                {editingAppointment ? 'Modify Slot Schedule & Clinical Notes' : 'Appointment Allocation & Session Booking'}
              </h4>
              <button 
                onClick={() => setShowFormModal(false)}
                className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Select Patient */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Patient Profile *</label>
                  {role === 'patient' && matchedPatientForUser ? (
                    <div className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold flex items-center text-slate-700">
                      {matchedPatientForUser.name}
                    </div>
                  ) : (
                    <select
                      {...register('patientId', { valueAsNumber: true })}
                      className="w-full h-9 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none bg-white"
                    >
                      <option value="">Choose Patient</option>
                      {patients.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                      ))}
                    </select>
                  )}
                  {errors.patientId && <p className="text-[10px] text-rose-500 font-medium">{errors.patientId.message}</p>}
                </div>

                {/* Select Doctor */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Physician *</label>
                  <select
                    {...register('doctorId', { valueAsNumber: true })}
                    className="w-full h-9 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none bg-white"
                  >
                    <option value="">Choose Practitioner</option>
                    {doctors.map((doc: any) => (
                      <option key={doc.id} value={doc.id}>Dr. {doc.name}</option>
                    ))}
                  </select>
                  {errors.doctorId && <p className="text-[10px] text-rose-500 font-medium">{errors.doctorId.message}</p>}
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date *</label>
                  <input
                    {...register('date')}
                    type="date"
                    className="w-full h-9 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none"
                  />
                  {errors.date && <p className="text-[10px] text-rose-500 font-medium">{errors.date.message}</p>}
                </div>

                {/* Time */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Time Slot *</label>
                  <select
                    {...register('time')}
                    className="w-full h-9 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none bg-white"
                  >
                    <option value="08:00">08:00 AM</option>
                    <option value="09:00">09:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="12:00">12:00 PM</option>
                    <option value="13:00">01:00 PM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="15:00">03:00 PM</option>
                    <option value="16:00">04:00 PM</option>
                    <option value="17:00">05:00 PM</option>
                  </select>
                  {errors.time && <p className="text-[10px] text-rose-500 font-medium">{errors.time.message}</p>}
                </div>
              </div>

              {/* Consultation Reason */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reason *</label>
                <input
                  {...register('reason')}
                  type="text"
                  placeholder="Clinical reason, follow-up, symptom diagnosis..."
                  className="w-full h-9 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none"
                />
                {errors.reason && <p className="text-[10px] text-rose-500 font-medium">{errors.reason.message}</p>}
              </div>

              {/* Status editing for Admins / Doctors */}
              {editingAppointment && ['admin', 'doctor', 'receptionist'].includes(role) && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status *</label>
                  <select
                    {...register('status')}
                    className="w-full h-9 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none bg-white"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Symptoms / Clinical Observations</label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  placeholder="Additional observations, notes or medications..."
                  className="w-full p-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none"
                />
              </div>

              {/* Double-booking Warning indicator on active submit */}
              {saveMutation.isError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex gap-2.5 text-[11px] font-medium leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{saveMutation.error?.message}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="h-9 px-4 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>{editingAppointment ? 'Save Changes' : 'Confirm Allocation'}</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans animate-fadeIn">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xl w-full max-w-sm text-center space-y-4">
            <div className="w-11 h-11 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">Delete Appointment Record?</h4>
              <p className="text-xs text-slate-400">This operations is irreversible and will purge the patient allocation from clinical archives.</p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="h-9 px-4 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
              >
                No, Keep it
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="h-9 px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
