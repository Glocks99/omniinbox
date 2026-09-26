import { randomUUID } from 'node:crypto';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { emitConversationMessage, emitConversationUpdate, isMember, toConversationView, toMessageView } from '../utils/conversationView.js';
import { sendTelegramMessage } from '../integrations/telegram.js';
import { sendPushToUsers } from '../integrations/webPush.js';

const platforms = ['whatsapp', 'instagram', 'telegram', 'omniinbox'];
const membershipFilter = (userId, workspaceId) => ({ $or: [...(workspaceId ? [{ workspaceId }] : []), { ownerId: userId }, { memberIds: userId }] });

function setUnreadCount(conversation, userId, count) {
  if (!(conversation.unreadByUser instanceof Map)) conversation.unreadByUser = new Map(Object.entries(conversation.unreadByUser || {}));
  conversation.unreadByUser.set(userId, count);
}

async function peerProfiles(conversations, viewerId) {
  const peerIds = [...new Set(conversations.flatMap((conversation) => (conversation.memberIds || []).filter((id) => id !== viewerId)))];
  const users = peerIds.length ? await User.find({ _id: { $in: peerIds } }).select('_id username displayName').lean() : [];
  return new Map(users.map((user) => [user._id, user]));
}

export async function createConversation(req, res) {
  const participantName = typeof req.body?.participantName === 'string' ? req.body.participantName.trim() : '';
  const platform = req.body?.platform;
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!platforms.includes(platform)) return res.status(400).json({ error: 'Choose a valid platform' });
  if (platform === 'whatsapp' || platform === 'instagram') return res.status(409).json({ error: `${platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'} integration is coming soon. This message was not sent.` });
  if (platform === 'telegram') return res.status(400).json({ error: 'A customer must message your Telegram bot before a conversation can be created.' });
  if (!text || text.length > 2000) return res.status(400).json({ error: 'Message must be between 1 and 2000 characters' });

  const timestamp = new Date();
  let conversation;
  let peer;
  if (platform === 'omniinbox') {
    const recipientId = typeof req.body?.recipientId === 'string' ? req.body.recipientId : '';
    peer = await User.findById(recipientId).select('_id username displayName');
    if (!peer || peer._id === req.user.sub) return res.status(404).json({ error: 'Choose another registered OmniInbox user' });
    const memberIds = [req.user.sub, peer._id].sort();
    conversation = await Conversation.findOne({ platform, memberIds: { $all: memberIds, $size: 2 } });
    if (!conversation) {
      conversation = new Conversation({
        _id: `conv_${randomUUID()}`,
        ownerId: req.user.sub,
        memberIds,
        platform,
        participantName: peer.displayName || peer.username,
        participantAvatarUrl: '',
        lastMessagePreview: text,
        lastMessageTimestamp: timestamp,
        unreadCount: 0,
        unreadByUser: { [req.user.sub]: 0, [peer._id]: 1 }
      });
    } else {
      const currentUnread = conversation.unreadByUser?.get(peer._id) || 0;
      setUnreadCount(conversation, req.user.sub, 0);
      setUnreadCount(conversation, peer._id, currentUnread + 1);
      conversation.lastMessagePreview = text;
      conversation.lastMessageTimestamp = timestamp;
    }
  } else {
    if (participantName.length < 2 || participantName.length > 80) return res.status(400).json({ error: 'Contact name must be between 2 and 80 characters' });
    conversation = new Conversation({
      _id: `conv_${randomUUID()}`,
      ownerId: req.user.sub,
      platform,
      participantName,
      participantAvatarUrl: '',
      lastMessagePreview: text,
      lastMessageTimestamp: timestamp,
      unreadCount: 0
    });
  }

  const message = new Message({
    _id: `msg_${randomUUID()}`,
    conversationId: conversation._id,
    platform,
    ...(platform === 'omniinbox' ? { senderId: req.user.sub } : {}),
    direction: 'outbound',
    text,
    timestamp,
    status: 'sent'
  });
  await Promise.all([conversation.save(), message.save()]);
  const io = req.app.get('io');
  if (platform === 'omniinbox') {
    await emitConversationMessage(io, conversation, message, User);
    void sendPushToUsers([peer._id], { conversationId: conversation._id, platform })
      .catch((error) => console.warn('Direct chat push notification could not be queued:', error.message));
  }
  res.status(201).json({ conversation: toConversationView(conversation, req.user.sub, peer), message: toMessageView(message, req.user.sub) });
}

