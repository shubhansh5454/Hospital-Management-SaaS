import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { InvoiceController } from '../controllers/invoice.ts';

const router = Router();

// Apply auth globally for all invoice routes
router.use(requireAuth);

// Anyone logged in can fetch invoices (filtered for patient role)
router.get('/', InvoiceController.getAll);
router.get('/:id', InvoiceController.getById);

// Staff restricted operations
router.post('/', requireRoles(['admin', 'doctor', 'receptionist']), InvoiceController.create);
router.post('/:id/payments', requireRoles(['admin', 'doctor', 'receptionist']), InvoiceController.recordPayment);
router.put('/:id', requireRoles(['admin', 'doctor', 'receptionist']), InvoiceController.update);
router.delete('/:id', requireRoles(['admin', 'doctor', 'receptionist']), InvoiceController.delete);

export const invoicesRouter = router;
