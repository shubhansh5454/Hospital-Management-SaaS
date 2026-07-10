import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { MedicineController } from '../controllers/medicine.ts';

const router = Router();

// Retrieve all medicines or a single medicine is allowed for any authorized user (admin, doctor, receptionist, patient)
router.get('/', requireAuth, MedicineController.listMedicines);
router.get('/report', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), MedicineController.getStockReport);
router.get('/:id', requireAuth, MedicineController.getMedicine);

// Restrict creation, updating, and deleting of master catalog
router.post('/', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), MedicineController.createMedicine);
router.put('/:id', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), MedicineController.updateMedicine);
router.delete('/:id', requireAuth, requireRoles(['admin']), MedicineController.deleteMedicine);

// Purchases & sales
router.post('/purchase', requireAuth, requireRoles(['admin', 'receptionist']), MedicineController.purchaseStock);
router.post('/sale', requireAuth, requireRoles(['admin', 'doctor', 'receptionist']), MedicineController.sellMedicine);

export const pharmacyRouter = router;
