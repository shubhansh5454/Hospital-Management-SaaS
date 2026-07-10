import { z } from 'zod';

export const scheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6, "Day of week must be between 0 (Sunday) and 6 (Saturday)"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be in HH:MM format"),
});

export const leaveSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format"),
  reason: z.string().optional().nullable(),
});

export const createDoctorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  specialization: z.string().min(2, "Specialization must be at least 2 characters"),
  biography: z.string().optional().nullable(),
  experienceYrs: z.number().nonnegative().optional().default(0),
  schedules: z.array(scheduleSchema).optional(),
});

export const updateDoctorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  specialization: z.string().min(2, "Specialization must be at least 2 characters").optional(),
  biography: z.string().optional().nullable(),
  experienceYrs: z.number().nonnegative().optional(),
  schedules: z.array(scheduleSchema).optional(),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type LeaveInput = z.infer<typeof leaveSchema>;
