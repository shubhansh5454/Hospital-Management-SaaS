import { z } from 'zod';

export const createAppointmentSchema = z.object({
  patientId: z.number().min(1, 'Patient ID is required'),
  doctorId: z.number().min(1, 'Doctor ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM 24-hour format'),
  reason: z.string().min(2, 'Reason must be at least 2 characters'),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).default('scheduled'),
});

export const updateAppointmentSchema = z.object({
  patientId: z.number().optional(),
  doctorId: z.number().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  reason: z.string().min(2, 'Reason must be at least 2 characters').optional(),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
});

export const filterAppointmentQuerySchema = z.object({
  doctorId: z.preprocess((val) => (val ? parseInt(val as string, 10) : undefined), z.number().optional()),
  patientId: z.preprocess((val) => (val ? parseInt(val as string, 10) : undefined), z.number().optional()),
  date: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.preprocess((val) => (val ? parseInt(val as string, 10) : 1), z.number().min(1).default(1)),
  limit: z.preprocess((val) => (val ? parseInt(val as string, 10) : 10), z.number().min(1).default(10)),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type FilterAppointmentQuery = z.infer<typeof filterAppointmentQuerySchema>;
