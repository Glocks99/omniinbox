# OmniInbox server

Express/Mongoose API and Socket.IO service. MongoDB stores accounts, workspaces, conversations, messages, invites, and the Telegram polling cursor. Telegram Bot API calls run only on this server. WhatsApp and Instagram are not connected and their sends are rejected.

## Local setup

1. Run a MongoDB server (Compass alone is not a database server).
2. Copy `.env.example` to `.env`, set `MONGO_URI` and a strong private `JWT_SECRET`.
3. Create a bot with [@BotFather](https://t.me/BotFather), then set `TELEGRAM_BOT_TOKEN`. `TELEGRAM_OWNER_ID` defaults to `user_admin`. Optional `CLIENT_URL` controls invite links.
4. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` for Web Push. Generate a new VAPID pair per deployment and keep the private key secret. The project-local `.env` has development keys; never copy them to production.
5. Run `npm install`, then `npm run dev`. The server ensures the demo admin/workspace and hides legacy mock records without deleting account data. Demo login: `admin@omniinbox.local` / `password123` (`admin`).

The bot uses `getUpdates` long polling. Run one backend process per bot, and make sure the bot has no active webhook. The server will detect a webhook and stop setup without removing it. Customers must start the bot before it can send them a private reply. Restart after changing environment values.

`npm run seed` safely ensures the demo account and workspace; it does not populate fake external-platform chats or wipe collections. The root [README](../README.md) describes the complete application and setup.

Push subscriptions are stored per user/browser in MongoDB. Message text is excluded from push payloads; only a generic alert and conversation link are sent. Remove or rotate VAPID keys only as part of a deliberate deployment change, since existing browser subscriptions are tied to the public key.
