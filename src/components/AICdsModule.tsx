import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ShieldAlert,
  BrainCircuit,
  Activity,
  HeartPulse,
  Pill,
  AlertCircle,
  FileText,
  User,
  Check,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle2,
  Settings2,
  ListFilter,
  TrendingUp,
  Fingerprint,
  BookOpen,
  Info
} from 'lucide-react';

interface Patient {
  id: number;
  name: string;
  dob: string;
  gender: string;
  allergies?: string;
  medicalHistory?: string;
}

interface CdsSuggestion {
  suggestionId: number;
  symptomAnalysis: {
    analysis: string;
    severity: 'Low' | 'Moderate' | 'High';
    confidence: number;
  };
  differentialDiagnosis: Array<{
    disease: string;
    probability: number;
    reasoning: string;
    secondaryTests: string[];
  }>;
  drugInteractions: Array<{
    drugs: string[];
    severity: 'Minor' | 'Moderate' | 'Major';
    description: string;
    alternativeMedication: string;
  }>;
  allergyWarnings: Array<{
    drug: string;
    allergen: string;
    reaction: string;
    severity: 'Mild' | 'Moderate' | 'Severe';
  }>;
  duplicateMedicines: Array<{
    drug: string;
    duplicateGroup: string;
    warning: string;
  }>;
  dosageSuggestions: Array<{
    drug: string;
    ageGroup: string;
    standardDosage: string;
    adjustedDosage: string;
    reasoning: string;
  }>;
  clinicalGuidelines: Array<{
    guideline: string;
    title: string;
    recommendation: string;
    source: string;
  }>;
  riskScore: {
    score: number;
    riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    factors: string[];
  };
  explainability: {
    globalExplanation: string;
    clinicalBasis: string;
    sources: string[];
  };
}

