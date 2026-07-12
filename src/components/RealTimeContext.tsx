import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext.tsx';
import { useQueryClient } from '@tanstack/react-query';

interface OnlineDoctor {
  doctorUserId: number;
  name: string;
  status: 'ONLINE' | 'BUSY' | 'AWAY' | 'OFFLINE';
}

interface RealTimeContextType {
  isConnected: boolean;
  onlineDoctors: Map<number, OnlineDoctor>;
  setDoctorStatus: (status: 'ONLINE' | 'BUSY' | 'AWAY') => void;
  sendCustomMessage: (type: string, payload: any) => void;
}

const RealTimeContext = createContext<RealTimeContextType | undefined>(undefined);

export function RealTimeProvider({ children }: { children: ReactNode }) {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineDoctors, setOnlineDoctors] = useState<Map<number, OnlineDoctor>>(new Map());
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef<number>(2000); // Start reconnect retry after 2 seconds

  // Keep reference to latest profile for status changes
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  /**
   * ESTABLISH WEBSOCKET CONNECTION
   */
  const connect = () => {
    if (!token) return;

    // Clear any pending reconnections
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Close any existing connection cleanly
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}?token=${encodeURIComponent(token)}`;

      console.info(`🔌 Connecting to Sanctuary Real-Time Gateway: ${wsProtocol}//${wsHost}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.info('🔌 Connected to Sanctuary Real-Time Gateway.');
        setIsConnected(true);
        reconnectDelayRef.current = 2000; // Reset reconnection delay on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleIncomingMessage(message.type, message.payload);
        } catch (err) {
          console.error('Error processing live gateway payload:', err);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;
        console.warn(`🔌 WebSocket closed: ${event.reason || 'No reason specified'} (Code: ${event.code})`);
        
        // Attempt reconnection if token still exists
        scheduleReconnection();
      };

      ws.onerror = (err) => {
        console.error('🔌 WebSocket connection error encountered:', err);
        // Let onclose handle the reconnection attempt
      };

    } catch (error) {
      console.error('Failed to instantiate WebSocket connection:', error);
      scheduleReconnection();
    }
  };

  /**
   * SCHEDULE CONNECTION RETRY WITH EXPONENTIAL BACKOFF
   */
  const scheduleReconnection = () => {
    if (!token) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = reconnectDelayRef.current;
    console.info(`🔄 Retrying real-time connection in ${delay / 1000}s...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
      // Double delay for next attempt, capping at 15 seconds
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 15000);
    }, delay);
  };

  /**
   * DISPATCH INCOMING WEBSOCKET EVENTS
   */
  const handleIncomingMessage = (type: string, payload: any) => {
    console.info(`📥 Live Event Received: [${type}]`, payload);

    switch (type) {
      case 'welcome':
        console.info(`Welcome message: ${payload.message}, assigned connection: ${payload.connectionId}`);
        break;

      case 'heartbeat_ack':
        // Heartbeat confirmed
        break;

      case 'queue:update':
        // Invalidate queue query caches to trigger instant UI refresh on the queue board
        queryClient.invalidateQueries({ queryKey: ['queue'] });
        queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        
        // Push a live toast or notification alert if a token is being called
        if (payload.changeType === 'called' || payload.token?.status === 'CALLING') {
          showLiveToast(
            '🔔 Patient Called',
            `Token ${payload.token?.tokenNumber || payload.token?.token?.tokenNumber} (${payload.token?.patient?.name || 'Patient'}) is called to ${payload.token?.doctor?.name || 'Doctor Room'}!`
          );
        }
        break;

      case 'appointment:update':
        // Invalidate appointment queries to update schedule lists in real time
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
        queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });

        if (payload.changeType === 'created') {
          showLiveToast(
            '📅 New Appointment Scheduled',
            `Appointment scheduled with Dr. ${payload.appointment?.doctor?.name || 'Staff'} for ${payload.appointment?.date} at ${payload.appointment?.time}.`
          );
        } else if (payload.changeType === 'cancelled') {
          showLiveToast(
            '⚠️ Appointment Cancelled',
            `Appointment scheduled on ${payload.appointment?.date} has been cancelled.`
          );
        }
        break;

      case 'doctor:availability_change':
        // Invalidate doctor details and availability queries
        queryClient.invalidateQueries({ queryKey: ['doctors'] });
        queryClient.invalidateQueries({ queryKey: ['doctor'] });
        break;

      case 'doctor:status_update':
        // Update local map of online doctors
        setOnlineDoctors((prev) => {
          const next = new Map(prev);
          if (payload.status === 'OFFLINE') {
            next.delete(payload.doctorUserId);
          } else {
            next.set(payload.doctorUserId, {
              doctorUserId: payload.doctorUserId,
              name: payload.name,
              status: payload.status,
            });
          }
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ['doctors'] });
        break;

      case 'doctors:sync_online':
        // Hydrate map of currently active doctors
        setOnlineDoctors(() => {
          const next = new Map<number, OnlineDoctor>();
          if (Array.isArray(payload.onlineDoctors)) {
            payload.onlineDoctors.forEach((doc: any) => {
              next.set(doc.doctorUserId, doc);
            });
          }
          return next;
        });
        break;

      case 'notification:new':
        // Invalidate in-app notification centers and show active notification banner
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        showLiveToast(`💬 ${payload.title}`, payload.message);
        break;

      case 'dashboard:update':
        // Refresh analytic widgets and metric pipelines
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        break;

      default:
        console.warn(`Unhandled real-time message type: ${type}`);
    }
  };

  /**
   * DISPATCH TOAST ALERT
   */
  const showLiveToast = (title: string, message: string) => {
    // Check if custom browser-level visual alerts or notifications are desired
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }

    // Trigger standard UI custom toast event
    const event = new CustomEvent('sanctuary-live-toast', {
      detail: { title, message, id: Date.now() },
    });
    window.dispatchEvent(event);
  };

  /**
   * CHANGE DOCTOR USER'S CURRENT ACTIVE STATUS (ONLINE / BUSY / AWAY)
   */
  const setDoctorStatus = (status: 'ONLINE' | 'BUSY' | 'AWAY') => {
    sendCustomMessage('doctor:set_status', { status });
  };

  /**
   * SEND CUSTOM OUTGOING MESSAGES TO THE SERVER
   */
  const sendCustomMessage = (type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('Cannot send live message: WebSocket is not open.');
    }
  };

  /**
   * EFFECT: TRIGGERS CONNECTION SEQUENCE WHEN AUTHENTICATED
   */
  useEffect(() => {
    if (token) {
      connect();
    } else {
      // Clean up connection if token is removed (logout)
      if (wsRef.current) {
        wsRef.current.close();
      }
      setIsConnected(false);
      setOnlineDoctors(new Map());
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [token]);

  return (
    <RealTimeContext.Provider
      value={{
        isConnected,
        onlineDoctors,
        setDoctorStatus,
        sendCustomMessage,
      }}
    >
      {children}
    </RealTimeContext.Provider>
  );
}

export function useRealTime() {
  const context = useContext(RealTimeContext);
  if (context === undefined) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
}