export async function listConversations(req, res) {
  const filter = membershipFilter(req.user.sub, req.user.workspaceId);
  filter.isDemo = { $ne: true };
  if (req.query.platform) {
    if (!platforms.includes(req.query.platform)) return res.status(400).json({ error: 'Invalid platform' });
    filter.platform = req.query.platform;
  }
  if (['open', 'pending', 'resolved'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.assigned === 'me') filter.assignedToId = req.user.sub;
  if (req.query.assigned === 'unassigned') filter.assignedToId = null;
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
  if (query.length >= 2) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(escaped, 'i');
    const allowed = await Conversation.find(filter).select('_id').lean();
    const matchingMessages = allowed.length
      ? await Message.distinct('conversationId', { conversationId: { $in: allowed.map((row) => row._id) }, kind: { $ne: 'note' }, text: matcher })
      : [];
    filter.$and = [...(filter.$and || []), { $or: [{ participantName: matcher }, { _id: { $in: matchingMessages } }] }];
  }
  const rows = await Conversation.find(filter).sort({ lastMessageTimestamp: -1 }).lean();
  const peers = await peerProfiles(rows, req.user.sub);
  const assigneeIds = [...new Set(rows.map((row) => row.assignedToId).filter(Boolean))];
  const assignees = assigneeIds.length ? await User.find({ _id: { $in: assigneeIds } }).select('_id displayName username').lean() : [];
  const assigneeNames = new Map(assignees.map((assignee) => [assignee._id, assignee.displayName || assignee.username]));
  const conversations = rows.map((row) => {
    const peerId = row.memberIds?.find((id) => id !== req.user.sub);
    return { ...toConversationView(row, req.user.sub, peerId ? peers.get(peerId) : null), assignedToName: row.assignedToId ? (assigneeNames.get(row.assignedToId) || 'Teammate') : '' };
  });
  res.json({ conversations });
}

export async function listMessages(req, res) {
  const conversation = await Conversation.findById(req.params.id).lean();
  if (!conversation || !isMember(conversation, req.user.sub, req.user.workspaceId)) return res.status(404).json({ error: 'Conversation not found' });
  const messages = await Message.find({ conversationId: req.params.id }).sort({ timestamp: 1 }).lean();
  res.json({ messages: messages.map((message) => toMessageView(message, req.user.sub)) });
}

export async function sendMessage(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !isMember(conversation, req.user.sub, req.user.workspaceId)) return res.status(404).json({ error: 'Conversation not found' });
  if (conversation.platform === 'whatsapp' || conversation.platform === 'instagram') return res.status(409).json({ error: `${conversation.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'} integration is coming soon. This message was not sent.` });
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Message text is required' });
  if (text.length > 2000) return res.status(400).json({ error: 'Message must be 2000 characters or fewer' });
  let telegramResult = null;
  if (conversation.platform === 'telegram') {
    if (!conversation.telegramChatId) return res.status(409).json({ error: 'This Telegram contact has not started a conversation with the bot yet.' });
    try {
      telegramResult = await sendTelegramMessage(conversation.telegramChatId, text);
    } catch (error) {
      return res.status(502).json({ error: error.message || 'Telegram could not deliver this message. Try again.' });
    }
  }
  const timestamp = telegramResult?.date ? new Date(telegramResult.date * 1000) : new Date();
  const message = await Message.create({ _id: `msg_${randomUUID()}`, conversationId: conversation._id, platform: conversation.platform, ...(conversation.platform === 'omniinbox' ? { senderId: req.user.sub } : {}), ...(telegramResult ? { telegramChatId: conversation.telegramChatId, telegramMessageId: String(telegramResult.message_id) } : {}), direction: 'outbound', text, timestamp, status: 'sent' });
  conversation.lastMessagePreview = text;
  conversation.lastMessageTimestamp = timestamp;
  if (conversation.platform === 'omniinbox') {
    for (const memberId of conversation.memberIds.filter((id) => id !== req.user.sub)) setUnreadCount(conversation, memberId, (conversation.unreadByUser?.get(memberId) || 0) + 1);
    setUnreadCount(conversation, req.user.sub, 0);
  }
  await conversation.save();
  if (conversation.platform === 'omniinbox' || conversation.workspaceId) await emitConversationMessage(req.app.get('io'), conversation, message, User);
  res.status(201).json({ message: toMessageView(message, req.user.sub) });
}

