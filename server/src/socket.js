import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';
import User from './models/User.js';
import { emitConversationMessage, isMember, toConversationView, toMessageView } from './utils/conversationView.js';
import { ensureWorkspaceForUser } from './utils/workspace.js';
import { sendPushToUsers } from './integrations/webPush.js';

const maxMessageLength = 2000;

function setUnreadCount(conversation, userId, count) {
  if (!(conversation.unreadByUser instanceof Map)) conversation.unreadByUser = new Map(Object.entries(conversation.unreadByUser || {}));
  conversation.unreadByUser.set(userId, count);
}

export function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN?.split(',') ?? true }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const claims = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(claims.sub);
      if (!user) return next(new Error('Account no longer exists'));
      const workspaceId = await ensureWorkspaceForUser(user);
      socket.data.user = { ...claims, workspaceId, role: user.role || 'owner' };
      next();
    } catch { next(new Error('Invalid or expired token')); }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user.sub;
    socket.join(`user:${userId}`);

    socket.on('conversation:join', async ({ conversationId } = {}, acknowledge = () => {}) => {
      try {
        const conversation = await Conversation.findById(conversationId).lean();
        if (!conversation || !isMember(conversation, userId, socket.data.user.workspaceId) || conversation.platform !== 'omniinbox') {
          return acknowledge({ error: 'Conversation not found' });
        }
        socket.join(`conversation:${conversationId}`);
        acknowledge({ ok: true });
      } catch { acknowledge({ error: 'Could not join conversation' }); }
    });

    socket.on('conversation:leave', ({ conversationId } = {}) => {
      if (conversationId) socket.leave(`conversation:${conversationId}`);
    });

    socket.on('message:send', async (payload = {}, acknowledge = () => {}) => {
      try {
        const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : '';
        const text = typeof payload.text === 'string' ? payload.text.trim() : '';
        if (!text || text.length > maxMessageLength) return acknowledge({ error: 'Message must be between 1 and 2000 characters' });
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.platform !== 'omniinbox' || !isMember(conversation, userId, socket.data.user.workspaceId)) {
          return acknowledge({ error: 'Conversation not found' });
        }
        const timestamp = new Date();
        const recipients = conversation.memberIds.filter((memberId) => memberId !== userId);
        const online = recipients.some((memberId) => (io.sockets.adapter.rooms.get(`user:${memberId}`)?.size || 0) > 0);
        const message = await Message.create({
          _id: `msg_${randomUUID()}`,
          conversationId,
          platform: 'omniinbox',
          senderId: userId,
          direction: 'outbound',
          text,
          timestamp,
          status: online ? 'delivered' : 'sent'
        });
        conversation.lastMessagePreview = text;
        conversation.lastMessageTimestamp = timestamp;
        setUnreadCount(conversation, userId, 0);
        for (const recipientId of recipients) setUnreadCount(conversation, recipientId, (conversation.unreadByUser?.get(recipientId) || 0) + 1);
        await conversation.save();
        await emitConversationMessage(io, conversation, message, User);
        void sendPushToUsers(recipients, { conversationId, platform: 'omniinbox' })
          .catch((error) => console.warn('Direct chat push notification could not be queued:', error.message));
        const peerId = recipients[0];
        const peer = peerId ? await User.findById(peerId).select('_id username displayName').lean() : null;
        acknowledge({ ok: true, conversation: toConversationView(conversation, userId, peer), message: toMessageView(message, userId) });
      } catch (error) {
        console.error('Socket message failed:', error.message);
        acknowledge({ error: 'Message could not be sent. Try again.' });
      }
    });
  });

  return io;
}
