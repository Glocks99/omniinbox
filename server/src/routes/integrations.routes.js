import { Router } from 'express';
import { telegramStatus } from '../controllers/integrations.controller.js';

const router = Router();
router.get('/telegram', telegramStatus);
export default router;
