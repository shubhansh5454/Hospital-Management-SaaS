import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table with roles
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name').notNull(),
  password: text('password'),
  refreshToken: text('refresh_token'),
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
  allergies: text('allergies'),
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

// Doctor Profiles table
export const doctorProfiles = pgTable('doctor_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  specialization: text('specialization').notNull(),
  biography: text('biography'),
  experienceYrs: integer('experience_yrs').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Doctor Availabilities table
export const doctorAvailabilities = pgTable('doctor_availabilities', {
  id: serial('id').primaryKey(),
  doctorProfileId: integer('doctor_profile_id')
    .references(() => doctorProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0 (Sunday) to 6 (Saturday)
  startTime: text('start_time').notNull(), // Format: HH:MM
  endTime: text('end_time').notNull(), // Format: HH:MM
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Doctor Leaves table
export const doctorLeaves = pgTable('doctor_leaves', {
  id: serial('id').primaryKey(),
  doctorProfileId: integer('doctor_profile_id')
    .references(() => doctorProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  startDate: text('start_date').notNull(), // Format: YYYY-MM-DD
  endDate: text('end_date').notNull(), // Format: YYYY-MM-DD
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations setup
export const usersRelations = relations(users, ({ one, many }) => ({
  appointments: many(appointments),
  emrRecords: many(emrRecords),
  doctorProfile: one(doctorProfiles, {
    fields: [users.id],
    references: [doctorProfiles.userId],
  }),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
  emrRecords: many(emrRecords),
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

export const doctorProfilesRelations = relations(doctorProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [doctorProfiles.userId],
    references: [users.id],
  }),
  schedules: many(doctorAvailabilities),
  leaves: many(doctorLeaves),
}));

export const doctorAvailabilitiesRelations = relations(doctorAvailabilities, ({ one }) => ({
  doctorProfile: one(doctorProfiles, {
    fields: [doctorAvailabilities.doctorProfileId],
    references: [doctorProfiles.id],
  }),
}));

export const doctorLeavesRelations = relations(doctorLeaves, ({ one }) => ({
  doctorProfile: one(doctorProfiles, {
    fields: [doctorLeaves.doctorProfileId],
    references: [doctorProfiles.id],
  }),
}));

export const emrRecords = pgTable('emr_records', {
  id: serial('id').primaryKey(),
  patientId: integer('patient_id')
    .references(() => patients.id, { onDelete: 'cascade' })
    .notNull(),
  doctorId: integer('doctor_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  appointmentId: integer('appointment_id')
    .references(() => appointments.id, { onDelete: 'set null' }),
  date: text('date').notNull(),
  bloodPressure: text('blood_pressure'),
  heartRate: integer('heart_rate'),
  temperature: text('temperature'),
  respiratoryRate: integer('respiratory_rate'),
  weight: text('weight'),
  height: text('height'),
  bmi: text('bmi'),
  oxygenSaturation: integer('oxygen_saturation'),
  diagnosis: text('diagnosis').notNull(),
  soapSubjective: text('soap_subjective'),
  soapObjective: text('soap_objective'),
  soapAssessment: text('soap_assessment'),
  soapPlan: text('soap_plan'),
  prescriptions: text('prescriptions'),
  followUpNotes: text('follow_up_notes'),
  followUpDate: text('follow_up_date'),
  attachments: text('attachments'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emrRecordsRelations = relations(emrRecords, ({ one }) => ({
  patient: one(patients, {
    fields: [emrRecords.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [emrRecords.doctorId],
    references: [users.id],
  }),
  appointment: one(appointments, {
    fields: [emrRecords.appointmentId],
    references: [appointments.id],
  }),
}));
