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
  createdAt: Date;
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
