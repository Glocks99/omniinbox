import mongoose from 'mongoose';

const workspaceInviteSchema = new mongoose.Schema({
  _id: { type: String },
  tokenHash: { type: String, required: true, unique: true },
  workspaceId: { type: String, required: true, index: true },
  invitedById: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  acceptedAt: { type: Date, default: null }
}, { versionKey: false });

export default mongoose.model('WorkspaceInvite', workspaceInviteSchema);
