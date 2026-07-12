import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  Share2,
  Copy,
  Check,
  Send,
  Upload,
  Download,
  Brain,
  Sparkles,
  Play,
  Square,
  Clock,
  User,
  Activity,
  ChevronRight,
  ClipboardList,
  AlertCircle,
  FileText,
  Paperclip,
  CheckCircle,
  Heart,
  ExternalLink,
  Lock,
  UserCheck,
  Plus,
  Calendar
} from 'lucide-react';

interface Appointment {
  id: number;
  patientId: number;
  doctorId: number;
  date: string;
  time: string;
  status: string;
  reason: string;
  notes?: string;
  patient: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  doctor: {
    id: number;
    name: string;
    email: string;
  };
}

interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  senderRole: string;
  message: string;
  timestamp: string;
}

interface SharedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
  senderName: string;
  timestamp: string;
}

interface RecordingMetadata {
  id: string;
  appointmentId: number;
  patientName: string;
  doctorName: string;
  duration: string;
  fileSize: string;
  date: string;
  videoUrl: string;
  status: string;
}

interface VideoSession {
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

export default function VideoConsultation() {
  const { token, profile } = useAuth();
  const queryClient = useQueryClient();
  const currentRole = profile?.role || 'patient';
  const isDoctor = ['doctor', 'admin'].includes(currentRole);

  // States
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [session, setSession] = useState<VideoSession | null>(null);
  const [chatMessageInput, setChatMessageInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedApptId, setCopiedApptId] = useState<number | null>(null);
  
  // Media controls
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [screenShareActive, setScreenShareActive] = useState(false);
  
  // File upload fields
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState('1.2 MB');
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('application/pdf');

  // Pre-configured shared files presets
  const filePresets = [
    { name: 'Blood_Report_Comprehensive.pdf', size: '2.4 MB', type: 'application/pdf', url: '/files/blood_report.pdf' },
    { name: 'X_Ray_Knee_Joint.jpg', size: '4.1 MB', type: 'image/jpeg', url: '/files/knee_xray.jpg' },
    { name: 'Prescription_Draft_Refills.pdf', size: '640 KB', type: 'application/pdf', url: '/files/prescription.pdf' }
  ];

  // Refresh interval for live session data
  useEffect(() => {
    if (!activeSessionId) return;

    const fetchSessionState = async () => {
      try {
        const res = await fetch(`/api/video/session/${activeSessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSession(data);
          // Pre-populate notes only if clinician has notes and they are empty locally
          if (isDoctor && data.consultationNotes && !notesInput) {
            setNotesInput(data.consultationNotes);
          }
        }
      } catch (err) {
        console.error('Error fetching video session:', err);
      }
    };

    fetchSessionState();
    const interval = setInterval(fetchSessionState, 4000); // Poll every 4 seconds to simulate real-time chat/admit triggers
    return () => clearInterval(interval);
  }, [activeSessionId, token]);

  // Load appointments list
  const { data: appointments = [], isLoading: isLoadingAppointments, refetch: refetchAppointments } = useQuery<Appointment[]>({
    queryKey: ['video-appointments'],
    queryFn: async () => {
      const res = await fetch('/api/appointments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load appointments');
      const data = await res.json();
      // Only keep scheduled appointments
      return data;
    }
  });

  // Load historical recordings list
  const { data: recordings = [], isLoading: isLoadingRecordings, refetch: refetchRecordings } = useQuery<RecordingMetadata[]>({
    queryKey: ['video-recordings'],
    queryFn: async () => {
      const res = await fetch('/api/video/recordings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load recordings');
      return res.json();
    }
  });

  // Initialize and Join Consultation Room
  const handleLaunchRoom = async (appointmentId: number) => {
    try {
      // 1. Fetch/Init session
      const initRes = await fetch(`/api/video/session/${appointmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!initRes.ok) {
        const errData = await initRes.json();
        throw new Error(errData.message || 'Failed to initialize video session');
      }
      const sessionData = await initRes.json();
      setSession(sessionData);
      setNotesInput(sessionData.consultationNotes || '');
      setActiveSessionId(appointmentId);

      // 2. Perform join action to trigger wait lists
      const joinRes = await fetch(`/api/video/session/${appointmentId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (joinRes.ok) {
        const updatedSession = await joinRes.json();
        setSession(updatedSession);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to enter video consultation room');
    }
  };

  // Admit Patient (Doctor action)
  const handleAdmitPatient = async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`/api/video/session/${activeSessionId}/admit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
      }
    } catch (err) {
      console.error('Failed to admit patient:', err);
    }
  };

  // Send text message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId || !chatMessageInput.trim()) return;

    try {
      const res = await fetch(`/api/video/session/${activeSessionId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: chatMessageInput })
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
        setChatMessageInput('');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Upload/Share file
  const handleShareFile = async (fileName: string, fileSize: string, fileType: string, url: string) => {
    if (!activeSessionId) return;

    try {
      const res = await fetch(`/api/video/session/${activeSessionId}/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: fileName, size: fileSize, type: fileType, url })
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
        // Reset manual share fields
        setUploadedFileName('');
      }
    } catch (err) {
      console.error('Failed to share file:', err);
    }
  };

  // Save clinician consultation notes
  const handleSaveNotes = async (notesText: string) => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`/api/video/session/${activeSessionId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notes: notesText })
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  };

  // AI assistant to format/improve SOAP notes
  const handleAiFormatNotes = async () => {
    if (!activeSessionId || !notesInput.trim()) return;
    setIsAiLoading(true);
    try {
      const res = await fetch(`/api/video/session/${activeSessionId}/notes/ai-assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rawNotes: notesInput })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.text) {
          setNotesInput(data.text);
          // Save back formatted note
          handleSaveNotes(data.text);
        }
      }
    } catch (err) {
      console.error('AI Scribe Assist failed:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Recording controls
  const handleToggleRecording = async () => {
    if (!activeSessionId || !session) return;
    const endpoint = `/api/video/session/${activeSessionId}/record/${session.isRecording ? 'stop' : 'start'}`;
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
        refetchRecordings(); // reload list
      }
    } catch (err) {
      console.error('Failed to toggle recording:', err);
    }
  };

  // Copy unique copy-paste room link
  const handleCopyLink = (apptId: number) => {
    const directUrl = `${window.location.origin}/video-consultation?join=${apptId}`;
    navigator.clipboard.writeText(directUrl);
    setCopiedApptId(apptId);
    setTimeout(() => setCopiedApptId(null), 2000);
  };

  // Exit Room
  const handleLeaveRoom = () => {
    setActiveSessionId(null);
    setSession(null);
    refetchAppointments();
  };

  // Direct Join Parameter check on launch
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinParam = urlParams.get('join');
    if (joinParam) {
      const apptId = parseInt(joinParam);
      if (!isNaN(apptId)) {
        handleLaunchRoom(apptId);
      }
    }
  }, []);

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6 bg-slate-50/50">
      
      {/* Active Room View */}
      {session && activeSessionId ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[85vh] items-stretch">
          
          {/* Main Video Meeting Box & Clinician Notes pad (Left/Center) */}
          <div className="xl:col-span-8 flex flex-col justify-between space-y-6 h-full">
            
            {/* Call Header / Information Banner */}
            <div className="bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 text-rose-500 rounded-xl">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-slate-800 text-sm">
                    {isDoctor ? `Consultation with Patient: ${session.patientName}` : `Consultation with Dr. ${session.doctorName}`}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium font-mono flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-teal-500" />
                    <span>Scheduled for: {session.time}</span>
                    <span className="text-slate-300">|</span>
                    <span>Room: {session.roomId}</span>
                  </p>
                </div>
              </div>

              {/* Status Pill Badge */}
              <div className="flex items-center gap-3">
                {session.isRecording && (
                  <span className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold font-mono uppercase animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                    REC ACTIVE
                  </span>
                )}
                
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono uppercase ${
                  session.status === 'active' 
                    ? 'bg-teal-50 text-teal-600' 
                    : 'bg-amber-50 text-amber-600'
                }`}>
                  {session.status === 'active' ? '● Connected' : 'Waiting Room'}
                </span>
              </div>
            </div>

            {/* Core Screen Stage Container */}
            <div className="flex-1 bg-slate-900 rounded-3xl relative overflow-hidden flex items-center justify-center shadow-lg border border-slate-800 group min-h-[350px]">
              
              {/* IF PATIENT IS STILL IN WAITING ROOM */}
              {session.status === 'waiting' && !isDoctor ? (
                <div className="text-center p-8 max-w-md z-10 space-y-5 text-white">
                  <div className="w-20 h-20 bg-teal-500/10 text-teal-400 rounded-full flex items-center justify-center mx-auto shadow-inner border border-teal-500/20 relative">
                    <Activity className="w-10 h-10 animate-pulse text-teal-400" />
                    <div className="absolute inset-0 rounded-full border-2 border-teal-400/40 animate-ping opacity-75"></div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-lg text-teal-300">Welcome to CareSync Waiting Room</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Dr. {session.doctorName} has been notified and will admit you into the private consultation room shortly.
                    </p>
                  </div>

                  {/* Queuing stats card */}
                  <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl grid grid-cols-2 gap-4 text-center">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Your Queue position</span>
                      <span className="text-lg font-bold text-white font-mono">#{session.queueNumber}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Estimated Wait</span>
                      <span className="text-lg font-bold text-emerald-400 font-mono">~{session.estimatedWaitMinutes} mins</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 font-medium italic">
                    💡 Calming tip: Relax, take deep breaths, and ensure your microphone/camera are ready.
                  </div>
                </div>
              ) : (
                /* ACTIVE MULTI-PARTICIPANT VIDEO MEET LAYOUT */
                <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 p-4 gap-4 h-full w-full">
                  
                  {/* Doctor Screen Feed (Main / Dynamic) */}
                  <div className="bg-slate-800 rounded-2xl overflow-hidden relative border border-slate-700 shadow-md flex items-center justify-center">
                    {videoActive ? (
                      <div className="absolute inset-0 flex flex-col justify-between p-4">
                        <span className="bg-slate-900/80 text-[10px] text-slate-200 px-2.5 py-1 rounded-lg font-semibold w-fit">
                          Dr. {session.doctorName} (Physician)
                        </span>
                        
                        {/* Interactive simulated webcam feedback waves */}
                        <div className="flex-1 flex items-center justify-center">
                          <div className="w-24 h-24 bg-teal-500/10 text-teal-400 rounded-full flex items-center justify-center animate-pulse border border-teal-500/20 shadow-lg">
                            <Video className="w-8 h-8" />
                          </div>
                        </div>

                        {/* Audio status info */}
                        <div className="flex items-center gap-2 justify-between">
                          <span className="bg-teal-500 text-white font-bold text-[8px] font-mono uppercase px-1.5 py-0.5 rounded">WEB RTC - 1080P</span>
                          <div className="p-1 bg-slate-900/80 text-teal-400 rounded-lg">
                            <Mic className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 bg-slate-700/60 rounded-full flex items-center justify-center mx-auto text-slate-400">
                          <VideoOff className="w-6 h-6" />
                        </div>
                        <span className="text-xs text-slate-400 font-medium">Physician Video Disabled</span>
                      </div>
                    )}
                  </div>

                  {/* Patient Screen Feed (Simulated or Local Camera fallback) */}
                  <div className="bg-slate-800 rounded-2xl overflow-hidden relative border border-slate-700 shadow-md flex items-center justify-center">
                    <div className="absolute inset-0 flex flex-col justify-between p-4">
                      <span className="bg-slate-900/80 text-[10px] text-slate-200 px-2.5 py-1 rounded-lg font-semibold w-fit">
                        {session.patientName} (Patient)
                      </span>

                      {/* Interactive simulated webcam feedback waves */}
                      <div className="flex-1 flex items-center justify-center">
                        <div className="w-24 h-24 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center animate-pulse border border-blue-500/20 shadow-lg">
                          <User className="w-8 h-8" />
                        </div>
                      </div>

                      {/* Audio status info */}
                      <div className="flex items-center gap-2 justify-between">
                        <span className="bg-slate-900 text-slate-400 text-[8px] font-mono uppercase px-1.5 py-0.5 rounded">LATENCY: 12ms</span>
                        <div className="p-1 bg-slate-900/80 text-blue-400 rounded-lg">
                          {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Waiting Room Admission Banner overlay (for Doctor View) */}
              {isDoctor && session.status === 'waiting' && (
                <div className="absolute inset-x-0 bottom-4 mx-auto w-[90%] bg-slate-900/95 backdrop-blur-md border border-teal-500/30 px-6 py-4 rounded-2xl flex items-center justify-between shadow-2xl z-20">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></div>
                    <div>
                      <p className="text-xs font-bold text-white">Patient {session.patientName} is Waiting</p>
                      <p className="text-[10px] text-slate-400">Queue # {session.queueNumber} | Checked in 3 mins ago</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAdmitPatient}
                    className="bg-teal-500 hover:bg-teal-600 px-4 py-2 text-white font-bold text-[11px] rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Admit Patient</span>
                  </button>
                </div>
              )}

              {/* Control Overlays (Mic, video mute toggle, leave call) */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-950/80 backdrop-blur px-4 py-2.5 rounded-full flex items-center gap-3 border border-slate-800 shadow-xl group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setMicActive(!micActive)}
                  className={`p-2.5 rounded-full cursor-pointer transition-colors ${
                    micActive ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-500 text-white hover:bg-rose-600'
                  }`}
                >
                  {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setVideoActive(!videoActive)}
                  className={`p-2.5 rounded-full cursor-pointer transition-colors ${
                    videoActive ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-500 text-white hover:bg-rose-600'
                  }`}
                >
                  {videoActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setScreenShareActive(!screenShareActive)}
                  className={`p-2.5 rounded-full cursor-pointer transition-colors ${
                    screenShareActive ? 'bg-teal-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                </button>

                {isDoctor && (
                  <button
                    onClick={handleToggleRecording}
                    className={`p-2.5 rounded-full cursor-pointer transition-colors ${
                      session.isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-white hover:bg-slate-700'
                    }`}
                    title={session.isRecording ? 'Stop Recording' : 'Start Recording'}
                  >
                    {session.isRecording ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                )}

                <span className="w-px h-6 bg-slate-800"></span>

                <button
                  onClick={handleLeaveRoom}
                  className="bg-red-500 hover:bg-red-600 px-4 py-2 text-white font-bold text-[11px] rounded-full cursor-pointer transition-colors"
                >
                  End Session
                </button>
              </div>

            </div>

            {/* Clinician Consultation Notes pad (Clinicians only) */}
            {isDoctor && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-teal-500" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Live Consultation Notes</span>
                  </div>

                  {/* AI scribe assist helper */}
                  <button
                    disabled={isAiLoading || !notesInput.trim()}
                    onClick={handleAiFormatNotes}
                    className="flex items-center gap-1 bg-teal-50 hover:bg-teal-100 disabled:bg-slate-100 disabled:text-slate-400 text-teal-600 px-2.5 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all"
                  >
                    {isAiLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                    )}
                    <span>{isAiLoading ? 'AI formatting...' : 'AI SOAP Scribe Assist'}</span>
                  </button>
                </div>

                <textarea
                  placeholder="Type draft consultation notes, vitals, prescriptions or complaints. Click the AI scribe assist button to automatically compile into SOAP notes format..."
                  value={notesInput}
                  onChange={(e) => {
                    setNotesInput(e.target.value);
                    handleSaveNotes(e.target.value);
                  }}
                  rows={4}
                  className="w-full px-3.5 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white resize-none"
                />
              </div>
            )}

          </div>

          {/* Right Panel Tabs: Chat Room & File Sharing (Right side) */}
          <div className="xl:col-span-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
            
            {/* Header title */}
            <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <span className="font-display font-bold text-slate-800 text-xs uppercase tracking-wider">Live Communication Panel</span>
              <span className="text-[10px] text-teal-600 font-semibold font-mono bg-teal-50 px-2 py-0.5 rounded-full">Encrypted</span>
            </div>

            {/* Chat list block */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[40vh] border-b border-slate-50">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block pb-1 border-b border-slate-50 mb-3">Instant Chat Room</span>
              {session.chatHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <Send className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-[10px] max-w-[200px] mx-auto">No messages exchanged yet in this call session. Send a text below.</p>
                </div>
              ) : (
                session.chatHistory.map((msg) => {
                  const isOwn = msg.senderId === profile?.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} space-y-1`}>
                      <span className="text-[9px] text-slate-400 font-bold">
                        {msg.senderName} ({msg.senderRole})
                      </span>
                      <div className={`p-3 rounded-2xl text-[11px] max-w-[85%] leading-normal ${
                        isOwn 
                          ? 'bg-teal-500 text-white rounded-tr-none' 
                          : 'bg-slate-100 text-slate-800 rounded-tl-none'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* File Sharing module block */}
            <div className="p-6 space-y-4 bg-slate-50/20 flex-1 flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Consultation Shared Attachments</span>
                <span className="text-[10px] text-slate-400 font-bold">{session.sharedFiles.length} files</span>
              </div>

              {/* Shared files catalog list */}
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[150px]">
                {session.sharedFiles.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-[10px]">
                    No files shared in this call yet. Use presets or upload fields below.
                  </div>
                ) : (
                  session.sharedFiles.map(file => (
                    <div key={file.id} className="p-2.5 bg-white border border-slate-100 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                          <Paperclip className="w-3.5 h-3.5" />
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-[10px] font-bold text-slate-700 block truncate">{file.name}</span>
                          <span className="text-[8px] text-slate-400 block font-medium font-mono">{file.size} • by {file.senderName}</span>
                        </div>
                      </div>
                      <a
                        href={file.url}
                        download
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`Simulating document download: ${file.name}`);
                        }}
                        className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Preset Files launcher */}
              <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Share Presets</span>
                <div className="flex flex-wrap gap-1.5">
                  {filePresets.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => handleShareFile(preset.name, preset.size, preset.type, preset.url)}
                      className="flex items-center gap-1 border border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200 px-2 py-1 rounded-lg text-[9px] font-semibold text-slate-600 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3 text-teal-600" />
                      <span>{preset.name.split('_')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom manual file loader fields */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Shared_File_Name.pdf"
                    value={uploadedFileName}
                    onChange={(e) => setUploadedFileName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    onClick={() => {
                      if (!uploadedFileName.trim()) return alert('Please input a file name');
                      handleShareFile(
                        uploadedFileName.endsWith('.pdf') ? uploadedFileName : `${uploadedFileName}.pdf`,
                        '1.8 MB',
                        'application/pdf',
                        '/files/custom_upload.pdf'
                      );
                    }}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Chat Message compose bar */}
            <form onSubmit={handleSendMessage} className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder="Type instant text message..."
                value={chatMessageInput}
                onChange={(e) => setChatMessageInput(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white p-2.5 rounded-xl cursor-pointer transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>

        </div>
      ) : (
        /* ==================== VIDEO DASHBOARD & MAIN LISTS ==================== */
        <div className="space-y-6">
          
          {/* Main Dashboard welcome banner */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                  <Video className="w-5 h-5" />
                </div>
                <h1 className="text-2xl font-display font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  Telehealth Consultation Suite
                </h1>
              </div>
              <p className="text-sm text-slate-400">
                Launch encrypted HD video consultation rooms, manage patient waiting queues, review records, share live documents, and capture session logs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Appointments schedule (Left side) */}
            <div className="lg:col-span-8 space-y-6">
              
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock className="w-4 h-4 text-rose-500" />
                    <span>Today's Video Consultation Schedule</span>
                  </h3>
                  <button onClick={() => refetchAppointments()} className="text-[10px] font-bold text-teal-600 hover:text-teal-700 cursor-pointer">
                    Sync Appointments
                  </button>
                </div>

                {isLoadingAppointments ? (
                  <div className="text-center py-10 space-y-3">
                    <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-slate-400 font-medium">Checking clinical consult schedules...</p>
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-100 text-slate-400 space-y-2">
                    <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs max-w-[280px] mx-auto font-medium">No video consultation appointments booked for today. Create an appointment in the Appointments panel to begin.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((appt) => {
                      const isPatientMatched = appt.patientId === profile?.id;
                      const isDoctorMatched = appt.doctorId === profile?.id;
                      
                      return (
                        <div key={appt.id} className="p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-150">
                                {appt.time}
                              </span>
                              <span className="text-[9px] font-bold font-mono uppercase bg-teal-50 text-teal-600 px-2.5 py-0.5 rounded-full">
                                HD Video Link Enabled
                              </span>
                            </div>

                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-700">
                                {isDoctor ? `Patient: ${appt.patient.name}` : `Dr: ${appt.doctor.name}`}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">
                                Visit Reason: <span className="text-slate-600">{appt.reason}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            {/* Copyable Appointment Link */}
                            <button
                              onClick={() => handleCopyLink(appt.id)}
                              className="flex items-center gap-1 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 px-3 py-2 rounded-xl text-[10px] font-bold text-slate-600 cursor-pointer transition-colors"
                              title="Copy clinical meeting link"
                            >
                              {copiedApptId === appt.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-teal-600" />}
                              <span>{copiedApptId === appt.id ? 'Copied' : 'Copy Join Link'}</span>
                            </button>

                            {/* Launch Video button */}
                            <button
                              onClick={() => handleLaunchRoom(appt.id)}
                              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>{isDoctor ? 'Launch Room' : 'Join Call'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Session Recording Catalog Panel (Right side) */}
            <div className="lg:col-span-4 space-y-6">
              
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <FileText className="w-4 h-4 text-teal-500" />
                    <span>Session Recording Logs</span>
                  </h3>
                </div>

                {isLoadingRecordings ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                    Compiling recordings...
                  </div>
                ) : recordings.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-[10px] space-y-1">
                    <Lock className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="font-bold">No Recordings Filed</p>
                    <p className="max-w-[180px] mx-auto text-slate-400">Past recordings appear automatically when a clinician initiates recording during video calls.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {recordings.map(rec => (
                      <div key={rec.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-bold font-mono uppercase bg-rose-50 text-rose-600 px-2 py-0.5 rounded">
                            RECORDING COMPLETED
                          </span>
                          <span className="text-[8px] font-mono text-slate-400 font-bold">{rec.date}</span>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-slate-700">Dr. {rec.doctorName} • {rec.patientName}</p>
                          <p className="text-[8px] text-slate-400 font-medium font-mono">
                            Duration: {rec.duration} | Size: {rec.fileSize}
                          </p>
                        </div>

                        {/* Simulate download of previous recording */}
                        <button
                          onClick={() => alert(`Simulating playback/download of recording session: ${rec.id}`)}
                          className="w-full py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg text-[9px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
                        >
                          <Download className="w-3 h-3 text-teal-500" />
                          <span>Download Archive</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
