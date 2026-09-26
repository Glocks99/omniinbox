# Data Model

MongoDB is the source of truth. Internal fields are omitted from public JSON where noted.

## User

```json
{
  "_id": "user_…",
  "email": "agent@example.com",
  "username": "agent",
  "displayName": "Agent Name",
  "workspaceId": "workspace_…",
  "role": "owner"
}
```

Passwords are stored only as bcrypt hashes. Roles are `owner` and `agent`. New accounts create a personal workspace unless an unexpired invite token is supplied. Invite tokens are stored as hashes and are single-use.
`notificationPreferences` stores account-level `{ sound, vibration }` choices; sound defaults on and vibration defaults off.

## WebPushSubscription

Stores each authenticated browser's push endpoint and encryption keys, user/workspace association, expiration time, and a snapshot of notification preferences. Endpoints are unique. Endpoints and keys are private server data and are never included in API responses. Push payloads do not contain message text.

## Workspace

```json
{ "_id": "workspace_…", "name": "Agent Name's workspace", "ownerId": "user_…", "memberIds": ["user_…"] }
```

## Conversation

```json
{
  "_id": "conv_…",
  "workspaceId": "workspace_…",
  "ownerId": "user_…",
  "memberIds": ["user_…", "user_…"],
  "platform": "telegram",
  "participantName": "Ama Boateng",
  "participantAvatarUrl": "",
  "lastMessagePreview": "Hello",
  "lastMessageTimestamp": "2026-09-26T12:00:00Z",
  "unreadCount": 1,
  "unreadByUser": { "user_…": 1 },
  "status": "open",
  "statusUpdatedAt": "2026-09-26T12:00:00Z",
  "assignedToId": null,
  "tags": [],
  "telegramUsername": "customer"
}
```

`platform` is `telegram`, `omniinbox`, `whatsapp`, or `instagram`; only Telegram and OmniInbox are live. Telegram `telegramChatId`, `telegramUserId`, workspace/owner IDs, demo flag, and unread map are internal and must not be sent to the client. `status` is `open`, `pending`, or `resolved`. OmniInbox direct conversations use `memberIds` and per-user unread counts. Old predictable seed records are flagged `isDemo` and excluded from live lists.

## Message

```json
{
  "_id": "msg_…",
  "conversationId": "conv_…",
  "platform": "telegram",
  "kind": "message",
  "direction": "inbound",
  "text": "Hello",
  "timestamp": "2026-09-26T12:00:00Z",
  "status": "delivered"
}
```

`kind` is `message` or `note`; note records also include internal author fields and are excluded from external sends and customer-message search. Telegram message/chat IDs are internal and unique per Telegram chat/message for safe update deduplication. Directions are `inbound` or `outbound`; statuses are `sent`, `delivered`, or `read`.

## IntegrationState

The Telegram integration keeps the last acknowledged `updateOffset` and its workspace ID so polling can resume after a server restart without duplicating saved messages.
