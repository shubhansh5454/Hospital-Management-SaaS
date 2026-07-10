import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Stethoscope, 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  Calendar, 
  Clock, 
  X, 
  Briefcase, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Award,
  CheckCircle,
  AlertCircle,
  PlusCircle,
  CalendarCheck
} from 'lucide-react';
import { DoctorUser, DoctorAvailability, DoctorLeave } from '../types/index.ts';

// Zod schemas for forms
const doctorFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please provide a valid email"),
  specialization: z.string().min(2, "Specialization must be at least 2 characters"),
  biography: z.string().optional(),
  experienceYrs: z.number().nonnegative("Experience must be a positive number"),
});

const scheduleFormSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM"),
});

const leaveFormSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  reason: z.string().optional(),
});

type DoctorFormValues = z.infer<typeof doctorFormSchema>;
type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;
type LeaveFormValues = z.infer<typeof leaveFormSchema>;

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export default function Doctors() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const userRole = profile?.role || 'patient';
  const isWritable = userRole === 'admin' || userRole === 'receptionist';

  // Component states
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(8);

  // Modal / Form toggle states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorUser | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Success / Error messages
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const displayAlert = (type: 'success' | 'error', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // 1. Fetch Doctors list with Search and Pagination
  const { data: doctorsData, isLoading: loadingDoctors } = useQuery({
    queryKey: ['doctors', searchTerm, specializationFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchTerm) params.append('search', searchTerm);
      if (specializationFilter) params.append('specialization', specializationFilter);

      const res = await fetch(`/api/doctors?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load doctors');
      return res.json() as Promise<{
        doctors: DoctorUser[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>;
    }
  });

  // 2. Fetch single Doctor details
  const { data: activeDoctor, isLoading: loadingActiveDoctor } = useQuery({
    queryKey: ['doctor', selectedDoctorId],
    queryFn: async () => {
      if (!selectedDoctorId) return null;
      const res = await fetch(`/api/doctors/${selectedDoctorId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load doctor details');
      return res.json() as Promise<DoctorUser>;
    },
    enabled: !!selectedDoctorId,
  });

  // 3. Fetch all unique specializations for filter dropdown
  const { data: specializations = [] } = useQuery({
    queryKey: ['specializations'],
    queryFn: async () => {
      const res = await fetch('/api/doctors/specializations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json() as Promise<string[]>;
    }
  });

  // React Hook Forms
  const doctorForm = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: { name: '', email: '', specialization: '', biography: '', experienceYrs: 0 }
  });

  const scheduleForm = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
  });

  const leaveForm = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: { startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], reason: '' }
  });

  // Mutations
  const createDoctorMutation = useMutation({
    mutationFn: async (data: DoctorFormValues) => {
      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to add doctor');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      queryClient.invalidateQueries({ queryKey: ['specializations'] });
      setShowAddModal(false);
      doctorForm.reset();
      displayAlert('success', 'Doctor added successfully!');
    },
    onError: (err: any) => {
      displayAlert('error', err.message || 'An error occurred.');
    }
  });

  const updateDoctorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: DoctorFormValues }) => {
      const res = await fetch(`/api/doctors/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update doctor');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      queryClient.invalidateQueries({ queryKey: ['doctor', selectedDoctorId] });
      setEditingDoctor(null);
      displayAlert('success', 'Doctor profile updated!');
    },
    onError: (err: any) => {
      displayAlert('error', err.message || 'An error occurred.');
    }
  });

  const deleteDoctorMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/doctors/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete doctor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      setSelectedDoctorId(null);
      displayAlert('success', 'Doctor successfully deleted.');
    }
  });

  const addScheduleMutation = useMutation({
    mutationFn: async (data: ScheduleFormValues) => {
      const res = await fetch(`/api/doctors/${selectedDoctorId}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to add schedule slot');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', selectedDoctorId] });
      setShowScheduleModal(false);
      scheduleForm.reset({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' });
      displayAlert('success', 'Availability slot added!');
    }
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const res = await fetch(`/api/doctors/${selectedDoctorId}/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete schedule slot');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', selectedDoctorId] });
      displayAlert('success', 'Availability slot removed.');
    }
  });

  const addLeaveMutation = useMutation({
    mutationFn: async (data: LeaveFormValues) => {
      const res = await fetch(`/api/doctors/${selectedDoctorId}/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to submit leave request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', selectedDoctorId] });
      setShowLeaveModal(false);
      leaveForm.reset();
      displayAlert('success', 'Leave registered successfully!');
    }
  });

  const deleteLeaveMutation = useMutation({
    mutationFn: async (leaveId: number) => {
      const res = await fetch(`/api/doctors/${selectedDoctorId}/leaves/${leaveId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete leave');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', selectedDoctorId] });
      displayAlert('success', 'Leave record cancelled.');
    }
  });

  // Action Handlers
  const handleCreateDoctor = (data: DoctorFormValues) => {
    createDoctorMutation.mutate(data);
  };

  const handleUpdateDoctor = (data: DoctorFormValues) => {
    if (editingDoctor) {
      updateDoctorMutation.mutate({ id: editingDoctor.id, data });
    }
  };

  const handleDeleteDoctor = (id: number) => {
    if (confirm('Are you absolutely sure you want to delete this doctor? This action cannot be undone.')) {
      deleteDoctorMutation.mutate(id);
    }
  };

  const openEditModal = (doctor: DoctorUser) => {
    setEditingDoctor(doctor);
    doctorForm.reset({
      name: doctor.name,
      email: doctor.email,
      specialization: doctor.doctorProfile?.specialization || '',
      biography: doctor.doctorProfile?.biography || '',
      experienceYrs: doctor.doctorProfile?.experienceYrs || 0,
    });
  };

  return (
    <div id="doctors_container" className="space-y-6 max-w-7xl mx-auto">
      {/* Alert Banner */}
      {alertMsg && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border transition-all duration-300 ${
          alertMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : 'bg-rose-50 border-rose-100 text-rose-800'
        }`}>
          {alertMsg.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="text-sm font-medium">{alertMsg.text}</span>
        </div>
      )}

      {/* Main Grid: Left Side List + Right Side Active Profile View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Doctor List (Left 5 cols or Full width if none selected) */}
        <div className={`space-y-4 ${selectedDoctorId ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {/* Header & Controls Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-display font-bold text-slate-800">Clinic Practitioners</h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage schedules, leaves, and specialist files</p>
              </div>
              {isWritable && (
                <button
                  onClick={() => {
                    doctorForm.reset({ name: '', email: '', specialization: '', biography: '', experienceYrs: 0 });
                    setShowAddModal(true);
                  }}
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all duration-150 cursor-pointer self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Doctor</span>
                </button>
              )}
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search doctors by name, email or specialty..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                />
              </div>

              <select
                value={specializationFilter}
                onChange={(e) => {
                  setSpecializationFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:ring-1 focus:ring-teal-500 outline-none"
              >
                <option value="">All Specializations</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>
          </div>

          {/* List View */}
          {loadingDoctors ? (
            <div className="flex justify-center py-12 bg-white rounded-2xl border border-slate-100">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          ) : doctorsData?.doctors.length === 0 ? (
            <div className="bg-white py-16 text-center rounded-2xl border border-slate-100 shadow-sm">
              <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-800 font-bold text-sm">No doctors found</p>
              <p className="text-slate-400 text-xs mt-1">Try refining your search queries or adding a new practitioner file.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
              {doctorsData?.doctors.map((doctor) => {
                const isSelected = selectedDoctorId === doctor.id;
                return (
                  <div
                    key={doctor.id}
                    onClick={() => setSelectedDoctorId(doctor.id)}
                    className={`p-5 bg-white border rounded-2xl cursor-pointer transition-all duration-200 flex items-start justify-between gap-4 group ${
                      isSelected 
                        ? 'border-teal-500 ring-1 ring-teal-500 shadow-sm shadow-teal-500/5' 
                        : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-4 overflow-hidden">
                      <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                        {doctor.name.substring(0, 2)}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-semibold text-slate-800 text-sm truncate">{doctor.name}</h4>
                        <div className="flex items-center gap-1.5 mt-1 text-slate-400 text-[11px] truncate">
                          <span className="font-medium text-teal-600 bg-teal-50 border border-teal-100/50 px-1.5 py-0.5 rounded-md uppercase tracking-wider text-[9px]">
                            {doctor.doctorProfile?.specialization || 'General'}
                          </span>
                          <span>•</span>
                          <span>{doctor.doctorProfile?.experienceYrs || 0} yrs experience</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5 truncate">{doctor.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end justify-between self-stretch">
                      <ChevronRight className={`w-4 h-4 transition-transform ${
                        isSelected ? 'translate-x-1 text-teal-500' : 'text-slate-300 group-hover:translate-x-0.5'
                      }`} />
                      {isWritable && (
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(doctor);
                            }}
                            title="Edit Doctor"
                            className="p-1 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-50"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDoctor(doctor.id);
                            }}
                            title="Delete Doctor"
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {doctorsData && doctorsData.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-xs">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="text-slate-500 font-medium">
                Page <strong>{page}</strong> of <strong>{doctorsData.totalPages}</strong>
              </span>
              <button
                disabled={page >= doctorsData.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Doctor Details + Availability Calendar (Right 7 cols) */}
        {selectedDoctorId && (
          <div className="lg:col-span-7 space-y-6">
            {loadingActiveDoctor ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
              </div>
            ) : activeDoctor ? (
              <div className="space-y-6">
                {/* Profile Card Header */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <button
                      onClick={() => setSelectedDoctorId(null)}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start gap-5">
                    <div className="w-14 h-14 bg-teal-50 text-teal-700 border border-teal-100 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 uppercase shadow-sm">
                      {activeDoctor.name.substring(0, 2)}
                    </div>
                    <div className="space-y-2 flex-1">
                      <div>
                        <h3 className="text-lg font-display font-bold text-slate-800">{activeDoctor.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{activeDoctor.email}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5 text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-lg font-medium text-[11px] uppercase tracking-wider">
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>{activeDoctor.doctorProfile?.specialization}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-lg font-medium">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span>{activeDoctor.doctorProfile?.experienceYrs} Years Practice</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {activeDoctor.doctorProfile?.biography && (
                    <div className="mt-6 pt-5 border-t border-slate-100">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>Professional Biography</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/60">
                        {activeDoctor.doctorProfile.biography}
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. Interactive Availability Calendar Tab */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-teal-500" />
                        <span>Availability Weekly Calendar</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Recurring weekly hours for patient schedules</p>
                    </div>
                    {isWritable && (
                      <button
                        onClick={() => {
                          scheduleForm.reset({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' });
                          setShowScheduleModal(true);
                        }}
                        className="text-[11px] text-teal-600 bg-teal-50 hover:bg-teal-100/70 border border-teal-100 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all duration-150 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Add Slot</span>
                      </button>
                    )}
                  </div>

                  {/* Availability Weekly Grid Controller */}
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                    {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                      const daySlots = activeDoctor.doctorProfile?.schedules.filter(s => s.dayOfWeek === dayIdx) || [];
                      const isToday = new Date().getDay() === dayIdx;

                      return (
                        <div 
                          key={dayIdx} 
                          className={`p-3 rounded-xl border flex flex-col justify-between min-h-[110px] transition-all ${
                            isToday 
                              ? 'border-teal-500 bg-teal-50/10 shadow-sm shadow-teal-500/5' 
                              : 'border-slate-100 bg-slate-50/30'
                          }`}
                        >
                          <div>
                            <span className={`text-[11px] font-bold block ${
                              isToday ? 'text-teal-700' : 'text-slate-600'
                            }`}>
                              {DAYS_OF_WEEK[dayIdx].substring(0, 3)}
                            </span>
                            {isToday && (
                              <span className="text-[9px] text-teal-600 bg-teal-50 border border-teal-100 px-1 rounded-md font-semibold mt-0.5 inline-block">
                                Today
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5 mt-3">
                            {daySlots.length === 0 ? (
                              <span className="text-[10px] text-slate-400 block italic leading-snug">Off Duty</span>
                            ) : (
                              daySlots.map((slot) => (
                                <div 
                                  key={slot.id} 
                                  className="text-[10px] font-medium text-teal-800 bg-teal-50/80 border border-teal-100 px-1.5 py-1 rounded-lg flex items-center justify-between gap-1 group relative overflow-hidden"
                                >
                                  <span className="font-mono">{slot.startTime}-{slot.endTime}</span>
                                  {isWritable && (
                                    <button
                                      onClick={() => deleteScheduleMutation.mutate(slot.id)}
                                      title="Remove Hours"
                                      className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Leave Management Module */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-rose-500" />
                        <span>Leave Registry</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Time off periods and vacation requests</p>
                    </div>
                    {isWritable && (
                      <button
                        onClick={() => {
                          leaveForm.reset({
                            startDate: new Date().toISOString().split('T')[0],
                            endDate: new Date().toISOString().split('T')[0],
                            reason: '',
                          });
                          setShowLeaveModal(true);
                        }}
                        className="text-[11px] text-rose-600 bg-rose-50 hover:bg-rose-100/70 border border-rose-100 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all duration-150 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Register Leave</span>
                      </button>
                    )}
                  </div>

                  {activeDoctor.doctorProfile?.leaves && activeDoctor.doctorProfile.leaves.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500 text-xs">No active leave or vacations found</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {activeDoctor.doctorProfile?.leaves.map((leave) => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const isUpcoming = leave.startDate > todayStr;
                        const isCurrent = leave.startDate <= todayStr && leave.endDate >= todayStr;

                        return (
                          <div 
                            key={leave.id} 
                            className="p-3.5 border border-slate-100 rounded-xl flex items-center justify-between gap-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                isCurrent 
                                  ? 'bg-rose-50 border-rose-100 text-rose-600' 
                                  : 'bg-amber-50 border-amber-100/70 text-amber-600'
                              }`}>
                                <Calendar className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-700 font-mono">
                                    {leave.startDate} to {leave.endDate}
                                  </span>
                                  {isCurrent ? (
                                    <span className="text-[9px] bg-rose-50 border border-rose-100 text-rose-600 font-semibold px-1.5 py-0.5 rounded-md">
                                      Active Now
                                    </span>
                                  ) : isUpcoming ? (
                                    <span className="text-[9px] bg-amber-50 border border-amber-100/70 text-amber-600 font-semibold px-1.5 py-0.5 rounded-md">
                                      Scheduled
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 font-semibold px-1.5 py-0.5 rounded-md">
                                      Past
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Reason: {leave.reason || 'Not provided'}
                                </p>
                              </div>
                            </div>

                            {isWritable && (
                              <button
                                onClick={() => {
                                  if (confirm('Cancel this scheduled leave?')) {
                                    deleteLeaveMutation.mutate(leave.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Cancel Leave"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD DOCTOR */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50">
              <h4 className="text-sm font-display font-bold text-slate-800">Register New Practitioner</h4>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={doctorForm.handleSubmit(handleCreateDoctor)} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400 block">Full Name</label>
                <input
                  type="text"
                  placeholder="Dr. Jordan Chase"
                  {...doctorForm.register('name')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                />
                {doctorForm.formState.errors.name && (
                  <p className="text-[10px] text-red-500">{doctorForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400 block">Email Address</label>
                <input
                  type="email"
                  placeholder="jordan.chase@clinic.com"
                  {...doctorForm.register('email')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                />
                {doctorForm.formState.errors.email && (
                  <p className="text-[10px] text-red-500">{doctorForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400 block">Specialization</label>
                  <input
                    type="text"
                    placeholder="Cardiologist"
                    {...doctorForm.register('specialization')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                  {doctorForm.formState.errors.specialization && (
                    <p className="text-[10px] text-red-500">{doctorForm.formState.errors.specialization.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400 block">Years Experience</label>
                  <input
                    type="number"
                    placeholder="8"
                    {...doctorForm.register('experienceYrs', { valueAsNumber: true })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                  {doctorForm.formState.errors.experienceYrs && (
                    <p className="text-[10px] text-red-500">{doctorForm.formState.errors.experienceYrs.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400 block">Biography (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Enter details on medical research, credentials, residency..."
                  {...doctorForm.register('biography')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none resize-none"
                />
              </div>

              <div className="h-px bg-slate-100 my-4" />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-9 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDoctorMutation.isPending}
                  className="h-9 px-5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-sm shadow-teal-500/10"
                >
                  {createDoctorMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Register Practitioner</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT DOCTOR */}
      {editingDoctor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50">
              <h4 className="text-sm font-display font-bold text-slate-800">Edit Practitioner File</h4>
              <button 
                onClick={() => setEditingDoctor(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={doctorForm.handleSubmit(handleUpdateDoctor)} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400 block">Full Name</label>
                <input
                  type="text"
                  placeholder="Dr. Jordan Chase"
                  {...doctorForm.register('name')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                />
                {doctorForm.formState.errors.name && (
                  <p className="text-[10px] text-red-500">{doctorForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400 block">Email Address</label>
                <input
                  type="email"
                  placeholder="jordan.chase@clinic.com"
                  {...doctorForm.register('email')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                />
                {doctorForm.formState.errors.email && (
                  <p className="text-[10px] text-red-500">{doctorForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400 block">Specialization</label>
                  <input
                    type="text"
                    placeholder="Cardiologist"
                    {...doctorForm.register('specialization')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                  {doctorForm.formState.errors.specialization && (
                    <p className="text-[10px] text-red-500">{doctorForm.formState.errors.specialization.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400 block">Years Experience</label>
                  <input
                    type="number"
                    placeholder="8"
                    {...doctorForm.register('experienceYrs', { valueAsNumber: true })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                  {doctorForm.formState.errors.experienceYrs && (
                    <p className="text-[10px] text-red-500">{doctorForm.formState.errors.experienceYrs.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400 block">Biography (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Enter details on residency, medical certifications..."
                  {...doctorForm.register('biography')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none resize-none"
                />
              </div>

              <div className="h-px bg-slate-100 my-4" />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingDoctor(null)}
                  className="h-9 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateDoctorMutation.isPending}
                  className="h-9 px-5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-sm shadow-teal-500/10"
                >
                  {updateDoctorMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Practitioner</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD SCHEDULE SLOT */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50">
              <h4 className="text-sm font-display font-bold text-slate-800">Add Availability Slot</h4>
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={scheduleForm.handleSubmit((data) => addScheduleMutation.mutate(data))} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400 block">Day of the Week</label>
                <select
                  {...scheduleForm.register('dayOfWeek', { valueAsNumber: true })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:ring-1 focus:ring-teal-500 outline-none"
                >
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                  <option value={0}>Sunday</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400 block">Start Time (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="09:00"
                    {...scheduleForm.register('startTime')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none font-mono"
                  />
                  {scheduleForm.formState.errors.startTime && (
                    <p className="text-[10px] text-red-500">{scheduleForm.formState.errors.startTime.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400 block">End Time (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="17:00"
                    {...scheduleForm.register('endTime')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none font-mono"
                  />
                  {scheduleForm.formState.errors.endTime && (
                    <p className="text-[10px] text-red-500">{scheduleForm.formState.errors.endTime.message}</p>
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-100 my-4" />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="h-9 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addScheduleMutation.isPending}
                  className="h-9 px-5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-sm shadow-teal-500/10"
                >
                  {addScheduleMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Slot</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REGISTER LEAVE */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50">
              <h4 className="text-sm font-display font-bold text-slate-800">Register Practitioner Leave</h4>
              <button 
                onClick={() => setShowLeaveModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={leaveForm.handleSubmit((data) => addLeaveMutation.mutate(data))} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400 block">Start Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  {...leaveForm.register('startDate')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                />
                {leaveForm.formState.errors.startDate && (
                  <p className="text-[10px] text-red-500">{leaveForm.formState.errors.startDate.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400 block">End Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  {...leaveForm.register('endDate')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                />
                {leaveForm.formState.errors.endDate && (
                  <p className="text-[10px] text-red-500">{leaveForm.formState.errors.endDate.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400 block">Reason / Description</label>
                <input
                  type="text"
                  placeholder="Medical Seminar, Annual Leave, Sick Day..."
                  {...leaveForm.register('reason')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="h-px bg-slate-100 my-4" />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="h-9 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLeaveMutation.isPending}
                  className="h-9 px-5 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-sm shadow-rose-500/10"
                >
                  {addLeaveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Register Leave</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
