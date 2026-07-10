import { prisma } from '../../db/prisma.ts';
import { AppError } from '../middleware/errorHandler.ts';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface PlanConfig {
  name: string;
  price: number;
  maxUsers: number;
  maxPatients: number;
  description: string;
}

export const SAAS_PLANS: Record<string, PlanConfig> = {
  Free: {
    name: 'Free',
    price: 0,
    maxUsers: 2,
    maxPatients: 10,
    description: 'Basic trial plan for a single doctor practice.',
  },
  Starter: {
    name: 'Starter',
    price: 49,
    maxUsers: 5,
    maxPatients: 50,
    description: 'For small practices starting their digital journey.',
  },
  Professional: {
    name: 'Professional',
    price: 149,
    maxUsers: 15,
    maxPatients: 200,
    description: 'Our most popular plan for busy multi-doctor clinics.',
  },
  Enterprise: {
    name: 'Enterprise',
    price: 399,
    maxUsers: 100000, // unlimited
    maxPatients: 100000, // unlimited
    description: 'Tailored limits and top priority support for large medical networks.',
  },
};

export class SaasService {
  /**
   * Register a new clinic and auto-subscribe to a plan
   */
  public static async registerClinic(input: {
    name: string;
    slug: string;
    email?: string;
    phone?: string;
    address?: string;
    planName: string;
    billingCycle: 'monthly' | 'yearly';
    userId: number; // The user who registers becomes the Clinic Admin
  }) {
    const { name, slug, email, phone, address, planName, billingCycle, userId } = input;

    // Validate plan
    const selectedPlan = SAAS_PLANS[planName];
    if (!selectedPlan) {
      throw new AppError(`Invalid plan name: ${planName}`, 400);
    }

    // Check slug uniqueness
    const existingClinic = await prisma.clinic.findUnique({
      where: { slug: slug.toLowerCase() },
    });
    if (existingClinic) {
      throw new AppError(`Clinic with sub-domain / slug "${slug}" already exists`, 400);
    }

    // Create clinic and its relations inside a Prisma Transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Create Clinic
      const clinic = await tx.clinic.create({
        data: {
          name,
          slug: slug.toLowerCase(),
          email,
          phone,
          address,
          status: 'active',
        },
      });

      // 2. Assign the user as Admin of this clinic
      await tx.user.update({
        where: { id: userId },
        data: {
          clinicId: clinic.id,
          role: 'admin', // Owner becomes Clinic Admin
        },
      });

      // 3. Create Clinic Subscription
      const startDate = new Date();
      const endDate = new Date();
      if (billingCycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const subscriptionPrice = billingCycle === 'yearly' ? selectedPlan.price * 12 * 0.8 : selectedPlan.price; // 20% discount for annual billing

      await tx.clinicSubscription.create({
        data: {
          clinicId: clinic.id,
          planName: selectedPlan.name,
          status: 'active',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          price: subscriptionPrice,
          billingCycle,
        },
      });

      // 4. Create initial Billing Invoice
      const invoiceNo = `INV-SAAS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      await tx.clinicBilling.create({
        data: {
          clinicId: clinic.id,
          invoiceNo,
          amount: subscriptionPrice,
          status: subscriptionPrice === 0 ? 'paid' : 'unpaid',
          billingDate: startDate.toISOString().split('T')[0],
          dueDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days due
        },
      });

      // 5. Initialize Usage Record
      await tx.clinicUsage.create({
        data: {
          clinicId: clinic.id,
          usersCount: 1, // The creator is the first user
          patientsCount: 0,
          appointmentsCount: 0,
          storageUsed: 0.1, // baseline meta size
        },
      });

      return clinic;
    });
  }

  /**
   * List all clinics (Super Admin only)
   */
  public static async listClinics() {
    return await prisma.clinic.findMany({
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        usages: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get clinic metadata & info
   */
  public static async getClinicDetails(clinicId: number) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        usages: true,
      },
    });
    if (!clinic) {
      throw new AppError('Clinic not found', 404);
    }
    return clinic;
  }

  /**
   * Edit clinic details
   */
  public static async updateClinic(clinicId: number, data: { name?: string; email?: string; phone?: string; address?: string; status?: string }) {
    return await prisma.clinic.update({
      where: { id: clinicId },
      data,
    });
  }

  /**
   * Change Subscription Plan
   */
  public static async changeSubscription(clinicId: number, planName: string, billingCycle: 'monthly' | 'yearly') {
    const selectedPlan = SAAS_PLANS[planName];
    if (!selectedPlan) {
      throw new AppError(`Invalid plan name: ${planName}`, 400);
    }

    const startDate = new Date();
    const endDate = new Date();
    if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const subscriptionPrice = billingCycle === 'yearly' ? selectedPlan.price * 12 * 0.8 : selectedPlan.price;

    return await prisma.$transaction(async (tx) => {
      // Deactivate older active subscriptions
      await tx.clinicSubscription.updateMany({
        where: { clinicId, status: 'active' },
        data: { status: 'expired' },
      });

      // Create new subscription
      const sub = await tx.clinicSubscription.create({
        data: {
          clinicId,
          planName: selectedPlan.name,
          status: 'active',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          price: subscriptionPrice,
          billingCycle,
        },
      });

      // Generate invoice
      const invoiceNo = `INV-SAAS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      await tx.clinicBilling.create({
        data: {
          clinicId,
          invoiceNo,
          amount: subscriptionPrice,
          status: subscriptionPrice === 0 ? 'paid' : 'unpaid',
          billingDate: startDate.toISOString().split('T')[0],
          dueDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
      });

      return sub;
    });
  }

