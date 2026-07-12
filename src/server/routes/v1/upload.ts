import { Router, Response } from 'express';
import { requireAuth } from '../../../middleware/auth.ts';
import { prisma } from '../../../db/prisma.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { writeRateLimiter } from '../../middleware/rateLimiter.ts';
import { RolesService } from '../../services/roles.ts';
import { z } from 'zod';

const router = Router();

router.use(requireAuth);

const mobileUploadSchema = z.object({
  name: z.string()
    .min(1, 'File name is required')
    .max(255, 'File name is too long')
    .refine((val) => !val.includes('/') && !val.includes('\\'), 'File name must not contain path characters'),
  fileType: z.enum(['image', 'pdf', 'lab_report', 'prescription', 'patient_doc', 'insurance_doc']).default('image'),
  mimeType: z.string().refine((val) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    return allowed.includes(val);
  }, 'Unsupported file format. Only JPEG, PNG, WEBP, GIF, and PDF are allowed.'),
  // Base64 payload validation
  content: z.string().min(10, 'Content must be a valid non-empty Base64 string'),
  patientId: z.number().nullable().optional(),
});

/**
 * @route POST /api/v1/upload
 * @desc Upload images or document attachments using Base64 payloads (optimized for mobile clients)
 * @access Private
 */
router.post('/', writeRateLimiter, async (req: any, res: Response, next) => {
  try {
    const parsed = mobileUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { name, fileType, mimeType, content, patientId } = parsed.data;
    const clinicId = req.user?.clinicId;
    const userId = req.user?.id;

    // Estimate file size from Base64 string length: ~3/4 of string length in bytes
    const estimatedSizeBytes = Math.ceil((content.length * 3) / 4);
    const maxLimitBytes = 5 * 1024 * 1024; // 5 MB

    if (estimatedSizeBytes > maxLimitBytes) {
      throw new AppError('File size exceeds the 5MB maximum allowed limit.', 400);
    }

    // Verify patient profile if patientId is provided
    if (patientId) {
      const patientExists = await prisma.patient.findUnique({
        where: { id: patientId },
      });
      if (!patientExists) {
        throw new AppError('The specified patient profile was not found', 404);
      }
    }

    // Save to the ClinicFile table
    const uploadedFile = await prisma.clinicFile.create({
      data: {
        name,
        isFolder: false,
        fileType,
        mimeType,
        size: estimatedSizeBytes,
        content, // Store Base64 string directly in the Text field
        patientId: patientId || null,
        clinicId: clinicId || null,
        uploadedById: userId,
        accessRoles: 'admin,doctor,reception,patient',
      },
    });

    // Record in Audit Logs
    try {
      await RolesService.logRequest(req, 'UPLOAD_FILE', 'patients', {
        id: uploadedFile.id,
        name: uploadedFile.name,
        size: estimatedSizeBytes,
        patientId,
      });
    } catch (logErr) {
      console.error('Audit log failed for file upload:', logErr);
    }

    // Create a download/render stream URL for the mobile app
    const downloadUrl = `/api/v1/files/${uploadedFile.id}/content`;

    res.status(201).json({
      status: 'success',
      data: {
        id: uploadedFile.id,
        name: uploadedFile.name,
        fileType: uploadedFile.fileType,
        mimeType: uploadedFile.mimeType,
        size: uploadedFile.size,
        patientId: uploadedFile.patientId,
        uploadedById: uploadedFile.uploadedById,
        createdAt: uploadedFile.createdAt,
        downloadUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/files/:id/content
 * @desc Get raw binary content stream of file for image rendering / file downloading
 * @access Private
 */
router.get('/files/:id/content', async (req: any, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid file ID format', 400);
    }

    const file = await prisma.clinicFile.findUnique({
      where: { id },
    });

    if (!file) {
      throw new AppError('File not found', 404);
    }

    if (!file.content) {
      throw new AppError('File has no content payload available', 404);
    }

    // Strip base64 metadata headers if they exist
    let base64Data = file.content;
    if (base64Data.includes(';base64,')) {
      base64Data = base64Data.split(';base64,')[1];
    }

    const buffer = Buffer.from(base64Data, 'base64');

    res.writeHead(200, {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Length': buffer.length,
      'Content-Disposition': `inline; filename="${file.name}"`,
    });

    res.end(buffer);
  } catch (error) {
    next(error);
  }
});

export const v1UploadRouter = router;
