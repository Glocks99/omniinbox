import mongoose from 'mongoose';

const webPushSubscriptionSchema = new mongoose.Schema({
  _id: { type: String },
  userId: { type: String, required: true, index: true },
  workspaceId: { type: String, required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  expirationTime: { type: Date, default: null },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  preferences: {
    sound: { type: Boolean, default: true },
    vibration: { type: Boolean, default: false }
  }
}, { versionKey: false, timestamps: true });

webPushSubscriptionSchema.index({ userId: 1, workspaceId: 1 });

export default mongoose.model('WebPushSubscription', webPushSubscriptionSchema);
