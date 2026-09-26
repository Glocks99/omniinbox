# Project status and next steps

## Implemented

- [x] React/Vite PWA and install prompt/fallback guidance
- [x] Express/MongoDB/JWT authentication, account creation, and demo admin setup
- [x] Workspace-scoped users, owner/member roles, and expiring single-use invite links
- [x] Authenticated OmniInbox direct chats over Socket.IO
- [x] Telegram bot token handling on the server, `getUpdates` polling with persisted offsets, inbound message persistence, text sending, deduplication, and connection status
- [x] Telegram workflow: search, Open/Pending/Resolved, workspace assignees, tags, private notes, unread counts, and desktop alerts while the tab is open
- [x] Authenticated Web Push subscriptions and server delivery for Telegram and OmniInbox messages, with optional in-app sound and supported-device vibration
- [x] WhatsApp and Instagram shown as Coming soon; API rejects send/create requests for those channels
- [x] Legacy mock platform rows hidden from live inbox without deleting customer/user records
- [x] Root and package documentation aligned to actual behavior

## Setup required outside the code

- [ ] Start MongoDB and configure `MONGO_URI` in `server/.env`.
- [ ] Set a private strong `JWT_SECRET`.
- [ ] Create a bot via [@BotFather](https://t.me/BotFather), set `TELEGRAM_BOT_TOKEN`, and restart the backend. Users must start the bot before it can message them.
- [ ] Use one backend process for the bot's long polling; remove an existing bot webhook yourself if switching to polling.
- [ ] Start the client with `VITE_API_URL` pointing to the server.
- [ ] Set deployment-specific `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in the server environment; keep the private key secret. Users then opt in from the notification menu.

## Product limitations / future work

- Telegram supports private text; attachment payloads are noted but not downloaded or shown.
- Push requires HTTPS (localhost for development), configured VAPID keys, browser permission, and an active subscription. Background sound behavior is controlled by the browser/device; vibration support varies.
- WhatsApp/Instagram remain unavailable until business app access, review, and their integrations are built.
- Production deployment still needs HTTPS, managed secrets, rate limiting, monitoring, and a deliberate multi-instance Telegram worker design.
