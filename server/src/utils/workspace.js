import { randomUUID } from 'node:crypto';
import Workspace from '../models/Workspace.js';

export async function ensureWorkspaceForUser(user) {
  if (user.workspaceId) return user.workspaceId;

  const workspaceId = `workspace_${user._id || randomUUID()}`;
  await Workspace.findOneAndUpdate(
    { _id: workspaceId },
    { $setOnInsert: { name: `${user.displayName || user.email.split('@')[0]}'s workspace`, ownerId: user._id, memberIds: [user._id] } },
    { upsert: true }
  );
  user.workspaceId = workspaceId;
  user.role = 'owner';
  await user.save();
  return workspaceId;
}
