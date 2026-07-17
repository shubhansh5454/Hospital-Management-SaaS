import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  ShieldAlert, 
  User, 
  ArrowRight, 
  Plus, 
  Activity, 
  FileSignature, 
  Sparkles,
  RefreshCw,
  Send,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';

interface WorkflowStep {
  id: string;
  name: string;
  type: 'automatic' | 'approval' | 'manual_action' | 'condition';
  assignedRole?: string;
  assignedUserId?: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'SKIPPED';
  completedBy?: string;
  completedAt?: string;
  escalationHours?: number;
  escalatedTo?: string;
  escalatedAt?: string;
  conditionExpression?: string;
  nextStepIdSuccess?: string;
  nextStepIdFailure?: string;
  nextStepIdDefault?: string;
  notes?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'clinical' | 'billing' | 'laboratory' | 'pharmacy';
  steps: WorkflowStep[];
}

interface WorkflowInstance {
  id: string;
  templateId: string;
  name: string;
  status: 'RUNNING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
  currentStepId: string;
  variables: Record<string, any>;
  history: {
    timestamp: string;
    action: string;
    operator: string;
    details: string;
  }[];
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export default function WorkflowEngine() {
  const queryClient = useQueryClient();
  const token = localStorage.getItem('token');
  const [activeTab, setActiveTab] = useState<'instances' | 'templates' | 'builder'>('instances');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [showStartModal, setShowStartModal] = useState<string | null>(null); // template ID
  
  // Instance start parameters
  const [newInstanceName, setNewInstanceName] = useState('');
  const [claimAmount, setClaimAmount] = useState('5500');
  const [potassiumLevel, setPotassiumLevel] = useState('6.2');

  // Load Templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery<WorkflowTemplate[]>({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      const res = await fetch('/api/workflows/templates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load templates');
      return res.json();
    }
  });

  // Load Active Workflows
  const { data: instances = [], isLoading: loadingInstances } = useQuery<WorkflowInstance[]>({
    queryKey: ['workflow-instances'],
    queryFn: async () => {
      const res = await fetch('/api/workflows/instances', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load instances');
      return res.json();
    },
    refetchInterval: 5000 // poll every 5s for smooth visual state updates
  });

  // Mutation: Start Instance
  const startWorkflowMutation = useMutation({
    mutationFn: async (data: { templateId: string; name: string; variables: any }) => {
      const res = await fetch('/api/workflows/instances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to instantiate workflow');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
      setShowStartModal(null);
      setSelectedInstanceId(data.id);
      setNewInstanceName('');
    }
  });

  // Mutation: Approve / Complete Task
  const approveStepMutation = useMutation({
    mutationFn: async (data: { instanceId: string; stepId: string; approved: boolean; notes: string }) => {
      const res = await fetch(`/api/workflows/instances/${data.instanceId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          stepId: data.stepId,
          approved: data.approved,
          notes: data.notes
        })
      });
      if (!res.ok) throw new Error('Failed to process step action');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
    }
  });

  // Mutation: Escalate Task
  const escalateStepMutation = useMutation({
    mutationFn: async (data: { instanceId: string; stepId: string }) => {
      const res = await fetch(`/api/workflows/instances/${data.instanceId}/escalate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stepId: data.stepId })
      });
      if (!res.ok) throw new Error('Failed to trigger SLA escalation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
    }
  });

  const selectedInstance = instances.find(i => i.id === selectedInstanceId);

  return (
    <div className="space-y-6">
      {/* Module Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-800 tracking-tight">Enterprise Workflow Engine</h1>
          <p className="text-xs text-slate-500">Orchestrate visual hospital protocols, SLA escalations, manual approvals, and automatic state transitions.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
              queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
            }}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            title="Refresh State"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('instances')}
          className={`px-4 py-2 border-b-2 font-medium text-xs tracking-wide transition-colors ${activeTab === 'instances' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Active Run Instances
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 border-b-2 font-medium text-xs tracking-wide transition-colors ${activeTab === 'templates' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Reusable Templates
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`px-4 py-2 border-b-2 font-medium text-xs tracking-wide transition-colors ${activeTab === 'builder' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Visual Protocol Designer
        </button>
      </div>

      {/* Main Content Areas */}
      {activeTab === 'instances' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Instances List */}
          <div className="lg:col-span-1 space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm min-h-[500px]">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Workflow Instances</h2>
            {loadingInstances && templates.length === 0 ? (
              <p className="text-xs text-slate-400 p-4">Syncing state instances...</p>
            ) : instances.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No active workflows currently running.</p>
                <button 
                  onClick={() => setActiveTab('templates')}
                  className="mt-3 text-xs bg-teal-500 text-white font-medium px-3 py-1.5 rounded-lg hover:bg-teal-600 transition"
                >
                  Start from Template
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {instances.map((inst) => {
                  const isActive = inst.id === selectedInstanceId;
                  const currentStep = inst.steps.find(s => s.id === inst.currentStepId);
                  
                  return (
                    <div
                      key={inst.id}
                      onClick={() => setSelectedInstanceId(inst.id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${isActive ? 'bg-teal-50/50 border-teal-500 shadow-sm' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-xs text-slate-800 truncate max-w-[150px]">{inst.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          inst.status === 'RUNNING' ? 'bg-blue-50 text-blue-600' :
                          inst.status === 'COMPLETED' ? 'bg-green-50 text-green-600' :
                          inst.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          {inst.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">ID: {inst.id}</p>
                      
                      {inst.status === 'RUNNING' && currentStep && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">
                          <Activity className="w-3 h-3 animate-pulse" />
                          <span className="font-medium truncate">Awaiting: {currentStep.name}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Instance Detail and Auditing */}
          <div className="lg:col-span-2 space-y-4">
            {selectedInstance ? (
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                {/* Header info */}
                <div className="flex flex-col md:flex-row justify-between border-b border-slate-50 pb-4 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-teal-600 tracking-wider">Active Instance Run</span>
                    <h3 className="text-base font-bold text-slate-800">{selectedInstance.name}</h3>
                    <p className="text-xs text-slate-400">Instantiated on: {new Date(selectedInstance.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Workflow Status</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectedInstance.status === 'RUNNING' ? 'bg-blue-50 text-blue-600' :
                      selectedInstance.status === 'COMPLETED' ? 'bg-green-50 text-green-600' :
                      selectedInstance.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {selectedInstance.status}
                    </span>
                  </div>
                </div>

                {/* Instance variables summary */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Claims Evaluated</span>
                    <p className="text-xs font-semibold text-slate-700">${selectedInstance.variables.totalAmount || '0.00'}</p>
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Potassium Level</span>
                    <p className="text-xs font-semibold text-slate-700">{selectedInstance.variables.potassium || 'N/A'}</p>
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Insurance Driver</span>
                    <p className="text-xs font-semibold text-slate-700">{selectedInstance.variables.insuranceProvider || 'None'}</p>
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Patient Age</span>
                    <p className="text-xs font-semibold text-slate-700">{selectedInstance.variables.age || 'Unknown'}</p>
                  </div>
                </div>

                {/* Dynamic visual step pipeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Protocol Sequence Steps</h4>
                  <div className="relative border-l-2 border-slate-100 pl-5 ml-2.5 space-y-6 text-left">
                    {selectedInstance.steps.map((step, idx) => {
                      const isActive = selectedInstance.currentStepId === step.id && selectedInstance.status === 'RUNNING';
                      const isCompleted = step.status === 'COMPLETED';
                      const isRejected = step.status === 'REJECTED';
                      
                      return (
                        <div key={step.id} className="relative">
                          {/* Circle state node */}
                          <div className={`absolute -left-[27px] top-1 w-4 h-4 rounded-full flex items-center justify-center border-2 bg-white ${
                            isCompleted ? 'border-green-500 bg-green-500 text-white' :
                            isRejected ? 'border-rose-500 bg-rose-500 text-white' :
                            isActive ? 'border-teal-500 text-teal-500 animate-pulse' :
                            'border-slate-300 text-slate-400'
                          }`}>
                            {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {isRejected && <AlertTriangle className="w-3.5 h-3.5" />}
                          </div>

                          <div className={`p-3 rounded-xl border ${isActive ? 'bg-amber-50/50 border-amber-200' : 'border-slate-50'}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-semibold text-xs text-slate-800">{step.name}</span>
                                <span className="ml-2 text-[9px] uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold">{step.type}</span>
                              </div>
                              {step.assignedRole && (
                                <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Role: {step.assignedRole}
                                </span>
                              )}
                            </div>

                            {step.conditionExpression && (
                              <p className="text-[10px] text-slate-500 mt-1 font-mono">Expression: {step.conditionExpression}</p>
                            )}

                            {step.notes && (
                              <p className="text-[10px] text-slate-500 mt-1 italic">Note: {step.notes}</p>
                            )}

                            {isCompleted && step.completedBy && (
                              <p className="text-[9px] text-green-600 mt-1">Processed by {step.completedBy} on {new Date(step.completedAt!).toLocaleTimeString()}</p>
                            )}

                            {/* SLA and Escalations display */}
                            {step.escalationHours && (
                              <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                                <span className="text-[9px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                                  <Clock className="w-3 h-3" /> SLA Limit: {step.escalationHours}h
                                </span>
                                {step.escalatedTo && (
                                  <span className="text-[9px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold">
                                    <ShieldAlert className="w-3 h-3 animate-bounce" /> Escalated to {step.escalatedTo}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Interactive Task Actions */}
                            {isActive && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {step.type === 'approval' && (
                                  <>
                                    <button
                                      onClick={() => approveStepMutation.mutate({
                                        instanceId: selectedInstance.id,
                                        stepId: step.id,
                                        approved: true,
                                        notes: 'Approved medical director review criteria.'
                                      })}
                                      className="text-[10px] bg-green-500 hover:bg-green-600 text-white font-bold px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition"
                                    >
                                      <CheckCircle2 className="w-3 h-3" /> Approve Step
                                    </button>
                                    <button
                                      onClick={() => approveStepMutation.mutate({
                                        instanceId: selectedInstance.id,
                                        stepId: step.id,
                                        approved: false,
                                        notes: 'Rejected clinical review, criteria unfulfilled.'
                                      })}
                                      className="text-[10px] bg-rose-500 hover:bg-rose-600 text-white font-bold px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition"
                                    >
                                      <AlertTriangle className="w-3 h-3" /> Reject Step
                                    </button>
                                  </>
                                )}

                                {step.type === 'manual_action' && (
                                  <button
                                    onClick={() => approveStepMutation.mutate({
                                      instanceId: selectedInstance.id,
                                      stepId: step.id,
                                      approved: true,
                                      notes: 'Manual action executed successfully.'
                                    })}
                                    className="text-[10px] bg-teal-500 hover:bg-teal-600 text-white font-bold px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition"
                                  >
                                    <FileSignature className="w-3 h-3" /> Mark Task Completed
                                  </button>
                                )}

                                {step.escalationHours && !step.escalatedTo && (
                                  <button
                                    onClick={() => escalateStepMutation.mutate({
                                      instanceId: selectedInstance.id,
                                      stepId: step.id
                                    })}
                                    className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-bold px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition"
                                    title="Manually simulate SLA Breach"
                                  >
                                    <ShieldAlert className="w-3 h-3" /> Simulate SLA Breach
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Instance history log */}
                <div className="space-y-2 border-t border-slate-50 pt-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider text-left">Workflow Execution History</h4>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                    {selectedInstance.history.map((log, idx) => (
                      <div key={idx} className="flex justify-between items-start text-[10px] py-1 border-b border-dashed border-slate-50 text-left">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-700">
                            <span className="font-bold text-teal-600">[{log.action}]</span> {log.details}
                          </p>
                          <p className="text-[9px] text-slate-400">Triggered by: {log.operator}</p>
                        </div>
                        <span className="text-slate-400 shrink-0 text-right ml-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center min-h-[500px]">
                <Clock className="w-12 h-12 text-slate-200 mb-3" />
                <h3 className="font-semibold text-slate-700 text-sm">Select an Active Run Instance</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">Pick a running hospital protocol run from the left panel to inspect its visual pipeline, authorize approvals, trigger timers, or view complete execution telemetry logs.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between text-left space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">{tpl.category}</span>
                    <span className="text-[10px] font-mono text-slate-400">ID: {tpl.id}</span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">{tpl.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{tpl.description}</p>
                  
                  {/* Sequence mapping visual list */}
                  <div className="mt-4 pt-4 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Configured Sequence Sequence</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tpl.steps.map((s, idx) => (
                        <React.Fragment key={s.id}>
                          <span className="text-[9px] bg-slate-50 border border-slate-100 text-slate-600 font-semibold px-2 py-1 rounded-md" title={s.type}>
                            {s.name}
                          </span>
                          {idx < tpl.steps.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-slate-300" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-50 flex justify-end">
                  <button
                    onClick={() => {
                      setShowStartModal(tpl.id);
                      setNewInstanceName(`Run: ${tpl.name} [Manual]`);
                    }}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition"
                  >
                    <Play className="w-3.5 h-3.5" /> Start Workflow Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'builder' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-left space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="w-5 h-5 text-teal-600 animate-pulse" />
            <h3 className="font-bold text-slate-800 text-sm">Interactive visual Workflow designer playground</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Drag-and-drop clinical nodes and define logical conditions inside the interactive canvas. Design complete automated SLAs, alerts, and escalation triggers easily.
          </p>
          
          <div className="border border-dashed border-slate-200 rounded-xl p-12 bg-slate-50/50 flex flex-col items-center justify-center space-y-3">
            <Activity className="w-8 h-8 text-teal-500/20" />
            <span className="text-xs text-slate-400 font-medium">Drag-and-Drop Canvas Workspace</span>
            <p className="text-[10px] text-slate-400 max-w-md text-center">In development for production. Use standard "Reusable Templates" to trigger billing claims validation or lab escalation tests immediately.</p>
          </div>
        </div>
      )}

      {/* Start Workflow Run Modal */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 text-left space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Instantiate Clinical Protocol Run</h3>
              <p className="text-xs text-slate-400">Initiate an active workflow run instance and pass baseline variables context into the rule-evaluation router.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Instance Name</label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                  placeholder="e.g. Patient Admission claim evaluation"
                />
              </div>

              {showStartModal === 'tmpl-billing-approval' ? (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Test Claim Amount ($)</label>
                  <input
                    type="number"
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5">Claims over $5,000 automatically trigger human reviews.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Blood Potassium Level (mEq/L)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={potassiumLevel}
                    onChange={(e) => setPotassiumLevel(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5">Potassium level exceeding 5.5 mEq/L automatically triggers emergency alerts.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowStartModal(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const variables = showStartModal === 'tmpl-billing-approval' 
                    ? { totalAmount: Number(claimAmount), insuranceProvider: 'Medicare', age: 72 }
                    : { potassium: Number(potassiumLevel), age: 45 };
                  
                  startWorkflowMutation.mutate({
                    templateId: showStartModal,
                    name: newInstanceName,
                    variables
                  });
                }}
                disabled={startWorkflowMutation.isPending}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white transition flex items-center gap-1"
              >
                {startWorkflowMutation.isPending ? 'Starting...' : 'Instantiate Run'} <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
