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
  History
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
  purchases?: any[];
  sales?: any[];
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
  const isMedicalStaff = ['admin', 'doctor', 'receptionist'].includes(role);
  const queryClient = useQueryClient();

  // Active Tab: medicines, purchase, sales, report
  const [activeTab, setActiveTab] = useState<'medicines' | 'purchase' | 'sales' | 'report'>('medicines');

  // Search & filter states
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'nearexpiry'>('all');

  // Modal / Editing states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [showDetailMedicine, setShowDetailMedicine] = useState<Medicine | null>(null);

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
    rackLocation: ''
  });

  const [purchaseForm, setPurchaseForm] = useState({
    medicineId: '',
    quantity: 10,
    supplier: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    batchNumber: '',
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    totalCost: 0.0
  });

  const [saleForm, setSaleForm] = useState({
    medicineId: '',
    quantity: 1,
    patientId: '',
    saleDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash' as 'cash' | 'card' | 'upi',
    notes: ''
  });

  // Queries
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

      // Client side secondary filters if needed
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

  const { data: stockReport, isLoading: loadingReport } = useQuery<any>({
    queryKey: ['stockReport'],
    queryFn: async () => {
      const res = await fetch('/api/pharmacy/report', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch stock report');
      return res.json();
    },
    enabled: !!token && isMedicalStaff && activeTab === 'report'
  });

  // Categories list computed from data
  const categories = useMemo(() => {
    const defaultCats = ['Tablets', 'Syrups', 'Antibiotics', 'Ointments', 'Injections', 'Inhalers', 'Other'];
    return defaultCats;
  }, []);

  // Show detailed view including history
  const { data: medicineDetails } = useQuery<Medicine>({
    queryKey: ['medicineDetails', showDetailMedicine?.id],
    queryFn: async () => {
      const res = await fetch(`/api/pharmacy/${showDetailMedicine?.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch medicine details');
      return res.json();
    },
    enabled: !!token && !!showDetailMedicine
  });

  // Mutations
  const createMedicineMutation = useMutation({
    mutationFn: async (data: typeof medicineForm) => {
      const res = await fetch('/api/pharmacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to register medicine');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setSuccessMsg('Medicine registered successfully in Master List!');
      setShowAddModal(false);
      resetMedicineForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error occurred');
    }
  });

  const updateMedicineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof medicineForm> }) => {
      const res = await fetch(`/api/pharmacy/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update medicine');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setSuccessMsg('Medicine details updated successfully!');
      setEditingMedicine(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error occurred');
    }
  });

  const deleteMedicineMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/pharmacy/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete medicine');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setSuccessMsg('Medicine deleted successfully!');
      setShowDetailMedicine(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error occurred');
    }
  });

  const recordPurchaseMutation = useMutation({
    mutationFn: async (data: typeof purchaseForm) => {
      const payload = {
        ...data,
        medicineId: parseInt(data.medicineId),
        quantity: parseInt(data.quantity as any),
        totalCost: parseFloat(data.totalCost as any)
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
      queryClient.invalidateQueries({ queryKey: ['stockReport'] });
      setSuccessMsg('Restocking batch purchased and stock count increased!');
      resetPurchaseForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error occurred');
    }
  });

  const recordSaleMutation = useMutation({
    mutationFn: async (data: typeof saleForm) => {
      // Find unit price to calculate total price
      const med = medicines.find(m => m.id === parseInt(data.medicineId));
      if (!med) throw new Error('Selected medicine is not valid');

      const qty = parseInt(data.quantity as any);
      const totalPrice = qty * med.unitPrice;

      const payload = {
        medicineId: parseInt(data.medicineId),
        quantity: qty,
        patientId: data.patientId ? parseInt(data.patientId) : null,
        saleDate: data.saleDate,
        totalPrice,
        paymentMethod: data.paymentMethod,
        notes: data.notes || null
      };

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
        throw new Error(errorData.error || 'Failed to record sales checkout');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['stockReport'] });
      setSuccessMsg('Medicine sale checkout registered. Stock has been updated!');
      resetSaleForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Error occurred');
    }
  });

  // Helpers
  const resetMedicineForm = () => {
    setMedicineForm({
      name: '',
      category: 'Tablets',
      code: '',
      minStockAlert: 10,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      unitPrice: 0.0,
      purchasePrice: 0.0,
      rackLocation: ''
    });
  };

  const resetPurchaseForm = () => {
    setPurchaseForm({
      medicineId: '',
      quantity: 10,
      supplier: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      batchNumber: '',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalCost: 0.0
    });
  };

  const resetSaleForm = () => {
    setSaleForm({
      medicineId: '',
      quantity: 1,
      patientId: '',
      saleDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      notes: ''
    });
  };

  const isExpired = (dateStr: string) => {
    return dateStr < new Date().toISOString().split('T')[0];
  };

  const isNearExpiry = (dateStr: string) => {
    if (isExpired(dateStr)) return false;
    const exp = new Date(dateStr).getTime();
    const cur = new Date().getTime();
    const days = (exp - cur) / (1000 * 3600 * 24);
    return days <= 90;
  };

  // Calculate dynamic subtotal for sales screen
  const selectedMedicineForSale = useMemo(() => {
    if (!saleForm.medicineId) return null;
    return medicines.find(m => m.id === parseInt(saleForm.medicineId));
  }, [saleForm.medicineId, medicines]);

  const saleTotal = useMemo(() => {
    if (!selectedMedicineForSale) return 0;
    return selectedMedicineForSale.unitPrice * (saleForm.quantity || 0);
  }, [selectedMedicineForSale, saleForm.quantity]);

  return (
    <div className="w-full space-y-6" id="pharmacy-module-container">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-between p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50 border border-green-200 shadow-md"
            role="alert"
          >
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-600" />
              <span className="font-medium">{successMsg}</span>
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
            className="flex items-center justify-between p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 border border-red-200 shadow-md"
            role="alert"
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="font-medium">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pharmacy Title & Top Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-gray-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Pill className="w-8 h-8 text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">CareSync Pharmacy</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage your drug dictionary, log incoming purchases, track sales checkouts, and view expiry alerts.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center bg-gray-100 p-1.5 rounded-lg border border-gray-200 max-w-max">
          <button
            onClick={() => setActiveTab('medicines')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'medicines' 
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Medicine Master
          </button>
          {isMedicalStaff && (
            <>
              <button
                onClick={() => setActiveTab('purchase')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'purchase' 
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Restock Purchase
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'sales' 
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sales Screen
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'report' 
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Stock Report
              </button>
            </>
          )}
        </div>
      </div>

      {/* VIEW 1: MEDICINE MASTER CATALOG */}
      {activeTab === 'medicines' && (
        <div className="space-y-6" id="medicine-master-view">
          {/* Filtering Sidebar + Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                />
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Stock Filter */}
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as any)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none"
              >
                <option value="all">All Stocks</option>
                <option value="low">⚠️ Low Stock Alert</option>
                <option value="out">❌ Out of Stock</option>
              </select>

              {/* Expiry Filter */}
              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value as any)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none"
              >
                <option value="all">Any Expiry Date</option>
                <option value="expired">🚨 Expired</option>
                <option value="nearexpiry">⏳ Near Expiry (&le; 90 days)</option>
              </select>
            </div>

            {/* Action buttons */}
            {isMedicalStaff && (
              <button
                onClick={() => {
                  resetMedicineForm();
                  setShowAddModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Add Medicine
              </button>
            )}
          </div>

          {/* Medicines Grid/Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loadingMeds ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 text-sm mt-3 font-medium">Fetching catalog entries...</p>
              </div>
            ) : medicines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Pill className="w-12 h-12 text-gray-300 mb-3" />
                <h3 className="text-lg font-semibold text-gray-900">No Medicines Found</h3>
                <p className="text-sm text-gray-500 max-w-sm mt-1">
                  No products matched the active search keywords or filters. Log a new medicine to get started.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Medicine Code & Name</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4 text-center">Stock Level</th>
                      <th className="px-6 py-4">Expiry Date</th>
                      <th className="px-6 py-4">Prices (Purchase / Retail)</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {medicines.map((med) => {
                      const expiredStatus = isExpired(med.expiryDate);
                      const nearExpiry = isNearExpiry(med.expiryDate);
                      const isLowStock = med.stock <= med.minStockAlert;

                      return (
                        <tr 
                          key={med.id} 
                          className={`hover:bg-gray-50/70 transition-colors ${
                            expiredStatus ? 'bg-red-50/20' : isLowStock ? 'bg-amber-50/25' : ''
                          }`}
                        >
                          <td className="px-6 py-4.5">
                            <div className="font-mono text-xs text-emerald-700 font-semibold uppercase">{med.code}</div>
                            <div className="font-semibold text-gray-900 mt-0.5">{med.name}</div>
                          </td>
                          <td className="px-6 py-4.5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                              {med.category}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                                med.stock === 0 
                                  ? 'bg-red-100 text-red-800 border border-red-200' 
                                  : isLowStock 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse' 
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}>
                                {med.stock} units
                              </span>
                              {isLowStock && med.stock > 0 && (
                                <span className="text-[10px] text-amber-700 font-medium mt-1">
                                  Min alert threshold: {med.minStockAlert}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="flex items-center space-x-1.5">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span className={`font-mono text-xs ${
                                expiredStatus 
                                  ? 'text-red-600 font-semibold' 
                                  : nearExpiry 
                                  ? 'text-amber-600 font-semibold' 
                                  : 'text-gray-600'
                              }`}>
                                {med.expiryDate}
                              </span>
                            </div>
                            {expiredStatus ? (
                              <span className="inline-flex items-center text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200 mt-1 uppercase">Expired</span>
                            ) : nearExpiry ? (
                              <span className="inline-flex items-center text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 uppercase">⏳ Near Expiry</span>
                            ) : null}
                          </td>
                          <td className="px-6 py-4.5 font-mono">
                            <div className="text-gray-400 text-xs">Buy: ${med.purchasePrice.toFixed(2)}</div>
                            <div className="text-gray-950 font-medium text-xs mt-0.5">Sell: ${med.unitPrice.toFixed(2)}</div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="flex items-center text-xs text-gray-500 gap-1">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate max-w-[100px]">{med.rackLocation || 'Not Set'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5 text-right space-x-2">
                            <button
                              onClick={() => setShowDetailMedicine(med)}
                              className="text-gray-500 hover:text-emerald-600 p-1 rounded hover:bg-gray-100 transition"
                              title="View History / Logs"
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
                                      rackLocation: med.rackLocation || ''
                                    });
                                  }}
                                  className="text-gray-500 hover:text-indigo-600 p-1 rounded hover:bg-gray-100 transition"
                                  title="Edit Medicine"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
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

      {/* VIEW 2: RESTOCK PURCHASE SCREEN */}
      {activeTab === 'purchase' && isMedicalStaff && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="pharmacy-purchase-view">
          {/* Purchase Entry Form */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-gray-900">Record Incoming Batch</h2>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!purchaseForm.medicineId) {
                  setErrorMsg('Please select a medicine');
                  return;
                }
                recordPurchaseMutation.mutate(purchaseForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Select Medicine</label>
                <select
                  value={purchaseForm.medicineId}
                  onChange={(e) => {
                    const idStr = e.target.value;
                    const med = medicines.find(m => m.id === parseInt(idStr));
                    setPurchaseForm(prev => ({
                      ...prev,
                      medicineId: idStr,
                      expiryDate: med ? med.expiryDate : prev.expiryDate,
                      totalCost: med ? parseFloat((med.purchasePrice * prev.quantity).toFixed(2)) : prev.totalCost
                    }));
                  }}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">-- Choose Medicine --</option>
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.code}) [Current Qty: {m.stock}]</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={purchaseForm.quantity}
                    onChange={(e) => {
                      const qty = parseInt(e.target.value) || 0;
                      setPurchaseForm(prev => {
                        const med = medicines.find(m => m.id === parseInt(prev.medicineId));
                        const baseCost = med ? med.purchasePrice : 0;
                        return {
                          ...prev,
                          quantity: qty,
                          totalCost: parseFloat((baseCost * qty).toFixed(2))
                        };
                      });
                    }}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Total Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={purchaseForm.totalCost}
                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, totalCost: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Supplier / Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. Pfizer Distribution, Apex Health"
                  value={purchaseForm.supplier}
                  onChange={(e) => setPurchaseForm(prev => ({ ...prev, supplier: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Batch Number</label>
                  <input
                    type="text"
                    placeholder="e.g. BAT-2026X"
                    value={purchaseForm.batchNumber}
                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, batchNumber: e.target.value.toUpperCase() }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={purchaseForm.expiryDate}
                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={purchaseForm.purchaseDate}
                  onChange={(e) => setPurchaseForm(prev => ({ ...prev, purchaseDate: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={recordPurchaseMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm py-2.5 rounded-lg shadow-sm transition mt-2 disabled:opacity-50"
              >
                {recordPurchaseMutation.isPending ? 'Logging Purchase...' : 'Add Stock & Log Batch'}
              </button>
            </form>
          </div>

          {/* Quick Restocking History logs */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Recent Stocking Batches</h2>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Medicine</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3 font-mono">Batch</th>
                    <th className="px-4 py-3 text-center">Qty Recd</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {medicines.flatMap(m => (m.purchases || []).map(p => ({ ...p, medicineName: m.name }))).sort((a,b) => b.id - a.id).slice(0, 8).map((purch: any) => (
                    <tr key={purch.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-xs text-gray-500">{purch.purchaseDate}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{purch.medicineName}</td>
                      <td className="px-4 py-3 text-gray-600">{purch.supplier}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{purch.batchNumber}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100">
                          +{purch.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">${purch.totalCost.toFixed(2)}</td>
                    </tr>
                  ))}
                  {medicines.every(m => !m.purchases || m.purchases.length === 0) && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500 text-sm">
                        No previous restock transactions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: SALES SCREEN (PATIENT DISPENSARY CHECKOUT) */}
      {activeTab === 'sales' && isMedicalStaff && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="pharmacy-sales-view">
          {/* Sales Form */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Dispensation & Billing Checkout</h2>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!saleForm.medicineId) {
                  setErrorMsg('Please select a medicine');
                  return;
                }
                const med = medicines.find(m => m.id === parseInt(saleForm.medicineId));
                if (!med) return;
                if (med.stock < saleForm.quantity) {
                  setErrorMsg(`Insufficient Stock! Only ${med.stock} units are available.`);
                  return;
                }
                recordSaleMutation.mutate(saleForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Select Medicine</label>
                <select
                  value={saleForm.medicineId}
                  onChange={(e) => setSaleForm(prev => ({ ...prev, medicineId: e.target.value, quantity: 1 }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Choose Medicine --</option>
                  {medicines.filter(m => m.stock > 0 && !isExpired(m.expiryDate)).map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.code}) [Stock: {m.stock} | ${m.unitPrice.toFixed(2)}]</option>
                  ))}
                </select>
              </div>

              {selectedMedicineForSale && (
                <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 text-xs text-indigo-900 space-y-1">
                  <div className="flex justify-between">
                    <span>Retail Unit Price:</span>
                    <span className="font-mono font-bold">${selectedMedicineForSale.unitPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Available Stock:</span>
                    <span className="font-bold">{selectedMedicineForSale.stock} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expiration Date:</span>
                    <span className="font-mono">{selectedMedicineForSale.expiryDate}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedMedicineForSale?.stock || 9999}
                    value={saleForm.quantity}
                    onChange={(e) => setSaleForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Checkout Subtotal</label>
                  <div className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg p-2.5 font-mono text-gray-900 flex items-center justify-between">
                    <span>$</span>
                    <span>{saleTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Link Patient Account (Optional)</label>
                <select
                  value={saleForm.patientId}
                  onChange={(e) => setSaleForm(prev => ({ ...prev, patientId: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Generic Walk-in Customer --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Payment Method</label>
                  <select
                    value={saleForm.paymentMethod}
                    onChange={(e) => setSaleForm(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-gray-50 focus:outline-none"
                  >
                    <option value="cash">💵 Cash</option>
                    <option value="card">💳 Card</option>
                    <option value="upi">📱 UPI / QR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Sale Date</label>
                  <input
                    type="date"
                    value={saleForm.saleDate}
                    onChange={(e) => setSaleForm(prev => ({ ...prev, saleDate: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Add Notes / Instructions</label>
                <textarea
                  placeholder="e.g. 1 Tablet after dinner. Patient allergic to penicillin."
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded-lg p-2.5 focus:outline-none h-16"
                />
              </div>

              <button
                type="submit"
                disabled={recordSaleMutation.isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-lg shadow-sm transition mt-2 disabled:opacity-50"
              >
                {recordSaleMutation.isPending ? 'Processing Sale...' : 'Collect Payment & Dispense'}
              </button>
            </form>
          </div>

          {/* Sales Audit Log */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Recent Sales Receipts</h2>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Medicine</th>
                    <th className="px-4 py-3">Recipient Patient</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {medicines.flatMap(m => (m.sales || []).map(s => ({ ...s, medicineName: m.name }))).sort((a,b) => b.id - a.id).slice(0, 8).map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-xs text-gray-500">{sale.saleDate}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{sale.medicineName}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {sale.patient ? (
                          <div className="flex items-center space-x-1">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span>{sale.patient.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Generic Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs uppercase font-semibold text-indigo-700">{sale.paymentMethod}</td>
                      <td className="px-4 py-3 text-center text-xs font-semibold">
                        {sale.quantity} units
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-emerald-600">+${sale.totalPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                  {medicines.every(m => !m.sales || m.sales.length === 0) && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500 text-sm">
                        No billing checkouts recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: STOCK REPORT */}
      {activeTab === 'report' && isMedicalStaff && (
        <div className="space-y-6" id="pharmacy-report-view">
          {loadingReport ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 text-sm mt-3 font-medium">Crunching stock audits...</p>
            </div>
          ) : !stockReport ? (
            <div className="text-center py-12 text-gray-500">Failed to load reporting stats.</div>
          ) : (
            <>
              {/* Dynamic KPI Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Valuation at Cost</p>
                    <p className="text-2xl font-bold text-gray-900 font-mono">${stockReport.summary.inventoryValuationAtCost.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Accumulated purchase capital</p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Potential Retail Revenue</p>
                    <p className="text-2xl font-bold text-indigo-900 font-mono">${stockReport.summary.potentialRevenue.toFixed(2)}</p>
                    <p className="text-[10px] text-indigo-600 font-bold">Estimated markup sales</p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Low Stock Alerts</p>
                    <p className="text-2xl font-bold text-amber-700">{stockReport.summary.lowStockItemsCount}</p>
                    <p className="text-[10px] text-amber-600 font-bold">Requires swift replenishment</p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Expired / Near Expiry</p>
                    <p className="text-2xl font-bold text-red-700">
                      {stockReport.summary.expiredItemsCount} <span className="text-sm font-normal text-gray-400">/ {stockReport.summary.nearExpiryItemsCount}</span>
                    </p>
                    <p className="text-[10px] text-red-600 font-bold">Must purge immediately</p>
                  </div>
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                    <PackageCheck className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Bento Grid: Chart + Alerts Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* SVG Visual Category Stock Levels Bar Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600" /> Stock Volume by Category
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">Interactive graphic comparing unit volumes across healthcare sections.</p>
                  </div>

                  <div className="space-y-4 pt-4">
                    {stockReport.categorySummary.map((cat: any) => {
                      const totalStock = stockReport.summary.totalStockQty || 1;
                      const percentage = Math.min(100, Math.round((cat.totalStock / totalStock) * 100));

                      return (
                        <div key={cat.category} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-gray-700">{cat.category}</span>
                            <span className="text-gray-500 font-semibold">{cat.totalStock} units ({percentage}%)</span>
                          </div>
                          {/* Beautiful customized CSS Bar */}
                          <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                    {stockReport.categorySummary.length === 0 && (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        No product distributions loaded yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Immediate replenishment tasks */}
                <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Urgent Pharmacy Tasks
                  </h3>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {stockReport.medicinesList.filter((m: any) => m.isLowStock || m.isExpired || m.isNearExpiry).map((m: any) => (
                      <div 
                        key={m.id} 
                        className={`p-3 rounded-lg border text-xs flex justify-between items-center ${
                          m.isExpired 
                            ? 'bg-red-50/50 border-red-200 text-red-900' 
                            : m.isNearExpiry 
                            ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                            : 'bg-yellow-50/50 border-yellow-200 text-yellow-900'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{m.name}</div>
                          <div className="text-[10px] opacity-75">{m.code} &bull; {m.category}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold block">
                            {m.isExpired ? 'Expired' : m.isNearExpiry ? 'Near Expiry' : `Low Stock: ${m.stock} Units`}
                          </span>
                        </div>
                      </div>
                    ))}
                    {stockReport.medicinesList.filter((m: any) => m.isLowStock || m.isExpired || m.isNearExpiry).length === 0 && (
                      <div className="text-center py-12 text-gray-400 text-sm">
                        ✨ Splendid! All medicines are fully stocked and active.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL 1: ADD MEDICINE TO CATALOG */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Register New Medicine (Master List)</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                createMedicineMutation.mutate(medicineForm);
              }}
              className="p-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Medicine Code (Unique)</label>
                  <input
                    type="text"
                    placeholder="e.g. MED-PARACET"
                    value={medicineForm.code}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Generic / Brand Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Paracetamol 500mg"
                    value={medicineForm.name}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Category</label>
                  <select
                    value={medicineForm.category}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Min Alert Stock Threshold</label>
                  <input
                    type="number"
                    value={medicineForm.minStockAlert}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, minStockAlert: parseInt(e.target.value) || 0 }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Base Purchase Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={medicineForm.purchasePrice}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Base Retail Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={medicineForm.unitPrice}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Rack Location (e.g. Shelf A4)</label>
                  <input
                    type="text"
                    placeholder="Shelf B-12"
                    value={medicineForm.rackLocation}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, rackLocation: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={medicineForm.expiryDate}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMedicineMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {createMedicineMutation.isPending ? 'Saving...' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: EDIT MEDICINE DETAILS */}
      {editingMedicine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Modify Master Product: {editingMedicine.name}</h3>
              <button onClick={() => setEditingMedicine(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                updateMedicineMutation.mutate({
                  id: editingMedicine.id,
                  data: medicineForm
                });
              }}
              className="p-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Medicine Code</label>
                  <input
                    type="text"
                    value={medicineForm.code}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={medicineForm.name}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Category</label>
                  <select
                    value={medicineForm.category}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-white focus:outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Min Alert Qty</label>
                  <input
                    type="number"
                    value={medicineForm.minStockAlert}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, minStockAlert: parseInt(e.target.value) || 0 }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Purchase Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={medicineForm.purchasePrice}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Retail Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={medicineForm.unitPrice}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Rack Location</label>
                  <input
                    type="text"
                    value={medicineForm.rackLocation}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, rackLocation: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={medicineForm.expiryDate}
                    onChange={(e) => setMedicineForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingMedicine(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMedicineMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {updateMedicineMutation.isPending ? 'Saving...' : 'Apply Modifications'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 3: MEDICINE DETAILS, SALE AND PURCHASE HISTORY LOGS */}
      {showDetailMedicine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 bg-gray-50 border-b border-gray-200">
              <div>
                <span className="font-mono text-xs text-emerald-700 font-semibold uppercase">{showDetailMedicine.code}</span>
                <h3 className="text-lg font-bold text-gray-900">{showDetailMedicine.name}</h3>
              </div>
              <button onClick={() => setShowDetailMedicine(null)} className="text-gray-400 hover:text-gray-600 bg-white border p-1 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
              {/* Stats Bar */}
              <div className="grid grid-cols-4 gap-4 text-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase">Category</div>
                  <div className="font-bold text-sm text-gray-900 mt-1">{showDetailMedicine.category}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase">Current Stock</div>
                  <div className="font-bold text-sm text-emerald-600 mt-1">{showDetailMedicine.stock} units</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase">Shelf / Rack</div>
                  <div className="font-bold text-sm text-gray-900 mt-1">{showDetailMedicine.rackLocation || 'Shelf B3'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase">Expiry</div>
                  <div className={`font-bold text-xs mt-1.5 ${isExpired(showDetailMedicine.expiryDate) ? 'text-red-600' : 'text-gray-900'}`}>{showDetailMedicine.expiryDate}</div>
                </div>
              </div>

              {/* Transaction Logs tabs inside Details Modal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Batches Restock Records */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowDownCircle className="w-4 h-4 text-emerald-600" /> Procurement / Batch Log
                  </h4>
                  <div className="bg-white border rounded-lg overflow-hidden text-xs max-h-[180px] overflow-y-auto">
                    {medicineDetails?.purchases && medicineDetails.purchases.length > 0 ? (
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 font-semibold border-b">
                          <tr>
                            <th className="p-2">Date</th>
                            <th className="p-2">Supplier</th>
                            <th className="p-2 text-center">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-gray-700">
                          {medicineDetails.purchases.map((p: any) => (
                            <tr key={p.id}>
                              <td className="p-2">{p.purchaseDate}</td>
                              <td className="p-2 truncate max-w-[80px]">{p.supplier}</td>
                              <td className="p-2 text-center font-semibold text-emerald-700">+{p.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-4 text-center text-gray-400">No batch restocks found.</div>
                    )}
                  </div>
                </div>

                {/* Patient Dispensed Records */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-indigo-600" /> Patient Dispensation Logs
                  </h4>
                  <div className="bg-white border rounded-lg overflow-hidden text-xs max-h-[180px] overflow-y-auto">
                    {medicineDetails?.sales && medicineDetails.sales.length > 0 ? (
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 font-semibold border-b">
                          <tr>
                            <th className="p-2">Date</th>
                            <th className="p-2">Patient</th>
                            <th className="p-2 text-center">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-gray-700">
                          {medicineDetails.sales.map((s: any) => (
                            <tr key={s.id}>
                              <td className="p-2">{s.saleDate}</td>
                              <td className="p-2 font-medium truncate max-w-[80px]">{s.patient ? s.patient.name : 'Walk-in'}</td>
                              <td className="p-2 text-center font-semibold text-indigo-700">-{s.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-4 text-center text-gray-400">No dispensation log recorded.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Delete button */}
            <div className="p-5 border-t border-gray-100 flex justify-between bg-gray-50">
              {role === 'admin' ? (
                <button
                  onClick={() => {
                    if (window.confirm('Are you absolutely sure you want to permanently delete this medicine from master index? This action cannot be undone.')) {
                      deleteMedicineMutation.mutate(showDetailMedicine.id);
                    }
                  }}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-semibold py-2 px-3 border border-red-200 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Purge Medicine
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setShowDetailMedicine(null)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
