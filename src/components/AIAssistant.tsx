import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import AICdsModule from './AICdsModule.tsx';
import {
  Sparkles,
  Brain,
  Calendar,
  Pill,
  FileText,
  History,
  Clock,
  User,
  Check,
  Copy,
  FileDown,
  Settings,
  AlertCircle,
  Wand2,
  HeartPulse,
  Activity,
  Sliders,
  ChevronRight,
  Shield,
  Stethoscope,
  ChevronDown
} from 'lucide-react';

interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
  gender: string;
  dob: string;
}

export default function AIAssistant() {
  const { token, profile } = useAuth();
  const currentRole = profile?.role || 'patient';
  const isStaff = ['admin', 'doctor', 'receptionist'].includes(currentRole);

  // Core Active Tab State
  const [activeFeature, setActiveFeature] = useState<
    'decision-support' | 'appointment' | 'prescription' | 'medical-summary' | 'patient-history' | 'follow-up' | 'clinical-notes'
  >('decision-support');

  // AI Service Provider Configuration Panel States
  const [showConfig, setShowConfig] = useState(false);
  const [aiModel, setAiModel] = useState('gemini-3.5-flash');
  const [aiTemperature, setAiTemperature] = useState(0.2);
  const [customSystemInstruction, setCustomSystemInstruction] = useState('');

  // Feature Input States
  // 1. Appointment Assistant
  const [apptSymptoms, setApptSymptoms] = useState('');
  // 2. Prescription Suggestions
  const [prescDiagnosis, setPrescDiagnosis] = useState('');
  const [prescAllergies, setPrescAllergies] = useState('');
  // 3. Medical Summary
  const [medSummaryRaw, setMedSummaryRaw] = useState('');
  // 4. Patient History
  const [selectedPatientId, setSelectedPatientId] = useState('');
  // 5. Follow-up
  const [followUpCondition, setFollowUpCondition] = useState('');
  const [followUpVitals, setFollowUpVitals] = useState('');
  // 6. SOAP Clinical Notes
  const [clinicalMessyNotes, setClinicalMessyNotes] = useState('');

  // Output response states
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Load patients list for selection in history or upload
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load patients for AI context selection');
      return res.json();
    },
    enabled: isStaff,
  });

  // Action: Copy to clipboard helper
  const handleCopyToClipboard = () => {
    if (!aiResponse) return;
    navigator.clipboard.writeText(aiResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Action: Download AI markdown text locally
  const handleDownloadMarkdown = () => {
    if (!aiResponse) return;
    const element = document.createElement('a');
    const file = new Blob([aiResponse], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `care_sync_ai_synthesis_${activeFeature}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Preset Hydration Helpers
  const injectPreset = (feature: typeof activeFeature, presetType: string) => {
    setErrorText(null);
    setAiResponse('');
    
    if (feature === 'appointment') {
      if (presetType === 'cardio') {
        setApptSymptoms('Patient is experiencing occasional palpitations and shortness of breath during light physical exertion. Preference: morning slot, cardiology match.');
      } else if (presetType === 'peds') {
        setApptSymptoms('Child has a persistent dry cough, temperature of 100.8F for 2 days, and is fussy. Preference: urgent slot with a pediatrician today if possible.');
      } else if (presetType === 'routine') {
        setApptSymptoms('Routine follow-up for diabetes monitoring, HbA1c test review, and routine physical exams. Preference: late afternoon appointment next week.');
      }
    } else if (feature === 'prescription') {
      if (presetType === 'tonsillitis') {
        setPrescDiagnosis('Acute Streptococcal Tonsillitis. Sore throat, pain during swallowing, white patches on tonsils, mild fever.');
        setPrescAllergies('Penicillin allergy (hives and swelling). Medical history of gastrointestinal acid reflux.');
      } else if (presetType === 'hypertension') {
        setPrescDiagnosis('Stage 1 Essential Hypertension. Consistently high blood pressure readings (142/92 mmHg) over the past month.');
        setPrescAllergies('No known allergies. History of mild asthma (occasional inhaler use).');
      }
    } else if (feature === 'medical-summary') {
      if (presetType === 'emr-sample') {
        setMedSummaryRaw(`Chief Complaint: Extreme fatigue and cold intolerance for 3 months.
Vitals: Temp 97.6F, BP 110/70, HR 58 bpm, Weight 168 lbs.
Physical Exam: Dry skin, thinning hair, slow deep tendon reflexes.
Assessment: Suspected hypothyroidism. Ordered full thyroid panel (TSH, Free T4) and basic metabolic panel.
Plan: Patient advised to await lab results. Return in 1 week. Avoid cold drafts.`);
      }
    } else if (feature === 'follow-up') {
      if (presetType === 'asthma') {
        setFollowUpCondition('Mild persistent bronchial asthma with seasonal allergy trigger.');
        setFollowUpVitals('BP 120/80, HR 72, Respiratory Rate 18, SpO2 98% on room air. Currently on Albuterol PRN and Fluticasone daily.');
      } else if (presetType === 'post-op') {
        setFollowUpCondition('Post-operative recovery status: Day 10 after minor arthroscopic knee surgery.');
        setFollowUpVitals('Vitals stable. Temp 98.4F. Surgical incisions clean with no active redness or drainage. Patient reports pain is 3/10.');
      }
    } else if (feature === 'clinical-notes') {
      if (presetType === 'messy') {
        setClinicalMessyNotes(`patient John Smith age 45 comes in with lower back pain radiating down left leg for 5 days. pain is 8/10. started after lifting heavy boxes.
vitals: BP 138/85, HR 80.
exam: positive straight leg raise on left side. decreased sensation in left lateral foot.
assess: probable lumbar radiculopathy L5-S1.
plan: schedule MRI lower spine. start Gabapentin 300mg TID. refer to physical therapy twice a week. avoid bending/lifting. return in 2 weeks or go to ER if saddle anesthesia or bowel/bladder incontinence.`);
      }
    }
  };

  // Submit action triggers Express API
  const handleGenerateAI = async () => {
    setIsGenerating(true);
    setErrorText(null);
    setAiResponse('');

    const config = {
      model: aiModel,
      temperature: aiTemperature,
      systemInstruction: customSystemInstruction.trim() || undefined,
    };

    try {
      let endpoint = '';
      let body: any = { config };

      if (activeFeature === 'appointment') {
        if (!apptSymptoms.trim()) throw new Error('Please enter symptoms or scheduling requests.');
        endpoint = '/api/ai/appointment';
        body.symptomsAndPreferences = apptSymptoms;
      } else if (activeFeature === 'prescription') {
        if (!prescDiagnosis.trim()) throw new Error('Please describe the patient diagnosis/symptoms.');
        endpoint = '/api/ai/prescription';
        body.diagnosisAndSymptoms = prescDiagnosis;
        body.allergiesAndHistory = prescAllergies;
      } else if (activeFeature === 'medical-summary') {
        if (!medSummaryRaw.trim()) throw new Error('Please paste raw clinical EMR record details.');
        endpoint = '/api/ai/medical-summary';
        body.emrRecordData = medSummaryRaw;
      } else if (activeFeature === 'patient-history') {
        if (!selectedPatientId) throw new Error('Please select a patient from the patient register.');
        endpoint = `/api/ai/patient-history/${selectedPatientId}`;
      } else if (activeFeature === 'follow-up') {
        if (!followUpCondition.trim()) throw new Error('Please fill in the current condition active diagnosis.');
        endpoint = '/api/ai/follow-up';
        body.currentCondition = followUpCondition;
        body.vitalsAndMeds = followUpVitals;
      } else if (activeFeature === 'clinical-notes') {
        if (!clinicalMessyNotes.trim()) throw new Error('Please provide raw shorthand clinical notes.');
        endpoint = '/api/ai/clinical-notes';
        body.messyNotes = clinicalMessyNotes;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'AI request failed');
      }

      setAiResponse(data.text);
    } catch (err: any) {
      setErrorText(err.message || 'Failed to generate AI insights. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (activeFeature === 'decision-support') {
    return (
      <div className="flex-1 p-8 overflow-y-auto space-y-6 bg-slate-50/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg">
                <Brain className="w-5 h-5 animate-pulse" />
              </div>
              <h1 className="text-2xl font-display font-bold text-slate-800 tracking-tight flex items-center gap-2">
                Clinical Decision Support <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-mono uppercase font-bold">Active Safety Guard</span>
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Interactive clinical decision engine: allergy warning intercept, drug-drug interactions, duplicate medicines, and structured differential diagnosis with evidence-based guidelines.
            </p>
          </div>
          <button
            onClick={() => setActiveFeature('appointment')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer"
          >
            Back to Playground Workflows
          </button>
        </div>
        <AICdsModule />
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6 bg-slate-50/50">
      
      {/* Dynamic Module Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <h1 className="text-2xl font-display font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Clinical Intelligence Hub <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-mono uppercase font-bold">Gemini 3.5</span>
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Advanced medical assistant tools, SOAP note builders, prescription safety reviews, and patient history summary engines.
          </p>
        </div>

        {/* AI Config Panel Trigger Button */}
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            showConfig 
              ? 'bg-slate-800 text-white shadow-md' 
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Config parameters</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Configuration Slider Panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Model selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">AI Engine Model</label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Super Fast / Clinical summaries)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Deep reasoning / Complex clinical logic)</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fastest / Ultra low latency)</option>
                </select>
                <p className="text-[10px] text-slate-400">Gemini models require specific API configuration. Defaults to Gemini 3.5 Flash.</p>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Creativity Temperature</label>
                  <span className="text-xs font-mono text-teal-600 font-bold">{aiTemperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={aiTemperature}
                  onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                  <span>0.0 (Clinical / Precise)</span>
                  <span>1.0 (Exploratory / Fluid)</span>
                </div>
              </div>

              {/* System InstructionOverride */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">System Instructions Override</label>
                <textarea
                  placeholder="Custom medical persona or specialized clinic guidelines..."
                  value={customSystemInstruction}
                  onChange={(e) => setCustomSystemInstruction(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main AI Playground Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Navigation Sidebar & Form Inputs (Left) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Feature selector sidebar cards */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-2 pb-1">AI Clinical Workflows</span>
            {[
              { id: 'decision-support', label: 'Clinical Decision Support', desc: 'Safety guard & differential advisor', icon: Brain, color: 'text-teal-600 bg-teal-50', clinicalOnly: true },
              { id: 'appointment', label: 'AI Appointment Assistant', desc: 'Symptom triage & specialist matching', icon: Calendar, color: 'text-blue-500 bg-blue-50' },
              { id: 'clinical-notes', label: 'Clinical SOAP Note Scribe', desc: 'Expand rough notes into complete SOAP', icon: Stethoscope, color: 'text-indigo-500 bg-indigo-50' },
              { id: 'prescription', label: 'Prescription Advisor', desc: 'Medication suggestions & interactions', icon: Pill, color: 'text-rose-500 bg-rose-50', clinicalOnly: true },
              { id: 'medical-summary', label: 'EMR Medical Summary', desc: 'Synthesize raw consult data into key snapshots', icon: FileText, color: 'text-teal-500 bg-teal-50' },
              { id: 'patient-history', label: 'Patient History Synthesis', desc: 'Interactive patient history & trend reviews', icon: History, color: 'text-amber-500 bg-amber-50', clinicalOnly: true },
              { id: 'follow-up', label: 'Continuity & Follow-up Planner', desc: 'Optimal intervals & warning signs', icon: Clock, color: 'text-emerald-500 bg-emerald-50' }
            ].map(item => {
              const Icon = item.icon;
              const isSelected = activeFeature === item.id;
              
              // Non-staff constraint
              if (item.clinicalOnly && !isStaff) return null;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveFeature(item.id as any);
                    setAiResponse('');
                    setErrorText(null);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-slate-50 border-l-4 border-l-teal-500 text-slate-800' 
                      : 'hover:bg-slate-50/50 text-slate-500'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-xs font-bold block truncate">{item.label}</span>
                    <span className="text-[10px] text-slate-400 block truncate font-medium">{item.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dynamic Active Feature Input Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-1.5 border-b border-slate-50 pb-3">
              <Wand2 className="w-4 h-4 text-teal-500" />
              <span>Provide Case Parameters</span>
            </h3>

            {/* --- CASE 1: Appointment Assistant --- */}
            {activeFeature === 'appointment' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Test Preset Templates:</span>
                  <div className="flex gap-1">
                    <button onClick={() => injectPreset('appointment', 'cardio')} className="text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-md cursor-pointer">Cardiology</button>
                    <button onClick={() => injectPreset('appointment', 'peds')} className="text-[10px] font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 px-2 py-1 rounded-md cursor-pointer">Pediatric</button>
                    <button onClick={() => injectPreset('appointment', 'routine')} className="text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded-md cursor-pointer">Routine</button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 block">Symptoms & Slot Preferences</label>
                  <textarea
                    placeholder="e.g. Patient has acute lower back pain radiating down the left leg. Prefers evening slots with a physical therapist..."
                    value={apptSymptoms}
                    onChange={(e) => setApptSymptoms(e.target.value)}
                    rows={4}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white resize-none"
                  />
                </div>
              </div>
            )}

            {/* --- CASE 2: SOAP Clinical Notes --- */}
            {activeFeature === 'clinical-notes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Preset Templates:</span>
                  <button onClick={() => injectPreset('clinical-notes', 'messy')} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded-md cursor-pointer">Back Pain Dictation</button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 block">Messy Scribe Shorthand / Transcript</label>
                  <textarea
                    placeholder="Paste rough clinical notes, transcription text, or quick bullet points here..."
                    value={clinicalMessyNotes}
                    onChange={(e) => setClinicalMessyNotes(e.target.value)}
                    rows={6}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white resize-none font-mono"
                  />
                </div>
              </div>
            )}

            {/* --- CASE 3: Prescription Suggestions --- */}
            {activeFeature === 'prescription' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Test Preset Templates:</span>
                  <div className="flex gap-1">
                    <button onClick={() => injectPreset('prescription', 'tonsillitis')} className="text-[10px] font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 px-2 py-1 rounded-md cursor-pointer">Tonsillitis</button>
                    <button onClick={() => injectPreset('prescription', 'hypertension')} className="text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded-md cursor-pointer">Hypertension</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Active Diagnosis & Chief Complaints</label>
                    <input
                      type="text"
                      placeholder="e.g. Acute Otitis Media with severe pain and high fever"
                      value={prescDiagnosis}
                      onChange={(e) => setPrescDiagnosis(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Allergies & Medical History (Optional)</label>
                    <textarea
                      placeholder="e.g. Patient is allergic to sulfa medications. History of pediatric asthma."
                      value={prescAllergies}
                      onChange={(e) => setPrescAllergies(e.target.value)}
                      rows={3}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* --- CASE 4: Medical Summary --- */}
            {activeFeature === 'medical-summary' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Test Preset Templates:</span>
                  <button onClick={() => injectPreset('medical-summary', 'emr-sample')} className="text-[10px] font-bold bg-teal-50 text-teal-600 hover:bg-teal-100 px-2 py-1 rounded-md cursor-pointer">Hypothyroidism Case</button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 block">Raw Consultation / Vital Signs Logs</label>
                  <textarea
                    placeholder="Paste unorganized clinical logs, vital logs, or notes..."
                    value={medSummaryRaw}
                    onChange={(e) => setMedSummaryRaw(e.target.value)}
                    rows={6}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white resize-none"
                  />
                </div>
              </div>
            )}

            {/* --- CASE 5: Patient History --- */}
            {activeFeature === 'patient-history' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 block">Select Patient to Synthesize</label>
                  {isLoadingPatients ? (
                    <div className="text-xs text-slate-400 py-2">Consulting Patient Directory...</div>
                  ) : (
                    <select
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                    >
                      <option value="">-- Choose a patient profile --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (DOB: {p.dob})</option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">This will automatically fetch all past appointments, consultations, vitals, and EMR history to perform a comprehensive clinical trend review.</p>
                </div>
              </div>
            )}

            {/* --- CASE 6: Follow-up Suggestions --- */}
            {activeFeature === 'follow-up' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Test Preset Templates:</span>
                  <div className="flex gap-1">
                    <button onClick={() => injectPreset('follow-up', 'asthma')} className="text-[10px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded-md cursor-pointer">Asthma Plan</button>
                    <button onClick={() => injectPreset('follow-up', 'post-op')} className="text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded-md cursor-pointer">Post-op Ortho</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Current Diagnosis & Medical Condition</label>
                    <input
                      type="text"
                      placeholder="e.g. Type 2 Diabetes with high morning glucose readings"
                      value={followUpCondition}
                      onChange={(e) => setFollowUpCondition(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">Active Vitals Signs & Prescriptions (Optional)</label>
                    <textarea
                      placeholder="e.g. BP 130/84, HR 74. On Metformin 500mg daily."
                      value={followUpVitals}
                      onChange={(e) => setFollowUpVitals(e.target.value)}
                      rows={3}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Error alerts */}
            {errorText && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorText}</span>
              </div>
            )}

            {/* Action buttons */}
            <button
              disabled={isGenerating}
              onClick={handleGenerateAI}
              className="w-full py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? 'Synthesizing with Gemini...' : 'Generate AI Insights'}</span>
            </button>
          </div>
        </div>

        {/* AI Output Window (Right) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-500" />
              <span>AI Analysis Results</span>
            </h3>

            {aiResponse && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyToClipboard}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-600 cursor-pointer transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownloadMarkdown}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-600 cursor-pointer transition-all"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {isGenerating ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div className="max-w-xs mx-auto space-y-1">
                  <p className="font-bold text-slate-700 text-xs">Consulting Medical Knowledgebase...</p>
                  <p className="text-[10px] text-slate-400">Gemini is structuring logs, verifying dosages, and validating clinical metrics against the context schema.</p>
                </div>
              </div>
            ) : aiResponse ? (
              <div className="text-xs text-slate-700 leading-relaxed space-y-4 prose prose-slate max-w-none prose-sm overflow-y-auto max-h-[60vh] p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                {/* Visual Disclaimer if Prescription */}
                {activeFeature === 'prescription' && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-[10px] font-semibold flex gap-2">
                    <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>DRAFT GENERATION ONLY. Must be fully cross-referenced, evaluated, and signed-off by a licensed medical practitioner. Do not provide directly to the patient without medical validation.</span>
                  </div>
                )}
                
                {/* Render clean formatted markdown line by line with simple styling */}
                <div className="whitespace-pre-line font-sans">
                  {aiResponse}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 space-y-4 text-slate-400">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <Brain className="w-8 h-8" />
                </div>
                <div className="max-w-xs mx-auto space-y-1">
                  <p className="font-bold text-slate-700 text-xs">Playground Waiting...</p>
                  <p className="text-[10px]">Provide clinical details, symptoms, EMR data, or select a patient on the left to start generating insights.</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-50 pt-4 mt-4 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Powered by @google/genai SDK</span>
            <span>CareSync Clinical Suite v1.1</span>
          </div>
        </div>

      </div>

    </div>
  );
}
