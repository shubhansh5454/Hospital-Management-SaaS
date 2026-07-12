import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserCheck,
  Building2,
  Calendar,
  Clock,
  Briefcase,
  DollarSign,
  Search,
  Plus,
  Filter,
  CheckCircle,
  XCircle,
  Trash2,
  Edit,
  Shield,
  FileText,
  Upload,
  Download,
  AlertCircle,
  CalendarDays,
  Check,
  X,
  FileCheck
} from 'lucide-react';
import { Department, Staff, Attendance, LeaveRequest, Shift, Payroll, Holiday, StaffDocument } from '../server/services/hr.ts';

export default function HRManagement() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const currentRole = profile?.role || 'patient';
  const isAdmin = ['admin', 'superadmin'].includes(currentRole);

  const [activeTab, setActiveTab] = useState<'staff' | 'departments' | 'attendance' | 'leaves' | 'shifts' | 'payroll' | 'holidays' | 'documents'>('staff');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal controls
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  // Forms state
  const [staffForm, setStaffForm] = useState({
    name: '', email: '', phone: '', departmentId: '', designation: '',
    role: 'staff' as any, joinedDate: new Date().toISOString().split('T')[0],
    status: 'active' as any, basicSalary: 4000, bankName: '', bankAccountNumber: '', shiftId: ''
  });

  const [deptForm, setDeptForm] = useState({
    name: '', code: '', description: '', budget: 50000, status: 'active' as any, managerId: ''
  });

  const [shiftForm, setShiftForm] = useState({
    name: '', startTime: '08:00', endTime: '16:00', color: 'bg-teal-100 text-teal-800 border-teal-200', workingDays: [1, 2, 3, 4, 5]
  });

  const [holidayForm, setHolidayForm] = useState({
    title: '', date: '', type: 'national' as any, description: ''
  });

  const [leaveForm, setLeaveForm] = useState({
    staffId: '', type: 'casual' as any, startDate: '', endDate: '', reason: ''
  });

  const [docForm, setDocForm] = useState({
    staffId: '', name: '', type: 'contract' as any, size: '1.2 MB', url: '/files/contract.pdf'
  });

  const [payrollMonth, setPayrollMonth] = useState('2026-07');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

  // API Request helper
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'API Request failed');
    }
    return res.json();
  };

  // Queries
  const { data: staff = [], isLoading: loadingStaff } = useQuery<Staff[]>({
    queryKey: ['hr-staff'],
    queryFn: () => apiFetch('/api/hr/staff')
  });

  const { data: departments = [], isLoading: loadingDepts } = useQuery<Department[]>({
    queryKey: ['hr-departments'],
    queryFn: () => apiFetch('/api/hr/departments')
  });

  const { data: attendance = [], isLoading: loadingAttendance } = useQuery<Attendance[]>({
    queryKey: ['hr-attendance', attendanceDate],
    queryFn: () => apiFetch(`/api/hr/attendance?date=${attendanceDate}`)
  });

  const { data: leaves = [], isLoading: loadingLeaves } = useQuery<LeaveRequest[]>({
    queryKey: ['hr-leaves'],
    queryFn: () => apiFetch('/api/hr/leaves')
  });

  const { data: shifts = [], isLoading: loadingShifts } = useQuery<Shift[]>({
    queryKey: ['hr-shifts'],
    queryFn: () => apiFetch('/api/hr/shifts')
  });

  const { data: payroll = [], isLoading: loadingPayroll } = useQuery<Payroll[]>({
    queryKey: ['hr-payroll', payrollMonth],
    queryFn: () => apiFetch(`/api/hr/payroll?month=${payrollMonth}`)
  });

  const { data: holidays = [], isLoading: loadingHolidays } = useQuery<Holiday[]>({
    queryKey: ['hr-holidays'],
    queryFn: () => apiFetch('/api/hr/holidays')
  });

  const { data: documents = [], isLoading: loadingDocs } = useQuery<StaffDocument[]>({
    queryKey: ['hr-documents'],
    queryFn: () => apiFetch('/api/hr/documents')
  });

  // Mutations
  const createStaffMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/api/hr/staff', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-staff'] });
      setIsStaffModalOpen(false);
    }
  });

  const updateStaffMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiFetch(`/api/hr/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-staff'] });
      setEditingStaff(null);
      setIsStaffModalOpen(false);
    }
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/staff/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-staff'] })
  });

  const createDeptMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/api/hr/departments', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] });
      setIsDeptModalOpen(false);
    }
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/departments/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-departments'] })
  });

  const clockInMutation = useMutation({
    mutationFn: (data: { staffId: string; clockInTime?: string; notes?: string }) => apiFetch('/api/hr/attendance/clock-in', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-attendance'] })
  });

  const clockOutMutation = useMutation({
    mutationFn: (data: { staffId: string; clockOutTime?: string }) => apiFetch('/api/hr/attendance/clock-out', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-attendance'] })
  });

  const syncAttendanceMutation = useMutation({
    mutationFn: (records: any[]) => apiFetch('/api/hr/attendance/bulk', { method: 'POST', body: JSON.stringify({ records }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-attendance'] })
  });

  const applyLeaveMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/api/hr/leaves', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] });
      setIsLeaveModalOpen(false);
    }
  });

  const reviewLeaveMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: 'approved' | 'rejected'; notes?: string }) =>
      apiFetch(`/api/hr/leaves/${id}/review`, { method: 'PUT', body: JSON.stringify({ status, notes }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hr-staff'] });
    }
  });

  const createShiftMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/api/hr/shifts', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-shifts'] });
      setIsShiftModalOpen(false);
    }
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/shifts/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-shifts'] })
  });

  const generatePayrollMutation = useMutation({
    mutationFn: (month: string) => apiFetch('/api/hr/payroll/generate', { method: 'POST', body: JSON.stringify({ month }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-payroll'] })
  });

  const updatePayrollMutation = useMutation({
    mutationFn: ({ id, status, paymentMethod }: { id: string; status: string; paymentMethod?: string }) =>
      apiFetch(`/api/hr/payroll/${id}`, { method: 'PUT', body: JSON.stringify({ status, paymentMethod }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-payroll'] })
  });

  const createHolidayMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/api/hr/holidays', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-holidays'] });
      setIsHolidayModalOpen(false);
    }
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-holidays'] })
  });

  const createDocMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/api/hr/documents', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-documents'] });
      setIsDocModalOpen(false);
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/hr/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-documents'] })
  });

  // Filtered staff list
  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.email.toLowerCase().includes(searchQuery.toLowerCase()) || s.designation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = deptFilter === 'all' || s.departmentId === deptFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  // Navigation sub-tabs
  const tabs = [
    { id: 'staff', name: 'Staff Profile', icon: Users },
    { id: 'departments', name: 'Departments', icon: Building2 },
    { id: 'attendance', name: 'Attendance log', icon: Clock },
    { id: 'leaves', name: 'Leave Requests', icon: Calendar },
    { id: 'shifts', name: 'Shift Roster', icon: Briefcase },
    { id: 'payroll', name: 'Payroll Ledger', icon: DollarSign },
    { id: 'holidays', name: 'Holidays', icon: CalendarDays },
    { id: 'documents', name: 'Staff Documents', icon: FileText },
  ] as const;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto px-4 py-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-teal-600" /> HR Management Suite
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configure staff records, shift scheduling, payroll sheets, attendance sheets, and leaves tracking.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => {
                  setEditingStaff(null);
                  setStaffForm({
                    name: '', email: '', phone: '', departmentId: departments[0]?.id || '', designation: '',
                    role: 'staff', joinedDate: new Date().toISOString().split('T')[0],
                    status: 'active', basicSalary: 4500, bankName: 'Apex Health Bank', bankAccountNumber: 'XXXX-XXXX-1234', shiftId: shifts[0]?.id || ''
                  });
                  setIsStaffModalOpen(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs px-3.5 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Staff Profile
              </button>
              <button
                onClick={() => {
                  setDeptForm({ name: '', code: '', description: '', budget: 60000, status: 'active', managerId: '' });
                  setIsDeptModalOpen(true);
                }}
                className="bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs px-3.5 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Department
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1 scrollbar-none bg-white p-1 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-teal-50 text-teal-700 font-bold shadow-[0_2px_8px_rgba(13,148,136,0.08)]'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.name}
            </button>
          );
        })}
      </div>

      {/* Active Tab View */}
      <div className="min-h-[450px]">
        {/* ================================= STAFF VIEW ================================= */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            {/* Filters Bar */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff, designation..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>
              <div className="flex flex-wrap gap-3 items-center w-full md:w-auto md:ml-auto">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Filter className="w-3.5 h-3.5" /> Filter by:
                </div>
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-1.5 focus:outline-none"
                >
                  <option value="all">All Departments</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-1.5 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="suspended">Suspended</option>
                  <option value="resigned">Resigned</option>
                </select>
              </div>
            </div>

            {loadingStaff ? (
              <div className="flex items-center justify-center p-12">
                <p className="text-xs text-slate-400">Loading staff database...</p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No staff matches found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or register a new staff member.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStaff.map(s => (
                  <div key={s.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-200 relative overflow-hidden">
                    {/* Status badge */}
                    <div className="absolute top-4 right-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                        s.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                        s.status === 'on_leave' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-4.5 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold font-display text-base border border-slate-200">
                        {s.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 text-sm">{s.name}</h3>
                        <p className="text-xs text-teal-600 font-medium">{s.designation}</p>
                      </div>
                    </div>

                    <div className="space-y-2.5 border-t border-slate-50 pt-4 text-xs text-slate-500">
                      <div className="flex justify-between">
                        <span>Department</span>
                        <span className="font-semibold text-slate-700">{s.departmentName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Role Type</span>
                        <span className="capitalize font-semibold text-slate-700">{s.role}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Shift Assign</span>
                        <span className="text-slate-700 font-semibold">{s.shiftName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Base Salary</span>
                        <span className="text-emerald-700 font-bold">${s.basicSalary.toLocaleString()}/mo</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Joined Date</span>
                        <span>{s.joinedDate}</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex gap-2 border-t border-slate-50 mt-4.5 pt-4">
                        <button
                          onClick={() => {
                            setEditingStaff(s);
                            setStaffForm({
                              name: s.name, email: s.email, phone: s.phone, departmentId: s.departmentId,
                              designation: s.designation, role: s.role, joinedDate: s.joinedDate,
                              status: s.status, basicSalary: s.basicSalary, bankName: s.bankName,
                              bankAccountNumber: s.bankAccountNumber, shiftId: s.shiftId
                            });
                            setIsStaffModalOpen(true);
                          }}
                          className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-[11px] transition flex items-center justify-center gap-1 border border-slate-100"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit Profile
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to remove the staff profile for ${s.name}?`)) {
                              deleteStaffMutation.mutate(s.id);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition border border-rose-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================= DEPARTMENTS VIEW ================================= */}
        {activeTab === 'departments' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map(d => (
              <div key={d.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <span className="bg-teal-50 text-teal-700 border border-teal-100 font-bold text-[10px] px-2 py-0.5 rounded-md">
                    {d.code}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shadow-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm">{d.name}</h3>
                    <p className="text-xs text-slate-400">Created: {new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed min-h-[40px] mb-4.5">{d.description}</p>

                <div className="space-y-2 border-t border-slate-50 pt-4 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Department Head</span>
                    <span className="font-semibold text-slate-700">{d.managerName || 'Not Assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Budget Allocation</span>
                    <span className="font-semibold text-emerald-700">${d.budget.toLocaleString()}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Operation Status</span>
                    <span className="capitalize font-semibold text-emerald-700">{d.status}</span>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex justify-end mt-4 border-t border-slate-50 pt-3">
                    <button
                      onClick={() => {
                        if (confirm(`Delete the ${d.name} department?`)) {
                          deleteDeptMutation.mutate(d.id);
                        }
                      }}
                      className="text-rose-600 hover:text-rose-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Department
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ================================= ATTENDANCE VIEW ================================= */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-teal-600" />
                <span className="text-xs text-slate-500">Pick log date:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={e => setAttendanceDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-1.5 focus:outline-none"
                />
              </div>

              {/* Simulating a clock-in for the current user */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const firstStaff = staff[0];
                    if (firstStaff) {
                      clockInMutation.mutate({ staffId: firstStaff.id });
                      alert(`Mocked Clock-In registered for ${firstStaff.name}!`);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-sm transition"
                >
                  Quick Sim Clock-In
                </button>
                <button
                  onClick={() => {
                    const firstStaff = staff[0];
                    if (firstStaff) {
                      clockOutMutation.mutate({ staffId: firstStaff.id });
                      alert(`Mocked Clock-Out registered for ${firstStaff.name}!`);
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-sm transition"
                >
                  Quick Sim Clock-Out
                </button>
              </div>
            </div>

            {/* Attendance sheet */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-semibold text-slate-800 text-sm">Attendance List for {attendanceDate}</h3>
                {isAdmin && (
                  <button
                    onClick={() => {
                      const records = staff.map(s => {
                        const logged = attendance.find(a => a.staffId === s.id);
                        return {
                          staffId: s.id,
                          date: attendanceDate,
                          clockIn: logged?.clockIn || '09:00',
                          clockOut: logged?.clockOut || '17:00',
                          status: logged?.status || 'present',
                          notes: logged?.notes || 'Regular shift check-in'
                        };
                      });
                      syncAttendanceMutation.mutate(records);
                      alert('All staff records marked as PRESENT today!');
                    }}
                    className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg transition"
                  >
                    Mark All Present Today
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 bg-slate-50/50">
                      <th className="p-4">Staff Member</th>
                      <th className="p-4">Clock-In Time</th>
                      <th className="p-4">Clock-Out Time</th>
                      <th className="p-4">Log Status</th>
                      <th className="p-4">Comments / Notes</th>
                      {isAdmin && <th className="p-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="text-xs text-slate-600">
                    {staff.map(s => {
                      const log = attendance.find(a => a.staffId === s.id);
                      return (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="p-4 font-semibold text-slate-800">{s.name}</td>
                          <td className="p-4">{log?.clockIn || <span className="text-slate-300">-</span>}</td>
                          <td className="p-4">{log?.clockOut || <span className="text-slate-300">-</span>}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log?.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                              log?.status === 'late' ? 'bg-amber-50 text-amber-700' :
                              log?.status === 'on_leave' ? 'bg-indigo-50 text-indigo-700' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {log?.status ? log.status.toUpperCase() : 'NOT RECORDED'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 italic">{log?.notes || '-'}</td>
                          {isAdmin && (
                            <td className="p-4 text-right">
                              <select
                                value={log?.status || 'absent'}
                                onChange={e => {
                                  syncAttendanceMutation.mutate([{
                                    staffId: s.id,
                                    date: attendanceDate,
                                    clockIn: log?.clockIn || '09:00',
                                    clockOut: log?.clockOut || '17:00',
                                    status: e.target.value as any,
                                    notes: 'Manual register change'
                                  }]);
                                }}
                                className="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1"
                              >
                                <option value="present">Present</option>
                                <option value="late">Late</option>
                                <option value="half_day">Half Day</option>
                                <option value="absent">Absent</option>
                                <option value="on_leave">On Leave</option>
                              </select>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================= LEAVE REQUESTS VIEW ================================= */}
        {activeTab === 'leaves' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-sm">
              <h3 className="font-semibold text-slate-800 text-sm">Clinical Leave Planner & Applications</h3>
              <button
                onClick={() => {
                  setLeaveForm({ staffId: staff[0]?.id || '', type: 'casual', startDate: '', endDate: '', reason: '' });
                  setIsLeaveModalOpen(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Apply for Leave
              </button>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 bg-slate-50">
                    <th className="p-4">Staff Member</th>
                    <th className="p-4">Leave Type</th>
                    <th className="p-4">Period</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4">Approval Status</th>
                    {isAdmin && <th className="p-4 text-right">Approval Actions</th>}
                  </tr>
                </thead>
                <tbody className="text-xs text-slate-600">
                  {leaves.map(l => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-4 font-semibold text-slate-800">{l.staffName}</td>
                      <td className="p-4 capitalize">{l.type} Leave</td>
                      <td className="p-4">{l.startDate} to {l.endDate}</td>
                      <td className="p-4 text-slate-500">{l.reason}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          l.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                          l.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="p-4 text-right flex gap-2 justify-end">
                          {l.status === 'pending' && (
                            <>
                              <button
                                onClick={() => reviewLeaveMutation.mutate({ id: l.id, status: 'approved' })}
                                className="p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded border border-emerald-100 transition"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const rsn = prompt('Enter rejection reason:') || 'Policy conditions';
                                  reviewLeaveMutation.mutate({ id: l.id, status: 'rejected', notes: rsn });
                                }}
                                className="p-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded border border-rose-100 transition"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {l.status !== 'pending' && (
                            <span className="text-[11px] text-slate-400 italic">Reviewed by {l.approvedBy}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================= SHIFTS VIEW ================================= */}
        {activeTab === 'shifts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-sm">
              <h3 className="font-semibold text-slate-800 text-sm">Shift Templates & Daily Roster</h3>
              {isAdmin && (
                <button
                  onClick={() => {
                    setShiftForm({ name: '', startTime: '08:00', endTime: '16:00', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', workingDays: [1, 2, 3, 4, 5] });
                    setIsShiftModalOpen(true);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Create Shift Template
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {shifts.map(sh => (
                <div key={sh.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${sh.color}`}>
                      {sh.name}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove shift template "${sh.name}"?`)) {
                            deleteShiftMutation.mutate(sh.id);
                          }
                        }}
                        className="text-rose-600 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3.5 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Shift Hours</span>
                      <span className="font-semibold text-slate-800">{sh.startTime} - {sh.endTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Working Days</span>
                      <span className="font-semibold text-slate-800">
                        {sh.workingDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================= PAYROLL VIEW ================================= */}
        {activeTab === 'payroll' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-teal-600" />
                <span className="text-xs text-slate-500">Select Month:</span>
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={e => setPayrollMonth(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-1.5 focus:outline-none"
                />
              </div>

              {isAdmin && (
                <button
                  onClick={() => generatePayrollMutation.mutate(payrollMonth)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-sm transition"
                >
                  Generate Payroll Sheet
                </button>
              )}
            </div>

            {loadingPayroll ? (
              <div className="text-center p-8 text-slate-400 text-xs">Generating monthly payslips...</div>
            ) : payroll.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <p className="text-sm font-semibold text-slate-700">No payroll generated for {payrollMonth}</p>
                <p className="text-xs text-slate-400 mt-1">Click the "Generate Payroll Sheet" button to compile records.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 bg-slate-50">
                      <th className="p-4">Employee</th>
                      <th className="p-4">Base Salary</th>
                      <th className="p-4">Allowances</th>
                      <th className="p-4">Deductions</th>
                      <th className="p-4">Net Payout</th>
                      <th className="p-4">Payment Status</th>
                      {isAdmin && <th className="p-4 text-right">Disbursement</th>}
                    </tr>
                  </thead>
                  <tbody className="text-xs text-slate-600">
                    {payroll.map(p => (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="p-4 font-semibold text-slate-800">{p.staffName}</td>
                        <td className="p-4">${p.basicSalary.toLocaleString()}</td>
                        <td className="p-4 text-emerald-600">+${p.allowances}</td>
                        <td className="p-4 text-rose-600">-${p.deductions}</td>
                        <td className="p-4 font-bold text-slate-800">${p.netSalary.toLocaleString()}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {p.status.toUpperCase()}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="p-4 text-right">
                            {p.status === 'draft' && (
                              <button
                                onClick={() => updatePayrollMutation.mutate({ id: p.id, status: 'paid', paymentMethod: 'bank_transfer' })}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded transition"
                              >
                                Pay Salary
                              </button>
                            )}
                            {p.status === 'paid' && (
                              <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Disbursed
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================= HOLIDAYS VIEW ================================= */}
        {activeTab === 'holidays' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-sm">
              <h3 className="font-semibold text-slate-800 text-sm">Clinic Holiday Schedule</h3>
              {isAdmin && (
                <button
                  onClick={() => {
                    setHolidayForm({ title: '', date: '', type: 'national', description: '' });
                    setIsHolidayModalOpen(true);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Holiday
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {holidays.map(hol => (
                <div key={hol.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative">
                  <span className="absolute top-4 right-4 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wide px-2 py-0.5 rounded">
                    {hol.type.replace('_', ' ')}
                  </span>

                  <h4 className="font-bold text-slate-800 text-sm mt-1">{hol.title}</h4>
                  <p className="text-xs text-teal-600 font-medium mt-1">Date: {hol.date}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-3">{hol.description}</p>

                  {isAdmin && (
                    <div className="flex justify-end mt-4 border-t border-slate-50 pt-2.5">
                      <button
                        onClick={() => deleteHolidayMutation.mutate(hol.id)}
                        className="text-rose-600 hover:text-rose-700 text-xs font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================= DOCUMENTS VIEW ================================= */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-sm">
              <h3 className="font-semibold text-slate-800 text-sm">HR Document Directory</h3>
              {isAdmin && (
                <button
                  onClick={() => {
                    setDocForm({ staffId: staff[0]?.id || '', name: '', type: 'contract', size: '2.1 MB', url: '/files/contract.pdf' });
                    setIsDocModalOpen(true);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1"
                >
                  <Upload className="w-4 h-4" /> Upload Staff Document
                </button>
              )}
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 bg-slate-50">
                    <th className="p-4">Document Title</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Size</th>
                    <th className="p-4">Upload Date</th>
                    {isAdmin && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="text-xs text-slate-600">
                  {documents.map(d => (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-4 font-semibold text-slate-800 flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-teal-600" />
                        {d.name}
                      </td>
                      <td className="p-4 capitalize">{d.type}</td>
                      <td className="p-4 text-slate-400">{d.size}</td>
                      <td className="p-4 text-slate-400">{d.uploadedAt}</td>
                      {isAdmin && (
                        <td className="p-4 text-right flex gap-2 justify-end">
                          <button
                            onClick={() => alert(`Simulating file download: ${d.name}`)}
                            className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteDocMutation.mutate(d.id)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ================================= MODALS CONTAINERS ================================= */}

      {/* Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-display font-bold text-slate-800 mb-4">{editingStaff ? 'Update Staff Profile' : 'Add New Staff Profile'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={staffForm.name}
                  onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Phone</label>
                <input
                  type="text"
                  value={staffForm.phone}
                  onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Department</label>
                <select
                  value={staffForm.departmentId}
                  onChange={e => setStaffForm({ ...staffForm, departmentId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Designation</label>
                <input
                  type="text"
                  value={staffForm.designation}
                  onChange={e => setStaffForm({ ...staffForm, designation: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  placeholder="e.g. Lead Nurse"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Role Type</label>
                <select
                  value={staffForm.role}
                  onChange={e => setStaffForm({ ...staffForm, role: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="admin">Admin</option>
                  <option value="doctor">Doctor</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="nurse">Nurse</option>
                  <option value="technician">Technician</option>
                  <option value="staff">General Support</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Monthly Salary ($)</label>
                <input
                  type="number"
                  value={staffForm.basicSalary}
                  onChange={e => setStaffForm({ ...staffForm, basicSalary: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Shift Assign</label>
                <select
                  value={staffForm.shiftId}
                  onChange={e => setStaffForm({ ...staffForm, shiftId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  {shifts.map(sh => (
                    <option key={sh.id} value={sh.id}>{sh.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={staffForm.bankName}
                  onChange={e => setStaffForm({ ...staffForm, bankName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Bank Account</label>
                <input
                  type="text"
                  value={staffForm.bankAccountNumber}
                  onChange={e => setStaffForm({ ...staffForm, bankAccountNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingStaff) {
                    updateStaffMutation.mutate({ id: editingStaff.id, data: staffForm });
                  } else {
                    createStaffMutation.mutate(staffForm);
                  }
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl transition"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dept Modal */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-4">Add Department</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Name</label>
                <input
                  type="text"
                  value={deptForm.name}
                  onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Code</label>
                <input
                  type="text"
                  value={deptForm.code}
                  onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Description</label>
                <textarea
                  value={deptForm.description}
                  onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Budget ($)</label>
                <input
                  type="number"
                  value={deptForm.budget}
                  onChange={e => setDeptForm({ ...deptForm, budget: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setIsDeptModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl">Cancel</button>
              <button onClick={() => createDeptMutation.mutate(deptForm)} className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Modal */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-4">Create Shift Template</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Shift Name</label>
                <input
                  type="text"
                  value={shiftForm.name}
                  onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  placeholder="e.g. Morning Shift"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">End Time</label>
                  <input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setIsShiftModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl">Cancel</button>
              <button onClick={() => createShiftMutation.mutate(shiftForm)} className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Modal */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-4">Add Clinic Holiday</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Holiday Title</label>
                <input
                  type="text"
                  value={holidayForm.title}
                  onChange={e => setHolidayForm({ ...holidayForm, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Description</label>
                <textarea
                  value={holidayForm.description}
                  onChange={e => setHolidayForm({ ...holidayForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setIsHolidayModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl">Cancel</button>
              <button onClick={() => createHolidayMutation.mutate(holidayForm)} className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl">Add Holiday</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-4">Apply for Leave</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Select Staff Member</label>
                <select
                  value={leaveForm.staffId}
                  onChange={e => setLeaveForm({ ...leaveForm, staffId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Leave Type</label>
                <select
                  value={leaveForm.type}
                  onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="annual">Annual Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Reason</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setIsLeaveModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl">Cancel</button>
              <button onClick={() => applyLeaveMutation.mutate(leaveForm)} className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Doc Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-4">Upload Staff Document</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Select Staff</label>
                <select
                  value={docForm.staffId}
                  onChange={e => setDocForm({ ...docForm, staffId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Document Name</label>
                <input
                  type="text"
                  value={docForm.name}
                  onChange={e => setDocForm({ ...docForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  placeholder="e.g. Employment_Agreement.pdf"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Type</label>
                <select
                  value={docForm.type}
                  onChange={e => setDocForm({ ...docForm, type: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="contract">Contract</option>
                  <option value="id_proof">ID Proof</option>
                  <option value="qualification">Qualifications</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setIsDocModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl">Cancel</button>
              <button onClick={() => createDocMutation.mutate(docForm)} className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl">Upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
