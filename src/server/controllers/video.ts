import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.ts';
import { VideoService } from '../services/video.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class VideoController {
  /**
   * Get or initialize session
   * GET /api/video/session/:appointmentId
   */
  public static async getSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        throw new AppError('Invalid appointment ID format', 400);
      }

      const session = await VideoService.getSession(appointmentId, req.user.id, req.user.role);
      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Join room as participant
   * POST /api/video/session/:appointmentId/join
   */
  public static async joinSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        throw new AppError('Invalid appointment ID format', 400);
      }

      const session = await VideoService.joinSession(appointmentId, {
        id: req.user.id,
        name: req.user.name || 'Anonymous',
        role: req.user.role
      });
      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Doctor admits the patient from the waiting room
   * POST /api/video/session/:appointmentId/admit
   */
  public static async admitPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        throw new AppError('Unauthorized: only doctors or administrators can admit patients', 403);
      }

      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        throw new AppError('Invalid appointment ID format', 400);
      }

      const session = await VideoService.admitPatient(appointmentId);
      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send a chat message
   * POST /api/video/session/:appointmentId/chat
   */
  public static async sendChatMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const appointmentId = parseInt(req.params.appointmentId);
      const { message } = req.body;
      if (isNaN(appointmentId)) {
        throw new AppError('Invalid appointment ID format', 400);
      }
      if (!message || !message.trim()) {
        throw new AppError('Message text is required', 400);
      }

      const session = await VideoService.sendChatMessage(
        appointmentId,
        {
          id: req.user.id,
          name: req.user.name || 'Anonymous',
          role: req.user.role
        },
        message
      );
      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Share file attachment
   * POST /api/video/session/:appointmentId/file
   */
  public static async shareFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const appointmentId = parseInt(req.params.appointmentId);
      const { name, size, type, url } = req.body;
      if (isNaN(appointmentId)) {
        throw new AppError('Invalid appointment ID format', 400);
      }
      if (!name || !url) {
        throw new AppError('File name and url are required', 400);
      }

      const session = await VideoService.shareFile(appointmentId, req.user.name || 'Anonymous', {
        name,
        size: size || '0 KB',
        type: type || 'application/octet-stream',
        url
      });
      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Save live consultation notes
   * POST /api/video/session/:appointmentId/notes
   */
  public static async updateNotes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        throw new AppError('Unauthorized: only doctors or administrators can draft notes', 403);
      }

      const appointmentId = parseInt(req.params.appointmentId);
      const { notes } = req.body;
      if (isNaN(appointmentId)) {
        throw new AppError('Invalid appointment ID format', 400);
      }

      const session = await VideoService.updateNotes(appointmentId, notes || '');
      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Format notes with Gemini AI assistant
   * POST /api/video/session/:appointmentId/notes/ai-assist
   */
  public static async aiEnhanceNotes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        throw new AppError('Unauthorized', 403);
      }

      const appointmentId = parseInt(req.params.appointmentId);
      const { rawNotes } = req.body;
      if (isNaN(appointmentId)) {
        throw new AppError('Invalid appointment ID format', 400);
      }

      const enhancedText = await VideoService.aiEnhanceNotes(appointmentId, rawNotes || '');
      res.json({ success: true, text: enhancedText });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Start recording session
   * POST /api/video/session/:appointmentId/record/start
   */
  public static async startRecording(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        throw new AppError('Unauthorized: only clinicians can control recording', 403);
      }

      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        throw new AppError('Invalid appointment ID format', 400);
      }

      const session = await VideoService.startRecording(appointmentId);
      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Stop recording and compile metadata
   * POST /api/video/session/:appointmentId/record/stop
   */
  public static async stopRecording(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        throw new AppError('Unauthorized: only clinicians can control recording', 403);
      }

      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        throw new AppError('Invalid appointment ID format', 400);
      }

      const session = await VideoService.stopRecording(appointmentId);
      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch all recordings
   * GET /api/video/recordings
   */
  public static async getAllRecordings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const recordings = VideoService.getAllRecordings();
      res.json(recordings);
    } catch (error) {
      next(error);
    }
  }
}
