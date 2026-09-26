import User from '../models/User.js';

export default async function backfillUsernames() {
  const users = await User.find({ $or: [{ username: { $exists: false } }, { username: null }, { username: '' }] }).select('_id email');
  for (const user of users) {
    let base = (user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'user').slice(0, 19);
    if (base === 'admin' && user.email !== 'admin@omniinbox.local') base = 'admin_user';
    let username = base.length >= 3 ? base : `user_${base}`;
    let suffix = 1;
    while (await User.exists({ username, _id: { $ne: user._id } })) {
      const tail = `_${suffix++}`;
      username = `${base.slice(0, 24 - tail.length)}${tail}`;
    }
    await User.updateOne({ _id: user._id }, { $set: { username } });
  }
}
