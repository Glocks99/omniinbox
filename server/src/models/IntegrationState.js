import mongoose from 'mongoose';

const integrationStateSchema = new mongoose.Schema({
  _id: { type: String },
  updateOffset: { type: Number, default: 0 },
  workspaceId: { type: String, default: '' }
}, { versionKey: false });

export default mongoose.model('IntegrationState', integrationStateSchema);
