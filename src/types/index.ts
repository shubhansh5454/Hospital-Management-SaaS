export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'patient';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
  dob: string; // YYYY-MM-DD
  gender: string;
  bloodGroup?: string;
  address?: string;
  medicalHistory?: string;
  allergies?: string;
  createdAt: Date;
  emrRecords?: EmrRecord[];
}

export interface Appointment {
  id: number;
  patientId: number;
  doctorId: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: 'scheduled' | 'completed' | 'cancelled';
  reason: string;
  notes?: string;
  createdAt: Date;
}

export interface DoctorAvailability {
  id: number;
  doctorProfileId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface DoctorLeave {
  id: number;
  doctorProfileId: number;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface DoctorProfile {
  id: number;
  userId: number;
  specialization: string;
  biography?: string;
  experienceYrs: number;
  schedules: DoctorAvailability[];
  leaves: DoctorLeave[];
}

export interface DoctorUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  doctorProfile?: DoctorProfile;
}

export interface PrescriptionItem {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface AttachmentItem {
  name: string;
  size: number;
  type: string;
  data?: string; // base64 or download url
}

export interface EmrRecord {
  id: number;
  patientId: number;
  doctorId: number;
  appointmentId?: number;
  date: string; // YYYY-MM-DD
  
  // Vitals
  bloodPressure?: string;
  heartRate?: number;
  temperature?: string;
  respiratoryRate?: number;
  weight?: string;
  height?: string;
  bmi?: string;
  oxygenSaturation?: number;

  // Diagnosis
  diagnosis: string;

  // SOAP Notes
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;

  // Prescriptions
  prescriptions?: string; // json string

  // Follow-up Notes
  followUpNotes?: string;
  followUpDate?: string;

  // Attachments
  attachments?: string; // json string

  createdAt: string;
  doctor?: {
    id: number;
    name: string;
    email: string;
  };
  patient?: {
    id: number;
    name: string;
    email: string;
    dob: string;
    gender: string;
    bloodGroup?: string;
    allergies?: string;
    medicalHistory?: string;
  };
}
