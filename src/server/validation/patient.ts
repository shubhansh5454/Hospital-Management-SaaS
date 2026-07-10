import { z } from 'zod';

export const createPatientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(6, "Phone must be at least 6 characters"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
  gender: z.string().min(1, "Gender is required"),
  bloodGroup: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  medicalHistory: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
});

export const updatePatientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().min(6, "Phone must be at least 6 characters").optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format").optional(),
  gender: z.string().min(1, "Gender is required").optional(),
  bloodGroup: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  medicalHistory: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
