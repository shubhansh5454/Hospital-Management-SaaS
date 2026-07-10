import { z } from 'zod';

export const createEmrRecordSchema = z.object({
  patientId: z.number().int("Patient ID must be an integer"),
  appointmentId: z.number().int("Appointment ID must be an integer").nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  
  // Vitals
  bloodPressure: z.string().nullable().optional(),
  heartRate: z.number().int().nonnegative().nullable().optional(),
  temperature: z.string().nullable().optional(),
  respiratoryRate: z.number().int().nonnegative().nullable().optional(),
  weight: z.string().nullable().optional(),
  height: z.string().nullable().optional(),
  bmi: z.string().nullable().optional(),
  oxygenSaturation: z.number().int().min(0).max(100).nullable().optional(),

  // Diagnosis
  diagnosis: z.string().min(1, "Diagnosis is required"),

  // SOAP Notes
  soapSubjective: z.string().nullable().optional(),
  soapObjective: z.string().nullable().optional(),
  soapAssessment: z.string().nullable().optional(),
  soapPlan: z.string().nullable().optional(),

  // Prescriptions (expecting JSON string or empty)
  prescriptions: z.string().nullable().optional(),

  // Follow up
  followUpNotes: z.string().nullable().optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Follow-up date must be in YYYY-MM-DD format").nullable().optional().or(z.literal('')),

  // Attachments (expecting JSON string or empty)
  attachments: z.string().nullable().optional(),
});

export const updateEmrRecordSchema = createEmrRecordSchema.partial().omit({
  patientId: true,
});

export type CreateEmrRecordInput = z.infer<typeof createEmrRecordSchema>;
export type UpdateEmrRecordInput = z.infer<typeof updateEmrRecordSchema>;
