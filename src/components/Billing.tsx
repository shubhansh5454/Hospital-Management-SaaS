import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  CreditCard, 
  TrendingUp, 
  Coins, 
  Printer, 
  Trash2, 
  Calendar, 
  ChevronRight, 
  User, 
  DollarSign, 
  Activity,
  PlusCircle,
  X
} from 'lucide-react';

interface InvoiceItem {
  id?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

interface PaymentRecord {
  id: number;
  amount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'card' | 'upi';
  referenceNo?: string;
  notes?: string;
  createdAt: string;
}

interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
  dob: string;
}

interface Invoice {
  id: number;
  patientId: number;
  doctorId?: number;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  status: 'pending' | 'paid' | 'partially_paid' | 'cancelled';
  taxRate: number;
  taxAmount: number;
  discount: number;
  subTotal: number;
  totalAmount: number;
  amountPaid: number;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  patient: Patient;
  items: InvoiceItem[];
  payments: PaymentRecord[];
  doctor?: {
    id: number;
    name: string;
    email: string;
  };
}

export default function Billing() {
  const { token, profile } = useAuth();
  const role = profile?.role || 'patient';
  const queryClient = useQueryClient();

  // Search & filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Selection/Modal states
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<number | null>(null);

  // Success & Error Alerts
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State for Create Invoice
  const [createForm, setCreateForm] = useState({
    patientId: '',
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    taxRate: 18, // 18% GST default
    discount: 0,
    notes: '',
    items: [{ description: '', quantity: 1, unitPrice: 0 }]
  });

  // Form State for Record Payment
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash' as 'cash' | 'card' | 'upi',
    referenceNo: '',
    notes: ''
  });

  // Query: Fetch Invoices
  const { data: invoices = [], isLoading: isLoadingInvoices } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await fetch('/api/invoices', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load invoices');
      return res.json();
    },
    enabled: !!token
  });

  // Query: Fetch Patients (for Create Invoice form)
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && ['admin', 'doctor', 'receptionist'].includes(role)
  });

  // Query: Fetch Doctors (for Create Invoice form)
  const { data: doctors = [] } = useQuery<any[]>({
    queryKey: ['doctors'],
    queryFn: async () => {
      const res = await fetch('/api/doctors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && ['admin', 'doctor', 'receptionist'].includes(role)
  });

  // Mutation: Create Invoice
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create invoice');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSuccessMsg('Invoice created successfully!');
      setShowCreateModal(false);
      resetCreateForm();
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    }
  });

  // Mutation: Record Payment
  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await fetch(`/api/invoices/${id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to record payment');
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSuccessMsg('Payment transaction logged successfully!');
      setShowPaymentModal(null);
      // Update selected invoice detail view with updated invoice response
      if (selectedInvoice && selectedInvoice.id === result.invoice.id) {
        setSelectedInvoice(result.invoice);
      }
      resetPaymentForm();
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    }
  });

  // Mutation: Delete Invoice (Admin only)
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete invoice');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSuccessMsg('Invoice deleted successfully');
      setSelectedInvoice(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  });

  // Mutation: Cancel Invoice
  const cancelInvoiceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (!res.ok) throw new Error('Failed to cancel invoice');
      return res.json();
    },
    onSuccess: (updatedInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSuccessMsg('Invoice cancelled successfully');
      setSelectedInvoice(updatedInvoice);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  });

  // Reset helpers
  const resetCreateForm = () => {
    setCreateForm({
      patientId: '',
      doctorId: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      taxRate: 18,
      discount: 0,
      notes: '',
      items: [{ description: '', quantity: 1, unitPrice: 0 }]
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      referenceNo: '',
      notes: ''
    });
  };

  // Form handlers
  const handleAddItemRow = () => {
    setCreateForm(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitPrice: 0 }]
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    if (createForm.items.length === 1) return;
    setCreateForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    setCreateForm(prev => {
      const updatedItems = [...prev.items];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: val
      };
      return { ...prev, items: updatedItems };
    });
  };

  // Live creation preview calculations
  const creationTotals = useMemo(() => {
    let subTotal = 0;
    createForm.items.forEach(item => {
      subTotal += item.quantity * item.unitPrice;
    });
    const taxAmount = parseFloat((subTotal * (createForm.taxRate / 100)).toFixed(2));
    const totalAmount = parseFloat((subTotal + taxAmount - createForm.discount).toFixed(2));
    return { subTotal, taxAmount, totalAmount };
  }, [createForm]);

  // Submit invoice
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.patientId) {
      alert('Please select a patient');
      return;
    }

    const payload = {
      patientId: parseInt(createForm.patientId, 10),
      doctorId: createForm.doctorId ? parseInt(createForm.doctorId, 10) : undefined,
      date: createForm.date,
      dueDate: createForm.dueDate,
      taxRate: parseFloat(createForm.taxRate.toString()),
      discount: parseFloat(createForm.discount.toString()),
      notes: createForm.notes || undefined,
      items: createForm.items.map(it => ({
        description: it.description,
        quantity: parseInt(it.quantity.toString(), 10),
        unitPrice: parseFloat(it.unitPrice.toString())
      }))
    };

    createInvoiceMutation.mutate(payload);
  };

  // Submit payment
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;

    const payload = {
      amount: parseFloat(paymentForm.amount.toString()),
      paymentDate: paymentForm.paymentDate,
      paymentMethod: paymentForm.paymentMethod,
      referenceNo: paymentForm.referenceNo || undefined,
      notes: paymentForm.notes || undefined
    };

    recordPaymentMutation.mutate({ id: showPaymentModal, data: payload });
  };

  // Print invoice helper
  const handlePrint = () => {
    window.print();
  };

  // Invoices computation & stats
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = 
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        inv.patient.name.toLowerCase().includes(search.toLowerCase()) ||
        inv.patient.email.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' ? true : inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    let totalBilled = 0;
    let totalCollected = 0;
    let pendingAmount = 0;

    invoices.forEach(inv => {
      if (inv.status !== 'cancelled') {
        totalBilled += inv.totalAmount;
        totalCollected += inv.amountPaid;
        pendingAmount += (inv.totalAmount - inv.amountPaid);
      }
    });

    return {
      totalBilled: parseFloat(totalBilled.toFixed(2)),
      totalCollected: parseFloat(totalCollected.toFixed(2)),
      outstanding: parseFloat(pendingAmount.toFixed(2))
    };
  }, [invoices]);

  const statusBadges = {
    paid: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', text: 'Paid', icon: CheckCircle },
    pending: { bg: 'bg-amber-50 text-amber-700 border-amber-100', text: 'Pending', icon: Clock },
    partially_paid: { bg: 'bg-sky-50 text-sky-700 border-sky-100', text: 'Partial', icon: Activity },
    cancelled: { bg: 'bg-slate-50 text-slate-500 border-slate-100', text: 'Cancelled', icon: XCircle }
  };

  return (
    <div id="billing_module" className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Alerts */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-xl shadow-sm"
          >
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-sm font-medium">{successMsg}</p>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-800 p-4 rounded-xl shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Stats Cards (Visible to Staff only) */}
      {role !== 'patient' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Billed</span>
              <span className="text-2xl font-bold text-slate-800 block">${stats.totalBilled.toLocaleString()}</span>
            </div>
            <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-bold">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Collected</span>
              <span className="text-2xl font-bold text-slate-800 block">${stats.totalCollected.toLocaleString()}</span>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
              <Coins className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Outstanding Balance</span>
              <span className="text-2xl font-bold text-amber-700 block">${stats.outstanding.toLocaleString()}</span>
            </div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Primary Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input 
            type="text"
            placeholder={role === 'patient' ? "Search invoice number..." : "Search invoice, patient name..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Status:</span>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-none font-semibold text-slate-800 cursor-pointer"
            >
              <option value="all">All Invoices</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partially_paid">Partial</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {role !== 'patient' && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-teal-500/15 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Invoice Table Grid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.01)] overflow-hidden">
        {isLoadingInvoices ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Fetching billing ledger...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <Receipt className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-700 text-sm">No Invoices Found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {search || statusFilter !== 'all' 
                  ? 'No invoices match your current search queries or filters.' 
                  : 'There are currently no billing ledger entries or receipts recorded.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Invoice #</th>
                  <th className="py-4 px-6">Patient</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Due Date</th>
                  <th className="py-4 px-6 text-right">Total Amount</th>
                  <th className="py-4 px-6 text-right">Paid</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {filteredInvoices.map((inv) => {
                  const badge = statusBadges[inv.status];
                  const StatusIcon = badge.icon;
                  const balance = parseFloat((inv.totalAmount - inv.amountPaid).toFixed(2));
                  
                  return (
                    <tr 
                      key={inv.id} 
                      className="hover:bg-slate-50/40 transition-colors"
                    >
                      <td className="py-4 px-6 font-mono font-semibold text-teal-600">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-slate-600 text-[10px]">
                            {inv.patient.name.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block">{inv.patient.name}</span>
                            <span className="text-[10px] text-slate-400 block">{inv.patient.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        {inv.date}
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        {inv.dueDate || '--'}
                      </td>
                      <td className="py-4 px-6 font-bold text-right text-slate-800">
                        ${inv.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-4 px-6 font-semibold text-right text-emerald-600">
                        ${inv.amountPaid.toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-wide ${badge.bg}`}>
                          <StatusIcon className="w-3 h-3 shrink-0" />
                          <span>{badge.text}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setSelectedInvoice(inv)}
                            className="bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-600 border border-slate-200 hover:border-teal-100 p-1.5 rounded-lg font-medium transition-all text-[11px] cursor-pointer"
                          >
                            View Receipt
                          </button>

                          {role !== 'patient' && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                            <button 
                              onClick={() => {
                                setPaymentForm(prev => ({ ...prev, amount: balance }));
                                setShowPaymentModal(inv.id);
                              }}
                              className="bg-teal-500 hover:bg-teal-600 text-white px-2.5 py-1.5 rounded-lg font-semibold transition-all text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pay</span>
                            </button>
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

      {/* Modals & Detail Overlays */}
      
      {/* 1. Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-lg">Generate Billing Invoice</h3>
                  <p className="text-xs text-slate-400">Fill in clinical services, items and taxes</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Scroll Container */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Patient & Doctor Selector Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Patient Profile *</label>
                  <select 
                    required
                    value={createForm.patientId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, patientId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Consulting Doctor (Optional)</label>
                  <select 
                    value={createForm.doctorId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, doctorId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                  >
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.name} ({d.specialization})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date Fields Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Invoice Date</label>
                  <input 
                    required
                    type="date"
                    value={createForm.date}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Due Date (Grace Period)</label>
                  <input 
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Line Items (Billing breakdown)</h4>
                  <button 
                    type="button"
                    onClick={handleAddItemRow}
                    className="flex items-center gap-1 bg-teal-50 text-teal-600 hover:bg-teal-100/80 px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {createForm.items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        {idx === 0 && <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Description / Service Name</span>}
                        <input 
                          required
                          type="text"
                          placeholder="e.g. General Consultation, Blood Test, MRI scan"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                        />
                      </div>

                      <div className="w-24 space-y-1">
                        {idx === 0 && <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider text-center">Qty</span>}
                        <input 
                          required
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-center focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                        />
                      </div>

                      <div className="w-32 space-y-1">
                        {idx === 0 && <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider text-right">Unit Price ($)</span>}
                        <input 
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-right focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                        />
                      </div>

                      <div className="w-28 text-right py-3 pr-2 text-xs font-semibold text-slate-500">
                        ${(item.quantity * item.unitPrice).toFixed(2)}
                      </div>

                      <button 
                        type="button"
                        disabled={createForm.items.length === 1}
                        onClick={() => handleRemoveItemRow(idx)}
                        className={`p-2.5 border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 rounded-xl transition-all cursor-pointer ${
                          createForm.items.length === 1 ? 'opacity-30 cursor-not-allowed' : ''
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Taxation & Discount Rows */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">GST / Tax Rate (%)</label>
                    <input 
                      type="number"
                      min="0"
                      value={createForm.taxRate}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Flat Discount ($)</label>
                    <input 
                      type="number"
                      min="0"
                      value={createForm.discount}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Invoice Notes & Terms</label>
                    <textarea 
                      rows={3}
                      placeholder="e.g. Thanks for your consultation. Please settle outstanding balance."
                      value={createForm.notes}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                    />
                  </div>
                </div>

                {/* Subtotals Panel */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between space-y-4">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billing Summary Preview</h5>
                  
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex justify-between items-center">
                      <span>Subtotal</span>
                      <span className="font-semibold text-slate-800">${creationTotals.subTotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span>GST ({createForm.taxRate}%)</span>
                      <span className="font-semibold text-slate-800">+${creationTotals.taxAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-red-600">
                      <span>Discount</span>
                      <span>-${parseFloat(createForm.discount.toString()).toFixed(2)}</span>
                    </div>

                    <div className="h-px bg-slate-200 my-2" />

                    <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                      <span>Grand Total Amount</span>
                      <span className="text-base text-teal-600">${creationTotals.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={createInvoiceMutation.isPending}
                      className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {createInvoiceMutation.isPending ? 'Saving Invoice...' : 'Generate Invoice Receipt'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-600" />
                <h3 className="font-display font-bold text-slate-800 text-base">Record Payment Receipt</h3>
              </div>
              <button 
                onClick={() => setShowPaymentModal(null)}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block tracking-wider">Payment Amount ($) *</label>
                <input 
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block tracking-wider">Date *</label>
                <input 
                  required
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block tracking-wider">Payment Channel *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'card', 'upi'] as const).map((method) => (
                    <button
                      type="button"
                      key={method}
                      onClick={() => setPaymentForm(prev => ({ ...prev, paymentMethod: method }))}
                      className={`py-2 text-xs font-bold uppercase rounded-xl border transition-all cursor-pointer ${
                        paymentForm.paymentMethod === method 
                          ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-sm' 
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block tracking-wider">Reference No. (e.g. UPI ID, Transaction #)</label>
                <input 
                  type="text"
                  placeholder="TXN9832749823 or UPI"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block tracking-wider">Internal memo</label>
                <textarea 
                  rows={2}
                  placeholder="e.g. Partial cash payment received at clinic desk"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-teal-500 focus:bg-white text-slate-700"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {recordPaymentMutation.isPending ? 'Logging transaction...' : 'Commit Payment Receipt'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 3. Detailed Receipt Drawers / Overlay */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50">
          {/* Overlay click closer */}
          <div className="absolute inset-0" onClick={() => setSelectedInvoice(null)} />
          
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            className="relative bg-white w-full max-w-2xl h-screen shadow-2xl border-l border-slate-100 flex flex-col z-10"
          >
            {/* Header / Actions toolbar */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 print:hidden">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-teal-600" />
                <h4 className="font-display font-bold text-slate-800 text-base">Receipt Summary</h4>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handlePrint}
                  className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>

                {role !== 'patient' && selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                  <button 
                    onClick={() => {
                      const bal = parseFloat((selectedInvoice.totalAmount - selectedInvoice.amountPaid).toFixed(2));
                      setPaymentForm(prev => ({ ...prev, amount: bal }));
                      setShowPaymentModal(selectedInvoice.id);
                    }}
                    className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Record Payment</span>
                  </button>
                )}

                {role !== 'patient' && selectedInvoice.status !== 'cancelled' && (
                  <button 
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel this invoice? This action will set its status to cancelled.')) {
                        cancelInvoiceMutation.mutate(selectedInvoice.id);
                      }
                    }}
                    className="bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel Invoice
                  </button>
                )}

                {role === 'admin' && (
                  <button 
                    onClick={() => {
                      if (confirm('CRITICAL: This will permanently delete this invoice and all associated payment logs. Proceed?')) {
                        deleteInvoiceMutation.mutate(selectedInvoice.id);
                      }
                    }}
                    className="bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 p-1.5 rounded-lg transition-all cursor-pointer"
                    title="Delete Invoice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button 
                  onClick={() => setSelectedInvoice(null)}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Printable Area - Receipt sheet */}
            <div id="printable_invoice_area" className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/20">
              <style>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #printable_invoice_area, #printable_invoice_area * {
                    visibility: visible;
                  }
                  #printable_invoice_area {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 0;
                    margin: 0;
                    background: white;
                  }
                }
              `}</style>

              {/* Receipt Letterhead */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6 shadow-xs">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-teal-600 font-display font-extrabold text-xl tracking-tight block">CareSync Clinic</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-medium">Electronic Billing Receipt</span>
                    <span className="text-[10px] text-slate-500 block">100 Wellness Avenue, Medical District</span>
                    <span className="text-[10px] text-slate-500 block">support@caresync.com | +1 (555) 019-2834</span>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wide uppercase bg-slate-100 text-slate-700">
                      Invoice
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700 block mt-1">{selectedInvoice.invoiceNumber}</span>
                    <span className="text-[10px] text-slate-400 block">Date: {selectedInvoice.date}</span>
                    {selectedInvoice.dueDate && (
                      <span className="text-[10px] text-slate-400 block">Due: {selectedInvoice.dueDate}</span>
                    )}
                  </div>
                </div>

                <div className="h-px bg-slate-100" />

                {/* Patient / Doctor profiles info */}
                <div className="grid grid-cols-2 gap-6 text-[11px]">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-400 uppercase tracking-wider block">Billed To (Patient):</span>
                    <span className="font-bold text-slate-800 block text-xs">{selectedInvoice.patient.name}</span>
                    <span className="text-slate-500 block">Email: {selectedInvoice.patient.email}</span>
                    <span className="text-slate-500 block">Phone: {selectedInvoice.patient.phone}</span>
                    <span className="text-slate-500 block">DOB: {selectedInvoice.patient.dob}</span>
                  </div>

                  {selectedInvoice.doctor && (
                    <div className="space-y-1 text-right">
                      <span className="font-bold text-slate-400 uppercase tracking-wider block">Attending Provider:</span>
                      <span className="font-bold text-slate-800 block text-xs">Dr. {selectedInvoice.doctor.name}</span>
                      <span className="text-slate-500 block">{selectedInvoice.doctor.email}</span>
                    </div>
                  )}
                </div>

                {/* Items Table breakdown */}
                <div className="space-y-2">
                  <div className="grid grid-cols-12 bg-slate-50 p-2.5 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <div className="col-span-6">Description / Service Code</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Unit Price</div>
                    <div className="col-span-2 text-right">Total Price</div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {selectedInvoice.items.map((item, i) => (
                      <div key={item.id || i} className="grid grid-cols-12 py-3 px-1 text-xs text-slate-700 items-center">
                        <div className="col-span-6 font-medium text-slate-800">{item.description}</div>
                        <div className="col-span-2 text-center text-slate-500">{item.quantity}</div>
                        <div className="col-span-2 text-right text-slate-500">${item.unitPrice.toFixed(2)}</div>
                        <div className="col-span-2 text-right font-semibold text-slate-800">${(item.quantity * item.unitPrice).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-slate-100" />

                {/* Ledger Totals summary */}
                <div className="flex justify-between items-start">
                  <div className="w-1/2 space-y-1 text-[11px] text-slate-500">
                    {selectedInvoice.notes && (
                      <>
                        <span className="font-bold text-slate-400 uppercase tracking-wider block">Memo / Notes:</span>
                        <p className="italic bg-slate-50 p-3 rounded-lg border border-slate-100">{selectedInvoice.notes}</p>
                      </>
                    )}
                  </div>

                  <div className="w-5/12 space-y-2 text-xs text-slate-600 text-right">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold text-slate-800">${selectedInvoice.subTotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>GST Tax ({selectedInvoice.taxRate}%)</span>
                      <span className="font-semibold text-slate-800">+${selectedInvoice.taxAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-red-600">
                      <span>Discount</span>
                      <span>-${selectedInvoice.discount.toFixed(2)}</span>
                    </div>

                    <div className="h-px bg-slate-100 my-1" />

                    <div className="flex justify-between text-sm font-bold text-slate-800">
                      <span>Grand Total</span>
                      <span className="text-teal-600">${selectedInvoice.totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between font-semibold text-emerald-600">
                      <span>Amount Settled</span>
                      <span>-${selectedInvoice.amountPaid.toFixed(2)}</span>
                    </div>

                    <div className="h-0.5 bg-slate-200 my-1" />

                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>Outstanding Balance</span>
                      <span className={selectedInvoice.totalAmount - selectedInvoice.amountPaid > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        ${(selectedInvoice.totalAmount - selectedInvoice.amountPaid).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions logs / Payments history */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Transactions History</span>

                {selectedInvoice.payments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No payment transactions have been recorded for this ledger yet.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedInvoice.payments.map((p, idx) => (
                      <div 
                        key={p.id || idx}
                        className="flex items-center justify-between border border-slate-100 p-3 rounded-xl bg-slate-50/50 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <span className="capitalize">{p.paymentMethod} Payment</span>
                            {p.referenceNo && (
                              <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                {p.referenceNo}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{p.paymentDate}</span>
                            {p.notes && <span className="italic block -mt-0.5 pl-1.5 border-l border-slate-200 text-[10px] text-slate-400">{p.notes}</span>}
                          </span>
                        </div>

                        <div className="font-bold text-emerald-600">
                          +${p.amount.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
