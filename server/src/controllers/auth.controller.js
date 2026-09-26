import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import WorkspaceInvite from '../models/WorkspaceInvite.js';
import { ensureWorkspaceForUser } from '../utils/workspace.js';

function createToken(user) {
  return jwt.sign({ sub: user._id, email: user.email, name: user.displayName || user.email.split('@')[0], username: user.username || user.email.split('@')[0], workspaceId: user.workspaceId, role: user.role || 'owner' }, process.env.JWT_SECRET, { expiresIn: '12h' });
}

function publicUser(user) {
  return { id: user._id, email: user.email, displayName: user.displayName || user.email.split('@')[0], username: user.username || user.email.split('@')[0], workspaceId: user.workspaceId, role: user.role || 'owner' };
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') return res.status(401).json({ error: 'Invalid email or password' });
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
    await ensureWorkspaceForUser(user);
    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
}

export async function register(req, res, next) {
  try {
    const { email, password, displayName, username } = req.body ?? {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const name = typeof displayName === 'string' ? displayName.trim() : '';
    if (name.length > 60) return res.status(400).json({ error: 'Name must be 60 characters or fewer' });
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) return res.status(400).json({ error: 'Username must be 3–24 characters using letters, numbers, or underscores' });
    const existing = await User.exists({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
    if (existing) return res.status(409).json({ error: 'That email or username is already registered' });
    const inviteToken = typeof req.body?.inviteToken === 'string' ? req.body.inviteToken.trim() : '';
    const tokenHash = inviteToken ? createHash('sha256').update(inviteToken).digest('hex') : '';
    let invite = inviteToken ? await WorkspaceInvite.findOne({ tokenHash, acceptedAt: null, expiresAt: { $gt: new Date() } }) : null;
    if (inviteToken && !invite) return res.status(400).json({ error: 'This team invite has expired or has already been used' });

    const workspaceId = invite?.workspaceId || `workspace_${randomUUID()}`;
    const userId = `user_${randomUUID()}`;
    const displayNameValue = name || normalizedEmail.split('@')[0];
    if (!invite) {
      await Workspace.create({ _id: workspaceId, name: `${displayNameValue}'s workspace`, ownerId: userId, memberIds: [userId] });
    }
    let user;
    try {
      user = await User.create({
        _id: userId,
        email: normalizedEmail,
        displayName: displayNameValue,
        username: normalizedUsername,
        passwordHash: await bcrypt.hash(password, 10),
        workspaceId,
        role: invite ? 'agent' : 'owner'
      });
    } catch (error) {
      if (!invite) await Workspace.deleteOne({ _id: workspaceId });
      throw error;
    }

    if (invite) {
      const acceptedInvite = await WorkspaceInvite.findOneAndUpdate(
        { _id: invite._id, acceptedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { acceptedAt: new Date() } },
        { new: true }
      );
      if (!acceptedInvite) {
        await User.deleteOne({ _id: userId });
        return res.status(400).json({ error: 'This team invite has already been used' });
      }
      await Workspace.updateOne({ _id: workspaceId }, { $addToSet: { memberIds: userId } });
    }
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That email or username is already registered' });
    next(error);
  }
}
