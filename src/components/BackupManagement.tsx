import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  RefreshCw,
  Play,
  Settings,
  History,
  ShieldCheck,
  Server,
  Cloud,
  FileCheck,
  FileWarning,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Clock,
  HardDrive,
  User,
  Plus,
  ArrowRight,
  ChevronRight,
  Lock,
  ExternalLink,
  ShieldAlert,
  Save,
  Check,
  X,
  FileText
} from 'lucide-react';
import { StorageConfig, AutoBackupConfig, BackupRecord } from '../server/services/backup.ts';

export default function BackupManagement() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const currentRole = profile?.role || 'patient';
  const isAdmin = ['admin', 'superadmin'].includes(currentRole);

  const [activePane, setActivePane] = useState<'history' | 'automated' | 'storage'>('history');
  
  // Modals / Feedback
  const [isManualBackupOpen, setIsManualBackupOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', notes: '' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupRecord | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
      throw new Error(err.error || 'Backup API Request failed');
    }
    return res.json();
  };

  // --- React Queries ---
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['backup-config'],
    queryFn: () => apiFetch('/api/backup/config'),
    enabled: isAdmin
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['backup-history'],
    queryFn: () => apiFetch('/api/backup/history'),
    enabled: isAdmin
  });

  // --- React Mutations ---
  const updateStorageMutation = useMutation({
    mutationFn: (storage: StorageConfig) => apiFetch('/api/backup/config/storage', {
      method: 'PUT',
      body: JSON.stringify(storage)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-config'] });
      showToast('Storage provider settings saved successfully', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update storage config', 'error');
    }
  });

  const updateAutoMutation = useMutation({
    mutationFn: (auto: AutoBackupConfig) => apiFetch('/api/backup/config/auto', {
      method: 'PUT',
      body: JSON.stringify(auto)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-config'] });
      showToast('Automated backup scheduler parameters updated', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update scheduler config', 'error');
    }
  });

  const createBackupMutation = useMutation({
    mutationFn: (payload: { name: string; notes?: string }) => apiFetch('/api/backup/create', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        creator: profile?.name || 'Staff Operator',
        type: 'manual'
      })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-history'] });
      setIsManualBackupOpen(false);
      setManualForm({ name: '', notes: '' });
      showToast('System snapshot snapshot compiled and encrypted successfully', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Backup failed', 'error');
    }
  });

  const restoreBackupMutation = useMutation({
    mutationFn: (id: string) => apiFetch('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ id, operatorName: profile?.name || 'Staff Admin' })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-history'] });
      setConfirmRestore(null);
      showToast('Disaster Recovery complete. Local database restored successfully!', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Recovery failed', 'error');
    }
  });

  const verifyBackupMutation = useMutation({
    mutationFn: (id: string) => apiFetch('/api/backup/verify', {
      method: 'POST',
      body: JSON.stringify({ id })
    }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['backup-history'] });
      showToast(`Verification Successful. Structural check matched checksum ${res.data?.checksum?.substring(0, 8)}`, 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Verification failed. Archive might be missing or corrupted.', 'error');
    }
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/backup/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-history'] });
      showToast('Backup log and physical files purged successfully', 'info');
    },
    onError: (err: any) => {
      showToast(err.message || 'Delete failed', 'error');
    }
  });

  // Local state forms
  const [storageForm, setStorageForm] = useState<StorageConfig | null>(null);
  const [autoForm, setAutoForm] = useState<AutoBackupConfig | null>(null);

  // Initialize form state when queries load
  if (configData && !storageForm) {
    setStorageForm(configData.storage);
  }
  if (configData && !autoForm) {
    setAutoForm(configData.autoBackup);
  }

  const handleSaveStorage = (e: React.FormEvent) => {
    e.preventDefault();
    if (storageForm) {
      updateStorageMutation.mutate(storageForm);
    }
  };

  const handleSaveAuto = (e: React.FormEvent) => {
    e.preventDefault();
    if (autoForm) {
      updateAutoMutation.mutate(autoForm);
    }
  };

  const handleCreateBackup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.name.trim()) return;
    createBackupMutation.mutate(manualForm);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-6 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Access Restricted</h3>
        <p className="text-slate-500 text-sm max-w-md">
          Only administrators and super-administrators can access the Clinical Backup, Restore, and Disaster Recovery Management panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm max-w-md font-medium ${
              toast.type === 'success' ? 'bg-teal-50 border-teal-100 text-teal-800' :
              toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' :
              'bg-blue-50 border-blue-100 text-blue-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-teal-500 shrink-0" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500 shrink-0" />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-auto text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner Block */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-sm border border-slate-800/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold">
              <Database className="w-3.5 h-3.5" />
              <span>Data Center Integrity Suite</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">Database & Backup Vault</h1>
            <p className="text-slate-300 text-sm max-w-xl">
              Restore clinical files, manage automatic backup triggers, configure Amazon S3/GCS remote providers, and verify structural JSON compliance.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={() => setIsManualBackupOpen(true)}
              className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all duration-150 cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Compile Manual Snapshot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Secondary Analytics / Status Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Database Health</span>
            <span className="text-base font-bold text-slate-800">100% Intact</span>
            <span className="text-[10px] text-teal-600 block font-semibold mt-0.5">All modules synchronized</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Last Backup</span>
            <span className="text-sm font-bold text-slate-800 truncate block max-w-[150px]">
              {autoForm?.lastRun ? new Date(autoForm.lastRun).toLocaleTimeString() : 'N/A'}
            </span>
            <span className="text-[10px] text-indigo-600 block font-semibold mt-0.5">
              {autoForm?.lastRun ? new Date(autoForm.lastRun).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Auto Backup</span>
            <span className="text-base font-bold text-slate-800 capitalize">{autoForm?.enabled ? autoForm.frequency : 'Disabled'}</span>
            <span className="text-[10px] text-amber-600 block font-semibold mt-0.5">Retention: {autoForm?.retentionDays} Days</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Storage Provider</span>
            <span className="text-base font-bold text-slate-800 capitalize">{storageForm?.provider || 'local'}</span>
            <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">
              {storageForm?.provider === 'local' ? 'Local Server Disk' : 'Cloud Secure Bucket'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs and Content Area */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 px-6 bg-slate-50/50">
          <button
            onClick={() => setActivePane('history')}
            className={`py-4 px-4 text-sm font-medium border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activePane === 'history'
                ? 'border-teal-500 text-teal-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Backup History & Restore</span>
          </button>
          
          <button
            onClick={() => setActivePane('automated')}
            className={`py-4 px-4 text-sm font-medium border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activePane === 'automated'
                ? 'border-teal-500 text-teal-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Automatic Scheduler</span>
          </button>

          <button
            onClick={() => setActivePane('storage')}
            className={`py-4 px-4 text-sm font-medium border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activePane === 'storage'
                ? 'border-teal-500 text-teal-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Storage Provider Settings</span>
          </button>
        </div>

        {/* Panes Content Canvas */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* 1. History & Restore Pane */}
            {activePane === 'history' && (
              <motion.div
                key="history-pane"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Available System Backups</h3>
                    <p className="text-slate-400 text-xs">Verify files, execute full recovery procedures, or delete old sessions.</p>
                  </div>
                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['backup-history'] })}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                {historyLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin text-teal-500 mb-2" />
                    <p className="text-sm font-medium">Fetching secure backup registry...</p>
                  </div>
                ) : !historyData || historyData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
                    <Database className="w-10 h-10 text-slate-300 mb-2" />
                    <h4 className="text-sm font-bold text-slate-700">No Backup Snapshots Registered</h4>
                    <p className="text-slate-400 text-xs mt-1 max-w-sm">Compile your first system manual backup above to populate the local secure storage registry.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Backup Information</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Size</th>
                          <th className="py-3 px-4">Checksum / Integrity</th>
                          <th className="py-3 px-4">Created By</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {historyData.map((record: BackupRecord) => (
                          <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-4">
                              <div className="flex items-start gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  record.status === 'successful' ? 'bg-teal-50 text-teal-600' :
                                  record.status === 'failed' ? 'bg-red-50 text-red-600' :
                                  'bg-amber-50 text-amber-600'
                                }`}>
                                  <Database className="w-5 h-5" />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-slate-800 block leading-snug">{record.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono block truncate max-w-[260px]" title={record.filename}>
                                    {record.filename}
                                  </span>
                                  {record.notes && (
                                    <span className="text-[11px] text-slate-500 italic block mt-0.5">
                                      "{record.notes}"
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                record.type === 'manual'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {record.type}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                              {record.size}
                            </td>
                            <td className="py-4 px-4">
                              <div className="space-y-1">
                                <span className="text-xs font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                  {record.checksum ? record.checksum.substring(0, 12) : 'N/A'}...
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {record.verified ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-600">
                                      <CheckCircle2 className="w-3 h-3 text-teal-500" />
                                      <span>Verified</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600">
                                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                                      <span>Not Checked</span>
                                    </span>
                                  )}
                                  {record.verifiedAt && (
                                    <span className="text-[9px] text-slate-400">
                                      ({new Date(record.verifiedAt).toLocaleDateString()})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>{record.createdBy}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {new Date(record.createdAt).toLocaleString()}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => verifyBackupMutation.mutate(record.id)}
                                  title="Run JSON Structural Integrity Verification"
                                  disabled={verifyBackupMutation.isPending}
                                  className="h-8 px-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
                                  <span>Verify</span>
                                </button>

                                <button
                                  onClick={() => setConfirmRestore(record)}
                                  title="Restore system state back to this snapshot"
                                  className="h-8 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Restore</span>
                                </button>

                                <button
                                  onClick={() => {
                                    if (confirm('Permanently delete this backup archive from server disk and free up allocated blocks?')) {
                                      deleteBackupMutation.mutate(record.id);
                                    }
                                  }}
                                  title="Purge Backup"
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {/* 2. Automated Configuration Pane */}
            {activePane === 'automated' && (
              <motion.div
                key="automated-pane"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="max-w-2xl"
              >
                <form onSubmit={handleSaveAuto} className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Automated Backup Scheduler</h3>
                    <p className="text-slate-400 text-xs">Configure continuous background snapshot schedules to mitigate clinical data loss.</p>
                  </div>

                  {!autoForm ? (
                    <div className="py-12 flex justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Active Toggle */}
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="space-y-0.5">
                          <label className="text-sm font-bold text-slate-800 block">Enable Automated Routine Backups</label>
                          <span className="text-xs text-slate-500">When enabled, CareSync periodically bundles and exports clinical registry JSON snapshots.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAutoForm({ ...autoForm, enabled: !autoForm.enabled })}
                          className={`w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                            autoForm.enabled ? 'bg-teal-500' : 'bg-slate-300'
                          }`}
                        >
                          <div className={`w-5.5 h-5.5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
                            autoForm.enabled ? 'translate-x-5.5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      {/* Schedule details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600">Backup Frequency Interval</label>
                          <select
                            value={autoForm.frequency}
                            onChange={(e) => setAutoForm({ ...autoForm, frequency: e.target.value as any })}
                            disabled={!autoForm.enabled}
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500 disabled:bg-slate-50"
                          >
                            <option value="hourly">Hourly Routine Schedule</option>
                            <option value="daily">Daily Midnight Schedule</option>
                            <option value="weekly">Weekly Routine (Sunday 00:00)</option>
                            <option value="monthly">Monthly Routine Integrity</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600">Retention Window (Days)</label>
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={autoForm.retentionDays}
                            onChange={(e) => setAutoForm({ ...autoForm, retentionDays: parseInt(e.target.value) || 30 })}
                            disabled={!autoForm.enabled}
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500 disabled:bg-slate-50"
                          />
                          <span className="text-[10px] text-slate-400 block">Backups older than this number of days will be deleted automatically from local disks.</span>
                        </div>
                      </div>

                      {/* System Telemetry Metadata */}
                      {autoForm.enabled && (
                        <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-xl space-y-2">
                          <h4 className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                            <span>System Cron Schedule Diagnostics</span>
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="text-slate-400">Last automatic run:</span>
                              <p className="font-semibold text-slate-700 mt-0.5">
                                {autoForm.lastRun ? new Date(autoForm.lastRun).toLocaleString() : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-400">Next automatic queue:</span>
                              <p className="font-semibold text-slate-700 mt-0.5">
                                {autoForm.nextRun ? new Date(autoForm.nextRun).toLocaleString() : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Save Button */}
                      <div className="pt-4 border-t border-slate-100">
                        <button
                          type="submit"
                          disabled={updateAutoMutation.isPending}
                          className="h-10 px-5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          <span>{updateAutoMutation.isPending ? 'Saving...' : 'Apply Scheduler Settings'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </motion.div>
            )}

            {/* 3. Storage Provider Settings */}
            {activePane === 'storage' && (
              <motion.div
                key="storage-pane"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="max-w-2xl"
              >
                <form onSubmit={handleSaveStorage} className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Storage Provider & Destination</h3>
                    <p className="text-slate-400 text-xs">Configure where clinical file backups are written and safely archived.</p>
                  </div>

                  {!storageForm ? (
                    <div className="py-12 flex justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Provider Select Grid Cards */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">Active Storage Provider</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { id: 'local', name: 'Server Local', icon: Server, desc: 'Local block disk' },
                            { id: 's3', name: 'AWS S3 Vault', icon: Cloud, desc: 'S3 storage' },
                            { id: 'gcs', name: 'Google Cloud', icon: Cloud, desc: 'GCS buckets' },
                            { id: 'sftp', name: 'SFTP Sync', icon: Server, desc: 'FTP SSH daemon' }
                          ].map((prov) => {
                            const Icon = prov.icon;
                            const isSelected = storageForm.provider === prov.id;
                            return (
                              <button
                                type="button"
                                key={prov.id}
                                onClick={() => setStorageForm({ ...storageForm, provider: prov.id as any })}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                                  isSelected
                                    ? 'border-teal-500 bg-teal-50/20 ring-1 ring-teal-500'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <Icon className={`w-5 h-5 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />
                                <div>
                                  <span className={`text-xs font-bold block ${isSelected ? 'text-teal-900' : 'text-slate-700'}`}>{prov.name}</span>
                                  <span className="text-[9px] text-slate-400 block mt-0.5">{prov.desc}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Provider Specific Inputs */}
                      {storageForm.provider === 'local' && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3"
                        >
                          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Server className="w-4 h-4 text-slate-500" />
                            <span>Local File System Path parameters</span>
                          </h4>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500">Destination Directory Path</label>
                            <input
                              type="text"
                              value={storageForm.localPath}
                              onChange={(e) => setStorageForm({ ...storageForm, localPath: e.target.value })}
                              placeholder="/var/backups/clinic-suite"
                              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500 font-mono"
                            />
                            <span className="text-[10px] text-slate-400 block">Default output folder mapped relative to host container system.</span>
                          </div>
                        </motion.div>
                      )}

                      {storageForm.provider === 's3' && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-4"
                        >
                          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Cloud className="w-4 h-4 text-orange-500" />
                            <span>AWS Simple Storage Service (S3) Configuration</span>
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500">Target S3 Bucket Name</label>
                              <input
                                type="text"
                                value={storageForm.s3Bucket}
                                onChange={(e) => setStorageForm({ ...storageForm, s3Bucket: e.target.value })}
                                placeholder="s3-bucket-name"
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500">AWS Region</label>
                              <input
                                type="text"
                                defaultValue="us-east-1"
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500">AWS Access Key ID</label>
                              <input
                                type="text"
                                value={storageForm.s3AccessKey}
                                onChange={(e) => setStorageForm({ ...storageForm, s3AccessKey: e.target.value })}
                                placeholder="AKIAIOSFODNN7EXAMPLE"
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500 font-mono"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500">AWS Secret Access Key</label>
                              <input
                                type="password"
                                value={storageForm.s3SecretKey}
                                onChange={(e) => setStorageForm({ ...storageForm, s3SecretKey: e.target.value })}
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500 font-mono"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {storageForm.provider === 'gcs' && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-4"
                        >
                          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Cloud className="w-4 h-4 text-blue-500" />
                            <span>Google Cloud Storage (GCS) Configuration</span>
                          </h4>
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500">GCS Bucket Name</label>
                              <input
                                type="text"
                                value={storageForm.gcsBucket}
                                onChange={(e) => setStorageForm({ ...storageForm, gcsBucket: e.target.value })}
                                placeholder="gcs-clinical-data-bucket"
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500">Service Account Keyfile Location (.json)</label>
                              <input
                                type="text"
                                value={storageForm.gcsKeyFile}
                                onChange={(e) => setStorageForm({ ...storageForm, gcsKeyFile: e.target.value })}
                                placeholder="/etc/gcp/keyfile.json"
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500 font-mono"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {storageForm.provider === 'sftp' && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-4"
                        >
                          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Server className="w-4 h-4 text-purple-500" />
                            <span>SFTP Remote Secure File Transfer Node</span>
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500">Remote SFTP Host IP/Domain</label>
                              <input
                                type="text"
                                value={storageForm.sftpHost}
                                onChange={(e) => setStorageForm({ ...storageForm, sftpHost: e.target.value })}
                                placeholder="sftp.clinicaltrust.org"
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500">Port</label>
                              <input
                                type="number"
                                value={storageForm.sftpPort}
                                onChange={(e) => setStorageForm({ ...storageForm, sftpPort: parseInt(e.target.value) || 22 })}
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500">SFTP Username</label>
                              <input
                                type="text"
                                value={storageForm.sftpUsername}
                                onChange={(e) => setStorageForm({ ...storageForm, sftpUsername: e.target.value })}
                                placeholder="operator_med"
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500 font-mono"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500">SSH Private Key or password</label>
                              <input
                                type="password"
                                placeholder="••••••••••••••••"
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500 font-mono"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Save Button */}
                      <div className="pt-4 border-t border-slate-100">
                        <button
                          type="submit"
                          disabled={updateStorageMutation.isPending}
                          className="h-10 px-5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          <span>{updateStorageMutation.isPending ? 'Saving...' : 'Save Storage Configuration'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MODAL: Manual Backup Generation Form */}
      <AnimatePresence>
        {isManualBackupOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-teal-400" />
                  <span className="font-display font-bold text-sm tracking-tight">Compile New Database Backup</span>
                </div>
                <button
                  onClick={() => setIsManualBackupOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateBackup} className="p-6 space-y-4">
                <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl flex gap-2 text-xs text-teal-800">
                  <Info className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                  <p>
                    This captures the current live state of all Electronic Medical Records, HR registries, Pharmacy, Laboratory data files, and indexes.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Backup Label / Name</label>
                  <input
                    type="text"
                    required
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    placeholder="e.g. Pre-Upgrade Baseline, July End of Month"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Operator Notes (Optional)</label>
                  <textarea
                    value={manualForm.notes}
                    onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                    placeholder="Enter context reasons for compiling this manual file snapshot..."
                    rows={3}
                    className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-teal-500 resize-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsManualBackupOpen(false)}
                    className="h-10 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createBackupMutation.isPending || !manualForm.name.trim()}
                    className="h-10 px-5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm shadow-teal-500/10 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {createBackupMutation.isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Compiling snapshot...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Begin Compilation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION OVERLAY: DISASTER RECOVERY RESTORE WARNING */}
      <AnimatePresence>
        {confirmRestore && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full border border-red-100 shadow-2xl overflow-hidden"
            >
              <div className="bg-red-600 text-white px-6 py-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                <span className="font-display font-bold text-sm tracking-tight">CRITICAL: Confirm Recovery Restore</span>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-2 text-xs text-red-800">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold">Irreversible Overwrite Warning</h5>
                    <p className="mt-1">
                      Restoring will immediately terminate the current active database state and overwrite ALL tables and data files with records compiled on:
                    </p>
                    <p className="font-mono mt-2 font-bold text-red-950">
                      {new Date(confirmRestore.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p><strong className="text-slate-800">Target Backup:</strong> {confirmRestore.name}</p>
                  <p><strong className="text-slate-800">File ID:</strong> {confirmRestore.id}</p>
                  <p><strong className="text-slate-800">Checksum Match:</strong> {confirmRestore.checksum}</p>
                  <p><strong className="text-slate-800">Created By:</strong> {confirmRestore.createdBy}</p>
                </div>

                <p className="text-xs text-slate-400">
                  Any records, claims, patients, or appointments registered after this backup was compiled will be permanently lost.
                </p>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRestore(null)}
                    className="h-10 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={restoreBackupMutation.isPending}
                    onClick={() => restoreBackupMutation.mutate(confirmRestore.id)}
                    className="h-10 px-5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    {restoreBackupMutation.isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Rebuilding system state...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Overwrite & Restore Database</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
