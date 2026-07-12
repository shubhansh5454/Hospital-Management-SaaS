import fs from 'fs';
import path from 'path';
import { prisma } from '../../db/prisma.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { AIService } from './ai.ts';

export interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  senderRole: string;
  message: string;
  timestamp: string;
}

export interface SharedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
  senderName: string;
  timestamp: string;
}

export interface RecordingMetadata {
  id: string;
  appointmentId: number;
  patientName: string;
  doctorName: string;
  duration: string; // e.g. "12:34"
  fileSize: string; // e.g. "45.2 MB"
  date: string;
  videoUrl: string;
  status: 'recording' | 'completed';
}

export interface VideoSession {
  appointmentId: number;
  roomId: string;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  date: string;
  time: string;
  status: 'waiting' | 'active' | 'completed';
  joinedParticipants: { userId: number; role: string; name: string; joinedAt: string }[];
  chatHistory: ChatMessage[];
  sharedFiles: SharedFile[];
  consultationNotes: string;
  isRecording: boolean;
  recordingStartTime?: string;
  recordings: RecordingMetadata[];
  estimatedWaitMinutes: number;
  queueNumber: number;
}

const DATA_FILE = path.join(process.cwd(), 'src', 'server', 'data', 'video_sessions.json');

export class VideoService {
  private static initFile() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf-8');
    }
  }

  private static readAllSessions(): Record<number, VideoSession> {
    this.initFile();
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading video sessions file:', error);
      return {};
    }
  }

  private static writeAllSessions(sessions: Record<number, VideoSession>) {
    this.initFile();
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing video sessions file:', error);
    }
  }

  /**
   * Fetch or create a video session for an appointment
   */
  public static async getSession(appointmentId: number, currentUserId: number, currentUserRole: string): Promise<VideoSession> {
    const sessions = this.readAllSessions();
    
    // If session already exists, return it
    if (sessions[appointmentId]) {
      return sessions[appointmentId];
    }

    // Otherwise, construct a new one from appointment details in db
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
          select: { id: true, name: true }
        },
        doctor: {
          select: { id: true, name: true }
        }
      }
    });

    if (!appointment) {
      throw new AppError('Appointment not found for video consultation', 404);
    }

    // Verify participant authorization
    if (currentUserRole !== 'admin' && appointment.patientId !== currentUserId && appointment.doctorId !== currentUserId) {
      // Check if user is the patient user (the Patient table matches UID/ID, so let's verify patient profile)
      const patientUser = await prisma.user.findUnique({ where: { id: currentUserId } });
      const patientProfile = await prisma.patient.findFirst({ where: { email: patientUser?.email || '' } });
      
      if (appointment.doctorId !== currentUserId && (!patientProfile || appointment.patientId !== patientProfile.id)) {
        throw new AppError('Unauthorized: you are not a participant in this appointment', 403);
      }
    }

    // Get queue order to calculate estimated wait
    const todayAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: appointment.doctorId,
        date: appointment.date,
        status: { in: ['scheduled', 'arrived', 'in-consultation'] }
      },
      orderBy: { time: 'asc' }
    });

    const index = todayAppointments.findIndex(a => a.id === appointmentId);
    const queueNumber = index !== -1 ? index + 1 : 1;
    const estimatedWaitMinutes = index !== -1 ? index * 15 : 10;

    const newSession: VideoSession = {
      appointmentId,
      roomId: `room-${appointmentId}-${Math.random().toString(36).substring(2, 7)}`,
      patientId: appointment.patientId,
      patientName: appointment.patient.name,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctor.name,
      date: appointment.date,
      time: appointment.time,
      status: 'waiting', // Starts in waiting room
      joinedParticipants: [],
      chatHistory: [],
      sharedFiles: [],
      consultationNotes: '',
      isRecording: false,
      recordings: [],
      estimatedWaitMinutes,
      queueNumber
    };

    sessions[appointmentId] = newSession;
    this.writeAllSessions(sessions);

    return newSession;
  }

  /**
   * Let a participant join the video consultation
   */
  public static async joinSession(
    appointmentId: number,
    user: { id: number; name: string; role: string }
  ): Promise<VideoSession> {
    const sessions = this.readAllSessions();
    const session = sessions[appointmentId];
    if (!session) {
      throw new AppError('Session not initialized. Fetch session first.', 400);
    }

    // Check if already in joined participants
    const isAlreadyJoined = session.joinedParticipants.some(p => p.userId === user.id);
    if (!isAlreadyJoined) {
      session.joinedParticipants.push({
        userId: user.id,
        role: user.role,
        name: user.name,
        joinedAt: new Date().toISOString()
      });

      // If doctor joins, session becomes active automatically (admitting waiting room)
      if (user.role === 'doctor' || user.role === 'admin') {
        session.status = 'active';
      }
    }

    sessions[appointmentId] = session;
    this.writeAllSessions(sessions);
    return session;
  }

  /**
   * Doctor admits the patient from the waiting room
   */
  public static async admitPatient(appointmentId: number): Promise<VideoSession> {
    const sessions = this.readAllSessions();
    const session = sessions[appointmentId];
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    session.status = 'active';
    sessions[appointmentId] = session;
    this.writeAllSessions(sessions);
    return session;
  }

  /**
   * Send a chat message
   */
  public static async sendChatMessage(
    appointmentId: number,
    sender: { id: number; name: string; role: string },
    messageText: string
  ): Promise<VideoSession> {
    const sessions = this.readAllSessions();
    const session = sessions[appointmentId];
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      senderId: sender.id,
      senderName: sender.name,
      senderRole: sender.role,
      message: messageText,
      timestamp: new Date().toISOString()
    };

    session.chatHistory.push(newMessage);
    sessions[appointmentId] = session;
    this.writeAllSessions(sessions);
    return session;
  }

  /**
   * Share a file during the consultation
   */
  public static async shareFile(
    appointmentId: number,
    senderName: string,
    file: { name: string; size: string; type: string; url: string }
  ): Promise<VideoSession> {
    const sessions = this.readAllSessions();
    const session = sessions[appointmentId];
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const newSharedFile: SharedFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.url,
      senderName,
      timestamp: new Date().toISOString()
    };

    session.sharedFiles.push(newSharedFile);
    sessions[appointmentId] = session;
    this.writeAllSessions(sessions);
    return session;
  }

  /**
   * Update live consultation notes
   */
  public static async updateNotes(appointmentId: number, notes: string): Promise<VideoSession> {
    const sessions = this.readAllSessions();
    const session = sessions[appointmentId];
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    session.consultationNotes = notes;
    sessions[appointmentId] = session;
    this.writeAllSessions(sessions);
    return session;
  }

  /**
   * Format consultation notes using Gemini AI API
   */
  public static async aiEnhanceNotes(appointmentId: number, rawNotes: string): Promise<string> {
    if (!rawNotes.trim()) {
      throw new AppError('Notes content is empty. Please type some rough notes first.', 400);
    }

    const systemInstruction = `You are a medical scribe and clinical documentation analyst. 
Format raw, messy notes taken during a video consultation into a structured, highly professional clinical SOAP note format. 
Highlight medication names, follow-ups, and key action items explicitly.`;

    const prompt = `Please format and refine the following draft consultation notes into a clinical SOAP structure:
"${rawNotes}"`;

    return AIService.generate(prompt, { systemInstruction, temperature: 0.2 });
  }

  /**
   * Start recording session
   */
  public static async startRecording(appointmentId: number): Promise<VideoSession> {
    const sessions = this.readAllSessions();
    const session = sessions[appointmentId];
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    session.isRecording = true;
    session.recordingStartTime = new Date().toISOString();

    sessions[appointmentId] = session;
    this.writeAllSessions(sessions);
    return session;
  }

  /**
   * Stop recording session and generate metadata
   */
  public static async stopRecording(appointmentId: number): Promise<VideoSession> {
    const sessions = this.readAllSessions();
    const session = sessions[appointmentId];
    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (!session.isRecording) {
      throw new AppError('Session is not being recorded', 400);
    }

    const startTime = session.recordingStartTime ? new Date(session.recordingStartTime).getTime() : Date.now();
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    
    // Generate readable duration e.g. "05:22"
    const totalSecs = Math.max(12, Math.floor(durationMs / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const duration = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    // Generate random file size e.g. "12.4 MB"
    const randomSize = (totalSecs * 0.15 + Math.random() * 2).toFixed(1);
    const fileSize = `${randomSize} MB`;

    const newRecording: RecordingMetadata = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      appointmentId,
      patientName: session.patientName,
      doctorName: session.doctorName,
      duration,
      fileSize,
      date: new Date().toLocaleDateString(),
      videoUrl: `/recordings/rec-${appointmentId}.mp4`,
      status: 'completed'
    };

    session.isRecording = false;
    session.recordingStartTime = undefined;
    session.recordings.push(newRecording);

    sessions[appointmentId] = session;
    this.writeAllSessions(sessions);
    return session;
  }

  /**
   * Fetch all recordings
   */
  public static getAllRecordings(): RecordingMetadata[] {
    const sessions = this.readAllSessions();
    const allRecs: RecordingMetadata[] = [];
    for (const apptId in sessions) {
      if (sessions[apptId].recordings) {
        allRecs.push(...sessions[apptId].recordings);
      }
    }
    return allRecs.sort((a, b) => b.id.localeCompare(a.id));
  }
}
