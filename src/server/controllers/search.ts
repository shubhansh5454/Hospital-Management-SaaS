import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.ts';

export class SearchController {
  /**
   * Global Search across Patients, Doctors, Medicines, Appointments, Invoices (Bills), Reports, and Lab Tests
   */
  public static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const q = (req.query.q as string || '').trim();
      const typeParam = req.query.type as string || 'all';
      
      const user = (req as any).user;
      const userClinicId = user?.clinicId;
      const userRole = user?.role;

      let filterClinicId: number | undefined = undefined;

      if (userRole !== 'superadmin') {
        filterClinicId = userClinicId || undefined;
      } else if (req.query.clinicId) {
        filterClinicId = parseInt(req.query.clinicId as string, 10);
      }

      // If search query is empty, return empty results or basic recent items placeholder
      if (!q) {
        return res.status(200).json({
          patients: [],
          doctors: [],
          medicines: [],
          appointments: [],
          bills: [],
          reports: [],
          labTests: []
        });
      }

      const selectedTypes = typeParam === 'all' 
        ? ['patients', 'doctors', 'medicines', 'appointments', 'bills', 'reports', 'labTests'] 
        : typeParam.split(',');

      const results: any = {};

      // 1. Search Patients
      if (selectedTypes.includes('patients')) {
        results.patients = await prisma.patient.findMany({
          where: {
            AND: [
              filterClinicId ? { clinicId: filterClinicId } : {},
              {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                  { phone: { contains: q, mode: 'insensitive' } },
                  { medicalHistory: { contains: q, mode: 'insensitive' } },
                  { allergies: { contains: q, mode: 'insensitive' } }
                ]
              }
            ]
          },
          take: 8,
          orderBy: { name: 'asc' }
        });
      }

      // 2. Search Doctors
      if (selectedTypes.includes('doctors')) {
        results.doctors = await prisma.user.findMany({
          where: {
            role: 'doctor',
            AND: [
              filterClinicId ? { clinicId: filterClinicId } : {},
              {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                  {
                    doctorProfile: {
                      specialization: { contains: q, mode: 'insensitive' }
                    }
                  }
                ]
              }
            ]
          },
          include: {
            doctorProfile: true
          },
          take: 8,
          orderBy: { name: 'asc' }
        });
      }

      // 3. Search Medicines
      if (selectedTypes.includes('medicines')) {
        results.medicines = await prisma.medicine.findMany({
          where: {
            AND: [
              filterClinicId ? { clinicId: filterClinicId } : {},
              {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { code: { contains: q, mode: 'insensitive' } },
                  { category: { contains: q, mode: 'insensitive' } }
                ]
              }
            ]
          },
          take: 8,
          orderBy: { name: 'asc' }
        });
      }

      // 4. Search Appointments
      if (selectedTypes.includes('appointments')) {
        results.appointments = await prisma.appointment.findMany({
          where: {
            AND: [
              filterClinicId ? { clinicId: filterClinicId } : {},
              {
                OR: [
                  { notes: { contains: q, mode: 'insensitive' } },
                  { date: { contains: q, mode: 'insensitive' } },
                  {
                    patient: {
                      name: { contains: q, mode: 'insensitive' }
                    }
                  },
                  {
                    doctor: {
                      name: { contains: q, mode: 'insensitive' }
                    }
                  }
                ]
              }
            ]
          },
          include: {
            patient: {
              select: { id: true, name: true, email: true }
            },
            doctor: {
              select: { id: true, name: true, email: true }
            }
          },
          take: 8,
          orderBy: { date: 'desc' }
        });
      }

      // 5. Search Bills (Invoices)
      if (selectedTypes.includes('bills')) {
        results.bills = await prisma.invoice.findMany({
          where: {
            AND: [
              filterClinicId ? { patient: { clinicId: filterClinicId } } : {},
              {
                OR: [
                  { invoiceNumber: { contains: q, mode: 'insensitive' } },
                  { status: { contains: q, mode: 'insensitive' } },
                  {
                    patient: {
                      name: { contains: q, mode: 'insensitive' }
                    }
                  }
                ]
              }
            ]
          },
          include: {
            patient: {
              select: { id: true, name: true, email: true }
            }
          },
          take: 8,
          orderBy: { date: 'desc' }
        });
      }

      // 6. Search Reports (EMR Records & Lab Orders)
      if (selectedTypes.includes('reports')) {
        const [emrRecords, labOrders] = await Promise.all([
          // EMR Records
          prisma.emrRecord.findMany({
            where: {
              AND: [
                filterClinicId ? { patient: { clinicId: filterClinicId } } : {},
                {
                  OR: [
                    { diagnosis: { contains: q, mode: 'insensitive' } },
                    { soapSubjective: { contains: q, mode: 'insensitive' } },
                    { soapAssessment: { contains: q, mode: 'insensitive' } },
                    {
                      patient: {
                        name: { contains: q, mode: 'insensitive' }
                      }
                    },
                    {
                      doctor: {
                        name: { contains: q, mode: 'insensitive' }
                      }
                    }
                  ]
                }
              ]
            },
            include: {
              patient: {
                select: { id: true, name: true, email: true }
              },
              doctor: {
                select: { id: true, name: true }
              }
            },
            take: 5,
            orderBy: { date: 'desc' }
          }),
          // Lab Orders
          prisma.labOrder.findMany({
            where: {
              AND: [
                filterClinicId ? { clinicId: filterClinicId } : {},
                {
                  OR: [
                    { status: { contains: q, mode: 'insensitive' } },
                    { comments: { contains: q, mode: 'insensitive' } },
                    {
                      patient: {
                        name: { contains: q, mode: 'insensitive' }
                      }
                    },
                    {
                      test: {
                        name: { contains: q, mode: 'insensitive' }
                      }
                    }
                  ]
                }
              ]
            },
            include: {
              patient: {
                select: { id: true, name: true, email: true }
              },
              test: true
            },
            take: 5,
            orderBy: { bookingDate: 'desc' }
          })
        ]);

        // Map EMR Records and Lab Orders to a unified Report object structure
        const formattedEmr = emrRecords.map(rec => ({
          id: `emr-${rec.id}`,
          originalId: rec.id,
          type: 'EMR_RECORD',
          title: `EMR Diagnosis: ${rec.diagnosis}`,
          date: rec.date,
          patientName: rec.patient.name,
          patientId: rec.patientId,
          doctorName: rec.doctor.name,
          summary: rec.soapSubjective || 'No additional SOAP notes',
          status: 'COMPLETED'
        }));

        const formattedLab = labOrders.map(ord => ({
          id: `lab-${ord.id}`,
          originalId: ord.id,
          type: 'LAB_ORDER',
          title: `Lab Test: ${ord.test.name}`,
          date: ord.bookingDate,
          patientName: ord.patient.name,
          patientId: ord.patientId,
          doctorName: ord.validatedBy || 'Pending verification',
          summary: ord.comments || `Status: ${ord.status}`,
          status: ord.status
        }));

        results.reports = [...formattedEmr, ...formattedLab].slice(0, 8);
      }

      // 7. Search Lab Tests
      if (selectedTypes.includes('labTests')) {
        results.labTests = await prisma.labTest.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } }
            ]
          },
          take: 8,
          orderBy: { name: 'asc' }
        });
      }

      res.status(200).json({
        patients: results.patients || [],
        doctors: results.doctors || [],
        medicines: results.medicines || [],
        appointments: results.appointments || [],
        bills: results.bills || [],
        reports: results.reports || [],
        labTests: results.labTests || []
      });

    } catch (error) {
      next(error);
    }
  }
}
