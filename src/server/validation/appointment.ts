import { z } from 'zod';

export const createAppointmentSchema = z.object({
  patientId: z.number().min(1, 'Patient ID must be a positive number'),
  doctorId: z.number().min(1, 'Doctor ID must be a positive number'),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine((val) => {
      const d = new Date(val);
      return !isNaN(d.getTime());
    }, { message: 'Invalid calendar date' }),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM 24-hour format'),
  reason: z.string().min(2, 'Reason must be at least 2 characters').max(500, 'Reason must not exceed 500 characters'),
  notes: z.string().max(2000, 'Notes must not exceed 2000 characters').optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).default('scheduled'),
});

export const updateAppointmentSchema = z.object({
  patientId: z.number().min(1, 'Patient ID must be a positive number').optional(),
  doctorId: z.number().min(1, 'Doctor ID must be a positive number').optional(),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine((val) => {
      const d = new Date(val);
      return !isNaN(d.getTime());
    }, { message: 'Invalid calendar date' })
    .optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  reason: z.string().min(2, 'Reason must be at least 2 characters').max(500, 'Reason must not exceed 500 characters').optional(),
  notes: z.string().max(2000, 'Notes must not exceed 2000 characters').optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
});

export const filterAppointmentQuerySchema = z.object({
  doctorId: z.preprocess((val) => (val ? parseInt(val as string, 10) : undefined), z.number().optional()),
  patientId: z.preprocess((val) => (val ? parseInt(val as string, 10) : undefined), z.number().optional()),
  date: z.string().optional(),
  status: z.string().optional(),
  search: z.string().max(100, 'Search query is too long').optional(),
  page: z.preprocess((val) => (val ? parseInt(val as string, 10) : 1), z.number().min(1).default(1)),
  limit: z.preprocess((val) => (val ? parseInt(val as string, 10) : 10), z.number().min(1).max(100).default(10)),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type FilterAppointmentQuery = z.infer<typeof filterAppointmentQuerySchema>;
