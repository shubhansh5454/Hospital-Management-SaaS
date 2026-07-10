import { Router } from 'express';
import { requireAuth, requireRoles } from '../../middleware/auth.ts';
import { NotificationController } from '../controllers/notification.ts';

const router = Router();

// Apply auth globally for notifications
router.use(requireAuth);

// Get notification history (filtered by role internally)
router.get('/', NotificationController.getHistory);

// Mark single notification as read
router.put('/:id/read', NotificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', NotificationController.markAllAsRead);

// Staff-Only: Send custom broadcast/direct notification
router.post('/', requireRoles(['admin', 'doctor', 'receptionist']), NotificationController.sendCustom);

// Staff-Only: Manually trigger specialized reminders
router.post('/reminder/appointment', requireRoles(['admin', 'doctor', 'receptionist']), NotificationController.triggerAppointment);
router.post('/reminder/prescription', requireRoles(['admin', 'doctor', 'receptionist']), NotificationController.triggerPrescription);
router.post('/reminder/payment', requireRoles(['admin', 'doctor', 'receptionist']), NotificationController.triggerPayment);

export const notificationRouter = router;
