import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { InsuranceController } from '../controllers/insurance.ts';

const router = Router();

router.use(requireAuth);

// Company routes
router.get('/companies', InsuranceController.getCompanies);
router.post('/companies', InsuranceController.createCompany);
router.put('/companies/:id', InsuranceController.updateCompany);
router.delete('/companies/:id', InsuranceController.deleteCompany);

// Plan routes
router.get('/plans', InsuranceController.getPlans);
router.post('/plans', InsuranceController.createPlan);
router.put('/plans/:id', InsuranceController.updatePlan);
router.delete('/plans/:id', InsuranceController.deletePlan);

// Policy routes
router.get('/policies', InsuranceController.getPolicies);
router.post('/policies', InsuranceController.createPolicy);
router.put('/policies/:id', InsuranceController.updatePolicy);
router.delete('/policies/:id', InsuranceController.deletePolicy);

// Claim routes
router.get('/claims', InsuranceController.getClaims);
router.post('/claims', InsuranceController.createClaim);
router.put('/claims/:id', InsuranceController.updateClaim);
router.delete('/claims/:id', InsuranceController.deleteClaim);

export const insuranceRouter = router;
