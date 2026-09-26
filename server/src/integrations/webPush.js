import webpush from 'web-push';
import WebPushSubscription from '../models/WebPushSubscription.js';

export function getWebPushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  return { configured: Boolean(publicKey && privateKey), publicKey };
}

function configureWebPush() {
  const config = getWebPushConfig();
  if (!config.configured) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@omniinbox.local', config.publicKey, process.env.VAPID_PRIVATE_KEY);
  return true;
}

export async function sendPushToUsers(userIds, { conversationId, platform }) {
  if (!configureWebPush()) return;
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (!ids.length) return;
  const subscriptions = await WebPushSubscription.find({ userId: { $in: ids } }).lean();
  await Promise.all(subscriptions.map(async (saved) => {
    const subscription = { endpoint: saved.endpoint, expirationTime: saved.expirationTime?.getTime?.() || null, keys: saved.keys };
    const title = platform === 'telegram' ? 'New Telegram message' : 'New OmniInbox message';
    const payload = {
      title,
      body: 'Open OmniInbox to read and reply.',
      conversationId,
      platform,
      vibrationEnabled: Boolean(saved.preferences?.vibration),
      url: `/?platform=${encodeURIComponent(platform)}&conversation=${encodeURIComponent(conversationId)}`
    };
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 600, urgency: 'normal' });
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await WebPushSubscription.deleteOne({ _id: saved._id });
      } else {
        console.warn('Web push delivery failed:', error.statusCode || 'unknown status');
      }
    }
  }));
}
