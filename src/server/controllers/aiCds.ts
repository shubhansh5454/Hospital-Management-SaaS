import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.ts';
import { AiCdsService } from '../services/aiCds.ts';
import { AppError } from '../middleware/errorHandler.ts';

// Dynamic type definitions for Express Request with Auth context
interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    clinicId?: number;
  };
}

export class AiCdsController {
  // Generate Clinical Decision Support Analysis
  public static async analyze(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { patientId, symptoms, proposedMedications, appointmentId } = req.body;

      if (!patientId) {
        throw new AppError('patientId is required for clinical context', 400);
      }

      // 1. Fetch Patient details for allergies, medical history, age, gender
      const patient = await prisma.patient.findUnique({
        where: { id: Number(patientId) },
        include: {
          emrRecords: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!patient) {
        throw new AppError('Patient record not found', 404);
      }

      // Calculate Age from DOB (YYYY-MM-DD)
      let ageStr = 'N/A';
      if (patient.dob) {
        const birthDate = new Date(patient.dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        ageStr = `${age} years old`;
      }

      // Fetch existing current medications from latest EMR Record
      let currentMedications = 'None recorded';
      const latestEmr = patient.emrRecords[0];
      if (latestEmr && latestEmr.prescriptions) {
        try {
          const parsed = JSON.parse(latestEmr.prescriptions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentMedications = parsed.map((p: any) => `${p.medication} (${p.dosage || ''} ${p.frequency || ''})`).join(', ');
          }
        } catch (e) {
          currentMedications = 'None recorded';
        }
      }

      const clinicalContext = {
        age: ageStr,
        gender: patient.gender || 'N/A',
        medicalHistory: patient.medicalHistory || 'None reported',
        allergies: patient.allergies || 'None reported',
        currentMedications,
        symptoms: symptoms || 'None reported',
        proposedMedications: proposedMedications || 'None proposed',
      };

      // 2. Run CDS analysis
      const analysisResult = await AiCdsService.generateSuggestions(clinicalContext);

      // 3. Save as a transient unsaved suggestion first, requiring human/doctor approval
      const doctorId = req.user?.id || 1; // Fallback to 1 if not authenticated for sandbox/test safety
      
      const newSuggestion = await prisma.aICdsSuggestion.create({
        data: {
          patientId: patient.id,
          doctorId,
          appointmentId: appointmentId ? Number(appointmentId) : null,
          symptomsText: symptoms || 'None',
          symptomAnalysis: JSON.stringify(analysisResult.symptomAnalysis),
          differentialDiagnosis: JSON.stringify(analysisResult.differentialDiagnosis),
          drugInteractions: JSON.stringify(analysisResult.drugInteractions),
          allergyWarnings: JSON.stringify(analysisResult.allergyWarnings),
          duplicateMedicines: JSON.stringify(analysisResult.duplicateMedicines),
          dosageSuggestions: JSON.stringify(analysisResult.dosageSuggestions),
          clinicalGuidelines: JSON.stringify(analysisResult.clinicalGuidelines),
          riskScore: JSON.stringify(analysisResult.riskScore),
          explainability: JSON.stringify(analysisResult.explainability),
          isApproved: false,
        },
      });

      res.status(200).json({
        status: 'success',
        data: {
          suggestionId: newSuggestion.id,
          ...analysisResult,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Save/Approve dynamic suggestion (Sign-off)
  public static async approve(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { savedPrescription } = req.body; // Approved prescriptions to sync to EMR

      const suggestion = await prisma.aICdsSuggestion.findUnique({
        where: { id: Number(id) },
      });

      if (!suggestion) {
        throw new AppError('Clinical suggestion not found', 404);
      }

      const doctorId = req.user?.id || 1;

      // Update approval status
      const updated = await prisma.aICdsSuggestion.update({
        where: { id: Number(id) },
        data: {
          isApproved: true,
          approvedBy: doctorId,
          approvedAt: new Date(),
          savedPrescription: savedPrescription ? JSON.stringify(savedPrescription) : null,
        },
      });

      // If prescription was approved, automatically seed/sync it as a new EMR Record for the patient!
      if (savedPrescription) {
        const patientId = suggestion.patientId;
        const diagnosisArray = JSON.parse(suggestion.differentialDiagnosis || '[]');
        const primaryDiagnosis = diagnosisArray[0]?.disease || 'Unspecified Condition';

        await prisma.emrRecord.create({
          data: {
            patientId,
            doctorId,
            appointmentId: suggestion.appointmentId,
            date: new Date().toISOString().split('T')[0],
            diagnosis: primaryDiagnosis,
            prescriptions: JSON.stringify(savedPrescription),
            soapAssessment: 'Clinical diagnosis supported by AI Clinical Decision Support analysis.',
            soapPlan: 'Medications adjusted and approved by clinical provider after AI safety checks.',
          },
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Clinical decision support analysis approved and synchronized with patient EMR record.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get Suggestions history for patient or clinician
  public static async getHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.query;

      const whereClause: any = {};
      if (patientId) {
        whereClause.patientId = Number(patientId);
      }

      const suggestions = await prisma.aICdsSuggestion.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: { id: true, name: true, email: true },
          },
          doctor: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      // Decode JSON fields before returning to frontend
      const formatted = suggestions.map((s) => ({
        ...s,
        symptomAnalysis: JSON.parse(s.symptomAnalysis),
        differentialDiagnosis: JSON.parse(s.differentialDiagnosis),
        drugInteractions: JSON.parse(s.drugInteractions),
        allergyWarnings: JSON.parse(s.allergyWarnings),
        duplicateMedicines: JSON.parse(s.duplicateMedicines),
        dosageSuggestions: JSON.parse(s.dosageSuggestions),
        clinicalGuidelines: JSON.parse(s.clinicalGuidelines),
        riskScore: JSON.parse(s.riskScore),
        explainability: JSON.parse(s.explainability),
        savedPrescription: s.savedPrescription ? JSON.parse(s.savedPrescription) : null,
      }));

      res.status(200).json({
        status: 'success',
        data: formatted,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get active configurations (AI Provider configs + prompt templates)
  public static async getConfigs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const providers = await prisma.aICdsProviderConfig.findMany();
      const templates = await prisma.aICdsPromptTemplate.findMany({
        orderBy: { updatedAt: 'desc' },
      });

      res.status(200).json({
        status: 'success',
        data: {
          providers,
          templates,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Update AI Provider configuration
  public static async updateProvider(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { modelName, temperature, maxTokens, isActive } = req.body;

      if (isActive) {
        // Enforce single active provider rule
        await prisma.aICdsProviderConfig.updateMany({
          data: { isActive: false },
        });
      }

      const updated = await prisma.aICdsProviderConfig.update({
        where: { id: Number(id) },
        data: {
          modelName,
          temperature: Number(temperature),
          maxTokens: Number(maxTokens),
          isActive: Boolean(isActive),
        },
      });

      res.status(200).json({
        status: 'success',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  // Save new Prompt Template version (Prompt Versioning!)
  public static async createPromptTemplateVersion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { key, promptText, description } = req.body;

      if (!key || !promptText) {
        throw new AppError('key and promptText are required', 400);
      }

      // Find latest version of this template
      const latest = await prisma.aICdsPromptTemplate.findFirst({
        where: { key },
        orderBy: { version: 'desc' },
      });

      const nextVersion = latest ? latest.version + 1 : 1;

      const newTemplate = await prisma.aICdsPromptTemplate.create({
        data: {
          key,
          promptText,
          version: nextVersion,
          description: description || `Version ${nextVersion} update`,
        },
      });

      res.status(201).json({
        status: 'success',
        data: newTemplate,
      });
    } catch (error) {
      next(error);
    }
  }

  // Audit Logs & Usage analytics
  public static async getAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const logs = await prisma.aICdsAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      // Calculate brief aggregates
      const successCount = await prisma.aICdsAuditLog.count({ where: { status: 'SUCCESS' } });
      const failureCount = await prisma.aICdsAuditLog.count({ where: { status: 'FAILURE' } });
      const totalCount = successCount + failureCount;

      const avgLatencyResult = await prisma.$queryRaw<any[]>`
        SELECT AVG("latency_ms")::int as avg_latency FROM "ai_cds_audit_logs" WHERE "status" = 'SUCCESS'
      `;
      const avgLatency = avgLatencyResult?.[0]?.avg_latency || 0;

      res.status(200).json({
        status: 'success',
        data: {
          metrics: {
            totalRequests: totalCount,
            successRate: totalCount ? (successCount / totalCount) * 100 : 100,
            avgLatencyMs: avgLatency,
            failureCount,
          },
          logs,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
