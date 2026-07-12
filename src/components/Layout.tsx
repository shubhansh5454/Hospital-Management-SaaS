import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from './AuthContext.tsx';
import { useRealTime } from './RealTimeContext.tsx';
import GlobalSearch from './GlobalSearch.tsx';
import { 
  HeartPulse, 
  LayoutDashboard, 
  Users, 
  Calendar, 
  LogOut, 
  User as UserIcon,
  ShieldAlert,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Clock,
  Stethoscope,
  Receipt,
  Pill,
  Beaker,
  Package,
  Bell,
  FileBarChart2,
  Folder,
  Video,
  Shield,
  UserCheck,
  Database,
  Search
} from 'lucide-react';
import { UserRole } from '../types/index.ts';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface ToastItem {
  id: number;
  title: string;
  message: string;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { profile, logout, updateRoleInProfile, refreshProfile } = useAuth();
  const { isConnected } = useRealTime();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Listen for global keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Listen for global real-time notifications
  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastItem>;
      if (customEvent.detail) {
        const { title, message, id } = customEvent.detail;
        setToasts((prev) => [...prev, { id, title, message }]);
        
        // Auto-remove toast after 5 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
      }
    };

    window.addEventListener('sanctuary-live-toast', handleToast);
    return () => {
      window.removeEventListener('sanctuary-live-toast', handleToast);
    };
  }, []);

  const menuItems = [
    { id: 'saas', name: 'SaaS Super Admin', icon: ShieldAlert, roles: ['superadmin'] },
    { id: 'clinic-settings', name: 'Clinic Settings & SaaS', icon: Package, roles: ['admin'] },
    { id: 'roles-permissions', name: 'Roles & Access Matrix', icon: ShieldAlert, roles: ['admin'] },
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, roles: ['superadmin', 'admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'reception', name: 'Reception & Queue', icon: Clock, roles: ['admin', 'receptionist', 'doctor'] },
    { id: 'emr', name: 'Medical Records', icon: HeartPulse, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'doctors', name: 'Doctors', icon: Stethoscope, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'patients', name: 'Patients List', icon: Users, roles: ['admin', 'doctor', 'receptionist'] },
    { id: 'appointments', name: 'Appointments', icon: Calendar, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'billing', name: 'Billing & Invoices', icon: Receipt, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'pharmacy', name: 'Pharmacy', icon: Pill, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'laboratory', name: 'Laboratory', icon: Beaker, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'inventory', name: 'Inventory & Supplies', icon: Package, roles: ['admin', 'doctor', 'receptionist'] },
    { id: 'notifications', name: 'Notifications', icon: Bell, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'reports', name: 'Reports & Analytics', icon: FileBarChart2, roles: ['admin', 'doctor', 'receptionist'] },
    { id: 'documents', name: 'Document Center', icon: Folder, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'ai-assistant', name: 'AI Clinical Suite', icon: Sparkles, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'video-consultation', name: 'Video Consultation', icon: Video, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'insurance', name: 'Insurance & Claims', icon: Shield, roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    { id: 'hr', name: 'HR Management', icon: UserCheck, roles: ['admin', 'doctor', 'receptionist', 'superadmin'] },
    { id: 'backup', name: 'Backup & Restore', icon: Database, roles: ['admin', 'superadmin'] },
  ];



  const handleRoleChange = async (newRole: UserRole) => {
    await updateRoleInProfile(newRole);
    setRoleDropdownOpen(false);
  };

  const handleSync = async () => {
    setRefreshing(true);
    await refreshProfile();
    setTimeout(() => setRefreshing(false), 800);
  };

  const currentRole = profile?.role || 'patient';
  const visibleMenuItems = menuItems.filter(item => item.roles.includes(currentRole));

  return (
    <div id="layout_root" className="min-h-screen flex bg-[#f8fafc] font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col justify-between shadow-[1px_0_10px_rgba(0,0,0,0.01)] shrink-0">
        <div>
          {/* Logo Brand Header */}
          <div className="h-16 border-b border-slate-100 flex items-center px-6 gap-3">
            <div className="w-8 h-8 bg-teal-500 text-white rounded-lg flex items-center justify-center font-bold shadow-sm">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold text-slate-800 text-base block tracking-tight">CareSync</span>
              <span className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider block -mt-1">Clinic SaaS</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive 
                      ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/10' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Identity Footer */}
        <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-50 border border-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-semibold text-sm">
              {profile?.name?.substring(0, 2).toUpperCase() || 'US'}
            </div>
            <div className="overflow-hidden">
              <span className="font-semibold text-xs text-slate-800 block truncate">{profile?.name || 'User'}</span>
              <span className="text-[10px] text-slate-400 block truncate">{profile?.email || 'user@example.com'}</span>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full h-9 border border-slate-200 hover:bg-red-50 hover:border-red-100 hover:text-red-600 bg-white text-slate-600 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header / Toolbar */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-display font-bold text-slate-800 capitalize">
              {activeTab} Overview
            </h2>
            
            {/* Sync trigger button */}
            <button 
              onClick={handleSync}
              title="Sync with cloud database"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-teal-500' : ''}`} />
            </button>

            {/* Live Gateway Connection Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-teal-500 shadow-[0_0_8px_#14b8a6]' : 'bg-rose-400 shadow-[0_0_8px_#fb7185]'} animate-pulse`} />
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider select-none">
                {isConnected ? 'Real-Time Live' : 'Offline (Reconnecting)'}
              </span>
            </div>

            {/* Premium Global Search Trigger Bar Button */}
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="h-9 px-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-500 flex items-center gap-3 transition-all duration-150 cursor-pointer shadow-sm group"
            >
              <Search className="w-4 h-4 text-slate-400 group-hover:text-teal-500 transition-colors" />
              <span className="text-slate-400 group-hover:text-slate-600 transition-colors">Search anything...</span>
              <kbd className="bg-white text-[10px] text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 shadow-sm font-mono tracking-tight shrink-0">⌘K</kbd>
            </button>
          </div>

          {/* Sandbox Role Switcher Controller */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100/70 px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Sandbox Mode</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="h-9 px-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 flex items-center gap-2 transition-all duration-150 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Role: <strong className="text-teal-700 capitalize">{currentRole}</strong></span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-50">
                  <div className="px-3 py-1.5 border-b border-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Switch Active Role
                  </div>
                  {(['superadmin', 'admin', 'doctor', 'receptionist', 'patient'] as UserRole[]).map((roleVal) => (
                    <button
                      key={roleVal}
                      onClick={() => handleRoleChange(roleVal)}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium capitalize flex items-center justify-between cursor-pointer ${
                        currentRole === roleVal 
                          ? 'text-teal-600 bg-teal-50/50' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span>{roleVal}</span>
                      {currentRole === roleVal && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content canvas */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Search command palette overlay */}
      <GlobalSearch 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        setActiveTab={setActiveTab} 
      />

      {/* Floating Real-Time Toast Notification Gateway Portal */}
      <div id="live_toast_portal" className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full select-none">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className="bg-white/95 backdrop-blur-sm border-l-4 border-teal-500 shadow-[0_10px_30px_rgba(0,0,0,0.08)] rounded-xl p-4 flex flex-col gap-1 transition-all duration-300 transform translate-y-0 scale-100 border border-slate-100/50 hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="font-display font-bold text-xs text-slate-800 tracking-tight">{t.title}</span>
              <button 
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} 
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-50"
              >
                &times;
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">{t.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
