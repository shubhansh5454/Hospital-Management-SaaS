import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table with roles
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').$type<'admin' | 'doctor' | 'receptionist' | 'patient'>().default('patient').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Patients table
export const patients = pgTable('patients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  dob: text('dob').notNull(), // Format: YYYY-MM-DD
  gender: text('gender').notNull(),
  bloodGroup: text('blood_group'),
  address: text('address'),
  medicalHistory: text('medical_history'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Appointments table
export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  patientId: integer('patient_id')
    .references(() => patients.id, { onDelete: 'cascade' })
    .notNull(),
  doctorId: integer('doctor_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  date: text('date').notNull(), // Format: YYYY-MM-DD
  time: text('time').notNull(), // Format: HH:MM
  status: text('status').$type<'scheduled' | 'completed' | 'cancelled'>().default('scheduled').notNull(),
  reason: text('reason').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations setup
export const usersRelations = relations(users, ({ many }) => ({
  appointments: many(appointments),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [appointments.doctorId],
    references: [users.id],
  }),
}));
