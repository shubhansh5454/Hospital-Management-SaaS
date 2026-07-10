import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Truck,
  FileText,
  Layers,
  Calendar,
  Edit2,
  Trash2,
  Check,
  X,
  Info,
  Activity,
  Barcode,
  ArrowUpDown,
  PlusCircle,
  ClipboardList,
  AlertOctagon,
  ChevronRight,
  Maximize2,
  FileSpreadsheet,
  Building2,
  ShoppingBag,
  Inbox
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
  description?: string;
}

interface Vendor {
  id: number;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  categoryId: number;
  category: Category;
  unit: string;
  stock: number;
  minStockAlert: number;
  description?: string;
}

interface POItem {
  id: number;
  purchaseOrderId: number;
  productId: number;
  product: Product;
  quantity: number;
  unitCost: number;
  receivedQty: number;
}

interface PurchaseOrder {
  id: number;
  vendorId: number;
  vendor: Vendor;
  orderNumber: string;
  status: 'PENDING' | 'ORDERED' | 'RECEIVED' | 'CANCELLED' | 'PARTIALLY_RECEIVED';
  orderDate: string;
  totalAmount: number;
  notes?: string;
  items: POItem[];
  createdAt: string;
}

interface StockMovement {
  id: number;
  productId: number;
  product: Product;
  type: 'IN' | 'OUT';
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  reason: string;
  movementDate: string;
  notes?: string;
  createdAt: string;
}

interface InventoryMetrics {
  totalProducts: number;
  categoriesCount: number;
  vendorsCount: number;
  pendingPO: number;
  lowStockCount: number;
  lowStockItems: Product[];
  recentMovements: StockMovement[];
  expiringSoon: Array<{
    id: number;
    productName: string;
    sku: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    daysLeft: number;
  }>;
}

