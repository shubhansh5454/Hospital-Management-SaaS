import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Settings2, 
  Play, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Cpu, 
  Sliders, 
  Layers, 
  RefreshCw,
  Send,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { motion } from 'motion/react';

interface RuleCondition {
  field: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'contains' | 'matches';
  value: string;
}

interface RuleAction {
  targetField: string;
  actionType: 'set_value' | 'apply_discount_percentage' | 'trigger_alert' | 'calculate_formula';
  value: string;
}

interface BusinessRule {
  id: string;
  name: string;
  description: string;
  category: 'billing' | 'appointment' | 'pharmacy' | 'laboratory' | 'clinical' | 'validation';
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
}

export default function RuleEngine() {
  const queryClient = useQueryClient();
  const token = localStorage.getItem('token');
  const [activeTab, setActiveTab] = useState<'rules' | 'playground' | 'new_rule'>('rules');
  
  // Playground state
  const [testCategory, setTestCategory] = useState<'billing' | 'laboratory' | 'pharmacy'>('billing');
  const [testPayloadStr, setTestPayloadStr] = useState(JSON.stringify({
    age: 68,
    totalAmount: 6200,
    insuranceProvider: 'Medicare',
    stockCount: 12,
    reorderLevel: 25,
    potassium: 5.8
  }, null, 2));
  
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // New Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleCategory, setRuleCategory] = useState<'billing' | 'appointment' | 'pharmacy' | 'laboratory' | 'clinical'>('billing');
  const [rulePriority, setRulePriority] = useState('10');
  const [condField, setCondField] = useState('age');
  const [condOperator, setCondOperator] = useState<'greater_than' | 'less_than' | 'equals' | 'not_equals'>('greater_than');
  const [condValue, setCondValue] = useState('65');
  const [actField, setActField] = useState('discountPercentage');
  const [actType, setActType] = useState<'set_value' | 'apply_discount_percentage' | 'trigger_alert' | 'calculate_formula'>('apply_discount_percentage');
  const [actValue, setActValue] = useState('15');

  // Load Rules
  const { data: rules = [], isLoading: loadingRules } = useQuery<BusinessRule[]>({
    queryKey: ['business-rules'],
    queryFn: async () => {
      const res = await fetch('/api/rules', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load rules');
      return res.json();
    }
  });

  // Mutation: Toggle Rule
  const toggleRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rules/${id}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to toggle rule state');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
    }
  });

  // Mutation: Create Rule
  const createRuleMutation = useMutation({
    mutationFn: async (rule: any) => {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(rule)
      });
      if (!res.ok) throw new Error('Failed to create rule');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
      setActiveTab('rules');
      // Reset form
      setRuleName('');
      setRuleDescription('');
    }
  });

  // Mutation: Delete Rule
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete rule');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
    }
  });

  // Mutation: Simulate / Playground Rule execution
  const simulateRuleMutation = useMutation({
    mutationFn: async (data: { category: string; payload: any }) => {
      const res = await fetch('/api/rules/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Simulation failed');
      return res.json();
    },
    onSuccess: (data) => {
      setSimulationResult(data);
    }
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-800 tracking-tight">Business Rule Engine (BRE)</h1>
          <p className="text-xs text-slate-500">Configure dynamic validation guidelines, billing waivers, pharmacy stock alert thresholds, and diagnostic escalations.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('new_rule')}
            className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Define Custom Rule
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 border-b-2 font-medium text-xs tracking-wide transition-colors ${activeTab === 'rules' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Registered Rule Set ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('playground')}
          className={`px-4 py-2 border-b-2 font-medium text-xs tracking-wide transition-colors ${activeTab === 'playground' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Simulation Playground
        </button>
        <button
          onClick={() => setActiveTab('new_rule')}
          className={`px-4 py-2 border-b-2 font-medium text-xs tracking-wide transition-colors ${activeTab === 'new_rule' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Rule Form Creator
        </button>
      </div>

      {/* List view */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {rules.map((rule) => (
              <div 
                key={rule.id} 
                className={`bg-white p-5 rounded-2xl border transition-all text-left space-y-4 ${rule.enabled ? 'border-slate-100 shadow-sm' : 'border-slate-100 opacity-65 bg-slate-50/20'}`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm">{rule.name}</h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                        {rule.category}
                      </span>
                      <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">
                        Priority: {rule.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{rule.description}</p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => toggleRuleMutation.mutate(rule.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-teal-600 transition"
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? (
                        <ToggleRight className="w-8 h-8 text-teal-500" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-slate-300" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteRuleMutation.mutate(rule.id)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Remove Rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Conditions and Actions Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-50 text-xs">
                  {/* Conditions */}
                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                      <Sliders className="w-3.5 h-3.5 text-teal-600" /> Evaluation Conditions
                    </div>
                    {rule.conditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">
                        <span className="font-semibold text-slate-800 bg-white border border-slate-100 px-1.5 py-0.5 rounded">{c.field}</span>
                        <span className="text-teal-600 font-bold">{c.operator.replace('_', ' ')}</span>
                        <span className="font-semibold text-slate-800 bg-white border border-slate-100 px-1.5 py-0.5 rounded">"{c.value}"</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                      <Cpu className="w-3.5 h-3.5 text-indigo-600" /> Execution Actions
                    </div>
                    {rule.actions.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">
                        <span className="text-slate-400">Set</span>
                        <span className="font-semibold text-slate-800 bg-white border border-slate-100 px-1.5 py-0.5 rounded">{a.targetField}</span>
                        <span className="text-indigo-600 font-bold">via {a.actionType.replace('_', ' ')}</span>
                        <span className="font-semibold text-slate-800 bg-white border border-slate-100 px-1.5 py-0.5 rounded">"{a.value}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Playground / Simulation */}
      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
          {/* Playground inputs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Cpu className="w-5 h-5 text-teal-600 animate-pulse" />
              <h3 className="font-bold text-slate-800 text-sm">Dynamic Simulation Parameters</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rule Category Context</label>
                <select
                  value={testCategory}
                  onChange={(e) => setTestCategory(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-white"
                >
                  <option value="billing">Billing Rules</option>
                  <option value="laboratory">Laboratory Rules</option>
                  <option value="pharmacy">Pharmacy Rules</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Mock Payload Context (JSON format)</label>
                <textarea
                  value={testPayloadStr}
                  onChange={(e) => setTestPayloadStr(e.target.value)}
                  rows={8}
                  className="w-full text-xs p-3 font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-slate-50"
                />
              </div>
            </div>

            <button
              onClick={() => {
                try {
                  const payload = JSON.parse(testPayloadStr);
                  simulateRuleMutation.mutate({ category: testCategory, payload });
                } catch {
                  alert('Malformed payload JSON syntax. Verify braces and quotes.');
                }
              }}
              disabled={simulateRuleMutation.isPending}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold text-xs py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition"
            >
              <Play className="w-4 h-4" /> Run Simulation Engine
            </button>
          </div>

          {/* Playground outputs */}
          <div className="space-y-4">
            {simulationResult ? (
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 text-green-600">
                  <CheckCircle2 className="w-5 h-5 animate-bounce" />
                  <h3 className="font-bold text-slate-800 text-sm">Engine Execution Results</h3>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Mutated Outputs</span>
                    <pre className="mt-1 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-[10px] overflow-x-auto text-slate-700">
                      {JSON.stringify(simulationResult.evaluated, null, 2)}
                    </pre>
                  </div>

                  <div className="bg-green-50/50 p-3 rounded-xl border border-green-100">
                    <p className="font-semibold text-green-700 text-[11px] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 animate-pulse" /> Applied rules evaluated successfully.
                    </p>
                    <p className="text-[10px] text-green-600 mt-1">
                      Check your billing waiver, automated discount rates, potassium safety levels, or pharmacy thresholds in the resulting JSON model output above!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center min-h-[350px]">
                <Cpu className="w-12 h-12 text-slate-200 mb-3" />
                <h3 className="font-semibold text-slate-700 text-sm">Simulation Output</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">Hit "Run Simulation Engine" to evaluate the registered active rules against your mock variables context and review resulting outputs dynamically.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rule Creator */}
      {activeTab === 'new_rule' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-2xl mx-auto text-left space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm">Define Custom Business Rule</h3>
            <p className="text-xs text-slate-400">Build rules visually, establish prioritizations, and configure conditional expressions.</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!ruleName || !ruleDescription) return;
              
              const payload = {
                name: ruleName,
                description: ruleDescription,
                category: ruleCategory,
                enabled: true,
                priority: Number(rulePriority),
                conditions: [
                  { field: condField, operator: condOperator, value: condValue }
                ],
                actions: [
                  { targetField: actField, actionType: actType, value: actValue }
                ]
              };
              createRuleMutation.mutate(payload);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rule Title</label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                  placeholder="e.g. Medicare Copay Waiver"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rule Category</label>
                <select
                  value={ruleCategory}
                  onChange={(e) => setRuleCategory(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500 bg-white"
                >
                  <option value="billing">Billing Rules</option>
                  <option value="appointment">Appointment Rules</option>
                  <option value="pharmacy">Pharmacy Rules</option>
                  <option value="laboratory">Laboratory Rules</option>
                  <option value="clinical">Clinical Thresholds</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Description / Intent</label>
              <textarea
                required
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                rows={2}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                placeholder="Describe rule logic and target objectives..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Execution Priority</label>
                <input
                  type="number"
                  required
                  value={rulePriority}
                  onChange={(e) => setRulePriority(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                />
                <p className="text-[9px] text-slate-400 mt-0.5">Higher numbers are evaluated and executed first.</p>
              </div>
            </div>

            {/* Visual Formula and Condition Builders */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
              <span className="text-[10px] uppercase font-bold text-teal-600 tracking-wider">Formula & Condition Builder</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">If Field</label>
                  <input
                    type="text"
                    required
                    value={condField}
                    onChange={(e) => setCondField(e.target.value)}
                    className="w-full p-2 rounded border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Operator</label>
                  <select
                    value={condOperator}
                    onChange={(e) => setCondOperator(e.target.value as any)}
                    className="w-full p-2 rounded border border-slate-200 bg-white"
                  >
                    <option value="greater_than">greater than (&gt;)</option>
                    <option value="less_than">less than (&lt;)</option>
                    <option value="equals">equals (==)</option>
                    <option value="not_equals">not equals (!=)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Value</label>
                  <input
                    type="text"
                    required
                    value={condValue}
                    onChange={(e) => setCondValue(e.target.value)}
                    className="w-full p-2 rounded border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-3 border-t border-slate-200/50">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Then Set Field</label>
                  <input
                    type="text"
                    required
                    value={actField}
                    onChange={(e) => setActField(e.target.value)}
                    className="w-full p-2 rounded border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Action Type</label>
                  <select
                    value={actType}
                    onChange={(e) => setActType(e.target.value as any)}
                    className="w-full p-2 rounded border border-slate-200 bg-white"
                  >
                    <option value="set_value">set value directly</option>
                    <option value="apply_discount_percentage">apply discount %</option>
                    <option value="trigger_alert">trigger system alert</option>
                    <option value="calculate_formula">evaluate formula expression</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Value / Formula</label>
                  <input
                    type="text"
                    required
                    value={actValue}
                    onChange={(e) => setActValue(e.target.value)}
                    className="w-full p-2 rounded border border-slate-200 bg-white text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('rules')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createRuleMutation.isPending}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                {createRuleMutation.isPending ? 'Saving...' : 'Register Rule Set'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
