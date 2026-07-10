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
