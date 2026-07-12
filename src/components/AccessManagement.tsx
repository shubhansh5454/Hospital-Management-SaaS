import { useState } from 'react';
import { useAuth } from './AuthContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, 
  Users, 
  History, 
  Plus, 
  Check, 
  X, 
  Edit, 
  Trash2, 
  Info, 
  Search, 
  Filter, 
  UserCheck, 
  Lock, 
  Unlock, 
  ChevronRight, 
  ChevronDown,
  AlertCircle
} from 'lucide-react';

interface Permission {
  id: number;
  code: string;
  name: string;
  group: string;
  description: string;
}

interface CustomRole {
  id: number;
  name: string;
  description: string | null;
  clinicId: number | null;
  isSystem: boolean;
  permissions: {
    permission: Permission;
  }[];
}

interface UserPermissionState {
  code: string;
  name: string;
  group: string;
  allowed: boolean;
  source: string;
}

interface ClinicUser {
  id: number;
  name: string;
  email: string;
  role: string;
  customRoleId: number | null;
  customRole: {
    id: number;
    name: string;
  } | null;
  userPermissions: {
    permissionId: number;
    value: boolean;
    permission: Permission;
  }[];
}

interface AuditLog {
  id: number;
  userId: number | null;
  clinicId: number | null;
  action: string;
  resource: string;
  details: string;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  } | null;
}

