import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Pill,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  PackageCheck,
  Calendar,
  Layers,
  MapPin,
  ClipboardList,
  User,
  ShoppingBag,
  ArrowDownCircle,
  ArrowUpRight,
  Info,
  Trash2,
  Edit2,
  Check,
  X,
  CreditCard,
  History,
  Truck,
  RotateCcw,
  ShieldAlert,
  Barcode,
  Activity,
  FileText,
  Sliders
} from 'lucide-react';

interface Medicine {
  id: number;
  name: string;
  category: string;
  code: string;
  stock: number;
  minStockAlert: number;
  expiryDate: string;
  unitPrice: number;
  purchasePrice: number;
  rackLocation?: string;
  createdAt: string;
  barcode: string;
  isControlled: boolean;
  dosage: string;
  vendorId?: number | null;
  batches?: any[];
  returns?: any[];
}

interface Vendor {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  drugLicense: string;
  paymentTerms: string;
}

interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export default function Pharmacy() {
  const { token, profile } = useAuth();
  const role = profile?.role || 'patient';
  const isMedicalStaff = ['admin', 'doctor', 'receptionist', 'superadmin'].includes(role);
  const queryClient = useQueryClient();

  // Active Tab: medicines, checkout, purchase, returns, vendors, forecasting
  const [activeTab, setActiveTab] = useState<'medicines' | 'checkout' | 'purchase' | 'returns' | 'vendors' | 'forecasting'>('medicines');

  // Search & filter states
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'nearexpiry'>('all');

  // Interactive scan states
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState('');
  const [scanFeedback, setScanFeedback] = useState('');

  // Editing / modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [showDetailMedicine, setShowDetailMedicine] = useState<Medicine | null>(null);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Success & Error Alerts
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forms
  const [medicineForm, setMedicineForm] = useState({
    name: '',
    category: 'Tablets',
    code: '',
    minStockAlert: 10,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    unitPrice: 0.0,
    purchasePrice: 0.0,
    rackLocation: '',
    barcode: '',
    isControlled: false,
    dosage: '500mg',
    vendorId: ''
  });

  const [vendorForm, setVendorForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    drugLicense: '',
    paymentTerms: 'Net 30'
  });

  const [purchaseForm, setPurchaseForm] = useState({
    medicineId: '',
    quantity: 10,
    vendorId: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    batchNumber: '',
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    totalCost: 0.0
  });

  const [returnForm, setReturnForm] = useState({
    medicineId: '',
    quantity: 5,
    returnDate: new Date().toISOString().split('T')[0],
    type: 'PATIENT' as 'PATIENT' | 'VENDOR',
    reason: '',
    batchNumber: ''
  });

  // Sales Basket (Unified Cart)
  const [cart, setCart] = useState<Array<{
    medicine: Medicine;
    quantity: number;
    selectedBatch: string;
    doctorName?: string;
    rxId?: string;
  }>>([]);

  const [checkoutPatientId, setCheckoutPatientId] = useState('');
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [overallDiscount, setOverallDiscount] = useState(0); // in percentage

  // QUERIES
  const { data: medicines = [], isLoading: loadingMeds } = useQuery<Medicine[]>({
    queryKey: ['medicines', search, categoryFilter, stockFilter, expiryFilter],
    queryFn: async () => {
      let url = `/api/pharmacy?search=${encodeURIComponent(search)}&category=${encodeURIComponent(categoryFilter)}`;
      if (stockFilter === 'low') url += '&lowStock=true';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch medicines');
      let data = await res.json();

      if (stockFilter === 'out') {
        data = data.filter((m: Medicine) => m.stock === 0);
      }
      const today = new Date().toISOString().split('T')[0];
      if (expiryFilter === 'expired') {
        data = data.filter((m: Medicine) => m.expiryDate < today);
      } else if (expiryFilter === 'nearexpiry') {
        data = data.filter((m: Medicine) => {
          if (m.expiryDate < today) return false;
          const exp = new Date(m.expiryDate).getTime();
          const cur = new Date(today).getTime();
          const days = (exp - cur) / (1000 * 3600 * 24);
          return days <= 90;
        });
      }
      return data;
    },
    enabled: !!token
  });

  const { data: vendors = [], isLoading: loadingVendors } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => {
      const res = await fetch('/api/pharmacy/vendors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load vendors');
      return res.json();
    },
    enabled: !!token && isMedicalStaff
  });

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && isMedicalStaff
  });

  const { data: returnsList = [], isLoading: loadingReturns } = useQuery<any[]>({
    queryKey: ['returns'],
    queryFn: async () => {
      const res = await fetch('/api/pharmacy/returns', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && isMedicalStaff && activeTab === 'returns'
  });

  const { data: forecastData = [], isLoading: loadingForecast } = useQuery<any[]>({
    queryKey: ['forecast'],
    queryFn: async () => {
      const res = await fetch('/api/pharmacy/forecast', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && isMedicalStaff && activeTab === 'forecasting'
  });

  const { data: expiryPredictions = [], isLoading: loadingPredictions } = useQuery<any[]>({
    queryKey: ['expiry-predictions'],
    queryFn: async () => {
      const res = await fetch('/api/pharmacy/predict-expiry', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && isMedicalStaff && activeTab === 'forecasting'
  });

  // MUTATIONS
  const addVendorMutation = useMutation({
    mutationFn: async (data: typeof vendorForm) => {
      const res = await fetch('/api/pharmacy/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create vendor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setSuccessMsg('Vendor registered successfully!');
      setShowAddVendorModal(false);
      resetVendorForm();
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const updateVendorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<typeof vendorForm> }) => {
      const res = await fetch(`/api/pharmacy/vendors/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update vendor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setSuccessMsg('Vendor updated successfully!');
      setEditingVendor(null);
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/pharmacy/vendors/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete vendor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setSuccessMsg('Vendor deleted successfully.');
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const createMedicineMutation = useMutation({
    mutationFn: async (data: typeof medicineForm) => {
      const payload = {
        ...data,
        minStockAlert: parseInt(data.minStockAlert as any),
        unitPrice: parseFloat(data.unitPrice as any),
        purchasePrice: parseFloat(data.purchasePrice as any),
        vendorId: data.vendorId ? parseInt(data.vendorId) : null
      };
      const res = await fetch('/api/pharmacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to register medicine');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setSuccessMsg('Medicine registered and catalog upgraded!');
      setShowAddModal(false);
      resetMedicineForm();
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const updateMedicineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof medicineForm> }) => {
      const payload = {
        ...data,
        minStockAlert: data.minStockAlert ? parseInt(data.minStockAlert as any) : undefined,
        unitPrice: data.unitPrice ? parseFloat(data.unitPrice as any) : undefined,
        purchasePrice: data.purchasePrice ? parseFloat(data.purchasePrice as any) : undefined,
        vendorId: data.vendorId ? parseInt(data.vendorId) : null
      };
      const res = await fetch(`/api/pharmacy/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update medicine');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setSuccessMsg('Medicine catalog details updated successfully!');
      setEditingMedicine(null);
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const deleteMedicineMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/pharmacy/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete medicine');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setSuccessMsg('Medicine deleted successfully!');
      setShowDetailMedicine(null);
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const recordPurchaseMutation = useMutation({
    mutationFn: async (data: typeof purchaseForm) => {
      const payload = {
        ...data,
        medicineId: parseInt(data.medicineId),
        quantity: parseInt(data.quantity as any),
        totalCost: parseFloat(data.totalCost as any),
        supplier: vendors.find(v => v.id === parseInt(data.vendorId))?.name || 'Unknown supplier'
      };
      const res = await fetch('/api/pharmacy/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to record purchase');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setSuccessMsg('Stock restocked. New batch created successfully!');
      resetPurchaseForm();
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const recordReturnMutation = useMutation({
    mutationFn: async (data: typeof returnForm) => {
      const payload = {
        ...data,
        medicineId: parseInt(data.medicineId),
        quantity: parseInt(data.quantity as any)
      };
      const res = await fetch('/api/pharmacy/returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to record return logs');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      setSuccessMsg('Return logged! Master and batch inventories recalculated.');
      resetReturnForm();
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const recordSaleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/pharmacy/sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to complete checkout');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setSuccessMsg('Sales checkout registered successfully! Stock is decremented.');
      setCart([]);
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  // BARCODE SCANNING CONTROLLER SIMULATION
  const handleBarcodeScanSimulated = (code: string) => {
    setScanning(true);
    setScanResult('');
    setScanFeedback('Scanning barcode pattern...');
    
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/pharmacy/scan?barcode=${encodeURIComponent(code)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          setScanFeedback('No matching drug code found.');
          setScanning(false);
          return;
        }
        const med = await res.json();
        setScanResult(med.name);
        setScanFeedback(`Found matched item: ${med.name} (${med.dosage})`);
        
        // Add to Cart
        const batches = med.batches || [];
        const defaultBatch = batches.find((b: any) => b.currentQty > 0)?.batchNumber || 'BT-AUTO';
        
        setCart(prev => {
          const exists = prev.findIndex(item => item.medicine.id === med.id);
          if (exists > -1) {
            const updated = [...prev];
            updated[exists].quantity += 1;
            return updated;
          }
          return [...prev, { medicine: med, quantity: 1, selectedBatch: defaultBatch }];
        });
        
        setScanning(false);
      } catch (err) {
        setScanFeedback('Error resolving barcode database.');
        setScanning(false);
      }
    }, 1200);
  };

  // Helper resetting forms
  const resetMedicineForm = () => {
    setMedicineForm({
      name: '',
      category: 'Tablets',
      code: '',
      minStockAlert: 10,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      unitPrice: 0.0,
      purchasePrice: 0.0,
      rackLocation: '',
      barcode: '',
      isControlled: false,
      dosage: '500mg',
      vendorId: ''
    });
  };

  const resetVendorForm = () => {
    setVendorForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      drugLicense: '',
      paymentTerms: 'Net 30'
    });
  };

  const resetPurchaseForm = () => {
    setPurchaseForm({
      medicineId: '',
      quantity: 10,
      vendorId: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      batchNumber: '',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalCost: 0.0
    });
  };

  const resetReturnForm = () => {
    setReturnForm({
      medicineId: '',
      quantity: 5,
      returnDate: new Date().toISOString().split('T')[0],
      type: 'PATIENT',
      reason: '',
      batchNumber: ''
    });
  };

  // CART CALCULATIONS
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.medicine.unitPrice * item.quantity), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return subtotal * (overallDiscount / 100);
  }, [subtotal, overallDiscount]);

  const taxAmount = useMemo(() => {
    return (subtotal - discountAmount) * 0.08; // 8% local medical sales tax
  }, [subtotal, discountAmount]);

  const grandTotal = useMemo(() => {
    return (subtotal - discountAmount) + taxAmount;
  }, [subtotal, discountAmount, taxAmount]);

  const cartHasControlledSubstances = useMemo(() => {
    return cart.some(item => item.medicine.isControlled);
  }, [cart]);

  const handleCheckoutSubmit = () => {
    if (cart.length === 0) {
      setErrorMsg('Your checkout basket is currently empty.');
      return;
    }

    // Process checkout for each item in the basket
    cart.forEach(item => {
      const payload = {
        medicineId: item.medicine.id,
        quantity: item.quantity,
        patientId: checkoutPatientId ? parseInt(checkoutPatientId) : undefined,
        saleDate: new Date().toISOString().split('T')[0],
        totalPrice: item.medicine.unitPrice * item.quantity * (1 - overallDiscount / 100),
        paymentMethod: checkoutPaymentMethod,
        notes: checkoutNotes,
        batchNumber: item.selectedBatch,
        doctorName: item.doctorName,
        rxId: item.rxId
      };
      recordSaleMutation.mutate(payload);
    });
  };

  return (
    <div className="w-full space-y-6" id="pharmacy-system-upgraded">
      {/* SUCCESS/ERROR TOAST BANNERS */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-between p-4 mb-2 text-sm text-emerald-800 rounded-xl bg-emerald-50 border border-emerald-200 shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-between p-4 mb-2 text-sm text-red-800 rounded-xl bg-red-50 border border-red-200 shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BAR */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between pb-6 border-b border-gray-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-600/10">
              <Pill className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Enterprise CareSync Pharmacy</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Barcode workflows, advanced batch analytics, expiration models, controlled substances guardrails, & stock forecasting.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-inner max-w-max">
          <button
            onClick={() => setActiveTab('medicines')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'medicines' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Medicine Master
          </button>
          {isMedicalStaff && (
            <>
              <button
                onClick={() => setActiveTab('checkout')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all relative ${
                  activeTab === 'checkout' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Checkout Basket
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center animate-bounce">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('purchase')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeTab === 'purchase' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Restock orders
              </button>
              <button
                onClick={() => setActiveTab('returns')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeTab === 'returns' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Returns Center
              </button>
              <button
                onClick={() => setActiveTab('vendors')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeTab === 'vendors' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Distributors
              </button>
              <button
                onClick={() => setActiveTab('forecasting')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeTab === 'forecasting' ? 'bg-white text-gray-900 shadow-md animate-pulse' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                BI Predictive Tools
              </button>
            </>
          )}
        </div>
      </div>

      {/* VIEW 1: MEDICINE MASTER CATALOG */}
      {activeTab === 'medicines' && (
        <div className="space-y-6">
          {/* SEARCH & FILTERS PANEL */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by barcode, code, name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Categories</option>
              <option value="Tablets">Tablets</option>
              <option value="Syrups">Syrups</option>
              <option value="Antibiotics">Antibiotics</option>
              <option value="Injections">Injections</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Stocks</option>
              <option value="low">⚠️ Low Stock Alert</option>
              <option value="out">❌ Out of Stock</option>
            </select>

            {isMedicalStaff && (
              <button
                onClick={() => {
                  resetMedicineForm();
                  setShowAddModal(true);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Register Drug
              </button>
            )}
          </div>

          {/* MEDICINES DATA GRID */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {loadingMeds ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-gray-500 mt-3 font-semibold">Pulling CareSync dictionary...</p>
              </div>
            ) : medicines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Pill className="w-12 h-12 text-gray-300 mb-3" />
                <h3 className="text-sm font-bold text-gray-900">No matching master elements</h3>
                <p className="text-xs text-gray-500 max-w-sm mt-1">
                  Adjust filters or register new medical products.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Product Details</th>
                      <th className="px-6 py-4">Registry Identifiers</th>
                      <th className="px-6 py-4 text-center">Master Stock Level</th>
                      <th className="px-6 py-4 text-right">Retail Price</th>
                      <th className="px-6 py-4 text-center">Controlled status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {medicines.map((med) => {
                      const isLow = med.stock <= med.minStockAlert;
                      return (
                        <tr key={med.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                              {med.name}
                              <span className="px-2 py-0.5 text-[9px] bg-slate-100 text-slate-600 rounded-md font-mono">
                                {med.dosage}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5 font-semibold flex items-center gap-2">
                              <span>Category: {med.category}</span>
                              {med.rackLocation && (
                                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                                  <MapPin className="w-3 h-3" /> {med.rackLocation}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-gray-500">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-slate-700">Code: {med.code}</span>
                              <span className="flex items-center gap-1 text-[9px] text-gray-400">
                                <Barcode className="w-3.5 h-3.5" /> {med.barcode}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                med.stock === 0 
                                  ? 'bg-red-100 text-red-800' 
                                  : isLow 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {med.stock} Units
                              </span>
                              {isLow && med.stock > 0 && (
                                <span className="text-[9px] text-amber-600 font-bold mt-1">Reorder threshold alert</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-gray-800">
                            ${parseFloat(med.unitPrice as any).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {med.isControlled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold text-red-700 bg-red-50 border border-red-100 rounded-md">
                                <ShieldAlert className="w-3 h-3" /> Yes (Rx Only)
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">Unrestricted</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setShowDetailMedicine(med)}
                                className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                                title="View batch lists and audit logs"
                              >
                                <Info className="w-4 h-4" />
                              </button>
                              {isMedicalStaff && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingMedicine(med);
                                      setMedicineForm({
                                        name: med.name,
                                        category: med.category,
                                        code: med.code,
                                        minStockAlert: med.minStockAlert,
                                        expiryDate: med.expiryDate,
                                        unitPrice: med.unitPrice,
                                        purchasePrice: med.purchasePrice,
                                        rackLocation: med.rackLocation || '',
                                        barcode: med.barcode || '',
                                        isControlled: med.isControlled || false,
                                        dosage: med.dosage || '500mg',
                                        vendorId: med.vendorId ? String(med.vendorId) : ''
                                      });
                                    }}
                                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: UNIFIED SALES CHECKOUT BASKET */}
      {activeTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="pharmacy-sales-view">
          {/* CART LOGISTICS & BARCODE SEARCH */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                Point-of-Sale Register
              </h2>

              {/* INTEGRATED BARCODE SCANNER SIMULATION */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-5 h-5 text-slate-600" />
                    <span className="text-xs font-bold text-slate-700">Digital Barcode Gun</span>
                  </div>
                  {scanning && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Point your barcode scanner at a box, or click a mock code below to trigger instant stock discovery.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {medicines.slice(0, 4).map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleBarcodeScanSimulated(m.barcode)}
                      disabled={scanning}
                      className="px-2.5 py-1.5 text-[10px] bg-white border border-gray-200 rounded-lg font-mono hover:bg-emerald-50 hover:border-emerald-200 transition text-slate-600 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      Scan [{m.barcode}] - {m.name}
                    </button>
                  ))}
                </div>

                {scanFeedback && (
                  <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100 mt-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                    {scanFeedback}
                  </div>
                )}
              </div>

              {/* MANUAL CART INJECTION */}
              <div className="flex gap-2">
                <select
                  id="checkout-med-selector"
                  className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none"
                  defaultValue=""
                  onChange={(e) => {
                    const id = parseInt(e.target.value);
                    if (!id) return;
                    const med = medicines.find(m => m.id === id);
                    if (med) {
                      const defaultBatch = (med.batches || []).find((b: any) => b.currentQty > 0)?.batchNumber || '';
                      setCart(prev => {
                        const exists = prev.findIndex(item => item.medicine.id === med.id);
                        if (exists > -1) {
                          const updated = [...prev];
                          updated[exists].quantity += 1;
                          return updated;
                        }
                        return [...prev, { medicine: med, quantity: 1, selectedBatch: defaultBatch }];
                      });
                    }
                    e.target.value = '';
                  }}
                >
                  <option value="">-- Manual Add to Basket by Product Name --</option>
                  {medicines.map(m => (
                    <option key={m.id} value={m.id} disabled={m.stock <= 0}>
                      {m.name} ({m.dosage}) - Stock: {m.stock} {m.stock <= 0 ? '(OUT)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* CART ITEMS LIST */}
              {cart.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-2xl">
                  <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-500">Sales basket is empty</p>
                  <p className="text-[11px] text-gray-400">Scan items or use manual selector to start checkout</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-t border-gray-100 pt-4 max-h-[350px] overflow-y-auto space-y-3 pr-1">
                    {cart.map((item, idx) => {
                      const medBatches = item.medicine.batches || [];
                      return (
                        <div key={idx} className="flex flex-col p-3 bg-slate-50/60 rounded-xl border border-slate-100 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-gray-900 text-sm flex items-center gap-1">
                                {item.medicine.name}
                                {item.medicine.isControlled && (
                                  <span className="px-1.5 py-0.2 bg-red-50 text-red-700 text-[8px] font-bold uppercase border border-red-100 rounded-md">
                                    Controlled substance
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 font-bold">
                                Master Code: {item.medicine.code} | Unit Price: ${parseFloat(item.medicine.unitPrice as any).toFixed(2)}
                              </p>
                            </div>
                            <button
                              onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                              className="text-gray-400 hover:text-red-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* BATCH SELECTOR & QUANTITY TRIGGER */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Batch (FEFO Order)</label>
                              <select
                                value={item.selectedBatch}
                                onChange={(e) => {
                                  const updated = [...cart];
                                  updated[idx].selectedBatch = e.target.value;
                                  setCart(updated);
                                }}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none"
                              >
                                <option value="">-- Auto Match --</option>
                                {medBatches.map((b: any) => (
                                  <option key={b.id} value={b.batchNumber}>
                                    {b.batchNumber} (Qty: {b.currentQty}, Exp: {b.expiryDate})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Quantity (Units)</label>
                              <input
                                type="number"
                                min="1"
                                max={item.medicine.stock}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  const updated = [...cart];
                                  updated[idx].quantity = Math.min(item.medicine.stock, val);
                                  setCart(updated);
                                }}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none font-bold text-slate-800"
                              />
                            </div>

                            <div className="flex flex-col justify-end text-right pr-2">
                              <span className="text-[10px] text-gray-400 font-semibold uppercase">Subtotal</span>
                              <span className="text-sm font-bold text-slate-900">
                                ${(item.medicine.unitPrice * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* HIGH GUARDRAIL SECURED MEDICINE VERIFIER */}
                          {item.medicine.isControlled && (
                            <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                              <div>
                                <label className="block text-[9px] font-bold text-red-700 uppercase mb-1">Prescribing Doctor *</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Dr. Robert Chen"
                                  value={item.doctorName || ''}
                                  onChange={(e) => {
                                    const updated = [...cart];
                                    updated[idx].doctorName = e.target.value;
                                    setCart(updated);
                                  }}
                                  className="w-full px-2.5 py-1 text-xs bg-white border border-red-200 rounded-md focus:outline-none text-red-900 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-red-700 uppercase mb-1">Rx License ID *</label>
                                <input
                                  type="text"
                                  placeholder="e.g. RX-99120"
                                  value={item.rxId || ''}
                                  onChange={(e) => {
                                    const updated = [...cart];
                                    updated[idx].rxId = e.target.value;
                                    setCart(updated);
                                  }}
                                  className="w-full px-2.5 py-1 text-xs bg-white border border-red-200 rounded-md focus:outline-none text-red-900 font-semibold"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CHECKOUT SUMMARIES & SALES REGISTRATION */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider pb-3 border-b border-gray-100">
                Billing Invoice & Ledger
              </h3>

              {/* Demographics details */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Patient Customer</label>
                  <select
                    value={checkoutPatientId}
                    onChange={(e) => setCheckoutPatientId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none bg-gray-50"
                  >
                    <option value="">-- Walk-in Anonymous Customer --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'card', 'upi'] as const).map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setCheckoutPaymentMethod(method)}
                        className={`py-1.5 text-[10px] font-bold uppercase rounded-lg border transition ${
                          checkoutPaymentMethod === method 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                            : 'bg-white text-slate-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Discount (Percentage)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={overallDiscount}
                      onChange={(e) => setOverallDiscount(Math.min(90, parseInt(e.target.value) || 0))}
                      className="w-20 px-3 py-1.5 text-xs border border-gray-200 rounded-xl text-center focus:outline-none"
                    />
                    <span className="text-xs text-gray-500">% Off Total Invoice</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Checkout Remarks</label>
                  <textarea
                    placeholder="Note medical warnings, dosing recommendations, etc..."
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none bg-gray-50/50"
                    rows={2}
                  />
                </div>
              </div>

              {/* RECEIPT SUMMARY LEDGER */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2 font-semibold">
                <div className="flex justify-between text-slate-500">
                  <span>Cart Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount ({overallDiscount}%)</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Sales Tax (8%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 my-2 pt-2 flex justify-between text-sm font-bold text-slate-900">
                  <span>Grand Total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {cartHasControlledSubstances && (
                <div className="p-3 bg-amber-50 text-amber-800 text-[10px] font-medium rounded-xl border border-amber-200 flex items-start gap-2 leading-relaxed">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>
                    <strong>Controlled Substance Guardrail Engaged:</strong> Please verify that each controlled drug is matched with valid doctor prescribing credentials and Rx license numbers to finalize checkout.
                  </span>
                </div>
              )}

              <button
                onClick={handleCheckoutSubmit}
                disabled={cart.length === 0 || (cartHasControlledSubstances && cart.some(item => item.medicine.isControlled && (!item.doctorName || !item.rxId)))}
                className="w-full py-3 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-md shadow-emerald-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {recordSaleMutation.isPending ? 'Logging Ledger...' : 'Finalize & Generate Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: RESTOCK ORDER PURCHASE FLOW */}
      {activeTab === 'purchase' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="pharmacy-restock-view">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              Procurement & Purchase Order logging
            </h2>
            <p className="text-xs text-gray-500">
              Increase master stock, register supplier records, and establish trackable batch numbers and custom expiration details.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!purchaseForm.medicineId || !purchaseForm.vendorId || !purchaseForm.quantity) {
                  setErrorMsg('Please select a medicine, a distributor, and insert quantity.');
                  return;
                }
                recordPurchaseMutation.mutate(purchaseForm);
              }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Select Medicine *</label>
                <select
                  value={purchaseForm.medicineId}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, medicineId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none bg-gray-50"
                  required
                >
                  <option value="">-- Choose Target Drug --</option>
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.dosage}) - Current Stock: {m.stock}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Supplier Distributor *</label>
                <select
                  value={purchaseForm.vendorId}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, vendorId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none bg-gray-50"
                  required
                >
                  <option value="">-- Choose Distributor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.drugLicense})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Batch Number *</label>
                <input
                  type="text"
                  placeholder="e.g. BT-AMO-7721"
                  value={purchaseForm.batchNumber}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, batchNumber: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Restock Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={purchaseForm.quantity}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Batch Expiry Date *</label>
                <input
                  type="date"
                  value={purchaseForm.expiryDate}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Total Procurement Cost ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchaseForm.totalCost}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, totalCost: parseFloat(e.target.value) || 0.0 })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                  required
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={recordPurchaseMutation.isPending}
                  className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-sm cursor-pointer"
                >
                  {recordPurchaseMutation.isPending ? 'Logging Order...' : 'Register Restock & Generate Batches'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider pb-3 border-b border-gray-100">
              Procurement Audit Rules
            </h3>
            <ul className="text-[11px] text-gray-500 space-y-3 leading-relaxed list-disc pl-4 font-semibold">
              <li>Purchase orders logged here automatically construct a tracking batch connected to FEFO routines.</li>
              <li>Purchase price metrics log direct cost valuation in the general finance ledger.</li>
              <li>Please verify the drug distributor license code before logging bulk opioid or antipsychotic restocking profiles.</li>
            </ul>
          </div>
        </div>
      )}

      {/* VIEW 4: RETURNS CENTER */}
      {activeTab === 'returns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="pharmacy-returns-view">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-emerald-600" />
              Returns & Loss Management
            </h2>
            <p className="text-xs text-gray-500">
              Record Patient Returns (restores stock) or Vendor Returns (removes expired/damaged stock), adjusting master inventory and trackable batches automatically.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!returnForm.medicineId || !returnForm.quantity) {
                  setErrorMsg('Missing key return metrics.');
                  return;
                }
                recordReturnMutation.mutate(returnForm);
              }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Select Medicine *</label>
                <select
                  value={returnForm.medicineId}
                  onChange={(e) => setReturnForm({ ...returnForm, medicineId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none bg-gray-50"
                  required
                >
                  <option value="">-- Choose Drug --</option>
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.dosage}) - Stock: {m.stock}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Return Destination Type *</label>
                <select
                  value={returnForm.type}
                  onChange={(e) => setReturnForm({ ...returnForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none bg-gray-50"
                  required
                >
                  <option value="PATIENT">PATIENT RETURN (Stock Added Back)</option>
                  <option value="VENDOR">VENDOR RETURN / LOSS (Stock Deleted)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Batch Number Associated</label>
                <input
                  type="text"
                  placeholder="e.g. BT-AMO-7721"
                  value={returnForm.batchNumber}
                  onChange={(e) => setReturnForm({ ...returnForm, batchNumber: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Return Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={returnForm.quantity}
                  onChange={(e) => setReturnForm({ ...returnForm, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none font-bold"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Reason for Return / Disposal Remarks *</label>
                <textarea
                  placeholder="Allergic response, packaging fault, damaged batch during transit..."
                  value={returnForm.reason}
                  onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                  rows={3}
                  required
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={recordReturnMutation.isPending}
                  className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-sm cursor-pointer"
                >
                  {recordReturnMutation.isPending ? 'Logging Return...' : 'Record Return Entry'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider pb-3 border-b border-gray-100">
              Active Returns Logs
            </h3>
            {loadingReturns ? (
              <p className="text-xs text-gray-400">Loading audit log stream...</p>
            ) : returnsList.length === 0 ? (
              <p className="text-xs text-gray-400">No return logs recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {returnsList.map((r: any) => (
                  <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                        r.type === 'PATIENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {r.type}
                      </span>
                      <span className="text-gray-400 font-mono">{r.returnDate}</span>
                    </div>
                    <div className="font-bold text-slate-800">
                      Drug ID {r.medicineId} &middot; Qty {r.quantity}
                    </div>
                    {r.batchNumber && (
                      <div className="text-[10px] text-slate-500">
                        Batch: <span className="font-mono font-bold bg-white px-1.5 py-0.2 border border-slate-200 rounded">{r.batchNumber}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 leading-relaxed italic">"{r.reason}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 5: VENDOR MANAGEMENT */}
      {activeTab === 'vendors' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Registered Wholesale Distributors</h2>
              <p className="text-[11px] text-gray-400">Distributors linked to master restocks and FDA licensing compliance.</p>
            </div>
            <button
              onClick={() => {
                resetVendorForm();
                setShowAddVendorModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" /> Add Distributor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {loadingVendors ? (
              <p className="text-xs text-gray-500">Fetching manufacturers...</p>
            ) : vendors.length === 0 ? (
              <p className="text-xs text-gray-500">No vendors registered in directory.</p>
            ) : (
              vendors.map(v => (
                <div key={v.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => {
                        setEditingVendor(v);
                        setVendorForm({
                          name: v.name,
                          phone: v.phone,
                          email: v.email,
                          address: v.address,
                          drugLicense: v.drugLicense,
                          paymentTerms: v.paymentTerms
                        });
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 rounded-md transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this vendor from registry?')) {
                          deleteVendorMutation.mutate(v.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-slate-100 rounded-md transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-emerald-600" />
                      {v.name}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold">FDA License: {v.drugLicense}</p>
                  </div>

                  <div className="text-[11px] text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Phone:</span>
                      <span>{v.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Email:</span>
                      <span>{v.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Payment:</span>
                      <span className="font-bold text-slate-600">{v.paymentTerms}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 leading-normal pt-1">{v.address}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 6: BI FORECASTING & EXPIRE ALERTS */}
      {activeTab === 'forecasting' && (
        <div className="space-y-6" id="pharmacy-forecasting-view">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* EXPIRY RISK INDEX */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                Expiry Risk predictions (Near Expiry Monitor)
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                We track upcoming drug batch schedules. Products reaching expirations are classified by risk indexes under FDA compliance rules.
              </p>

              {loadingPredictions ? (
                <p className="text-xs text-slate-400">Running prediction models...</p>
              ) : expiryPredictions.length === 0 ? (
                <p className="text-xs text-slate-400">No batches registered.</p>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {expiryPredictions.map((pred, i) => (
                    <div key={i} className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 border-slate-100">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800 text-xs">
                          {pred.medicineName} &middot; <span className="font-mono bg-white border px-1 rounded text-[9px]">{pred.batchNumber}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold">
                          Expiry: {pred.expiryDate} ({pred.daysRemaining} days remaining) &middot; Qty: {pred.quantity} units
                        </p>
                        <p className="text-[10px] text-amber-600 font-semibold">{pred.recommendation}</p>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold text-center self-start sm:self-center ${
                        pred.riskLevel === 'EXPIRED' 
                          ? 'bg-red-100 text-red-800' 
                          : pred.riskLevel === 'HIGH' 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {pred.riskLevel} RISK
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STOCK DEPLETION VELOCITY FORECASTS */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Stock Depletion & Reorder Intelligence
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Daily sales velocity is modeled dynamically based on the past 30 days of medical clinic prescription logs to avoid critical stockout.
              </p>

              {loadingForecast ? (
                <p className="text-xs text-slate-400">Running linear trend regression...</p>
              ) : forecastData.length === 0 ? (
                <p className="text-xs text-slate-400">No forecast data generated. Please complete a sale first to start trend modeling.</p>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {forecastData.map((f, i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-[11px] flex flex-col space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">{f.name} ({f.stock} units left)</span>
                        <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                          f.status === 'CRITICAL' ? 'bg-red-100 text-red-800' : f.status === 'REORDER' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {f.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>Daily Sales Velocity: <strong>{f.dailyVelocity} units/day</strong></span>
                        <span>Days to Depletion: <strong className={f.daysToDepletion <= 15 ? 'text-red-600 font-bold' : ''}>{f.daysToDepletion === 999 ? 'Safe (>100 days)' : `${f.daysToDepletion} days`}</strong></span>
                      </div>
                      <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-bold">
                        Suggested purchase order qty: {f.suggestedReorder} units (covers next 60 days)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MEDICINE DETAIL MODAL / PANEL */}
      <AnimatePresence>
        {showDetailMedicine && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-slate-100 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{showDetailMedicine.name} ({showDetailMedicine.dosage})</h3>
                  <p className="text-xs text-gray-400 font-semibold font-mono">Code ID: {showDetailMedicine.code} | Barcode: {showDetailMedicine.barcode}</p>
                </div>
                <button onClick={() => setShowDetailMedicine(null)} className="p-1.5 bg-slate-100 rounded-full hover:bg-slate-200 transition">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              {/* BATCH DATA GRID */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active Batches (FEFO Tracked)</h4>
                {!showDetailMedicine.batches || showDetailMedicine.batches.length === 0 ? (
                  <p className="text-xs text-gray-400">No active batches logged. Use Restock to initialize stock levels.</p>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-[11px]">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2.5">Batch Number</th>
                          <th className="p-2.5">Expiry</th>
                          <th className="p-2.5 text-right">Available Qty</th>
                          <th className="p-2.5 text-right">Initial Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {showDetailMedicine.batches.map((b: any) => (
                          <tr key={b.id}>
                            <td className="p-2.5 font-mono font-bold text-slate-700">{b.batchNumber}</td>
                            <td className="p-2.5 font-bold text-slate-600">{b.expiryDate}</td>
                            <td className="p-2.5 text-right font-bold text-emerald-600">{b.currentQty}</td>
                            <td className="p-2.5 text-right text-slate-400">{b.initialQty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* RETURNS AUDIT HISTORY */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Returns and Damage Records</h4>
                {!showDetailMedicine.returns || showDetailMedicine.returns.length === 0 ? (
                  <p className="text-xs text-gray-400">No returns logged for this product.</p>
                ) : (
                  <div className="space-y-2">
                    {showDetailMedicine.returns.map((r: any) => (
                      <div key={r.id} className="p-2.5 bg-slate-50 rounded-xl text-[10px] flex justify-between items-start border border-slate-100">
                        <div>
                          <span className={`px-1.5 py-0.2 rounded font-bold text-[8px] ${
                            r.type === 'PATIENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {r.type}
                          </span>
                          <p className="text-slate-800 mt-1 font-semibold">Qty: {r.quantity} {r.batchNumber && `(Batch: ${r.batchNumber})`}</p>
                          <p className="text-gray-400 italic mt-0.5">"{r.reason}"</p>
                        </div>
                        <span className="text-gray-400">{r.returnDate}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isMedicalStaff && (
                <div className="pt-3 border-t border-slate-100 text-right">
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to permanently delete this medicine from the master directory? This action will remove all historical logs.')) {
                        deleteMedicineMutation.mutate(showDetailMedicine.id);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition cursor-pointer"
                  >
                    Delete Drug Master Record
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REGISTER MEDICINE DICTIONARY MODAL */}
      <AnimatePresence>
        {(showAddModal || editingMedicine) && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-slate-900">
                {editingMedicine ? 'Modify Master Drug Specifications' : 'Register New Drug in master catalog'}
              </h3>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingMedicine) {
                    updateMedicineMutation.mutate({ id: editingMedicine.id, data: medicineForm });
                  } else {
                    createMedicineMutation.mutate(medicineForm);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={medicineForm.name}
                    onChange={(e) => setMedicineForm({ ...medicineForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                    placeholder="e.g. Paracetamol"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Category *</label>
                    <select
                      value={medicineForm.category}
                      onChange={(e) => setMedicineForm({ ...medicineForm, category: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none"
                    >
                      <option value="Tablets">Tablets</option>
                      <option value="Syrups">Syrups</option>
                      <option value="Antibiotics">Antibiotics</option>
                      <option value="Injections">Injections</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Dosage Spec *</label>
                    <input
                      type="text"
                      value={medicineForm.dosage}
                      onChange={(e) => setMedicineForm({ ...medicineForm, dosage: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                      placeholder="e.g. 500mg, 10ml"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Medicine Code *</label>
                    <input
                      type="text"
                      value={medicineForm.code}
                      onChange={(e) => setMedicineForm({ ...medicineForm, code: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none font-mono"
                      placeholder="MED-091"
                      required
                      disabled={!!editingMedicine}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Barcode Key *</label>
                    <input
                      type="text"
                      value={medicineForm.barcode}
                      onChange={(e) => setMedicineForm({ ...medicineForm, barcode: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none font-mono"
                      placeholder="890123456..."
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Retail Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={medicineForm.unitPrice}
                      onChange={(e) => setMedicineForm({ ...medicineForm, unitPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Purchase Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={medicineForm.purchasePrice}
                      onChange={(e) => setMedicineForm({ ...medicineForm, purchasePrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Reorder Level *</label>
                    <input
                      type="number"
                      value={medicineForm.minStockAlert}
                      onChange={(e) => setMedicineForm({ ...medicineForm, minStockAlert: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Rack Location</label>
                    <input
                      type="text"
                      value={medicineForm.rackLocation}
                      onChange={(e) => setMedicineForm({ ...medicineForm, rackLocation: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                      placeholder="Rack B4"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="isControlled"
                    checked={medicineForm.isControlled}
                    onChange={(e) => setMedicineForm({ ...medicineForm, isControlled: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <label htmlFor="isControlled" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Mark as Controlled Substance (Rx Mandatory)
                  </label>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingMedicine(null);
                    }}
                    className="flex-1 py-2 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
                  >
                    Save Specifications
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REGISTER VENDOR MODAL */}
      <AnimatePresence>
        {(showAddVendorModal || editingVendor) && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-slate-900">
                {editingVendor ? 'Modify Distributor specifications' : 'Register Wholesale Distributor'}
              </h3>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingVendor) {
                    updateVendorMutation.mutate({ id: editingVendor.id, data: vendorForm });
                  } else {
                    addVendorMutation.mutate(vendorForm);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Wholesale Name *</label>
                  <input
                    type="text"
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                    placeholder="e.g. Apex Biotech Laboratories"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Phone *</label>
                    <input
                      type="text"
                      value={vendorForm.phone}
                      onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email *</label>
                    <input
                      type="email"
                      value={vendorForm.email}
                      onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Drug License Code *</label>
                    <input
                      type="text"
                      value={vendorForm.drugLicense}
                      onChange={(e) => setVendorForm({ ...vendorForm, drugLicense: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none font-mono"
                      placeholder="DL-XYZ-99"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Payment Terms</label>
                    <select
                      value={vendorForm.paymentTerms}
                      onChange={(e) => setVendorForm({ ...vendorForm, paymentTerms: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none"
                    >
                      <option value="Net 30">Net 30 Days</option>
                      <option value="Net 15">Net 15 Days</option>
                      <option value="COD">Cash on Delivery (COD)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Warehouse Address</label>
                  <input
                    type="text"
                    value={vendorForm.address}
                    onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none"
                    placeholder="742 Science Parkway"
                  />
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddVendorModal(false);
                      setEditingVendor(null);
                    }}
                    className="flex-1 py-2 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
                  >
                    Save Distributor
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
