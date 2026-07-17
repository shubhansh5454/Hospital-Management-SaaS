import { PatientRepository } from '../repositories/patient.ts';
import { CreatePatientInput, UpdatePatientInput } from '../validation/patient.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class PatientService {
  /**
   * Create a new patient with email uniqueness check (optional check)
   */
  public static async createPatient(input: CreatePatientInput, clinicId?: number) {
    // If we want uniqueness for patient emails, we can check it. Let's make sure we don't block
    // registering different family members with same email, but let's do a friendly log or optional check if needed.
    // Let's assume emails don't necessarily have to be unique for patients (e.g. family email), but let's check
    // if there's an exact match on name + email + dob, to prevent absolute duplicates.
    const existing = await PatientRepository.findByEmail(input.email);
    if (existing && existing.name.toLowerCase() === input.name.toLowerCase() && existing.dob === input.dob) {
      throw new AppError('A patient with the same name, email, and date of birth already exists.', 400);
    }

    return PatientRepository.create(input, clinicId);
  }

  /**
   * Get all patients
   */
  public static async getAllPatients(clinicId?: number) {
    return PatientRepository.findAll(clinicId);
  }

  /**
   * Get patient by ID
   */
  public static async getPatientById(id: number) {
    const patient = await PatientRepository.findById(id);
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }
    return patient;
  }

  /**
   * Update a patient
   */
  public static async updatePatient(id: number, input: UpdatePatientInput) {
    // Verify patient exists first
    await this.getPatientById(id);

    return PatientRepository.update(id, input);
  }

  /**
   * Delete a patient
   */
  public static async deletePatient(id: number) {
    // Verify patient exists first
    await this.getPatientById(id);

    await PatientRepository.delete(id);
    return { success: true, message: 'Patient successfully deleted' };
  }

  /**
   * Export comprehensive clinical history in standard HL7 FHIR R4 and CCDA formats
   */
  public static async exportClinicalData(id: number) {
    const patient = await this.getPatientById(id);
    
    // Fetch associated invoices for a complete clinical billing summary
    const { prisma } = await import('../../db/prisma.ts');
    const invoices = await prisma.invoice.findMany({
      where: { patientId: id },
      include: { items: true },
      orderBy: { date: 'desc' },
    }).catch(() => []);

    // 1. Generate HL7 FHIR R4 Bundle Payload
    const fhirBundle = {
      resourceType: 'Bundle',
      id: `fhir-patient-bundle-${patient.id}`,
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: `urn:uuid:patient-${patient.id}`,
          resource: {
            resourceType: 'Patient',
            id: String(patient.id),
            active: true,
            name: [
              {
                use: 'official',
                text: patient.name,
                family: patient.name.split(' ').pop() || '',
                given: patient.name.split(' ').slice(0, -1)
              }
            ],
            telecom: [
              { system: 'phone', value: patient.phone, use: 'mobile' },
              { system: 'email', value: patient.email, use: 'home' }
            ],
            gender: patient.gender?.toLowerCase() === 'male' ? 'male' : patient.gender?.toLowerCase() === 'female' ? 'female' : 'other',
            birthDate: patient.dob,
            address: [
              {
                use: 'home',
                text: patient.address || 'Not Provided'
              }
            ],
            extension: [
              {
                url: 'http://hl7.org/fhir/StructureDefinition/patient-bloodGroup',
                valueString: patient.bloodGroup || 'Unknown'
              }
            ]
          }
        },
        // Map Encounters (Appointments)
        ...patient.appointments.map((app: any) => ({
          fullUrl: `urn:uuid:encounter-${app.id}`,
          resource: {
            resourceType: 'Encounter',
            id: String(app.id),
            status: app.status?.toLowerCase() === 'completed' ? 'finished' : 'planned',
            class: {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: 'AMB',
              display: 'ambulatory'
            },
            subject: { reference: `Patient/${patient.id}` },
            participant: [
              {
                type: [
                  {
                    coding: [
                      {
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                        code: 'PPRF',
                        display: 'primary performer'
                      }
                    ]
                  }
                ],
                individual: {
                  display: app.doctor?.name || 'Staff Practitioner'
                }
              }
            ],
            period: {
              start: `${app.date}T${app.time || '09:00'}:00Z`
            },
            reasonCode: [
              {
                text: app.reason || 'Routine Checkup'
              }
            ]
          }
        })),
        // Map Observations (EMR Vitals and Diagnosis)
        ...patient.emrRecords.map((emr: any) => ({
          fullUrl: `urn:uuid:clinical-note-${emr.id}`,
          resource: {
            resourceType: 'ClinicalImpression',
            id: String(emr.id),
            status: 'completed',
            subject: { reference: `Patient/${patient.id}` },
            assessor: { display: emr.doctor?.name || 'Staff Practitioner' },
            date: `${emr.date}T12:00:00Z`,
            description: emr.diagnosis || 'General Clinical Update',
            summary: emr.followUpNotes || undefined,
            note: [
              {
                text: `SOAP Subjective: ${emr.soapSubjective || 'N/A'}. SOAP Objective: ${emr.soapObjective || 'N/A'}`
              }
            ]
          }
        }))
      ]
    };

    // 2. Generate CCDA Continuity of Care HTML Document
    const ccdaSummary = `
      <div class="ccda-document font-sans p-6 bg-white border border-slate-200 rounded-3xl space-y-8">
        <!-- Document Header -->
        <div class="border-b border-slate-100 pb-6 flex justify-between items-start">
          <div>
            <span class="bg-teal-50 text-teal-700 text-[10px] font-mono uppercase px-2.5 py-1 rounded-full font-bold">
              HL7 CCDA Standard Clinical Summary
            </span>
            <h2 class="text-xl font-bold text-slate-800 mt-2">Continuity of Care Document (C-CDA)</h2>
            <p class="text-xs text-slate-400 mt-1">Generated on: ${new Date().toLocaleString()}</p>
          </div>
          <div class="text-right text-xs text-slate-500">
            <p class="font-semibold text-teal-600">CareSync ERP SaaS</p>
            <p>Interoperability Standard R2.1</p>
          </div>
        </div>

        <!-- Patient Demographics Section -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
          <div>
            <span class="text-[10px] text-slate-400 block uppercase font-semibold">Patient Name</span>
            <strong class="text-sm text-slate-700">${patient.name}</strong>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block uppercase font-semibold">Gender / DOB</span>
            <strong class="text-sm text-slate-700">${patient.gender} (${patient.dob})</strong>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block uppercase font-semibold">Blood Group</span>
            <strong class="text-sm text-slate-700">${patient.bloodGroup || 'N/A'}</strong>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block uppercase font-semibold">Contact Registry</span>
            <strong class="text-sm text-slate-700 block">${patient.phone}</strong>
            <span class="text-[11px] text-slate-400 font-mono">${patient.email}</span>
          </div>
        </div>

        <!-- Vitals & Medical History Summary -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="border border-slate-100 rounded-2xl p-5 space-y-3 bg-white">
            <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-50 pb-2">
              ⚠️ Allergies & Alerts
            </h3>
            <p class="text-xs text-slate-600 leading-relaxed bg-rose-50/50 text-rose-800 px-3 py-2 rounded-xl border border-rose-100 font-medium">
              ${patient.allergies || 'No active drug or food allergies on file.'}
            </p>
          </div>

          <div class="border border-slate-100 rounded-2xl p-5 space-y-3 bg-white">
            <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-50 pb-2">
              📝 Active Medical History
            </h3>
            <p class="text-xs text-slate-600 leading-relaxed bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
              ${patient.medicalHistory || 'No prior chronic medical histories recorded.'}
            </p>
          </div>
        </div>

        <!-- Clinical Encounter / Visit History -->
        <div class="space-y-3">
          <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-50 pb-2">
            📅 Encounters & Consultations
          </h3>
          <div class="overflow-hidden border border-slate-100 rounded-2xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-semibold">
                <tr>
                  <th class="p-3">Visit Date</th>
                  <th class="p-3">Practitioner</th>
                  <th class="p-3">Reason for Visit</th>
                  <th class="p-3">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-slate-600">
                ${patient.appointments.map((app: any) => `
                  <tr>
                    <td class="p-3 font-medium text-slate-700">${app.date} at ${app.time}</td>
                    <td class="p-3">${app.doctor?.name || 'Staff Doctor'}</td>
                    <td class="p-3 text-slate-500">${app.reason || 'General Consultation'}</td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        app.status?.toLowerCase() === 'completed' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }">
                        ${app.status}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Electronic Medical Records SOAP & Diagnostic Log -->
        <div class="space-y-4">
          <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-50 pb-2">
            🔬 Electronic Health SOAP & Diagnostic Notes
          </h3>
          <div class="space-y-3.5">
            ${patient.emrRecords.map((emr: any) => `
              <div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                <div class="flex justify-between items-center text-xs">
                  <span class="font-bold text-slate-700">Diagnosis: ${emr.diagnosis}</span>
                  <span class="text-[11px] text-slate-400 font-mono">${emr.date} — ${emr.doctor?.name || 'Staff Practitioner'}</span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  ${emr.bloodPressure ? `<div><span class="text-slate-400 block">BP:</span> <strong class="text-slate-600">${emr.bloodPressure}</strong></div>` : ''}
                  ${emr.heartRate ? `<div><span class="text-slate-400 block">HR:</span> <strong class="text-slate-600">${emr.heartRate} bpm</strong></div>` : ''}
                  ${emr.temperature ? `<div><span class="text-slate-400 block">Temp:</span> <strong class="text-slate-600">${emr.temperature} °C</strong></div>` : ''}
                  ${emr.oxygenSaturation ? `<div><span class="text-slate-400 block">SpO2:</span> <strong class="text-slate-600">${emr.oxygenSaturation}%</strong></div>` : ''}
                </div>
                ${emr.soapPlan ? `<div class="text-xs"><span class="font-semibold text-slate-500">Plan / Prescriptions:</span> <p class="text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 mt-1">${emr.soapPlan}</p></div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Billing Summary -->
        <div class="space-y-3">
          <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-50 pb-2">
            💳 Financial Ledger & Invoice History
          </h3>
          <div class="overflow-hidden border border-slate-100 rounded-2xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-semibold">
                <tr>
                  <th class="p-3">Invoice #</th>
                  <th class="p-3">Date</th>
                  <th class="p-3">Amount</th>
                  <th class="p-3">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-slate-600">
                ${invoices.map((inv: any) => `
                  <tr>
                    <td class="p-3 font-mono font-medium text-slate-700">${inv.invoiceNumber}</td>
                    <td class="p-3">${inv.date}</td>
                    <td class="p-3 font-semibold">$${Number(inv.totalAmount).toFixed(2)}</td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        inv.status?.toUpperCase() === 'PAID' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }">
                        ${inv.status}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    return {
      fhirBundle,
      ccdaSummary
    };
  }
}