export default function AccessManagement() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'audit'>('roles');
  
  // Tab 1 state
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<'create' | 'edit'>('create');
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleFormPermissions, setRoleFormPermissions] = useState<number[]>([]);

  // Tab 2 state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isUserOverrideModalOpen, setIsUserOverrideModalOpen] = useState(false);
  const [userRoleSelection, setUserRoleSelection] = useState<string>('');
  const [userOverrides, setUserOverrides] = useState<Record<number, 'inherit' | 'grant' | 'deny'>>({});
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Tab 3 state
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterResource, setAuditFilterResource] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Notifications state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Queries
  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: ['access-permissions'],
    queryFn: async () => {
      const res = await fetch('/api/roles/permissions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load permissions');
      return res.json();
    },
    enabled: !!token && activeTab === 'roles'
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<CustomRole[]>({
    queryKey: ['access-roles'],
    queryFn: async () => {
      const res = await fetch('/api/roles/roles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load roles');
      const data = await res.json();
      // Auto select first role if none selected
      if (data.length > 0 && selectedRoleId === null) {
        setSelectedRoleId(data[0].id);
      }
      return data;
    },
    enabled: !!token
  });

  const { data: clinicUsers = [], isLoading: usersLoading } = useQuery<ClinicUser[]>({
    queryKey: ['access-users'],
    queryFn: async () => {
      const res = await fetch('/api/roles/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load clinic users');
      return res.json();
    },
    enabled: !!token && activeTab === 'users'
  });

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery<AuditLog[]>({
    queryKey: ['access-audit-logs'],
    queryFn: async () => {
      const res = await fetch('/api/roles/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load audit logs');
      return res.json();
    },
    enabled: !!token && activeTab === 'audit'
  });

  // Mutations
  const createRoleMutation = useMutation({
    mutationFn: async (newRole: { name: string; description: string; permissionIds: number[] }) => {
      const res = await fetch('/api/roles/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newRole)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create role');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['access-roles'] });
      setIsRoleModalOpen(false);
      setSelectedRoleId(data.id);
      showFeedback('success', `Custom role "${data.name}" created successfully!`);
    },
    onError: (err: any) => {
      showFeedback('error', err.message);
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (updatedRole: { id: number; name: string; description: string; permissionIds: number[] }) => {
      const res = await fetch(`/api/roles/roles/${updatedRole.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: updatedRole.name,
          description: updatedRole.description,
          permissionIds: updatedRole.permissionIds
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update role');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['access-roles'] });
      setIsRoleModalOpen(false);
      showFeedback('success', `Custom role "${data.name}" updated successfully!`);
    },
    onError: (err: any) => {
      showFeedback('error', err.message);
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: number) => {
      const res = await fetch(`/api/roles/roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete role');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-roles'] });
      setSelectedRoleId(null);
      showFeedback('success', 'Custom role deleted successfully. Mapped users reverted to default policies.');
    },
    onError: (err: any) => {
      showFeedback('error', err.message);
    }
  });

  const assignUserRoleMutation = useMutation({
    mutationFn: async ({ userId, customRoleId }: { userId: number; customRoleId: number | null }) => {
      const res = await fetch(`/api/roles/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ customRoleId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to assign role');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-users'] });
      showFeedback('success', 'User role assigned successfully!');
    },
    onError: (err: any) => {
      showFeedback('error', err.message);
    }
  });

  const saveUserOverridesMutation = useMutation({
    mutationFn: async ({ userId, overrides }: { userId: number; overrides: { permissionId: number; value: boolean }[] }) => {
      const res = await fetch(`/api/roles/users/${userId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ overrides })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save overrides');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-users'] });
      setIsUserOverrideModalOpen(false);
      showFeedback('success', 'Enterprise access overrides saved successfully!');
    },
    onError: (err: any) => {
      showFeedback('error', err.message);
    }
  });

  // Grouped Permissions Helper
  const getGroupedPermissions = () => {
    const groups: Record<string, Permission[]> = {};
    permissions.forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    return groups;
  };

  // Role Form Helpers
  const handleOpenCreateRole = () => {
    setRoleModalMode('create');
    setRoleFormName('');
    setRoleFormDesc('');
    setRoleFormPermissions([]);
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (role: CustomRole) => {
    setRoleModalMode('edit');
    setRoleFormName(role.name);
    setRoleFormDesc(role.description || '');
    setRoleFormPermissions(role.permissions.map(rp => rp.permission.id));
    setIsRoleModalOpen(true);
  };

  const handleToggleFormPermission = (id: number) => {
    setRoleFormPermissions(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleSaveRole = () => {
    if (!roleFormName.trim()) {
      showFeedback('error', 'Role name cannot be empty');
      return;
    }

    if (roleModalMode === 'create') {
      createRoleMutation.mutate({
        name: roleFormName,
        description: roleFormDesc,
        permissionIds: roleFormPermissions
      });
    } else if (roleModalMode === 'edit' && selectedRoleId) {
      updateRoleMutation.mutate({
        id: selectedRoleId,
        name: roleFormName,
        description: roleFormDesc,
        permissionIds: roleFormPermissions
      });
    }
  };

  const handleDeleteRole = (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete the custom role "${name}"? Users with this role will fall back to their system default roles.`)) {
      deleteRoleMutation.mutate(id);
    }
  };

  // User Overrides Modal Setup
  const handleOpenUserOverrides = async (user: ClinicUser) => {
    setSelectedUserId(user.id);
    setUserRoleSelection(user.customRoleId ? String(user.customRoleId) : '');
    
    // Fetch user current fully resolved permissions to see their live state
    try {
      const res = await fetch(`/api/roles/users/${user.id}/permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load user resolved permissions');
      const resolvedPerms: UserPermissionState[] = await res.json();
      
      // Load standard permissions to map overrides
      // An override is set in `user.userPermissions`
      const initialOverrides: Record<number, 'inherit' | 'grant' | 'deny'> = {};
      
      // Pre-fill overrides from user's current direct database records
      permissions.forEach(p => {
        const directOverride = user.userPermissions.find(up => up.permissionId === p.id);
        if (directOverride) {
          initialOverrides[p.id] = directOverride.value ? 'grant' : 'deny';
        } else {
          initialOverrides[p.id] = 'inherit';
        }
      });

      setUserOverrides(initialOverrides);
      setIsUserOverrideModalOpen(true);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to initialize overrides modal');
    }
  };

  const handleToggleOverride = (pId: number, state: 'inherit' | 'grant' | 'deny') => {
    setUserOverrides(prev => ({
      ...prev,
      [pId]: state
    }));
  };

  const handleSaveUserPermissions = () => {
    if (!selectedUserId) return;

    // 1. Sync custom role assignment if changed
    const roleIdVal = userRoleSelection === '' ? null : parseInt(userRoleSelection, 10);
    assignUserRoleMutation.mutate({ userId: selectedUserId, customRoleId: roleIdVal });

    // 2. Format overrides array
    const formattedOverrides: { permissionId: number; value: boolean }[] = [];
    Object.entries(userOverrides).forEach(([pIdStr, state]) => {
      const pId = parseInt(pIdStr, 10);
      if (state === 'grant') {
        formattedOverrides.push({ permissionId: pId, value: true });
      } else if (state === 'deny') {
        formattedOverrides.push({ permissionId: pId, value: false });
      }
    });

    saveUserOverridesMutation.mutate({
      userId: selectedUserId,
      overrides: formattedOverrides
    });
  };

  // Filtered Users List
  const filteredUsers = clinicUsers.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                        u.email.toLowerCase().includes(userSearchQuery.toLowerCase());
    return matchSearch;
  });

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter(log => {
    const textToSearch = `${log.action} ${log.resource} ${log.user?.name || 'System'} ${log.details}`.toLowerCase();
    const matchSearch = textToSearch.includes(auditSearchQuery.toLowerCase());
    const matchAction = auditFilterAction ? log.action === auditFilterAction : true;
    const matchResource = auditFilterResource ? log.resource === auditFilterResource : true;
    return matchSearch && matchAction && matchResource;
  });

  const activeRole = roles.find(r => r.id === selectedRoleId);
  const groupedPerms = getGroupedPermissions();

  return (
    <div id="roles_permissions_wrapper" className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Banner Feedback Notification */}
      {feedback && (
        <div 
          id="access_notification_banner"
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border transition-all duration-300 ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? <Check className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <p className="text-sm font-semibold">{feedback.message}</p>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-teal-600" /> Enterprise Role & Access Matrix
          </h1>
          <p className="text-sm text-slate-500">
            Provision custom clinic roles, modify the permission checklist, and enforce user-specific policies with real-time audit logging.
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl self-start md:self-auto shadow-inner">
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'roles' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" /> Role Matrix
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'users' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> User Overrides
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'audit' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" /> Security Auditing
          </button>
        </div>
      </div>

      {/* Tab 1: Dynamic Roles and Matrix View */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Roles Left sidebar */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Clinic Roles</h3>
              <button 
                onClick={handleOpenCreateRole}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create Role
              </button>
            </div>

            {rolesLoading ? (
              <div className="py-12 text-center text-sm text-slate-400">Loading roles...</div>
            ) : roles.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">No roles provisioned yet.</div>
            ) : (
              <div className="space-y-2">
                {roles.map(role => (
                  <div 
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`group w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedRoleId === role.id 
                        ? 'border-teal-200 bg-teal-50/40 text-slate-900 shadow-[0_4px_12px_rgba(20,184,166,0.04)]' 
                        : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-tight">{role.name}</span>
                        {role.isSystem ? (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold tracking-wide uppercase">System</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[9px] font-bold tracking-wide uppercase">Custom</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mr-2">{role.description || 'No description provided'}</p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!role.isSystem && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenEditRole(role); }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                            title="Edit Role Settings"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id, role.name); }}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete Custom Role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedRoleId === role.id ? 'translate-x-0.5 text-teal-600' : 'text-slate-300'}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Permissions Right Checkbox Matrix Panel */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {activeRole ? (
              <div>
                {/* Panel Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-800">{activeRole.name} Policies</h2>
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full text-xs font-semibold">
                        {activeRole.permissions.length} Active Permissions
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{activeRole.description || 'This role does not have a custom description configured.'}</p>
                  </div>
                  {!activeRole.isSystem && (
                    <button 
                      onClick={() => handleOpenEditRole(activeRole)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" /> Modify Role Mapping
                    </button>
                  )}
                </div>

                {/* Matrix Checklist */}
                <div className="p-6 space-y-6">
                  {Object.entries(groupedPerms).map(([groupName, groupPermissions]) => (
                    <div key={groupName} className="space-y-3">
                      <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">{groupName}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {groupPermissions.map(p => {
                          const isAssigned = activeRole.permissions.some(rp => rp.permission.code === p.code);
                          return (
                            <div 
                              key={p.id}
                              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                                isAssigned 
                                  ? 'border-emerald-100 bg-emerald-50/20 text-slate-800' 
                                  : 'border-slate-100 bg-slate-50/30 text-slate-500 opacity-60'
                              }`}
                            >
                              <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                isAssigned 
                                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/10' 
                                  : 'bg-slate-200 text-slate-400'
                              }`}>
                                {isAssigned ? <Check className="w-3.5 h-3.5 font-bold" /> : <Lock className="w-3 h-3" />}
                              </div>
                              <div className="space-y-1">
                                <span className={`text-sm font-semibold block ${isAssigned ? 'text-slate-800' : 'text-slate-600'}`}>{p.name}</span>
                                <span className="text-xs text-slate-400 block leading-relaxed">{p.description}</span>
                                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono inline-block mt-1">{p.code}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-slate-400 space-y-2">
                <Shield className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-medium">Select a role on the left to inspect or modify its dynamic permissions mapping.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: User Level Policies and Overrides */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-50 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">User Specific Overrides</h3>
              <p className="text-xs text-slate-400">Directly assign custom roles or explicitly override (Grant/Deny) permissions for individual clinic members.</p>
            </div>
            
            {/* Search */}
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search clinic members by name/email..."
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white transition-all"
              />
            </div>
          </div>

          {usersLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">Retrieving clinic roster...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No matching clinic members found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                    <th className="p-4 rounded-l-xl">User Name</th>
                    <th className="p-4">Email Address</th>
                    <th className="p-4">Default Role</th>
                    <th className="p-4">Assigned Custom Role</th>
                    <th className="p-4">Active Overrides</th>
                    <th className="p-4 rounded-r-xl text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-slate-800">{user.name}</td>
                      <td className="p-4 text-slate-500 font-mono text-xs">{user.email}</td>
                      <td className="p-4 text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded text-[10px] tracking-wide uppercase">{user.role}</span>
                      </td>
                      <td className="p-4">
                        {user.customRole ? (
                          <span className="px-2 py-0.5 bg-teal-50 text-teal-700 font-semibold rounded-lg text-xs">
                            {user.customRole.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">System Default Inherited</span>
                        )}
                      </td>
                      <td className="p-4">
                        {user.userPermissions.length > 0 ? (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-semibold rounded-lg text-xs flex items-center gap-1 w-max">
                            <Lock className="w-3 h-3" /> {user.userPermissions.length} Overrides
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">None</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenUserOverrides(user)}
                          className="flex items-center gap-1 ml-auto px-3.5 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-teal-600" /> Manage Access
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Security Auditing Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-50 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Security Audit Trail</h3>
              <p className="text-xs text-slate-400">Tamper-proof real-time audit logs capturing authorization shifts, custom roles creation, and administrative edits.</p>
            </div>
            
            {/* Interactive Search */}
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit trail by keyword..."
                value={auditSearchQuery}
                onChange={e => setAuditSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl">
            <span className="text-xs text-slate-400 flex items-center gap-1 font-bold uppercase tracking-wider pl-1 mr-2"><Filter className="w-3.5 h-3.5" /> Filters:</span>
            
            <select
              value={auditFilterAction}
              onChange={e => setAuditFilterAction(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white rounded-lg border border-slate-200 text-slate-600 outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">All Actions</option>
              <option value="ACCESS_DENIED">ACCESS_DENIED</option>
              <option value="CREATE_ROLE">CREATE_ROLE</option>
              <option value="UPDATE_ROLE">UPDATE_ROLE</option>
              <option value="DELETE_ROLE">DELETE_ROLE</option>
              <option value="ASSIGN_USER_ROLE">ASSIGN_USER_ROLE</option>
              <option value="UPDATE_USER_PERMISSIONS">UPDATE_USER_PERMISSIONS</option>
            </select>

            <select
              value={auditFilterResource}
              onChange={e => setAuditFilterResource(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white rounded-lg border border-slate-200 text-slate-600 outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">All Resource Types</option>
              <option value="custom_role">custom_role</option>
              <option value="user">user</option>
              <option value="view_audit_logs">view_audit_logs</option>
              <option value="manage_roles_permissions">manage_roles_permissions</option>
            </select>

            {(auditFilterAction || auditFilterResource || auditSearchQuery) && (
              <button 
                onClick={() => { setAuditFilterAction(''); setAuditFilterResource(''); setAuditSearchQuery(''); }}
                className="px-3 py-1 bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>

          {auditLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading audit trail...</div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No matching audit logs recorded.</div>
          ) : (
            <div className="space-y-2">
              {filteredAuditLogs.map(log => {
                const isExpanded = expandedLogId === log.id;
                const isDeny = log.action === 'ACCESS_DENIED';
                
                return (
                  <div 
                    key={log.id} 
                    className={`border rounded-xl transition-all ${
                      isExpanded 
                        ? 'border-slate-300 bg-slate-50/20' 
                        : isDeny 
                          ? 'border-rose-100 bg-rose-50/10 hover:bg-rose-50/20' 
                          : 'border-slate-100 hover:bg-slate-50/60'
                    }`}
                  >
                    {/* Log Main Bar */}
                    <div 
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isDeny ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Lock className="w-4 h-4" />
                        </div>
                        
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{log.user?.name || 'System / Auto'}</span>
                            <span className="text-xs text-slate-400 font-mono">({log.user?.email || 'system-agent'})</span>
                            
                            {/* Action badge */}
                            <span className={`px-2 py-0.5 font-bold rounded text-[9px] uppercase tracking-wide ${
                              isDeny 
                                ? 'bg-rose-100 text-rose-700' 
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {log.action}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-500 mt-1">
                            Operated on resource <span className="font-semibold text-slate-600 font-mono text-[11px] bg-slate-50 px-1 py-0.5 rounded">{log.resource}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono text-slate-400 self-end sm:self-auto">
                        <div className="text-right">
                          <p>{new Date(log.createdAt).toLocaleString()}</p>
                          <p className="text-[10px] text-slate-300">IP: {log.ipAddress || '127.0.0.1'}</p>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180 text-slate-600' : 'text-slate-300'}`} />
                      </div>
                    </div>

                    {/* Expandable Details Panel */}
                    {isExpanded && (
                      <div className="px-14 pb-4 border-t border-slate-100 pt-3 space-y-3">
                        <div>
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Log Payload Detail</h5>
                          <pre className="mt-2 text-xs text-slate-600 bg-slate-900 text-slate-100 p-4 rounded-xl font-mono overflow-x-auto whitespace-pre-wrap max-h-60 shadow-inner">
                            {(() => {
                              try {
                                return JSON.stringify(JSON.parse(log.details), null, 2);
                              } catch (e) {
                                return log.details;
                              }
                            })()}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREATE / EDIT CUSTOM ROLE */}
      {isRoleModalOpen && (
        <div id="role_editor_modal" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {roleModalMode === 'create' ? 'Create Custom Clinic Role' : 'Edit Custom Clinic Role'}
                </h3>
                <p className="text-xs text-slate-400">Map a descriptive role name and select explicit permission bundles.</p>
              </div>
              <button 
                onClick={() => setIsRoleModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Role Name</label>
                <input
                  type="text"
                  placeholder="e.g., Head Nurse, Senior Accountant"
                  value={roleFormName}
                  onChange={e => setRoleFormName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-semibold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Description</label>
                <textarea
                  placeholder="Summarize key responsibilities of this custom role..."
                  value={roleFormDesc}
                  onChange={e => setRoleFormDesc(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm text-slate-600"
                />
              </div>

              {/* Permissions Checklist in Modal */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Select Allowed Permissions</label>
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {Object.entries(groupedPerms).map(([grpName, grpPerms]) => (
                    <div key={grpName} className="p-3 bg-slate-50/20 space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{grpName}</span>
                      <div className="space-y-1.5 pl-1">
                        {grpPerms.map(p => {
                          const checked = roleFormPermissions.includes(p.id);
                          return (
                            <label 
                              key={p.id} 
                              className="flex items-start gap-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleFormPermission(p.id)}
                                className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300 w-3.5 h-3.5 cursor-pointer"
                              />
                              <div>
                                <span className="font-semibold block">{p.name}</span>
                                <span className="text-[10px] text-slate-400 block">{p.description}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-medium text-slate-600 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRole}
                disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {createRoleMutation.isPending || updateRoleMutation.isPending ? 'Saving...' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE USER OVERRIDES AND POLICY ASSIGNMENT */}
      {isUserOverrideModalOpen && selectedUserId && (
        <div id="user_override_modal" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Manage Access for {clinicUsers.find(u => u.id === selectedUserId)?.name}
                </h3>
                <p className="text-xs text-slate-400">Map custom roles and customize explicit overrides (inheriting, forcing, or blocking permissions).</p>
              </div>
              <button 
                onClick={() => setIsUserOverrideModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Scrollable Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Role dropdown selection */}
              <div className="space-y-1 bg-slate-50 p-4 rounded-xl">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Enterprise Custom Role Mapping</label>
                <select
                  value={userRoleSelection}
                  onChange={e => setUserRoleSelection(e.target.value)}
                  className="w-full mt-1.5 px-4 py-2 bg-white rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">No Custom Role (Inherit Standard System Default)</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name} ({role.permissions.length} perms)</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">If set to No Custom Role, permission policies fall back to standard clinic system default templates.</p>
              </div>

              {/* Overrides Selection Panel */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Explicit User-Level Overrides</label>
                  <span className="text-[10px] bg-amber-50 text-amber-700 font-semibold border border-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> High Precedence overrides
                  </span>
                </div>

                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {Object.entries(groupedPerms).map(([gName, gPerms]) => (
                    <div key={gName} className="p-3 bg-slate-50/10 space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block border-b border-slate-100/40 pb-1">{gName}</span>
                      
                      <div className="space-y-2">
                        {gPerms.map(p => {
                          const currentState = userOverrides[p.id] || 'inherit';
                          
                          return (
                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-1 bg-white p-2.5 rounded-lg border border-slate-50 shadow-sm">
                              <div>
                                <span className="text-xs font-bold text-slate-700 block">{p.name}</span>
                                <span className="text-[10px] text-slate-400 block leading-tight">{p.description}</span>
                              </div>

                              {/* Three-State Toggle Button Group */}
                              <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0 h-max self-start sm:self-auto border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => handleToggleOverride(p.id, 'inherit')}
                                  className={`px-2 py-1 text-[10px] font-bold rounded transition-all cursor-pointer ${
                                    currentState === 'inherit' 
                                      ? 'bg-white text-slate-700 shadow-sm' 
                                      : 'text-slate-400 hover:text-slate-600'
                                  }`}
                                >
                                  Inherit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleOverride(p.id, 'grant')}
                                  className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-0.5 cursor-pointer ${
                                    currentState === 'grant' 
                                      ? 'bg-emerald-500 text-white shadow-sm' 
                                      : 'text-slate-400 hover:text-emerald-600'
                                  }`}
                                >
                                  <Unlock className="w-2.5 h-2.5" /> Force Grant
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleOverride(p.id, 'deny')}
                                  className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-0.5 cursor-pointer ${
                                    currentState === 'deny' 
                                      ? 'bg-rose-500 text-white shadow-sm' 
                                      : 'text-slate-400 hover:text-rose-600'
                                  }`}
                                >
                                  <Lock className="w-2.5 h-2.5" /> Block Deny
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsUserOverrideModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-medium text-slate-600 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUserPermissions}
                disabled={assignUserRoleMutation.isPending || saveUserOverridesMutation.isPending}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {assignUserRoleMutation.isPending || saveUserOverridesMutation.isPending ? 'Saving Override...' : 'Apply Security Policy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
