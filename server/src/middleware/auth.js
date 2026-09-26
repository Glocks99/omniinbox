import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ensureWorkspaceForUser } from '../utils/workspace.js';

export default async function auth(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(claims.sub);
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    const workspaceId = await ensureWorkspaceForUser(user);
    req.user = { ...claims, workspaceId, role: user.role || 'owner', name: user.displayName || claims.name, username: user.username || claims.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