export default function AICdsModule() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();

  // Selected patient & medical context states
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [symptomsInput, setSymptomsInput] = useState<string>('');
  const [proposedMeds, setProposedMeds] = useState<string>('');
  const [activeAdminTab, setActiveAdminTab] = useState<'decision' | 'configs' | 'audit'>('decision');

  // Interactive sign-off state (approved medicines checklist)
  const [prescriptionList, setPrescriptionList] = useState<Array<{
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>>([]);

  const [approvedChecked, setApprovedChecked] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load patient details for the dropdown
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['cds-patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load patients list');
      return res.json();
    },
  });

  const selectedPatient = patients.find((p) => p.id === Number(selectedPatientId));

  // Initialize prescription checklist whenever proposed medicines change or analysis returns
  useEffect(() => {
    if (proposedMeds) {
      const medsArray = proposedMeds.split(',').map((m) => m.trim()).filter(Boolean);
      setPrescriptionList(
        medsArray.map((med) => ({
          medication: med,
          dosage: '500mg',
          frequency: 'Once daily',
          duration: '7 days',
          instructions: 'Take after meals with water.',
        }))
      );
    }
  }, [proposedMeds]);

  // Submit mutation for running CDS Analysis
  const analyzeMutation = useMutation<CdsSuggestion, Error, any>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/cds/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'CDS clinical analysis failed');
      return data.data;
    },
    onSuccess: (data) => {
      // Hydrate prescription lists with suggestions if available
      if (data.dosageSuggestions && data.dosageSuggestions.length > 0) {
        setPrescriptionList(
          data.dosageSuggestions.map((ds) => ({
            medication: ds.drug,
            dosage: ds.adjustedDosage || ds.standardDosage || '500mg',
            frequency: 'Once daily',
            duration: '7 days',
            instructions: 'Adjusted per AI clinical dosage guidelines.',
          }))
        );
      }
      setApprovedChecked(false);
      setSuccessMessage(null);
    },
  });

  // Submit mutation for signing off and approving prescription
  const approveMutation = useMutation<any, Error, { id: number; payload: any }>({
    mutationFn: async ({ id, payload }) => {
      const res = await fetch(`/api/cds/approve/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit clinical approval');
      return data;
    },
    onSuccess: (data) => {
      setSuccessMessage('Prescription successfully clinical approved and fully synchronized to Patient EMR records!');
      queryClient.invalidateQueries({ queryKey: ['patient-emr'] });
      setTimeout(() => setSuccessMessage(null), 5000);
    },
  });

  // Administrative / Config Queries & Mutations
  const { data: configData, refetch: refetchConfigs } = useQuery({
    queryKey: ['cds-configs'],
    queryFn: async () => {
      const res = await fetch('/api/cds/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load CDS configurations');
      const data = await res.json();
      return data.data;
    },
    enabled: activeAdminTab === 'configs' && profile?.role === 'admin',
  });

  const { data: auditData, refetch: refetchAudits } = useQuery({
    queryKey: ['cds-audits'],
    queryFn: async () => {
      const res = await fetch('/api/cds/audit', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch AI transaction audits');
      const data = await res.json();
      return data.data;
    },
    enabled: activeAdminTab === 'audit' && profile?.role === 'admin',
  });

  const updateProviderMutation = useMutation<any, Error, { id: number; payload: any }>({
    mutationFn: async ({ id, payload }) => {
      const res = await fetch(`/api/cds/config/provider/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      refetchConfigs();
    },
  });

  const updatePromptMutation = useMutation<any, Error, any>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/cds/config/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      refetchConfigs();
    },
  });

  const handleRunAnalysis = () => {
    if (!selectedPatientId) return;
    analyzeMutation.mutate({
      patientId: Number(selectedPatientId),
      symptoms: symptomsInput,
      proposedMedications: proposedMeds,
    });
  };

  const handleApprovePrescription = () => {
    if (!analyzeMutation.data) return;
    approveMutation.mutate({
      id: analyzeMutation.data.suggestionId,
      payload: {
        savedPrescription: prescriptionList,
      },
    });
  };

  const injectPreset = (symptoms: string, meds: string) => {
    setSymptomsInput(symptoms);
    setProposedMeds(meds);
  };

  return (
    <div id="ai_cds_module_root" className="space-y-6">
      {/* Sub tabs for Clinical Work vs Admin Controls */}
      <div className="flex border-b border-slate-100 bg-white p-2 rounded-2xl shadow-sm gap-2">
        <button
          id="tab_cds_decision"
          onClick={() => setActiveAdminTab('decision')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeAdminTab === 'decision'
              ? 'bg-teal-500 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          Clinical Decision Support
        </button>

        {profile?.role === 'admin' && (
          <>
            <button
              id="tab_cds_configs"
              onClick={() => {
                setActiveAdminTab('configs');
                setTimeout(() => refetchConfigs(), 100);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeAdminTab === 'configs'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Configure AI Providers
            </button>
            <button
              id="tab_cds_audits"
              onClick={() => {
                setActiveAdminTab('audit');
                setTimeout(() => refetchAudits(), 100);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeAdminTab === 'audit'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Fingerprint className="w-4 h-4" />
              AI Audit & Telemetry
            </button>
          </>
        )}
      </div>

      {activeAdminTab === 'decision' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Context Input Column */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 self-start">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Clinical Context Intake</h3>
              <p className="text-xs text-slate-400">Specify patient and new therapy details</p>
            </div>

            {/* Patient Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Select Patient</label>
              <select
                id="cds_patient_select"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">-- Select Registered Patient --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.gender === 'male' ? 'M' : 'F'}, DOB: {p.dob})
                  </option>
                ))}
              </select>
            </div>

            {/* Patient Clinical Cards */}
            {selectedPatient && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs border border-slate-100"
              >
                <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-bold text-slate-700">Patient Safety File</span>
                </div>
                <div>
                  <span className="font-medium text-slate-400 block">Allergies:</span>
                  <span className={`font-bold ${selectedPatient.allergies ? 'text-rose-600' : 'text-slate-600'}`}>
                    {selectedPatient.allergies || 'None reported'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-400 block">Medical History:</span>
                  <span className="font-semibold text-slate-600">{selectedPatient.medicalHistory || 'None reported'}</span>
                </div>
              </motion.div>
            )}

            {/* Preset Scenarios */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600">Quick Clinical Presets</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  id="preset_cardio_chest"
                  onClick={() => injectPreset('Chest pain, palpitations, mild breathlessness', 'Aspirin, Warfarin')}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-bold rounded-lg transition-all"
                >
                  Cardio Chest Pain & Bleeding
                </button>
                <button
                  id="preset_nsaid_overlap"
                  onClick={() => injectPreset('Severe back joint inflammation, minor headache', 'Ibuprofen, Naproxen')}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-bold rounded-lg transition-all"
                >
                  NSAID Overlap Detection
                </button>
                <button
                  id="preset_penicillin_allergy"
                  onClick={() => injectPreset('Fever, severe cough, tonsil throat pain', 'Amoxicillin, Penicillin')}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-bold rounded-lg transition-all"
                >
                  Penicillin Allergy Intercept
                </button>
              </div>
            </div>

            {/* Current Symptoms Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-teal-600" /> Current Symptoms
              </label>
              <textarea
                id="cds_symptoms_textarea"
                rows={3}
                placeholder="E.g. Fever, non-productive cough, shortness of breath..."
                value={symptomsInput}
                onChange={(e) => setSymptomsInput(e.target.value)}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* Proposed Medications */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Pill className="w-3.5 h-3.5 text-teal-600" /> Proposed New Medications
              </label>
              <input
                id="cds_proposed_meds"
                type="text"
                placeholder="E.g. Amoxicillin, Lisinopril (comma-separated)"
                value={proposedMeds}
                onChange={(e) => setProposedMeds(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <button
              id="btn_run_cds_analysis"
              onClick={handleRunAnalysis}
              disabled={!selectedPatientId || analyzeMutation.isPending}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-400 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {analyzeMutation.isPending ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  AI Clinical Consultation...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  Evaluate Clinical Decision Safety
                </>
              )}
            </button>
          </div>

          {/* AI Clinical Insights Column */}
          <div className="lg:col-span-2 space-y-6">
            {analyzeMutation.isPending && (
              <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center space-y-4 animate-pulse min-h-[450px]">
                <div className="p-4 bg-teal-50 text-teal-600 rounded-2xl animate-bounce">
                  <BrainCircuit className="w-8 h-8" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="text-sm font-bold text-slate-700">Synthesizing Patient Safety Insights</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Checking clinical guidelines, mapping drug interactions, querying allergy matches, and auditing risk scores...
                  </p>
                </div>
              </div>
            )}

            {!analyzeMutation.isPending && !analyzeMutation.data && (
              <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-3 min-h-[450px]">
                <div className="p-3 bg-slate-50 text-slate-400 rounded-full">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700">Awaiting Clinical Evaluation</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Select a patient, input clinical symptoms or proposed medications, and run the safety evaluation above to get AI diagnostic support.
                  </p>
                </div>
              </div>
            )}

            {analyzeMutation.data && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {/* 1. Primary Triage Banner & Risk Score Gauge */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Symptom Analysis Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Symptom Assessment</span>
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          analyzeMutation.data.symptomAnalysis.severity === 'High'
                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                            : analyzeMutation.data.symptomAnalysis.severity === 'Moderate'
                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                            : 'bg-teal-50 text-teal-600 border border-teal-100'
                        }`}
                      >
                        {analyzeMutation.data.symptomAnalysis.severity} Severity
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {analyzeMutation.data.symptomAnalysis.analysis}
                    </p>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                      <span className="text-[10px] text-slate-400">AI Confidence:</span>
                      <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-teal-500 h-full rounded-full"
                          style={{ width: `${analyzeMutation.data.symptomAnalysis.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {Math.round(analyzeMutation.data.symptomAnalysis.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Risk Score Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical Risk Profile</span>
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          analyzeMutation.data.riskScore.riskLevel === 'Critical' || analyzeMutation.data.riskScore.riskLevel === 'High'
                            ? 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}
                      >
                        {analyzeMutation.data.riskScore.riskLevel} Risk
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="relative flex items-center justify-center">
                        {/* Circular progress representation */}
                        <div className="w-16 h-16 rounded-full border-4 border-slate-100 flex items-center justify-center">
                          <span className="text-base font-display font-black text-slate-800">
                            {analyzeMutation.data.riskScore.score}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 block">Identified Risk Factors:</span>
                        <ul className="list-disc pl-3 text-[10px] text-slate-400 space-y-0.5">
                          {analyzeMutation.data.riskScore.factors.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Critical Allergy & Interaction Intercept Warnings */}
                {(analyzeMutation.data.allergyWarnings.length > 0 ||
                  analyzeMutation.data.drugInteractions.length > 0 ||
                  analyzeMutation.data.duplicateMedicines.length > 0) && (
                  <div className="bg-rose-50/50 border border-rose-100 p-5 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 text-rose-700">
                      <ShieldAlert className="w-5 h-5 text-rose-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">Critical Safety Alerts Intercepted</h4>
                    </div>

                    {/* Allergy Warnings */}
                    {analyzeMutation.data.allergyWarnings.map((al, idx) => (
                      <div key={idx} className="bg-white p-3.5 rounded-xl border border-rose-100 flex gap-3 shadow-sm">
                        <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-rose-800">
                            Drug Allergy Warning: {al.drug}
                          </p>
                          <p className="text-slate-500">
                            Patient record flags a registered allergy to <strong className="text-rose-600">{al.allergen}</strong>.
                          </p>
                          <p className="text-slate-400">
                            <strong>Expected Reaction:</strong> {al.reaction} ({al.severity} risk)
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Drug Interactions */}
                    {analyzeMutation.data.drugInteractions.map((di, idx) => (
                      <div key={idx} className="bg-white p-3.5 rounded-xl border border-rose-100 flex gap-3 shadow-sm">
                        <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-rose-800">
                            Drug-Drug Interaction: {di.drugs.join(' ↔ ')}
                          </p>
                          <p className="text-slate-500 leading-relaxed">{di.description}</p>
                          {di.alternativeMedication && (
                            <p className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg mt-1 inline-block">
                              Alternative Recommendation: {di.alternativeMedication}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Duplicate Medicines */}
                    {analyzeMutation.data.duplicateMedicines.map((dm, idx) => (
                      <div key={idx} className="bg-white p-3.5 rounded-xl border border-rose-100 flex gap-3 shadow-sm">
                        <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-rose-800">
                            Duplicate Active Ingredient: {dm.drug}
                          </p>
                          <p className="text-slate-500">{dm.warning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Differential Diagnosis Suggestions */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Differential Diagnoses Suggestions</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analyzeMutation.data.differentialDiagnosis.map((diag, i) => (
                      <div key={i} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">{diag.disease}</span>
                          <span className="font-mono text-xs font-black text-teal-600">
                            {Math.round(diag.probability * 100)}% Match
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{diag.reasoning}</p>
                        <div className="space-y-1 pt-1.5 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Order Secondary Rule-Out Tests:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {diag.secondaryTests.map((test, ti) => (
                              <span key={ti} className="px-2 py-0.5 bg-white border border-slate-200 text-[10px] text-slate-500 font-medium rounded-md">
                                {test}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Dosage Suggestions & Adjustments */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical Dosage Recommendations</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400">
                          <th className="py-2 font-bold">Drug</th>
                          <th className="py-2 font-bold">Standard Dose</th>
                          <th className="py-2 font-bold">Adjusted Dose</th>
                          <th className="py-2 font-bold">Rationale & Clinical Basis</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {analyzeMutation.data.dosageSuggestions.map((ds, i) => (
                          <tr key={i} className="text-slate-600 hover:bg-slate-50/50">
                            <td className="py-3 font-bold text-slate-800">{ds.drug}</td>
                            <td className="py-3">{ds.standardDosage}</td>
                            <td className="py-3 font-bold text-teal-600">{ds.adjustedDosage}</td>
                            <td className="py-3 text-[11px] text-slate-500 leading-relaxed">{ds.reasoning}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. Clinical Guidelines References */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evidence-Based Clinical Guidelines</h4>
                  </div>
                  <div className="space-y-3">
                    {analyzeMutation.data.clinicalGuidelines.map((cg, i) => (
                      <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-mono uppercase">
                            {cg.guideline}
                          </span>
                          <span className="text-xs font-bold text-slate-700">{cg.title}</span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">“{cg.recommendation}”</p>
                        <p className="text-[10px] text-slate-400 font-bold">Source: {cg.source}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Explainability & Medical References */}
                <div className="bg-teal-50/30 border border-teal-100/50 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-teal-800 border-b border-teal-100/30 pb-2">
                    <BookOpen className="w-4 h-4 text-teal-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">AI Clinical Explainability Module</h4>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                    <p>
                      <strong>Biological Mechanism:</strong> {analyzeMutation.data.explainability.globalExplanation}
                    </p>
                    <p>
                      <strong>Consensus Basis:</strong> {analyzeMutation.data.explainability.clinicalBasis}
                    </p>
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Scientific Literature Sources:</span>
                      <ul className="list-decimal pl-4 text-[10px] text-slate-500 space-y-1">
                        {analyzeMutation.data.explainability.sources.map((src, i) => (
                          <li key={i}>{src}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 7. Interactive Doctor Approval Sign-off Box */}
                <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-6 shadow-xl border border-slate-800">
                  <div className="space-y-1.5">
                    <h4 className="text-base font-display font-black tracking-tight flex items-center gap-2">
                      <CheckCircle2 className="w-5.5 h-5.5 text-teal-400" /> Doctor Sign-off & EMR Synchronization
                    </h4>
                    <p className="text-xs text-slate-400">
                      Confirm approved medications, adjust exact daily doses, and click Sign-off to insert securely into Patient EMR records.
                    </p>
                  </div>

                  {/* Editable prescription array */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-teal-400">Edit Final Patient Prescriptions</span>
                    <div className="space-y-2.5">
                      {prescriptionList.map((presc, idx) => (
                        <div key={idx} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/50 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 block">Medication</span>
                            <span className="font-bold text-teal-300">{presc.medication}</span>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 block">Dosage</label>
                            <input
                              type="text"
                              value={presc.dosage}
                              onChange={(e) => {
                                const copy = [...prescriptionList];
                                copy[idx].dosage = e.target.value;
                                setPrescriptionList(copy);
                              }}
                              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1 text-white text-xs focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 block">Frequency</label>
                            <input
                              type="text"
                              value={presc.frequency}
                              onChange={(e) => {
                                const copy = [...prescriptionList];
                                copy[idx].frequency = e.target.value;
                                setPrescriptionList(copy);
                              }}
                              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1 text-white text-xs focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 block">Duration</label>
                            <input
                              type="text"
                              value={presc.duration}
                              onChange={(e) => {
                                const copy = [...prescriptionList];
                                copy[idx].duration = e.target.value;
                                setPrescriptionList(copy);
                              }}
                              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1 text-white text-xs focus:outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-800 p-3 rounded-xl border border-slate-700 text-xs">
                    <input
                      id="cds_approve_checkbox"
                      type="checkbox"
                      checked={approvedChecked}
                      onChange={(e) => setApprovedChecked(e.target.checked)}
                      className="accent-teal-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="cds_approve_checkbox" className="text-slate-300 cursor-pointer font-medium select-none">
                      I certify that I have reviewed these AI recommendations and approve them according to clinical standards.
                    </label>
                  </div>

                  <button
                    id="btn_cds_approve_prescription"
                    onClick={handleApprovePrescription}
                    disabled={!approvedChecked || approveMutation.isPending}
                    className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {approveMutation.isPending ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Synchronizing EMR Database...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-slate-950 font-black" />
                        Approve Clinical Plan & Sync with Patient EMR
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {successMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-emerald-500 text-slate-950 p-4 rounded-xl text-xs font-bold shadow-md flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        {successMessage}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {activeAdminTab === 'configs' && configData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Provider Configs */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 lg:col-span-1">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Active AI Model Configuration</h3>
              <p className="text-xs text-slate-400">Configure parameters for clinical LLMs</p>
            </div>

            {configData.providers.map((p: any) => (
              <div key={p.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">{p.name} Provider</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${p.isActive ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-500'}`}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">Model Key/Alias</label>
                    <input
                      type="text"
                      defaultValue={p.modelName}
                      onChange={(e) => {
                        p.modelName = e.target.value;
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">Temperature ({p.temperature})</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      defaultValue={p.temperature}
                      onChange={(e) => {
                        p.temperature = parseFloat(e.target.value);
                      }}
                      className="w-full"
                    />
                  </div>

                  <button
                    id={`btn_update_provider_${p.id}`}
                    onClick={() => updateProviderMutation.mutate({ id: p.id, payload: p })}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold py-1.5 rounded-lg transition-all"
                  >
                    Save Model Parameters
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Prompt Templates */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 lg:col-span-2">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Prompt Template Management</h3>
              <p className="text-xs text-slate-400">Control templates with strict prompt versioning</p>
            </div>

            {configData.templates.map((t: any) => (
              <div key={t.id} className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Template: {t.key}</span>
                  <span className="font-mono bg-teal-50 text-teal-800 px-2.5 py-0.5 rounded font-bold">
                    Active Version: v{t.version}
                  </span>
                </div>

                <textarea
                  id={`prompt_text_area_${t.id}`}
                  rows={15}
                  defaultValue={t.promptText}
                  onChange={(e) => {
                    t.promptText = e.target.value;
                  }}
                  className="w-full font-mono text-[10px] bg-slate-900 text-teal-400 p-4 rounded-xl border border-slate-800 focus:outline-none leading-relaxed"
                />

                <div className="flex justify-between items-center gap-4">
                  <span className="text-[10px] text-slate-400">
                    Saves a secure, incremental, immutable version inside database history.
                  </span>
                  <button
                    id={`btn_publish_prompt_v_${t.id}`}
                    onClick={() => updatePromptMutation.mutate({ key: t.key, promptText: t.promptText, description: `Doctor dashboard published v${t.version + 1}` })}
                    className="bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    Publish Version v{t.version + 1}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeAdminTab === 'audit' && auditData && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">AI Clinical Audit Ledger</h3>
              <p className="text-xs text-slate-400">Auditable transactions, token metrics, and diagnostic latency records</p>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Success Rate</span>
                <span className="text-base font-display font-black text-emerald-600">
                  {Math.round(auditData.metrics.successRate)}%
                </span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Avg Latency</span>
                <span className="text-base font-display font-black text-teal-600">
                  {auditData.metrics.avgLatencyMs}ms
                </span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Transactions</span>
                <span className="text-base font-display font-black text-slate-700">
                  {auditData.metrics.totalRequests}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="py-2.5 font-bold">Timestamp</th>
                  <th className="py-2.5 font-bold">Provider</th>
                  <th className="py-2.5 font-bold">Prompt Key</th>
                  <th className="py-2.5 font-bold">Version</th>
                  <th className="py-2.5 font-bold">Latency</th>
                  <th className="py-2.5 font-bold">Status</th>
                  <th className="py-2.5 font-bold">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {auditData.logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-mono text-[10px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 font-semibold text-slate-700">{log.provider}</td>
                    <td className="py-3 font-mono text-[10px]">{log.promptKey}</td>
                    <td className="py-3 font-bold">v{log.promptVersion}</td>
                    <td className="py-3 font-mono text-slate-500">{log.latencyMs}ms</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-500">{log.tokensUsed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
