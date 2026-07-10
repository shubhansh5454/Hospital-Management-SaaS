import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone, 
  Send, 
  Calendar, 
  Clock, 
  Pill, 
  Receipt, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  PlusCircle, 
  History, 
  Sparkles,
  ChevronRight,
  User,
  Activity,
  Check
} from 'lucide-react';

interface NotificationLog {
  id: number;
  patientId?: number;
  userId?: number;
  title: string;
  message: string;
  type: 'APPOINTMENT_REMINDER' | 'PRESCRIPTION_REMINDER' | 'PAYMENT_REMINDER' | 'GENERAL';
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';
  deliveryDetails?: string;
  createdAt: string;
  patient?: { name: string; email: string; phone: string };
  user?: { name: string; email: string };
}

export default function Notifications() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const role = profile?.role || 'patient';
  const isStaff = ['admin', 'doctor', 'receptionist'].includes(role);

  // Local Component States
  const [activeTab, setActiveTab] = useState<'history' | 'custom' | 'reminders'>(isStaff ? 'history' : 'history');
  
  // Filtering States
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

  // Form States for Custom Notification
  const [customForm, setCustomForm] = useState({
    patientId: '',
    title: '',
    message: '',
    type: 'GENERAL' as any,
    channels: [] as string[],
  });

  // Reminder Selection States
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [appointmentChannels, setAppointmentChannels] = useState<string[]>(['EMAIL', 'IN_APP']);
  
  const [selectedPatientForRx, setSelectedPatientForRx] = useState('');
  const [selectedEmrId, setSelectedEmrId] = useState('');
  const [rxChannels, setRxChannels] = useState<string[]>(['EMAIL', 'IN_APP', 'WHATSAPP']);
  
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [invoiceChannels, setInvoiceChannels] = useState<string[]>(['EMAIL', 'SMS', 'IN_APP']);

  const [notificationSuccess, setNotificationSuccess] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  // Fetch Notification Logs
  const { data: logsData, isLoading: loadingLogs, refetch: refetchLogs } = useQuery<{ notifications: NotificationLog[], total: number }>({
    queryKey: ['notifications', filterChannel, filterType, filterStatus],
    queryFn: async () => {
      let url = `/api/notifications?limit=100`;
      if (filterChannel) url += `&channel=${filterChannel}`;
      if (filterType) url += `&type=${filterType}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load notification history');
      return res.json();
    },
    enabled: !!token
  });

  // Fetch Patients (for selection)
  const { data: patients = [] } = useQuery<any[]>({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      return [];
    },
    enabled: !!token && isStaff,
  });

  // Fetch Appointments (for trigger selection)
  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: ['appointments'],
    queryFn: async () => {
      const res = await fetch('/api/appointments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      return [];
    },
    enabled: !!token && isStaff,
  });

  // Fetch Invoices (for trigger selection)
  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await fetch('/api/invoices', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      return [];
    },
    enabled: !!token && isStaff,
  });

  // Fetch Selected Patient EMR Records for Prescription Reminder
  const { data: patientDetails } = useQuery<any>({
    queryKey: ['patient-reminders-emr', selectedPatientForRx],
    queryFn: async () => {
      const res = await fetch(`/api/patients/${selectedPatientForRx}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      return null;
    },
    enabled: !!token && isStaff && !!selectedPatientForRx,
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  // Mark single as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to mark all as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showSuccess('All notifications marked as read');
    }
  });

  // Send Custom Notification
  const sendCustomMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.message || 'Failed to dispatch notification');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showSuccess('Outreach notification successfully dispatched!');
      setCustomForm({
        patientId: '',
        title: '',
        message: '',
        type: 'GENERAL',
        channels: [],
      });
    },
    onError: (err: any) => {
      showError(err.message);
    }
  });

  // Dispatch Appointment Reminder
  const triggerAppointmentMutation = useMutation({
    mutationFn: async (payload: { appointmentId: number; channels: string[] }) => {
      const res = await fetch('/api/notifications/reminder/appointment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to trigger appointment reminder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showSuccess('Appointment reminder dispatched successfully!');
      setSelectedAppointmentId('');
    },
    onError: (err: any) => {
      showError(err.message);
    }
  });

  // Dispatch Prescription Reminder
  const triggerPrescriptionMutation = useMutation({
    mutationFn: async (payload: { emrRecordId: number; channels: string[] }) => {
      const res = await fetch('/api/notifications/reminder/prescription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to trigger prescription intake reminder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showSuccess('Prescription intake alerts dispatched successfully!');
      setSelectedPatientForRx('');
      setSelectedEmrId('');
    },
    onError: (err: any) => {
      showError(err.message);
    }
  });

  // Dispatch Payment Reminder
  const triggerPaymentMutation = useMutation({
    mutationFn: async (payload: { invoiceId: number; channels: string[] }) => {
      const res = await fetch('/api/notifications/reminder/payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to trigger invoice payment reminder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showSuccess('Outstanding payment reminder invoice outreach successful!');
      setSelectedInvoiceId('');
    },
    onError: (err: any) => {
      showError(err.message);
    }
  });

  // Helper banners
  const showSuccess = (msg: string) => {
    setNotificationSuccess(msg);
    setTimeout(() => setNotificationSuccess(null), 5000);
  };

  const showError = (msg: string) => {
    setNotificationError(msg);
    setTimeout(() => setNotificationError(null), 5000);
  };

  // Filter logs locally by search input
  const rawNotifications = logsData?.notifications || [];
  const filteredNotifications = rawNotifications.filter(log => {
    const text = (log.title + ' ' + log.message + ' ' + (log.patient?.name || '') + ' ' + (log.user?.name || '')).toLowerCase();
    return text.includes(search.toLowerCase());
  });

  // Unread In-App notifications count for current user
  const unreadCount = rawNotifications.filter(l => l.channel === 'IN_APP' && l.status !== 'READ').length;

  return (
    <div id="notifications_module" className="space-y-8 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase bg-white/20 px-3 py-1 rounded-full w-max">
              <Bell className="w-3.5 h-3.5 animate-bounce" />
              <span>Omnichannel Communication Hub</span>
            </div>
            <h3 className="text-2xl font-display font-bold">Clinical Communications & Reminders</h3>
            <p className="text-sm text-teal-50/90 max-w-2xl leading-relaxed">
              Dispatch, track, and automate patient notifications across Email, SMS, WhatsApp, In-App feed, and Push channels. Ensure high compliance for scheduled visits, medication adherence, and billing.
            </p>
          </div>
          {unreadCount > 0 && (
            <div className="bg-white text-teal-800 px-4 py-2.5 rounded-xl text-center md:text-left shadow-sm shrink-0 border border-teal-50 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <div>
                <span className="font-bold text-sm block">{unreadCount} Pending Alert{unreadCount > 1 ? 's' : ''}</span>
                <span className="text-[10px] text-slate-400 font-medium">Requiring patient review</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Status Banners */}
      <AnimatePresence>
        {notificationSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex items-center gap-3 text-sm font-semibold"
          >
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notificationSuccess}</span>
          </motion.div>
        )}
        {notificationError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl flex items-center gap-3 text-sm font-semibold"
          >
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{notificationError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staff View Tabs Navigation */}
      {isStaff && (
        <div className="flex border-b border-slate-100 gap-1 bg-white p-1 rounded-xl w-max shadow-sm">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'history' 
                ? 'bg-teal-500 text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Outreach History & Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'custom' 
                ? 'bg-teal-500 text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Dispatch Custom Notification</span>
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'reminders' 
                ? 'bg-teal-500 text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Automated Reminder Triggers</span>
          </button>
        </div>
      )}

      {/* TAB: OUTREACH HISTORY & LOGS */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Filters & Control bar */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search notification texts or recipients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50/50 border border-slate-100 rounded-xl text-xs font-medium focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1 text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Filters</span>
              </div>
              
              {/* Channel Filter */}
              <select
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
                className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="">All Channels</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="IN_APP">In-App</option>
                <option value="PUSH">Push Notification</option>
              </select>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="">All Categories</option>
                <option value="APPOINTMENT_REMINDER">Appointments</option>
                <option value="PRESCRIPTION_REMINDER">Prescriptions</option>
                <option value="PAYMENT_REMINDER">Payments</option>
                <option value="GENERAL">General Broadcasts</option>
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="">All Delivery Statuses</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
                <option value="READ">Read</option>
              </select>

              {/* Mark All Read button */}
              {role === 'patient' && unreadCount > 0 && (
                <button
                  onClick={() => markAllAsReadMutation.mutate()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark All Read</span>
                </button>
              )}
            </div>
          </div>

          {/* Logs List / Feed */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            {loadingLogs ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-teal-500 rounded-full animate-spin mx-auto" />
                <p className="text-xs font-medium text-slate-400">Fetching communication records...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <Bell className="w-12 h-12 text-slate-200 mx-auto stroke-1" />
                <h4 className="text-sm font-bold text-slate-700">No Notifications Logged</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {role === 'patient' 
                    ? 'No official clinic reminders have been sent to your inbox yet.' 
                    : 'No outreach records match your filtering parameters. Choose a different combination.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredNotifications.map((log) => {
                  const isRead = log.status === 'READ';
                  const isFailed = log.status === 'FAILED';
                  
                  // Icons based on delivery channel
                  const getChannelIcon = (ch: string) => {
                    switch (ch) {
                      case 'EMAIL': return <Mail className="w-3.5 h-3.5" />;
                      case 'SMS': return <Smartphone className="w-3.5 h-3.5" />;
                      case 'WHATSAPP': return <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />;
                      case 'IN_APP': return <Bell className="w-3.5 h-3.5 text-teal-500" />;
                      case 'PUSH': return <Send className="w-3.5 h-3.5 text-indigo-500" />;
                      default: return <Bell className="w-3.5 h-3.5" />;
                    }
                  };

                  // Styling based on notification category
                  const getTypeStyle = (ty: string) => {
                    switch (ty) {
                      case 'APPOINTMENT_REMINDER': return 'bg-blue-50 text-blue-700 border-blue-100';
                      case 'PRESCRIPTION_REMINDER': return 'bg-amber-50 text-amber-700 border-amber-100';
                      case 'PAYMENT_REMINDER': return 'bg-red-50 text-red-700 border-red-100';
                      default: return 'bg-slate-50 text-slate-600 border-slate-100';
                    }
                  };

                  const getFriendlyType = (ty: string) => {
                    return ty.replace('_', ' ').toLowerCase();
                  };

                  return (
                    <div 
                      key={log.id} 
                      className={`p-5 hover:bg-slate-50/50 transition-colors ${!isRead && log.channel === 'IN_APP' ? 'bg-teal-50/15' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3.5">
                          {/* Channel Badge Column */}
                          <div className={`w-9 h-9 rounded-xl border border-slate-100 bg-white shadow-xs flex items-center justify-center shrink-0`}>
                            {getChannelIcon(log.channel)}
                          </div>

                          {/* Message Body Column */}
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-xs text-slate-800">{log.title}</span>
                              
                              {/* Category Badge */}
                              <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider capitalize ${getTypeStyle(log.type)}`}>
                                {getFriendlyType(log.type)}
                              </span>

                              {/* Channel Name Badge */}
                              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">
                                {log.channel}
                              </span>

                              {/* Dispatch Date/Time */}
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(log.createdAt).toLocaleString(undefined, { 
                                  month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' 
                                })}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 max-w-4xl leading-relaxed">{log.message}</p>

                            {/* Recipient meta info (Staff view only) */}
                            {isStaff && (
                              <div className="flex items-center gap-3.5 text-[10px] text-slate-400 font-semibold pt-1">
                                <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-md">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>To: {log.patient?.name || log.user?.name || 'Staff User'}</span>
                                </span>
                                {log.patient?.email && (
                                  <span className="font-mono">{log.patient.email}</span>
                                )}
                                {log.patient?.phone && (
                                  <span className="font-mono">{log.patient.phone}</span>
                                )}
                              </div>
                            )}

                            {/* Clickable details for delivery log JSON */}
                            {selectedLogId === log.id && log.deliveryDetails && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-2.5 p-3 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono leading-relaxed"
                              >
                                <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Delivery Diagnostics Details:</span>
                                {JSON.stringify(JSON.parse(log.deliveryDetails), null, 2)}
                              </motion.div>
                            )}
                          </div>
                        </div>

                        {/* Status Column / Action Button */}
                        <div className="text-right shrink-0 flex flex-col items-end justify-between self-stretch">
                          {isFailed ? (
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              Failed
                            </span>
                          ) : isRead ? (
                            <span className="px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-100 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                              Read
                            </span>
                          ) : (
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Sent
                              </span>
                              
                              {/* Read action for In-App patients */}
                              {log.channel === 'IN_APP' && (
                                <button
                                  onClick={() => markAsReadMutation.mutate(log.id)}
                                  className="text-[10px] text-teal-600 hover:text-teal-800 hover:underline font-bold"
                                >
                                  Mark Read
                                </button>
                              )}
                            </div>
                          )}

                          {log.deliveryDetails && (
                            <button
                              onClick={() => setSelectedLogId(selectedLogId === log.id ? null : log.id)}
                              className="text-[10px] text-slate-400 hover:text-slate-600 hover:underline font-bold mt-2"
                            >
                              {selectedLogId === log.id ? 'Hide Details' : 'View Details'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: DISPATCH CUSTOM OUTREACH (STAFF ONLY) */}
      {isStaff && activeTab === 'custom' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm max-w-3xl">
          <div className="border-b border-slate-50 pb-4 mb-6">
            <h4 className="text-base font-display font-bold text-slate-800">Manually Dispatch Broadcast or Alert</h4>
            <p className="text-xs text-slate-400">Construct and send custom health instructions, center-wide schedules, or direct emergency notifications instantly.</p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              sendCustomMutation.mutate(customForm);
            }}
            className="space-y-5 text-xs"
          >
            {/* Recipient Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-500">Target Patient Profile</label>
                <select
                  value={customForm.patientId}
                  onChange={(e) => setCustomForm({ ...customForm, patientId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">General Broadcast / No specific patient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                  ))}
                </select>
              </div>

              {/* Category selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-500">Notification Category</label>
                <select
                  value={customForm.type}
                  onChange={(e) => setCustomForm({ ...customForm, type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="GENERAL">General Bulletin / Announcement</option>
                  <option value="APPOINTMENT_REMINDER">Appointment Alert</option>
                  <option value="PRESCRIPTION_REMINDER">Prescription Protocol</option>
                  <option value="PAYMENT_REMINDER">Outstanding Invoice Alert</option>
                </select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-500">Outreach Subject / Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Health Center Notice: Severe Weather Vaccine Operations"
                value={customForm.title}
                onChange={(e) => setCustomForm({ ...customForm, title: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-medium focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-500">Outreach Message Content</label>
              <textarea
                required
                rows={4}
                placeholder="Compose the full message to dispatch to the recipient..."
                value={customForm.message}
                onChange={(e) => setCustomForm({ ...customForm, message: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-medium focus:outline-none focus:border-teal-500 leading-relaxed"
              />
            </div>

            {/* Delivery Channels Selectors */}
            <div className="space-y-2 bg-slate-50/50 border border-slate-100/50 rounded-xl p-4">
              <label className="font-semibold text-slate-600 block">Select Dispatch Delivery Channels</label>
              <span className="text-[10px] text-slate-400 block mb-2">Check all delivery networks this notification should route through:</span>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                {['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH'].map((ch) => {
                  const checked = customForm.channels.includes(ch);
                  return (
                    <label key={ch} className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer select-none transition-colors ${checked ? 'border-teal-500 bg-teal-50/20 text-teal-800' : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-600'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCustomForm({ ...customForm, channels: [...customForm.channels, ch] });
                          } else {
                            setCustomForm({ ...customForm, channels: customForm.channels.filter(c => c !== ch) });
                          }
                        }}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="font-bold text-[10px]">{ch}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={sendCustomMutation.isPending || customForm.channels.length === 0}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-100 text-white disabled:text-slate-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm w-full md:w-max shadow-teal-600/10"
            >
              <Send className="w-4 h-4" />
              <span>{sendCustomMutation.isPending ? 'Processing Dispatch...' : 'Dispatch Notification Now'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB: AUTOMATED REMINDER TRIGGERS (STAFF ONLY) */}
      {isStaff && activeTab === 'reminders' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Section 1: Appointment reminders */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-50 pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-800">Appointment Consultation Reminders</h4>
                <p className="text-[10px] text-slate-400">Trigger standard schedule notifications</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-500">Select Scheduled Session</label>
                <select
                  value={selectedAppointmentId}
                  onChange={(e) => setSelectedAppointmentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-2 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">-- Choose active appointment --</option>
                  {appointments.filter((a: any) => a.status === 'scheduled').map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.patient?.name} - Dr. {a.doctor?.name} ({a.date} @ {a.time})
                    </option>
                  ))}
                </select>
              </div>

              {/* Channels checkboxes */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-500 block">Outreach Channels</label>
                <div className="flex items-center gap-3">
                  {['EMAIL', 'SMS', 'IN_APP'].map(ch => (
                    <label key={ch} className="flex items-center gap-1.5 font-semibold text-slate-600 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={appointmentChannels.includes(ch)}
                        onChange={(e) => {
                          if (e.target.checked) setAppointmentChannels([...appointmentChannels, ch]);
                          else setAppointmentChannels(appointmentChannels.filter(c => c !== ch));
                        }}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>{ch}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!selectedAppointmentId) return;
                  triggerAppointmentMutation.mutate({
                    appointmentId: parseInt(selectedAppointmentId, 10),
                    channels: appointmentChannels,
                  });
                }}
                disabled={!selectedAppointmentId || triggerAppointmentMutation.isPending}
                className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Appointment Alert</span>
              </button>
            </div>
          </div>

          {/* Section 2: Prescription Adherence alert */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-50 pb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Pill className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-800">Prescription Intake Alerts</h4>
                <p className="text-[10px] text-slate-400">Trigger patient medicine compliance guidelines</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Select Patient */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-500">1. Select Patient Folder</label>
                <select
                  value={selectedPatientForRx}
                  onChange={(e) => {
                    setSelectedPatientForRx(e.target.value);
                    setSelectedEmrId('');
                  }}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-2 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">-- Choose patient --</option>
                  {patients.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Select EMR with Prescriptions */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-500">2. Select Active Medical Encounter</label>
                <select
                  value={selectedEmrId}
                  onChange={(e) => setSelectedEmrId(e.target.value)}
                  disabled={!selectedPatientForRx}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-2 font-medium focus:outline-none focus:border-teal-500 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">-- Choose clinical record --</option>
                  {patientDetails?.emrRecords?.filter((r: any) => r.prescriptions).map((r: any) => (
                    <option key={r.id} value={r.id}>
                      Encounter Date {r.date} ({r.diagnosis})
                    </option>
                  ))}
                </select>
                {selectedPatientForRx && patientDetails?.emrRecords?.filter((r: any) => r.prescriptions).length === 0 && (
                  <span className="text-[9px] text-red-500 font-semibold block">No prescription EMR profiles found for this patient.</span>
                )}
              </div>

              {/* Channels checkboxes */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-500 block">Outreach Channels</label>
                <div className="flex items-center gap-3">
                  {['EMAIL', 'WHATSAPP', 'IN_APP'].map(ch => (
                    <label key={ch} className="flex items-center gap-1.5 font-semibold text-slate-600 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rxChannels.includes(ch)}
                        onChange={(e) => {
                          if (e.target.checked) setRxChannels([...rxChannels, ch]);
                          else setRxChannels(rxChannels.filter(c => c !== ch));
                        }}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>{ch}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!selectedEmrId) return;
                  triggerPrescriptionMutation.mutate({
                    emrRecordId: parseInt(selectedEmrId, 10),
                    channels: rxChannels,
                  });
                }}
                disabled={!selectedEmrId || triggerPrescriptionMutation.isPending}
                className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Prescription Reminder</span>
              </button>
            </div>
          </div>

          {/* Section 3: Payment/Invoice alerts */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-50 pb-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-800">Outstanding Invoice Reminders</h4>
                <p className="text-[10px] text-slate-400">Dispatch outstanding bill payment requests</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-500">Select Unpaid/Pending Invoice</label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-2 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">-- Choose outstanding invoice --</option>
                  {invoices.filter((inv: any) => inv.status !== 'paid' && inv.status !== 'cancelled').map((inv: any) => (
                    <option key={inv.id} value={inv.id}>
                      #{inv.invoiceNumber} - {inv.patient?.name} (Pending: ${(inv.totalAmount - inv.amountPaid).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Channels checkboxes */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-500 block">Outreach Channels</label>
                <div className="flex items-center gap-3">
                  {['EMAIL', 'SMS', 'IN_APP'].map(ch => (
                    <label key={ch} className="flex items-center gap-1.5 font-semibold text-slate-600 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invoiceChannels.includes(ch)}
                        onChange={(e) => {
                          if (e.target.checked) setInvoiceChannels([...invoiceChannels, ch]);
                          else setInvoiceChannels(invoiceChannels.filter(c => c !== ch));
                        }}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>{ch}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!selectedInvoiceId) return;
                  triggerPaymentMutation.mutate({
                    invoiceId: parseInt(selectedInvoiceId, 10),
                    channels: invoiceChannels,
                  });
                }}
                disabled={!selectedInvoiceId || triggerPaymentMutation.isPending}
                className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Invoice Alert</span>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