  /**
   * Get subscription details
   */
  public static async getSubscription(clinicId: number) {
    const activeSub = await prisma.clinicSubscription.findFirst({
      where: { clinicId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    return activeSub || null;
  }

  /**
   * Get billing history
   */
  public static async getBillingHistory(clinicId: number) {
    return await prisma.clinicBilling.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Pay a SaaS Invoice (simulated checkout)
   */
  public static async paySaaSInvoice(clinicId: number, invoiceId: number) {
    const billing = await prisma.clinicBilling.findFirst({
      where: { id: invoiceId, clinicId },
    });
    if (!billing) {
      throw new AppError('Billing invoice not found', 404);
    }
    return await prisma.clinicBilling.update({
      where: { id: invoiceId },
      data: { status: 'paid' },
    });
  }

  /**
   * Recalculate and fetch usage statistics for a clinic
   */
  public static async getUsageStats(clinicId: number) {
    const [usersCount, patientsCount, appointmentsCount] = await Promise.all([
      prisma.user.count({ where: { clinicId } }),
      prisma.patient.count({ where: { clinicId } }),
      prisma.appointment.count({ where: { clinicId } }),
    ]);

    // Compute storage used: EMR records, notifications, etc. (simulated baseline + records size)
    const emrCount = await prisma.emrRecord.count({
      where: { patient: { clinicId } },
    });
    const calculatedStorage = parseFloat((0.2 + (usersCount * 0.05) + (patientsCount * 0.1) + (emrCount * 0.15)).toFixed(2));

    // Update the ClinicUsage cache in background
    await prisma.clinicUsage.upsert({
      where: { clinicId },
      create: {
        clinicId,
        usersCount,
        patientsCount,
        appointmentsCount,
        storageUsed: calculatedStorage,
      },
      update: {
        usersCount,
        patientsCount,
        appointmentsCount,
        storageUsed: calculatedStorage,
        lastUpdated: new Date(),
      },
    });

    const activeSub = await this.getSubscription(clinicId);
    const planConfig = SAAS_PLANS[activeSub?.planName || 'Free'];

    return {
      usersCount,
      patientsCount,
      appointmentsCount,
      storageUsed: calculatedStorage,
      planConfig,
    };
  }

  /**
   * Get master stats overview for Super Admin Dashboard
   */
  public static async getSuperAdminDashboardStats() {
    const clinics = await prisma.clinic.findMany({
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        usages: true,
      },
    });

    const totalClinics = clinics.length;
    const activeClinics = clinics.filter(c => c.status === 'active').length;
    const suspendedClinics = clinics.filter(c => c.status === 'suspended').length;

    // Recalculate aggregations
    let totalUsers = 0;
    let totalPatients = 0;
    let totalAppointments = 0;
    let totalRevenue = 0;

    const planDistribution: Record<string, number> = {
      Free: 0,
      Starter: 0,
      Professional: 0,
      Enterprise: 0,
    };

    clinics.forEach(clinic => {
      const usage = clinic.usages[0];
      if (usage) {
        totalUsers += usage.usersCount;
        totalPatients += usage.patientsCount;
        totalAppointments += usage.appointmentsCount;
      }

      const activeSub = clinic.subscriptions[0];
      if (activeSub && activeSub.status === 'active') {
        planDistribution[activeSub.planName] = (planDistribution[activeSub.planName] || 0) + 1;
      }
    });

    const allBillings = await prisma.clinicBilling.findMany({
      where: { status: 'paid' },
    });
    totalRevenue = allBillings.reduce((sum, b) => sum + b.amount, 0);

    return {
      totalClinics,
      activeClinics,
      suspendedClinics,
      totalUsers,
      totalPatients,
      totalAppointments,
      totalRevenue,
      planDistribution,
    };
  }

  /**
   * Fetch all staff members belonging to a clinic
   */
  public static async getStaff(clinicId: number) {
    return await prisma.user.findMany({
      where: { clinicId },
      select: {
        id: true,
        uid: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Update role of a staff member
   */
  public static async updateStaffRole(clinicId: number, staffUserId: number, role: 'admin' | 'doctor' | 'receptionist') {
    const userToUpdate = await prisma.user.findFirst({
      where: { id: staffUserId, clinicId },
    });

    if (!userToUpdate) {
      throw new AppError('User not found in this clinic', 404);
    }

    return await prisma.user.update({
      where: { id: staffUserId },
      data: { role },
    });
  }

  /**
   * Invite or directly add a new staff member
   */
  public static async addStaffMember(clinicId: number, input: { name: string; email: string; role: 'admin' | 'doctor' | 'receptionist'; password?: string }) {
    const { name, email, role, password } = input;

    // Check if email already registered
    const existing = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw new AppError('Email is already registered on the platform', 400);
    }

    // Verify tenant limits
    const stats = await this.getUsageStats(clinicId);
    if (stats.usersCount >= stats.planConfig.maxUsers) {
      throw new AppError(`Your clinic is at the user limit (${stats.planConfig.maxUsers}) for the "${stats.planConfig.name}" plan. Please upgrade to add more staff.`, 403);
    }

    // Create staff member
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || 'Staff123!', salt);
    const mockUid = `local_${crypto.randomUUID()}`;

    return await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        uid: mockUid,
        clinicId,
      },
    });
  }
}
