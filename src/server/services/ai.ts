import { GoogleGenAI } from '@google/genai';
import { AppError } from '../middleware/errorHandler.ts';
import { PatientRepository } from '../repositories/patient.ts';
import { AppointmentRepository } from '../repositories/appointment.ts';
import { DoctorRepository } from '../repositories/doctor.ts';
import { EmrRepository } from '../repositories/emr.ts';

export interface AIServiceConfig {
  model?: string;
  temperature?: number;
  systemInstruction?: string;
}

export class AIService {
  private static getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError(
        'Gemini API key is missing. Please configure GEMINI_API_KEY in the Secrets panel in the AI Studio Settings.',
        503
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  /**
   * Reusable core generation method with configurable parameters
   */
  public static async generate(prompt: string, config: AIServiceConfig = {}): Promise<string> {
    try {
      const ai = this.getClient();
      const modelName = config.model || 'gemini-3.5-flash';
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: config.temperature !== undefined ? config.temperature : 0.2,
          systemInstruction: config.systemInstruction,
        },
      });

      if (!response.text) {
        throw new AppError('AI failed to return any text response.', 500);
      }

      return response.text;
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Gemini AI service error: ${error.message || error}`, 500);
    }
  }

  /**
   * 1. AI Appointment Assistant
   * Triage symptoms or suggest schedule options based on request context
   */
  public static async appointmentAssistant(
    symptomsAndPreferences: string,
    doctorListContext: any[],
    options: AIServiceConfig = {}
  ): Promise<string> {
    const prompt = `
You are an AI Clinical Scheduler and Triage Assistant.
Below is the list of available doctors and their specializations in our clinic:
${JSON.stringify(doctorListContext, null, 2)}

Patient's Symptoms & Scheduling Preferences:
"${symptomsAndPreferences}"

Please perform the following tasks:
1. **Urgency Triage**: Assess the symptoms and determine if this is an Emergency (suggest ER/urgent care immediately), Urgent (next 24 hours), or Routine.
2. **Doctor Recommendation**: Recommend 1 or 2 specific doctors from the list above who best match the symptoms/needs, stating the clear clinical reasoning.
3. **Draft Booking Reason**: Provide a concise, professional clinical "Reason for Visit" that the receptionist can copy-paste into the system.

Format your response in a beautiful, structured Markdown format. Be direct, clear, and professional.
`;

    const systemInstruction = 'You are a professional, helpful, and highly precise Medical Clinic Receptionist and Triage Assistant.';
    return this.generate(prompt, { systemInstruction, ...options });
  }

  /**
   * 2. AI Prescription Suggestions
   * Suggest medicines, dosages, and safety guidelines for doctor review
   */
  public static async prescriptionSuggestions(
    diagnosisAndSymptoms: string,
    allergiesAndHistory: string,
    options: AIServiceConfig = {}
  ): Promise<string> {
    const prompt = `
You are a Clinical Pharmacologist Assistant helping a licensed doctor.
Patient Diagnosis / Chief Symptoms:
"${diagnosisAndSymptoms}"

Patient's Documented Allergies & Medical History:
"${allergiesAndHistory}"

Please generate complete prescription drafts/suggestions for the physician to review:
1. **Recommended Medications**: Suggest appropriate medications (generic & brand name if helpful), specific oral or topical dosages, frequency, and standard duration.
2. **Clinical Rationale**: Why are these drugs appropriate for this diagnosis/symptoms?
3. **Safety & Interaction Warnings**: Highlight any potential risks, contraindications, or interactions given the patient's allergies/history.
4. **Patient Education**: Critical instructions for the patient (e.g., "take with food", "avoid alcohol").

IMPORTANT: Add a highly visible medical disclaimer at the top stating: "DRAFT ONLY - FOR LICENSED CLINICIAN REVIEW AND AUTHORIZATION."
`;

    const systemInstruction = 'You are an advanced, safety-first Clinical Pharmacologist AI designed to aid licensed clinicians.';
    return this.generate(prompt, { systemInstruction, ...options });
  }

  /**
   * 3. AI Medical Summary
   * Summarizes current case/notes/EMR data
   */
  public static async medicalSummary(
    emrRecordData: string,
    options: AIServiceConfig = {}
  ): Promise<string> {
    const prompt = `
You are a Medical Scribe AI.
Please generate a comprehensive but high-density Medical Case Summary from this raw EMR/Consultation record:

Raw Record Data:
"${emrRecordData}"

Please synthesize this into:
1. **Clinical Snapshot**: 2-3 sentence overview of the current clinical encounter.
2. **Subjective & Objective Findings**: Clear summary of symptoms, vital signs, and examinations.
3. **Assessment & Plan**: The active diagnoses and proposed management/treatment steps.
4. **Key Action Items**: Bulleted list of immediate next steps for the clinical team.

Keep it highly clinical, professional, and succinct. Do not include unnecessary conversational filler.
`;

    const systemInstruction = 'You are an elite Clinical Medical Scribe specializing in distilling medical data into precise summaries.';
    return this.generate(prompt, { systemInstruction, ...options });
  }

  /**
   * 4. AI Patient History Summary
   * Synthesizes patient timeline (all past appointments, EMRs, etc.)
   */
  public static async patientHistorySummary(
    patientId: number,
    options: AIServiceConfig = {}
  ): Promise<string> {
    // Fetch full patient data including appointments and EMR records
    const patient = await PatientRepository.findById(patientId);
    if (!patient) {
      throw new AppError('Patient profile not found to generate history summary.', 404);
    }

    const pastAppointments = patient.appointments || [];
    const pastEmrRecords = patient.emrRecords || [];

    const historyPrompt = `
You are an expert Clinical Case Reviewer.
Please review the complete clinical history of patient "${patient.name}" and compile a professional Patient History Synthesis.

Patient Demographics & Profile:
- Name: ${patient.name}
- Gender: ${patient.gender}
- Age/DOB: ${patient.dob}
- Allergies: ${patient.allergies || 'None documented'}
- Medical History: ${patient.medicalHistory || 'None documented'}

Past EMR records (Vitals, Diagnoses, Prescriptions, Plans):
${JSON.stringify(pastEmrRecords, null, 2)}

Past Scheduled Visits/Appointments:
${JSON.stringify(pastAppointments, null, 2)}

Please deliver a beautifully organized Clinical Timeline Synthesis containing:
1. **Executive Clinical Summary**: A 1-paragraph high-level overview of the patient's ongoing health profile, chronic conditions, or recurring complaints.
2. **Chronological Medical Timeline**: Highlight major past visits, diagnoses made, and medications prescribed in reverse chronological order.
3. **Clinical Trends & Warnings**: Identify any patterns (e.g., rising blood pressure, frequent respiratory issues, medication compliance observations).
4. **Allergy & Safety Alerts**: Explicitly reiterate active contraindications or critical allergy risks.

Ensure the output is written in standard, highly polished medical terminology suitable for a consulting physician.
`;

    const systemInstruction = 'You are a veteran Chief Medical Officer and Clinical Reviewer AI.';
    return this.generate(historyPrompt, { systemInstruction, ...options });
  }

  /**
   * 5. AI Follow-up Suggestions
   * Recommends follow-up timelines, who to see, and symptoms/vitals to track
   */
  public static async followUpSuggestions(
    currentCondition: string,
    vitalsAndMeds: string,
    options: AIServiceConfig = {}
  ): Promise<string> {
    const prompt = `
You are a Clinical Care Continuity Specialist AI.
Current Patient Condition & active diagnoses:
"${currentCondition}"

Vitals signs recorded & active prescriptions/treatments:
"${vitalsAndMeds}"

Please generate complete Clinical Follow-Up Guidelines:
1. **Follow-Up Timeline**: Recommend an optimal follow-up interval (e.g., 1 week, 1 month, 6 months) with clinical justification.
2. **Provider Recommendation**: Who should they see? (e.g., GP, Cardiologist, Endocrinologist)
3. **Critical Home Parameters to Track**: What should the patient or home care team monitor? (e.g., daily blood pressure, blood glucose, peak flow, weight)
4. **Red Flags / Warning Signs**: Clear list of symptoms or vitals deviations that should prompt immediate emergency contact.

Organize this clearly with Markdown. Highlight patient instructions vs clinical staff tasks.
`;

    const systemInstruction = 'You are an AI Clinical Care Coordinator and Patient Safety Advocate.';
    return this.generate(prompt, { systemInstruction, ...options });
  }

  /**
   * 6. AI Clinical Notes Assistant
   * Formats messy bullet points or audio-scribe transcripts into clear SOAP format notes
   */
  public static async clinicalNotesAssistant(
    messyNotes: string,
    options: AIServiceConfig = {}
  ): Promise<string> {
    const prompt = `
You are an expert Clinical Documentation Specialist.
Your task is to take the following raw, messy consultation notes, shorthand, or dictation transcripts, and expand them into a beautifully structured, comprehensive, and highly professional clinical **SOAP Note** (Subjective, Objective, Assessment, Plan).

Raw Clinical Input:
"${messyNotes}"

Please structure the expanded output exactly as follows:
- **S (Subjective)**: Chief complaint, history of present illness, symptoms reported by patient, compliance, review of systems.
- **O (Objective)**: Physical exam findings, documented vitals, general appearance, diagnostic tests, lab results (if mentioned in raw input).
- **A (Assessment)**: Diagnosis, differential diagnosis, clinical reasoning, status of active conditions.
- **P (Plan)**: Pharmacologic therapy (dosages, schedule), non-pharmacologic treatment, referrals, diagnostic testing, patient education, follow-up timeline.

IMPORTANT: Use standard medical abbreviations and highly professional, formal clinical vocabulary. Do not invent details not supported or implied by the raw notes, but do format and organize them elegantly.
`;

    const systemInstruction = 'You are a precise, certified Clinical Scribe AI expert in SOAP Note documentation.';
    return this.generate(prompt, { systemInstruction, ...options });
  }
}
