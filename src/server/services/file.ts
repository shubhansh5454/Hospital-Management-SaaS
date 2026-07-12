import { FileRepository } from '../repositories/file.ts';
import { CreateFileInput, UpdateFileInput } from '../validation/file.ts';
import { prisma } from '../../db/prisma.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class FileService {
  /**
   * Helper to verify if the current user has authorized access to a file/folder
   */
  public static async checkAccess(fileId: number, user: { id: number; email: string; role: string; clinicId?: number | null }) {
    const file = await FileRepository.findById(fileId);
    if (!file) {
      throw new AppError('File not found', 404);
    }

    // Tenant boundary check
    if (user.clinicId && file.clinicId && file.clinicId !== user.clinicId) {
      throw new AppError('Unauthorized: access to this document from a different clinic is forbidden', 403);
    }

    // If user is Admin or Owner, they bypass standard access role restrictions
    if (user.role === 'admin' || user.role === 'owner') {
      return file;
    }

    // Parse permitted access roles
    const allowedRoles = file.accessRoles ? file.accessRoles.split(',') : [];

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(user.role)) {
      throw new AppError(`Access Denied: your role (${user.role}) is not authorized to view this document`, 403);
    }

    // Extra strict verification for patients: they can only view files belonging to their patient profile
    if (user.role === 'patient') {
      const patient = await prisma.patient.findFirst({
        where: { email: { equals: user.email, mode: 'insensitive' } }
      });
      if (!patient || file.patientId !== patient.id) {
        throw new AppError('Access Denied: you can only access documents linked directly to your patient profile', 403);
      }
    }

    return file;
  }

  /**
   * Create a new file or folder with security and format validation
   */
  public static async createFile(input: CreateFileInput, user: { id: number; email: string; role: string; clinicId?: number | null }) {
    // 1. File Validation
    if (!input.isFolder) {
      // Limit file size to 15MB (~20M characters of Base64) to protect performance
      if (input.content && input.content.length > 20000000) {
        throw new AppError('File size is too large. Maximum allowed size is 15MB.', 400);
      }

      // Check for valid file types
      const allowedTypes = ['image', 'pdf', 'lab_report', 'prescription', 'patient_doc', 'insurance_doc'];
      if (!allowedTypes.includes(input.fileType || '')) {
        throw new AppError(`Unsupported file category: ${input.fileType}`, 400);
      }

      // Consistency check for MIME types
      if (input.mimeType) {
        const lowerMime = input.mimeType.toLowerCase();
        if (input.fileType === 'pdf' && lowerMime !== 'application/pdf') {
          throw new AppError('MIME type must be application/pdf for PDF document uploads', 400);
        }
        if (input.fileType === 'image' && !lowerMime.startsWith('image/')) {
          throw new AppError('MIME type must start with image/ for Image uploads', 400);
        }
      }
    }

    // 2. Folder Hierarchy validation
    if (input.parentId) {
      const parent = await FileRepository.findById(input.parentId);
      if (!parent) {
        throw new AppError('Target parent folder does not exist', 404);
      }
      if (!parent.isFolder) {
        throw new AppError('Target parent is a file, not a directory folder', 400);
      }
    }

    // 3. Link Patient checks
    if (input.patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: input.patientId }
      });
      if (!patient) {
        throw new AppError('Associated Patient profile not found', 404);
      }
    }

    // 4. Save to Database
    return FileRepository.create({
      ...input,
      clinicId: user.clinicId,
      uploadedById: user.id,
    });
  }

  /**
   * Get clinic file listings filtered by path and secure access roles
   */
  public static async getFiles(
    user: { id: number; email: string; role: string; clinicId?: number | null },
    parentId: number | null = null,
    search?: string
  ) {
    if (!user.clinicId) {
      throw new AppError('No clinic session active for your account', 400);
    }

    const files = await FileRepository.findAll(user.clinicId, parentId, search);

    // Patients can only see patient-allowed documents belonging specifically to them
    if (user.role === 'patient') {
      const patient = await prisma.patient.findFirst({
        where: { email: { equals: user.email, mode: 'insensitive' } }
      });
      if (!patient) {
        return []; // No patient profile matches user email
      }

      return files.filter(f => {
        const allowedRoles = f.accessRoles ? f.accessRoles.split(',') : [];
        return f.patientId === patient.id && allowedRoles.includes('patient');
      });
    }

    // Doctors, receptionists and other clinical staff can see files configured for their roles
    return files.filter(f => {
      const allowedRoles = f.accessRoles ? f.accessRoles.split(',') : [];
      return (
        user.role === 'admin' ||
        user.role === 'owner' ||
        allowedRoles.includes(user.role)
      );
    });
  }

  /**
   * Rename or move a file/folder
   */
  public static async updateFile(
    id: number,
    input: UpdateFileInput,
    user: { id: number; email: string; role: string; clinicId?: number | null }
  ) {
    // Authorize first
    await this.checkAccess(id, user);

    // Movement checks
    if (input.parentId) {
      if (input.parentId === id) {
        throw new AppError('A folder cannot be moved into itself', 400);
      }
      const parent = await FileRepository.findById(input.parentId);
      if (!parent) {
        throw new AppError('Target folder not found', 404);
      }
      if (!parent.isFolder) {
        throw new AppError('Target is not a folder directory', 400);
      }
    }

    return prisma.clinicFile.update({
      where: { id },
      data: {
        name: input.name,
        parentId: input.parentId !== undefined ? input.parentId : undefined,
        accessRoles: input.accessRoles || undefined,
      },
    });
  }

  /**
   * Delete a file or folder cleanly
   */
  public static async deleteFile(
    id: number,
    user: { id: number; email: string; role: string; clinicId?: number | null }
  ) {
    // Authorize first
    await this.checkAccess(id, user);

    return FileRepository.delete(id);
  }
}
