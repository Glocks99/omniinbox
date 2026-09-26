# Product specification

OmniInbox is a workspace inbox for direct OmniInbox chats and Telegram bot support conversations. It provides account creation, workspace membership/invites, authenticated real-time OmniInbox DMs, and Telegram text messaging through a server-configured bot.

## Working product scope

- Registration/sign-in with a personal workspace by default; invited accounts join the owner's workspace as agents.
- Inbox supports search, unread views, status/assignment filters, per-user unread counts, and live updates.
- Telegram customers initiate by messaging/starting the bot. Incoming text appears in the configured workspace; agents reply through Telegram. The bot token is server-only.
- Telegram thread management includes status, teammate assignment, tags, private notes, and basic follow-up indicators.
- OmniInbox member-to-member direct chats use authenticated Socket.IO.
- WhatsApp and Instagram show Coming soon and sends are rejected until access and integration work is complete.
- The web client is an installable PWA; offline behavior is limited to the static application shell. Opt-in Web Push delivers generic new-message alerts, and users can choose a gentle in-app sound and supported-device vibration.

## Explicit limits

Telegram polling requires one backend process and no active webhook. Users must start a bot before it can send them a private message. Attachments are only noted, not downloaded. Push requires VAPID configuration, HTTPS (or localhost), browser permission, and a saved subscription. Vibration support varies by browser/device; background notification sound follows OS settings. Calls/video and other menu functions are marked Coming soon.

Read [README.md](README.md) for local setup, [API_CONTRACT.md](API_CONTRACT.md) for routes, and [TASKS.md](TASKS.md) for external setup and future work.
