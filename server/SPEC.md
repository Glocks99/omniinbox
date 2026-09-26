# Server spec

The server owns authentication, workspace boundaries, persistent inbox data, and all Telegram credentials and Bot API traffic. Shared JSON shapes are in `../DATA_MODEL.md`; route behavior is in `../API_CONTRACT.md`.

## Source structure

- `src/models/`: User, Workspace, WorkspaceInvite, Conversation, Message, IntegrationState
- `src/controllers/` and `src/routes/`: authenticated REST behavior
- `src/integrations/telegram.js`: Bot API `getMe`, webhook check, persisted-offset long polling, inbound update persistence, and outbound `sendMessage`
- `src/integrations/webPush.js`: VAPID setup, generic push delivery, and stale-subscription cleanup
- `src/socket.js`: authenticated OmniInbox direct messages and workspace-scoped broadcasts
- `src/utils/`: workspace creation/migration, legacy mock hiding, and safe public response shaping
- `src/server.js`: Mongo connection, demo account bootstrap, server/socket startup, Telegram poller lifecycle

Keep the bot token in server `.env` only. Polling requires no active webhook and a single backend poller. The integration never removes a webhook. Incoming private messages open or update a workspace Telegram conversation; agent replies are sent through Telegram and saved only after delivery. Internal notes never leave OmniInbox. WhatsApp and Instagram are not integrated.

Startup/seed paths preserve user data. Existing known seeded external platform records are marked as demo and hidden rather than deleted. The demo admin credentials are for local development and must not be exposed in production.

Web Push uses authenticated subscriptions stored in `WebPushSubscription`; `VAPID_PRIVATE_KEY` must remain server-side. Payloads omit message contents. Client opt-in requires notification permission and an active service worker.
