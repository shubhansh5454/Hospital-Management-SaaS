import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Beaker,
  Plus,
  Search,
  Filter,
  AlertCircle,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  MapPin,
  ClipboardCheck,
  User,
  History,
  Activity,
  CheckCircle,
  Clock,
  FileDown,
  Trash2,
  Edit2,
  Check,
  X,
  QrCode,
  Tag,
  Stethoscope,
  ExternalLink,
  Loader2,
  Bookmark
} from 'lucide-react';

interface LabTest {
  id: number;
  name: string;
  code: string;
  category: string;
  price: number;
  sampleType: string;
  turnaroundTime: string;
  description?: string;
  createdAt: string;
}

interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface LabOrder {
  id: number;
  patientId: number;
  testId: number;
  status: 'BOOKED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  bookingDate: string;
  sampleCollectedAt?: string;
  sampleBarcode?: string;
  sampleCollector?: string;
  resultValue?: string;
  normalRange?: string;
  unit?: string;
  comments?: string;
  reportAttachmentUrl?: string;
  validatedBy?: string;
  validatedAt?: string;
  createdAt: string;
  patient: Patient;
  test: LabTest;
}

export default function Laboratory() {
  const { token, profile } = useAuth();
  const role = profile?.role || 'patient';
  const isStaff = ['admin', 'doctor', 'receptionist'].includes(role);
  const queryClient = useQueryClient();

  // Navigation: dashboard, orders, catalog
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'catalog'>('dashboard');

  // Filtering states
  const [testSearch, setTestSearch] = useState('');
  const [testCategory, setTestCategory] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');

  // Dialog/Modal states
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTest | null>(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState<LabOrder | null>(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState<LabOrder | null>(null);
  const [viewReportOrder, setViewReportOrder] = useState<LabOrder | null>(null);

  // Notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forms states
  const [testForm, setTestForm] = useState({
    name: '',
    code: '',
    category: 'Hematology',
    price: 0,
    sampleType: 'Blood',
    turnaroundTime: '24 Hours',
    description: ''
  });

  const [bookingForm, setBookingForm] = useState({
    patientId: '',
    testId: '',
    bookingDate: new Date().toISOString().split('T')[0]
  });

  const [collectForm, setCollectForm] = useState({
    barcode: '',
    collector: ''
  });

  const [finalizeForm, setFinalizeForm] = useState({
    resultValue: '',
    normalRange: '',
    unit: '',
    comments: '',
    reportAttachmentUrl: '',
    validatedBy: profile?.name || 'Lab Director'
  });

  // Queries
  const { data: tests = [], isLoading: loadingTests } = useQuery<LabTest[]>({
    queryKey: ['lab-tests', testSearch, testCategory],
    queryFn: async () => {
      const res = await fetch(`/api/lab/tests?search=${encodeURIComponent(testSearch)}&category=${encodeURIComponent(testCategory)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch test catalog');
      return res.json();
    },
    enabled: !!token
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery<LabOrder[]>({
    queryKey: ['lab-orders', orderSearch, orderStatus],
    queryFn: async () => {
      let url = `/api/lab/orders?search=${encodeURIComponent(orderSearch)}&status=${encodeURIComponent(orderStatus)}`;
      if (role === 'patient') {
        // If logged in user is a patient, restrict orders or filter
        // Note: Backend listOrders fetches all, so we can client-filter if user is patient
      }
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      return data;
    },
    enabled: !!token
  });

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients-list-lab'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && isStaff
  });

  const { data: metrics, isLoading: loadingMetrics } = useQuery<any>({
    queryKey: ['lab-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/lab/orders/metrics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    enabled: !!token && isStaff
  });

  // Categories list helper
  const testCategories = ['Hematology', 'Biochemistry', 'Immunology', 'Microbiology', 'Pathology', 'Radiology', 'Other'];

  // Seed Helper
  const seedLabTestsMutation = useMutation({
    mutationFn: async () => {
      const standardTests = [
        { name: 'Complete Blood Count (CBC)', code: 'CBC', category: 'Hematology', price: 45.0, sampleType: 'Blood (EDTA)', turnaroundTime: '12 Hours', description: 'Comprehensive screening of white blood cells, red blood cells, platelets, and hemoglobin levels.' },
        { name: 'Lipid Profile', code: 'LIPID', category: 'Biochemistry', price: 65.0, sampleType: 'Blood (Serum)', turnaroundTime: '12 Hours', description: 'Measures total cholesterol, LDL, HDL, and triglycerides to evaluate cardiovascular risk.' },
        { name: 'HbA1c (Glycated Hemoglobin)', code: 'HBA1C', category: 'Biochemistry', price: 50.0, sampleType: 'Blood (Whole)', turnaroundTime: '24 Hours', description: 'Measures average blood sugar levels over the past 3 months.' },
        { name: 'Urinalysis with Microscopic Exam', code: 'URINE', category: 'Pathology', price: 30.0, sampleType: 'Urine', turnaroundTime: '4 Hours', description: 'Diagnostic evaluation of physical, chemical, and microscopic properties of urine.' },
        { name: 'Thyroid Panel (T3, T4, TSH)', code: 'THYROID', category: 'Immunology', price: 80.0, sampleType: 'Blood (Serum)', turnaroundTime: '24 Hours', description: 'Comprehensive panel to assess metabolic thyroid activity and pituitary regulation.' },
        { name: 'Kidney Function Test (KFT)', code: 'KFT', category: 'Biochemistry', price: 75.0, sampleType: 'Blood (Serum)', turnaroundTime: '12 Hours', description: 'Measures Blood Urea Nitrogen (BUN), Creatinine, and uric acid to analyze renal filtration.' },
        { name: 'COVID-19 Quantitative PCR', code: 'PCR-COV', category: 'Microbiology', price: 110.0, sampleType: 'Nasal Swab', turnaroundTime: '6 Hours', description: 'Real-time PCR molecular analysis for detection of viral RNA genomes.' }
      ];

      for (const t of standardTests) {
        await fetch('/api/lab/tests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(t)
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
      setSuccessMsg('Prepopulated standard laboratory test catalogue successfully!');
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to seed catalog');
    }
  });

  // Mutations
  const createTestMutation = useMutation({
    mutationFn: async (data: typeof testForm) => {
      const res = await fetch('/api/lab/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save test description');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
      setSuccessMsg('New lab test successfully created in dictionary!');
      setShowAddTestModal(false);
      resetTestForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error saving test');
    }
  });

  const updateTestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof testForm> }) => {
      const res = await fetch(`/api/lab/tests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update test');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
      setSuccessMsg('Lab test catalog item updated successfully!');
      setEditingTest(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error updating test');
    }
  });

  const deleteTestMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/lab/tests/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete test');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
      setSuccessMsg('Lab test deleted successfully!');
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error deleting test');
    }
  });

  const bookOrderMutation = useMutation({
    mutationFn: async (data: typeof bookingForm) => {
      const payload = {
        patientId: parseInt(data.patientId),
        testId: parseInt(data.testId),
        bookingDate: data.bookingDate
      };
      const res = await fetch('/api/lab/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to book test');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['lab-metrics'] });
      setSuccessMsg('Lab test booked successfully! Specimen is ready for sample collection.');
      setShowBookModal(false);
      resetBookingForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error booking test');
    }
  });

  const collectSampleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof collectForm }) => {
      const res = await fetch(`/api/lab/orders/${id}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to collect sample');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['lab-metrics'] });
      setSuccessMsg('Sample collection logged! Barcode label generated and test status set to SAMPLE_COLLECTED.');
      setShowCollectModal(null);
      resetCollectForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error collecting sample');
    }
  });

  const startAnalysisMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/lab/orders/${id}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to start lab analysis');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['lab-metrics'] });
      setSuccessMsg('Specimen is now under processing in the laboratory machine (IN_PROGRESS).');
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error starting analysis');
    }
  });

  const finalizeResultsMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof finalizeForm }) => {
      const res = await fetch(`/api/lab/orders/${id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to finalize report');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['lab-metrics'] });
      setSuccessMsg('Lab report results finalized and digitally validated!');
      setShowFinalizeModal(null);
      resetFinalizeForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error finalizing results');
    }
  });

  // Reset Helpers
  const resetTestForm = () => {
    setTestForm({
      name: '',
      code: '',
      category: 'Hematology',
      price: 0,
      sampleType: 'Blood',
      turnaroundTime: '24 Hours',
      description: ''
    });
  };

  const resetBookingForm = () => {
    setBookingForm({
      patientId: '',
      testId: '',
      bookingDate: new Date().toISOString().split('T')[0]
    });
  };

  const resetCollectForm = () => {
    setCollectForm({
      barcode: '',
      collector: profile?.name || 'Lab Assistant'
    });
  };

  const resetFinalizeForm = () => {
    setFinalizeForm({
      resultValue: '',
      normalRange: '',
      unit: '',
      comments: '',
      reportAttachmentUrl: '',
      validatedBy: profile?.name || 'Lab Director'
    });
  };

  // Helper status color classes
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BOOKED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'SAMPLE_COLLECTED':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'IN_PROGRESS':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Filtered orders for patient
  const patientFilteredOrders = useMemo(() => {
    if (role === 'patient') {
      return orders.filter(o => o.patientId === profile?.id);
    }
    return orders;
  }, [orders, role, profile]);

  return (
    <div className="w-full space-y-6" id="lab-module-container">
      {/* Toast Alert Banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-between p-4 text-sm text-green-800 rounded-lg bg-green-50 border border-green-200 shadow-sm"
            role="alert"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-green-500 hover:text-green-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-between p-4 text-sm text-red-800 rounded-lg bg-red-50 border border-red-200 shadow-sm"
            role="alert"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lab Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-gray-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Beaker className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Diagnostic Laboratory Service</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Book medical tests, track sample collections in real-time, upload lab findings, and sign off on validated clinical reports.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 max-w-max">
          {isStaff && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Lab Dashboard
            </button>
          )}
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'orders'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {isStaff ? 'Test Bookings & Samples' : 'My Lab Reports'}
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'catalog'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Test Catalog
          </button>
        </div>
      </div>

      {/* VIEW 1: LAB DASHBOARD (Staff Only) */}
      {activeTab === 'dashboard' && isStaff && (
        <div className="space-y-6" id="lab-dashboard-view">
          {loadingMetrics ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-gray-500 text-sm mt-3 font-medium">Loading laboratory workspace statistics...</p>
            </div>
          ) : !metrics ? (
            <div className="text-center py-12 text-gray-500">Could not retrieve metrics.</div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">{metrics.kpi.totalOrders}</p>
                  </div>
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase">Pending Sample</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">{metrics.kpi.pendingCollection}</p>
                  </div>
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                    <QrCode className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase">Sample Collected</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">{metrics.kpi.sampleCollected}</p>
                  </div>
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase">In Progress</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">{metrics.kpi.inProgress}</p>
                  </div>
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase">Validated Reports</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">{metrics.kpi.completed}</p>
                  </div>
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Middle Section: Pre-population notice / Category Distribution / Recent bookings */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Category distribution */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                  <h3 className="font-semibold text-gray-900">Lab Tests by Category</h3>
                  <div className="space-y-3">
                    {metrics.categories.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No tests defined. Go to Test Catalog to add tests or auto-prepopulate.</p>
                    ) : (
                      metrics.categories.map((c: any) => (
                        <div key={c.category} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium text-gray-700">
                            <span>{c.category}</span>
                            <span className="font-mono">{c.count} types</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div 
                              className="bg-indigo-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, (c.count / tests.length) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Bookings Feed */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Recent Laboratory Activities</h3>
                    <button 
                      onClick={() => setActiveTab('orders')} 
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      View all bookings
                    </button>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {metrics.recentOrders.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">No recent bookings recorded.</div>
                    ) : (
                      metrics.recentOrders.map((ord: any) => (
                        <div key={ord.id} className="py-3 flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded bg-gray-50 text-indigo-600">
                              <Beaker className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{ord.test.name}</div>
                              <div className="text-xs text-gray-500">
                                Patient: <span className="font-medium text-gray-700">{ord.patient.name}</span> | Date: {ord.bookingDate}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(ord.status)}`}>
                            {ord.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW 2: TEST BOOKINGS & SAMPLE TRACKING (LIST VIEW) */}
      {activeTab === 'orders' && (
        <div className="space-y-4" id="lab-bookings-view">
          {/* Filters & Actions bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Patient name, test, barcode..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white"
                />
              </div>

              {/* Status */}
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="BOOKED">Booked (Pending Sample)</option>
                <option value="SAMPLE_COLLECTED">Sample Collected</option>
                <option value="IN_PROGRESS">In Lab (Analysis)</option>
                <option value="COMPLETED">Completed (Validated)</option>
              </select>
            </div>

            {/* Book Button */}
            {isStaff && (
              <button
                onClick={() => {
                  resetBookingForm();
                  setShowBookModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Book Lab Test
              </button>
            )}
          </div>

          {/* Bookings / Sample Log list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loadingOrders ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-gray-500 text-sm mt-2 font-medium">Fetching laboratory records...</p>
              </div>
            ) : patientFilteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Bookmark className="w-12 h-12 text-gray-300 mb-2" />
                <h3 className="text-lg font-semibold text-gray-900">No Laboratory Records</h3>
                <p className="text-sm text-gray-500 max-w-sm mt-1">
                  {isStaff 
                    ? 'No orders found matching the filter. Book a diagnostic test for a patient to log a sample.'
                    : 'You do not have any pending or completed laboratory diagnostic reports at this clinic.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Booking ID & Patient</th>
                      <th className="px-6 py-4">Test Requested</th>
                      <th className="px-6 py-4">Specimen Type</th>
                      <th className="px-6 py-4">Barcode / Tracking</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Booking Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {patientFilteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{ord.patient.name}</div>
                          <div className="text-xs text-gray-500">UID: LAB-{ord.id} | {ord.patient.phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                            <span className="font-mono text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-bold">
                              {ord.test.code}
                            </span>
                            <span>{ord.test.name}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{ord.test.category}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                            {ord.test.sampleType}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-600">
                          {ord.sampleBarcode ? (
                            <div className="flex items-center gap-1">
                              <QrCode className="w-4 h-4 text-indigo-600" />
                              <span className="font-bold text-gray-800">{ord.sampleBarcode}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Not Collected</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(ord.status)}`}>
                            {ord.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                          {ord.bookingDate}
                        </td>
                        <td className="px-6 py-4 text-right space-x-1">
                          {/* VIEW REPORT IF COMPLETED */}
                          {ord.status === 'COMPLETED' ? (
                            <button
                              onClick={() => setViewReportOrder(ord)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" />
                              View Report
                            </button>
                          ) : isStaff ? (
                            <div className="inline-flex gap-1.5">
                              {/* ACTIONS FOR STAFF */}
                              {ord.status === 'BOOKED' && (
                                <button
                                  onClick={() => {
                                    setCollectForm({
                                      barcode: `SMP-${Date.now().toString().slice(-6)}`,
                                      collector: profile?.name || 'Lab Assistant'
                                    });
                                    setShowCollectModal(ord);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  Collect Sample
                                </button>
                              )}

                              {ord.status === 'SAMPLE_COLLECTED' && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Begin processing specimen barcode ${ord.sampleBarcode} in laboratory analysis?`)) {
                                      startAnalysisMutation.mutate(ord.id);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition"
                                >
                                  <Beaker className="w-3.5 h-3.5 animate-spin-slow" />
                                  Start Lab
                                </button>
                              )}

                              {ord.status === 'IN_PROGRESS' && (
                                <button
                                  onClick={() => {
                                    setFinalizeForm({
                                      resultValue: '',
                                      normalRange: 'Normal',
                                      unit: '',
                                      comments: '',
                                      reportAttachmentUrl: '',
                                      validatedBy: profile?.name || 'Lab Director'
                                    });
                                    setShowFinalizeModal(ord);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition animate-pulse"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Submit Report
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Processing...</span>
                          )}
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

      {/* VIEW 3: LAB TESTS CATALOG DICTIONARY */}
      {activeTab === 'catalog' && (
        <div className="space-y-6" id="lab-catalog-view">
          {/* Header catalog filter and search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search lab tests catalog..."
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white"
                />
              </div>

              {/* Category */}
              <select
                value={testCategory}
                onChange={(e) => setTestCategory(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {testCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Staff actions */}
            {isStaff && (
              <div className="flex gap-2">
                {tests.length === 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Would you like to seed 7 standard clinical laboratory tests immediately?')) {
                        seedLabTestsMutation.mutate();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                  >
                    <Plus className="w-4 h-4" />
                    Seed Standard Tests
                  </button>
                )}
                <button
                  onClick={() => {
                    resetTestForm();
                    setShowAddTestModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  Register New Test
                </button>
              </div>
            )}
          </div>

          {/* Test list cards */}
          {loadingTests ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-gray-500 text-sm mt-3 font-medium">Fetching diagnostics registry...</p>
            </div>
          ) : tests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-200">
              <Beaker className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900">Diagnostic Catalog Empty</h3>
              <p className="text-sm text-gray-500 max-w-sm mt-1">
                No custom lab tests are registered.
              </p>
              {isStaff && (
                <button
                  onClick={() => seedLabTestsMutation.mutate()}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
                >
                  Prepopulate 7 Diagnostic Tests
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tests.map((t) => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition duration-200 p-5 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-100">
                        {t.category}
                      </span>
                      <span className="font-mono text-xs text-gray-400 font-semibold uppercase">#{t.code}</span>
                    </div>

                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{t.name}</h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description || 'No descriptive information available.'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                      <div>
                        <span className="text-gray-400 block uppercase font-semibold text-[10px]">Specimen</span>
                        <span className="font-semibold text-gray-700">{t.sampleType}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block uppercase font-semibold text-[10px]">Turnaround</span>
                        <span className="font-semibold text-gray-700">{t.turnaroundTime}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                    <div className="text-gray-900 font-mono font-bold text-lg">
                      ${t.price.toFixed(2)}
                    </div>

                    {isStaff && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => {
                            setEditingTest(t);
                            setTestForm({
                              name: t.name,
                              code: t.code,
                              category: t.category,
                              price: t.price,
                              sampleType: t.sampleType,
                              turnaroundTime: t.turnaroundTime,
                              description: t.description || ''
                            });
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded"
                          title="Edit definition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to completely remove ${t.name} from the catalog?`)) {
                              deleteTestMutation.mutate(t.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-50 rounded"
                          title="Delete test"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DIALOG 1: BOOK LAB TEST ORDER */}
      {showBookModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4 relative"
          >
            <button 
              onClick={() => setShowBookModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Beaker className="w-5 h-5 text-indigo-600" />
              Book Laboratory Test
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!bookingForm.patientId || !bookingForm.testId) {
                  alert('Please fill out all fields');
                  return;
                }
                bookOrderMutation.mutate(bookingForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Select Patient</label>
                <select
                  value={bookingForm.patientId}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, patientId: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Choose Patient Account --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Select Laboratory Test</label>
                <select
                  value={bookingForm.testId}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, testId: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Choose Diagnostic Test --</option>
                  {tests.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category}) - ${t.price.toFixed(2)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Schedule Booking Date</label>
                <input
                  type="date"
                  value={bookingForm.bookingDate}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, bookingDate: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookOrderMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {bookOrderMutation.isPending ? 'Booking...' : 'Book Diagnostic'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DIALOG 2: RECORD SAMPLE COLLECTION */}
      {showCollectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4 relative"
          >
            <button 
              onClick={() => setShowCollectModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-600" />
              Collect Specimen Sample
            </h3>

            <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg text-xs space-y-1.5 text-amber-900">
              <div><strong>Test:</strong> {showCollectModal.test.name}</div>
              <div><strong>Patient:</strong> {showCollectModal.patient.name}</div>
              <div><strong>Specimen Requirement:</strong> {showCollectModal.test.sampleType}</div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                collectSampleMutation.mutate({
                  id: showCollectModal.id,
                  data: collectForm
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Generated Sample Barcode / RFID ID</label>
                <input
                  type="text"
                  value={collectForm.barcode}
                  onChange={(e) => setCollectForm(prev => ({ ...prev, barcode: e.target.value.toUpperCase() }))}
                  className="w-full text-sm font-mono border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Sample Collector Name</label>
                <input
                  type="text"
                  value={collectForm.collector}
                  onChange={(e) => setCollectForm(prev => ({ ...prev, collector: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(null)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={collectSampleMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {collectSampleMutation.isPending ? 'Recording Specimen...' : 'Confirm Sample Collection'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DIALOG 3: SUBMIT / FINALIZE RESULTS */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4 relative max-h-[90vh] overflow-y-auto"
          >
            <button 
              onClick={() => setShowFinalizeModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Upload Diagnostic Lab Report
            </h3>

            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs grid grid-cols-2 gap-2 text-indigo-950">
              <div><strong>Test Code:</strong> {showFinalizeModal.test.code}</div>
              <div><strong>Patient Account:</strong> {showFinalizeModal.patient.name}</div>
              <div><strong>Barcode:</strong> {showFinalizeModal.sampleBarcode}</div>
              <div><strong>Turnaround Limit:</strong> {showFinalizeModal.test.turnaroundTime}</div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                finalizeResultsMutation.mutate({
                  id: showFinalizeModal.id,
                  data: finalizeForm
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Result Value</label>
                  <input
                    type="text"
                    placeholder="e.g. 14.5"
                    value={finalizeForm.resultValue}
                    onChange={(e) => setFinalizeForm(prev => ({ ...prev, resultValue: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. g/dL, mg/dL"
                    value={finalizeForm.unit}
                    onChange={(e) => setFinalizeForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Normal Range</label>
                  <input
                    type="text"
                    placeholder="e.g. 12.0 - 16.0"
                    value={finalizeForm.normalRange}
                    onChange={(e) => setFinalizeForm(prev => ({ ...prev, normalRange: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Report Attachment Link (URL)</label>
                <input
                  type="text"
                  placeholder="https://example.com/reports/lab-cbc-pdf"
                  value={finalizeForm.reportAttachmentUrl}
                  onChange={(e) => setFinalizeForm(prev => ({ ...prev, reportAttachmentUrl: e.target.value }))}
                  className="w-full text-sm font-mono border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Pathology Comments / Clinic Notes</label>
                <textarea
                  placeholder="Notes on pathological values or abnormal counts..."
                  value={finalizeForm.comments}
                  onChange={(e) => setFinalizeForm(prev => ({ ...prev, comments: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded-lg p-2.5 focus:outline-none h-18"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Digitally Validated By (Doctor/Technologist Signature)</label>
                <input
                  type="text"
                  value={finalizeForm.validatedBy}
                  onChange={(e) => setFinalizeForm(prev => ({ ...prev, validatedBy: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFinalizeModal(null)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={finalizeResultsMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {finalizeResultsMutation.isPending ? 'Validating results...' : 'Finalize & Sign Off'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DIALOG 4: REGISTER / EDIT LAB TEST CATALOG DEFINITION */}
      {(showAddTestModal || editingTest) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4 relative"
          >
            <button 
              onClick={() => {
                setShowAddTestModal(false);
                setEditingTest(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Beaker className="w-5 h-5 text-indigo-600" />
              {editingTest ? 'Edit Catalog Test Definition' : 'Add New Diagnostic Test'}
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingTest) {
                  updateTestMutation.mutate({
                    id: editingTest.id,
                    data: testForm
                  });
                } else {
                  createTestMutation.mutate(testForm);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Test Name</label>
                <input
                  type="text"
                  placeholder="e.g. Lipase Enzyme Test"
                  value={testForm.name}
                  onChange={(e) => setTestForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Unique Test Code</label>
                  <input
                    type="text"
                    placeholder="e.g. LPSE"
                    value={testForm.code}
                    onChange={(e) => setTestForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full text-sm font-mono border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Category</label>
                  <select
                    value={testForm.category}
                    onChange={(e) => setTestForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none bg-gray-50"
                  >
                    {testCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Specimen Sample Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Blood, Urine"
                    value={testForm.sampleType}
                    onChange={(e) => setTestForm(prev => ({ ...prev, sampleType: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Turnaround Limit</label>
                  <input
                    type="text"
                    placeholder="e.g. 24 Hours"
                    value={testForm.turnaroundTime}
                    onChange={(e) => setTestForm(prev => ({ ...prev, turnaroundTime: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Test Pricing ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 120.00"
                  value={testForm.price}
                  onChange={(e) => setTestForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Test Description / Clinical Pre-requisites</label>
                <textarea
                  placeholder="Notes for clinical guidelines, fasting prerequisites, etc."
                  value={testForm.description}
                  onChange={(e) => setTestForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded-lg p-2.5 focus:outline-none h-16"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTestModal(false);
                    setEditingTest(null);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
                >
                  Save Test Definition
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DIALOG 5: ELEGANT CLINICAL REPORT VIEW (Diagnostic Printout Card) */}
      {viewReportOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 shadow-2xl max-w-2xl w-full p-8 space-y-6 relative border-t-8 border-indigo-600"
          >
            <button 
              onClick={() => setViewReportOrder(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Pathology lab Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Beaker className="w-6 h-6 text-indigo-600" />
                  <span className="font-bold text-lg text-indigo-950 tracking-tight">CareSync Diagnostic Labs</span>
                </div>
                <p className="text-xs text-gray-400">100 Clinic Drive, Suite A • clinical-services@caresync.org</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                  Digitally Validated
                </span>
                <p className="text-xs text-gray-400 mt-1 font-mono">ID: {viewReportOrder.sampleBarcode || `SMP-${viewReportOrder.id}`}</p>
              </div>
            </div>

            {/* Demographics Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg text-xs border border-gray-100">
              <div>
                <span className="text-gray-400 block uppercase font-bold text-[9px]">Patient Name</span>
                <span className="font-bold text-gray-800">{viewReportOrder.patient.name}</span>
              </div>
              <div>
                <span className="text-gray-400 block uppercase font-bold text-[9px]">Contact No.</span>
                <span className="font-semibold text-gray-700">{viewReportOrder.patient.phone}</span>
              </div>
              <div>
                <span className="text-gray-400 block uppercase font-bold text-[9px]">Specimen Type</span>
                <span className="font-semibold text-gray-700">{viewReportOrder.test.sampleType}</span>
              </div>
              <div>
                <span className="text-gray-400 block uppercase font-bold text-[9px]">Report Finalized</span>
                <span className="font-semibold text-gray-700 font-mono">
                  {viewReportOrder.validatedAt ? new Date(viewReportOrder.validatedAt).toLocaleDateString() : viewReportOrder.bookingDate}
                </span>
              </div>
            </div>

            {/* Core Results Block */}
            <div className="space-y-3">
              <h4 className="font-bold text-gray-900 border-b pb-2 text-sm uppercase tracking-wider text-indigo-900">Lab Analysis findings</h4>

              <div className="grid grid-cols-12 bg-gray-50/50 p-4 rounded-lg border border-gray-100 font-mono text-sm font-semibold text-gray-800">
                <div className="col-span-4 text-xs font-bold text-gray-500 uppercase">Parameter Test</div>
                <div className="col-span-3 text-center text-xs font-bold text-gray-500 uppercase">Observed Value</div>
                <div className="col-span-3 text-center text-xs font-bold text-gray-500 uppercase">Normal Range</div>
                <div className="col-span-2 text-right text-xs font-bold text-gray-500 uppercase">Unit</div>
              </div>

              <div className="grid grid-cols-12 px-4 py-3 text-sm font-medium items-center">
                <div className="col-span-4 text-gray-900 font-bold">{viewReportOrder.test.name}</div>
                <div className="col-span-3 text-center text-indigo-700 font-bold font-mono bg-indigo-50/50 py-1 rounded border border-indigo-100/50">
                  {viewReportOrder.resultValue}
                </div>
                <div className="col-span-3 text-center text-gray-600 font-mono">{viewReportOrder.normalRange || 'Normal'}</div>
                <div className="col-span-2 text-right text-gray-600 font-mono">{viewReportOrder.unit || 'n/a'}</div>
              </div>
            </div>

            {/* Comments block */}
            {viewReportOrder.comments && (
              <div className="p-4 bg-indigo-50/20 rounded-lg border border-indigo-50 text-xs">
                <strong className="text-indigo-950 block mb-1">Pathology Comments:</strong>
                <p className="text-gray-600 leading-relaxed italic">"{viewReportOrder.comments}"</p>
              </div>
            )}

            {/* Approval / Signature Section */}
            <div className="flex justify-between items-end border-t pt-6 text-xs">
              <div className="space-y-1">
                {viewReportOrder.reportAttachmentUrl && (
                  <a
                    href={viewReportOrder.reportAttachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold print:hidden"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Reference Document Attachment
                  </a>
                )}
                <div className="text-gray-400 mt-1">Processed by: {viewReportOrder.sampleCollector || 'Lab Tech Staff'}</div>
              </div>

              <div className="text-right space-y-1">
                <div className="font-bold text-gray-900 flex items-center justify-end gap-1">
                  <Stethoscope className="w-4 h-4 text-emerald-600" />
                  {viewReportOrder.validatedBy}
                </div>
                <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Authorized Signatory Approval</div>
              </div>
            </div>

            {/* Print button */}
            <div className="pt-2 flex justify-end space-x-2 print:hidden">
              <button
                type="button"
                onClick={() => setViewReportOrder(null)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Close Report
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <FileDown className="w-4 h-4" />
                Print diagnostic Report
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
