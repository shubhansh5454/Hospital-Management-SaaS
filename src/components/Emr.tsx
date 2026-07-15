import React, { useState, useRef, useEffect, ChangeEvent, DragEvent, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { 
  HeartPulse, 
  Search, 
  Plus, 
  FileText, 
  History, 
  Activity, 
  ShieldAlert, 
  Printer, 
  Trash2, 
  Edit3, 
  FileDown, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  AlertTriangle,
  ClipboardList,
  Pill,
  Paperclip,
  Calendar,
  X,
  PlusCircle,
  FileBadge2,
  CalendarCheck2
} from 'lucide-react';
import { Patient, EmrRecord, PrescriptionItem, AttachmentItem } from '../types/index.ts';
import CdsPanel from './CdsPanel.tsx';

export default function Emr() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();

  const isClinician = profile?.role === 'admin' || profile?.role === 'doctor';
  const isPatient = profile?.role === 'patient';

  // Navigation / Selected States
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form toggles
  const [showAddEncounter, setShowAddEncounter] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [showEditPatientSummary, setShowEditPatientSummary] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<number | null>(null);

  // Drag and drop attachment state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------
  // Persistent Patient Summary Edit State
  // ----------------------------------------------------
  const [tempAllergies, setTempAllergies] = useState('');
  const [tempMedicalHistory, setTempMedicalHistory] = useState('');

  // ----------------------------------------------------
  // Clinical Encounter Creator States
  // ----------------------------------------------------
  const [encDate, setEncDate] = useState(new Date().toISOString().split('T')[0]);
  const [encDiagnosis, setEncDiagnosis] = useState('');
  
  // Vitals
  const [vitBP, setVitBP] = useState('');
  const [vitHR, setVitHR] = useState('');
  const [vitTemp, setVitTemp] = useState('');
  const [vitRR, setVitRR] = useState('');
  const [vitWeight, setVitWeight] = useState('');
  const [vitHeight, setVitHeight] = useState('');
  const [vitO2, setVitO2] = useState('');
  const [vitBmi, setVitBmi] = useState('');

  // SOAP
  const [soapS, setSoapS] = useState('');
  const [soapO, setSoapO] = useState('');
  const [soapA, setSoapA] = useState('');
  const [soapP, setSoapP] = useState('');

  // Prescriptions
  const [prescriptionsList, setPrescriptionsList] = useState<PrescriptionItem[]>([]);
  const [newMed, setNewMed] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newFreq, setNewFreq] = useState('');
  const [newDur, setNewDur] = useState('');
  const [newInst, setNewInst] = useState('');

  // Attachments
  const [attachmentsList, setAttachmentsList] = useState<AttachmentItem[]>([]);

  // Follow-up
  const [followNotes, setFollowNotes] = useState('');
  const [followDate, setFollowDate] = useState('');

  // AI CDS Sign-Off Callback Handler
  const handleApproveCdsSuggestions = (approvedMeds: PrescriptionItem[], primaryDiagnosis: string, notes: string) => {
    setPrescriptionsList(approvedMeds);
    if (primaryDiagnosis && !encDiagnosis) {
      setEncDiagnosis(primaryDiagnosis);
    }
    setSoapP((prev) => {
      const header = `[AI Decision Support Review Done]`;
      if (prev.includes(header)) return prev;
      return `${prev}\n\n${header}\n${notes}`.trim();
    });
  };

  // ----------------------------------------------------
  // API Queries & Mutations
  // ----------------------------------------------------

  // Fetch Patients List
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery<Patient[], Error>({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await fetch('/api/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load patient directory');
      return res.json();
    },
    enabled: !!token
  });

  // Automatically select profile if logged-in user is a patient
  const myPatientProfile = isPatient 
    ? patients.find(p => p.email.toLowerCase() === profile?.email?.toLowerCase())
    : null;

  const activePatientId = isPatient ? myPatientProfile?.id : selectedPatientId;

  // Fetch Full Details of Selected Patient (including EMR History)
  const { data: rawPatientDetails, isLoading: isLoadingDetails } = useQuery<Patient, Error>({
    queryKey: ['patient', activePatientId],
    queryFn: async () => {
      const res = await fetch(`/api/patients/${activePatientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load medical folder');
      return res.json();
    },
    enabled: !!token && !!activePatientId,
  });

  const patientDetails = rawPatientDetails as Patient | undefined;

  // Set local state when patient details load
  useEffect(() => {
    if (patientDetails) {
      setTempAllergies(patientDetails.allergies || '');
      setTempMedicalHistory(patientDetails.medicalHistory || '');
    }
  }, [patientDetails]);

  // Mutation: Update Permanent Patient Medical Summary (Allergies/History)
  const updateSummaryMutation = useMutation({
    mutationFn: async (payload: { allergies: string, medicalHistory: string }) => {
      const res = await fetch(`/api/patients/${activePatientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          allergies: payload.allergies,
          medicalHistory: payload.medicalHistory
        })
      });
      if (!res.ok) throw new Error('Failed to update permanent files');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', activePatientId] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setSuccessMessage('Patient clinical folder summary updated successfully.');
      setShowEditPatientSummary(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to sync clinical edits');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  });

  // Mutation: Create EMR Encounter Record
  const createRecordMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/emr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit clinical note');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', activePatientId] });
      setSuccessMessage('Clinical encounter logged successfully!');
      resetEncounterForm();
      setShowAddEncounter(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to save encounter note');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  });

  // Mutation: Update EMR Encounter Record
  const updateRecordMutation = useMutation({
    mutationFn: async (payload: { id: number, data: any }) => {
      const res = await fetch(`/api/emr/${payload.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload.data)
      });
      if (!res.ok) throw new Error('Failed to update clinical record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', activePatientId] });
      setSuccessMessage('Clinical encounter updated successfully.');
      setEditingRecordId(null);
      resetEncounterForm();
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to save clinical edits');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  });

  // Mutation: Delete EMR Record
  const deleteRecordMutation = useMutation({
    mutationFn: async (recordId: number) => {
      const res = await fetch(`/api/emr/${recordId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete clinical record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', activePatientId] });
      setSuccessMessage('Clinical record removed from patient archives.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Deletion failed');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  });

  // ----------------------------------------------------
  // Form Actions & Calculation Utilities
  // ----------------------------------------------------
  const handleBmiCalculation = (weightStr: string, heightStr: string) => {
    const weight = parseFloat(weightStr);
    const height = parseFloat(heightStr);
    if (!isNaN(weight) && !isNaN(height) && height > 0) {
      const heightInMeters = height / 100;
      const bmiVal = (weight / (heightInMeters * heightInMeters)).toFixed(1);
      setVitBmi(bmiVal);
    } else {
      setVitBmi('');
    }
  };

  const handleWeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    setVitWeight(e.target.value);
    handleBmiCalculation(e.target.value, vitHeight);
  };

  const handleHeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    setVitHeight(e.target.value);
    handleBmiCalculation(vitWeight, e.target.value);
  };

  // Add medication to prescription list
  const addMedicationLine = () => {
    if (!newMed) return;
    const medItem: PrescriptionItem = {
      medication: newMed,
      dosage: newDosage,
      frequency: newFreq,
      duration: newDur,
      instructions: newInst || undefined
    };
    setPrescriptionsList([...prescriptionsList, medItem]);
    setNewMed('');
    setNewDosage('');
    setNewFreq('');
    setNewDur('');
    setNewInst('');
  };

  const removeMedicationLine = (idx: number) => {
    setPrescriptionsList(prescriptionsList.filter((_, i) => i !== idx));
  };

  // Drag and drop attachment files
  const processFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        const attach: AttachmentItem = {
          name: file.name,
          size: file.size,
          type: file.type,
          data: base64Data
        };
        setAttachmentsList((prev) => [...prev, attach]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachmentsList(attachmentsList.filter((_, i) => i !== idx));
  };

  const resetEncounterForm = () => {
    setEncDate(new Date().toISOString().split('T')[0]);
    setEncDiagnosis('');
    setVitBP('');
    setVitHR('');
    setVitTemp('');
    setVitRR('');
    setVitWeight('');
    setVitHeight('');
    setVitBmi('');
    setVitO2('');
    setSoapS('');
    setSoapO('');
    setSoapA('');
    setSoapP('');
    setPrescriptionsList([]);
    setAttachmentsList([]);
    setFollowNotes('');
    setFollowDate('');
  };

  const submitEncounterForm = (e: FormEvent) => {
    e.preventDefault();
    if (!encDiagnosis) {
      setErrorMessage('Primary diagnosis is required to log encounter');
      return;
    }

    const payload = {
      patientId: activePatientId!,
      date: encDate,
      diagnosis: encDiagnosis,
      bloodPressure: vitBP || null,
      heartRate: vitHR ? parseInt(vitHR, 10) : null,
      temperature: vitTemp || null,
      respiratoryRate: vitRR ? parseInt(vitRR, 10) : null,
      weight: vitWeight || null,
      height: vitHeight || null,
      bmi: vitBmi || null,
      oxygenSaturation: vitO2 ? parseInt(vitO2, 10) : null,
      soapSubjective: soapS || null,
      soapObjective: soapO || null,
      soapAssessment: soapA || null,
      soapPlan: soapP || null,
      prescriptions: prescriptionsList.length > 0 ? JSON.stringify(prescriptionsList) : null,
      attachments: attachmentsList.length > 0 ? JSON.stringify(attachmentsList) : null,
      followUpNotes: followNotes || null,
      followUpDate: followDate || null,
    };

    if (editingRecordId) {
      updateRecordMutation.mutate({ id: editingRecordId, data: payload });
    } else {
      createRecordMutation.mutate(payload);
    }
  };

  // Launch Editing mode for a record
  const startEditingRecord = (rec: EmrRecord) => {
    setEditingRecordId(rec.id);
    setEncDate(rec.date);
    setEncDiagnosis(rec.diagnosis);
    setVitBP(rec.bloodPressure || '');
    setVitHR(rec.heartRate?.toString() || '');
    setVitTemp(rec.temperature || '');
    setVitRR(rec.respiratoryRate?.toString() || '');
    setVitWeight(rec.weight || '');
    setVitHeight(rec.height || '');
    setVitBmi(rec.bmi || '');
    setVitO2(rec.oxygenSaturation?.toString() || '');
    setSoapS(rec.soapSubjective || '');
    setSoapO(rec.soapObjective || '');
    setSoapA(rec.soapAssessment || '');
    setSoapP(rec.soapPlan || '');
    setFollowNotes(rec.followUpNotes || '');
    setFollowDate(rec.followUpDate || '');
    
    // Parse JSON lists
    try {
      setPrescriptionsList(rec.prescriptions ? JSON.parse(rec.prescriptions) : []);
    } catch {
      setPrescriptionsList([]);
    }
    try {
      setAttachmentsList(rec.attachments ? JSON.parse(rec.attachments) : []);
    } catch {
      setAttachmentsList([]);
    }

    setShowAddEncounter(true);
  };

  // ----------------------------------------------------
  // Export Medical Record as beautifully printed PDF
  // ----------------------------------------------------
  const handlePrintRecord = (rec: EmrRecord) => {
    const pDetails = patientDetails || rec.patient;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocker is preventing clinical report print page. Please allow popups.');
      return;
    }

    // Parse sub-lists
    let meds: PrescriptionItem[] = [];
    try { meds = rec.prescriptions ? JSON.parse(rec.prescriptions) : []; } catch {}

    let files: AttachmentItem[] = [];
    try { files = rec.attachments ? JSON.parse(rec.attachments) : []; } catch {}

    printWindow.document.write(`
      <html>
        <head>
          <title>Clinical Report - CareSync Clinic</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-b: 2px solid #0f766e; pb: 20px; margin-bottom: 30px; }
            .header-title { color: #0f766e; font-size: 26px; font-weight: bold; margin: 0; }
            .header-subtitle { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
            .meta-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .meta-block h4 { margin: 0 0 10px 0; color: #0f766e; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; pb: 5px; }
            .meta-field { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
            .meta-label { color: #64748b; font-weight: 500; }
            .meta-val { color: #1e293b; font-weight: 600; }
            .section-title { font-size: 16px; font-weight: bold; color: #0f766e; border-left: 4px solid #0f766e; padding-left: 10px; margin: 25px 0 15px 0; }
            .vitals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
            .vital-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; }
            .vital-card .vital-val { font-size: 15px; font-weight: bold; color: #0f766e; margin-top: 5px; }
            .vital-card .vital-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; }
            .soap-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 25px; }
            .soap-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; }
            .soap-card-title { font-size: 12px; font-weight: bold; color: #0f766e; text-transform: uppercase; margin: 0 0 8px 0; }
            .soap-content { font-size: 12px; color: #334155; white-space: pre-line; }
            .rx-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            .rx-table th { background-color: #f1f5f9; color: #475569; font-weight: bold; text-align: left; padding: 10px; border: 1px solid #cbd5e1; }
            .rx-table td { padding: 10px; border: 1px solid #cbd5e1; color: #334155; }
            .rx-table tr:nth-child(even) { background-color: #f8fafc; }
            .signature-area { margin-top: 50px; display: flex; justify-content: space-between; pt: 40px; border-t: 1px dashed #cbd5e1; }
            .signature-block { width: 220px; text-align: center; }
            .signature-line { border-bottom: 1px solid #94a3b8; height: 30px; margin-bottom: 10px; }
            .signature-label { font-size: 11px; color: #64748b; font-weight: 500; }
            @media print {
              body { padding: 0; }
              .vital-card { background-color: #ffffff !important; }
              .meta-section { background-color: #ffffff !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2 class="header-title">CareSync Medical Center</h2>
              <div class="header-subtitle">Electronic Health Registry System</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; font-size: 14px; color: #0f766e;">Clinical Note Record</div>
              <div style="font-size: 11px; color: #64748b;">Encounter Date: ${rec.date}</div>
            </div>
          </div>

          <div class="meta-section">
            <div class="meta-block">
              <h4>Patient Demographics</h4>
              <div class="meta-field">
                <span class="meta-label">Patient Name:</span>
                <span class="meta-val">${pDetails?.name}</span>
              </div>
              <div class="meta-field">
                <span class="meta-label">Date of Birth:</span>
                <span class="meta-val">${pDetails?.dob}</span>
              </div>
              <div class="meta-field">
                <span class="meta-label">Gender:</span>
                <span class="meta-val">${pDetails?.gender}</span>
              </div>
              <div class="meta-field">
                <span class="meta-label">Blood Group:</span>
                <span class="meta-val">${pDetails?.bloodGroup || 'Unknown'}</span>
              </div>
            </div>

            <div class="meta-block">
              <h4>Permanent Health Summary</h4>
              <div class="meta-field">
                <span class="meta-label">Allergies:</span>
                <span class="meta-val" style="color: #dc2626;">${pDetails?.allergies || 'No Known Drug Allergies (NKDA)'}</span>
              </div>
              <div class="meta-field">
                <span class="meta-label">Chronic Conditions / History:</span>
                <span class="meta-val">${pDetails?.medicalHistory || 'No historical surgical/chronic details on file'}</span>
              </div>
              <div class="meta-field">
                <span class="meta-label">Attending Clinician:</span>
                <span class="meta-val">${rec.doctor?.name || profile?.name}</span>
              </div>
            </div>
          </div>

          <div class="section-title">Clinical Encounter Overview</div>
          <div style="margin-bottom: 20px; font-size: 13px;">
            <strong>Primary Assessment / Diagnosis:</strong>
            <span style="display: block; margin-top: 5px; background: #f0fdfa; border: 1px solid #ccfbf1; padding: 10px; border-radius: 6px; font-weight: bold; color: #0d9488;">
              ${rec.diagnosis}
            </span>
          </div>

          <div class="section-title">Encounter Vitals Check</div>
          <div class="vitals-grid">
            <div class="vital-card">
              <div class="vital-lbl">Blood Pressure</div>
              <div class="vital-val">${rec.bloodPressure || '-'}</div>
            </div>
            <div class="vital-card">
              <div class="vital-lbl">Heart Rate</div>
              <div class="vital-val">${rec.heartRate ? rec.heartRate + ' bpm' : '-'}</div>
            </div>
            <div class="vital-card">
              <div class="vital-lbl">Temperature</div>
              <div class="vital-val">${rec.temperature ? rec.temperature + ' °C' : '-'}</div>
            </div>
            <div class="vital-card">
              <div class="vital-lbl">O₂ Saturation</div>
              <div class="vital-val">${rec.oxygenSaturation ? rec.oxygenSaturation + ' %' : '-'}</div>
            </div>
            <div class="vital-card">
              <div class="vital-lbl">Respiratory Rate</div>
              <div class="vital-val">${rec.respiratoryRate ? rec.respiratoryRate + ' /min' : '-'}</div>
            </div>
            <div class="vital-card">
              <div class="vital-lbl">Weight</div>
              <div class="vital-val">${rec.weight ? rec.weight + ' kg' : '-'}</div>
            </div>
            <div class="vital-card">
              <div class="vital-lbl">Height</div>
              <div class="vital-val">${rec.height ? rec.height + ' cm' : '-'}</div>
            </div>
            <div class="vital-card">
              <div class="vital-lbl">BMI Index</div>
              <div class="vital-val">${rec.bmi || '-'}</div>
            </div>
          </div>

          <div class="section-title">S.O.A.P Clinical Notes</div>
          <div class="soap-grid">
            ${rec.soapSubjective ? `
              <div class="soap-card">
                <div class="soap-card-title">Subjective (Patient Complaints, Symptoms, History)</div>
                <div class="soap-content">${rec.soapSubjective}</div>
              </div>
            ` : ''}
            ${rec.soapObjective ? `
              <div class="soap-card">
                <div class="soap-card-title">Objective (Clinical Observations, Physical Examination)</div>
                <div class="soap-content">${rec.soapObjective}</div>
              </div>
            ` : ''}
            ${rec.soapAssessment ? `
              <div class="soap-card">
                <div class="soap-card-title">Assessment (Differential Diagnosis, Medical Rationale)</div>
                <div class="soap-content">${rec.soapAssessment}</div>
              </div>
            ` : ''}
            ${rec.soapPlan ? `
              <div class="soap-card">
                <div class="soap-card-title">Plan (Treatment protocol, lifestyle instructions, lab triggers)</div>
                <div class="soap-content">${rec.soapPlan}</div>
              </div>
            ` : ''}
          </div>

          ${meds.length > 0 ? `
            <div class="section-title">Active Prescription Plan (Rx)</div>
            <table class="rx-table">
              <thead>
                <tr>
                  <th>Medication / Formula</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                  <th>Special Instructions</th>
                </tr>
              </thead>
              <tbody>
                ${meds.map(m => `
                  <tr>
                    <td><strong>${m.medication}</strong></td>
                    <td>${m.dosage}</td>
                    <td>${m.frequency}</td>
                    <td>${m.duration}</td>
                    <td>${m.instructions || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${rec.followUpNotes || rec.followUpDate ? `
            <div class="section-title">Clinical Follow-up & Progression Care</div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-size: 12px; display: flex; justify-content: space-between; gap: 20px;">
              <div style="flex: 1;">
                <strong>Instructions:</strong>
                <p style="margin: 5px 0 0 0; color: #475569;">${rec.followUpNotes || 'Return if symptoms worsen or fail to clear.'}</p>
              </div>
              ${rec.followUpDate ? `
                <div style="text-align: right; min-width: 150px;">
                  <strong>Scheduled Follow-up Date:</strong>
                  <div style="font-size: 14px; font-weight: bold; color: #0f766e; margin-top: 5px;">${rec.followUpDate}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="signature-area">
            <div class="signature-block">
              <div class="signature-line"></div>
              <div class="signature-label">Medical Attendant Signature</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 3px;">${rec.doctor?.name || profile?.name}</div>
            </div>
            <div class="signature-block">
              <div class="signature-line"></div>
              <div class="signature-label">Patient Acknowledgement</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 3px;">Date: ${new Date().toLocaleDateString()}</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ----------------------------------------------------
  // View Rendering
  // ----------------------------------------------------
  
  // Filter patient directory search
  const filteredPatients = patients.filter(p => {
    const term = patientSearch.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.email.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6 font-sans">
      
      {/* Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex gap-3 text-xs font-medium animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex gap-3 text-xs font-medium animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Patient Directory Lookup (Hidden for Patients themselves) */}
        {!isPatient && (
          <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
              <ClipboardList className="w-4.5 h-4.5 text-teal-500" />
              <h3 className="text-xs font-display font-bold text-slate-800 uppercase tracking-wider">Clinical Folders</h3>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search patient records..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 border border-slate-200 focus:border-teal-500 rounded-xl text-xs font-medium focus:outline-none transition-colors"
              />
            </div>

            {/* List of Patients */}
            {isLoadingPatients ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-slate-50 border border-slate-100/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-8">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">No folders match criteria</p>
                <p className="text-[10px] text-slate-400 mt-1">Check email spelling or register profile</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {filteredPatients.map(p => {
                  const isActive = selectedPatientId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatientId(p.id);
                        setShowAddEncounter(false);
                        setEditingRecordId(null);
                        setExpandedRecordId(null);
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'border-teal-500/30 bg-teal-50/50 shadow-sm'
                          : 'border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="overflow-hidden pr-2">
                        <span className={`text-xs font-bold block truncate ${isActive ? 'text-teal-900' : 'text-slate-800'}`}>
                          {p.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{p.email}</span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 font-mono">
                        <span>{p.bloodGroup || 'O+'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* RIGHT COLUMN: Active Patient Medical Summary & Encounter Timeline */}
        <div className={`${isPatient ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-6`}>
          
          {!activePatientId ? (
            /* Unselected State Prompt */
            <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-inner border border-teal-100/50">
                <HeartPulse className="w-6.5 h-6.5" />
              </div>
              <h4 className="text-sm font-display font-bold text-slate-800">Select Clinical Folder</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Access any patient folder on the left pane to view SOAP notes, log vitals, prescribe medications, or export clinical PDFs.
              </p>
            </div>
          ) : isLoadingDetails ? (
            /* Loading details */
            <div className="space-y-4">
              <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse" />
              <div className="h-60 bg-white border border-slate-100 rounded-2xl animate-pulse" />
            </div>
          ) : !patientDetails ? (
            <div className="bg-white border border-slate-100 p-8 rounded-2xl text-center text-xs text-slate-500">
              Error fetching patient information.
            </div>
          ) : (
            <>
              {/* PATIENT HEADER & SUMMARIES (Allergies + Medical History) */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                
                {/* Header Profile */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-teal-50 border border-teal-100 text-teal-600 rounded-2xl flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                      {patientDetails.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-display font-bold text-slate-800">{patientDetails.name}</h3>
                        {patientDetails.bloodGroup && (
                          <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[9px] font-bold font-mono">
                            {patientDetails.bloodGroup}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        DOB: <span className="font-semibold text-slate-600">{patientDetails.dob}</span> | Gender: <span className="font-semibold text-slate-600 capitalize">{patientDetails.gender}</span>
                      </p>
                    </div>
                  </div>

                  {/* Encounter trigger (Doctor/Admin only) */}
                  {isClinician && (
                    <button
                      onClick={() => {
                        setEditingRecordId(null);
                        resetEncounterForm();
                        setShowAddEncounter(!showAddEncounter);
                      }}
                      className="h-9 px-3.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      {showAddEncounter ? (
                        <>
                          <History className="w-4 h-4" />
                          <span>View History List</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Add Encounter note</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Patient Summary Card (Allergies / Chronic Conditions) */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5 relative">
                  {showEditPatientSummary ? (
                    /* Edit summary fields */
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                            <span>Allergies / Drug Sensitivities</span>
                          </label>
                          <textarea
                            value={tempAllergies}
                            onChange={(e) => setTempAllergies(e.target.value)}
                            placeholder="e.g. Penicillin, Peanuts (or type NKDA)"
                            rows={3}
                            className="w-full p-2.5 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <History className="w-3.5 h-3.5 text-slate-400" />
                            <span>Persistent Medical History</span>
                          </label>
                          <textarea
                            value={tempMedicalHistory}
                            onChange={(e) => setTempMedicalHistory(e.target.value)}
                            placeholder="e.g. Hypertension (dx 2018), Type 2 Diabetes"
                            rows={3}
                            className="w-full p-2.5 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTempAllergies(patientDetails.allergies || '');
                            setTempMedicalHistory(patientDetails.medicalHistory || '');
                            setShowEditPatientSummary(false);
                          }}
                          className="h-8 px-3 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-white cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSummaryMutation.mutate({ allergies: tempAllergies, medicalHistory: tempMedicalHistory })}
                          className="h-8 px-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          {updateSummaryMutation.isPending ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Sync Summary</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display summary details */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Allergies Block */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>Allergies & Sensitivities</span>
                        </span>
                        <div className={`p-2.5 rounded-lg border text-xs font-medium ${
                          patientDetails.allergies
                            ? 'bg-rose-50/50 border-rose-100 text-rose-800'
                            : 'bg-slate-100/50 border-slate-200/50 text-slate-500 italic'
                        }`}>
                          {patientDetails.allergies || 'No Known Drug Allergies (NKDA)'}
                        </div>
                      </div>

                      {/* Medical History Block */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Permanent Medical History</span>
                        </span>
                        <div className="p-2.5 rounded-lg border border-slate-200/50 bg-slate-100/30 text-xs font-medium text-slate-700 min-h-[38px]">
                          {patientDetails.medicalHistory || <span className="italic text-slate-400">No medical history logged</span>}
                        </div>
                      </div>

                      {/* Edit Trigger (Clinicians only) */}
                      {isClinician && (
                        <button
                          onClick={() => setShowEditPatientSummary(true)}
                          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                          title="Edit persistent summaries"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {showAddEncounter ? (
                /* CLINICAL ENCOUNTER FORM */
                <form onSubmit={submitEncounterForm} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <h4 className="text-sm font-display font-bold text-slate-800 flex items-center gap-2">
                      <FileBadge2 className="w-4.5 h-4.5 text-teal-500" />
                      <span>{editingRecordId ? 'Edit Clinical Encounter Record' : 'Record New Clinical Encounter'}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddEncounter(false);
                        setEditingRecordId(null);
                        resetEncounterForm();
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Date & Diagnosis */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Encounter Date *</label>
                      <input
                        type="date"
                        required
                        value={encDate}
                        onChange={(e) => setEncDate(e.target.value)}
                        className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Primary Diagnosis / Assessment *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Acute Pharyngitis (Streptococcal) or Essential Hypertension"
                        value={encDiagnosis}
                        onChange={(e) => setEncDiagnosis(e.target.value)}
                        className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Vitals Block */}
                  <div className="space-y-3.5">
                    <h5 className="text-[10px] font-bold text-teal-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Activity className="w-4 h-4 shrink-0 text-teal-500" />
                      <span>Patient Vitals Tracking</span>
                    </h5>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 block">BP (Blood Pressure)</label>
                        <input
                          type="text"
                          placeholder="e.g. 120/80"
                          value={vitBP}
                          onChange={(e) => setVitBP(e.target.value)}
                          className="w-full h-9 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 block">Pulse (Heart Rate)</label>
                        <input
                          type="number"
                          placeholder="bpm"
                          value={vitHR}
                          onChange={(e) => setVitHR(e.target.value)}
                          className="w-full h-9 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 block">Temp (°C)</label>
                        <input
                          type="text"
                          placeholder="e.g. 36.8"
                          value={vitTemp}
                          onChange={(e) => setVitTemp(e.target.value)}
                          className="w-full h-9 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 block">O₂ Saturation (%)</label>
                        <input
                          type="number"
                          placeholder="%"
                          value={vitO2}
                          onChange={(e) => setVitO2(e.target.value)}
                          className="w-full h-9 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 block">Resp. Rate (/min)</label>
                        <input
                          type="number"
                          placeholder="breaths"
                          value={vitRR}
                          onChange={(e) => setVitRR(e.target.value)}
                          className="w-full h-9 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 block">Weight (kg)</label>
                        <input
                          type="text"
                          placeholder="kg"
                          value={vitWeight}
                          onChange={handleWeightChange}
                          className="w-full h-9 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 block">Height (cm)</label>
                        <input
                          type="text"
                          placeholder="cm"
                          value={vitHeight}
                          onChange={handleHeightChange}
                          className="w-full h-9 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 block">Body Mass Index (BMI)</label>
                        <input
                          type="text"
                          readOnly
                          placeholder="Auto"
                          value={vitBmi}
                          className="w-full h-9 px-2.5 border border-slate-200 bg-slate-100 rounded-lg text-xs font-semibold text-teal-700 cursor-not-allowed"
                        />
                      </div>

                    </div>
                  </div>

                  {/* SOAP Clinical Notes Block */}
                  <div className="space-y-3.5">
                    <h5 className="text-[10px] font-bold text-teal-600 uppercase tracking-widest flex items-center gap-1.5">
                      <FileText className="w-4 h-4 shrink-0 text-teal-500" />
                      <span>S.O.A.P Clinical Note Framework</span>
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">Subjective (S)</label>
                        <textarea
                          placeholder="History of present illness, primary complaint, symptoms description"
                          rows={3}
                          value={soapS}
                          onChange={(e) => setSoapS(e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">Objective (O)</label>
                        <textarea
                          placeholder="Physical exam findings, auscultation notes, observations, visible states"
                          rows={3}
                          value={soapO}
                          onChange={(e) => setSoapO(e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">Assessment (A)</label>
                        <textarea
                          placeholder="Clinical rationale, severity analysis, differential diagnosis comments"
                          rows={3}
                          value={soapA}
                          onChange={(e) => setSoapA(e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">Plan (P)</label>
                        <textarea
                          placeholder="Immediate interventions, therapy plans, diagnostic orders, patient advice"
                          rows={3}
                          value={soapP}
                          onChange={(e) => setSoapP(e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                    </div>
                  </div>

                  {/* Prescription (Rx) Builder */}
                  <div className="space-y-3.5">
                    <h5 className="text-[10px] font-bold text-teal-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Pill className="w-4 h-4 shrink-0 text-teal-500" />
                      <span>Prescription Builder (Rx)</span>
                    </h5>

                    <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-4">
                      
                      {/* Temporary Prescription Inputs Row */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                        <div className="space-y-1 col-span-2 md:col-span-1">
                          <label className="text-[10px] font-bold text-slate-400 block">Medication Name</label>
                          <input
                            type="text"
                            placeholder="Amoxicillin 500mg"
                            value={newMed}
                            onChange={(e) => setNewMed(e.target.value)}
                            className="w-full h-8.5 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 block">Dosage</label>
                          <input
                            type="text"
                            placeholder="1 Tablet"
                            value={newDosage}
                            onChange={(e) => setNewDosage(e.target.value)}
                            className="w-full h-8.5 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 block">Frequency</label>
                          <input
                            type="text"
                            placeholder="3x Daily (q8h)"
                            value={newFreq}
                            onChange={(e) => setNewFreq(e.target.value)}
                            className="w-full h-8.5 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 block">Duration</label>
                          <input
                            type="text"
                            placeholder="7 Days"
                            value={newDur}
                            onChange={(e) => setNewDur(e.target.value)}
                            className="w-full h-8.5 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1 col-span-2 md:col-span-1">
                          <button
                            type="button"
                            onClick={addMedicationLine}
                            className="w-full h-8.5 bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Add Rx Line</span>
                          </button>
                        </div>
                      </div>

                      {/* Optional Medication Instructions */}
                      <div className="space-y-1 max-w-xl">
                        <label className="text-[10px] font-bold text-slate-400 block">Medication Advisory / Instructions</label>
                        <input
                          type="text"
                          placeholder="e.g. Take with food. Finish full course to prevent recurrence."
                          value={newInst}
                          onChange={(e) => setNewInst(e.target.value)}
                          className="w-full h-8.5 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none"
                        />
                      </div>

                      {/* Render Active Prescriptions List */}
                      {prescriptionsList.length > 0 && (
                        <div className="border border-slate-200/60 rounded-lg overflow-hidden bg-white mt-4">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                                <th className="p-2.5 pl-4">Medication</th>
                                <th className="p-2.5">Dosage</th>
                                <th className="p-2.5">Frequency</th>
                                <th className="p-2.5">Duration</th>
                                <th className="p-2.5">Instructions</th>
                                <th className="p-2.5 text-center w-12"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                              {prescriptionsList.map((m, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 pl-4 font-bold text-slate-800">{m.medication}</td>
                                  <td className="p-2.5">{m.dosage}</td>
                                  <td className="p-2.5">{m.frequency}</td>
                                  <td className="p-2.5">{m.duration}</td>
                                  <td className="p-2.5 text-slate-400">{m.instructions || '-'}</td>
                                  <td className="p-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeMedicationLine(idx)}
                                      className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Drag & Drop Attachments */}
                  <div className="space-y-3.5">
                    <h5 className="text-[10px] font-bold text-teal-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 shrink-0 text-teal-500" />
                      <span>Attachments & Clinical Artifacts</span>
                    </h5>

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                        isDragging 
                          ? 'border-teal-500 bg-teal-50/20' 
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/30'
                      }`}
                    >
                      <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <FileDown className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-700">Drag & drop files here, or click to upload</p>
                      <p className="text-[10px] text-slate-400 mt-1">Upload clinical photos, labs, x-ray scans (PDF, JPG, PNG)</p>
                    </div>

                    {/* Attachments List */}
                    {attachmentsList.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {attachmentsList.map((file, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                              <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                              <div className="overflow-hidden">
                                <span className="font-semibold text-slate-700 block truncate">{file.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAttachment(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Follow up Information */}
                  <div className="space-y-3.5">
                    <h5 className="text-[10px] font-bold text-teal-600 uppercase tracking-widest flex items-center gap-1.5">
                      <CalendarCheck2 className="w-4 h-4 shrink-0 text-teal-500" />
                      <span>Follow-up Planning</span>
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Follow-up Date</label>
                        <input
                          type="date"
                          value={followDate}
                          onChange={(e) => setFollowDate(e.target.value)}
                          className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Progression Instructions</label>
                        <input
                          type="text"
                          placeholder="e.g. Return in 1 week for blood pressure re-assessment"
                          value={followNotes}
                          onChange={(e) => setFollowNotes(e.target.value)}
                          className="w-full h-10 px-3 border border-slate-200 focus:border-teal-500 rounded-lg text-xs font-medium focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* AI Clinical Decision Support Panel */}
                  {isClinician && activePatientId && (
                    <div className="mt-6 border-t border-slate-100 pt-6">
                      <CdsPanel
                        patientId={activePatientId}
                        symptoms={soapS || encDiagnosis}
                        proposedMedications={prescriptionsList}
                        appointmentId={null}
                        onApproveSuggestions={handleApproveCdsSuggestions}
                      />
                    </div>
                  )}

                  {/* Form Submission Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddEncounter(false);
                        setEditingRecordId(null);
                        resetEncounterForm();
                      }}
                      className="h-10 px-5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createRecordMutation.isPending || updateRecordMutation.isPending}
                      className="h-10 px-5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      {createRecordMutation.isPending || updateRecordMutation.isPending ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span>{editingRecordId ? 'Save Encounter Edits' : 'Log Clinical Note'}</span>
                      )}
                    </button>
                  </div>

                </form>
              ) : (
                /* ENCOUNTER RECORDS TIMELINE VIEW */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-display font-bold text-slate-500 uppercase tracking-wider">Clinical Encounter Timeline</h4>
                    <span className="text-[10px] font-semibold text-slate-400 font-mono">
                      {(patientDetails.emrRecords || []).length} Encounters logged
                    </span>
                  </div>

                  {(patientDetails.emrRecords || []).length === 0 ? (
                    <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center space-y-2">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-600">No medical encounters archived</p>
                      <p className="text-xs text-slate-400">
                        {isClinician ? 'Create your first visit clinical note using the add button.' : 'You have no historical clinical records on file.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4.5">
                      {(patientDetails.emrRecords || []).map((rec: EmrRecord) => {
                        const isExpanded = expandedRecordId === rec.id;
                        
                        // Parse JSON fields safely
                        let meds: PrescriptionItem[] = [];
                        try { meds = rec.prescriptions ? JSON.parse(rec.prescriptions) : []; } catch {}

                        let files: AttachmentItem[] = [];
                        try { files = rec.attachments ? JSON.parse(rec.attachments) : []; } catch {}

                        return (
                          <div key={rec.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden transition-all duration-150">
                            
                            {/* Card Header (Always visible summary) */}
                            <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                              <div className="flex items-center gap-3.5">
                                <div className="w-9 h-9 bg-white border border-slate-200/60 rounded-xl flex items-center justify-center text-teal-600 font-bold shadow-xs">
                                  <Calendar className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-800">{rec.date}</span>
                                    <span className="text-[10px] bg-teal-50 border border-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold">
                                      Diagnosis
                                    </span>
                                  </div>
                                  <h5 className="text-xs font-semibold text-slate-700 mt-0.5">{rec.diagnosis}</h5>
                                </div>
                              </div>

                              {/* Actions Bar */}
                              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <button
                                  onClick={() => handlePrintRecord(rec)}
                                  className="h-8 px-2.5 border border-slate-200 hover:bg-white text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                  title="Export professional PDF"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Clinical Print</span>
                                </button>

                                {isClinician && (
                                  <>
                                    <button
                                      onClick={() => startEditingRecord(rec)}
                                      className="h-8 w-8 border border-slate-200 hover:border-slate-300 hover:bg-white text-slate-500 hover:text-slate-700 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                                      title="Edit Note"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm('Delete this clinical note permanent record? This action is irreversible.')) {
                                          deleteRecordMutation.mutate(rec.id);
                                        }
                                      }}
                                      className="h-8 w-8 border border-red-100 hover:border-red-200 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                                      title="Delete Note"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}

                                <button
                                  onClick={() => setExpandedRecordId(isExpanded ? null : rec.id)}
                                  className="h-8 px-2.5 text-slate-400 hover:text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <span>{isExpanded ? 'Hide' : 'Expand'}</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            {/* Expanded Medical Folders Content */}
                            {isExpanded && (
                              <div className="p-6 border-t border-slate-100 space-y-6 animate-slideDown">
                                
                                {/* Attending Doctor details */}
                                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-2">
                                  <span>Practitioner:</span>
                                  <span className="text-slate-700">{rec.doctor?.name || 'Dr. Attending Physician'} ({rec.doctor?.email})</span>
                                </div>

                                {/* Vitals Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">BP</span>
                                    <span className="text-xs font-bold text-slate-800">{rec.bloodPressure || <span className="text-slate-300 font-normal italic">not read</span>}</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Heart Rate</span>
                                    <span className="text-xs font-bold text-slate-800">{rec.heartRate ? `${rec.heartRate} bpm` : <span className="text-slate-300 font-normal italic">not read</span>}</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Temperature</span>
                                    <span className="text-xs font-bold text-slate-800">{rec.temperature ? `${rec.temperature} °C` : <span className="text-slate-300 font-normal italic">not read</span>}</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">O₂ Saturation</span>
                                    <span className="text-xs font-bold text-slate-800">{rec.oxygenSaturation ? `${rec.oxygenSaturation} %` : <span className="text-slate-300 font-normal italic">not read</span>}</span>
                                  </div>
                                  <div className="space-y-0.5 pt-2 border-t border-slate-100/60 sm:border-t-0">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Resp. Rate</span>
                                    <span className="text-xs font-bold text-slate-800">{rec.respiratoryRate ? `${rec.respiratoryRate} /min` : <span className="text-slate-300 font-normal italic">not read</span>}</span>
                                  </div>
                                  <div className="space-y-0.5 pt-2 border-t border-slate-100/60 sm:border-t-0">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Weight</span>
                                    <span className="text-xs font-bold text-slate-800">{rec.weight ? `${rec.weight} kg` : <span className="text-slate-300 font-normal italic">not read</span>}</span>
                                  </div>
                                  <div className="space-y-0.5 pt-2 border-t border-slate-100/60 sm:border-t-0">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Height</span>
                                    <span className="text-xs font-bold text-slate-800">{rec.height ? `${rec.height} cm` : <span className="text-slate-300 font-normal italic">not read</span>}</span>
                                  </div>
                                  <div className="space-y-0.5 pt-2 border-t border-slate-100/60 sm:border-t-0">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">BMI Index</span>
                                    <span className="text-xs font-bold text-slate-800">{rec.bmi || <span className="text-slate-300 font-normal italic">not read</span>}</span>
                                  </div>
                                </div>

                                {/* SOAP Clinical notes Display */}
                                <div className="space-y-3">
                                  <div className="flex items-center gap-1 pb-1 border-b border-slate-50">
                                    <ClipboardList className="w-4 h-4 text-slate-400" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clinical Notes (S.O.A.P)</span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
                                    {rec.soapSubjective && (
                                      <div className="p-3.5 border border-slate-100 rounded-xl space-y-1">
                                        <span className="text-[10px] font-bold text-teal-600 uppercase block">Subjective (S)</span>
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed white-space-pre">{rec.soapSubjective}</p>
                                      </div>
                                    )}
                                    {rec.soapObjective && (
                                      <div className="p-3.5 border border-slate-100 rounded-xl space-y-1">
                                        <span className="text-[10px] font-bold text-teal-600 uppercase block">Objective (O)</span>
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed white-space-pre">{rec.soapObjective}</p>
                                      </div>
                                    )}
                                    {rec.soapAssessment && (
                                      <div className="p-3.5 border border-slate-100 rounded-xl space-y-1">
                                        <span className="text-[10px] font-bold text-teal-600 uppercase block">Assessment (A)</span>
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed white-space-pre">{rec.soapAssessment}</p>
                                      </div>
                                    )}
                                    {rec.soapPlan && (
                                      <div className="p-3.5 border border-slate-100 rounded-xl space-y-1">
                                        <span className="text-[10px] font-bold text-teal-600 uppercase block">Plan (P)</span>
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed white-space-pre">{rec.soapPlan}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Active Rx Prescription Plan */}
                                {meds.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-1 pb-1 border-b border-slate-50">
                                      <Pill className="w-4 h-4 text-slate-400" />
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prescription Plan (Rx)</span>
                                    </div>

                                    <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs">
                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                                            <th className="p-2.5 pl-4">Medication</th>
                                            <th className="p-2.5">Dosage</th>
                                            <th className="p-2.5">Frequency</th>
                                            <th className="p-2.5">Duration</th>
                                            <th className="p-2.5">Special Instructions</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                                          {meds.map((m, mIdx) => (
                                            <tr key={mIdx}>
                                              <td className="p-2.5 pl-4 font-bold text-slate-800">{m.medication}</td>
                                              <td className="p-2.5">{m.dosage}</td>
                                              <td className="p-2.5">{m.frequency}</td>
                                              <td className="p-2.5">{m.duration}</td>
                                              <td className="p-2.5 text-slate-400">{m.instructions || '-'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Attachments & Scans display with mock download capability */}
                                {files.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-1 pb-1 border-b border-slate-50">
                                      <Paperclip className="w-4 h-4 text-slate-400" />
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clinical Artifacts & Uploads</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {files.map((file, fileIdx) => (
                                        <div key={fileIdx} className="p-3 bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-xl flex items-center justify-between text-xs transition-colors">
                                          <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                                            <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                                            <div className="overflow-hidden">
                                              <span className="font-semibold text-slate-700 block truncate">{file.name}</span>
                                              <span className="text-[10px] text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                          </div>
                                          {file.data && (
                                            <a
                                              href={file.data}
                                              download={file.name}
                                              className="h-7 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                              <FileDown className="w-3.5 h-3.5" />
                                              <span>Download</span>
                                            </a>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Follow up Instructions display */}
                                {(rec.followUpNotes || rec.followUpDate) && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-1 pb-1 border-b border-slate-50">
                                      <CalendarCheck2 className="w-4 h-4 text-slate-400" />
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Follow-up Instructions</span>
                                    </div>

                                    <div className="p-4 bg-teal-50/20 border border-teal-50/50 rounded-xl text-xs flex justify-between gap-4">
                                      <div>
                                        <p className="font-semibold text-slate-700">Clinical Advice:</p>
                                        <p className="text-slate-500 mt-1 leading-relaxed">{rec.followUpNotes || 'Return if symptoms aggravate or fail to clear.'}</p>
                                      </div>
                                      {rec.followUpDate && (
                                        <div className="text-right shrink-0">
                                          <p className="font-semibold text-slate-400 text-[10px] uppercase">Scheduled Date</p>
                                          <p className="text-teal-700 font-bold font-mono text-sm mt-0.5">{rec.followUpDate}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

            </>
          )}

        </div>

      </div>

    </div>
  );
}
