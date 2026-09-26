# Client spec

React/Vite single-page PWA. The client uses a JWT for REST and Socket.IO authentication; all user, workspace, integration, and message access is authorized by the server.

## Main behavior

- Account creation supports personal workspaces and owner invite links.
- Inbox lists OmniInbox direct conversations and live Telegram customer threads. WhatsApp and Instagram are disabled and labeled Coming soon.
- Search spans participant/message text; inbox filters include status, assignment, and unread-only.
- Telegram agents can assign teammates, apply tags, change status, add private notes, and send customer replies through the server.
- OmniInbox user-to-user DMs are live through Socket.IO. A Telegram customer conversation appears only after that customer starts the configured bot.
- PWA install controls request browser installation where supported and give manual browser steps otherwise. Service worker caching is limited to static app resources. Users can opt into server-delivered Web Push and configure a soft in-app sound and supported-device vibration.

## Data and UI limits

Never display Telegram internal chat/user IDs. Render `kind: note` distinctly as a team-only message. Do not suggest a WhatsApp/Instagram message was sent. No inbox/message data is available offline. Push needs configured server VAPID keys, HTTPS or localhost, browser permission, and an active subscription. Push payloads must not contain message text; background sound and vibration depend on browser/device support.
