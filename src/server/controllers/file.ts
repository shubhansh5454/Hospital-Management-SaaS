import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { FileService } from '../services/file.ts';
import { RolesService } from '../services/roles.ts';
import { createFileSchema, updateFileSchema } from '../validation/file.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class FileController {
  /**
   * Fetch hierarchical or search listings of documents
   */
  public static async getFiles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;
      const search = req.query.search ? (req.query.search as string) : undefined;

      const files = await FileService.getFiles(req.user, parentId, search);
      res.json(files);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single document metadata and content data
   */
  public static async getFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new AppError('Invalid document ID format', 400);
      }

      const file = await FileService.checkAccess(id, req.user);
      res.json(file);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload a new document or create a directory folder
   */
  public static async createFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const validated = createFileSchema.parse(req.body);
      const file = await FileService.createFile(validated, req.user);

      // Record Audit Action
      try {
        await RolesService.logRequest(
          req,
          validated.isFolder ? 'CREATE_FOLDER' : 'UPLOAD_FILE',
          'patients',
          { id: file.id, name: file.name, isFolder: file.isFolder, patientId: file.patientId }
        );
      } catch (logErr) {
        console.error('Audit logging failed for file creation:', logErr);
      }

      res.status(201).json(file);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rename or move a document/folder
   */
  public static async updateFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new AppError('Invalid document ID format', 400);
      }
      const validated = updateFileSchema.parse(req.body);
      const file = await FileService.updateFile(id, validated, req.user);

      // Record Audit Action
      try {
        await RolesService.logRequest(
          req,
          'UPDATE_FILE_PROPERTIES',
          'patients',
          { id, name: file.name, parentId: file.parentId }
        );
      } catch (logErr) {
        console.error('Audit logging failed for file update:', logErr);
      }

      res.json(file);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a document or folder
   */
  public static async deleteFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new AppError('Invalid document ID format', 400);
      }

      const file = await FileService.checkAccess(id, req.user);
      await FileService.deleteFile(id, req.user);

      // Record Audit Action
      try {
        await RolesService.logRequest(
          req,
          file.isFolder ? 'DELETE_FOLDER' : 'DELETE_FILE',
          'patients',
          { id, name: file.name }
        );
      } catch (logErr) {
        console.error('Audit logging failed for file deletion:', logErr);
      }

      res.json({ success: true, message: 'Resource deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
