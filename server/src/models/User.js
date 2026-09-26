import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  _id: { type: String },
  email: { type: String, required: true, unique: true },
  displayName: { type: String, default: '' },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  workspaceId: { type: String, index: true },
  role: { type: String, enum: ['owner', 'agent'], default: 'owner' },
  notificationPreferences: {
    sound: { type: Boolean, default: true },
    vibration: { type: Boolean, default: false }
  }
}, { versionKey: false });

export default mongoose.model('User', userSchema);
