import { Router } from 'express';
import { createWorkspaceInvite, getWorkspace } from '../controllers/workspace.controller.js';

const router = Router();
router.get('/', getWorkspace);
router.post('/invites', createWorkspaceInvite);
export default router;
