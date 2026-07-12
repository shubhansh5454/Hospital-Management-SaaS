import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { SaasController } from '../controllers/saas.ts';

const router = Router();

// Clinic registration is open to any authenticated user who wants to onboard
router.post('/register', requireAuth, SaasController.registerClinic);

// Clinic details and updates
router.get('/clinic', requireAuth, SaasController.getClinicDetails);
router.put('/clinic', requireAuth, SaasController.updateClinic);

// Get active tenant/clinic context
router.get('/active-tenant', requireAuth, (req: any, res) => {
  res.json({
    activeClinicId: req.user?.clinicId || null,
    activeTenantId: req.user?.tenantId || null,
    role: req.user?.role,
    isSwitched: req.user?.role === 'superadmin' && (req.headers['x-tenant-id'] !== undefined || req.headers['x-clinic-id'] !== undefined)
  });
});

// Super Admin clinic listing and detailed retrieval
router.get('/clinics', requireAuth, requireRoles(['superadmin']), SaasController.listClinics);
router.get('/clinics/:id', requireAuth, requireRoles(['superadmin']), SaasController.getClinicDetails);
router.put('/clinics/:id', requireAuth, requireRoles(['superadmin']), SaasController.updateClinic);

// Subscriptions & Billing
router.post('/subscription/change', requireAuth, requireRoles(['superadmin', 'admin']), SaasController.changeSubscription);
router.post('/subscription/cancel', requireAuth, requireRoles(['superadmin', 'admin']), SaasController.cancelSubscription);
router.post('/subscription/renew', requireAuth, requireRoles(['superadmin', 'admin']), SaasController.renewSubscription);
router.get('/billings', requireAuth, requireRoles(['superadmin', 'admin']), SaasController.getBillingHistory);
router.get('/billings/:id/breakdown', requireAuth, requireRoles(['superadmin', 'admin']), SaasController.getSaaSInvoiceDetail);
router.post('/billings/:id/pay', requireAuth, requireRoles(['superadmin', 'admin']), SaasController.payInvoice);

// Usage monitoring
router.get('/usage', requireAuth, SaasController.getUsageStats);

// Super Admin stats dashboard
router.get('/superadmin/stats', requireAuth, requireRoles(['superadmin']), SaasController.getSuperAdminDashboardStats);

// Staff management (Tenant isolation)
router.get('/staff', requireAuth, requireRoles(['superadmin', 'admin']), SaasController.getStaff);
router.post('/staff', requireAuth, requireRoles(['superadmin', 'admin']), SaasController.addStaffMember);
router.put('/staff/:id/role', requireAuth, requireRoles(['superadmin', 'admin']), SaasController.updateStaffRole);

export const saasRouter = router;
