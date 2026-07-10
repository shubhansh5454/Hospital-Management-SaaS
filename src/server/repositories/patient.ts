import { prisma } from '../../db/prisma.ts';
import { CreatePatientInput, UpdatePatientInput } from '../validation/patient.ts';

export class PatientRepository {
  /**
   * Create a new patient
   */
  public static async create(data: CreatePatientInput, clinicId?: number) {
    return prisma.patient.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        dob: data.dob,
        gender: data.gender,
        bloodGroup: data.bloodGroup ?? null,
        address: data.address ?? null,
        medicalHistory: data.medicalHistory ?? null,
        allergies: data.allergies ?? null,
        clinicId: clinicId || null,
      },
    });
  }

  /**
   * Find all patients ordered by creation date descending
   */
  public static async findAll(clinicId?: number) {
    return prisma.patient.findMany({
      where: clinicId ? { clinicId } : {},
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find a patient by ID
   */
  public static async findById(id: number) {
    return prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            date: 'desc',
          },
        },
        emrRecords: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * Find a patient by email
   */
  public static async findByEmail(email: string) {
    return prisma.patient.findFirst({
      where: {
        email: email.toLowerCase(),
      },
    });
  }

  /**
   * Update a patient by ID
   */
  public static async update(id: number, data: UpdatePatientInput) {
    return prisma.patient.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        dob: data.dob,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        address: data.address,
        medicalHistory: data.medicalHistory,
        allergies: data.allergies,
      },
    });
  }

  /**
   * Delete a patient by ID
   */
  public static async delete(id: number) {
    return prisma.patient.delete({
      where: { id },
    });
  }
}