export default function Inventory() {
  const { token, profile } = useAuth();
  const role = profile?.role || 'patient';
  const isStaff = ['admin', 'doctor', 'receptionist'].includes(role);
  const queryClient = useQueryClient();

  // Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'vendors' | 'purchase-orders' | 'movements' | 'reports'>('dashboard');

  // Search, category & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out' | 'healthy'>('all');

  // Feedback notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal display states
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unit: 'Pieces',
    stock: 0,
    minStockAlert: 10,
    description: ''
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: ''
  });

  const [vendorForm, setVendorForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: ''
  });

  const [poForm, setPoForm] = useState<{
    vendorId: string;
    orderNumber: string;
    orderDate: string;
    notes: string;
    items: Array<{ productId: string; quantity: number; unitCost: number }>;
  }>({
    vendorId: '',
    orderNumber: '',
    orderDate: new Date().toISOString().split('T')[0],
    notes: '',
    items: [{ productId: '', quantity: 1, unitCost: 0.0 }]
  });

  const [movementForm, setMovementForm] = useState({
    productId: '',
    type: 'IN' as 'IN' | 'OUT',
    quantity: 1,
    batchNumber: '',
    expiryDate: '',
    reason: 'ADJUSTMENT',
    notes: ''
  });

  const [receiveQtys, setReceiveQtys] = useState<Record<string, { received: number; batch: string; expiry: string }>>({});

  // --- QUERIES ---

  const { data: metrics, isLoading: loadingMetrics } = useQuery<InventoryMetrics>({
    queryKey: ['inventoryMetrics'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/metrics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
      return res.json();
    },
    enabled: !!token && isStaff
  });

  const { data: categories, isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ['inventoryCategories'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    enabled: !!token
  });

  const { data: vendors, isLoading: loadingVendors } = useQuery<Vendor[]>({
    queryKey: ['inventoryVendors'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/vendors', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch vendors');
      return res.json();
    },
    enabled: !!token && isStaff
  });

  const { data: products, isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['inventoryProducts', searchQuery, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (categoryFilter && categoryFilter !== 'all') params.append('categoryId', categoryFilter);

      const res = await fetch(`/api/inventory/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    enabled: !!token
  });

  const { data: purchaseOrders, isLoading: loadingPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ['inventoryPurchaseOrders'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/purchase-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch purchase orders');
      return res.json();
    },
    enabled: !!token && isStaff
  });

  const { data: stockMovements, isLoading: loadingMovements } = useQuery<StockMovement[]>({
    queryKey: ['inventoryMovements'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/movements', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch stock movements');
      return res.json();
    },
    enabled: !!token && isStaff
  });

  // --- MUTATIONS ---

  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryForm) => {
      const res = await fetch('/api/inventory/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create category');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryCategories'] });
      setSuccessMsg('Inventory category registered successfully!');
      setShowCategoryModal(false);
      setCategoryForm({ name: '', description: '' });
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const createVendorMutation = useMutation({
    mutationFn: async (data: typeof vendorForm) => {
      const res = await fetch('/api/inventory/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create vendor');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryVendors'] });
      setSuccessMsg('Vendor registered successfully!');
      setShowVendorModal(false);
      setVendorForm({ name: '', contactPerson: '', email: '', phone: '', address: '' });
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const updateVendorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof vendorForm }) => {
      const res = await fetch(`/api/inventory/vendors/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update vendor');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryVendors'] });
      setSuccessMsg('Vendor information updated!');
      setEditingVendor(null);
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/inventory/vendors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete vendor');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryVendors'] });
      setSuccessMsg('Vendor removed successfully.');
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/inventory/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...data,
          categoryId: parseInt(data.categoryId),
          stock: parseInt(data.stock),
          minStockAlert: parseInt(data.minStockAlert)
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to register product');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryProducts'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMetrics'] });
      setSuccessMsg('Product registered successfully into Master List!');
      setShowProductModal(false);
      resetProductForm();
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/inventory/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...data,
          categoryId: parseInt(data.categoryId),
          stock: undefined, // do not change stock directly through product update (use movements)
          minStockAlert: parseInt(data.minStockAlert)
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update product');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryProducts'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMetrics'] });
      setSuccessMsg('Product specifications updated!');
      setEditingProduct(null);
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/inventory/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete product');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryProducts'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMetrics'] });
      setSuccessMsg('Product removed from catalog.');
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const createPOMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        vendorId: parseInt(data.vendorId),
        orderNumber: data.orderNumber,
        orderDate: data.orderDate,
        notes: data.notes || undefined,
        items: data.items.map((i: any) => ({
          productId: parseInt(i.productId),
          quantity: parseInt(i.quantity),
          unitCost: parseFloat(i.unitCost)
        }))
      };

      const res = await fetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to book purchase order');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryPurchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMetrics'] });
      setSuccessMsg('Purchase Order booked successfully!');
      setShowPOModal(false);
      resetPOForm();
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const receivePOMutation = useMutation({
    mutationFn: async ({ id, qtys }: { id: number; qtys: any }) => {
      const itemReceivedQtys: Record<string, { received: number; batch?: string; expiry?: string }> = {};
      for (const [key, val] of Object.entries(qtys)) {
        const v = val as any;
        if (v.received > 0) {
          itemReceivedQtys[key] = {
            received: parseInt(v.received),
            batch: v.batch || undefined,
            expiry: v.expiry || undefined
          };
        }
      }

      const res = await fetch(`/api/inventory/purchase-orders/${id}/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ itemReceivedQtys })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process PO inventory receipt');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryPurchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryProducts'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMetrics'] });
      setSuccessMsg('Stock items received and loaded into inventory!');
      setReceivingPO(null);
      setReceiveQtys({});
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const cancelPOMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/inventory/purchase-orders/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'CANCELLED' })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to cancel Purchase Order');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryPurchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMetrics'] });
      setSuccessMsg('Purchase Order cancelled.');
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  const recordMovementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...data,
          productId: parseInt(data.productId),
          quantity: parseInt(data.quantity),
          expiryDate: data.expiryDate || undefined
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to adjust stock');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryProducts'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMetrics'] });
      setSuccessMsg('Stock movement registered and balances updated!');
      setShowMovementModal(false);
      resetMovementForm();
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  // --- HANDLERS & RESET FORM HELPERS ---

  const resetProductForm = () => {
    setProductForm({
      name: '',
      sku: '',
      barcode: '',
      categoryId: categories && categories.length > 0 ? categories[0].id.toString() : '',
      unit: 'Pieces',
      stock: 0,
      minStockAlert: 10,
      description: ''
    });
  };

  const resetPOForm = () => {
    setPoForm({
      vendorId: vendors && vendors.length > 0 ? vendors[0].id.toString() : '',
      orderNumber: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      orderDate: new Date().toISOString().split('T')[0],
      notes: '',
      items: [{ productId: products && products.length > 0 ? products[0].id.toString() : '', quantity: 1, unitCost: 0.0 }]
    });
  };

  const resetMovementForm = () => {
    setMovementForm({
      productId: products && products.length > 0 ? products[0].id.toString() : '',
      type: 'IN',
      quantity: 1,
      batchNumber: '',
      expiryDate: '',
      reason: 'ADJUSTMENT',
      notes: ''
    });
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      sku: prod.sku,
      barcode: prod.barcode || '',
      categoryId: prod.categoryId.toString(),
      unit: prod.unit,
      stock: prod.stock,
      minStockAlert: prod.minStockAlert,
      description: prod.description || ''
    });
  };

  const handleEditVendor = (vend: Vendor) => {
    setEditingVendor(vend);
    setVendorForm({
      name: vend.name,
      contactPerson: vend.contactPerson || '',
      email: vend.email || '',
      phone: vend.phone || '',
      address: vend.address || ''
    });
  };

  // --- FILTERS ON CATALOG ---

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(prod => {
      if (stockStatusFilter === 'all') return true;
      if (stockStatusFilter === 'low') return prod.stock <= prod.minStockAlert && prod.stock > 0;
      if (stockStatusFilter === 'out') return prod.stock === 0;
      if (stockStatusFilter === 'healthy') return prod.stock > prod.minStockAlert;
      return true;
    });
  }, [products, stockStatusFilter]);

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      {/* Alert Feedbacks */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 flex items-center justify-between p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800"
          >
            <div className="flex items-center space-x-2">
              <Check className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)}>
              <X className="h-4 w-4 text-emerald-600 hover:text-emerald-800" />
            </button>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 flex items-center justify-between p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800"
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <span className="text-sm font-medium">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)}>
              <X className="h-4 w-4 text-rose-600 hover:text-rose-800" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section with minimal branding and action buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Package className="h-8 w-8 text-indigo-600" />
            Inventory & Asset Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Control clinic assets, medical supply batches, vendors directory, and dynamic restocking operations.
          </p>
        </div>

        {isStaff && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                resetMovementForm();
                setShowMovementModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-colors"
            >
              <Activity className="h-4 w-4 text-slate-500" />
              Stock Adjustment
            </button>

            <button
              onClick={() => {
                resetPOForm();
                setShowPOModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Create Purchase Order
            </button>

            <button
              onClick={() => {
                resetProductForm();
                setShowProductModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Product Item
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { id: 'dashboard', name: 'Dashboard' },
            { id: 'products', name: 'Product Catalog' },
            { id: 'vendors', name: 'Vendors Registry' },
            { id: 'purchase-orders', name: 'Purchase Orders' },
            { id: 'movements', name: 'Stock Movements Log' },
            { id: 'reports', name: 'Alerts & Reports' }
          ].map(tab => {
            // Hide staff-only tabs if patient is logged in
            if (!isStaff && ['vendors', 'purchase-orders', 'movements'].includes(tab.id)) return null;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  border-b-2 py-4 px-1 text-sm font-medium transition-colors whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }
                `}
              >
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB CONTENTS */}

      {/* 1. DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Bento-grid Analytics metrics */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-slate-200 p-5">
              <div className="flex items-center">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Package className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-500 truncate">Total Catalog Items</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics?.totalProducts ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-slate-200 p-5">
              <div className="flex items-center text-amber-600">
                <div className="p-3 bg-amber-50 rounded-lg">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-500 truncate">Low Stock Alert</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics?.lowStockCount ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-slate-200 p-5">
              <div className="flex items-center text-teal-600">
                <div className="p-3 bg-teal-50 rounded-lg">
                  <Truck className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-500 truncate">Incoming Deliveries</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics?.pendingPO ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-slate-200 p-5">
              <div className="flex items-center text-blue-600">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-500 truncate">Active Vendors</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics?.vendorsCount ?? 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Alerts */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertOctagon className="text-amber-500 h-5 w-5" />
                Critical Low Stock Alerts
              </h2>
              {metrics?.lowStockItems && metrics.lowStockItems.length > 0 ? (
                <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-2">
                  {metrics.lowStockItems.map(item => (
                    <div key={item.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{item.name}</p>
                        <p className="text-xs text-slate-400">SKU: {item.sku} • Category: {item.category?.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.stock === 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                          {item.stock} {item.unit} left
                        </span>
                        {isStaff && (
                          <button
                            onClick={() => {
                              resetPOForm();
                              setPoForm(p => ({
                                ...p,
                                items: [{ productId: item.id.toString(), quantity: 100, unitCost: 0.0 }]
                              }));
                              setActiveTab('purchase-orders');
                              setShowPOModal(true);
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-indigo-600 text-xs font-medium border border-indigo-200 px-2 py-0.5"
                          >
                            Reorder
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <Check className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  All supplies and assets are at optimal stock levels.
                </div>
              )}
            </div>

            {/* Expiring Soon */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="text-rose-500 h-5 w-5" />
                Expiry Warnings (Next 90 Days)
              </h2>
              {metrics?.expiringSoon && metrics.expiringSoon.length > 0 ? (
                <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-2">
                  {metrics.expiringSoon.map(item => (
                    <div key={item.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{item.productName}</p>
                        <p className="text-xs text-slate-400">Batch: {item.batchNumber} • Expiry: {item.expiryDate}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${item.daysLeft <= 0 ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800'}`}>
                          {item.daysLeft <= 0 ? 'EXPIRED' : `${item.daysLeft} days left`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  No expiring items or supply batches found within the warning window.
                </div>
              )}
            </div>
          </div>

          {/* Recent Stock Movements Log preview */}
          {isStaff && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-indigo-500" />
                  Recent Stock Actions
                </h2>
                <button onClick={() => setActiveTab('movements')} className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-medium">
                  View full logs <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              {metrics?.recentMovements && metrics.recentMovements.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Reason</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                      {metrics.recentMovements.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">{m.product?.name}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${m.type === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {m.type === 'IN' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              Stock {m.type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">{m.quantity}</td>
                          <td className="px-4 py-2.5 text-xs">{m.reason}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">{m.movementDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No stock transactions have been logged yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. PRODUCT CATALOG */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Filter row */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products by Name, SKU, Barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Categories Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Categories</option>
                {categories?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              {/* Stock status Filter */}
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Stock Levels</option>
                <option value="healthy">Healthy Stock Only</option>
                <option value="low">Low Stock Warning</option>
                <option value="out">Out of Stock</option>
              </select>
            </div>

            {isStaff && (
              <button
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-2"
              >
                <Layers className="h-4 w-4 text-slate-400" />
                Manage Categories
              </button>
            )}
          </div>

          {/* Catalog grid */}
          {loadingProducts ? (
            <div className="py-24 text-center text-slate-500">Loading catalog items...</div>
          ) : filteredProducts.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Item Details</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU / Code</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Level</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Barcode</th>
                    {isStaff && <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredProducts.map(prod => {
                    const isLow = prod.stock <= prod.minStockAlert && prod.stock > 0;
                    const isOut = prod.stock === 0;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold">
                              {prod.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <button onClick={() => setDetailProduct(prod)} className="text-sm font-semibold text-indigo-600 hover:underline text-left">
                                {prod.name}
                              </button>
                              <div className="text-xs text-slate-400">Unit: {prod.unit}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {prod.category?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                            {prod.sku}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className={`font-semibold text-sm ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                              {prod.stock} {prod.unit}
                            </span>
                            {isOut && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">OUT OF STOCK</span>}
                            {isLow && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">LOW STOCK</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {prod.barcode ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 border border-slate-100 rounded">
                              <Barcode className="h-3 w-3 text-slate-400" />
                              {prod.barcode}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">None</span>
                          )}
                        </td>
                        {isStaff && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditProduct(prod)}
                                className="text-slate-500 hover:text-indigo-600 p-1 hover:bg-slate-100 rounded transition-colors"
                                title="Edit Product Specs"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to remove "${prod.name}" from the catalog?`)) {
                                    deleteProductMutation.mutate(prod.id);
                                  }
                                }}
                                className="text-slate-500 hover:text-rose-600 p-1 hover:bg-slate-100 rounded transition-colors"
                                title="Delete Product"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
              <Inbox className="h-12 w-12 mx-auto text-slate-300 mb-2" />
              <p>No products match your filters or search terms.</p>
              {isStaff && (
                <button onClick={() => setShowProductModal(true)} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                  Register First Product
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. VENDORS REGISTRY */}
      {activeTab === 'vendors' && isStaff && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">Registered Suppliers & Vendors</h2>
            <button
              onClick={() => {
                setEditingVendor(null);
                setVendorForm({ name: '', contactPerson: '', email: '', phone: '', address: '' });
                setShowVendorModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Add Vendor
            </button>
          </div>

          {loadingVendors ? (
            <div className="py-24 text-center">Loading suppliers...</div>
          ) : vendors && vendors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendors.map(vend => (
                <div key={vend.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                        {vend.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{vend.name}</h3>
                        <p className="text-xs text-slate-400">ID: VND-{vend.id.toString().padStart(3, '0')}</p>
                      </div>
                    </div>

                    <div className="space-y-2 my-4 text-xs text-slate-600 border-t border-b border-slate-100 py-3">
                      {vend.contactPerson && <div className="flex justify-between"><strong>Rep:</strong> <span>{vend.contactPerson}</span></div>}
                      {vend.email && <div className="flex justify-between"><strong>Email:</strong> <span>{vend.email}</span></div>}
                      {vend.phone && <div className="flex justify-between"><strong>Phone:</strong> <span>{vend.phone}</span></div>}
                      {vend.address && <div className="flex justify-between"><strong>Address:</strong> <span className="truncate max-w-[150px]">{vend.address}</span></div>}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        handleEditVendor(vend);
                        setShowVendorModal(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700"
                    >
                      Edit Specs
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove supplier "${vend.name}"? This will not affect historical records.`)) {
                          deleteVendorMutation.mutate(vend.id);
                        }
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-50 hover:bg-rose-100 text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
              <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-2" />
              <p>No vendors found. Set up suppliers before creating Purchase Orders.</p>
            </div>
          )}
        </div>
      )}

      {/* 4. PURCHASE ORDERS */}
      {activeTab === 'purchase-orders' && isStaff && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">Purchase Orders (Restocking)</h2>
          </div>

          {loadingPOs ? (
            <div className="py-24 text-center">Loading Purchase Orders...</div>
          ) : purchaseOrders && purchaseOrders.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">PO Number</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendor</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {purchaseOrders.map(po => {
                    const isPending = po.status === 'PENDING' || po.status === 'ORDERED';
                    const isPartial = po.status === 'PARTIALLY_RECEIVED';

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-semibold text-indigo-600">
                          {po.orderNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {po.vendor?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                          {po.orderDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                          ${po.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold
                            ${po.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800' : ''}
                            ${po.status === 'PENDING' ? 'bg-indigo-100 text-indigo-800' : ''}
                            ${po.status === 'ORDERED' ? 'bg-blue-100 text-blue-800' : ''}
                            ${po.status === 'PARTIALLY_RECEIVED' ? 'bg-amber-100 text-amber-800' : ''}
                            ${po.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600' : ''}
                          `}>
                            {po.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                          <div className="flex items-center justify-end gap-2">
                            {(isPending || isPartial) && (
                              <button
                                onClick={() => {
                                  // Seed initial receive qtys to PO's pending quantities
                                  const initialQtys: typeof receiveQtys = {};
                                  po.items.forEach(i => {
                                    initialQtys[i.id] = {
                                      received: i.quantity - i.receivedQty,
                                      batch: `B-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                                      expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                    };
                                  });
                                  setReceiveQtys(initialQtys);
                                  setReceivingPO(po);
                                }}
                                className="px-2.5 py-1 rounded bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                              >
                                Receive Stock
                              </button>
                            )}

                            {isPending && (
                              <button
                                onClick={() => {
                                  if (confirm(`Cancel purchase order ${po.orderNumber}?`)) {
                                    cancelPOMutation.mutate(po.id);
                                  }
                                }}
                                className="px-2.5 py-1 rounded border border-slate-300 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                              >
                                Cancel PO
                              </button>
                            )}

                            <button
                              onClick={() => {
                                alert(`Purchase Order Notes:\n\n${po.notes || 'No extra notes.'}`);
                              }}
                              className="px-2.5 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
              <ShoppingBag className="h-12 w-12 mx-auto text-slate-300 mb-2" />
              <p>No Purchase Orders recorded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* 5. STOCK MOVEMENTS LOG */}
      {activeTab === 'movements' && isStaff && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900 font-sans tracking-tight">Supply & Asset Stock Ledger</h2>
          </div>

          {loadingMovements ? (
            <div className="py-24 text-center">Loading stock movements...</div>
          ) : stockMovements && stockMovements.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Product</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Movement Type</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Quantity</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Batch Info</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Expiry</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Reason</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {stockMovements.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-medium text-slate-800">{m.product?.name}</td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${m.type === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {m.type === 'IN' ? 'STOCK IN' : 'STOCK OUT'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-700">{m.quantity} {m.product?.unit}</td>
                      <td className="px-6 py-3.5 text-slate-500">{m.batchNumber || 'N/A'}</td>
                      <td className="px-6 py-3.5 text-slate-500">{m.expiryDate || 'N/A'}</td>
                      <td className="px-6 py-3.5 text-xs text-slate-600 bg-slate-50/30 font-medium">{m.reason}</td>
                      <td className="px-6 py-3.5 text-slate-400 text-xs">{m.movementDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
              <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-2" />
              <p>No stock ledger transaction records found.</p>
            </div>
          )}
        </div>
      )}

      {/* 6. REPORTS SECTION */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">Inventory Stock & Expiry Report</h2>
            <p className="text-sm text-slate-500">Overview of inventory health, critical thresholds, and upcoming batches lifecycle.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Low Stock Alerts */}
            <div className="bg-white shadow-sm rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Under-Stocked Alert Checklist
              </h3>
              {metrics?.lowStockItems && metrics.lowStockItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-400">
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3">Stock</th>
                        <th className="py-2 px-3">Min Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {metrics.lowStockItems.map(item => (
                        <tr key={item.id}>
                          <td className="py-2 px-3 font-medium text-slate-700">{item.name}</td>
                          <td className="py-2 px-3 text-slate-400 font-mono">{item.sku}</td>
                          <td className="py-2 px-3 font-semibold text-rose-600">{item.stock} {item.unit}</td>
                          <td className="py-2 px-3 text-slate-500">{item.minStockAlert}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-sm text-center py-8">No under-stocked items registered.</p>
              )}
            </div>

            {/* Expiring Batches Checklist */}
            <div className="bg-white shadow-sm rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-rose-500" />
                Batch Expiring Warnings List
              </h3>
              {metrics?.expiringSoon && metrics.expiringSoon.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-400">
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">Batch #</th>
                        <th className="py-2 px-3">Expiry</th>
                        <th className="py-2 px-3 text-right">Days Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {metrics.expiringSoon.map(batch => (
                        <tr key={batch.id}>
                          <td className="py-2 px-3 font-medium text-slate-700">{batch.productName}</td>
                          <td className="py-2 px-3 text-slate-400 font-mono">{batch.batchNumber}</td>
                          <td className="py-2 px-3 text-slate-600">{batch.expiryDate}</td>
                          <td className="py-2 px-3 text-right font-bold text-orange-600">{batch.daysLeft} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-sm text-center py-8">No impending batch expirations.</p>
              )}
            </div>
          </div>
        </div>
      )}


      {/* MODALS SECTION */}

      {/* 1. PRODUCT SPECIFICATION MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'Edit Product Specifications' : 'Register New Inventory Item'}
              </h3>
              <button onClick={() => { setShowProductModal(false); setEditingProduct(null); }} className="p-1 hover:bg-slate-100 rounded">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (editingProduct) {
                updateProductMutation.mutate({ id: editingProduct.id, data: productForm });
              } else {
                createProductMutation.mutate(productForm);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Surgical Gloves Box"
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">SKU / Model Code *</label>
                  <input
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) => setProductForm(p => ({ ...p, sku: e.target.value }))}
                    placeholder="e.g. SGL-BOX-M"
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Barcode (UPC/EAN)</label>
                  <input
                    type="text"
                    value={productForm.barcode}
                    onChange={(e) => setProductForm(p => ({ ...p, barcode: e.target.value }))}
                    placeholder="e.g. 501234567890"
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Category *</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm(p => ({ ...p, categoryId: e.target.value }))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  >
                    <option value="">Select Category</option>
                    {categories?.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Unit of Measurement *</label>
                  <input
                    type="text"
                    required
                    value={productForm.unit}
                    onChange={(e) => setProductForm(p => ({ ...p, unit: e.target.value }))}
                    placeholder="e.g. Box, Piece, Vial"
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {!editingProduct && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Starting Stock Qty</label>
                    <input
                      type="number"
                      value={productForm.stock}
                      onChange={(e) => setProductForm(p => ({ ...p, stock: parseInt(e.target.value) || 0 }))}
                      className="w-full text-sm border border-slate-300 rounded-lg p-2"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Min Stock Alert Qty</label>
                  <input
                    type="number"
                    value={productForm.minStockAlert}
                    onChange={(e) => setProductForm(p => ({ ...p, minStockAlert: parseInt(e.target.value) || 0 }))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Description / Shelf Location</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Shelf A4, General clinical asset consumables"
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 h-20"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => { setShowProductModal(false); setEditingProduct(null); }} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  {editingProduct ? 'Save Specs' : 'Register Item'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}


      {/* 2. CATEGORIES MANAGEMENT MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Manage Inventory Categories</h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); createCategoryMutation.mutate(categoryForm); }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">New Category Name *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(c => ({ ...c, name: e.target.value }))}
                  placeholder="e.g. Consumables, Lab Reagents"
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Description</label>
                <input
                  type="text"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(c => ({ ...c, description: e.target.value }))}
                  placeholder="General explanation"
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
              </div>
              <button type="submit" className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg">
                Create Category
              </button>
            </form>

            <div className="mt-6 border-t pt-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Registered Categories</h4>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {categories?.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs border border-slate-100">
                    <div>
                      <p className="font-semibold text-slate-700">{cat.name}</p>
                      {cat.description && <p className="text-[10px] text-slate-400">{cat.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}


      {/* 3. VENDOR MODAL */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingVendor ? 'Edit Vendor Specifications' : 'Register New Supplier Vendor'}
              </h3>
              <button onClick={() => { setShowVendorModal(false); setEditingVendor(null); }} className="p-1 hover:bg-slate-100 rounded">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (editingVendor) {
                updateVendorMutation.mutate({ id: editingVendor.id, data: vendorForm });
              } else {
                createVendorMutation.mutate(vendorForm);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Company / Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm(v => ({ ...v, name: e.target.value }))}
                  placeholder="e.g. Allied Medical Supplies Ltd"
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Contact Person / Agent</label>
                <input
                  type="text"
                  value={vendorForm.contactPerson}
                  onChange={(e) => setVendorForm(v => ({ ...v, contactPerson: e.target.value }))}
                  placeholder="e.g. John Doe"
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm(v => ({ ...v, email: e.target.value }))}
                    placeholder="supplier@medical.com"
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Phone</label>
                  <input
                    type="text"
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm(v => ({ ...v, phone: e.target.value }))}
                    placeholder="+1 555-0199"
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Billing / Dispatch Address</label>
                <textarea
                  value={vendorForm.address}
                  onChange={(e) => setVendorForm(v => ({ ...v, address: e.target.value }))}
                  placeholder="Full physical dispatch warehouse address"
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 h-16"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => { setShowVendorModal(false); setEditingVendor(null); }} className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
                  {editingVendor ? 'Save Vendor Specs' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}


      {/* 4. PURCHASE ORDER CREATION MODAL */}
      {showPOModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Book Supply Restocking Purchase Order</h3>
              <button onClick={() => setShowPOModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); createPOMutation.mutate(poForm); }} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Supplier Vendor *</label>
                  <select
                    required
                    value={poForm.vendorId}
                    onChange={(e) => setPoForm(p => ({ ...p, vendorId: e.target.value }))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  >
                    <option value="">Select Vendor</option>
                    {vendors?.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">PO Number *</label>
                  <input
                    type="text"
                    required
                    value={poForm.orderNumber}
                    onChange={(e) => setPoForm(p => ({ ...p, orderNumber: e.target.value }))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Booking Date *</label>
                  <input
                    type="date"
                    required
                    value={poForm.orderDate}
                    onChange={(e) => setPoForm(p => ({ ...p, orderDate: e.target.value }))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Internal Reference Notes</label>
                  <input
                    type="text"
                    value={poForm.notes}
                    onChange={(e) => setPoForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Terms, dispatch instructions..."
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 p-2 text-xs font-bold text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-2 border-b">
                  <div className="col-span-6">Catalog Product Item *</div>
                  <div className="col-span-3">Order Qty *</div>
                  <div className="col-span-2">Unit Cost ($) *</div>
                  <div className="col-span-1 text-center"></div>
                </div>
                <div className="divide-y max-h-48 overflow-y-auto">
                  {poForm.items.map((item, idx) => (
                    <div key={idx} className="p-2 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[idx].productId = e.target.value;
                            setPoForm(p => ({ ...p, items: newItems }));
                          }}
                          className="w-full text-xs border border-slate-300 rounded p-1"
                        >
                          <option value="">Select Item</option>
                          {products?.map(prod => (
                            <option key={prod.id} value={prod.id}>
                              {prod.name} ({prod.sku})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          required
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[idx].quantity = parseInt(e.target.value) || 1;
                            setPoForm(p => ({ ...p, items: newItems }));
                          }}
                          className="w-full text-xs border border-slate-300 rounded p-1"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => {
                            const newItems = [...poForm.items];
                            newItems[idx].unitCost = parseFloat(e.target.value) || 0;
                            setPoForm(p => ({ ...p, items: newItems }));
                          }}
                          className="w-full text-xs border border-slate-300 rounded p-1"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        {poForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = poForm.items.filter((_, i) => i !== idx);
                              setPoForm(p => ({ ...p, items: newItems }));
                            }}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 p-2 border-t text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setPoForm(p => ({
                        ...p,
                        items: [...p.items, { productId: products && products.length > 0 ? products[0].id.toString() : '', quantity: 10, unitCost: 0.0 }]
                      }));
                    }}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 ml-auto"
                  >
                    <Plus className="h-3 w-3" /> Add Item Line
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => setShowPOModal(false)} className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg">
                  Submit Purchase Order
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}


      {/* 5. RECEIVE STOCK PO MODAL */}
      {receivingPO && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Receive Stock Items</h3>
                <p className="text-xs text-slate-400">Restock order #{receivingPO.orderNumber} • Vendor: {receivingPO.vendor?.name}</p>
              </div>
              <button onClick={() => setReceivingPO(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              receivePOMutation.mutate({ id: receivingPO.id, qtys: receiveQtys });
            }} className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 p-2 text-xs font-bold text-slate-500 grid grid-cols-12 gap-2 border-b">
                  <div className="col-span-4">Product Name</div>
                  <div className="col-span-2">Ordered</div>
                  <div className="col-span-2">Receiving *</div>
                  <div className="col-span-2">Batch Number</div>
                  <div className="col-span-2">Expiry Date</div>
                </div>
                <div className="divide-y">
                  {receivingPO.items.map(item => (
                    <div key={item.id} className="p-2 grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-4 font-semibold text-slate-700">{item.product?.name}</div>
                      <div className="col-span-2 font-mono text-slate-500">
                        {item.receivedQty} / {item.quantity}
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          required
                          min="0"
                          max={item.quantity - item.receivedQty}
                          value={receiveQtys[item.id]?.received ?? 0}
                          onChange={(e) => {
                            const newQtys = { ...receiveQtys };
                            newQtys[item.id] = {
                              ...newQtys[item.id],
                              received: parseInt(e.target.value) || 0
                            };
                            setReceiveQtys(newQtys);
                          }}
                          className="w-full border rounded p-1 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="BATCH-ID"
                          value={receiveQtys[item.id]?.batch ?? ''}
                          onChange={(e) => {
                            const newQtys = { ...receiveQtys };
                            newQtys[item.id] = {
                              ...newQtys[item.id],
                              batch: e.target.value
                            };
                            setReceiveQtys(newQtys);
                          }}
                          className="w-full border rounded p-1 text-xs font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="date"
                          value={receiveQtys[item.id]?.expiry ?? ''}
                          onChange={(e) => {
                            const newQtys = { ...receiveQtys };
                            newQtys[item.id] = {
                              ...newQtys[item.id],
                              expiry: e.target.value
                            };
                            setReceiveQtys(newQtys);
                          }}
                          className="w-full border rounded p-1 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => setReceivingPO(null)} className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg">
                  Submit Received Deliveries
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}


      {/* 6. STOCK ADJUSTMENT TRANSFER MODAL */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-600" />
                Record Stock Action / Adjustment
              </h3>
              <button onClick={() => setShowMovementModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); recordMovementMutation.mutate(movementForm); }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Product Item *</label>
                <select
                  required
                  value={movementForm.productId}
                  onChange={(e) => setMovementForm(m => ({ ...m, productId: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                >
                  <option value="">Select Catalog Item</option>
                  {products?.map(prod => (
                    <option key={prod.id} value={prod.id}>{prod.name} (Stock: {prod.stock})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Action Type *</label>
                  <select
                    value={movementForm.type}
                    onChange={(e) => setMovementForm(m => ({ ...m, type: e.target.value as any }))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    <option value="IN">STOCK IN (+)</option>
                    <option value="OUT">STOCK OUT (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={movementForm.quantity}
                    onChange={(e) => setMovementForm(m => ({ ...m, quantity: parseInt(e.target.value) || 1 }))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={movementForm.batchNumber}
                    onChange={(e) => setMovementForm(m => ({ ...m, batchNumber: e.target.value }))}
                    placeholder="BATCH-456"
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={movementForm.expiryDate}
                    onChange={(e) => setMovementForm(m => ({ ...m, expiryDate: e.target.value }))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Reason Code *</label>
                <select
                  value={movementForm.reason}
                  onChange={(e) => setMovementForm(m => ({ ...m, reason: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                >
                  <option value="ADJUSTMENT">Manual Stock Audit Adjustment</option>
                  <option value="DISPENSED">Dispensed to Clinic Rooms</option>
                  <option value="EXPIRED">Expired / Waste Cleanup</option>
                  <option value="DAMAGED">Damaged / Broken Supplies</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Explanatory Memo Notes</label>
                <textarea
                  value={movementForm.notes}
                  onChange={(e) => setMovementForm(m => ({ ...m, notes: e.target.value }))}
                  placeholder="Reference audit numbers or reasons..."
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 h-16"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => setShowMovementModal(false)} className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg">
                  Confirm Transaction
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 7. DETAILED PRODUCT LOGS MODAL */}
      {detailProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-6">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Product Technical Ledger</h3>
              <button onClick={() => setDetailProduct(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex justify-between border-b pb-2">
                <strong>Item Name:</strong> <span>{detailProduct.name}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <strong>SKU / Model Code:</strong> <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">{detailProduct.sku}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <strong>Unit Packing:</strong> <span>{detailProduct.unit}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <strong>Safety Alert Level:</strong> <span>Notify when stock hits or falls under {detailProduct.minStockAlert} {detailProduct.unit}</span>
              </div>
              {detailProduct.barcode && (
                <div className="flex justify-between border-b pb-2">
                  <strong>Barcode Scanner ID:</strong> <span className="font-mono text-xs text-slate-500">{detailProduct.barcode}</span>
                </div>
              )}
              {detailProduct.description && (
                <div>
                  <strong>Shelf Description / Rack Location:</strong>
                  <p className="mt-1 text-slate-500 text-xs bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed">{detailProduct.description}</p>
                </div>
              )}
            </div>

            <button onClick={() => setDetailProduct(null)} className="w-full mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
              Dismiss
            </button>
          </motion.div>
        </div>
      )}

    </div>
  );
}
