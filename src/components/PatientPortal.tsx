import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from './AuthContext.tsx';
import { 
  HeartPulse, 
  Calendar, 
  FileText, 
  Receipt, 
  Bell, 
  Download, 
  User as UserIcon, 
  LogOut, 
  Activity, 
  Clock, 
  Stethoscope, 
  ChevronRight, 
  FileCheck, 
  MapPin, 
  Sparkles, 
  Phone, 
  Search, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  CreditCard,
  Droplet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type PortalView = 'dashboard' | 'appointments' | 'medical-history' | 'prescriptions' | 'lab-reports' | 'billing' | 'documents' | 'profile' | 'notifications';

export default function PatientPortal() {
  const { profile, logout, token } = useAuth();
  const [activeView, setActiveView] = useState<PortalView>('dashboard');
  
  // State variables for data
  const [patientData, setPatientData] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [labReports, setLabReports] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);

  // Form states
  const [bookingDoctor, setBookingDoctor] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>('');
  const [bookingTime, setBookingTime] = useState<string>('');
  const [bookingReason, setBookingReason] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState<string>('');

  // Profile Edit states
  const [profilePhone, setProfilePhone] = useState('');
  const [profileDob, setProfileDob] = useState('');
  const [profileGender, setProfileGender] = useState('male');
  const [profileBlood, setProfileBlood] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileAllergies, setProfileAllergies] = useState('');
  const [profileMedHistory, setProfileMedHistory] = useState('');

  // Payment modal state
  const [payingInvoice, setPayingInvoice] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi'>('card');
  const [paymentUpiId, setPaymentUpiId] = useState('');
  const [paymentCardNo, setPaymentCardNo] = useState('');
  const [paymentCardExpiry, setPaymentCardExpiry] = useState('');
  const [paymentCardCvv, setPaymentCardCvv] = useState('');

  // Loading states
  const [dataLoading, setDataLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load all patient data
  const fetchAllPortalData = async () => {
    if (!token) return;
    setDataLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Profile / Me
      const profileRes = await fetch('/api/portal/me', { headers });
      if (profileRes.ok) {
        const data = await profileRes.json();
        setPatientData(data.patient);
        if (data.patient) {
          setProfilePhone(data.patient.phone || '');
          setProfileDob(data.patient.dob || '');
          setProfileGender(data.patient.gender || 'male');
          setProfileBlood(data.patient.bloodGroup || '');
          setProfileAddress(data.patient.address || '');
          setProfileAllergies(data.patient.allergies || '');
          setProfileMedHistory(data.patient.medicalHistory || '');
        }
      }

      // 2. Appointments
      const appRes = await fetch('/api/portal/appointments', { headers });
      if (appRes.ok) setAppointments(await appRes.json());

      // 3. Medical History / EMR
      const medRes = await fetch('/api/portal/medical-history', { headers });
      if (medRes.ok) setMedicalHistory(await medRes.json());

      // 4. Prescriptions
      const presRes = await fetch('/api/portal/prescriptions', { headers });
      if (presRes.ok) setPrescriptions(await presRes.json());

      // 5. Lab Reports
      const labRes = await fetch('/api/portal/lab-reports', { headers });
      if (labRes.ok) setLabReports(await labRes.json());

      // 6. Invoices
      const invRes = await fetch('/api/portal/invoices', { headers });
      if (invRes.ok) setInvoices(await invRes.json());

      // 7. Payments
      const payRes = await fetch('/api/portal/payments', { headers });
      if (payRes.ok) setPayments(await payRes.json());

      // 8. Notifications
      const notRes = await fetch('/api/portal/notifications', { headers });
      if (notRes.ok) setNotifications(await notRes.json());

      // 9. Documents
      const docRes = await fetch('/api/portal/documents', { headers });
      if (docRes.ok) setDocuments(await docRes.json());

      // 10. Doctors
      const docListRes = await fetch('/api/portal/doctors', { headers });
      if (docListRes.ok) setDoctorsList(await docListRes.json());

    } catch (err) {
      console.error('Error fetching patient portal info:', err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPortalData();
  }, [token]);

  // Handle book appointment
  const handleBookAppointment = async (e: FormEvent) => {
    e.preventDefault();
    if (!bookingDoctor || !bookingDate || !bookingTime || !bookingReason) {
      triggerFeedback('error', 'Please fill in all required booking fields.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/portal/appointments/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          doctorId: parseInt(bookingDoctor, 10),
          date: bookingDate,
          time: bookingTime,
          reason: bookingReason,
          notes: bookingNotes
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to book appointment.');
      }

      triggerFeedback('success', 'Appointment successfully requested! You will receive a notification shortly.');
      
      // Reset form
      setBookingDoctor('');
      setBookingDate('');
      setBookingTime('');
      setBookingReason('');
      setBookingNotes('');
      
      // Refresh
      await fetchAllPortalData();
      setActiveView('appointments');
    } catch (err: any) {
      triggerFeedback('error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle profile update
  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/portal/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phone: profilePhone,
          dob: profileDob,
          gender: profileGender,
          bloodGroup: profileBlood,
          address: profileAddress,
          allergies: profileAllergies,
          medicalHistory: profileMedHistory
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to update profile.');
      }

      triggerFeedback('success', 'Profile demographic updates saved successfully!');
      await fetchAllPortalData();
    } catch (err: any) {
      triggerFeedback('error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Mark Notification as Read
  const handleMarkNotificationRead = async (id: number) => {
    try {
      const res = await fetch(`/api/portal/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'READ' } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Pay Invoice Simulated Processing
  const handlePayInvoice = async (e: FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    setActionLoading(true);

    try {
      const res = await fetch('/api/portal/payments/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          invoiceId: payingInvoice.id,
          amount: payingInvoice.totalAmount - payingInvoice.amountPaid,
          paymentMethod: 'card', // Simulating card
          referenceNo: `ONLINE_${Math.floor(Math.random() * 9000000 + 1000000)}`,
          notes: 'Paid via Patient Portal inline billing utility.'
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to process payment.');
      }

      triggerFeedback('success', `Payment of $${(payingInvoice.totalAmount - payingInvoice.amountPaid).toFixed(2)} processed successfully! Receipt generated.`);
      setPayingInvoice(null);
      
      // Reset card forms
      setPaymentCardNo('');
      setPaymentCardExpiry('');
      setPaymentCardCvv('');
      setPaymentUpiId('');

      await fetchAllPortalData();
      setActiveView('billing');
    } catch (err: any) {
      triggerFeedback('error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper trigger feedback banner
  const triggerFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // Document download action handler
  const handleDownloadFile = (doc: any) => {
    try {
      if (!doc.content) {
        // Fallback mock payload if file is empty
        const dummyText = `CareSync Electronic Diagnostic Record\n==================================\nDocument ID: CF-${doc.id}\nDocument Name: ${doc.name}\nFile Type: ${doc.fileType?.toUpperCase() || 'DOCUMENT'}\nPatient: ${profile?.name}\nDate: ${new Date(doc.createdAt).toLocaleDateString()}\nStatus: Verified Clinical Release\n`;
        const blob = new Blob([dummyText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.name.endsWith('.txt') ? doc.name : `${doc.name}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        triggerFeedback('success', `Simulating secure file export of ${doc.name}`);
        return;
      }

      // If there is actual base64 content
      const linkSource = doc.content.startsWith('data:') ? doc.content : `data:${doc.mimeType || 'application/octet-stream'};base64,${doc.content}`;
      const downloadLink = document.createElement('a');
      downloadLink.href = linkSource;
      downloadLink.download = doc.name;
      downloadLink.click();
      triggerFeedback('success', `Exported ${doc.name} successfully.`);
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Could not compile document export streams.');
    }
  };

  // Count unread notifications
  const unreadNotifCount = notifications.filter(n => n.status !== 'READ').length;
  // Get upcoming appointment
  const upcomingAppointments = appointments.filter(app => app.status === 'scheduled');
  // Get pending invoices
  const pendingInvoices = invoices.filter(inv => inv.status !== 'paid');

  return (
    <div id="patient_portal_root" className="min-h-screen bg-[#f8fafc] font-sans flex flex-col md:flex-row">
      
      {/* SIDE NAVIGATION PANEL */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0 shadow-lg">
        <div>
          {/* Portal Brand Header */}
          <div className="h-16 bg-slate-950 flex items-center px-6 gap-3">
            <div className="w-8 h-8 bg-teal-500 text-white rounded-lg flex items-center justify-center font-bold">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold text-sm block tracking-tight text-white">Patient Portal</span>
              <span className="text-[9px] text-teal-400 font-semibold uppercase tracking-wider block -mt-1">CareSync Healthcare</span>
            </div>
          </div>

          {/* Quick Demographics Profile Summary */}
          <div className="p-5 border-b border-slate-800 bg-slate-950/40 text-center md:text-left">
            <div className="w-12 h-12 bg-slate-800 border border-slate-700 text-teal-400 rounded-full flex items-center justify-center font-semibold text-lg mb-2.5 mx-auto md:mx-0">
              {profile?.name?.substring(0, 2).toUpperCase() || 'PT'}
            </div>
            <p className="font-semibold text-xs text-white truncate">{profile?.name || 'Loading Patient...'}</p>
            <p className="text-[10px] text-slate-400 truncate">{profile?.email}</p>
            {patientData?.bloodGroup && (
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-500/10 text-teal-400">
                <Droplet className="w-2.5 h-2.5 text-teal-400 fill-teal-400" />
                <span>Blood: {patientData.bloodGroup}</span>
              </span>
            )}
          </div>

          {/* Nav Links */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'dashboard' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4" />
                <span>My Dashboard</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => setActiveView('appointments')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'appointments' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4" />
                <span>Appointments</span>
              </div>
              {upcomingAppointments.length > 0 && (
                <span className="bg-teal-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{upcomingAppointments.length}</span>
              )}
            </button>

            <button
              onClick={() => setActiveView('medical-history')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'medical-history' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4" />
                <span>Clinical History</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => setActiveView('prescriptions')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'prescriptions' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Stethoscope className="w-4 h-4" />
                <span>Prescriptions</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => setActiveView('lab-reports')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'lab-reports' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-4 h-4" />
                <span>Laboratory Reports</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => setActiveView('billing')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'billing' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Receipt className="w-4 h-4" />
                <span>Billing & Payments</span>
              </div>
              {pendingInvoices.length > 0 && (
                <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{pendingInvoices.length}</span>
              )}
            </button>

            <button
              onClick={() => setActiveView('documents')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'documents' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4" />
                <span>My Documents</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => setActiveView('notifications')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'notifications' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4" />
                <span>Notifications</span>
              </div>
              {unreadNotifCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">{unreadNotifCount}</span>
              )}
            </button>

            <button
              onClick={() => setActiveView('profile')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'profile' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserIcon className="w-4 h-4" />
                <span>Demographics Profile</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>
          </nav>
        </div>

        {/* User signout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20">
          <button
            onClick={logout}
            className="w-full h-9 border border-slate-700 hover:bg-red-950/40 hover:border-red-900 text-slate-300 hover:text-red-400 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Portal</span>
          </button>
        </div>
      </aside>

      {/* PORTAL CONTENT CANVAS */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Header toolbar */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-teal-600 uppercase tracking-widest">
              <Sparkles className="w-3 h-3 text-teal-500" />
              <span>Personal Electronic Health Registry</span>
            </div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900 capitalize tracking-tight mt-1">
              {activeView === 'dashboard' && `Welcome Back, ${profile?.name?.split(' ')[0]}`}
              {activeView === 'appointments' && 'Schedule & Appointments'}
              {activeView === 'medical-history' && 'Clinical Health Timeline'}
              {activeView === 'prescriptions' && 'Active Prescribed Medications'}
              {activeView === 'lab-reports' && 'Diagnostics & Lab Results'}
              {activeView === 'billing' && 'Invoices & Ledger History'}
              {activeView === 'documents' && 'My Clinical Documents'}
              {activeView === 'profile' && 'Demographics & Profile Editor'}
              {activeView === 'notifications' && 'My Portal Alerts'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick stats indicator */}
            <div className="hidden lg:flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-xs font-medium text-slate-600">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Active Prescriptions</span>
                <span className="text-sm font-bold text-slate-800">{prescriptions.length} List Item{prescriptions.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Clinical Records</span>
                <span className="text-sm font-bold text-slate-800">{medicalHistory.length} Registered</span>
              </div>
            </div>
          </div>
        </header>

        {/* Global Action Feedback Alert */}
        <AnimatePresence>
          {feedbackMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mb-6 p-4 rounded-2xl border flex gap-3 text-xs font-semibold ${
                feedbackMsg.type === 'success' 
                  ? 'bg-teal-50 border-teal-100 text-teal-800' 
                  : 'bg-red-50 border-red-100 text-red-800'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 text-teal-600" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
              )}
              <span>{feedbackMsg.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LOADING PROGRESS RING */}
        {dataLoading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-semibold tracking-wide">Syncing patient health database record...</p>
          </div>
        ) : (
          <div className="animate-fadeIn">
            
            {/* 1. PORTAL DASHBOARD VIEW */}
            {activeView === 'dashboard' && (
              <div className="space-y-6">
                
                {/* Visual quick dashboard hero cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  
                  <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white p-5 rounded-3xl shadow-sm space-y-4">
                    <Calendar className="w-8 h-8 opacity-80" />
                    <div>
                      <h3 className="text-sm font-semibold opacity-90">Schedule Appointments</h3>
                      <p className="text-[10px] opacity-75 mt-0.5">Reserve instant slots with clinical specialists.</p>
                    </div>
                    <button
                      onClick={() => setActiveView('appointments')}
                      className="w-full py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                    >
                      Book Online Slot
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-800">My Clinical Reports</h3>
                      <p className="text-[10px] text-slate-400">Review lab workups, vitals, diagnostics, and EMR timeline.</p>
                    </div>
                    <button
                      onClick={() => setActiveView('medical-history')}
                      className="w-full py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                    >
                      View Medical Records
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-800">Prescribed Medicine</h3>
                      <p className="text-[10px] text-slate-400">View active drug instructions, dosages, and refill timelines.</p>
                    </div>
                    <button
                      onClick={() => setActiveView('prescriptions')}
                      className="w-full py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                    >
                      Check Prescriptions
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-800">Billing Statements</h3>
                      <p className="text-[10px] text-slate-400">Settle pending invoices, review ledger entries and statements.</p>
                    </div>
                    <button
                      onClick={() => setActiveView('billing')}
                      className="w-full py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                    >
                      Pay Pending Invoices
                    </button>
                  </div>

                </div>

                {/* Grid layout for Recent Updates vs Quick Booking */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Recent Activity Timeline Summary */}
                  <div className="lg:col-span-2 space-y-6">
                    
                    {/* Next scheduled slot */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Clock className="w-4.5 h-4.5 text-teal-600" />
                        <span>Upcoming Consultations</span>
                      </h3>
                      
                      {upcomingAppointments.length === 0 ? (
                        <div className="text-center py-6 text-slate-400">
                          <p className="text-xs">No upcoming medical appointments found on file.</p>
                          <button
                            onClick={() => setActiveView('appointments')}
                            className="text-teal-600 font-bold text-[11px] mt-2 hover:underline cursor-pointer"
                          >
                            Schedule a slot now
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {upcomingAppointments.slice(0, 2).map((app) => (
                            <div key={app.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-3">
                              <div className="flex gap-3">
                                <div className="w-10 h-10 bg-teal-100 text-teal-800 rounded-xl flex items-center justify-center shrink-0">
                                  <Calendar className="w-5 h-5 text-teal-700" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-800">Consultation: Dr. {app.doctor?.name || 'Specialist'}</p>
                                  <p className="text-[10px] text-slate-500">{app.doctor?.doctorProfile?.specialization || 'General Care'} • Reason: {app.reason}</p>
                                </div>
                              </div>
                              <div className="text-left sm:text-right shrink-0">
                                <span className="inline-block px-2.5 py-1 bg-teal-50 border border-teal-100 text-teal-700 rounded-lg text-[10px] font-bold">{app.date} at {app.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Active prescriptions summary */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Stethoscope className="w-4.5 h-4.5 text-purple-600" />
                        <span>Recent Prescribed Medications</span>
                      </h3>
                      
                      {prescriptions.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No active prescriptions on file.</p>
                      ) : (
                        <div className="space-y-3">
                          {prescriptions.slice(0, 2).map((pres, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                              <div className="flex justify-between items-center">
                                <p className="text-xs font-bold text-slate-800">Visit Date: {pres.date}</p>
                                <span className="text-[10px] text-slate-400">Dr. {pres.doctor?.name}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {pres.items.slice(0, 3).map((item: any, i: number) => (
                                  <div key={i} className="bg-white p-2.5 rounded-xl border border-slate-100 text-[10px]">
                                    <strong className="text-slate-800 block">{item.medication}</strong>
                                    <span className="text-slate-500">{item.dosage} • {item.frequency}</span>
                                    {item.instructions && <span className="block text-slate-400 italic mt-0.5">{item.instructions}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Right Column: Mini Alerts Box & Lab Summary */}
                  <div className="space-y-6">
                    
                    {/* Lab Test Results */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FileCheck className="w-4.5 h-4.5 text-blue-600" />
                        <span>Laboratory Status</span>
                      </h3>
                      
                      {labReports.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No lab diagnostic tests ordered.</p>
                      ) : (
                        <div className="space-y-3.5">
                          {labReports.slice(0, 3).map((lab) => (
                            <div key={lab.id} className="flex justify-between items-center border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                              <div>
                                <p className="text-xs font-bold text-slate-800">{lab.test?.name || 'Diagnostic Lab Test'}</p>
                                <p className="text-[10px] text-slate-400">Ordered: {lab.bookingDate}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                lab.status === 'COMPLETED' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {lab.status}
                              </span>
                            </div>
                          ))}
                          <button
                            onClick={() => setActiveView('lab-reports')}
                            className="w-full text-center text-teal-600 hover:underline text-[10px] font-bold mt-2 cursor-pointer block"
                          >
                            View Diagnostic Reports
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Unread Portal Notifications */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Bell className="w-4.5 h-4.5 text-red-500" />
                        <span>Recent Alerts</span>
                      </h3>
                      
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No recent notification alerts.</p>
                      ) : (
                        <div className="space-y-3">
                          {notifications.slice(0, 3).map((notif) => (
                            <div 
                              key={notif.id} 
                              onClick={() => handleMarkNotificationRead(notif.id)}
                              className={`p-3 rounded-2xl text-[10px] cursor-pointer transition-all ${
                                notif.status === 'READ' ? 'bg-slate-50 text-slate-500' : 'bg-red-50/50 text-slate-800 border-l-2 border-red-500 font-medium'
                              }`}
                            >
                              <p className="font-bold">{notif.title}</p>
                              <p className="opacity-90 mt-0.5">{notif.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* 2. APPOINTMENTS VIEW */}
            {activeView === 'appointments' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column: Booking Form */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Sparkles className="w-4.5 h-4.5 text-teal-600" />
                    <span>Book Appointment Online</span>
                  </h3>
                  
                  <form onSubmit={handleBookAppointment} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Select Physician Specialist *</label>
                      <select
                        required
                        value={bookingDoctor}
                        onChange={(e) => setBookingDoctor(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                      >
                        <option value="">-- Choose a Doctor --</option>
                        {doctorsList.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            Dr. {doc.name} ({doc.doctorProfile?.specialization || 'Clinical Specialist'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Select Date *</label>
                      <input
                        type="date"
                        required
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Preferred Time Slot *</label>
                      <input
                        type="text"
                        required
                        value={bookingTime}
                        onChange={(e) => setBookingTime(e.target.value)}
                        placeholder="e.g. 10:30 AM"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Reason for Consultation *</label>
                      <input
                        type="text"
                        required
                        value={bookingReason}
                        onChange={(e) => setBookingReason(e.target.value)}
                        placeholder="e.g. Annual routine physical checkup"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Patient Comments / Symptoms Description</label>
                      <textarea
                        value={bookingNotes}
                        onChange={(e) => setBookingNotes(e.target.value)}
                        placeholder="Any additional information, current medication, or symptoms description."
                        className="w-full min-h-[80px] p-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full h-11 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl text-xs shadow-md shadow-teal-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {actionLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Submit Appointment Request'
                      )}
                    </button>
                  </form>
                </div>

                {/* Right Column: Existing Appointments Grid */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Consultation History & Schedule</h3>
                    
                    {appointments.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-xs">You have no recorded appointments.</p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {appointments.map((app) => (
                          <div 
                            key={app.id} 
                            className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-slate-800">Dr. {app.doctor?.name || 'Physician Specialist'}</p>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  app.status === 'scheduled' 
                                    ? 'bg-teal-50 text-teal-700 border border-teal-100' 
                                    : app.status === 'completed'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                    : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                  {app.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                {app.doctor?.doctorProfile?.specialization || 'Clinical Medicine'} • Reason: {app.reason}
                              </p>
                              {app.notes && (
                                <p className="text-[10px] text-slate-500 italic mt-1 bg-white p-2 rounded-lg border border-slate-100">
                                  "{app.notes}"
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-left sm:text-right">
                              <p className="text-[10px] font-bold text-slate-700">{app.date}</p>
                              <p className="text-[9px] text-slate-400 mt-0.5">{app.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* 3. MEDICAL HISTORY TIMELINE VIEW */}
            {activeView === 'medical-history' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm max-w-4xl">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-6">Electronic Clinical Health Records</h3>
                
                {medicalHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Activity className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-xs">No clinical EMR visits recorded yet.</p>
                  </div>
                ) : (
                  <div className="relative border-l border-slate-200 pl-6 space-y-6">
                    {medicalHistory.map((record) => (
                      <div key={record.id} className="relative">
                        
                        {/* Timeline node */}
                        <div className="absolute -left-9 top-1.5 w-6 h-6 bg-teal-50 border-2 border-teal-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
                        </div>

                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3.5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2">
                            <div>
                              <p className="text-xs font-bold text-slate-800">Clinical Diagnosis: {record.diagnosis}</p>
                              <p className="text-[10px] text-slate-400">Consultant: Dr. {record.doctor?.name || 'Physician Specialist'}</p>
                            </div>
                            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-100 self-start sm:self-center">
                              Visit Date: {record.date}
                            </span>
                          </div>

                          {/* Patient Vitals */}
                          <div className="bg-white p-4 rounded-xl border border-slate-100">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Patient Vitals Registered</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                              <div>
                                <span className="text-slate-400 block">Blood Pressure:</span>
                                <strong className="text-slate-800">{record.bloodPressure || 'N/A'}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Heart Rate:</span>
                                <strong className="text-slate-800">{record.heartRate ? `${record.heartRate} bpm` : 'N/A'}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Temperature:</span>
                                <strong className="text-slate-800">{record.temperature ? `${record.temperature} °F` : 'N/A'}</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block">BMI Assessment:</span>
                                <strong className="text-slate-800">{record.bmi || 'N/A'}</strong>
                              </div>
                            </div>
                          </div>

                          {/* SOAP Notes */}
                          {(record.soapSubjective || record.soapPlan) && (
                            <div className="space-y-2">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Symptom Summary & Treatment Plan</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px]">
                                {record.soapSubjective && (
                                  <div className="bg-white p-3 rounded-xl border border-slate-100/70">
                                    <span className="font-semibold text-slate-500 block mb-0.5">Subjective Symptoms</span>
                                    <p className="text-slate-600">"{record.soapSubjective}"</p>
                                  </div>
                                )}
                                {record.soapPlan && (
                                  <div className="bg-white p-3 rounded-xl border border-slate-100/70">
                                    <span className="font-semibold text-slate-500 block mb-0.5">Treatment Plan</span>
                                    <p className="text-slate-600">"{record.soapPlan}"</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Follow up date */}
                          {record.followUpDate && (
                            <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-100/60 px-3 py-1.5 rounded-xl w-max">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Scheduled Follow-up Date: <strong>{record.followUpDate}</strong></span>
                            </div>
                          )}

                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. PRESCRIPTIONS VIEW */}
            {activeView === 'prescriptions' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm max-w-4xl">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-6">Physician Prescribed Drug Registry</h3>
                
                {prescriptions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Stethoscope className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-xs">No active prescriptions registered on your file.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {prescriptions.map((pres, idx) => (
                      <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Indication: {pres.diagnosis}</p>
                            <p className="text-[10px] text-slate-400">Prescribing Dr: {pres.doctor?.name || 'Physician Specialist'}</p>
                          </div>
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-100 self-start sm:self-center">
                            Prescribed On: {pres.date}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {pres.items.map((med: any, i: number) => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-start">
                              <div className="space-y-1">
                                <strong className="text-xs font-bold text-slate-800 block">{med.medication}</strong>
                                <p className="text-[10px] text-slate-500 font-medium">Dosage: {med.dosage} • Frequency: {med.frequency}</p>
                                <p className="text-[10px] text-slate-400 font-medium">Duration: {med.duration}</p>
                                {med.instructions && (
                                  <p className="text-[9px] text-amber-700 bg-amber-50/70 border border-amber-100/50 px-2 py-0.5 rounded mt-1 w-max">
                                    Instructions: {med.instructions}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. LAB REPORTS VIEW */}
            {activeView === 'lab-reports' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-6">Diagnostic & Lab Results</h3>
                
                {labReports.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileCheck className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-xs">No laboratory diagnostics or report releases found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {labReports.map((lab) => (
                      <div key={lab.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-xs font-bold text-slate-800">{lab.test?.name || 'Laboratory Diagnostic Work'}</p>
                              <p className="text-[10px] text-slate-400">Test Code: {lab.test?.code} • Category: {lab.test?.category}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                              lab.status === 'COMPLETED' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {lab.status}
                            </span>
                          </div>

                          {lab.status === 'COMPLETED' ? (
                            <div className="bg-white p-3.5 rounded-xl border border-slate-100 text-[10px] space-y-1.5">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Diagnostic Report Values</span>
                              <div className="flex justify-between border-b border-slate-50 pb-1">
                                <span className="text-slate-500">Observed Result Value:</span>
                                <strong className="text-teal-700 font-bold">{lab.resultValue} {lab.unit}</strong>
                              </div>
                              <div className="flex justify-between border-b border-slate-50 pb-1">
                                <span className="text-slate-500">Normal Diagnostic Range:</span>
                                <span className="text-slate-700 font-medium">{lab.normalRange} {lab.unit}</span>
                              </div>
                              {lab.comments && (
                                <div className="text-slate-500 pt-1">
                                  <span className="font-semibold">Lab Pathologist Comments:</span>
                                  <p className="italic mt-0.5">"{lab.comments}"</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 bg-amber-50/50 border border-amber-100/50 rounded-xl text-[10px] text-amber-800">
                              This test is currently being processed by clinical pathology. Reports will release immediately upon verification.
                            </div>
                          )}
                        </div>

                        {lab.status === 'COMPLETED' && (
                          <button
                            onClick={() => handleDownloadFile({
                              id: lab.id,
                              name: `Lab_Report_${lab.test?.code || 'LAB'}_${lab.bookingDate}.txt`,
                              fileType: 'lab_report',
                              createdAt: new Date(),
                            })}
                            className="w-full h-8 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Full Report (.TXT)</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 6. BILLING & INVOICES VIEW */}
            {activeView === 'billing' && (
              <div className="space-y-6">
                
                {/* Invoice statements table */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Patient Invoice Ledger Statements</h3>
                  
                  {invoices.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                      <p className="text-xs">You have no billed statements on your ledger.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                            <th className="py-3 px-2">Invoice #</th>
                            <th className="py-3 px-2">Bill Date</th>
                            <th className="py-3 px-2">Doctor</th>
                            <th className="py-3 px-2">Subtotal</th>
                            <th className="py-3 px-2">Total Billed</th>
                            <th className="py-3 px-2">Status</th>
                            <th className="py-3 px-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="text-[11px] text-slate-600 divide-y divide-slate-50">
                          {invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/50">
                              <td className="py-3.5 px-2 font-bold text-slate-800">#{inv.invoiceNumber}</td>
                              <td className="py-3.5 px-2">{inv.date}</td>
                              <td className="py-3.5 px-2">Dr. {inv.doctor?.name || 'Staff'}</td>
                              <td className="py-3.5 px-2">${inv.subTotal?.toFixed(2)}</td>
                              <td className="py-3.5 px-2 font-bold text-slate-800">${inv.totalAmount?.toFixed(2)}</td>
                              <td className="py-3.5 px-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  inv.status === 'paid' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-2 text-right">
                                {inv.status !== 'paid' ? (
                                  <button
                                    onClick={() => setPayingInvoice(inv)}
                                    className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[10px] font-bold shadow-sm shadow-teal-500/10 cursor-pointer"
                                  >
                                    Pay Online Now
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-semibold text-emerald-600">Paid & Settled</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Settle payments history */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm max-w-2xl">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Settled Transaction Logs</h3>
                  
                  {payments.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No recent processed transaction payments found.</p>
                  ) : (
                    <div className="space-y-3">
                      {payments.map((pay) => (
                        <div key={pay.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center text-[10px]">
                          <div>
                            <p className="font-bold text-slate-800">Settled Amount: ${pay.amount?.toFixed(2)}</p>
                            <p className="text-slate-400 mt-0.5">Reference ID: {pay.referenceNo} • Method: {pay.paymentMethod?.toUpperCase()}</p>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold border border-emerald-100">{pay.paymentDate}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* 7. DOCUMENTS VIEW */}
            {activeView === 'documents' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm max-w-4xl">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Patient Document Center</h3>
                <p className="text-xs text-slate-400 mb-6">Review and export clinical records, prescriptions, and lab release summaries released to your folder.</p>
                
                {documents.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Download className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-xs">No patient clinical file attachments have been uploaded.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {documents.map((doc) => (
                      <div key={doc.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                        <div className="space-y-1 overflow-hidden pr-3">
                          <p className="text-xs font-bold text-slate-800 truncate">{doc.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-semibold">
                            Type: {doc.fileType?.replace('_', ' ') || 'Record Document'} • Release: {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownloadFile(doc)}
                          className="w-8 h-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center shadow-sm shrink-0 cursor-pointer"
                          title="Export Document"
                        >
                          <Download className="w-4 h-4 text-slate-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 8. NOTIFICATIONS VIEW */}
            {activeView === 'notifications' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm max-w-2xl">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-6">Patient Portal Inbox Alerts</h3>
                
                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Bell className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-xs">Your inbox is currently empty.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className={`p-4 rounded-2xl text-xs transition-all border ${
                          notif.status === 'READ' 
                            ? 'bg-slate-50/50 border-slate-100 text-slate-500' 
                            : 'bg-teal-50/30 border-teal-100 text-slate-800 font-medium'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <p className="font-bold text-slate-900">{notif.title}</p>
                            <p className="opacity-90 mt-1">{notif.message}</p>
                          </div>
                          {notif.status !== 'READ' && (
                            <button
                              onClick={() => handleMarkNotificationRead(notif.id)}
                              className="px-2 py-0.5 border border-teal-200 text-teal-700 rounded text-[9px] font-bold bg-white cursor-pointer"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-2">{new Date(notif.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 9. DEMOGRAPHICS PROFILE EDITOR */}
            {activeView === 'profile' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm max-w-3xl">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Patient Demographics Details</h3>
                
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Full Registered Name (ReadOnly)</label>
                      <input
                        type="text"
                        disabled
                        value={profile?.name || ''}
                        className="w-full h-10 px-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-xs outline-none cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Email Account (ReadOnly)</label>
                      <input
                        type="email"
                        disabled
                        value={profile?.email || ''}
                        className="w-full h-10 px-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-xs outline-none cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Mobile Contact Phone *</label>
                      <input
                        type="tel"
                        required
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        required
                        value={profileDob}
                        onChange={(e) => setProfileDob(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Gender *</label>
                      <select
                        value={profileGender}
                        onChange={(e) => setProfileGender(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Blood Group</label>
                      <input
                        type="text"
                        value={profileBlood}
                        onChange={(e) => setProfileBlood(e.target.value)}
                        placeholder="O+ or B-"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Residential Address</label>
                      <input
                        type="text"
                        value={profileAddress}
                        onChange={(e) => setProfileAddress(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Drug Allergies (Separate by commas)</label>
                      <input
                        type="text"
                        value={profileAllergies}
                        onChange={(e) => setProfileAllergies(e.target.value)}
                        placeholder="e.g. Penicillin, Aspirin, Sulfa drugs"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all text-red-700 font-medium"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Chronic Medical History Context</label>
                      <textarea
                        value={profileMedHistory}
                        onChange={(e) => setProfileMedHistory(e.target.value)}
                        placeholder="Please detail any chronic diseases, high blood pressure, diabetes, past surgeries, etc."
                        className="w-full min-h-[80px] p-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all resize-none"
                      />
                    </div>

                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="h-11 px-6 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl text-xs shadow-md shadow-teal-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {actionLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Save Demographics Updates'
                    )}
                  </button>
                </form>
              </div>
            )}

          </div>
        )}
      </main>

      {/* BILLING ONLINE PAYMENT PROCESSOR POPUP MODAL */}
      <AnimatePresence>
        {payingInvoice && (
          <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white border border-slate-100 shadow-2xl rounded-3xl overflow-hidden"
            >
              {/* Modal header */}
              <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold">Online Billing Checkout</h3>
                  <p className="text-[10px] text-slate-400">Secure Payment for Invoice #{payingInvoice.invoiceNumber}</p>
                </div>
                <button
                  onClick={() => setPayingInvoice(null)}
                  className="w-6.5 h-6.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Modal form */}
              <form onSubmit={handlePayInvoice} className="p-6 space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-500">Amount Outstanding:</span>
                  <strong className="text-slate-900 text-base font-bold">${(payingInvoice.totalAmount - payingInvoice.amountPaid).toFixed(2)}</strong>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Choose Payment Method</label>
                  
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        paymentMethod === 'card' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Credit / Debit Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('upi')}
                      className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        paymentMethod === 'upi' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Instant UPI Pay
                    </button>
                  </div>

                  {paymentMethod === 'card' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Card Number</label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={paymentCardNo}
                            onChange={(e) => setPaymentCardNo(e.target.value)}
                            placeholder="4111 2222 3333 4444"
                            className="w-full h-9.5 pl-10 pr-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Expiration Date</label>
                          <input
                            type="text"
                            required
                            value={paymentCardExpiry}
                            onChange={(e) => setPaymentCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            className="w-full h-9.5 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">CVV Code</label>
                          <input
                            type="password"
                            required
                            value={paymentCardCvv}
                            onChange={(e) => setPaymentCardCvv(e.target.value)}
                            placeholder="•••"
                            maxLength={3}
                            className="w-full h-9.5 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">UPI ID (VPA Address)</label>
                      <input
                        type="text"
                        required
                        value={paymentUpiId}
                        onChange={(e) => setPaymentUpiId(e.target.value)}
                        placeholder="username@okaxis"
                        className="w-full h-9.5 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                      />
                    </div>
                  )}

                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPayingInvoice(null)}
                    className="flex-1 h-10 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 h-10 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-teal-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {actionLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Settle Invoice Pay'
                    )}
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
