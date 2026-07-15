import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { 
  Scan, 
  FileText, 
  Layers, 
  Play, 
  Pause, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCw, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Eye, 
  Download, 
  ShieldAlert, 
  FileCheck, 
  ArrowRight, 
  RefreshCw,
  Sliders,
  Maximize,
  Calendar,
  User,
  Activity,
  FileSignature,
  Search,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RadiologyProps {
  isPatient?: boolean;
}

// Visual CT/MRI Mock Slices Database (represented as beautifully engineered visual SVGs with high-contrast radiological textures)
const MOCK_SLICES: Record<string, string[]> = {
  'BRAIN': [
    'https://images.unsplash.com/photo-1559757175-5700dde675bc?q=80&w=600&auto=format&fit=crop', // CT brain high axial
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?q=80&w=600&auto=format&fit=crop', // CT mid brain
    'https://images.unsplash.com/photo-1559757175-0131d8255091?q=80&w=600&auto=format&fit=crop', // CT lower brain
  ],
  'CHEST': [
    'https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?q=80&w=600&auto=format&fit=crop', // Chest radiograph
    'https://images.unsplash.com/photo-1616012480717-fd9867059ca0?q=80&w=600&auto=format&fit=crop', // CT chest axial
    'https://images.unsplash.com/photo-1516062423079-7ca13cdc7f5a?q=80&w=600&auto=format&fit=crop', // Chest radiograph 2
  ],
  'SPINE': [
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=600&auto=format&fit=crop', // Spine MRI mid sagittal
    'https://images.unsplash.com/photo-1576086213369-97a306d36557?q=80&w=600&auto=format&fit=crop', // Spine sagittal 2
  ],
  'KNEE': [
    'https://images.unsplash.com/photo-1579684389782-64d84b5e901d?q=80&w=600&auto=format&fit=crop', // Knee radiograph lateral
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=600&auto=format&fit=crop', // Knee axial MRI
  ]
};

// Fallback high-contrast radiological graphics
const FALLBACK_XRAY = 'https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?q=80&w=600&auto=format&fit=crop';

export default function Radiology({ isPatient = false }: RadiologyProps) {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const isClinician = profile?.role === 'doctor' || profile?.role === 'admin';

  // State
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'details' | 'viewer' | 'report'>('details');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isAcquireModalOpen, setIsAcquireModalOpen] = useState(false);

  // New Order Form state
  const [orderPatientId, setOrderPatientId] = useState('');
  const [orderModality, setOrderModality] = useState('MRI');
  const [orderBodyPart, setOrderBodyPart] = useState('Brain');
  const [orderPriority, setOrderPriority] = useState('ROUTINE');
  const [orderReason, setOrderReason] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // New Image Acquisition Form state
  const [acquireModalityPreset, setAcquireModalityPreset] = useState('BRAIN');
  const [acquireCustomUrl, setAcquireCustomUrl] = useState('');

  // DICOM Viewer interactivity state
  const [sliceIndex, setSliceIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [contrast, setContrast] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [isInverted, setIsInverted] = useState(false);
  const [windowPreset, setWindowPreset] = useState('SOFT_TISSUE'); // SOFT_TISSUE, LUNG, BONE, BRAIN
  const [isPlayingCine, setIsPlayingCine] = useState(false);
  const cineIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clinical Report Form state (editable drafts)
  const [reportFindings, setReportFindings] = useState('');
  const [reportImpression, setReportImpression] = useState('');
  const [reportRecommendations, setReportRecommendations] = useState('');
  const [reportStatus, setReportStatus] = useState('DRAFT'); // DRAFT, SIGNED_OFF

  // API Queries
  // 1. Fetch Patients (for order creation dropdown)
  const { data: patients } = useQuery({
    queryKey: ['patients-list'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load patients');
      return res.json();
    },
    enabled: !!token && isClinician,
  });

  // 2. Fetch Imaging Orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['radiology-orders', modalityFilter, statusFilter, searchQuery],
    queryFn: async () => {
      let url = '/api/radiology/orders';
      const params = new URLSearchParams();
      if (isPatient && profile?.id) {
        // Find patient profile or patient account link
        // Let's check portal history instead or filter orders client side
      }
      if (modalityFilter && modalityFilter !== 'all') params.append('search', modalityFilter);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load imaging orders');
      return res.json();
    },
    enabled: !!token,
  });

  // Patient profile/orders resolution
  const filteredOrders = orders?.filter((ord: any) => {
    if (isPatient) {
      // If patient, restrict only to their own patient profile match
      return ord.patient?.email === profile?.email;
    }
    return true;
  }) || [];

  // 3. Fetch specific active order details (including reports)
  const { data: activeOrder, isLoading: activeOrderLoading } = useQuery({
    queryKey: ['radiology-order', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const res = await fetch(`/api/radiology/orders/${selectedOrderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load order details');
      return res.json();
    },
    enabled: !!token && !!selectedOrderId,
  });

  // Sync report inputs when activeOrder changes
  useEffect(() => {
    if (activeOrder && activeOrder.reports && activeOrder.reports.length > 0) {
      const rep = activeOrder.reports[0];
      setReportFindings(rep.findings || '');
      setReportImpression(rep.impression || '');
      setReportRecommendations(rep.recommendations || '');
      setReportStatus(rep.status || 'DRAFT');
    } else {
      setReportFindings('');
      setReportImpression('');
      setReportRecommendations('');
      setReportStatus('DRAFT');
    }
    setSliceIndex(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsPlayingCine(false);
  }, [activeOrder]);

  // Handle Cine loop automatic slice cycling
  useEffect(() => {
    if (isPlayingCine) {
      const activeImages = getActiveImageStack();
      const maxSlices = activeImages.length;
      if (maxSlices <= 1) {
        setIsPlayingCine(false);
        return;
      }
      cineIntervalRef.current = setInterval(() => {
        setSliceIndex((prev) => (prev + 1) % maxSlices);
      }, 500); // cycle speed
    } else {
      if (cineIntervalRef.current) {
        clearInterval(cineIntervalRef.current);
        cineIntervalRef.current = null;
      }
    }

    return () => {
      if (cineIntervalRef.current) {
        clearInterval(cineIntervalRef.current);
      }
    };
  }, [isPlayingCine, activeOrder]);

  // Set default selected order on load
  useEffect(() => {
    if (filteredOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [orders]);

  // Mutations
  // 1. Create Order
  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/radiology/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create imaging order');
      }
      return res.json();
    },
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders'] });
      setSelectedOrderId(newOrder.id);
      setIsOrderModalOpen(false);
      setActiveWorkspaceTab('details');
      // Reset form
      setOrderPatientId('');
      setOrderReason('');
      setOrderNotes('');
    }
  });

  // 2. Acquire Image (PACS transmission mockup)
  const acquireImageMutation = useMutation({
    mutationFn: async ({ orderId, imageUrl }: { orderId: number; imageUrl: string }) => {
      const res = await fetch(`/api/radiology/orders/${orderId}/acquire`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ imageUrl })
      });
      if (!res.ok) throw new Error('Failed to process PACS image acquisition');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders'] });
      queryClient.invalidateQueries({ queryKey: ['radiology-order', selectedOrderId] });
      setIsAcquireModalOpen(false);
      setActiveWorkspaceTab('viewer');
    }
  });

  // 3. Save Report Draft
  const saveReportMutation = useMutation({
    mutationFn: async ({ orderId, data }: { orderId: number; data: any }) => {
      const res = await fetch(`/api/radiology/orders/${orderId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to save radiology report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders'] });
      queryClient.invalidateQueries({ queryKey: ['radiology-order', selectedOrderId] });
    }
  });

  // 4. Approve / Sign-Off Report
  const approveReportMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await fetch(`/api/radiology/orders/${orderId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to sign off on radiology report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders'] });
      queryClient.invalidateQueries({ queryKey: ['radiology-order', selectedOrderId] });
    }
  });

  // 5. Gemini AI Report Drafter
  const aiDraftMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await fetch(`/api/radiology/orders/${orderId}/ai-draft`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to auto-draft with Gemini AI. Ensure GEMINI_API_KEY is configured.');
      return res.json();
    },
    onSuccess: (data) => {
      setReportFindings(data.findings || '');
      setReportImpression(data.impression || '');
      setReportRecommendations(data.recommendations || '');
    }
  });

  // Helpers
  const getActiveImageStack = (): string[] => {
    if (!activeOrder) return [FALLBACK_XRAY];
    
    // Check if a report exists and has an image path
    const report = activeOrder.reports?.[0];
    const imagePath = report?.dicomImageUrl;
    if (!imagePath) return [FALLBACK_XRAY];

    // Map presets to actual image lists if it matches known modalities
    const upperPath = imagePath.toUpperCase();
    if (MOCK_SLICES[upperPath]) {
      return MOCK_SLICES[upperPath];
    }
    return [imagePath];
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderPatientId || !orderReason) return;
    createOrderMutation.mutate({
      patientId: parseInt(orderPatientId),
      modality: orderModality,
      bodyPart: orderBodyPart,
      priority: orderPriority,
      reason: orderReason,
      notes: orderNotes
    });
  };

  const handleAcquisitionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    const finalUrl = acquireCustomUrl || acquireModalityPreset;
    acquireImageMutation.mutate({
      orderId: selectedOrderId,
      imageUrl: finalUrl
    });
  };

  const handleSaveReportDraft = () => {
    if (!selectedOrderId) return;
    saveReportMutation.mutate({
      orderId: selectedOrderId,
      data: {
        findings: reportFindings,
        impression: reportImpression,
        recommendations: reportRecommendations,
        status: 'DRAFT'
      }
    });
  };

  const handleSignOffReport = () => {
    if (!selectedOrderId) return;
    saveReportMutation.mutate({
      orderId: selectedOrderId,
      data: {
        findings: reportFindings,
        impression: reportImpression,
        recommendations: reportRecommendations,
        status: 'APPROVED' // Sign off makes it directly approved or signed off
      }
    });
  };

  const handleFinalApprove = () => {
    if (!selectedOrderId) return;
    approveReportMutation.mutate(selectedOrderId);
  };

  const handleAiDraftReport = () => {
    if (!selectedOrderId) return;
    aiDraftMutation.mutate(selectedOrderId);
  };

  // Drag and Pan mechanics in DICOM simulation
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const getPresetStyle = () => {
    let brightnessVal = brightness;
    let contrastVal = contrast;
    let invertVal = isInverted ? 'invert(100%)' : 'invert(0%)';

    switch (windowPreset) {
      case 'BRAIN_CT':
        contrastVal = 1.8;
        brightnessVal = 1.1;
        break;
      case 'LUNG_CT':
        contrastVal = 0.6;
        brightnessVal = 1.4;
        break;
      case 'BONE_CT':
        contrastVal = 2.2;
        brightnessVal = 0.8;
        break;
      default:
        break;
    }

    return {
      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
      filter: `brightness(${brightnessVal}) contrast(${contrastVal}) ${invertVal}`,
      transition: isPanning ? 'none' : 'transform 0.1s ease-out, filter 0.1s ease-out'
    };
  };

  const activeStack = getActiveImageStack();
  const activeImage = activeStack[sliceIndex] || FALLBACK_XRAY;
  const isImageAcquired = activeOrder && (activeOrder.status === 'ACQUIRED' || activeOrder.status === 'REPORTED');

  return (
    <div className="space-y-6 font-sans">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-slate-800 tracking-tight">
                PACS & Radiology Diagnostics
              </h1>
              <p className="text-xs text-slate-400">
                Manage medical imaging orders, generate diagnostic reports, and inspect mock scans with an interactive DICOM darkroom viewer.
              </p>
            </div>
          </div>
        </div>

        {isClinician && !isPatient && (
          <button
            onClick={() => setIsOrderModalOpen(true)}
            id="btn_new_imaging_order"
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Imaging Order
          </button>
        )}
      </div>

      {/* Main Dual Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: Order Directory */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-500" />
              Order Directory
            </h2>

            {/* Searches and filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search modality, body part, reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 focus:border-teal-500 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none transition-colors text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={modalityFilter}
                  onChange={(e) => setModalityFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-100 focus:border-teal-500 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-slate-500 focus:outline-none transition-colors"
                >
                  <option value="all">All Modalities</option>
                  <option value="MRI">MRI</option>
                  <option value="CT">CT Scan</option>
                  <option value="X-RAY">X-Ray</option>
                  <option value="ULTRASOUND">Ultrasound</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-100 focus:border-teal-500 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-slate-500 focus:outline-none transition-colors"
                >
                  <option value="all">All Statuses</option>
                  <option value="REQUESTED">Requested</option>
                  <option value="ACQUIRED">Acquired</option>
                  <option value="REPORTED">Reported</option>
                </select>
              </div>
            </div>

            {/* List of orders */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {ordersLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
                  <span className="text-[10px] text-slate-400">Loading order log...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                  <Scan className="w-8 h-8 mx-auto text-slate-300 mb-2 animate-pulse" />
                  <p className="text-xs font-medium text-slate-500">No imaging orders found</p>
                  <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto mt-1">
                    {isPatient ? "You have no registered radiology imaging records at this time." : "Modify filters or create a new order to get started."}
                  </p>
                </div>
              ) : (
                filteredOrders.map((ord: any) => {
                  const hasReport = ord.reports && ord.reports.length > 0;
                  const isSelected = selectedOrderId === ord.id;
                  
                  return (
                    <button
                      key={ord.id}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2 relative ${
                        isSelected 
                          ? 'bg-teal-50/60 border-teal-200 shadow-sm' 
                          : 'bg-white border-slate-100 hover:bg-slate-50/50 hover:border-slate-200'
                      }`}
                    >
                      {/* Priority Tag line */}
                      {ord.priority === 'STAT' && (
                        <div className="absolute right-3 top-3 flex items-center gap-0.5 bg-rose-50 text-rose-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          STAT
                        </div>
                      )}

                      {ord.priority === 'URGENT' && ord.priority !== 'STAT' && (
                        <div className="absolute right-3 top-3 bg-amber-50 text-amber-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          URGENT
                        </div>
                      )}

                      <div className="space-y-0.5 pr-14">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ord.modality} Scan</span>
                        <h3 className="text-xs font-bold text-slate-800">{ord.bodyPart} Diagnostic</h3>
                        <p className="text-[11px] font-semibold text-slate-600 truncate">Patient: {ord.patient?.name}</p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-50 mt-1">
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {ord.orderDate}
                        </span>

                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          ord.status === 'REPORTED' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : ord.status === 'ACQUIRED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {ord.status}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right column: Diagnostic PACS Workspace */}
        <div className="lg:col-span-8">
          {!selectedOrderId ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center min-h-[500px] flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-slate-100 animate-pulse">
                <Scan className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-700">No Diagnostic Order Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">
                Select an imaging order from the left column directory to begin diagnostic reviews, PACS visualization, and AI clinical report drafting.
              </p>
            </div>
          ) : activeOrderLoading ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center min-h-[500px] flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-teal-500 mb-3" />
              <span className="text-xs text-slate-500 font-semibold font-sans">Syncing order file & PACS logs...</span>
            </div>
          ) : !activeOrder ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center min-h-[500px] flex flex-col items-center justify-center">
              <p className="text-xs text-rose-500 font-medium">Selected order record has been corrupted or was not found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[580px]">
              {/* Workspace Navigation Header */}
              <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md uppercase">
                      ID: #{activeOrder.id}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800">
                      {activeOrder.modality} - {activeOrder.bodyPart} Scan
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Patient: <strong className="text-slate-700">{activeOrder.patient?.name}</strong> (DOB: {activeOrder.patient?.dob})
                  </p>
                </div>

                {/* Workspace tab select */}
                <div className="flex bg-slate-200/50 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveWorkspaceTab('details')}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                      activeWorkspaceTab === 'details'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Indication
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab('viewer')}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                      activeWorkspaceTab === 'viewer'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    DICOM PACS
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab('report')}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                      activeWorkspaceTab === 'report'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    Report
                  </button>
                </div>
              </div>

              {/* Workspace Content Panels */}
              <div className="p-6 flex-1 flex flex-col">
                <AnimatePresence mode="wait">
                  
                  {/* TAB 1: Clinical Indication Details */}
                  {activeWorkspaceTab === 'details' && (
                    <motion.div
                      key="details-tab"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="space-y-6 flex-1 flex flex-col justify-between"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical Details</h4>
                          
                          <div className="space-y-2.5">
                            <div>
                              <span className="text-[10px] text-slate-400 font-medium">Modality Requested</span>
                              <p className="text-xs font-bold text-slate-700">{activeOrder.modality}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-medium">Target Body Region</span>
                              <p className="text-xs font-bold text-slate-700">{activeOrder.bodyPart}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-medium">Acquisition Date</span>
                              <p className="text-xs font-bold text-slate-700">{activeOrder.orderDate}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-medium">Priority Tier</span>
                              <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider mt-1 ${
                                activeOrder.priority === 'STAT'
                                  ? 'bg-rose-50 text-rose-600'
                                  : activeOrder.priority === 'URGENT'
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-slate-50 text-slate-600'
                              }`}>
                                {activeOrder.priority}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Requested Clinical Indication</h4>
                          
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                            <div>
                              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Reason For Study</span>
                              <p className="text-xs font-semibold text-slate-700 mt-1">{activeOrder.reason}</p>
                            </div>

                            {activeOrder.notes && (
                              <div>
                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Clinician Directives / Notes</span>
                                <p className="text-xs text-slate-600 mt-1 italic">"{activeOrder.notes}"</p>
                              </div>
                            )}

                            <div>
                              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Ordered By Physician</span>
                              <p className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                {activeOrder.doctor?.name || "Dr. Staff"} ({activeOrder.doctor?.email || "internal"})
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status timeline / Actions */}
                      <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            activeOrder.status === 'REPORTED'
                              ? 'bg-emerald-50 text-emerald-600'
                              : activeOrder.status === 'ACQUIRED'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-amber-50 text-amber-600 animate-pulse'
                          }`}>
                            {activeOrder.status === 'REPORTED' ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : activeOrder.status === 'ACQUIRED' ? (
                              <Layers className="w-5 h-5" />
                            ) : (
                              <Clock className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-700">Order Status: {activeOrder.status}</h5>
                            <p className="text-[10px] text-slate-400">
                              {activeOrder.status === 'REQUESTED' && "Awaiting scan imaging capture by the radiologic technician."}
                              {activeOrder.status === 'ACQUIRED' && "Images compiled in PACS. Report draft in progress."}
                              {activeOrder.status === 'REPORTED' && "Scan finalized with signed radiology diagnostic report."}
                            </p>
                          </div>
                        </div>

                        {isClinician && !isPatient && activeOrder.status === 'REQUESTED' && (
                          <button
                            onClick={() => setIsAcquireModalOpen(true)}
                            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
                          >
                            <Layers className="w-4 h-4" />
                            Simulate PACS Acquisition
                          </button>
                        )}

                        {activeOrder.status !== 'REQUESTED' && (
                          <button
                            onClick={() => setActiveWorkspaceTab('viewer')}
                            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                          >
                            Open PACS Viewer
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 2: PACS DICOM Darkroom Viewer */}
                  {activeWorkspaceTab === 'viewer' && (
                    <motion.div
                      key="viewer-tab"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="space-y-4 flex-1 flex flex-col"
                    >
                      {!isImageAcquired ? (
                        <div className="text-center py-16 bg-slate-900 rounded-xl flex flex-col items-center justify-center min-h-[400px]">
                          <ShieldAlert className="w-12 h-12 text-slate-600 mb-3" />
                          <h4 className="text-sm font-bold text-slate-400">PACS Image Stack Empty</h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2">
                            No medical scan files have been acquired or associated with this order. Technician acquisition is required first.
                          </p>
                          {isClinician && !isPatient && (
                            <button
                              onClick={() => setIsAcquireModalOpen(true)}
                              className="mt-4 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                            >
                              Simulate Acquisition Now
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
                          
                          {/* Viewer central dark screen */}
                          <div className="md:col-span-8 flex flex-col bg-black rounded-xl border border-slate-850 p-2 overflow-hidden relative select-none">
                            
                            {/* Diagnostic Corners HUD - Overlays */}
                            <div className="absolute left-4 top-4 text-left font-mono text-[9px] text-teal-400/80 pointer-events-none z-20 space-y-0.5">
                              <p>ID: {activeOrder.patient?.id || 12093}</p>
                              <p>NAME: {activeOrder.patient?.name?.toUpperCase()}</p>
                              <p>DOB: {activeOrder.patient?.dob}</p>
                              <p>GENDER: {activeOrder.patient?.gender?.toUpperCase()}</p>
                            </div>

                            <div className="absolute right-4 top-4 text-right font-mono text-[9px] text-teal-400/80 pointer-events-none z-20 space-y-0.5">
                              <p>MODALITY: {activeOrder.modality}</p>
                              <p>BODY REGION: {activeOrder.bodyPart?.toUpperCase()}</p>
                              <p>KVP: 120 / MA: 280</p>
                              <p>THICKNESS: 1.25mm</p>
                            </div>

                            <div className="absolute left-4 bottom-4 text-left font-mono text-[9px] text-teal-400/80 pointer-events-none z-20 space-y-0.5">
                              <p>SERIES UID: {activeOrder.reports?.[0]?.dicomSeriesUid || "1.2.840.1136"}</p>
                              <p>STUDY UID: {activeOrder.reports?.[0]?.dicomStudyUid || "1.2.840.9412"}</p>
                            </div>

                            <div className="absolute right-4 bottom-4 text-right font-mono text-[9px] text-teal-400/80 pointer-events-none z-20 space-y-0.5">
                              <p>FRAME: {sliceIndex + 1} / {activeStack.length}</p>
                              <p>ZOOM: {(zoom * 100).toFixed(0)}%</p>
                              <p>W/L: {windowPreset}</p>
                            </div>

                            {/* Center Canvas Viewport */}
                            <div 
                              className="flex-1 min-h-[320px] bg-slate-950 flex items-center justify-center overflow-hidden cursor-move relative"
                              onMouseDown={handleMouseDown}
                              onMouseMove={handleMouseMove}
                              onMouseUp={handleMouseUp}
                              onMouseLeave={handleMouseUp}
                            >
                              {/* Crosshair grid overlay */}
                              <div className="absolute inset-0 border border-dashed border-slate-900/40 pointer-events-none">
                                <div className="absolute top-1/2 left-0 w-full border-t border-dashed border-slate-900/25"></div>
                                <div className="absolute left-1/2 top-0 h-full border-l border-dashed border-slate-900/25"></div>
                              </div>

                              <img
                                src={activeImage}
                                alt="Radiology Scan Axial Slice"
                                style={getPresetStyle()}
                                className="max-h-[300px] object-contain rounded pointer-events-none"
                              />
                            </div>

                            {/* Slice Scroll bar slider */}
                            <div className="bg-slate-900 p-2 px-3 rounded-lg border border-slate-800 flex items-center gap-3 mt-2">
                              <button
                                onClick={() => setIsPlayingCine(!isPlayingCine)}
                                className={`p-1 text-xs rounded font-bold transition-colors ${
                                  isPlayingCine ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
                                }`}
                                title="Play Cine Loop (auto-scroll slices)"
                              >
                                {isPlayingCine ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              </button>
                              
                              <span className="text-[10px] font-mono text-slate-400">Slice:</span>
                              <input
                                type="range"
                                min={0}
                                max={activeStack.length - 1}
                                value={sliceIndex}
                                onChange={(e) => setSliceIndex(parseInt(e.target.value))}
                                className="flex-1 accent-teal-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-[10px] font-mono text-slate-400">
                                {sliceIndex + 1} / {activeStack.length}
                              </span>
                            </div>
                          </div>

                          {/* Control Console on Right Side */}
                          <div className="md:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between space-y-4">
                            <div className="space-y-4">
                              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5 text-teal-500" />
                                PACS Diagnostics
                              </h4>

                              {/* Interactivity tools */}
                              <div className="space-y-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Window & Level Presets</label>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      onClick={() => setWindowPreset('SOFT_TISSUE')}
                                      className={`text-[9px] font-semibold py-1 rounded border transition-colors ${
                                        windowPreset === 'SOFT_TISSUE'
                                          ? 'bg-teal-600 text-white border-teal-600'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      Soft Tissue
                                    </button>
                                    <button
                                      onClick={() => setWindowPreset('BRAIN_CT')}
                                      className={`text-[9px] font-semibold py-1 rounded border transition-colors ${
                                        windowPreset === 'BRAIN_CT'
                                          ? 'bg-teal-600 text-white border-teal-600'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      Brain (80/40)
                                    </button>
                                    <button
                                      onClick={() => setWindowPreset('LUNG_CT')}
                                      className={`text-[9px] font-semibold py-1 rounded border transition-colors ${
                                        windowPreset === 'LUNG_CT'
                                          ? 'bg-teal-600 text-white border-teal-600'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      Lung (-600/1500)
                                    </button>
                                    <button
                                      onClick={() => setWindowPreset('BONE_CT')}
                                      className={`text-[9px] font-semibold py-1 rounded border transition-colors ${
                                        windowPreset === 'BONE_CT'
                                          ? 'bg-teal-600 text-white border-teal-600'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      Bone (300/2000)
                                    </button>
                                  </div>
                                </div>

                                {/* Zoom and pan buttons */}
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Scale & Viewport</label>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                                      className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 p-1.5 rounded flex items-center justify-center gap-1 text-[10px] font-semibold"
                                    >
                                      <ZoomIn className="w-3 h-3" />
                                      Zoom +
                                    </button>
                                    <button
                                      onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                                      className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 p-1.5 rounded flex items-center justify-center gap-1 text-[10px] font-semibold"
                                    >
                                      <ZoomOut className="w-3 h-3" />
                                      Zoom -
                                    </button>
                                    <button
                                      onClick={() => {
                                        setZoom(1);
                                        setPan({ x: 0, y: 0 });
                                        setBrightness(1);
                                        setContrast(1);
                                        setIsInverted(false);
                                      }}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1.5 rounded text-[10px] font-bold"
                                      title="Reset View"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                </div>

                                {/* Slider controls */}
                                <div className="space-y-2 pt-1">
                                  <div>
                                    <div className="flex justify-between text-[9px] font-bold text-slate-400">
                                      <span>CONTRAST</span>
                                      <span>{contrast.toFixed(1)}x</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0.5}
                                      max={2.5}
                                      step={0.1}
                                      value={contrast}
                                      onChange={(e) => setContrast(parseFloat(e.target.value))}
                                      className="w-full accent-teal-600 bg-slate-200 h-1 rounded-lg appearance-none cursor-pointer"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[9px] font-bold text-slate-400">
                                      <span>BRIGHTNESS</span>
                                      <span>{brightness.toFixed(1)}x</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0.5}
                                      max={1.8}
                                      step={0.1}
                                      value={brightness}
                                      onChange={(e) => setBrightness(parseFloat(e.target.value))}
                                      className="w-full accent-teal-600 bg-slate-200 h-1 rounded-lg appearance-none cursor-pointer"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[10px] font-bold text-slate-500">Invert Palette</span>
                                  <button
                                    onClick={() => setIsInverted(!isInverted)}
                                    className={`text-[9px] font-semibold px-2 py-1 rounded border transition-colors ${
                                      isInverted ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {isInverted ? "ON" : "OFF"}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Forward path to report */}
                            <div className="pt-4 border-t border-slate-200 space-y-2">
                              <p className="text-[10px] text-slate-400">
                                Diagnosis inspection complete? Proceed to compile the official clinical radiology report.
                              </p>
                              <button
                                onClick={() => setActiveWorkspaceTab('report')}
                                className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                Compile Report
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>

                          </div>

                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* TAB 3: Radiology Diagnosis Report Editor / Approvals */}
                  {activeWorkspaceTab === 'report' && (
                    <motion.div
                      key="report-tab"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="space-y-6 flex-1 flex flex-col"
                    >
                      {/* Approved Report Lock Indicator */}
                      {reportStatus === 'APPROVED' && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            <div>
                              <h5 className="text-xs font-bold text-emerald-800">Final Signed & Approved Diagnostic Report</h5>
                              <p className="text-[10px] text-emerald-600">
                                This document was legally approved and locked against editing. Sign-off completed by <strong>{activeOrder.reports?.[0]?.signerName || 'Radiologist Advisor'}</strong>.
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right font-mono text-[9px] text-emerald-600">
                            <p>STAMP: CARE_VERIFIED</p>
                            <p>{activeOrder.reports?.[0]?.signedAt ? new Date(activeOrder.reports[0].signedAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                          </div>
                        </div>
                      )}

                      {/* AI Copilot Suggestion Bar */}
                      {reportStatus !== 'APPROVED' && isClinician && !isPatient && (
                        <div className="bg-teal-50 border border-teal-200 text-teal-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-teal-600 mt-0.5" />
                            <div>
                              <h5 className="text-xs font-bold text-teal-800">AI Radiology Copilot Available</h5>
                              <p className="text-[10px] text-teal-600 max-w-md">
                                Draft clinical Findings, diagnostic Impressions, and follow-up Recommendations using Gemini AI based on order indication details.
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={handleAiDraftReport}
                            disabled={aiDraftMutation.isPending}
                            className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-[10px] font-bold px-3.5 py-2 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                          >
                            {aiDraftMutation.isPending ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Drafting Report...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3" />
                                Auto-Draft with Gemini
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Main Report Body Form */}
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            1. Findings
                          </label>
                          {reportStatus === 'APPROVED' || !isClinician || isPatient ? (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap">
                              {reportFindings || "No clinical findings reported yet."}
                            </div>
                          ) : (
                            <textarea
                              rows={5}
                              value={reportFindings}
                              onChange={(e) => setReportFindings(e.target.value)}
                              placeholder="Describe your detailed anatomical and pathlogical findings of the scan slice volumes..."
                              className="w-full bg-slate-50 border border-slate-150 focus:border-teal-500 rounded-xl p-3 text-xs focus:outline-none transition-colors text-slate-700 font-sans"
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              2. Impression / Synthesis
                            </label>
                            {reportStatus === 'APPROVED' || !isClinician || isPatient ? (
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap">
                                {reportImpression || "No impression written."}
                              </div>
                            ) : (
                              <textarea
                                rows={4}
                                value={reportImpression}
                                onChange={(e) => setReportImpression(e.target.value)}
                                placeholder="Concisely summarize the core pathology and primary clinical conclusions..."
                                className="w-full bg-slate-50 border border-slate-150 focus:border-teal-500 rounded-xl p-3 text-xs focus:outline-none transition-colors text-slate-700 font-sans"
                              />
                            )}
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              3. Recommendations
                            </label>
                            {reportStatus === 'APPROVED' || !isClinician || isPatient ? (
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap">
                                {reportRecommendations || "No follow-up recommendations provided."}
                              </div>
                            ) : (
                              <textarea
                                rows={4}
                                value={reportRecommendations}
                                onChange={(e) => setReportRecommendations(e.target.value)}
                                placeholder="State follow-up imaging cycles, clinical correlation guidelines, or specialist consultations if required..."
                                className="w-full bg-slate-50 border border-slate-150 focus:border-teal-500 rounded-xl p-3 text-xs focus:outline-none transition-colors text-slate-700 font-sans"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sign-off Actions */}
                      {reportStatus !== 'APPROVED' && isClinician && !isPatient && (
                        <div className="pt-4 border-t border-slate-150 flex items-center justify-end gap-3">
                          <button
                            onClick={handleSaveReportDraft}
                            disabled={saveReportMutation.isPending}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                          >
                            Save Draft
                          </button>
                          
                          <button
                            onClick={handleFinalApprove}
                            disabled={approveReportMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            Sign-Off & Approve Report
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* MODAL 1: Create Imaging Order */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-slate-100"
          >
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Scan className="w-4 h-4 text-teal-600" />
                New Radiology Referral / Order
              </h3>
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOrderSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Patient Subject *</label>
                <select
                  required
                  value={orderPatientId}
                  onChange={(e) => setOrderPatientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-700"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (DOB: {p.dob}, Gender: {p.gender})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Modality *</label>
                  <select
                    value={orderModality}
                    onChange={(e) => setOrderModality(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-700"
                  >
                    <option value="MRI">MRI</option>
                    <option value="CT">CT Scan</option>
                    <option value="X-RAY">X-Ray</option>
                    <option value="ULTRASOUND">Ultrasound</option>
                    <option value="MAMMOGRAPHY">Mammography</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Body Region *</label>
                  <input
                    type="text"
                    required
                    value={orderBodyPart}
                    onChange={(e) => setOrderBodyPart(e.target.value)}
                    placeholder="e.g. Brain, Chest, Knee"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Priority *</label>
                  <select
                    value={orderPriority}
                    onChange={(e) => setOrderPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-700"
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STAT">STAT / Critical</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Referral Date</label>
                  <input
                    type="date"
                    value={new Date().toISOString().split('T')[0]}
                    disabled
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Reason for Order / Symptoms *</label>
                <textarea
                  required
                  rows={2}
                  value={orderReason}
                  onChange={(e) => setOrderReason(e.target.value)}
                  placeholder="e.g., Persistent localized headaches for 3 weeks, query space occupying lesion..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 rounded-xl p-2.5 text-xs focus:outline-none text-slate-700"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Additional Notes</label>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g., Patient is claustrophobic, pre-medication advised..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 rounded-xl p-2.5 text-xs focus:outline-none text-slate-700"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm cursor-pointer"
                >
                  {createOrderMutation.isPending ? "Submitting..." : "Generate Order"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: Simulate PACS Acquisition */}
      {isAcquireModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-slate-100"
          >
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-600" />
                Simulate PACS Image Acquisition
              </h3>
              <button
                onClick={() => setIsAcquireModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAcquisitionSubmit} className="p-6 space-y-4">
              <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100 text-[11px] text-teal-800 leading-relaxed space-y-1">
                <p className="font-bold">PACS Acquisition Modality Simulator</p>
                <p>This triggers a simulated DICOM slice stack upload to our imaging database. Selecting a category preset provides realistic radiological imagery for medical diagnostics review.</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Radiology Preset Slices *</label>
                <select
                  value={acquireModalityPreset}
                  onChange={(e) => setAcquireModalityPreset(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-700"
                >
                  <option value="BRAIN">Brain CT/MRI Axial Slices Stack</option>
                  <option value="CHEST">Chest X-Ray / CT Lung Slices Stack</option>
                  <option value="SPINE">Lumbar Spine MRI Sagittal Slices Stack</option>
                  <option value="KNEE">Knee Joint MRI Slices Stack</option>
                </select>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase">Or custom S3/Web link</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Single DICOM Image URL</label>
                <input
                  type="text"
                  value={acquireCustomUrl}
                  onChange={(e) => setAcquireCustomUrl(e.target.value)}
                  placeholder="https://example.com/custom_dicom_slice.png"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-700"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAcquireModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={acquireImageMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm cursor-pointer"
                >
                  {acquireImageMutation.isPending ? "Acquiring..." : "Trigger Acquisition"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
