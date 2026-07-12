import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../db/prisma.ts';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.ts';

const router = Router();

// Zod schemas for input validation
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(6, 'Phone number must be at least 6 characters'),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be in YYYY-MM-DD format'),
  gender: z.enum(['male', 'female', 'other']),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const bookAppointmentSchema = z.object({
  doctorId: z.number({ message: 'Doctor ID is required' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z.string().min(3, 'Time is required'),
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
  notes: z.string().optional(),
});

const payInvoiceSchema = z.object({
  invoiceId: z.number({ message: 'Invoice ID is required' }),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['cash', 'card', 'upi']),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().min(6, 'Phone must be at least 6 characters').optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be in YYYY-MM-DD format').optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  allergies: z.string().optional(),
  medicalHistory: z.string().optional(),
});

// Helper to get or assert clinical patient entity linked to logged-in user email
async function getPatientOrThrow(email: string) {
  const patient = await prisma.patient.findFirst({
    where: { email: email.toLowerCase() },
  });
  if (!patient) {
    throw new AppError('Clinical patient profile not found for this account. Please contact clinic staff.', 404);
  }
  return patient;
}

// ==========================================
// PUBLIC AUTH ENDPOINTS
// ==========================================

/**
 * Register a new patient user and matching clinical patient
 */
router.post('/auth/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { name, email, password, phone, dob, gender, bloodGroup, address } = parsed.data;

    // Check user table
    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      throw new AppError('A user account with this email already exists.', 400);
    }

    // Check if patient table already has this patient (registered by staff before)
    let patient = await prisma.patient.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!patient) {
      // Create new patient record
      patient = await prisma.patient.create({
        data: {
          name,
          email: email.toLowerCase(),
          phone,
          dob,
          gender,
          bloodGroup: bloodGroup || null,
          address: address || null,
        },
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with 'patient' role
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: 'patient',
        uid: `patient_${crypto.randomUUID()}`,
        clinicId: patient.clinicId || null,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.role, user.email);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.status(211).json({
      status: 'success',
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role, clinicId: user.clinicId },
        patient,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Log in a patient user
 */
router.post('/auth/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || user.role !== 'patient' || !user.password) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    // Get clinical patient
    const patient = await prisma.patient.findFirst({
      where: { email: email.toLowerCase() },
    });

    const accessToken = generateAccessToken(user.id, user.role, user.email);
    const refreshToken = generateRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role, clinicId: user.clinicId },
        patient: patient || null,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reset password (Forgot password developer sandbox endpoint)
 */
router.post('/auth/forgot-password', async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { email, newPassword } = parsed.data;

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), role: 'patient' },
    });

    if (!user) {
      throw new AppError('No patient account found with this email.', 404);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// SECURED PATIENT PORTAL ENDPOINTS
// ==========================================
router.use(requireAuth);

/**
 * Get profile (both account User details and Patient clinical demographics)
 */
router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user || req.user.role !== 'patient') {
      throw new AppError('Patient profile access unauthorized', 403);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, clinicId: true, createdAt: true },
    });

    const patient = await prisma.patient.findFirst({
      where: { email: req.user.email.toLowerCase() },
    });

    res.status(200).json({
      user,
      patient,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update patient profile demographics
 */
router.put('/profile', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const patient = await getPatientOrThrow(req.user.email);

    const updatedPatient = await prisma.patient.update({
      where: { id: patient.id },
      data: {
        phone: parsed.data.phone !== undefined ? parsed.data.phone : patient.phone,
        dob: parsed.data.dob !== undefined ? parsed.data.dob : patient.dob,
        gender: parsed.data.gender !== undefined ? parsed.data.gender : patient.gender,
        bloodGroup: parsed.data.bloodGroup !== undefined ? parsed.data.bloodGroup : patient.bloodGroup,
        address: parsed.data.address !== undefined ? parsed.data.address : patient.address,
        allergies: parsed.data.allergies !== undefined ? parsed.data.allergies : patient.allergies,
        medicalHistory: parsed.data.medicalHistory !== undefined ? parsed.data.medicalHistory : patient.medicalHistory,
      },
    });

    if (parsed.data.name) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { name: parsed.data.name },
      });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, clinicId: true },
    });

    res.status(200).json({
      user: updatedUser,
      patient: updatedPatient,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Medical History / EMR records
 */
router.get('/medical-history', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const patient = await getPatientOrThrow(req.user.email);

    const records = await prisma.emrRecord.findMany({
      where: { patientId: patient.id },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            doctorProfile: {
              select: {
                specialization: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.status(200).json(records);
  } catch (error) {
    next(error);
  }
});

/**
 * Get prescriptions (extracted from EMR records list)
 */
router.get('/prescriptions', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const patient = await getPatientOrThrow(req.user.email);

    // Fetch EMR records with prescriptions
    const records = await prisma.emrRecord.findMany({
      where: {
        patientId: patient.id,
        NOT: { prescriptions: null },
      },
      include: {
        doctor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Aggregate prescription lists
    const prescriptions = records.map((record) => {
      let parsedPrescriptions = [];
      try {
        if (record.prescriptions) {
          parsedPrescriptions = JSON.parse(record.prescriptions);
        }
      } catch (e) {
        // If string but not JSON
        parsedPrescriptions = [{ medication: record.prescriptions, instructions: 'As prescribed' }];
      }

      return {
        emrId: record.id,
        date: record.date,
        diagnosis: record.diagnosis,
        doctor: record.doctor,
        items: parsedPrescriptions,
      };
    });

    res.status(200).json(prescriptions);
  } catch (error) {
    next(error);
  }
});

/**
 * Get Lab Reports
 */
router.get('/lab-reports', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const patient = await getPatientOrThrow(req.user.email);

    const labOrders = await prisma.labOrder.findMany({
      where: { patientId: patient.id },
      include: {
        test: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    res.status(200).json(labOrders);
  } catch (error) {
    next(error);
  }
});

/**
 * Get all doctors with their availability profiles
 */
router.get('/doctors', async (req: AuthRequest, res, next) => {
  try {
    const doctors = await prisma.user.findMany({
      where: { role: 'doctor' },
      select: {
        id: true,
        name: true,
        email: true,
        doctorProfile: {
          select: {
            specialization: true,
            experienceYrs: true,
            biography: true,
            schedules: true,
          },
        },
      },
    });

    res.status(200).json(doctors);
  } catch (error) {
    next(error);
  }
});

/**
 * Get Appointments
 */
router.get('/appointments', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const patient = await getPatientOrThrow(req.user.email);

    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            doctorProfile: {
              select: {
                specialization: true,
              },
            },
          },
        },
      },
      orderBy: [
        { date: 'desc' },
        { time: 'desc' },
      ],
    });

    res.status(200).json(appointments);
  } catch (error) {
    next(error);
  }
});

