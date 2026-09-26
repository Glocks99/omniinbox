import { createHash, randomBytes, randomUUID } from 'node:crypto';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import WorkspaceInvite from '../models/WorkspaceInvite.js';

export async function getWorkspace(req, res) {
  const workspace = req.user.workspaceId ? await Workspace.findById(req.user.workspaceId).lean() : null;
  const members = workspace?.memberIds?.length
    ? await User.find({ _id: { $in: workspace.memberIds } }).select('_id displayName username email role').sort({ displayName: 1 }).lean()
    : [];
  res.json({
    workspace: workspace ? { id: workspace._id, name: workspace.name, role: req.user.role || 'owner' } : null,
    members: members.map((member) => ({ id: member._id, displayName: member.displayName || member.username, username: member.username, email: member.email, role: member.role || 'owner' }))
  });
}

export async function createWorkspaceInvite(req, res) {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Only workspace owners can invite teammates' });
  if (!req.user.workspaceId) return res.status(409).json({ error: 'Your account does not have a workspace yet. Sign in again and retry.' });

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await WorkspaceInvite.create({
    _id: `invite_${randomUUID()}`,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    workspaceId: req.user.workspaceId,
    invitedById: req.user.sub,
    expiresAt
  });
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const url = new URL('/', clientUrl);
  url.searchParams.set('invite', token);
  res.status(201).json({ inviteUrl: url.toString(), expiresAt });
}
