import { prisma } from '../../db/prisma.ts';
import { CreateEmrRecordInput, UpdateEmrRecordInput } from '../validation/emr.ts';

export class EmrRepository {
  /**
   * Create a new EMR Record
   */
  public static async create(doctorId: number, data: CreateEmrRecordInput) {
    return prisma.emrRecord.create({
      data: {
        patientId: data.patientId,
        doctorId: doctorId,
        appointmentId: data.appointmentId ?? null,
        date: data.date,
        bloodPressure: data.bloodPressure ?? null,
        heartRate: data.heartRate ?? null,
        temperature: data.temperature ?? null,
        respiratoryRate: data.respiratoryRate ?? null,
        weight: data.weight ?? null,
        height: data.height ?? null,
        bmi: data.bmi ?? null,
        oxygenSaturation: data.oxygenSaturation ?? null,
        diagnosis: data.diagnosis,
        soapSubjective: data.soapSubjective ?? null,
        soapObjective: data.soapObjective ?? null,
        soapAssessment: data.soapAssessment ?? null,
        soapPlan: data.soapPlan ?? null,
        prescriptions: data.prescriptions ?? null,
        followUpNotes: data.followUpNotes ?? null,
        followUpDate: data.followUpDate || null,
        attachments: data.attachments ?? null,
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            dob: true,
            gender: true,
          },
        },
      },
    });
  }

  /**
   * Find EMR records by Patient ID
   */
  public static async findAllByPatientId(patientId: number) {
    return prisma.emrRecord.findMany({
      where: { patientId },
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
    });
  }

  /**
   * Find a single EMR record by ID
   */
  public static async findById(id: number) {
    return prisma.emrRecord.findUnique({
      where: { id },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            dob: true,
            gender: true,
            bloodGroup: true,
            allergies: true,
            medicalHistory: true,
          },
        },
      },
    });
  }

  /**
   * Update an EMR Record
   */
  public static async update(id: number, data: UpdateEmrRecordInput) {
    return prisma.emrRecord.update({
      where: { id },
      data: {
        appointmentId: data.appointmentId !== undefined ? data.appointmentId : undefined,
        date: data.date,
        bloodPressure: data.bloodPressure,
        heartRate: data.heartRate,
        temperature: data.temperature,
        respiratoryRate: data.respiratoryRate,
        weight: data.weight,
        height: data.height,
        bmi: data.bmi,
        oxygenSaturation: data.oxygenSaturation,
        diagnosis: data.diagnosis,
        soapSubjective: data.soapSubjective,
        soapObjective: data.soapObjective,
        soapAssessment: data.soapAssessment,
        soapPlan: data.soapPlan,
        prescriptions: data.prescriptions,
        followUpNotes: data.followUpNotes,
        followUpDate: data.followUpDate || null,
        attachments: data.attachments,
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Delete an EMR Record
   */
  public static async delete(id: number) {
    return prisma.emrRecord.delete({
      where: { id },
    });
  }
}
