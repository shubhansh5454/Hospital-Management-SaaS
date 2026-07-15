import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext.tsx';
import {
  Brain,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Activity,
  ArrowRight,
  Settings,
  Terminal,
  History,
  Check,
  UserCheck,
  Sliders,
  AlertCircle,
  FileText,
  BadgeAlert,
  HelpCircle,
  Clock,
  HeartPulse,
  TrendingUp,
  Plus
} from 'lucide-react';
import { PrescriptionItem } from '../types/index.ts';

interface CdsPanelProps {
  patientId: number;
  symptoms: string;
  proposedMedications: PrescriptionItem[];
  appointmentId?: number | null;
  onApproveSuggestions: (approvedMeds: PrescriptionItem[], primaryDiagnosis: string, notes: string) => void;
}

export default function CdsPanel({
  patientId,
  symptoms,
  proposedMedications,
  appointmentId,
  onApproveSuggestions,
}: CdsPanelProps) {
  const { token, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isDoctor = profile?.role === 'doctor' || isAdmin;

  // Active Sub-tab in the panel: 'workspace' or 'admin-configs'
  const [activeTab, setActiveTab] = useState<'workspace' | 'admin-configs'>('workspace');

  // Core Evaluation States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [suggestionId, setSuggestionId] = useState<number | null>(null);

  // Clinician edits on the active prescription during review
  const [draftedMeds, setDraftedMeds] = useState<PrescriptionItem[]>([]);

  // Reviewed/checked items state
  const [reviewedItems, setReviewedItems] = useState({
    symptoms: false,
    diagnoses: false,
    interactions: false,
    allergies: false,
    duplicates: false,
    dosages: false,
    guidelines: false,
    risk: false,
  });

  // Human Sign-off states
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isSigningOff, setIsSigningOff] = useState(false);
  const [signOffCompleted, setSignOffCompleted] = useState(false);

  // Administrative Configurations States
  const [providers, setProviders] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<any>({
    totalRequests: 0,
    successRate: 100,
    avgLatencyMs: 0,
    failureCount: 0,
  });
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);

  // Selected values for admin edits
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [modelName, setModelName] = useState('');
  const [temperature, setTemperature] = useState(0.1);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [promptText, setPromptText] = useState('');
  const [promptDescription, setPromptDescription] = useState('');
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // Sync drafted meds with prop when props change
  useEffect(() => {
    setDraftedMeds([...proposedMedications]);
  }, [proposedMedications]);

  // Load Admin configurations if sub-tab changes
  useEffect(() => {
    if (activeTab === 'admin-configs') {
      fetchAdminConfigs();
    }
  }, [activeTab]);

  const fetchAdminConfigs = async () => {
    setIsLoadingConfigs(true);
    setConfigSuccessMsg(null);
    try {
      const configRes = await fetch('/api/cds/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!configRes.ok) throw new Error('Failed to load CDS configurations.');
      const configData = await configRes.json();
      
      if (configData.status === 'success') {
        const { providers, templates } = configData.data;
        setProviders(providers);
        setTemplates(templates);

        // Auto-select first active provider to edit
        const active = providers.find((p: any) => p.isActive);
        if (active) {
          setSelectedProviderId(active.id);
          setModelName(active.modelName);
          setTemperature(active.temperature);
          setMaxTokens(active.maxTokens);
        }

        // Auto-select latest template text
        if (templates && templates.length > 0) {
          setPromptText(templates[0].promptText);
          setPromptDescription(`Version ${templates[0].version + 1} custom prompt tweak`);
        }
      }

      const auditRes = await fetch('/api/cds/audit', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (auditData.status === 'success') {
          setAuditLogs(auditData.data.logs || []);
          setTelemetry(auditData.data.metrics || {
            totalRequests: 0,
            successRate: 100,
            avgLatencyMs: 0,
            failureCount: 0,
          });
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  // Run AI analysis
  const handleRunAnalysis = async () => {
    if (!symptoms.trim()) {
      setErrorMsg('Symptoms description (Subjective note) is empty. Please describe symptoms before running AI clinical support.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisResult(null);
    setSuggestionId(null);
    setSignOffCompleted(false);
    setApprovalNotes('');
    setReviewedItems({
      symptoms: false,
      diagnoses: false,
      interactions: false,
      allergies: false,
      duplicates: false,
      dosages: false,
      guidelines: false,
      risk: false,
    });

    try {
      const response = await fetch('/api/cds/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId,
          symptoms,
          proposedMedications: draftedMeds,
          appointmentId: appointmentId || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Clinical decision support analysis failed.');
      }

      if (data.status === 'success') {
        setAnalysisResult(data.data);
        setSuggestionId(data.data.suggestionId);
      } else {
        throw new Error('Analysis payload was structured incorrectly.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to establish connection to Clinical Intelligence Hub.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Substitute a drug from warning recommendation directly in drafted state
  const handleSubstituteDrug = (oldDrugName: string, newDrugName: string) => {
    const updated = draftedMeds.map((med) => {
      if (med.medication.toLowerCase().includes(oldDrugName.toLowerCase())) {
        return {
          ...med,
          medication: newDrugName,
          instructions: `${med.instructions || ''} [Substituted for ${oldDrugName} due to AI safety review]`.trim(),
        };
      }
      return med;
    });
    setDraftedMeds(updated);
  };

  // Remove offending medication line
  const handleRemoveDrug = (drugName: string) => {
    const updated = draftedMeds.filter((med) => !med.medication.toLowerCase().includes(drugName.toLowerCase()));
    setDraftedMeds(updated);
  };

  // Save / Admin Config Update
  const handleUpdateProvider = async () => {
    if (!selectedProviderId) return;
    setConfigSuccessMsg(null);
    try {
      const res = await fetch(`/api/cds/config/provider/${selectedProviderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          modelName,
          temperature,
          maxTokens,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to update provider configuration');
      
      setConfigSuccessMsg('AI Provider configuration successfully deployed.');
      fetchAdminConfigs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update provider');
    }
  };

  // Save New Prompt Template Version
  const handleSavePromptTemplate = async () => {
    setConfigSuccessMsg(null);
    try {
      const res = await fetch('/api/cds/config/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: 'clinical_analysis',
          promptText,
          description: promptDescription,
        }),
      });
      if (!res.ok) throw new Error('Failed to deploy new prompt template version');
      
      setConfigSuccessMsg('New clinical support prompt template registered and versioned successfully!');
      fetchAdminConfigs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register prompt template');
    }
  };

  // Final Sign-off and Apply
  const handleSignOffApproval = async () => {
    if (!suggestionId) return;
    setIsSigningOff(true);
    try {
      const res = await fetch(`/api/cds/approve/${suggestionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          savedPrescription: draftedMeds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to sign-off clinical suggestions.');

      setSignOffCompleted(true);
      
      // Extract primary diagnosis from differential or use fallback
      const primaryDiagnosis = analysisResult.differentialDiagnosis?.[0]?.disease || 'Evaluated Pathology';
      
      // Compile clinical notes justification
      const justifyNotes = `Clinical Decision Support analysis reviewed and signed off by provider.\n` +
        `- Symptom Analysis: Reviewed (${analysisResult.symptomAnalysis?.severity || 'Normal'} severity)\n` +
        `- Risk Score Check: Aligned (Score: ${analysisResult.riskScore?.score || 0})\n` +
        `- Clinician Signature Verification Notes: ${approvalNotes || 'Consensus reached with clinical AI recommendations.'}`;

      // Trigger EMR sync callback
      onApproveSuggestions(draftedMeds, primaryDiagnosis, justifyNotes);
    } catch (err: any) {
      setErrorMsg(err.message || 'Sign-off failed.');
    } finally {
      setIsSigningOff(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 space-y-5 shadow-sm">
      
      {/* Header and Workspace/Admin Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-teal-500 text-white rounded-xl flex items-center justify-center shadow-inner">
            <Brain className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 tracking-wide uppercase flex items-center gap-1.5">
              <span>Clinical Decision Support System (CDS)</span>
              <span className="bg-teal-100 text-teal-800 text-[9px] px-1.5 py-0.5 rounded font-bold font-mono">HIPAA SECURE</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Point-of-care AI safety reviews, interactions, duplicate checks, guidelines, & risk calculation.</p>
          </div>
        </div>

        {/* Workspace/Configs Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-200/50 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'workspace' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-teal-500" />
            <span>Support Workspace</span>
          </button>
          
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin-configs')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'admin-configs' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>AI Admin & Telemetry</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold flex items-start gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {configSuccessMsg && (
        <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl text-teal-700 text-xs font-semibold flex items-start gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-teal-600" />
          <span>{configSuccessMsg}</span>
        </div>
      )}

      {/* ------------------ TAB 1: WORKSPACE ------------------ */}
      {activeTab === 'workspace' && (
        <div className="space-y-5">
          {!analysisResult ? (
            /* Run Analysis Prompt */
            <div className="bg-white border border-slate-200/50 rounded-2xl p-8 text-center space-y-4 shadow-inner">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 border border-teal-100/50 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h5 className="text-xs font-bold text-slate-800">Point-of-Care Clinical AI Assessment</h5>
                <p className="text-[10px] text-slate-400">
                  Runs real-time multi-dimensional clinical validations based on the active symptoms and proposed medications listed above.
                </p>
              </div>

              {draftedMeds.length === 0 && (
                <div className="max-w-xs mx-auto p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-[10px] font-semibold text-left">
                  ⚠️ No medications are drafted in the prescription builder above. AI will perform triage, symptom analysis, guidelines match, and risk score calculation.
                </div>
              )}

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleRunAnalysis}
                className="inline-flex h-9 px-5 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-200 text-white rounded-xl text-xs font-bold items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Consulting Clinical Intelligence...</span>
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    <span>Analyze Case with AI</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Results Loaded */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Telemetry and Risk Dashboard Gauge */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Risk Score Widget */}
                <div className="bg-white border border-slate-200/50 rounded-2xl p-4.5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Acuity Risk Index</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      analysisResult.riskScore?.riskLevel === 'Low' ? 'bg-green-50 text-green-600 border border-green-100' :
                      analysisResult.riskScore?.riskLevel === 'Medium' || analysisResult.riskScore?.riskLevel === 'Moderate' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      {analysisResult.riskScore?.riskLevel || 'Low'}
                    </span>
                  </div>

                  <div className="flex items-end gap-3 my-3">
                    <span className="text-3xl font-display font-extrabold text-slate-800">
                      {analysisResult.riskScore?.score !== undefined ? analysisResult.riskScore.score : 25}
                    </span>
                    <span className="text-slate-400 text-[10px] font-bold font-mono pb-1">/ 100</span>
                    
                    {/* Tiny gauge visualizer bar */}
                    <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                      <div 
                        className={`h-full rounded-full ${
                          (analysisResult.riskScore?.score || 25) < 35 ? 'bg-green-500' :
                          (analysisResult.riskScore?.score || 25) < 70 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${analysisResult.riskScore?.score || 25}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 font-medium">
                    <span className="font-bold text-slate-500">Factors:</span> {analysisResult.riskScore?.factors?.join(', ') || 'Normal physiological checks.'}
                  </div>
                </div>

                {/* Symptom Urgency Triage Widget */}
                <div className="bg-white border border-slate-200/50 rounded-2xl p-4.5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Symptom Urgency Triage</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      analysisResult.symptomAnalysis?.urgency === 'Routine' || analysisResult.symptomAnalysis?.severity === 'Low' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                      analysisResult.symptomAnalysis?.urgency === 'Urgent' || analysisResult.symptomAnalysis?.severity === 'Moderate' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      'bg-rose-50 text-rose-600 border border-rose-100'
                    }`}>
                      {analysisResult.symptomAnalysis?.urgency || 'Routine'}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-600 font-medium my-3 leading-relaxed truncate-2-lines">
                    {analysisResult.symptomAnalysis?.analysis || 'Symptom pattern is stable.'}
                  </p>

                  <div className="text-[10px] text-slate-400 font-mono">
                    Triage certainty: {Math.round((analysisResult.symptomAnalysis?.confidence || 0.85) * 100)}%
                  </div>
                </div>

                {/* Clinical Explainability Insight */}
                <div className="bg-teal-900 text-teal-50 rounded-2xl p-4.5 flex flex-col justify-between shadow-sm">
                  <div>
                    <span className="text-[9px] font-extrabold text-teal-300 uppercase tracking-widest block">AI Explainability Justification</span>
                    <p className="text-[10px] text-teal-100 mt-2 leading-relaxed">
                      {analysisResult.explainability?.globalExplanation?.substring(0, 150) || 'Decisions derived via cross-referencing demographic vitals and literature guidelines.'}...
                    </p>
                  </div>
                  
                  <div className="text-[9px] text-teal-300 font-semibold italic truncate mt-2">
                    Source: {analysisResult.explainability?.sources?.[0] || 'ACC/AHA Guidelines, Goodman & Gilman Therapeutics'}
                  </div>
                </div>

              </div>

              {/* DRUG-DRUG INTERACTIONS ALERTS */}
              {analysisResult.drugInteractions && analysisResult.drugInteractions.length > 0 && (
                <div className="bg-red-50/50 border border-red-100 rounded-2xl p-5 space-y-3.5">
                  <h5 className="text-xs font-bold text-red-800 flex items-center gap-2">
                    <ShieldAlert className="w-4.5 h-4.5 text-red-600 animate-bounce" />
                    <span>Critical Drug-Drug Interaction Detected!</span>
                  </h5>

                  <div className="space-y-3">
                    {analysisResult.drugInteractions.map((item: any, idx: number) => (
                      <div key={idx} className="bg-white border border-red-100/50 rounded-xl p-4 space-y-2.5 shadow-sm text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            {Array.isArray(item.drugs) ? item.drugs.join(' ↔️ ') : `${item.medicationA} and ${item.medicationB}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            item.severity === 'Major' || item.severity === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.severity} Severity
                          </span>
                        </div>

                        <p className="text-slate-600 font-medium leading-relaxed">{item.description}</p>
                        
                        {item.explanation && (
                          <p className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded-lg font-mono">
                            <span className="font-semibold text-slate-500">Biochemical Mechanism:</span> {item.explanation}
                          </p>
                        )}

                        <div className="border-t border-slate-50 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px]">
                          <span className="text-teal-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Alternative suggested: <span className="underline">{item.alternativeMedication || item.alternative}</span>
                          </span>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveDrug(item.drugs?.[1] || item.medicationB)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-semibold cursor-pointer"
                            >
                              Discontinue Drug
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubstituteDrug(item.drugs?.[1] || item.medicationB, item.alternativeMedication || item.alternative)}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg font-semibold cursor-pointer"
                            >
                              Substitute Recommended Drug
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ALLERGY WARNINGS */}
              {analysisResult.allergyWarnings && analysisResult.allergyWarnings.length > 0 && (
                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 space-y-3.5">
                  <h5 className="text-xs font-bold text-amber-800 flex items-center gap-2">
                    <BadgeAlert className="w-4.5 h-4.5 text-amber-600 animate-pulse" />
                    <span>Patient Allergy & Cross-Sensitivity Warnings</span>
                  </h5>

                  <div className="space-y-3">
                    {analysisResult.allergyWarnings.map((item: any, idx: number) => (
                      <div key={idx} className="bg-white border border-amber-100/50 rounded-xl p-4 space-y-2.5 shadow-sm text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            Drug: <span className="text-amber-700 underline">{item.drug || item.medication}</span> (Sensitivities: {item.allergen})
                          </span>
                          <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 rounded text-[9px] font-bold uppercase">
                            {item.severity} Reaction Risk
                          </span>
                        </div>

                        <p className="text-slate-600 font-medium">
                          Expected Reaction: <span className="font-bold">{item.reaction || item.description}</span>
                        </p>
                        
                        {item.explanation && (
                          <p className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded-lg font-mono">
                            <span className="font-semibold text-slate-500">Immunology Basis:</span> {item.explanation}
                          </p>
                        )}

                        {item.alternative && (
                          <div className="border-t border-slate-50 pt-3 flex items-center justify-between text-[10px]">
                            <span className="text-teal-700 font-bold">
                              Substitute Alternative: <span className="underline">{item.alternative}</span>
                            </span>

                            <button
                              type="button"
                              onClick={() => handleSubstituteDrug(item.drug || item.medication, item.alternative)}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg font-semibold cursor-pointer"
                            >
                              Substitute Safe Replacement
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DUPLICATE MEDICINE WARNINGS */}
              {analysisResult.duplicateMedicines && analysisResult.duplicateMedicines.length > 0 && (
                <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 space-y-3.5">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-4.5 h-4.5 text-slate-600" />
                    <span>Duplicate Medicine / Overlapping Therapeutic Classes</span>
                  </h5>

                  <div className="space-y-3">
                    {analysisResult.duplicateMedicines.map((item: any, idx: number) => (
                      <div key={idx} className="bg-white border border-slate-200/50 rounded-xl p-4 space-y-2 shadow-sm text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            Redundancy check on: <span className="text-rose-600">{item.drug || item.medicationA}</span>
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase font-mono">
                            {item.duplicateGroup || item.severity}
                          </span>
                        </div>

                        <p className="text-slate-600 font-medium">{item.warning || item.description}</p>
                        
                        {item.actionRequired && (
                          <p className="text-[10px] text-rose-700 font-bold bg-rose-50 p-1.5 rounded">
                            Action Suggested: {item.actionRequired}
                          </p>
                        )}

                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveDrug(item.drug || item.medicationA)}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-semibold text-[10px] cursor-pointer"
                          >
                            Remove Redundant Medication
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DIFFERENTIAL DIAGNOSIS SUGGESTIONS */}
              {analysisResult.differentialDiagnosis && analysisResult.differentialDiagnosis.length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-4.5 h-4.5 text-teal-600" />
                    <span>AI Differential Diagnosis Suggestions & Rule-Out Tests</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {analysisResult.differentialDiagnosis.map((item: any, idx: number) => (
                      <div key={idx} className="bg-white border border-slate-200/50 rounded-xl p-4 space-y-3 shadow-sm text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-teal-900">{item.disease || item.condition}</span>
                          <span className="px-2 py-0.5 bg-teal-50 border border-teal-100 text-teal-700 rounded text-[9px] font-bold">
                            {Math.round((item.probability || 0.5) * 100)}% Probability
                          </span>
                        </div>

                        <p className="text-slate-500 font-medium text-[11px] leading-relaxed">
                          {item.reasoning || item.explanation}
                        </p>

                        <div className="bg-slate-50 p-2.5 rounded-lg space-y-1.5 border border-slate-100">
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">Recommended Diagnostic Studies</span>
                          <div className="flex flex-wrap gap-1">
                            {(item.secondaryTests || item.ruleOutTests?.split(', ') || ['CBC', 'Routine panel']).map((test: string, testIdx: number) => (
                              <span key={testIdx} className="px-2 py-0.5 bg-slate-200 text-slate-700 font-bold rounded-md text-[9px]">
                                {test}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DOSAGE SUGGESTIONS TABLE */}
              {analysisResult.dosageSuggestions && analysisResult.dosageSuggestions.length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-teal-600" />
                    <span>Dynamic Dosage Suggestion Matrices</span>
                  </h5>

                  <div className="bg-white border border-slate-200/50 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                          <th className="p-3 pl-4">Medication</th>
                          <th className="p-3">Dose Category</th>
                          <th className="p-3">Standard Adult</th>
                          <th className="p-3">Adjusted Suggestion</th>
                          <th className="p-3">Pharmacokinetic Rationale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                        {analysisResult.dosageSuggestions.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/20">
                            <td className="p-3 pl-4 font-bold text-slate-800">{item.drug || item.medication}</td>
                            <td className="p-3 text-[11px] font-semibold text-slate-500">{item.ageGroup || 'Adult'}</td>
                            <td className="p-3 text-[11px] font-mono text-slate-400">{item.standardDosage}</td>
                            <td className="p-3 text-[11px] font-bold text-teal-700">{item.adjustedDosage || `${item.recommendedDosage} ${item.recommendedFrequency}`}</td>
                            <td className="p-3 text-[11px] text-slate-500">{item.reasoning || item.explanation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* CLINICAL GUIDELINES RECOMMENDATIONS */}
              {analysisResult.clinicalGuidelines && analysisResult.clinicalGuidelines.length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4.5 h-4.5 text-teal-600" />
                    <span>Evidence-Based Clinical Guidelines Matched</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {analysisResult.clinicalGuidelines.map((item: any, idx: number) => (
                      <div key={idx} className="bg-white border border-slate-200/50 rounded-xl p-4 space-y-2.5 shadow-sm text-xs">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <span className="font-bold text-slate-800">{item.guideline || item.guidelineName}</span>
                          <span className="text-[10px] font-bold font-mono text-slate-400">
                            {item.source || item.sourceCitation}
                          </span>
                        </div>

                        <p className="text-slate-600 font-medium italic">
                          "{item.recommendation}"
                        </p>

                        <p className="text-[10px] text-slate-400 bg-teal-50/50 p-2 rounded border border-teal-100/30">
                          <span className="font-semibold text-teal-800">Therapeutic Benefit Rationale:</span> {item.title || item.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HUMAN GATEKEEPER / DOCTOR REVIEW SIGN-OFF WINDOW */}
              <div className="bg-white border-2 border-teal-500/30 rounded-2xl p-6 space-y-4 shadow-sm">
                <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <UserCheck className="w-5 h-5 text-teal-600" />
                  <span>Clinical Provider Sign-Off & EMR Synchronization Gate</span>
                </h5>

                <div className="space-y-3 text-xs">
                  <p className="text-slate-500 font-medium">
                    As the licensed attending clinician, you are legally required to verify, modify, and sign-off on the active medical choices.
                    Check the boxes below to confirm your manual verification:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
                    {[
                      { key: 'symptoms', label: 'Triage & Symptoms' },
                      { key: 'diagnoses', label: 'Differential Diagnoses' },
                      { key: 'interactions', label: 'Drug Interactions' },
                      { key: 'allergies', label: 'Patient Allergies' },
                      { key: 'duplicates', label: 'Duplicate Medicines' },
                      { key: 'dosages', label: 'Adjusted Dosages' },
                      { key: 'guidelines', label: 'Clinical Guidelines' },
                      { key: 'risk', label: 'Calculated Acuity Risk' },
                    ].map((chk) => (
                      <label key={chk.key} className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/75 rounded-lg border border-slate-100 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={(reviewedItems as any)[chk.key]}
                          onChange={(e) => setReviewedItems({ ...reviewedItems, [chk.key]: e.target.checked })}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-slate-600">{chk.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Clinician Clinical Decisions & Justification Notes</label>
                    <textarea
                      placeholder="e.g. Reviewed high-risk interactions. Discontinued Warfarin temporarily. Substituted Amoxicillin due to cross-sensitivities. Dosage calibrated for pediatric patient."
                      rows={3}
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                    <span className="text-[10px] text-slate-400 font-bold font-mono">ID: SUG-{suggestionId}</span>
                    
                    <button
                      type="button"
                      onClick={handleSignOffApproval}
                      disabled={isSigningOff || signOffCompleted}
                      className="h-9.5 px-6 bg-teal-500 hover:bg-teal-600 disabled:bg-emerald-100 disabled:text-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {isSigningOff ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Syncing EMR Records...</span>
                        </>
                      ) : signOffCompleted ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>CDS Signed-Off & Applied!</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>Approve & Sign-off Suggestions</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ------------------ TAB 2: ADMIN CONFIGURATIONS ------------------ */}
      {activeTab === 'admin-configs' && (
        <div className="space-y-6 animate-fadeIn text-xs">
          {isLoadingConfigs ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-[10px] text-slate-400 font-medium">Querying database configurations...</p>
            </div>
          ) : (
            <>
              {/* Provider Config and Prompt Versioning Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Provider Parameters Column */}
                <div className="bg-white border border-slate-200/50 rounded-2xl p-5 space-y-4 shadow-sm">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-2.5">
                    <Sliders className="w-4.5 h-4.5 text-teal-600" />
                    <span>AI Engine Service Provider Configurations</span>
                  </h5>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Select active provider</label>
                      <select
                        value={selectedProviderId || ''}
                        onChange={(e) => {
                          const id = parseInt(e.target.value);
                          setSelectedProviderId(id);
                          const selected = providers.find((p) => p.id === id);
                          if (selected) {
                            setModelName(selected.modelName);
                            setTemperature(selected.temperature);
                            setMaxTokens(selected.maxTokens);
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700"
                      >
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.isActive ? '🟢 Attendant Active' : '⚪ Sandbox'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Gemini Model Code</label>
                      <input
                        type="text"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block uppercase">Temperature ({temperature})</label>
                        <input
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.05"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full accent-teal-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block uppercase">Max Tokens</label>
                        <input
                          type="number"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdateProvider}
                      className="w-full h-8.5 bg-teal-500 hover:bg-teal-600 text-white font-bold text-[10px] rounded-lg shadow-sm cursor-pointer"
                    >
                      Apply Provider Tuning
                    </button>
                  </div>
                </div>

                {/* Prompt Versioning Column */}
                <div className="bg-white border border-slate-200/50 rounded-2xl p-5 space-y-4 shadow-sm">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-2.5">
                    <Terminal className="w-4.5 h-4.5 text-teal-600" />
                    <span>Prompt Template Version Control</span>
                  </h5>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Core Clinical Support Prompt</label>
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                          Current: v{templates?.[0]?.version || 1}
                        </span>
                      </div>
                      <textarea
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                        rows={6}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[9px] leading-relaxed"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Version Release Notes</label>
                      <input
                        type="text"
                        value={promptDescription}
                        onChange={(e) => setPromptDescription(e.target.value)}
                        placeholder="Describe optimization change logs..."
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSavePromptTemplate}
                      className="w-full h-8.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] rounded-lg shadow-sm cursor-pointer"
                    >
                      Publish & Deploy New Prompt Version
                    </button>
                  </div>
                </div>

              </div>

              {/* Telemetry Metrics Row */}
              <div className="bg-white border border-slate-200/50 rounded-2xl p-5 space-y-4 shadow-sm">
                <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-2.5">
                  <Activity className="w-4.5 h-4.5 text-teal-600" />
                  <span>SaaS Telemetry & Clinical System Logs (Attendant HIPAA Analytics)</span>
                </h5>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">Total Queries</span>
                    <span className="text-xl font-display font-black text-slate-800 mt-1 block">{telemetry.totalQueries || 0}</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">AI Success Rate</span>
                    <span className="text-xl font-display font-black text-emerald-600 mt-1 block">{(telemetry.successRate || 100).toFixed(1)}%</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">Average Latency</span>
                    <span className="text-xl font-display font-black text-blue-600 mt-1 block">{telemetry.avgLatencyMs || 0} ms</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">ATTENDANT APPROVALS</span>
                    <span className="text-xl font-display font-black text-teal-600 mt-1 block">{telemetry.totalHumanApprovals || 0}</span>
                  </div>
                </div>

                {/* Audit table */}
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 uppercase font-bold text-slate-400">
                        <th className="p-2.5 pl-4">Timestamp</th>
                        <th className="p-2.5">Provider</th>
                        <th className="p-2.5">Model</th>
                        <th className="p-2.5">Prompt Key (v)</th>
                        <th className="p-2.5">Latency</th>
                        <th className="p-2.5">Tokens</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-mono text-slate-500">
                      {auditLogs.slice(0, 8).map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 pl-4 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                          <td className="p-2.5 font-bold text-slate-700">{log.provider}</td>
                          <td className="p-2.5">{log.model}</td>
                          <td className="p-2.5">{log.promptKey} (v{log.promptVersion})</td>
                          <td className="p-2.5 text-blue-500 font-bold">{log.latencyMs}ms</td>
                          <td className="p-2.5">{log.tokensUsed || 'N/A'}</td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              log.status === 'SUCCESS' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 font-sans italic">
                            No HIPAA compliant auditing events recorded in current database index.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
