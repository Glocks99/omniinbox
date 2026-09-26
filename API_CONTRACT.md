# API Contract

Base URL: `http://localhost:5000/api`. All routes except login and register require `Authorization: Bearer <jwt>`. Errors use `{ "error": "Human readable message" }`.

## Authentication and workspace

- `POST /auth/register`: `{ displayName, username, email, password, inviteToken? }`. Creates an account and either its personal workspace or joins the invite's workspace. Returns `{ token, user }` with status 201.
- `POST /auth/login`: `{ email, password }`. Returns `{ token, user }`.
- `GET /workspace`: current workspace and members.
- `POST /workspace/invites`: owner only; returns a one-use invite URL/token, valid for seven days.

## Conversations and messages

- `GET /conversations?platform=&status=&assigned=&q=` lists workspace chats. `platform` accepts `telegram`, `omniinbox`, `whatsapp`, `instagram`; live data currently exists only for Telegram and OmniInbox. `status` is open/pending/resolved. `assigned` accepts `me` or `unassigned`. Search matches participant, preview, or message text (not private notes).
- `POST /conversations`: starts an OmniInbox direct chat with `{ recipientId, platform: "omniinbox", text }`. It cannot create Telegram conversations; the customer must message the bot first. WhatsApp/Instagram return 409 Coming soon.
- `GET /conversations/:id/messages`: authorized thread messages, oldest first.
- `POST /conversations/:id/messages`: `{ text }`. OmniInbox uses Socket.IO; Telegram calls Bot API and persists only after successful delivery. WhatsApp/Instagram reject the send. Telegram API errors are returned as a readable 502 error.
- `PATCH /conversations/:id/read`: clears the current user's unread count.
- `PATCH /conversations/:id`: Telegram workflow fields `{ status?, assignedToId?, tags? }`. Assignment must refer to a workspace teammate; up to eight tags, each 1–24 characters.
- `POST /conversations/:id/notes`: `{ text }`. Adds a private workspace note without sending it to the customer.
- `GET /stats`: unread totals by platform for the current user.
- `GET /notifications/settings`: Web Push configuration and public VAPID key, current user's subscription state, and sound/vibration preferences.
- `POST /notifications/subscriptions`: stores the authenticated browser subscription `{ subscription }`; requires configured server VAPID keys.
- `DELETE /notifications/subscriptions`: removes this user's browser subscription `{ endpoint }`.
- `PATCH /notifications/preferences`: updates `{ sound?, vibration? }` for the account and its subscriptions.
- `GET /integrations/telegram`: configured/connected status, bot username/link, and non-secret setup error. Never returns the token.
- `GET /users/search?q=name-or-username`: matching registered OmniInbox users (excluding current user).

## Socket.IO

Connect to the API origin with `auth: { token }`. OmniInbox direct chat supports `conversation:join`, `conversation:leave`, and callback-based `message:send` with `{ conversationId, text }`. Server broadcasts `message:new` and `conversation:update` only to authorized participants. Telegram updates are received by the server poller and broadcast to workspace members.

## Integration boundaries

Telegram inbound updates are received using Bot API `getUpdates` long polling; outbound replies use `sendMessage`. Configure a token on the backend only. Polling cannot run with a webhook active; the server reports this conflict and will not clear it automatically. WhatsApp and Instagram APIs are not implemented and sends are rejected.

Web Push subscriptions are authenticated and associated with a user/workspace. The backend signs deliveries using VAPID private keys from its environment; only the public key is returned to authenticated clients. Push payloads contain a generic notification body and conversation routing metadata, never message text. Expired endpoints are removed after push-service 404/410 responses.

Conversation JSON omits private database identifiers such as Telegram chat/user IDs, workspace/owner IDs, and unread maps. Note messages carry `kind: "note"` and author information; clients must render them as internal-only.
