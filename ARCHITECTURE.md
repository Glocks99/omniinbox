# Architecture

## Runtime flow

```text
React PWA ── REST / Socket.IO ──> Express API ──> MongoDB
                                      │
                                      ├── Telegram Bot API (server token)
                                      └── Web Push services (VAPID-signed payloads)
```

The client calls only the OmniInbox API. The backend owns authentication, workspace access, conversations, message persistence, and the Telegram integration. Telegram currently uses one configured bot and long polling. The process checks `getWebhookInfo` and refuses to poll if a webhook is active; it never deletes or replaces a webhook. Run one application server process for a bot because Telegram polling permits one active `getUpdates` consumer. WhatsApp and Instagram have no integration yet and are shown as Coming soon.

For opted-in browsers, the API stores Web Push subscriptions in MongoDB and sends generic alerts after inbound messages. VAPID private keys stay in server environment variables. The service worker shows a notification when the app is not focused and opens the related inbox thread when clicked. While the app is open, user preferences control a soft in-app chime and vibration where supported.

## Data boundaries

- Users belong to a workspace and have `owner` or `member` role.
- Telegram support conversations are scoped to that workspace. Telegram chat/user IDs are internal and are omitted from client conversation JSON.
- OmniInbox conversations are direct chats between registered workspace users and use authenticated Socket.IO events.
- Internal notes are message records with `kind: note`; they are visible to workspace members and are never sent to Telegram.
- Existing seeded external-platform records are marked as demo data and hidden from the live inbox; startup does not delete user records.

## Important folders

```text
server/src/
  controllers/       Auth, conversation, workspace, and integration API behavior
  integrations/      Telegram Bot API polling and sending
  middleware/        JWT authentication and request handling
  models/            User, Workspace, WorkspaceInvite, Conversation, Message, IntegrationState, WebPushSubscription
  routes/            REST route definitions
  seed/              Non-destructive setup and demo account support
  utils/             Workspace migration and safe response helpers
client/src/
  api/               REST client
  components/        Inbox, workflow, team, thread, and PWA UI
  context/           Authentication state
  pages/             Login and dashboard
```

## Operational limits

- Telegram polling is process-local and intended for one backend instance. Persisted update offsets and duplicate message keys protect restarts and retries.
- Telegram requires the user to start the bot before it can send a private message.
- Telegram attachment binaries are not downloaded; the thread records an attachment notice.
- The service worker caches the static app shell, not API or socket data. Auth and messages require the backend/network.
- WhatsApp and Instagram are intentionally unavailable until their platform access is implemented.
