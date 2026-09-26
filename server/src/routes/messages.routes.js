import { Router } from 'express';
import { stats } from '../controllers/conversations.controller.js';
const router = Router();
router.get('/stats', stats);
export default router;
