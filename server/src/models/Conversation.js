import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  _id: { type: String },
  ownerId: { type: String, required: true, index: true },
  platform: { type: String, enum: ['whatsapp', 'instagram', 'telegram', 'omniinbox'], required: true },
  workspaceId: { type: String, index: true },
  isDemo: { type: Boolean, default: false, index: true },
  memberIds: { type: [String], default: [] },
  unreadByUser: { type: Map, of: Number, default: () => ({}) },
  participantName: { type: String, required: true },
  participantAvatarUrl: { type: String, default: '' },
  lastMessagePreview: { type: String, default: '' },
  lastMessageTimestamp: { type: Date, required: true },
  unreadCount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['open', 'pending', 'resolved'], default: 'open', index: true },
  statusUpdatedAt: { type: Date, default: Date.now },
  assignedToId: { type: String, default: null, index: true },
  tags: { type: [String], default: [] },
  telegramChatId: { type: String, default: undefined },
  telegramUserId: { type: String, default: undefined },
  telegramUsername: { type: String, default: '' }
}, { versionKey: false });

export default mongoose.model('Conversation', conversationSchema);
