import User from '../models/User.js';

export async function searchUsers(req, res) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 2) return res.json({ users: [] });
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(escaped, 'i');
  const users = await User.find({
    _id: { $ne: req.user.sub },
    $or: [{ username: matcher }, { displayName: matcher }]
  }).select('_id username displayName').sort({ username: 1 }).limit(12).lean();
  res.json({ users: users.map((user) => ({ id: user._id, username: user.username, displayName: user.displayName || user.username })) });
}
