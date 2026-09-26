import Conversation from '../models/Conversation.js';

const legacySeedIds = Array.from({ length: 15 }, (_, index) => `conv_${String(index + 1).padStart(3, '0')}`);

export async function hideLegacyMockConversations() {
  await Conversation.updateMany(
    { _id: { $in: legacySeedIds }, ownerId: 'user_admin', platform: { $in: ['whatsapp', 'instagram', 'telegram'] } },
    { $set: { isDemo: true } }
  );
}