/**
 * Online Appointment Booking
 */
router.post('/appointments/book', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    
    const parsed = bookAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { doctorId, date, time, reason, notes } = parsed.data;
    const patient = await getPatientOrThrow(req.user.email);

    // Verify doctor exists
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
    });

    if (!doctor || doctor.role !== 'doctor') {
      throw new AppError('Selected doctor not found or invalid', 404);
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId,
        date,
        time,
        reason,
        notes: notes || null,
        status: 'scheduled',
        clinicId: patient.clinicId || doctor.clinicId || null,
      },
    });

    // Create a notification for the patient
    await prisma.notification.create({
      data: {
        patientId: patient.id,
        title: 'Appointment Scheduled Successfully',
        message: `Your appointment with Dr. ${doctor.name} on ${date} at ${time} has been scheduled.`,
        type: 'APPOINTMENT_REMINDER',
        channel: 'IN_APP',
        status: 'SENT',
        clinicId: appointment.clinicId,
      },
    });

    // Create a notification for the doctor
    await prisma.notification.create({
      data: {
        userId: doctor.id,
        title: 'New Online Appointment Booked',
        message: `Patient ${patient.name} has booked an online appointment for ${date} at ${time}.`,
        type: 'APPOINTMENT_REMINDER',
        channel: 'IN_APP',
        status: 'SENT',
        clinicId: appointment.clinicId,
      },
    });

    res.status(211).json({
      status: 'success',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Invoice History
 */
router.get('/invoices', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const patient = await getPatientOrThrow(req.user.email);

    const invoices = await prisma.invoice.findMany({
      where: { patientId: patient.id },
      include: {
        items: true,
        payments: true,
        doctor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.status(200).json(invoices);
  } catch (error) {
    next(error);
  }
});

/**
 * Get Payment History
 */
router.get('/payments', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const patient = await getPatientOrThrow(req.user.email);

    const payments = await prisma.payment.findMany({
      where: {
        invoice: {
          patientId: patient.id,
        },
      },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            totalAmount: true,
            date: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    res.status(200).json(payments);
  } catch (error) {
    next(error);
  }
});

/**
 * Pay Invoice (simulates a payments gateway check and records a payment)
 */
router.post('/payments/pay', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    
    const parsed = payInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { invoiceId, amount, paymentMethod, referenceNo, notes } = parsed.data;
    const patient = await getPatientOrThrow(req.user.email);

    // Verify invoice exists and belongs to this patient
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice || invoice.patientId !== patient.id) {
      throw new AppError('Invoice not found or unauthorized', 404);
    }

    if (invoice.status === 'paid') {
      throw new AppError('Invoice is already fully paid.', 400);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Create the payment record
    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount,
        paymentDate: todayStr,
        paymentMethod,
        referenceNo: referenceNo || `REF_${Math.floor(Math.random() * 10000000)}`,
        notes: notes || 'Online portal payment',
      },
    });

    // Update invoice status and amount paid
    const newAmountPaid = invoice.amountPaid + amount;
    const isFullyPaid = newAmountPaid >= invoice.totalAmount;

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status: isFullyPaid ? 'paid' : 'partially_paid',
        paymentMethod: paymentMethod,
      },
    });

    // Send a notification
    await prisma.notification.create({
      data: {
        patientId: patient.id,
        title: 'Payment Received Successfully',
        message: `Your payment of $${amount} for Invoice #${invoice.invoiceNumber} has been received. Status: ${updatedInvoice.status.toUpperCase()}`,
        type: 'PAYMENT_REMINDER',
        channel: 'IN_APP',
        status: 'SENT',
        clinicId: invoice.clinicId,
      },
    });

    res.status(211).json({
      status: 'success',
      data: {
        payment,
        invoice: updatedInvoice,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Notifications
 */
router.get('/notifications', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const patient = await getPatientOrThrow(req.user.email);

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { patientId: patient.id },
          { userId: req.user.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
});

/**
 * Mark notification as read
 */
router.post('/notifications/:id/read', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const notificationId = parseInt(req.params.id, 10);
    if (isNaN(notificationId)) {
      throw new AppError('Invalid notification ID', 400);
    }

    const patient = await prisma.patient.findFirst({
      where: { email: req.user.email.toLowerCase() },
    });

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    // Verify ownership
    const isOwner = 
      (notification.userId && notification.userId === req.user.id) ||
      (notification.patientId && patient && notification.patientId === patient.id);

    if (!isOwner) {
      throw new AppError('Unauthorized notification action', 403);
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'READ' },
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * Get Documents available for download (lab reports, EMR attachments, uploaded records)
 */
router.get('/documents', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const patient = await getPatientOrThrow(req.user.email);

    // Get patient clinical files
    const files = await prisma.clinicFile.findMany({
      where: {
        patientId: patient.id,
        isFolder: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(files);
  } catch (error) {
    next(error);
  }
});

/**
 * Download document payload / content
 */
router.get('/documents/:id/download', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const fileId = parseInt(req.params.id, 10);
    if (isNaN(fileId)) {
      throw new AppError('Invalid document ID', 400);
    }

    const patient = await getPatientOrThrow(req.user.email);

    const doc = await prisma.clinicFile.findUnique({
      where: { id: fileId },
    });

    if (!doc) {
      throw new AppError('Document not found', 404);
    }

    // Secure verify that the file belongs to this patient
    if (doc.patientId !== patient.id) {
      throw new AppError('Unauthorized access to this document', 403);
    }

    res.status(200).json({
      id: doc.id,
      name: doc.name,
      fileType: doc.fileType,
      mimeType: doc.mimeType,
      size: doc.size,
      content: doc.content, // base64 payload or inline string
    });
  } catch (error) {
    next(error);
  }
});

export const portalRouter = router;
