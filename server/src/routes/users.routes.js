import { Router } from 'express';
import { searchUsers } from '../controllers/users.controller.js';

const router = Router();
router.get('/search', searchUsers);
export default router;
