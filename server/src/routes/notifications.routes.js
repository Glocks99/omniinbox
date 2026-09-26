import { Router } from 'express';
import { getNotificationSettings, removePushSubscription, savePushSubscription, updateNotificationPreferences } from '../controllers/notifications.controller.js';

const router = Router();
router.get('/settings', getNotificationSettings);
router.post('/subscriptions', savePushSubscription);
router.delete('/subscriptions', removePushSubscription);
router.patch('/preferences', updateNotificationPreferences);
export default router;
