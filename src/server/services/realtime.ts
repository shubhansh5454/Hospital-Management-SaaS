import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage, Server } from 'http';
import { verifyAccessToken } from '../utils/jwt.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { getOrCreateUser } from '../../db/users.ts';
import { logger } from '../utils/logger.ts';
import { prisma } from '../../db/prisma.ts';

export interface ActiveConnection {
  ws: WebSocket;
  userId: number | null;
  patientId: number | null;
  role: string;
  email: string;
  name: string;
  clinicId: number | null;
  isAlive: boolean;
  status: 'ONLINE' | 'BUSY' | 'AWAY' | 'OFFLINE';
}

export class RealTimeService {
  private static wss: WebSocketServer | null = null;
  private static connections = new Map<string, ActiveConnection>(); // Map of connection ID -> connection details
  private static heartbeatsInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the WebSocket Server on the existing HTTP/Express Server
   */
  public static init(server: Server) {
    if (this.wss) {
      logger.warn('RealTimeService already initialized.');
      return;
    }

    this.wss = new WebSocketServer({ noServer: true });
    logger.info('🔌 WebSocket Server initialized, attaching upgrade handler...');

    // Attach upgrade handler to Express Server
    server.on('upgrade', async (request: IncomingMessage, socket, head) => {
      try {
        const urlObj = new URL(request.url || '', `http://${request.headers.host}`);
        const token = urlObj.searchParams.get('token');

        if (!token) {
          logger.warn('Rejected WebSocket upgrade request: Missing token');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Authenticate connection
        const userDetails = await this.authenticateToken(token);
        if (!userDetails) {
          logger.warn('Rejected WebSocket upgrade request: Invalid token');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // If authenticated, perform standard ws upgrade
        this.wss?.handleUpgrade(request, socket, head, (ws) => {
          this.wss?.emit('connection', ws, request, userDetails);
        });

      } catch (err) {
        logger.error('Error during WebSocket upgrade handshake:', err);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    });

    // Handle WebSocket Connections
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage, userDetails: any) => {
      const connectionId = `${userDetails.userId || 'p-' + userDetails.patientId}-${Date.now()}`;
      
      const connection: ActiveConnection = {
        ws,
        userId: userDetails.userId || null,
        patientId: userDetails.patientId || null,
        role: userDetails.role,
        email: userDetails.email,
        name: userDetails.name,
        clinicId: userDetails.clinicId || null,
        isAlive: true,
        status: userDetails.role === 'doctor' ? 'ONLINE' : 'ONLINE',
      };

      this.connections.set(connectionId, connection);
      logger.info(`🔌 WebSocket Client Connected: ${connection.name} (${connection.role}) [ID: ${connectionId}]`);

      // Set up heartbeat listener
      ws.on('pong', () => {
        const conn = this.connections.get(connectionId);
        if (conn) conn.isAlive = true;
      });

      // Send initial welcome configuration & active doctor list to the client
      this.sendToConnection(ws, 'welcome', {
        connectionId,
        user: {
          userId: connection.userId,
          patientId: connection.patientId,
          role: connection.role,
          name: connection.name,
          clinicId: connection.clinicId,
        },
        message: 'Connected to Sanctuary Real-Time Gateway'
      });

      // If doctor connected, broadcast Doctor Availability/Status Update
      if (connection.role === 'doctor' && connection.clinicId) {
        this.broadcastDoctorStatusUpdate(connection.clinicId, connection.userId!, 'ONLINE', connection.name);
      }

      // Sync existing active online doctors in their clinic
      if (connection.clinicId) {
        const onlineDoctors = this.getOnlineDoctors(connection.clinicId);
        this.sendToConnection(ws, 'doctors:sync_online', { onlineDoctors });
      }

      // Listen for message events from client
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(connectionId, connection, data);
        } catch (err) {
          logger.error(`Error parsing WS client message:`, err);
        }
      });

      // Handle close and error
      ws.on('close', () => {
        this.handleDisconnect(connectionId, connection);
      });

      ws.on('error', (err) => {
        logger.error(`WebSocket connection error [ID: ${connectionId}]:`, err);
        this.handleDisconnect(connectionId, connection);
      });
    });

    // Start WebSocket heartbeat keep-alive
    this.startHeartbeats();
  }

  /**
   * Parse and authenticate token (supports local custom JWT and Firebase Auth ID token)
   */
  private static async authenticateToken(token: string): Promise<any> {
    try {
      // 1. Try local custom JWT authentication first
      try {
        const decodedLocal = verifyAccessToken(token);
        const dbUser = await prisma.user.findUnique({
          where: { id: decodedLocal.id },
        });

        if (dbUser) {
          return {
            userId: dbUser.id,
            role: dbUser.role,
            email: dbUser.email,
            name: dbUser.name,
            clinicId: dbUser.clinicId,
          };
        }
      } catch (localJwtError) {
        // Fallback to Firebase
      }

      // 2. Fallback to Firebase authentication
      const decodedToken = await adminAuth.verifyIdToken(token);
      const email = decodedToken.email || '';
      const name = decodedToken.name || email.split('@')[0] || 'User';
      const dbUser = await getOrCreateUser(decodedToken.uid, email, name);

      return {
        userId: dbUser.id,
        role: dbUser.role,
        email: dbUser.email,
        name: dbUser.name,
        clinicId: dbUser.clinicId,
      };

    } catch (err) {
      // Also check if this is a Patient session token or a client-specific key
      try {
        const decoded = verifyAccessToken(token);
        if (decoded.role === 'patient') {
          const patient = await prisma.patient.findFirst({
            where: { email: decoded.email },
          });
          if (patient) {
            return {
              patientId: patient.id,
              role: 'patient',
              email: patient.email,
              name: patient.name,
              clinicId: patient.clinicId,
            };
          }
        }
      } catch (e) {
        // Verification failed entirely
      }
      return null;
    }
  }

  /**
   * Process incoming messages from WebSocket clients (such as manual status updates)
   */
  private static handleClientMessage(connectionId: string, conn: ActiveConnection, data: any) {
    const { type, payload } = data;

    if (type === 'heartbeat') {
      conn.isAlive = true;
      this.sendToConnection(conn.ws, 'heartbeat_ack', { timestamp: Date.now() });
      return;
    }

    if (type === 'doctor:set_status') {
      const { status } = payload;
      if (conn.role === 'doctor' && conn.clinicId && conn.userId) {
        conn.status = status;
        this.broadcastDoctorStatusUpdate(conn.clinicId, conn.userId, status, conn.name);
      }
      return;
    }

    logger.info(`Received custom WS message type: ${type} from connection: ${connectionId}`);
  }

  /**
   * Handle WebSocket client disconnection
   */
  private static handleDisconnect(connectionId: string, conn: ActiveConnection) {
    if (this.connections.has(connectionId)) {
      this.connections.delete(connectionId);
      logger.info(`🔌 WebSocket Client Disconnected [ID: ${connectionId}]`);

      // If doctor disconnected, broadcast status change to clinic
      if (conn.role === 'doctor' && conn.clinicId && conn.userId) {
        // Double check if there are any other active connections for this doctor (e.g. multiple tabs)
        const isStillConnected = Array.from(this.connections.values()).some(
          (c) => c.userId === conn.userId
        );
        if (!isStillConnected) {
          this.broadcastDoctorStatusUpdate(conn.clinicId, conn.userId, 'OFFLINE', conn.name);
        }
      }
    }
  }

  /**
   * Broadcast a doctor status update to all connected clients in the clinic
   */
  private static broadcastDoctorStatusUpdate(clinicId: number, doctorUserId: number, status: 'ONLINE' | 'BUSY' | 'AWAY' | 'OFFLINE', name: string) {
    this.broadcastToClinic(clinicId, 'doctor:status_update', {
      doctorUserId,
      name,
      status,
      timestamp: Date.now()
    });
  }

  /**
   * Retrieve list of currently online doctors inside a clinic
   */
  private static getOnlineDoctors(clinicId: number) {
    const doctors: { doctorUserId: number; name: string; status: string }[] = [];
    const tracker = new Set<number>();

    for (const conn of this.connections.values()) {
      if (conn.clinicId === clinicId && conn.role === 'doctor' && conn.userId) {
        if (!tracker.has(conn.userId)) {
          tracker.add(conn.userId);
          doctors.push({
            doctorUserId: conn.userId,
            name: conn.name,
            status: conn.status,
          });
        }
      }
    }
    return doctors;
  }

  /**
   * Start keep-alive heartbeats to prevent idle timeout and purge stale socket handles
   */
  private static startHeartbeats() {
    this.heartbeatsInterval = setInterval(() => {
      this.connections.forEach((conn, connectionId) => {
        if (!conn.isAlive) {
          logger.info(`🔌 WebSocket connection dead, closing and purging [ID: ${connectionId}]`);
          conn.ws.terminate();
          this.handleDisconnect(connectionId, conn);
          return;
        }

        conn.isAlive = false;
        try {
          conn.ws.ping();
        } catch (e) {
          logger.error(`Error pinging client [ID: ${connectionId}]:`, e);
        }
      });
    }, 30000); // 30 second interval
  }

  /**
   * Securely send JSON payload over a specific WS client
   */
  private static sendToConnection(ws: WebSocket, type: string, payload: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }

  /**
   * Public Broadcast: Send message to a specific user (by user database ID)
   */
  public static broadcastToUser(userId: number, type: string, payload: any) {
    this.connections.forEach((conn) => {
      if (conn.userId === userId) {
        this.sendToConnection(conn.ws, type, payload);
      }
    });
  }

  /**
   * Public Broadcast: Send message to a specific patient (by patient database ID)
   */
  public static broadcastToPatient(patientId: number, type: string, payload: any) {
    this.connections.forEach((conn) => {
      if (conn.patientId === patientId) {
        this.sendToConnection(conn.ws, type, payload);
      }
    });
  }

  /**
   * Public Broadcast: Send message to all users connected to a specific clinic
   */
  public static broadcastToClinic(clinicId: number, type: string, payload: any) {
    this.connections.forEach((conn) => {
      if (conn.clinicId === clinicId) {
        this.sendToConnection(conn.ws, type, payload);
      }
    });
  }

  /**
   * Public Broadcast: Send message to all connected clients system-wide (Admin updates)
   */
  public static broadcastToAll(type: string, payload: any) {
    this.connections.forEach((conn) => {
      this.sendToConnection(conn.ws, type, payload);
    });
  }

  /**
   * Trigger Real-Time Notification Dispatching
   */
  public static broadcastNotification(userId: number | null, patientId: number | null, clinicId: number | null, notification: any) {
    const payload = {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.createdAt,
    };

    if (userId) {
      this.broadcastToUser(userId, 'notification:new', payload);
    }
    if (patientId) {
      this.broadcastToPatient(patientId, 'notification:new', payload);
    }
    if (clinicId) {
      // Also broadcast to receptionist or admin of that clinic
      this.connections.forEach((conn) => {
        if (conn.clinicId === clinicId && (conn.role === 'admin' || conn.role === 'receptionist')) {
          this.sendToConnection(conn.ws, 'notification:new', {
            ...payload,
            message: `[For Client/Patient] ${payload.message}`
          });
        }
      });
    }
  }

  /**
   * Trigger Live Queue Token Board Updates
   */
  public static broadcastQueueUpdate(clinicId: number, changeType: 'created' | 'updated' | 'called' | 'completed', tokenData: any) {
    this.broadcastToClinic(clinicId, 'queue:update', {
      changeType,
      token: tokenData,
      timestamp: Date.now()
    });

    // Also trigger Dashboard Sync since queues affect clinic metrics
    this.broadcastDashboardUpdate(clinicId, { reason: 'queue_change' });
  }

  /**
   * Trigger Live Appointment Schedule Updates
   */
  public static broadcastAppointmentUpdate(clinicId: number, changeType: 'created' | 'updated' | 'cancelled' | 'rescheduled', appointmentData: any) {
    this.broadcastToClinic(clinicId, 'appointment:update', {
      changeType,
      appointment: appointmentData,
      timestamp: Date.now()
    });

    // Trigger Dashboard Sync
    this.broadcastDashboardUpdate(clinicId, { reason: 'appointment_change' });
  }

  /**
   * Trigger Doctor Availability/Schedule Changes
   */
  public static broadcastDoctorAvailabilityUpdate(clinicId: number, doctorProfileId: number, reason: string) {
    this.broadcastToClinic(clinicId, 'doctor:availability_change', {
      doctorProfileId,
      reason,
      timestamp: Date.now()
    });
  }

  /**
   * Trigger Live Dashboard Updates (Stats, pipeline, widgets)
   */
  public static broadcastDashboardUpdate(clinicId: number, metadata: any = {}) {
    this.broadcastToClinic(clinicId, 'dashboard:update', {
      ...metadata,
      timestamp: Date.now()
    });
  }
}
