import { getTelegramStatus } from '../integrations/telegram.js';

export async function telegramStatus(req, res) {
  res.json(await getTelegramStatus(req.user.workspaceId));
}
