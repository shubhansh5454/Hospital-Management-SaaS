import { z } from 'zod';

export const createFileSchema = z.object({
  name: z.string()
    .min(1, "File or folder name is required")
    .max(255, "Name cannot exceed 255 characters")
    .refine(val => !val.includes('/') && !val.includes('\\'), "Name cannot contain path separators"),
  isFolder: z.boolean().default(false),
  parentId: z.number().nullable().optional(),
  fileType: z.enum(['image', 'pdf', 'lab_report', 'prescription', 'patient_doc', 'insurance_doc', 'folder']),
  mimeType: z.string().nullable().optional(),
  size: z.number().nullable().optional(),
  content: z.string().nullable().optional(), // Holds the Base64-encoded string
  patientId: z.number().nullable().optional(),
  accessRoles: z.string().nullable().optional().default('admin,doctor,reception,patient'),
});

export const updateFileSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(255, "Name cannot exceed 255 characters")
    .refine(val => !val.includes('/') && !val.includes('\\'), "Name cannot contain path separators")
    .optional(),
  parentId: z.number().nullable().optional(),
  accessRoles: z.string().nullable().optional(),
});

export type CreateFileInput = z.infer<typeof createFileSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
