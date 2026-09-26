import { randomUUID } from 'node:crypto';
import Conversation from '../models/Conversation.js';
import IntegrationState from '../models/IntegrationState.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { ensureWorkspaceForUser } from '../utils/workspace.js';
import { emitConversationMessage } from '../utils/conversationView.js';
import { sendPushToUsers } from './webPush.js';

const state = { configured: false, connected: false, botUsername: '', botName: '', workspaceId: '', error: '' };
let polling = false;
let pollController = null;

async function telegramRequest(method, body, signal) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Telegram bot token is not configured');

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram ${method} request failed`);
  return result.result;
}

export async function sendTelegramMessage(chatId, text) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram bot is not connected. Add TELEGRAM_BOT_TOKEN to the server environment.');
  return telegramRequest('sendMessage', { chat_id: chatId, text });
}

function preview(text) {
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

async function storeIncomingMessage(telegramMessage, workspaceId, ownerId, io) {
  const chat = telegramMessage.chat;
  if (!chat || chat.type !== 'private' || !telegramMessage.from || telegramMessage.from.is_bot) return null;
  const attachment = [
    ['photo', 'photo'], ['video', 'video'], ['animation', 'animation'], ['document', 'file'],
    ['audio', 'audio'], ['voice', 'voice message'], ['video_note', 'video note'],
    ['sticker', 'sticker'], ['location', 'location'], ['contact', 'contact card']
  ].find(([field]) => telegramMessage[field]);
  const body = typeof telegramMessage.text === 'string'
    ? telegramMessage.text.trim()
    : typeof telegramMessage.caption === 'string'
      ? telegramMessage.caption.trim()
      : '';
  const text = body ? `${body}${attachment ? ` [${attachment[1]} attachment]` : ''}` : attachment ? `[${attachment[1]} attachment received]` : '';
  if (!text) return null;

  const chatId = String(chat.id);
  const telegramMessageId = String(telegramMessage.message_id);
  const duplicate = await Message.exists({ telegramChatId: chatId, telegramMessageId });
  if (duplicate) return null;

  let conversation = await Conversation.findOne({ platform: 'telegram', workspaceId, telegramChatId: chatId });
  const isNew = !conversation;
  const timestamp = telegramMessage.date ? new Date(telegramMessage.date * 1000) : new Date();
  const participantName = [telegramMessage.from.first_name, telegramMessage.from.last_name].filter(Boolean).join(' ')
    || telegramMessage.from.username
    || `Telegram user ${telegramMessage.from.id}`;
  const workspace = await Workspace.findById(workspaceId).select('memberIds').lean();
  const memberIds = workspace?.memberIds?.length ? workspace.memberIds : [ownerId];
  if (!conversation) {
    conversation = new Conversation({
      _id: `conv_${randomUUID()}`,
      ownerId,
      workspaceId,
      platform: 'telegram',
      telegramChatId: chatId,
      telegramUserId: String(telegramMessage.from.id),
      telegramUsername: telegramMessage.from.username || '',
      participantName,
      lastMessagePreview: preview(text),
      lastMessageTimestamp: timestamp,
      unreadCount: 1,
      unreadByUser: Object.fromEntries(memberIds.map((id) => [id, 1])),
      status: 'open',
      statusUpdatedAt: new Date(),
      assignedToId: null
    });
  } else {
    conversation.participantName = participantName;
    conversation.telegramUsername = telegramMessage.from.username || '';
    conversation.lastMessagePreview = preview(text);
    conversation.lastMessageTimestamp = timestamp;
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    if (!(conversation.unreadByUser instanceof Map)) conversation.unreadByUser = new Map(Object.entries(conversation.unreadByUser || {}));
    for (const memberId of memberIds) conversation.unreadByUser.set(memberId, (conversation.unreadByUser.get(memberId) || 0) + 1);
    if (conversation.status !== 'open') {
      conversation.status = 'open';
      conversation.statusUpdatedAt = new Date();
    }
  }

  const isStartCommand = /^\/start(?:@\w+)?(?:\s|$)/i.test(text.trim());
  const storedText = isStartCommand ? 'Started a conversation with the bot.' : text;
  const message = new Message({
    _id: `msg_${randomUUID()}`,
    conversationId: conversation._id,
    platform: 'telegram',
    direction: 'inbound',
    text: storedText,
    timestamp,
    status: 'delivered',
    telegramChatId: chatId,
    telegramMessageId
  });
  try {
    await message.save();
    await conversation.save();
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }

  await emitConversationMessage(io, conversation, message, User);
  void sendPushToUsers(memberIds, { conversationId: conversation._id, platform: 'telegram' })
    .catch((error) => console.warn('Telegram push notification could not be queued:', error.message));
  if (isNew || isStartCommand || attachment) {
    try {
      const replyText = attachment
        ? `Thanks for the ${attachment[1]}. The team can see that you sent an attachment, but OmniInbox cannot open attachments yet. Please include any important details in text.`
        : state.botName
        ? `Thanks for contacting ${state.botName}. A team member will reply here as soon as possible.`
        : 'Thanks for contacting us. A team member will reply here as soon as possible.';
      const response = await sendTelegramMessage(chatId, replyText);
      const outbound = await Message.create({
        _id: `msg_${randomUUID()}`,
        conversationId: conversation._id,
        platform: 'telegram',
        direction: 'outbound',
        text: replyText,
        timestamp: response.date ? new Date(response.date * 1000) : new Date(),
        status: 'sent',
        telegramChatId: chatId,
        telegramMessageId: String(response.message_id)
      });
      conversation.lastMessagePreview = preview(replyText);
      conversation.lastMessageTimestamp = outbound.timestamp;
      await conversation.save();
      await emitConversationMessage(io, conversation, outbound, User);
    } catch (error) {
      console.warn('Telegram welcome reply could not be sent:', error.message);
    }
  }
  return conversation;
}

async function waitForRetry(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUpdates(io, ownerId, workspaceId, startingOffset) {
  let offset = startingOffset;
  let backoff = 1500;
  while (polling) {
    pollController = new AbortController();
    try {
      const updates = await telegramRequest('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, pollController.signal);
      state.connected = true;
      state.error = '';
      backoff = 1500;
      for (const update of updates) {
        try {
          if (update.message) await storeIncomingMessage(update.message, workspaceId, ownerId, io);
          offset = update.update_id + 1;
          await IntegrationState.findOneAndUpdate(
            { _id: 'telegram' },
            { $set: { updateOffset: offset, workspaceId } },
            { upsert: true }
          );
        } catch (error) {
          state.connected = false;
          state.error = 'Could not save a Telegram update. The bot will retry it.';
          console.error('Telegram update could not be stored:', error.message);
          break;
        }
      }
    } catch (error) {
      if (!polling) break;
      state.connected = false;
      state.error = 'Telegram is temporarily unreachable. Reconnecting…';
      console.error('Telegram polling failed:', error.message);
      await waitForRetry(backoff);
      backoff = Math.min(backoff * 2, 30000);
    } finally {
      pollController = null;
    }
  }
}

export async function startTelegramBot(io) {
  if (!process.env.TELEGRAM_BOT_TOKEN || polling) {
    state.configured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
    return;
  }

  state.configured = true;
  const ownerId = process.env.TELEGRAM_OWNER_ID || 'user_admin';
  try {
    const owner = await User.findById(ownerId);
    if (!owner) {
      state.error = 'Set TELEGRAM_OWNER_ID to an existing workspace owner.';
      console.error(state.error);
      return;
    }
    const workspaceId = await ensureWorkspaceForUser(owner);
    state.workspaceId = workspaceId;
    const webhook = await telegramRequest('getWebhookInfo', {});
    if (webhook.url) {
      state.error = 'This Telegram bot has a webhook configured. Remove it in Telegram before using polling.';
      console.error(state.error);
      return;
    }
    const bot = await telegramRequest('getMe', {});
    state.botUsername = bot.username || '';
    state.botName = bot.first_name || bot.username || '';
    const cursor = await IntegrationState.findById('telegram').select('updateOffset').lean();
    state.connected = true;
    state.error = '';
    polling = true;
    void pollUpdates(io, owner._id, workspaceId, cursor?.updateOffset || 0);
    console.log(`Telegram bot @${state.botUsername || 'connected'} is polling for messages.`);
  } catch (error) {
    state.connected = false;
    state.error = 'Could not connect to Telegram. Check TELEGRAM_BOT_TOKEN and the server network.';
    console.error('Telegram bot setup failed:', error.message);
  }
}

export function stopTelegramBot() {
  polling = false;
  pollController?.abort();
}

export async function getTelegramStatus(workspaceId) {
  const configured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  if (!configured) return { configured: false, connected: false, botUsername: '', botLink: '', error: '' };
  if (workspaceId !== state.workspaceId) return { configured: false, connected: false, botUsername: '', botLink: '', error: '' };
  return {
    configured: state.configured,
    connected: state.connected,
    botUsername: state.botUsername,
    botLink: state.botUsername ? `https://t.me/${state.botUsername}` : '',
    error: state.error
  };
}
