import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Building2,
  FileSpreadsheet,
  FileCheck,
  ClipboardCheck,
  ChevronRight,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Clock,
  User,
  Paperclip,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  FileText,
  Upload,
  Download,
  Info,
  Check,
  X,
  RefreshCw,
  TrendingUp,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Interface Definitions
interface InsuranceCompany {
  id: string;
  name: string;
  code: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface InsurancePlan {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  code: string;
  type: 'HMO' | 'PPO' | 'EPO' | 'POS';
  copay: number;
  coinsurancePercent: number;
  deductible: number;
  coverageDetails: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface PatientInsurance {
  id: string;
  patientId: number;
  patientName: string;
  companyId: string;
  companyName: string;
  planId: string;
  planName: string;
  policyNumber: string;
  groupNumber: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'pending_verification';
  verifiedAt?: string;
  verifiedBy?: string;
  documents: { id: string; name: string; size: string; url: string; uploadedAt: string }[];
  createdAt: string;
}

interface ClaimDocument {
  id: string;
  name: string;
  size: string;
  url: string;
  uploadedAt: string;
}

interface ClaimWorkflowLog {
  status: string;
  changedBy: string;
  changedAt: string;
  notes: string;
}

interface Claim {
  id: string;
  claimNumber: string;
  patientId: number;
  patientName: string;
  policyId: string;
  policyNumber: string;
  companyId: string;
  companyName: string;
  planId: string;
  planName: string;
  invoiceId?: number;
  invoiceNumber?: string;
  treatmentDate: string;
  diagnosisCode: string;
  totalAmount: number;
  insuredAmount: number;
  patientAmount: number;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disputed';
  notes: string;
  submittedDate?: string;
  processedDate?: string;
  rejectionReason?: string;
  documents: ClaimDocument[];
  workflowHistory: ClaimWorkflowLog[];
  createdAt: string;
}

interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  date: string;
}

export default function Insurance() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const currentRole = profile?.role || 'patient';
  const isStaff = ['admin', 'doctor', 'receptionist'].includes(currentRole);

  // Layout states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'companies' | 'policies' | 'claims'>('dashboard');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form Modals states
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  // Edit / Form Inputs state
  const [editingCompany, setEditingCompany] = useState<InsuranceCompany | null>(null);
  const [editingPlan, setEditingPlan] = useState<InsurancePlan | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<PatientInsurance | null>(null);

  // Form Fields
  const [companyForm, setCompanyForm] = useState({
    name: '', code: '', contactPhone: '', contactEmail: '', address: '', status: 'active' as 'active' | 'inactive'
  });
  const [planForm, setPlanForm] = useState({
    companyId: '', name: '', code: '', type: 'PPO' as 'HMO' | 'PPO' | 'EPO' | 'POS', copay: 20, coinsurancePercent: 20, deductible: 500, coverageDetails: '', status: 'active' as 'active' | 'inactive'
  });
  const [policyForm, setPolicyForm] = useState({
    patientId: '', companyId: '', planId: '', policyNumber: '', groupNumber: '', startDate: '', endDate: '', status: 'pending_verification' as any
  });
  const [claimForm, setClaimForm] = useState({
    policyId: '', invoiceId: '', treatmentDate: '', diagnosisCode: '', totalAmount: 0, insuredAmount: 0, patientAmount: 0, notes: '', status: 'submitted' as any
  });
  const [workflowForm, setWorkflowForm] = useState({
    status: 'under_review' as any, notes: '', rejectionReason: '', approvedPayout: 0
  });

  // Simulated Document attachments
  const [customFileTitle, setCustomFileTitle] = useState('');

