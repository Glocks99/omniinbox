import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import WebPushSubscription from '../models/WebPushSubscription.js';
import { getWebPushConfig } from '../integrations/webPush.js';

function publicPreferences(value) {
  return { sound: value?.sound !== false, vibration: value?.vibration === true };
}

export async function getNotificationSettings(req, res) {
  const [user, config, subscription] = await Promise.all([
    User.findById(req.user.sub).select('notificationPreferences').lean(),
    Promise.resolve(getWebPushConfig()),
    WebPushSubscription.exists({ userId: req.user.sub })
  ]);
  res.json({
    pushConfigured: config.configured,
    vapidPublicKey: config.configured ? config.publicKey : '',
    pushEnabled: Boolean(subscription),
    preferences: publicPreferences(user?.notificationPreferences)
  });
}

export async function savePushSubscription(req, res) {
  const { endpoint, expirationTime, keys } = req.body?.subscription || {};
  if (!getWebPushConfig().configured) return res.status(503).json({ error: 'Push notifications are not configured on this server yet.' });
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || !endpoint.startsWith('https://')
    || typeof keys?.p256dh !== 'string' || keys.p256dh.length > 256
    || typeof keys?.auth !== 'string' || keys.auth.length > 256) {
    return res.status(400).json({ error: 'The browser returned an invalid push subscription.' });
  }
  const preferences = publicPreferences((await User.findById(req.user.sub).select('notificationPreferences').lean())?.notificationPreferences);
  try {
    await WebPushSubscription.findOneAndUpdate(
      { endpoint, userId: req.user.sub },
      {
        $set: {
          workspaceId: req.user.workspaceId,
          expirationTime: expirationTime ? new Date(expirationTime) : null,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          preferences
        },
        $setOnInsert: { _id: `push_${randomUUID()}` }
      },
      { upsert: true, new: true, runValidators: true }
    );
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'This browser subscription is already connected to another account.' });
    throw error;
  }
  res.status(201).json({ enabled: true });
}

export async function removePushSubscription(req, res) {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  if (!endpoint || endpoint.length > 2048) return res.status(400).json({ error: 'A valid browser subscription endpoint is required.' });
  await WebPushSubscription.deleteOne({ endpoint, userId: req.user.sub });
  res.json({ enabled: false });
}

export async function updateNotificationPreferences(req, res) {
  const incoming = req.body || {};
  const update = {};
  if (incoming.sound !== undefined) {
    if (typeof incoming.sound !== 'boolean') return res.status(400).json({ error: 'Sound preference must be true or false.' });
    update['notificationPreferences.sound'] = incoming.sound;
  }
  if (incoming.vibration !== undefined) {
    if (typeof incoming.vibration !== 'boolean') return res.status(400).json({ error: 'Vibration preference must be true or false.' });
    update['notificationPreferences.vibration'] = incoming.vibration;
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: 'Choose a notification preference to update.' });
  const user = await User.findByIdAndUpdate(req.user.sub, { $set: update }, { new: true }).select('notificationPreferences').lean();
  const preferences = publicPreferences(user?.notificationPreferences);
  await WebPushSubscription.updateMany({ userId: req.user.sub }, { $set: { preferences } });
  res.json({ preferences });
}
