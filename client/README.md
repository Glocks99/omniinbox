# OmniInbox client

React + Vite installable PWA. It talks to the OmniInbox API and never calls Telegram or other platform APIs directly.

## Setup

Copy `.env.example` to `.env`, set `VITE_API_URL` (default `http://localhost:5000/api`), then run `npm install` and `npm run dev`. The server and MongoDB must be running for authentication, conversations, and messaging. The local development account is `admin@omniinbox.local` / `password123` (`admin`); users can create an account or follow an owner invite link.

The Telegram inbox reports bot setup/connection status and provides a link to start a chat. WhatsApp and Instagram are labeled Coming soon. Telegram supports text replies and internal team workflow; call/video/more actions are explicitly marked Coming soon. The notification menu lets each user opt in to Web Push and set in-app sound and vibration preferences. Background push needs the server's VAPID configuration and browser permission; vibration support varies by device.

For PWA installation use the download icon. If the browser does not expose an install prompt, the UI shows browser-specific manual steps. Run `npm run build` and `npm run preview` to serve a production build locally; public installability and Web Push require HTTPS (localhost is supported in development). The service worker caches the app shell only. Authentication and messaging require a live server/network.

The root [README](../README.md) describes the complete application and setup.
