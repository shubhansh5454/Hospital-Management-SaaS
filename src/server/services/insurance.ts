import fs from 'fs';
import path from 'path';
import { prisma } from '../../db/prisma.ts';
import { AppError } from '../middleware/errorHandler.ts';

export interface InsuranceCompany {
  id: string;
  name: string;
  code: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface InsurancePlan {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  code: string;
  type: 'HMO' | 'PPO' | 'EPO' | 'POS';
  copay: number; // e.g. $20
  coinsurancePercent: number; // e.g. 20%
  deductible: number; // e.g. $500
  coverageDetails: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface PatientInsurance {
  id: string;
  patientId: number;
  patientName: string;
  companyId: string;
  companyName: string;
  planId: string;
  planName: string;
  policyNumber: string;
  groupNumber: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'active' | 'expired' | 'pending_verification';
  verifiedAt?: string;
  verifiedBy?: string;
  documents: { id: string; name: string; size: string; url: string; uploadedAt: string }[];
  createdAt: string;
}

export interface ClaimDocument {
  id: string;
  name: string;
  size: string;
  url: string;
  uploadedAt: string;
}

export interface ClaimWorkflowLog {
  status: string;
  changedBy: string;
  changedAt: string;
  notes: string;
}

export interface Claim {
  id: string;
  claimNumber: string;
  patientId: number;
  patientName: string;
  policyId: string;
  policyNumber: string;
  companyId: string;
  companyName: string;
  planId: string;
  planName: string;
  invoiceId?: number;
  invoiceNumber?: string;
  treatmentDate: string; // YYYY-MM-DD
  diagnosisCode: string; // ICD-10 code
  totalAmount: number;
  insuredAmount: number;
  patientAmount: number;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disputed';
  notes: string;
  submittedDate?: string;
  processedDate?: string;
  rejectionReason?: string;
  documents: ClaimDocument[];
  workflowHistory: ClaimWorkflowLog[];
  createdAt: string;
}

interface InsuranceData {
  companies: InsuranceCompany[];
  plans: InsurancePlan[];
  patientInsurances: PatientInsurance[];
  claims: Claim[];
}

const DATA_FILE = path.join(process.cwd(), 'src', 'server', 'data', 'insurance.json');

export class InsuranceService {
  private static initFile() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const defaultData: InsuranceData = {
        companies: [
          {
            id: 'co-1',
            name: 'Aetna Health Inc.',
            code: 'AETNA',
            contactPhone: '1-800-872-3862',
            contactEmail: 'provider@aetna.com',
            address: '151 Farmington Avenue, Hartford, CT 06156',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'co-2',
            name: 'Blue Cross Blue Shield',
            code: 'BCBS',
            contactPhone: '1-800-262-2583',
            contactEmail: 'claims@bcbs.com',
            address: '225 North Michigan Avenue, Chicago, IL 60601',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'co-3',
            name: 'Cigna Medical Insurance',
            code: 'CIGNA',
            contactPhone: '1-800-997-1654',
            contactEmail: 'verify@cigna.com',
            address: '900 Cottage Grove Road, Bloomfield, CT 06002',
            status: 'active',
            createdAt: new Date().toISOString()
          }
        ],
        plans: [
          {
            id: 'plan-1',
            companyId: 'co-1',
            companyName: 'Aetna Health Inc.',
            name: 'Aetna HMO Bronze',
            code: 'AET-BRZ-HMO',
            type: 'HMO',
            copay: 35,
            coinsurancePercent: 30,
            deductible: 1200,
            coverageDetails: 'Standard preventive care covered at 100%. General specialist copay of $35. Primary Care physician consultation required for referrals.',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'plan-2',
            companyId: 'co-1',
            companyName: 'Aetna Health Inc.',
            name: 'Aetna Choice POS II (Gold)',
            code: 'AET-GLD-POS',
            type: 'POS',
            copay: 15,
            coinsurancePercent: 10,
            deductible: 250,
            coverageDetails: 'Excellent in-network coverage. 90% outpatient coverage. Out of network services subject to standard high deductibles.',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'plan-3',
            companyId: 'co-2',
            companyName: 'Blue Cross Blue Shield',
            name: 'Blue Diamond Preferred PPO',
            code: 'BCBS-DIA-PPO',
            type: 'PPO',
            copay: 20,
            coinsurancePercent: 15,
            deductible: 500,
            coverageDetails: 'Comprehensive PPO plan with national BlueCard network. Specialized laboratory tests, diagnostics and emergency room visits covered.',
            status: 'active',
            createdAt: new Date().toISOString()
          }
        ],
        patientInsurances: [],
        claims: []
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    }
  }

  private static readData(): InsuranceData {
    this.initFile();
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading insurance JSON:', error);
      return { companies: [], plans: [], patientInsurances: [], claims: [] };
    }
  }

