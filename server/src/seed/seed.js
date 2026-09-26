import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import backfillUsernames from '../utils/backfillUsernames.js';
import { ensureWorkspaceForUser } from '../utils/workspace.js';
import { hideLegacyMockConversations } from '../utils/legacyData.js';

if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be set');
await mongoose.connect(process.env.MONGO_URI);
try {
  await backfillUsernames();
  const admin = await User.findOneAndUpdate(
    { email: 'admin@omniinbox.local' },
    { $set: { displayName: 'Admin', username: 'admin' }, $setOnInsert: { _id: 'user_admin', email: 'admin@omniinbox.local', passwordHash: await bcrypt.hash('password123', 10) } },
    { upsert: true, new: true }
  );
  await ensureWorkspaceForUser(admin);
  await hideLegacyMockConversations();
  console.log('Demo account and workspace ready. No sample platform messages were added.');
} finally {
  await mongoose.disconnect();
}
