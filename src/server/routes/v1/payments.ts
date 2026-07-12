import { Router } from 'express';
import { requireAuth, requireRoles } from '../../../middleware/auth.ts';
import { PaymentController } from '../../controllers/payment.ts';
import { standardRateLimiter, writeRateLimiter } from '../../middleware/rateLimiter.ts';

const router = Router();

// Apply authentication universally to all versioned payment endpoints
router.use(requireAuth);

/**
 * @route POST /api/v1/payments/orders
 * @desc Generate an invoice payment order (supports UPI, CC, DC, Net Banking)
 * @access Private
 */
router.post('/orders', writeRateLimiter, PaymentController.createOrder);

/**
 * @route POST /api/v1/payments/verify
 * @desc Verify gateway payload and commit payment ledger
 * @access Private
 */
router.post('/verify', writeRateLimiter, PaymentController.verifyPayment);

/**
 * @route POST /api/v1/payments/refunds
 * @desc Process partial or full invoice refunds
 * @access Private (Admin, Receptionist only)
 */
router.post('/refunds', requireRoles(['admin', 'receptionist']), writeRateLimiter, PaymentController.refund);

/**
 * @route GET /api/v1/payments/history
 * @desc Search and filter paginated payment logs
 * @access Private
 */
router.get('/history', standardRateLimiter, PaymentController.getHistory);

/**
 * @route GET /api/v1/payments/invoice/:id
 * @desc Load comprehensive integrated invoice details with payment and refund history
 * @access Private
 */
router.get('/invoice/:id', standardRateLimiter, PaymentController.getInvoiceDetailsWithPayments);

export const v1PaymentsRouter = router;
export default v1PaymentsRouter;