export async function markRead(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !isMember(conversation, req.user.sub, req.user.workspaceId)) return res.status(404).json({ error: 'Conversation not found' });
  if (conversation.platform === 'omniinbox' || conversation.workspaceId) setUnreadCount(conversation, req.user.sub, 0);
  else conversation.unreadCount = 0;
  await conversation.save();
  const peerId = conversation.memberIds?.find((id) => id !== req.user.sub);
  const peer = peerId ? await User.findById(peerId).select('_id username displayName').lean() : null;
  res.json({ conversation: toConversationView(conversation, req.user.sub, peer) });
}

export async function updateWorkflow(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !isMember(conversation, req.user.sub, req.user.workspaceId)) return res.status(404).json({ error: 'Conversation not found' });
  if (conversation.platform !== 'telegram' || !conversation.workspaceId) return res.status(409).json({ error: 'Workflow tools are available for connected Telegram conversations.' });

  const { status, assignedToId, tags } = req.body || {};
  if (status !== undefined) {
    if (!['open', 'pending', 'resolved'].includes(status)) return res.status(400).json({ error: 'Choose Open, Pending, or Resolved' });
    if (conversation.status !== status) {
      conversation.status = status;
      conversation.statusUpdatedAt = new Date();
    }
  }
  if (assignedToId !== undefined) {
    if (assignedToId !== null && typeof assignedToId !== 'string') return res.status(400).json({ error: 'Choose a valid teammate' });
    if (assignedToId && !await User.exists({ _id: assignedToId, workspaceId: conversation.workspaceId })) return res.status(400).json({ error: 'Choose a teammate in this workspace' });
    conversation.assignedToId = assignedToId || null;
  }
  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.length > 8 || tags.some((tag) => typeof tag !== 'string' || tag.trim().length < 1 || tag.trim().length > 24)) return res.status(400).json({ error: 'Use up to 8 tags, each 1–24 characters' });
    conversation.tags = [...new Set(tags.map((tag) => tag.trim().toLowerCase()))];
  }
  await conversation.save();
  await emitConversationUpdate(req.app.get('io'), conversation, User);
  res.json({ conversation: toConversationView(conversation, req.user.sub) });
}

export async function createInternalNote(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !isMember(conversation, req.user.sub, req.user.workspaceId)) return res.status(404).json({ error: 'Conversation not found' });
  if (conversation.platform !== 'telegram' || !conversation.workspaceId) return res.status(409).json({ error: 'Internal notes are available for connected Telegram conversations.' });
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 2000) return res.status(400).json({ error: 'Note must be between 1 and 2000 characters' });
  const timestamp = new Date();
  const message = await Message.create({
    _id: `msg_${randomUUID()}`,
    conversationId: conversation._id,
    platform: conversation.platform,
    kind: 'note',
    noteAuthorId: req.user.sub,
    noteAuthorName: req.user.name || req.user.username || 'Teammate',
    direction: 'outbound',
    text,
    timestamp,
    status: 'read'
  });
  conversation.lastMessagePreview = `Internal note: ${text.slice(0, 125)}`;
  conversation.lastMessageTimestamp = timestamp;
  await conversation.save();
  await emitConversationMessage(req.app.get('io'), conversation, message, User);
  res.status(201).json({ message: toMessageView(message, req.user.sub) });
}

export async function stats(req, res) {
  const filter = membershipFilter(req.user.sub, req.user.workspaceId);
  filter.isDemo = { $ne: true };
  const rows = await Conversation.find(filter).select('platform unreadCount unreadByUser ownerId').lean();
  const byPlatform = Object.fromEntries(platforms.map((platform) => [platform, 0]));
  for (const row of rows) {
    const unread = row.unreadByUser instanceof Map ? row.unreadByUser.get(req.user.sub) : row.unreadByUser?.[req.user.sub];
    const count = unread ?? (row.ownerId === req.user.sub ? row.unreadCount : 0) ?? 0;
    byPlatform[row.platform] = (byPlatform[row.platform] || 0) + count;
  }
  res.json({ totalUnread: Object.values(byPlatform).reduce((sum, count) => sum + count, 0), byPlatform });
}
