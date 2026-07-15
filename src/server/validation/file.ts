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
}).refine(data => {
  if (data.isFolder) {
    return true;
  }
  
  // File size validation: limit to 10MB (10,485,760 bytes)
  if (data.size && data.size > 10 * 1024 * 1024) {
    return false;
  }

  // Check file extension safety
  const parts = data.name.split('.');
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
  const dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'bash', 'js', 'mjs', 'ts', 'py', 'php', 'pl', 'rb', 'vbs', 'scr', 'msi', 'dll', 'html', 'htm', 'jar'];
  if (ext && dangerousExtensions.includes(ext)) {
    return false;
  }

  // Check MIME Type safety if specified
  if (data.mimeType) {
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf',
      'text/plain', 'text/csv', 'text/markdown',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-zip-compressed'
    ];
    if (!allowedMimeTypes.includes(data.mimeType)) {
      return false;
    }
  }

  return true;
}, {
  message: "Invalid file: File size must not exceed 10MB and dangerous executable extensions are strictly prohibited.",
  path: ["name"]
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
