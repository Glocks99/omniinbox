import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  _id: { type: String },
  conversationId: { type: String, required: true, index: true },
  platform: { type: String, enum: ['whatsapp', 'instagram', 'telegram', 'omniinbox'], required: true },
  senderId: { type: String },
  kind: { type: String, enum: ['message', 'note'], default: 'message' },
  noteAuthorId: { type: String },
  noteAuthorName: { type: String },
  telegramChatId: { type: String },
  telegramMessageId: { type: String },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, required: true },
  status: { type: String, enum: ['sent', 'delivered', 'read'], required: true }
}, { versionKey: false });

messageSchema.index({ telegramChatId: 1, telegramMessageId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Message', messageSchema);
