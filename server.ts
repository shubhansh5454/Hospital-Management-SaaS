import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import { users, patients, appointments } from "./src/db/schema.ts";
import { requireAuth, AuthRequest, requireRoles } from "./src/middleware/auth.ts";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // API ROBUST TWO-LAYER ERROR HANDLING WRAPPER helper
  const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error("API error encountered:", err);
      res.status(500).json({ error: err.message || "An internal server error occurred" });
    });
  };

  // API: Get Current User Profile
  app.get("/api/auth/me", requireAuth, asyncHandler(async (req: AuthRequest, res: express.Response) => {
    res.json(req.user);
  }));

  // API: Update Current User Role (for testing roles easily in the UI)
  app.post("/api/auth/role", requireAuth, asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const roleSchema = z.object({
      role: z.enum(['admin', 'doctor', 'receptionist', 'patient']),
    });
    
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid role specified" });
    }

    await db.update(users)
      .set({ role: parsed.data.role })
      .where(eq(users.id, req.user!.id));

    res.json({ message: "Role updated successfully", role: parsed.data.role });
  }));

  // API: List Patients
  app.get("/api/patients", requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const allPatients = await db.select().from(patients).orderBy(desc(patients.createdAt));
    res.json(allPatients);
  }));

  // API: Create Patient
  app.post("/api/patients", requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const patientSchema = z.object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      email: z.string().email("Invalid email address"),
      phone: z.string().min(6, "Phone must be at least 6 characters"),
      dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
      gender: z.string().min(1, "Gender is required"),
      bloodGroup: z.string().optional(),
      address: z.string().optional(),
      medicalHistory: z.string().optional(),
    });

    const parsed = patientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const [newPatient] = await db.insert(patients).values(parsed.data).returning();
    res.status(211).json(newPatient); // 201 Created
  }));

  // API: List Doctors
  app.get("/api/doctors", requireAuth, asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const allDoctors = await db.select().from(users).where(eq(users.role, 'doctor'));
    res.json(allDoctors);
  }));

  // API: List Appointments
  app.get("/api/appointments", requireAuth, asyncHandler(async (req: AuthRequest, res: express.Response) => {
    // If the user is a patient, they can only see their own appointments (via doctor linking or filtering).
    // In our SaaS: 
    // - admin, receptionist can see all appointments
    // - doctor can see appointments assigned to them
    // - patient can see appointments assigned to them (mapped via clinical profiles)
    let queryResult;

    if (req.user!.role === 'admin' || req.user!.role === 'receptionist') {
      queryResult = await db.select({
        id: appointments.id,
        date: appointments.date,
        time: appointments.time,
        status: appointments.status,
        reason: appointments.reason,
        notes: appointments.notes,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        patient: {
          id: patients.id,
          name: patients.name,
          email: patients.email,
        },
        doctor: {
          id: users.id,
          name: users.name,
          email: users.email,
        }
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(appointments.doctorId, users.id))
      .orderBy(desc(appointments.date));
    } else if (req.user!.role === 'doctor') {
      queryResult = await db.select({
        id: appointments.id,
        date: appointments.date,
        time: appointments.time,
        status: appointments.status,
        reason: appointments.reason,
        notes: appointments.notes,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        patient: {
          id: patients.id,
          name: patients.name,
          email: patients.email,
        },
        doctor: {
          id: users.id,
          name: users.name,
          email: users.email,
        }
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(appointments.doctorId, users.id))
      .where(eq(appointments.doctorId, req.user!.id))
      .orderBy(desc(appointments.date));
    } else {
      // Patients look up their appointments by searching for patient records matching their authenticated email
      const matchedPatients = await db.select().from(patients).where(eq(patients.email, req.user!.email));
      if (matchedPatients.length === 0) {
        queryResult = [];
      } else {
        const patientIds = matchedPatients.map(p => p.id);
        queryResult = await db.select({
          id: appointments.id,
          date: appointments.date,
          time: appointments.time,
          status: appointments.status,
          reason: appointments.reason,
          notes: appointments.notes,
          patientId: appointments.patientId,
          doctorId: appointments.doctorId,
          patient: {
            id: patients.id,
            name: patients.name,
            email: patients.email,
          },
          doctor: {
            id: users.id,
            name: users.name,
            email: users.email,
          }
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(users, eq(appointments.doctorId, users.id))
        .where(eq(appointments.patientId, patientIds[0])) // Simplification: use primary patient match
        .orderBy(desc(appointments.date));
      }
    }

    res.json(queryResult);
  }));

  // API: Create Appointment
  app.post("/api/appointments", requireAuth, asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const appointmentSchema = z.object({
      patientId: z.number(),
      doctorId: z.number(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
      time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
      reason: z.string().min(2, "Reason must be at least 2 characters"),
      notes: z.string().optional(),
    });

    const parsed = appointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const [newAppointment] = await db.insert(appointments).values(parsed.data).returning();
    res.status(211).json(newAppointment);
  }));

  // API: Update Appointment Status
  app.put("/api/appointments/:id", requireAuth, asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const statusSchema = z.object({
      status: z.enum(['scheduled', 'completed', 'cancelled']),
    });

    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid appointment ID" });
    }

    await db.update(appointments)
      .set({ status: parsed.data.status })
      .where(eq(appointments.id, id));

    res.json({ message: "Appointment updated successfully", status: parsed.data.status });
  }));

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hospital SaaS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
