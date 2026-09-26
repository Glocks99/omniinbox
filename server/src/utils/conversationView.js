export function isMember(conversation, userId, workspaceId) {
  return conversation.memberIds?.includes(userId) || conversation.ownerId === userId || Boolean(workspaceId && conversation.workspaceId === workspaceId);
}

export function toConversationView(conversation, viewerId, peer) {
  const value = typeof conversation.toObject === 'function' ? conversation.toObject() : { ...conversation };
  const counts = value.unreadByUser;
  const unreadCount = counts instanceof Map ? counts.get(viewerId) : counts?.[viewerId];
  if (value.platform === 'omniinbox' && peer) {
    value.participantName = peer.displayName || peer.username;
    value.participantAvatarUrl = '';
  }
  value.unreadCount = Number.isFinite(unreadCount) ? unreadCount : (value.unreadCount || 0);
  delete value.ownerId;
  delete value.workspaceId;
  delete value.isDemo;
  delete value.memberIds;
  delete value.unreadByUser;
  delete value.telegramChatId;
  delete value.telegramUserId;
  return value;
}

export function toMessageView(message, viewerId) {
  const value = typeof message.toObject === 'function' ? message.toObject() : { ...message };
  if (value.senderId) value.direction = value.senderId === viewerId ? 'outbound' : 'inbound';
  delete value.senderId;
  return value;
}

export async function emitConversationMessage(io, conversation, message, User) {
  if (!io) return;
  if (conversation.platform !== 'omniinbox') {
    const memberIds = conversation.workspaceId
      ? (await User.find({ workspaceId: conversation.workspaceId }).select('_id').lean()).map((user) => user._id)
      : [conversation.ownerId];
    for (const userId of memberIds) {
      io.to(`user:${userId}`).emit('message:new', {
        conversation: toConversationView(conversation, userId),
        message: toMessageView(message, userId)
      });
    }
    return;
  }
  const members = conversation.memberIds || [];
  const profiles = await User.find({ _id: { $in: members } }).select('_id username displayName').lean();
  const byId = new Map(profiles.map((profile) => [profile._id, profile]));
  for (const userId of members) {
    const peer = byId.get(members.find((member) => member !== userId));
    io.to(`user:${userId}`).emit('message:new', {
      conversation: toConversationView(conversation, userId, peer),
      message: toMessageView(message, userId)
    });
  }
}

export async function emitConversationUpdate(io, conversation, User) {
  if (!io || !conversation.workspaceId) return;
  const memberIds = (await User.find({ workspaceId: conversation.workspaceId }).select('_id').lean()).map((user) => user._id);
  for (const userId of memberIds) {
    io.to(`user:${userId}`).emit('conversation:update', { conversation: toConversationView(conversation, userId) });
  }
}
