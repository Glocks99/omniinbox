import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema({
  _id: { type: String },
  name: { type: String, required: true },
  ownerId: { type: String, required: true, index: true },
  memberIds: { type: [String], default: [] }
}, { versionKey: false, timestamps: true });

export default mongoose.model('Workspace', workspaceSchema);
