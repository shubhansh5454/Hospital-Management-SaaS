import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Folder, 
  FolderPlus, 
  FileText, 
  FileImage, 
  FileCheck, 
  Paperclip, 
  ShieldAlert, 
  Shield, 
  Search, 
  ChevronRight, 
  Download, 
  Trash2, 
  Edit2, 
  X, 
  UploadCloud, 
  FileUp, 
  ChevronLeft, 
  CornerDownRight, 
  Check, 
  File, 
  AlertCircle,
  Clock,
  User,
  HeartPulse,
  Eye,
  Filter
} from 'lucide-react';

interface ClinicFile {
  id: number;
  name: string;
  isFolder: boolean;
  parentId: number | null;
  fileType: 'image' | 'pdf' | 'lab_report' | 'prescription' | 'patient_doc' | 'insurance_doc' | 'folder';
  mimeType: string | null;
  size: number | null;
  content: string | null;
  patientId: number | null;
  accessRoles: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { id: number; name: string; email: string; role: string };
  patient?: { id: number; name: string };
}

interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export default function Documents() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const currentRole = profile?.role || 'patient';
  const isStaff = ['admin', 'doctor', 'receptionist'].includes(currentRole);

  // Explorer Hierarchy & Filter States
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [folderHistory, setFolderHistory] = useState<Array<{ id: number | null; name: string }>>([
    { id: null, name: 'Root Directory' }
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Interactive UI Modal States
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<ClinicFile | null>(null);
  const [editFile, setEditFile] = useState<ClinicFile | null>(null);

  // Form inputs
  const [newFolderName, setNewFolderName] = useState('');
  const [renameInput, setRenameInput] = useState('');
  const [targetParentFolder, setTargetParentFolder] = useState<string>('');
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  // New File Upload Form States
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [uploadFileType, setUploadFileType] = useState<'image' | 'pdf' | 'lab_report' | 'prescription' | 'patient_doc' | 'insurance_doc'>('patient_doc');
  const [uploadPatientId, setUploadPatientId] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['admin', 'doctor', 'receptionist', 'patient']);

  // Fetch list of patients (for staff uploads)
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load patients list');
      return res.json();
    },
    enabled: isStaff,
  });

  // Fetch hierarchical folders/files inside the current path or matching search query
  const { data: files = [], isLoading, refetch } = useQuery<ClinicFile[]>({
    queryKey: ['files', currentFolderId, searchQuery],
    queryFn: async () => {
      let url = `/api/files?`;
      if (searchQuery) {
        url += `search=${encodeURIComponent(searchQuery)}`;
      } else if (currentFolderId) {
        url += `parentId=${currentFolderId}`;
      }
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load clinic document registry');
      return res.json();
    },
  });

  // Folder paths (filtered recursively to show folder directories only for moving folders)
  const { data: allFolders = [] } = useQuery<ClinicFile[]>({
    queryKey: ['all_folders'],
    queryFn: async () => {
      const res = await fetch(`/api/files?search=`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load folders list');
      const all: ClinicFile[] = await res.json();
      return all.filter(f => f.isFolder);
    },
    enabled: !!editFile,
  });

  // Show status toasts
  const showFeedback = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccessFeedback(msg);
      setTimeout(() => setSuccessFeedback(null), 4000);
    } else {
      setErrorFeedback(msg);
      setTimeout(() => setErrorFeedback(null), 5000);
    }
  };

  // Navigate folder helper
  const navigateToFolder = (folderId: number | null, folderName: string) => {
    if (folderId === null) {
      setFolderHistory([{ id: null, name: 'Root Directory' }]);
      setCurrentFolderId(null);
    } else {
      const index = folderHistory.findIndex(h => h.id === folderId);
      if (index !== -1) {
        // Backtrack
        setFolderHistory(folderHistory.slice(0, index + 1));
      } else {
        // Dig deeper
        setFolderHistory([...folderHistory, { id: folderId, name: folderName }]);
      }
      setCurrentFolderId(folderId);
    }
    setSearchQuery('');
  };

  // Convert files to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size limit of 15MB
    if (file.size > 15 * 1024 * 1024) {
      showFeedback('error', 'File size exceeds the 15MB system limit.');
      return;
    }

    setUploadFile(file);

    // Auto-detect categoric type
    if (file.type.startsWith('image/')) {
      setUploadFileType('image');
    } else if (file.type === 'application/pdf') {
      setUploadFileType('pdf');
    } else {
      setUploadFileType('patient_doc');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Trigger download local blob
  const handleDownload = (file: ClinicFile) => {
    if (!file.content) {
      showFeedback('error', 'No document data found for this file.');
      return;
    }
    try {
      const link = document.createElement('a');
      link.href = file.content;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showFeedback('success', `Downloading ${file.name}`);
    } catch (err) {
      showFeedback('error', 'Failed to compile file stream for download.');
    }
  };

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          isFolder: true,
          parentId: currentFolderId,
          fileType: 'folder',
          accessRoles: 'admin,doctor,receptionist,patient'
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create folder');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setNewFolderName('');
      setFolderModalOpen(false);
      showFeedback('success', 'Folder created successfully!');
    },
    onError: (err: Error) => {
      showFeedback('error', err.message);
    }
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !fileBase64) {
        throw new Error('Please select a valid file to upload');
      }
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: uploadFile.name,
          isFolder: false,
          parentId: currentFolderId,
          fileType: uploadFileType,
          mimeType: uploadFile.type || 'application/octet-stream',
          size: uploadFile.size,
          content: fileBase64,
          patientId: uploadPatientId ? parseInt(uploadPatientId) : null,
          accessRoles: selectedRoles.join(',')
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'File upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setUploadFile(null);
      setFileBase64(null);
      setUploadPatientId('');
      setSelectedRoles(['admin', 'doctor', 'receptionist', 'patient']);
      setUploadDrawerOpen(false);
      showFeedback('success', 'File uploaded and validated successfully!');
    },
    onError: (err: Error) => {
      showFeedback('error', err.message);
    }
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete file');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setPreviewFile(null);
      showFeedback('success', 'Resource deleted successfully');
    },
    onError: (err: Error) => {
      showFeedback('error', err.message);
    }
  });

  // Edit/Move file mutation
  const updateFileMutation = useMutation({
    mutationFn: async () => {
      if (!editFile) return;
      const payload: any = {
        name: renameInput.trim(),
        accessRoles: selectedRoles.join(',')
      };
      if (targetParentFolder) {
        payload.parentId = targetParentFolder === 'root' ? null : parseInt(targetParentFolder);
      }
      const res = await fetch(`/api/files/${editFile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update file properties');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setEditFile(null);
      setTargetParentFolder('');
      showFeedback('success', 'File details updated successfully!');
    },
    onError: (err: Error) => {
      showFeedback('error', err.message);
    }
  });

  // File Categorization & Filtering lists
  const filteredFiles = files.filter(f => {
    if (filterType === 'all') return true;
    if (filterType === 'image' && f.fileType === 'image') return true;
    if (filterType === 'pdf' && f.fileType === 'pdf') return true;
    if (filterType === 'reports' && f.fileType === 'lab_report') return true;
    if (filterType === 'prescriptions' && f.fileType === 'prescription') return true;
    if (filterType === 'patients' && f.fileType === 'patient_doc') return true;
    if (filterType === 'insurance' && f.fileType === 'insurance_doc') return true;
    return false;
  });

  // Human Readable File Size Conversion
  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper file icons selector
  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'folder':
        return <Folder className="w-10 h-10 text-amber-500 fill-amber-500/20" />;
      case 'image':
        return <FileImage className="w-10 h-10 text-emerald-500" />;
      case 'pdf':
        return <FileText className="w-10 h-10 text-rose-500" />;
      case 'lab_report':
        return <FileCheck className="w-10 h-10 text-purple-500" />;
      case 'prescription':
        return <HeartPulse className="w-10 h-10 text-teal-500" />;
      case 'insurance_doc':
        return <Shield className="w-10 h-10 text-blue-500" />;
      default:
        return <Paperclip className="w-10 h-10 text-slate-400" />;
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6">
      
      {/* Toast notifications */}
      <AnimatePresence>
        {successFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg font-medium text-sm"
          >
            <Check className="w-4 h-4" />
            <span>{successFeedback}</span>
          </motion.div>
        )}
        {errorFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg font-medium text-sm"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{errorFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview stats header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-800 tracking-tight">Clinical Document Center</h1>
          <p className="text-sm text-slate-400 mt-1">Manage health records, prescriptions, insurance papers, and patient logs securely.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isStaff && (
            <>
              <button
                onClick={() => setFolderModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-bold rounded-xl transition-all cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>New Folder</span>
              </button>
              <button
                onClick={() => setUploadDrawerOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold rounded-xl shadow-sm shadow-teal-500/10 transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Document</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Explorer Controls: Search + View Settings + Path navigation */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        
        {/* Search & Category Filter bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents by name or content keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Type Filter select */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 pl-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {[
              { id: 'all', name: 'All Files' },
              { id: 'prescriptions', name: 'Prescriptions' },
              { id: 'reports', name: 'Lab Reports' },
              { id: 'insurance', name: 'Insurance' },
              { id: 'pdf', name: 'PDF Docs' },
              { id: 'image', name: 'Images' },
              { id: 'patients', name: 'Patient Docs' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  filterType === tab.id 
                    ? 'bg-teal-50 text-teal-600 border border-teal-100' 
                    : 'bg-white hover:bg-slate-50 text-slate-500 border border-slate-200'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Breadcrumb Trails */}
        {!searchQuery && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 border-t border-slate-50 pt-3 flex-wrap">
            {folderHistory.map((h, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                <button
                  onClick={() => navigateToFolder(h.id, h.name)}
                  className={`hover:text-teal-600 transition-colors cursor-pointer ${
                    idx === folderHistory.length - 1 ? 'text-slate-700 font-bold' : ''
                  }`}
                >
                  {h.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {searchQuery && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 bg-teal-50/50 p-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span>Showing search results recursively across all folders</span>
          </div>
        )}
      </div>

      {/* Main Files Display Panel */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-400 font-semibold mt-4">Consulting CareSync File Registry...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Folder className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-bold text-slate-700">No documents found</h3>
            <p className="text-xs text-slate-400">This directory is currently empty or contains no files matching your active search filters.</p>
          </div>
          {isStaff && !searchQuery && (
            <button
              onClick={() => setUploadDrawerOpen(true)}
              className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-600 font-bold text-xs rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <FileUp className="w-3.5 h-3.5" /> Upload first document
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFiles.map(file => (
            <div
              key={file.id}
              className={`bg-white rounded-2xl border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                file.isFolder ? 'cursor-pointer' : ''
              }`}
              onClick={() => {
                if (file.isFolder) {
                  navigateToFolder(file.id, file.name);
                }
              }}
            >
              {/* Card visual body */}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-slate-50 rounded-xl shadow-inner">
                    {getFileIcon(file.fileType)}
                  </div>

                  {/* Actions Dropdown triggers */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewFile(file);
                      }}
                      title="View Metadata & Preview"
                      className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {isStaff && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditFile(file);
                          setRenameInput(file.name);
                          setSelectedRoles(file.accessRoles ? file.accessRoles.split(',') : []);
                        }}
                        title="Edit Details / Move"
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!file.isFolder && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file);
                        }}
                        title="Download Document"
                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm truncate" title={file.name}>
                    {file.name}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    {file.isFolder ? (
                      <span>Folder</span>
                    ) : (
                      <>
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        <span className="uppercase">{file.fileType.replace('_', ' ')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="truncate max-w-[120px] flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-300" />
                  {file.uploadedBy?.name || 'System'}
                </span>
                <span>{new Date(file.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL: CREATE FOLDER --- */}
      {folderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-100"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-slate-800 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-500" />
                <span>Create New Folder</span>
              </h3>
              <button onClick={() => setFolderModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-bold block mb-1">Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Lab Results 2026"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setFolderModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                  onClick={() => createFolderMutation.mutate()}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  {createFolderMutation.isPending ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* --- MODAL: EDIT / MOVE FILE --- */}
      {editFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-100"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-500" />
                <span>Edit Document Settings</span>
              </h3>
              <button onClick={() => setEditFile(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-bold block mb-1">Rename Resource</label>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-sm"
                />
              </div>

              {/* Move to folder structure select */}
              <div>
                <label className="text-xs text-slate-500 font-bold block mb-1">Move to Folder</label>
                <select
                  value={targetParentFolder}
                  onChange={(e) => setTargetParentFolder(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-sm"
                >
                  <option value="">Keep current location</option>
                  <option value="root">Root Directory</option>
                  {allFolders
                    .filter(f => f.id !== editFile.id) // Cannot move folder inside itself
                    .map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                </select>
              </div>

              {/* Secure role-based toggles */}
              <div>
                <span className="text-xs text-slate-500 font-bold block mb-2">Configure Authorized Roles</span>
                <div className="grid grid-cols-2 gap-2">
                  {['admin', 'doctor', 'receptionist', 'patient'].map(r => (
                    <label key={r} className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-xl text-xs text-slate-600 cursor-pointer capitalize font-medium">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(r)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoles([...selectedRoles, r]);
                          } else {
                            setSelectedRoles(selectedRoles.filter(role => role !== r));
                          }
                        }}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>{r === 'receptionist' ? 'Reception' : r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditFile(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!renameInput.trim() || updateFileMutation.isPending}
                  onClick={() => updateFileMutation.mutate()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  {updateFileMutation.isPending ? 'Saving...' : 'Update Settings'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* --- PREVIEW MODAL --- */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <motion.div 
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-4xl p-6 rounded-2xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  {getFileIcon(previewFile.fileType)}
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-base">{previewFile.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                    <span>Uploaded: {new Date(previewFile.createdAt).toLocaleString()}</span>
                    <span>•</span>
                    <span>Size: {formatBytes(previewFile.size)}</span>
                  </div>
                </div>
              </div>
              
              <button onClick={() => setPreviewFile(null)} className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dynamic Content Preview Window */}
            <div className="flex-1 overflow-y-auto py-6 flex flex-col items-center justify-center bg-slate-50 rounded-xl my-4 min-h-[300px]">
              {previewFile.isFolder ? (
                <div className="text-center space-y-2 p-8">
                  <Folder className="w-16 h-16 text-amber-500 mx-auto fill-amber-500/10" />
                  <p className="font-bold text-slate-700">Folder: {previewFile.name}</p>
                  <p className="text-xs text-slate-400">Folders cannot be viewed as a standalone file. Open this folder inside the explorer layout.</p>
                </div>
              ) : previewFile.fileType === 'image' && previewFile.content ? (
                <img 
                  src={previewFile.content} 
                  alt={previewFile.name} 
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-sm"
                />
              ) : previewFile.fileType === 'pdf' && previewFile.content ? (
                <iframe 
                  src={previewFile.content} 
                  title={previewFile.name}
                  className="w-full h-[55vh] border-0 rounded-lg shadow-inner"
                />
              ) : (
                <div className="text-center p-8 space-y-4 max-w-sm">
                  <div className="w-16 h-16 bg-white border border-slate-200/60 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    {getFileIcon(previewFile.fileType)}
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-700 text-sm">Preview Unavailable</p>
                    <p className="text-xs text-slate-400">This document type ({previewFile.fileType}) does not support inline visualization. Download to review content locally.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer and Security Meta details */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 pt-4 gap-4">
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <ShieldAlert className="w-4 h-4 text-teal-600" />
                  <span className="font-bold">Access roles:</span>
                  <span className="font-mono text-[10px] bg-teal-50 border border-teal-100 text-teal-700 px-1.5 py-0.5 rounded-md uppercase tracking-wider">{previewFile.accessRoles || 'All staff'}</span>
                </div>
                {previewFile.patient && (
                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="font-bold">Linked Patient:</span>
                    <span className="bg-slate-100 border border-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded-md">{previewFile.patient.name}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 justify-end">
                {isStaff && (
                  <button
                    disabled={deleteFileMutation.isPending}
                    onClick={() => {
                      if (confirm(`Are you absolutely sure you want to permanently delete "${previewFile.name}"? This action cannot be undone.`)) {
                        deleteFileMutation.mutate(previewFile.id);
                      }
                    }}
                    className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
                {!previewFile.isFolder && (
                  <button
                    onClick={() => handleDownload(previewFile)}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Document
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* --- DRAWERS: FILE UPLOAD DRAWER --- */}
      {uploadDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            transition={{ type: 'tween' }}
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-800 flex items-center gap-2 text-base">
                <FileUp className="w-5 h-5 text-teal-600" />
                <span>Upload Clinical Document</span>
              </h3>
              <button onClick={() => setUploadDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Drag Drop Area */}
              <div className="border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-teal-50/10 transition-colors relative cursor-pointer group">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto text-slate-400 group-hover:text-teal-500 transition-colors">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">Click to upload or drag & drop</p>
                    <p className="text-xs text-slate-400">PDF, JPEG, PNG formats supported. Max size 15MB.</p>
                  </div>
                </div>
              </div>

              {uploadFile && (
                <div className="flex items-center gap-3 p-3.5 bg-teal-50 border border-teal-100/50 rounded-xl">
                  <div className="p-2 bg-white text-teal-600 rounded-lg">
                    {uploadFileType === 'pdf' ? <FileText className="w-5 h-5" /> : <FileImage className="w-5 h-5" />}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs font-bold text-slate-700 truncate">{uploadFile.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatBytes(uploadFile.size)}</p>
                  </div>
                  <button onClick={() => { setUploadFile(null); setFileBase64(null); }} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Categorize / File Type Selector */}
              <div>
                <label className="text-xs text-slate-500 font-bold block mb-1.5">Document Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'prescription', label: 'Prescription', icon: HeartPulse },
                    { id: 'lab_report', label: 'Lab Report', icon: FileCheck },
                    { id: 'insurance_doc', label: 'Insurance Document', icon: Shield },
                    { id: 'patient_doc', label: 'Patient Record', icon: FileText },
                    { id: 'image', label: 'X-Ray / Image scan', icon: FileImage },
                    { id: 'pdf', label: 'Generic PDF', icon: File }
                  ].map(item => {
                    const Icon = item.icon;
                    const isSelected = uploadFileType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setUploadFileType(item.id as any)}
                        className={`p-3 border rounded-xl flex items-center gap-2.5 text-xs font-semibold cursor-pointer text-left transition-all ${
                          isSelected 
                            ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-sm shadow-teal-500/5' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Link Patient Dropdown */}
              <div>
                <label className="text-xs text-slate-500 font-bold block mb-1">Associate Patient (Optional)</label>
                <select
                  value={uploadPatientId}
                  onChange={(e) => setUploadPatientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-sm"
                >
                  <option value="">Do not link to a patient profile</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Linking to a patient makes this document viewable from their secure Patient Portal account.</p>
              </div>

              {/* Configure access rights checkbox */}
              <div>
                <span className="text-xs text-slate-500 font-bold block mb-2">Configure Access Security</span>
                <div className="grid grid-cols-2 gap-2">
                  {['admin', 'doctor', 'receptionist', 'patient'].map(r => (
                    <label key={r} className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-xl text-xs text-slate-600 cursor-pointer capitalize font-medium">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(r)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoles([...selectedRoles, r]);
                          } else {
                            setSelectedRoles(selectedRoles.filter(role => role !== r));
                          }
                        }}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>{r === 'receptionist' ? 'Reception' : r}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Checked roles will have reading access to this document. Unchecked roles are strictly denied.</p>
              </div>

            </div>

            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
              <button
                onClick={() => setUploadDrawerOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!uploadFile || uploadFileMutation.isPending}
                onClick={() => uploadFileMutation.mutate()}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
              >
                {uploadFileMutation.isPending ? 'Processing Scan & Upload...' : 'Validate & Upload'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
