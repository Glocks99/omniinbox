import 'dotenv/config';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import backfillUsernames from './utils/backfillUsernames.js';
import { ensureWorkspaceForUser } from './utils/workspace.js';
import { hideLegacyMockConversations } from './utils/legacyData.js';
import { startTelegramBot, stopTelegramBot } from './integrations/telegram.js';
import app from './app.js';
import { attachSocketServer } from './socket.js';

const port = Number(process.env.PORT) || 5000;
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error('MONGO_URI and JWT_SECRET must be set');
try {
  await mongoose.connect(process.env.MONGO_URI);
  await backfillUsernames();
  const admin = await User.findOneAndUpdate(
    { email: 'admin@omniinbox.local' },
    { $set: { displayName: 'Admin', username: 'admin' }, $setOnInsert: { _id: 'user_admin', email: 'admin@omniinbox.local', passwordHash: await bcrypt.hash('password123', 10) } },
    { upsert: true, new: true }
  );
  await ensureWorkspaceForUser(admin);
  await hideLegacyMockConversations();
  console.log('Demo account ready: admin@omniinbox.local / password123');
  const httpServer = createServer(app);
  const io = attachSocketServer(httpServer);
  app.set('io', io);
  httpServer.listen(port, () => console.log(`OmniInbox API and Socket.IO listening on http://localhost:${port}`));
  await startTelegramBot(io);
  const shutdown = () => {
    stopTelegramBot();
    io.close();
    mongoose.disconnect().finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error('Could not connect to MongoDB:', error.message);
  process.exit(1);
}
