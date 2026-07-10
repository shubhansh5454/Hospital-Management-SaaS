import { z } from 'zod';

export const createLabTestSchema = z.object({
  name: z.string().min(1, 'Lab test name is required'),
  code: z.string().min(1, 'Lab test code is required'),
  category: z.string().min(1, 'Category is required'),
  price: z.number().nonnegative('Price cannot be negative'),
  sampleType: z.string().min(1, 'Sample type is required'),
  turnaroundTime: z.string().min(1, 'Turnaround time is required'),
  description: z.string().nullable().optional(),
});

export const updateLabTestSchema = z.object({
  name: z.string().min(1, 'Lab test name cannot be empty').optional(),
  code: z.string().min(1, 'Lab test code cannot be empty').optional(),
  category: z.string().min(1, 'Category cannot be empty').optional(),
  price: z.number().nonnegative('Price cannot be negative').optional(),
  sampleType: z.string().min(1, 'Sample type cannot be empty').optional(),
  turnaroundTime: z.string().min(1, 'Turnaround time cannot be empty').optional(),
  description: z.string().nullable().optional(),
});

export const bookLabTestSchema = z.object({
  patientId: z.number().int().positive('Patient ID is required'),
  testId: z.number().int().positive('Test ID is required'),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Booking date must be YYYY-MM-DD'),
});

export const collectSampleSchema = z.object({
  barcode: z.string().min(1, 'Sample barcode/tracking-ID is required'),
  collector: z.string().min(1, 'Collector name is required'),
  collectedAt: z.string().datetime({ message: 'collectedAt must be a valid ISO Date string' }).optional().default(() => new Date().toISOString()),
});

export const recordResultSchema = z.object({
  resultValue: z.string().min(1, 'Result value is required'),
  normalRange: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  reportAttachmentUrl: z.string().url('Attachment must be a valid URL link').nullable().optional().or(z.string().length(0)),
  validatedBy: z.string().min(1, 'Approver/Validator name is required'),
});