  // ----------------------------------------------------
  // TANSTACK QUERY QUERIES & MUTATIONS
  // ----------------------------------------------------
  const { data: companies = [], isLoading: loadingCompanies } = useQuery<InsuranceCompany[]>({
    queryKey: ['insurance-companies'],
    queryFn: async () => {
      const res = await fetch('/api/insurance/companies', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      return res.json();
    }
  });

  const { data: plans = [], isLoading: loadingPlans } = useQuery<InsurancePlan[]>({
    queryKey: ['insurance-plans'],
    queryFn: async () => {
      const res = await fetch('/api/insurance/plans', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      return res.json();
    }
  });

  const { data: policies = [], isLoading: loadingPolicies } = useQuery<PatientInsurance[]>({
    queryKey: ['insurance-policies'],
    queryFn: async () => {
      const res = await fetch('/api/insurance/policies', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      return res.json();
    }
  });

  const { data: claims = [], isLoading: loadingClaims } = useQuery<Claim[]>({
    queryKey: ['insurance-claims'],
    queryFn: async () => {
      const res = await fetch('/api/insurance/claims', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      return res.json();
    }
  });

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['insurance-patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isStaff
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['insurance-invoices'],
    queryFn: async () => {
      const res = await fetch('/api/invoices', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Mutations
  const companyMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!editingCompany;
      const url = isEdit ? `/api/insurance/companies/${editingCompany.id}` : '/api/insurance/companies';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error saving company');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-companies'] });
      setIsCompanyModalOpen(false);
      setEditingCompany(null);
    },
    onError: (err: any) => alert(err.message)
  });

  const planMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!editingPlan;
      const url = isEdit ? `/api/insurance/plans/${editingPlan.id}` : '/api/insurance/plans';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error saving plan');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-plans'] });
      setIsPlanModalOpen(false);
      setEditingPlan(null);
    },
    onError: (err: any) => alert(err.message)
  });

  const policyMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!editingPolicy;
      const url = isEdit ? `/api/insurance/policies/${editingPolicy.id}` : '/api/insurance/policies';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error saving policy');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
      setIsPolicyModalOpen(false);
      setEditingPolicy(null);
    },
    onError: (err: any) => alert(err.message)
  });

  const claimMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/insurance/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error saving claim');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      setIsClaimModalOpen(false);
    },
    onError: (err: any) => alert(err.message)
  });

  const updateClaimMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/insurance/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error updating claim workflow');
      }
      return res.json();
    },
    onSuccess: (updatedClaim) => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      setSelectedClaim(updatedClaim);
      setIsWorkflowModalOpen(false);
    },
    onError: (err: any) => alert(err.message)
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/insurance/companies/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete company');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insurance-companies'] }),
    onError: (err: any) => alert(err.message)
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/insurance/plans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete plan');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insurance-plans'] }),
    onError: (err: any) => alert(err.message)
  });

  // ----------------------------------------------------
  // EVENT HANDLERS
  // ----------------------------------------------------
  const handleOpenCompanyModal = (company: InsuranceCompany | null = null) => {
    if (company) {
      setEditingCompany(company);
      setCompanyForm({
        name: company.name,
        code: company.code,
        contactPhone: company.contactPhone,
        contactEmail: company.contactEmail,
        address: company.address,
        status: company.status
      });
    } else {
      setEditingCompany(null);
      setCompanyForm({ name: '', code: '', contactPhone: '', contactEmail: '', address: '', status: 'active' });
    }
    setIsCompanyModalOpen(true);
  };

  const handleOpenPlanModal = (plan: InsurancePlan | null = null) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        companyId: plan.companyId,
        name: plan.name,
        code: plan.code,
        type: plan.type,
        copay: plan.copay,
        coinsurancePercent: plan.coinsurancePercent,
        deductible: plan.deductible,
        coverageDetails: plan.coverageDetails,
        status: plan.status
      });
    } else {
      setEditingPlan(null);
      setPlanForm({
        companyId: companies[0]?.id || '',
        name: '',
        code: '',
        type: 'PPO',
        copay: 20,
        coinsurancePercent: 20,
        deductible: 500,
        coverageDetails: '',
        status: 'active'
      });
    }
    setIsPlanModalOpen(true);
  };

  const handleOpenPolicyModal = (policy: PatientInsurance | null = null) => {
    if (policy) {
      setEditingPolicy(policy);
      setPolicyForm({
        patientId: String(policy.patientId),
        companyId: policy.companyId,
        planId: policy.planId,
        policyNumber: policy.policyNumber,
        groupNumber: policy.groupNumber,
        startDate: policy.startDate,
        endDate: policy.endDate,
        status: policy.status
      });
    } else {
      setEditingPolicy(null);
      setPolicyForm({
        patientId: isStaff ? (patients[0]?.id ? String(patients[0].id) : '') : String(profile?.id || ''),
        companyId: companies[0]?.id || '',
        planId: plans[0]?.id || '',
        policyNumber: '',
        groupNumber: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: isStaff ? 'active' : 'pending_verification'
      });
    }
    setIsPolicyModalOpen(true);
  };

  const handleOpenClaimModal = () => {
    const userPolicies = policies.filter(p => p.patientId === (isStaff ? Number(policyForm.patientId) : profile?.id));
    setClaimForm({
      policyId: userPolicies[0]?.id || policies[0]?.id || '',
      invoiceId: invoices[0]?.id ? String(invoices[0].id) : '',
      treatmentDate: new Date().toISOString().split('T')[0],
      diagnosisCode: 'M25.561',
      totalAmount: 180,
      insuredAmount: 144,
      patientAmount: 36,
      notes: '',
      status: 'submitted'
    });
    setIsClaimModalOpen(true);
  };

  const handleOpenWorkflowModal = (claim: Claim) => {
    setWorkflowForm({
      status: 'under_review',
      notes: '',
      rejectionReason: '',
      approvedPayout: claim.totalAmount
    });
    setIsWorkflowModalOpen(true);
  };

  const submitCompany = (e: React.FormEvent) => {
    e.preventDefault();
    companyMutation.mutate(companyForm);
  };

  const submitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    planMutation.mutate(planForm);
  };

  const submitPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    policyMutation.mutate({
      ...policyForm,
      patientId: Number(policyForm.patientId),
      documents: []
    });
  };

  const submitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const linkedInvoice = invoices.find(inv => inv.id === Number(claimForm.invoiceId));
    claimMutation.mutate({
      ...claimForm,
      invoiceId: claimForm.invoiceId ? Number(claimForm.invoiceId) : undefined,
      invoiceNumber: linkedInvoice ? linkedInvoice.invoiceNumber : undefined,
      documents: []
    });
  };

  const handleWorkflowTransition = (claimId: string, customStatus?: string) => {
    const statusToUse = customStatus || workflowForm.status;
    const updateData: any = {
      status: statusToUse,
      notes: workflowForm.notes || `Claim transitioned to ${statusToUse}.`
    };

    if (statusToUse === 'approved') {
      updateData.insuredAmount = workflowForm.approvedPayout;
      updateData.patientAmount = Math.max(0, (selectedClaim?.totalAmount || 0) - workflowForm.approvedPayout);
    } else if (statusToUse === 'rejected') {
      updateData.rejectionReason = workflowForm.rejectionReason || 'Ineligible charges or policy coverage limits reached.';
      updateData.insuredAmount = 0;
      updateData.patientAmount = selectedClaim?.totalAmount || 0;
    }

    updateClaimMutation.mutate({ id: claimId, data: updateData });
  };

  // Document action simulators
  const handleSimulateAddDocumentToClaim = (claimId: string, name: string) => {
    if (!name.trim()) return;
    const currentDocs = selectedClaim?.documents || [];
    const newDoc = {
      id: `doc-${Date.now()}`,
      name: name.endsWith('.pdf') ? name : `${name}.pdf`,
      size: '1.4 MB',
      url: `/files/insurance_${Date.now()}.pdf`,
      uploadedAt: new Date().toLocaleDateString()
    };
    
    updateClaimMutation.mutate({
      id: claimId,
      data: {
        documents: [...currentDocs, newDoc],
        notes: `Document '${newDoc.name}' attached to claim dossier.`
      }
    });
    setCustomFileTitle('');
  };

  const handleSimulateAddDocumentToPolicy = (policyId: string, name: string) => {
    if (!name.trim()) return;
    const policy = policies.find(p => p.id === policyId);
    if (!policy) return;

    const currentDocs = policy.documents || [];
    const newDoc = {
      id: `doc-${Date.now()}`,
      name: name.endsWith('.pdf') ? name : `${name}.pdf`,
      size: '2.1 MB',
      url: `/files/policy_${Date.now()}.pdf`,
      uploadedAt: new Date().toLocaleDateString()
    };

    policyMutation.mutate({
      id: policyId,
      documents: [...currentDocs, newDoc]
    });
    setCustomFileTitle('');
  };

  // Calculations for stats
  const activePoliciesCount = policies.filter(p => p.status === 'active').length;
  const submittedClaims = claims.filter(c => c.status === 'submitted');
  const reviewClaims = claims.filter(c => c.status === 'under_review');
  const approvedClaims = claims.filter(c => c.status === 'approved');
  const rejectedClaims = claims.filter(c => c.status === 'rejected');
  const disputedClaims = claims.filter(c => c.status === 'disputed');

  const totalPayout = approvedClaims.reduce((sum, c) => sum + c.insuredAmount, 0);

  // Recharts Chart configurations
  const claimsByStatusData = [
    { name: 'Submitted', count: submittedClaims.length, fill: '#f59e0b' },
    { name: 'Under Review', count: reviewClaims.length, fill: '#3b82f6' },
    { name: 'Approved', count: approvedClaims.length, fill: '#10b981' },
    { name: 'Rejected', count: rejectedClaims.length, fill: '#ef4444' },
    { name: 'Disputed', count: disputedClaims.length, fill: '#8b5cf6' }
  ];

  const claimsFinancialOverview = [
    { name: 'Total Claims', amount: claims.reduce((s, c) => s + c.totalAmount, 0) },
    { name: 'Insured Coverage Payouts', amount: totalPayout },
    { name: 'Patient Out-of-Pocket Liability', amount: claims.reduce((s, c) => s + c.patientAmount, 0) }
  ];

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6 bg-slate-50/50">
      
      {/* Insurance Suite Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-display font-bold text-slate-800 tracking-tight">
              Insurance & Payer Management Suite
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Configure payers, enroll patients in medical policies, submit claims, monitor real-time review workflows, and catalog supporting clinical documentation.
          </p>
        </div>

        {/* Global actions bar */}
        <div className="flex items-center gap-2">
          {isStaff && (
            <>
              <button
                onClick={() => handleOpenCompanyModal()}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                <span>Add Payer Company</span>
              </button>
              <button
                onClick={() => handleOpenPlanModal()}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Create Insurance Plan</span>
              </button>
            </>
          )}

          <button
            onClick={() => handleOpenPolicyModal()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Enroll Policy</span>
          </button>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-px">
        {[
          { id: 'dashboard', name: 'Dashboard Analytics', icon: Activity },
          { id: 'companies', name: 'Payers & Catalog', icon: Building2 },
          { id: 'policies', name: 'Patient Enrolments', icon: ClipboardCheck },
          { id: 'claims', name: 'Claims Center', icon: FileCheck }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedClaim(null);
              }}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                isActive 
                  ? 'border-emerald-500 text-emerald-600 font-extrabold' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN CONTAINER TABS ROUTING */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* Executive Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { title: 'Enrolled Policies', val: activePoliciesCount, suffix: 'Active', icon: ShieldCheck, color: 'text-emerald-500 bg-emerald-50' },
              { title: 'Awaiting Action', val: submittedClaims.length + reviewClaims.length, suffix: 'Claims', icon: Clock, color: 'text-amber-500 bg-amber-50' },
              { title: 'Total Paid Out', val: `$${totalPayout.toLocaleString()}`, suffix: 'Approved Payouts', icon: DollarSign, color: 'text-teal-500 bg-teal-50' },
              { title: 'Payer Denial Rate', val: claims.length ? `${Math.round((rejectedClaims.length / claims.length) * 100)}%` : '0%', suffix: 'Total claims processed', icon: ShieldAlert, color: 'text-rose-500 bg-rose-50' }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-slate-150/70 shadow-sm flex items-center justify-between">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">{stat.title}</span>
                  <p className="text-2xl font-bold text-slate-800 font-mono">{stat.val}</p>
                  <span className="text-[10px] text-slate-400 font-medium block">{stat.suffix}</span>
                </div>
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Claims Status Pie Chart */}
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="border-b border-slate-50 pb-3 mb-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Claims Processing Statuses</h3>
                <p className="text-[10px] text-slate-400">Review status distribution of filed claims</p>
              </div>

              <div className="h-60 flex items-center justify-center">
                {claims.length === 0 ? (
                  <p className="text-xs text-slate-400">No claim transactions filed</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={claimsByStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {claimsByStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Status legends custom */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {claimsByStatusData.map((stat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stat.fill }}></span>
                    <span className="text-[10px] font-semibold text-slate-500 font-sans">{stat.name} ({stat.count})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Claims Summary Bar Chart */}
            <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="border-b border-slate-50 pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Clinical Claims Financial Overview</h3>
                  <p className="text-[10px] text-slate-400">Analysis of payer coverage, payouts, and personal patient liability</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Real-time Analytics</span>
                </span>
              </div>

              <div className="h-64">
                {claims.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-20">No financial statistics to display yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={claimsFinancialOverview} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                      <Bar dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Quick Informative Clinical Workflow Card */}
          <div className="bg-slate-800 p-6 rounded-3xl text-white relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
            <div className="space-y-1 z-10 max-w-xl">
              <h3 className="font-display font-bold text-sm text-teal-300 uppercase tracking-wider">How Clinical Claims and Co-pays work</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                When a patient is registered under an active Insurance Plan, their consultations and treatment invoices are evaluated. A claim dossier is drafted detailing the diagnosis code (ICD-10). The system computes the expected insurance reimbursement based on the plan's copay and coinsurance percentage, while leaving the remainder as patient liability.
              </p>
            </div>
            <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-2xl shrink-0 z-10 text-center text-xs">
              <p className="font-mono text-emerald-400 font-bold">Standard Formula</p>
              <p className="text-[10px] text-slate-300 mt-1">Claim Payout = (Total Invoiced - Copay) * (1 - Coinsurance%)</p>
            </div>
          </div>

        </div>
      )}

      {/* PAYERS & PLANS DIRECTORY TAB */}
      {activeTab === 'companies' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Insurance Payers catalog list */}
          <div className="xl:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Active Insurance Carriers</h3>
                <p className="text-[10px] text-slate-400">Total configured carriers: {companies.length}</p>
              </div>
            </div>

            {companies.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-400">No carriers registered in the clinic catalog.</p>
            ) : (
              <div className="space-y-3">
                {companies.map(company => (
                  <div key={company.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                          <Building2 className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-700">{company.name}</h4>
                          <span className="text-[9px] text-slate-400 font-mono font-bold block">{company.code}</span>
                        </div>
                      </div>

                      <div className="space-y-0.5 text-[10px] text-slate-500 font-medium">
                        <p>📞 Phone: {company.contactPhone}</p>
                        <p>✉️ Email: {company.contactEmail}</p>
                        <p className="truncate max-w-[200px]">📍 Address: {company.address}</p>
                      </div>
                    </div>

                    {isStaff && (
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase ${
                          company.status === 'active' ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {company.status}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenCompanyModal(company)}
                            className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => {
                              if (confirm('Delete payer company?')) deleteCompanyMutation.mutate(company.id);
                            }}
                            className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Insurance Plans list */}
          <div className="xl:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Insurance Plans Catalog</h3>
                <p className="text-[10px] text-slate-400">Pre-negotiated copays, deductibles, and benefits details</p>
              </div>
            </div>

            {plans.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-400">No plans registered. Please add a plan.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map(plan => (
                  <div key={plan.id} className="p-4 bg-slate-50/50 border border-slate-150/70 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">{plan.companyName}</span>
                          <h4 className="text-xs font-bold text-slate-700 leading-snug">{plan.name}</h4>
                          <span className="text-[9px] text-emerald-600 font-mono font-bold">{plan.code}</span>
                        </div>
                        <span className="bg-slate-800 text-white font-mono text-[8px] px-2 py-0.5 rounded font-extrabold uppercase">
                          {plan.type}
                        </span>
                      </div>

                      {/* Benefits & coverage stats */}
                      <div className="bg-white p-3 rounded-xl border border-slate-100 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <span className="text-[8px] text-slate-400 uppercase font-bold block">Copay</span>
                          <span className="text-xs font-bold text-slate-700 font-mono">${plan.copay}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 uppercase font-bold block">Coinsurance</span>
                          <span className="text-xs font-bold text-slate-700 font-mono">{plan.coinsurancePercent}%</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-400 uppercase font-bold block">Deductible</span>
                          <span className="text-xs font-bold text-slate-700 font-mono">${plan.deductible}</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">
                        💡 {plan.coverageDetails}
                      </p>
                    </div>

                    {isStaff && (
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                          plan.status === 'active' ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {plan.status}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenPlanModal(plan)}
                            className="text-blue-600 font-bold hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this plan?')) deletePlanMutation.mutate(plan.id);
                            }}
                            className="text-rose-500 font-bold hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* PATIENT INSURANCE POLICIES TAB */}
      {activeTab === 'policies' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Patient Enrolled Insurance Policies</h3>
              <p className="text-[10px] text-slate-400">Catalog of medical policies, policy status, validation dates, and uploaded physical card images</p>
            </div>

            {/* Simple search bar */}
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient, carrier or plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {policies.length === 0 ? (
            <p className="text-center py-12 text-xs text-slate-400">No patient insurance policies found. Please click Enroll Policy to start.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {policies
                .filter(p => {
                  const query = searchQuery.toLowerCase();
                  return p.patientName.toLowerCase().includes(query) ||
                         p.companyName.toLowerCase().includes(query) ||
                         p.planName.toLowerCase().includes(query) ||
                         p.policyNumber.toLowerCase().includes(query);
                })
                .map(policy => (
                  <div key={policy.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      {/* Patient and verification banner */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[8px] text-slate-400 uppercase font-bold font-mono">Patient Enrollment</span>
                          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>{policy.patientName}</span>
                          </h4>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase ${
                          policy.status === 'active' 
                            ? 'bg-teal-50 text-teal-600' 
                            : policy.status === 'expired' 
                            ? 'bg-rose-50 text-rose-600' 
                            : 'bg-amber-50 text-amber-600'
                        }`}>
                          {policy.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Insurance Plan card look */}
                      <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1.5">
                        <span className="text-[8px] text-emerald-600 uppercase font-bold tracking-wider font-mono">{policy.companyName}</span>
                        <h5 className="text-xs font-bold text-slate-700">{policy.planName}</h5>
                        
                        <div className="grid grid-cols-2 gap-2 text-[9px] pt-1.5 border-t border-slate-50 font-medium text-slate-500 font-mono">
                          <p>Policy: <span className="text-slate-700 font-bold">{policy.policyNumber}</span></p>
                          <p>Group: <span className="text-slate-700 font-bold">{policy.groupNumber}</span></p>
                          <p>Start: <span className="text-slate-700 font-bold">{policy.startDate}</span></p>
                          <p>End: <span className="text-slate-700 font-bold">{policy.endDate}</span></p>
                        </div>
                      </div>

                      {/* Supporting Documents section */}
                      <div className="space-y-1 bg-white/40 p-2.5 rounded-xl border border-slate-150/70">
                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Policy Documents ({policy.documents?.length || 0})</span>
                        {policy.documents && policy.documents.length > 0 ? (
                          <div className="space-y-1.5">
                            {policy.documents.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between gap-2 p-1.5 bg-white border border-slate-100 rounded-lg text-[9px]">
                                <span className="truncate max-w-[150px] font-semibold text-slate-600">{doc.name}</span>
                                <a
                                  href={doc.url}
                                  onClick={(e) => { e.preventDefault(); alert(`Downloading card/coverage document: ${doc.name}`); }}
                                  className="text-teal-600 hover:underline flex items-center gap-0.5 font-bold"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[9px] text-slate-400 italic">No supporting document or card scan attached</p>
                        )}

                        {/* Document attach trigger */}
                        <div className="flex gap-1.5 pt-2">
                          <input
                            type="text"
                            placeholder="Add card scan (e.g. Card_Front.jpg)"
                            value={customFileTitle}
                            onChange={(e) => setCustomFileTitle(e.target.value)}
                            className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] focus:outline-none"
                          />
                          <button
                            onClick={() => handleSimulateAddDocumentToPolicy(policy.id, customFileTitle)}
                            className="bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Policy verification clinical trigger */}
                    {isStaff && policy.status === 'pending_verification' && (
                      <button
                        onClick={() => {
                          if (confirm('Verify and activate this insurance policy?')) {
                            policyMutation.mutate({
                              id: policy.id,
                              status: 'active',
                              verifiedAt: new Date().toISOString()
                            } as any);
                          }
                        }}
                        className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Approve & Verify Policy</span>
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* CLAIMS CENTER TAB */}
      {activeTab === 'claims' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch h-[80vh]">
          
          {/* Left Claims List (Span 7) */}
          <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
            
            <div className="p-6 border-b border-slate-50 space-y-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Claims Directory</h3>
                <p className="text-[10px] text-slate-400">Evaluate status transitions, diagnosis coding, and payouts</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenClaimModal}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 text-[10px] font-bold rounded-xl cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>File Claim</span>
                </button>
              </div>
            </div>

            {/* Claims Table / List container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {claims.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FileCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold">No claim requests registered</p>
                  <p className="text-[10px] text-slate-400 max-w-xs mx-auto mt-1">Submit your first claim dossier linked to patient treatments and payer benefits.</p>
                </div>
              ) : (
                claims.map(claim => {
                  const isSelected = selectedClaim?.id === claim.id;
                  return (
                    <div
                      key={claim.id}
                      onClick={() => setSelectedClaim(claim)}
                      className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isSelected 
                          ? 'bg-emerald-50/50 border-emerald-300 shadow-sm' 
                          : 'bg-slate-50/70 hover:bg-slate-100 border-slate-150/70'
                      }`}
                    >
                      <div className="space-y-1.5 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-700 font-mono">{claim.claimNumber}</span>
                          <span className="text-slate-300 font-mono text-[9px]">|</span>
                          <span className="text-[9px] text-slate-400 font-semibold font-mono">{claim.treatmentDate}</span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>{claim.patientName}</span>
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium truncate max-w-[280px]">
                            Carrier: {claim.companyName} • {claim.planName}
                          </p>
                        </div>
                      </div>

                      {/* Claim Payout and status badge */}
                      <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                        <div className="text-right font-mono space-y-0.5">
                          <p className="text-xs font-bold text-slate-700">Total: ${claim.totalAmount}</p>
                          <p className="text-[9px] text-emerald-600 font-semibold">Payer: ${claim.insuredAmount}</p>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase ${
                          claim.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-600'
                            : claim.status === 'rejected'
                            ? 'bg-rose-50 text-rose-600'
                            : claim.status === 'under_review'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}>
                          {claim.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Right Claim evaluation detail panel (Span 5) */}
          <div className="xl:col-span-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
            {selectedClaim ? (
              <div className="flex flex-col h-full overflow-hidden">
                
                {/* Header detail */}
                <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between gap-3 shrink-0">
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-emerald-600 uppercase font-bold font-mono tracking-wider">Active Evaluation Dossier</span>
                    <h3 className="text-xs font-bold text-slate-800">{selectedClaim.claimNumber}</h3>
                  </div>

                  {isStaff && (
                    <button
                      onClick={() => handleOpenWorkflowModal(selectedClaim)}
                      className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Workflow Actions</span>
                    </button>
                  )}
                </div>

                {/* Detail content scrollbox */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  
                  {/* Payer policy specifications */}
                  <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl space-y-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Linked Policy & Carrier</span>
                    
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700">{selectedClaim.companyName}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{selectedClaim.planName}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[10px] pt-2 border-t border-slate-50 font-medium font-mono text-slate-500">
                      <p>Policy #: <span className="text-slate-800 font-bold">{selectedClaim.policyNumber}</span></p>
                      <p>ICD-10 Code: <span className="text-slate-800 font-bold">{selectedClaim.diagnosisCode}</span></p>
                      {selectedClaim.invoiceNumber && (
                        <p>Invoice #: <span className="text-slate-800 font-bold">{selectedClaim.invoiceNumber}</span></p>
                      )}
                    </div>
                  </div>

                  {/* Financial Evaluation Breakdown Card */}
                  <div className="bg-emerald-50/30 border border-emerald-100/50 p-4 rounded-2xl space-y-3">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest block">Reimbursement Evaluation</span>
                    
                    <div className="space-y-2 font-mono text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span>Total Filed Charge</span>
                        <span className="font-bold text-slate-800">${selectedClaim.totalAmount}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Expected Payer Coverage</span>
                        <span>-${selectedClaim.insuredAmount}</span>
                      </div>
                      <div className="flex justify-between border-t border-emerald-100/60 pt-2 text-slate-800 font-bold text-xs">
                        <span>Patient Copay & Deductible</span>
                        <span>${selectedClaim.patientAmount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Claim Dossier files */}
                  <div className="space-y-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Supporting Dossier Documents</span>
                    
                    {selectedClaim.documents && selectedClaim.documents.length > 0 ? (
                      <div className="space-y-2">
                        {selectedClaim.documents.map(doc => (
                          <div key={doc.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-3 shadow-sm text-[10px]">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                              <div className="overflow-hidden">
                                <span className="font-bold text-slate-700 block truncate">{doc.name}</span>
                                <span className="text-[8px] text-slate-400 block font-mono">Uploaded: {doc.uploadedAt}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => alert(`Simulating playback or download of file: ${doc.name}`)}
                              className="p-1 bg-white hover:bg-slate-50 border border-slate-100 text-slate-500 rounded-lg cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-teal-600" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No supporting document or medical records attached to this claim folder.</p>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Attach clinical SOAP note (e.g. Visit_Note.pdf)"
                        value={customFileTitle}
                        onChange={(e) => setCustomFileTitle(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] placeholder-slate-400 focus:outline-none"
                      />
                      <button
                        onClick={() => handleSimulateAddDocumentToClaim(selectedClaim.id, customFileTitle)}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold"
                      >
                        Attach File
                      </button>
                    </div>
                  </div>

                  {/* Claims audit log */}
                  <div className="space-y-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Workflow Timeline & Audit Logs</span>
                    
                    <div className="space-y-3 border-l-2 border-slate-100 pl-4 ml-1">
                      {selectedClaim.workflowHistory?.map((log, i) => (
                        <div key={i} className="relative space-y-1 text-[10px]">
                          <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-200 border-2 border-white"></span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700 capitalize font-mono text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">
                              {log.status.replace('_', ' ')}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold font-mono">by {log.changedBy} at {new Date(log.changedAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-slate-500 font-medium leading-relaxed">✏️ {log.notes}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              <div className="text-center py-24 text-slate-400 space-y-2">
                <Shield className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-bold">No Claim Selected</p>
                <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto">Select a claim from the directory to review diagnostics, payouts, workflow transitions, and attached documents.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ==================== FORM MODAL OVERLAYS ==================== */}
      <AnimatePresence>
        
        {/* Company Modal */}
        {isCompanyModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-display font-bold text-slate-800 text-sm">
                  {editingCompany ? 'Modify Insurance Company' : 'Register New Carrier'}
                </h3>
                <button onClick={() => setIsCompanyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={submitCompany} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Company Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aetna"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Carrier Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AETNA"
                      value={companyForm.code}
                      onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Contact Phone</label>
                    <input
                      type="text"
                      required
                      placeholder="1-800-..."
                      value={companyForm.contactPhone}
                      onChange={(e) => setCompanyForm({ ...companyForm, contactPhone: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Contact Email</label>
                    <input
                      type="email"
                      required
                      placeholder="claims@..."
                      value={companyForm.contactEmail}
                      onChange={(e) => setCompanyForm({ ...companyForm, contactEmail: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Corporate Address</label>
                  <input
                    type="text"
                    required
                    placeholder="123 Corporate Way"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Status</label>
                  <select
                    value={companyForm.status}
                    onChange={(e) => setCompanyForm({ ...companyForm, status: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={companyMutation.isPending}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  {companyMutation.isPending ? 'Saving...' : 'Register Company'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Plan Modal */}
        {isPlanModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-display font-bold text-slate-800 text-sm">
                  {editingPlan ? 'Edit Insurance Plan' : 'Define Insurance Plan Benefits'}
                </h3>
                <button onClick={() => setIsPlanModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={submitPlan} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Payer Company</label>
                  <select
                    value={planForm.companyId}
                    onChange={(e) => setPlanForm({ ...planForm, companyId: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Plan Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. HMO Gold Preferred"
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Plan Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. HMO-GLD"
                      value={planForm.code}
                      onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1 col-span-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Type</label>
                    <select
                      value={planForm.type}
                      onChange={(e) => setPlanForm({ ...planForm, type: e.target.value as any })}
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    >
                      <option value="HMO">HMO</option>
                      <option value="PPO">PPO</option>
                      <option value="EPO">EPO</option>
                      <option value="POS">POS</option>
                    </select>
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Copay ($)</label>
                    <input
                      type="number"
                      required
                      value={planForm.copay}
                      onChange={(e) => setPlanForm({ ...planForm, copay: Number(e.target.value) })}
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Coins %</label>
                    <input
                      type="number"
                      required
                      value={planForm.coinsurancePercent}
                      onChange={(e) => setPlanForm({ ...planForm, coinsurancePercent: Number(e.target.value) })}
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Deductible ($)</label>
                    <input
                      type="number"
                      required
                      value={planForm.deductible}
                      onChange={(e) => setPlanForm({ ...planForm, deductible: Number(e.target.value) })}
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Coverage details / Benefits list</label>
                  <textarea
                    rows={3}
                    placeholder="Provide details on specialized diagnostics coverage, specialist consult referrals rules..."
                    value={planForm.coverageDetails}
                    onChange={(e) => setPlanForm({ ...planForm, coverageDetails: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={planMutation.isPending}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  {planMutation.isPending ? 'Saving...' : 'Define Plan'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Policy Modal */}
        {isPolicyModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-display font-bold text-slate-800 text-sm">
                  Enroll Patient Policy Cover
                </h3>
                <button onClick={() => setIsPolicyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={submitPolicy} className="p-6 space-y-4">
                {isStaff && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Select Patient Profile</label>
                    <select
                      value={policyForm.patientId}
                      onChange={(e) => setPolicyForm({ ...policyForm, patientId: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    >
                      {patients.map(pat => (
                        <option key={pat.id} value={pat.id}>{pat.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Carrier Company</label>
                    <select
                      value={policyForm.companyId}
                      onChange={(e) => {
                        const compId = e.target.value;
                        const matchedPlan = plans.find(p => p.companyId === compId);
                        setPolicyForm({ ...policyForm, companyId: compId, planId: matchedPlan ? matchedPlan.id : '' });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    >
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Benefits Plan</label>
                    <select
                      value={policyForm.planId}
                      onChange={(e) => setPolicyForm({ ...policyForm, planId: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    >
                      {plans
                        .filter(p => p.companyId === policyForm.companyId)
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Policy Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. POL-981242"
                      value={policyForm.policyNumber}
                      onChange={(e) => setPolicyForm({ ...policyForm, policyNumber: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Group Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GRP-2495"
                      value={policyForm.groupNumber}
                      onChange={(e) => setPolicyForm({ ...policyForm, groupNumber: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Effective Date</label>
                    <input
                      type="date"
                      required
                      value={policyForm.startDate}
                      onChange={(e) => setPolicyForm({ ...policyForm, startDate: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Expiry Date</label>
                    <input
                      type="date"
                      required
                      value={policyForm.endDate}
                      onChange={(e) => setPolicyForm({ ...policyForm, endDate: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={policyMutation.isPending}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  {policyMutation.isPending ? 'Processing...' : 'Enroll Active Policy'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Claim Filing Modal */}
        {isClaimModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-display font-bold text-slate-800 text-sm">
                  Filing Medical Insurance Claim
                </h3>
                <button onClick={() => setIsClaimModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={submitClaim} className="p-6 space-y-4">
                
                {/* Linked Patient Policy */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Select Enrolled Policy Cover</label>
                  <select
                    value={claimForm.policyId}
                    onChange={(e) => {
                      const polId = e.target.value;
                      const policySelected = policies.find(p => p.id === polId);
                      const planSelected = plans.find(p => p.id === policySelected?.planId);
                      
                      // Auto calculate expected values based on selected plan copay
                      const total = claimForm.totalAmount;
                      const copay = planSelected ? planSelected.copay : 20;
                      const coinsPercent = planSelected ? planSelected.coinsurancePercent : 20;
                      
                      const insuredAmt = Math.max(0, (total - copay) * (1 - coinsPercent / 100));
                      const patientAmt = total - insuredAmt;

                      setClaimForm({
                        ...claimForm,
                        policyId: polId,
                        insuredAmount: Number(insuredAmt.toFixed(1)),
                        patientAmount: Number(patientAmt.toFixed(1))
                      });
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  >
                    {policies.map(p => (
                      <option key={p.id} value={p.id}>{p.patientName} - {p.companyName} ({p.policyNumber})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Linked Treatment Invoice */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Reference Treatment Invoice</label>
                    <select
                      value={claimForm.invoiceId}
                      onChange={(e) => {
                        const invId = e.target.value;
                        const linkedInvoice = invoices.find(inv => inv.id === Number(invId));
                        const total = linkedInvoice ? linkedInvoice.totalAmount : 180;
                        
                        const policySelected = policies.find(p => p.id === claimForm.policyId);
                        const planSelected = plans.find(p => p.id === policySelected?.planId);
                        const copay = planSelected ? planSelected.copay : 20;
                        const coinsPercent = planSelected ? planSelected.coinsurancePercent : 20;
                        
                        const insuredAmt = Math.max(0, (total - copay) * (1 - coinsPercent / 100));
                        const patientAmt = total - insuredAmt;

                        setClaimForm({
                          ...claimForm,
                          invoiceId: invId,
                          totalAmount: total,
                          insuredAmount: Number(insuredAmt.toFixed(1)),
                          patientAmount: Number(patientAmt.toFixed(1))
                        });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    >
                      <option value="">No Linked Invoice</option>
                      {invoices.map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.invoiceNumber} (${inv.totalAmount})</option>
                      ))}
                    </select>
                  </div>

                  {/* Diagnosis ICD-10 */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Diagnosis Code (ICD-10)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. I10 (Hypertension)"
                      value={claimForm.diagnosisCode}
                      onChange={(e) => setClaimForm({ ...claimForm, diagnosisCode: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Treatment date */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Treatment Date</label>
                  <input
                    type="date"
                    required
                    value={claimForm.treatmentDate}
                    onChange={(e) => setClaimForm({ ...claimForm, treatmentDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  />
                </div>

                {/* Costs details */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400 block">Total Invoiced ($)</label>
                    <input
                      type="number"
                      required
                      value={claimForm.totalAmount}
                      onChange={(e) => {
                        const total = Number(e.target.value);
                        const policySelected = policies.find(p => p.id === claimForm.policyId);
                        const planSelected = plans.find(p => p.id === policySelected?.planId);
                        const copay = planSelected ? planSelected.copay : 20;
                        const coinsPercent = planSelected ? planSelected.coinsurancePercent : 20;
                        
                        const insuredAmt = Math.max(0, (total - copay) * (1 - coinsPercent / 100));
                        const patientAmt = total - insuredAmt;

                        setClaimForm({
                          ...claimForm,
                          totalAmount: total,
                          insuredAmount: Number(insuredAmt.toFixed(1)),
                          patientAmount: Number(patientAmt.toFixed(1))
                        });
                      }}
                      className="w-full bg-white px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400 block">Payer Share ($)</label>
                    <input
                      type="number"
                      required
                      value={claimForm.insuredAmount}
                      onChange={(e) => setClaimForm({ ...claimForm, insuredAmount: Number(e.target.value) })}
                      className="w-full bg-white px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400 block">Patient Share ($)</label>
                    <input
                      type="number"
                      required
                      value={claimForm.patientAmount}
                      onChange={(e) => setClaimForm({ ...claimForm, patientAmount: Number(e.target.value) })}
                      className="w-full bg-white px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Additional draft notes */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Diagnosis Details / Medical Necessity Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Provide diagnostic context, laboratory reports summaries to expedite claim processing..."
                    value={claimForm.notes}
                    onChange={(e) => setClaimForm({ ...claimForm, notes: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={claimMutation.isPending}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  {claimMutation.isPending ? 'Filing dossier...' : 'Submit Claim Dossier'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Workflow Approval Transition Modal */}
        {isWorkflowModalOpen && selectedClaim && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-display font-bold text-slate-800 text-sm">
                  Clinical Claim Workflow Controls
                </h3>
                <button onClick={() => setIsWorkflowModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                
                {/* Select transition target status */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Action Transition</label>
                  <select
                    value={workflowForm.status}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, status: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-bold"
                  >
                    <option value="under_review">🔬 Put Under Review</option>
                    <option value="approved">✅ Approve Reimbursement</option>
                    <option value="rejected">❌ Deny / Reject Claim</option>
                    <option value="disputed">⚠️ Dispute Claim</option>
                  </select>
                </div>

                {/* Conditionally show rejection reason input */}
                {workflowForm.status === 'rejected' && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-rose-500">Rejection Code / Denial Reason</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Out of network laboratory service"
                      value={workflowForm.rejectionReason}
                      onChange={(e) => setWorkflowForm({ ...workflowForm, rejectionReason: e.target.value })}
                      className="w-full px-3.5 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 placeholder-rose-400 focus:outline-none"
                    />
                  </div>
                )}

                {/* Conditionally show approved payout adjust */}
                {workflowForm.status === 'approved' && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-emerald-600">Approved Reimbursement Amount ($)</label>
                    <input
                      type="number"
                      required
                      value={workflowForm.approvedPayout}
                      onChange={(e) => setWorkflowForm({ ...workflowForm, approvedPayout: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-mono font-bold focus:outline-none"
                    />
                  </div>
                )}

                {/* Workflow memo */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Audit Trail Memo / Comments</label>
                  <textarea
                    rows={3}
                    placeholder="Explain reasons for this transition to log permanently in the audit history..."
                    value={workflowForm.notes}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, notes: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none resize-none"
                  />
                </div>

                <button
                  onClick={() => handleWorkflowTransition(selectedClaim.id)}
                  disabled={updateClaimMutation.isPending}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  {updateClaimMutation.isPending ? 'Transitioning...' : 'Transition Claim Status'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>

    </div>
  );
}
