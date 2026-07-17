import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Activity, 
  Key, 
  Settings, 
  RefreshCw, 
  Play, 
  Layers, 
  HeartPulse, 
  ShieldAlert, 
  ExternalLink,
  ChevronRight,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';

interface IntegrationProvider {
  id: string;
  name: string;
  category: 'payment' | 'sms' | 'email' | 'whatsapp' | 'ai' | 'calendar' | 'cloud_storage';
  isActive: boolean;
  healthStatus: 'healthy' | 'degraded' | 'offline';
  latencyMs: number;
  lastChecked: string;
  credentials: Record<string, string>;
  settings: Record<string, any>;
}

export default function IntegrationHub() {
  const queryClient = useQueryClient();
  const token = localStorage.getItem('token');
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  
  // Credentials edit forms
  const [editedCredentials, setEditedCredentials] = useState<Record<string, string>>({});
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({});

  // Fetch Providers
  const { data: providers = [], isLoading: loadingProviders, isFetching } = useQuery<IntegrationProvider[]>({
    queryKey: ['integration-providers'],
    queryFn: async () => {
      const res = await fetch('/api/integrations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load integration providers');
      return res.json();
    }
  });

  // Mutation: Switch Active Provider
  const switchProviderMutation = useMutation({
    mutationFn: async (data: { category: string; providerId: string }) => {
      const res = await fetch('/api/integrations/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to toggle active provider');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-providers'] });
    }
  });

  // Mutation: Run Diagnostic Ping
  const pingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/integrations/ping', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to run diagnostics audit');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-providers'] });
    }
  });

  // Mutation: Update Configuration Details
  const updateConfigMutation = useMutation({
    mutationFn: async (data: { id: string; credentials: any; settings: any }) => {
      const res = await fetch(`/api/integrations/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          credentials: data.credentials,
          settings: data.settings
        })
      });
      if (!res.ok) throw new Error('Failed to update credentials');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-providers'] });
      setEditingProviderId(null);
    }
  });

  const categoriesList: { id: string; name: string; desc: string }[] = [
    { id: 'payment', name: 'Billing & Payment Gateways', desc: 'Settle and process patient ledger payments safely.' },
    { id: 'sms', name: 'Transactional SMS Services', desc: 'Direct alerts, verification messages, and text marketing drivers.' },
    { id: 'email', name: 'Enterprise Email Relays', desc: 'Automate invoices, health summaries, and password renewals.' },
    { id: 'whatsapp', name: 'Meta WhatsApp Business', desc: 'Interactive chat messages, alerts, and bot services.' },
    { id: 'ai', name: 'Artificial Intelligence (AI)', desc: 'Configure LLMs, clinical note transcriptions, and diagnosis helpers.' },
    { id: 'calendar', name: 'Calendar Synchronization', desc: 'Map local rosters and consultations with external calendar schedules.' },
    { id: 'cloud_storage', name: 'HIPAA Document Cloud Storage', desc: 'Secure medical imaging, prescriptions, and PACS scan folders.' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5 text-left">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-800 tracking-tight">External Integration Hub</h1>
          <p className="text-xs text-slate-500">Configure client credentials, active switches, and latency diagnostics for third-party medical cloud networks.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => pingMutation.mutate()}
            disabled={pingMutation.isPending}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <Activity className="w-4 h-4 animate-pulse text-teal-600" /> 
            {pingMutation.isPending ? 'Pinging...' : 'Perform Health Audit'}
          </button>
        </div>
      </div>

      {/* Categories layout */}
      <div className="space-y-6 text-left">
        {categoriesList.map((cat) => {
          const matchedProviders = providers.filter(p => p.category === cat.id);
          const activeProvider = matchedProviders.find(p => p.isActive);

          return (
            <div key={cat.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Category Info Header */}
              <div className="bg-slate-50/50 px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-teal-600" /> {cat.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{cat.desc}</p>
                </div>
                {activeProvider && (
                  <span className="text-[10px] bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 self-start sm:self-auto">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 animate-pulse" /> Active: {activeProvider.name}
                  </span>
                )}
              </div>

              {/* Providers Sub-List */}
              <div className="divide-y divide-slate-100">
                {matchedProviders.map((prov) => {
                  const isEditing = prov.id === editingProviderId;
                  
                  return (
                    <div key={prov.id} className="p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-slate-800 text-xs">{prov.name}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              prov.healthStatus === 'healthy' ? 'bg-green-50 text-green-600' :
                              prov.healthStatus === 'degraded' ? 'bg-amber-50 text-amber-600' :
                              'bg-rose-50 text-rose-600'
                            }`}>
                              ● {prov.healthStatus.toUpperCase()}
                            </span>
                            {prov.isActive && (
                              <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                ACTIVE DRIVER
                              </span>
                            )}
                          </div>
                          
                          {/* Metrics logs */}
                          <p className="text-[10px] text-slate-400 font-medium">
                            Latency: <span className="font-semibold font-mono text-slate-500">{prov.latencyMs ? `${prov.latencyMs}ms` : 'Offline'}</span>
                            <span className="mx-2">|</span>
                            Last Checked: {prov.lastChecked ? new Date(prov.lastChecked).toLocaleTimeString() : 'Never'}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          {!prov.isActive && (
                            <button
                              onClick={() => switchProviderMutation.mutate({ category: cat.id, providerId: prov.id })}
                              className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition"
                            >
                              Switch to Driver
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (isEditing) {
                                setEditingProviderId(null);
                              } else {
                                setEditingProviderId(prov.id);
                                setEditedCredentials(prov.credentials);
                                setEditedSettings(prov.settings);
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-teal-600 transition"
                            title="Edit Credentials"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Edit form */}
                      {isEditing && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4 text-xs animate-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2 border-b border-slate-100 pb-2">
                            <Key className="w-3.5 h-3.5 text-teal-600" /> Edit Credentials & Properties
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Render dynamic credential keys */}
                            <div className="space-y-3">
                              <span className="block font-bold text-slate-500 text-[9px] uppercase tracking-wide">Secure Keys / Secrets</span>
                              {Object.keys(prov.credentials).map((key) => (
                                <div key={key}>
                                  <label className="block text-[10px] text-slate-600 mb-0.5 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                                  <input
                                    type="password"
                                    value={editedCredentials[key] || ''}
                                    onChange={(e) => setEditedCredentials({
                                      ...editedCredentials,
                                      [key]: e.target.value
                                    })}
                                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                                    placeholder={`Enter secure ${key}...`}
                                  />
                                </div>
                              ))}
                            </div>

                            {/* Render dynamic settings */}
                            <div className="space-y-3">
                              <span className="block font-bold text-slate-500 text-[9px] uppercase tracking-wide">Driver Options</span>
                              {Object.keys(prov.settings).map((key) => {
                                const val = editedSettings[key];
                                const isBool = typeof val === 'boolean';
                                
                                return (
                                  <div key={key}>
                                    <label className="block text-[10px] text-slate-600 mb-0.5 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                                    {isBool ? (
                                      <select
                                        value={val ? 'true' : 'false'}
                                        onChange={(e) => setEditedSettings({
                                          ...editedSettings,
                                          [key]: e.target.value === 'true'
                                        })}
                                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                                      >
                                        <option value="true">Enabled (True)</option>
                                        <option value="false">Disabled (False)</option>
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        value={val || ''}
                                        onChange={(e) => setEditedSettings({
                                          ...editedSettings,
                                          [key]: e.target.value
                                        })}
                                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/40">
                            <button
                              onClick={() => setEditingProviderId(null)}
                              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => updateConfigMutation.mutate({
                                id: prov.id,
                                credentials: editedCredentials,
                                settings: editedSettings
                              })}
                              disabled={updateConfigMutation.isPending}
                              className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-semibold shadow-xs"
                            >
                              {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