  private static writeData(data: InsuranceData) {
    this.initFile();
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing insurance JSON:', error);
    }
  }

  // ================= COMPANY CRUD =================
  public static getCompanies(): InsuranceCompany[] {
    return this.readData().companies;
  }

  public static createCompany(company: Omit<InsuranceCompany, 'id' | 'createdAt'>): InsuranceCompany {
    const data = this.readData();
    const newCompany: InsuranceCompany = {
      ...company,
      id: `co-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      createdAt: new Date().toISOString()
    };
    data.companies.push(newCompany);
    this.writeData(data);
    return newCompany;
  }

  public static updateCompany(id: string, updates: Partial<InsuranceCompany>): InsuranceCompany {
    const data = this.readData();
    const index = data.companies.findIndex(c => c.id === id);
    if (index === -1) {
      throw new AppError('Insurance company not found', 404);
    }

    // If company name changes, update associated plans
    const updatedCompany = { ...data.companies[index], ...updates };
    data.companies[index] = updatedCompany;

    if (updates.name) {
      data.plans = data.plans.map(p => {
        if (p.companyId === id) {
          return { ...p, companyName: updates.name! };
        }
        return p;
      });
      data.patientInsurances = data.patientInsurances.map(pi => {
        if (pi.companyId === id) {
          return { ...pi, companyName: updates.name! };
        }
        return pi;
      });
      data.claims = data.claims.map(c => {
        if (c.companyId === id) {
          return { ...c, companyName: updates.name! };
        }
        return c;
      });
    }

    this.writeData(data);
    return updatedCompany;
  }

  public static deleteCompany(id: string) {
    const data = this.readData();
    // Check if plans belong to company
    const hasPlans = data.plans.some(p => p.companyId === id);
    if (hasPlans) {
      throw new AppError('Cannot delete company with associated plans. Delete plans first.', 400);
    }
    data.companies = data.companies.filter(c => c.id !== id);
    this.writeData(data);
  }

  // ================= PLANS CRUD =================
  public static getPlans(): InsurancePlan[] {
    return this.readData().plans;
  }

  public static createPlan(plan: Omit<InsurancePlan, 'id' | 'companyName' | 'createdAt'>): InsurancePlan {
    const data = this.readData();
    const company = data.companies.find(c => c.id === plan.companyId);
    if (!company) {
      throw new AppError('Associated insurance company not found', 404);
    }

    const newPlan: InsurancePlan = {
      ...plan,
      id: `plan-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      companyName: company.name,
      createdAt: new Date().toISOString()
    };
    data.plans.push(newPlan);
    this.writeData(data);
    return newPlan;
  }

  public static updatePlan(id: string, updates: Partial<InsurancePlan>): InsurancePlan {
    const data = this.readData();
    const index = data.plans.findIndex(p => p.id === id);
    if (index === -1) {
      throw new AppError('Insurance plan not found', 404);
    }

    const updatedPlan = { ...data.plans[index], ...updates };
    data.plans[index] = updatedPlan;

    // Propagate changes
    if (updates.name) {
      data.patientInsurances = data.patientInsurances.map(pi => {
        if (pi.planId === id) {
          return { ...pi, planName: updates.name! };
        }
        return pi;
      });
      data.claims = data.claims.map(c => {
        if (c.planId === id) {
          return { ...c, planName: updates.name! };
        }
        return c;
      });
    }

    this.writeData(data);
    return updatedPlan;
  }

  public static deletePlan(id: string) {
    const data = this.readData();
    const hasPolicies = data.patientInsurances.some(pi => pi.planId === id);
    if (hasPolicies) {
      throw new AppError('Cannot delete plan linked to patient insurance policies', 400);
    }
    data.plans = data.plans.filter(p => p.id !== id);
    this.writeData(data);
  }

  // ================= PATIENT INSURANCE CRUD =================
  public static async getPatientInsurances(patientId?: number): Promise<PatientInsurance[]> {
    const data = this.readData();
    let policies = data.patientInsurances;
    if (patientId) {
      policies = policies.filter(pi => pi.patientId === patientId);
    }
    return policies;
  }

  public static async createPatientInsurance(
    policy: Omit<PatientInsurance, 'id' | 'patientName' | 'companyName' | 'planName' | 'createdAt'>
  ): Promise<PatientInsurance> {
    const data = this.readData();

    // Verify patient
    const dbPatient = await prisma.patient.findUnique({
      where: { id: policy.patientId },
      select: { name: true }
    });
    if (!dbPatient) {
      throw new AppError('Patient not found in Clinical Directory', 404);
    }

    // Verify Company & Plan
    const company = data.companies.find(c => c.id === policy.companyId);
    if (!company) {
      throw new AppError('Insurance company not found', 404);
    }

    const plan = data.plans.find(p => p.id === policy.planId);
    if (!plan) {
      throw new AppError('Insurance plan not found', 404);
    }

    const newPolicy: PatientInsurance = {
      ...policy,
      id: `pol-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      patientName: dbPatient.name,
      companyName: company.name,
      planName: plan.name,
      createdAt: new Date().toISOString()
    };

    data.patientInsurances.push(newPolicy);
    this.writeData(data);
    return newPolicy;
  }

  public static updatePatientInsurance(id: string, updates: Partial<PatientInsurance>): PatientInsurance {
    const data = this.readData();
    const index = data.patientInsurances.findIndex(pi => pi.id === id);
    if (index === -1) {
      throw new AppError('Patient insurance policy not found', 404);
    }

    const updated = { ...data.patientInsurances[index], ...updates };
    data.patientInsurances[index] = updated;
    this.writeData(data);
    return updated;
  }

  public static deletePatientInsurance(id: string) {
    const data = this.readData();
    data.patientInsurances = data.patientInsurances.filter(pi => pi.id !== id);
    this.writeData(data);
  }

  // ================= CLAIMS CRUD & WORKFLOW =================
  public static async getClaims(patientId?: number): Promise<Claim[]> {
    const data = this.readData();
    let claims = data.claims;
    if (patientId) {
      claims = claims.filter(c => c.patientId === patientId);
    }
    return claims;
  }

  public static async createClaim(
    claim: Omit<Claim, 'id' | 'claimNumber' | 'patientName' | 'companyId' | 'companyName' | 'planId' | 'planName' | 'policyNumber' | 'workflowHistory' | 'createdAt'>
  ): Promise<Claim> {
    const data = this.readData();

    // Fetch Patient Policy
    const policy = data.patientInsurances.find(pi => pi.id === claim.policyId);
    if (!policy) {
      throw new AppError('Linked patient insurance policy not found', 404);
    }

    // Generate unique Claim Number
    const claimNumber = `CLM-${Date.now().toString().substring(6)}-${Math.floor(100 + Math.random() * 900)}`;

    const newClaim: Claim = {
      ...claim,
      id: `clm-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      claimNumber,
      patientName: policy.patientName,
      companyId: policy.companyId,
      companyName: policy.companyName,
      planId: policy.planId,
      planName: policy.planName,
      policyNumber: policy.policyNumber,
      workflowHistory: [
        {
          status: claim.status,
          changedBy: 'System / Creator',
          changedAt: new Date().toISOString(),
          notes: 'Claim folder initialized.'
        }
      ],
      createdAt: new Date().toISOString()
    };

    if (claim.status === 'submitted') {
      newClaim.submittedDate = new Date().toISOString();
    }

    data.claims.push(newClaim);
    this.writeData(data);
    return newClaim;
  }

  public static updateClaim(id: string, updates: Partial<Claim>, updaterName: string): Claim {
    const data = this.readData();
    const index = data.claims.findIndex(c => c.id === id);
    if (index === -1) {
      throw new AppError('Claim not found', 404);
    }

    const currentClaim = data.claims[index];
    const updatedClaim = { ...currentClaim, ...updates };

    // Check if status transitioned to record in history
    if (updates.status && updates.status !== currentClaim.status) {
      updatedClaim.workflowHistory.push({
        status: updates.status,
        changedBy: updaterName,
        changedAt: new Date().toISOString(),
        notes: updates.rejectionReason || updates.notes || `Status changed from ${currentClaim.status} to ${updates.status}.`
      });

      if (updates.status === 'submitted' && !currentClaim.submittedDate) {
        updatedClaim.submittedDate = new Date().toISOString();
      }

      if (['approved', 'rejected'].includes(updates.status)) {
        updatedClaim.processedDate = new Date().toISOString();
      }
    }

    data.claims[index] = updatedClaim;
    this.writeData(data);
    return updatedClaim;
  }

  public static deleteClaim(id: string) {
    const data = this.readData();
    const claim = data.claims.find(c => c.id === id);
    if (claim && claim.status !== 'draft') {
      throw new AppError('Cannot delete active or processed claims. Only draft status claims can be deleted.', 400);
    }
    data.claims = data.claims.filter(c => c.id !== id);
    this.writeData(data);
  }
}
