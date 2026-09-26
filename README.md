# OmniInbox

OmniInbox is a team inbox for direct OmniInbox chats and live Telegram bot conversations. Teams can assign Telegram threads, set Open/Pending/Resolved status, add tags, and leave private notes. WhatsApp and Instagram are visibly marked **Coming soon** and cannot send messages.

## Project layout

- `client/`: React + Vite installable PWA
- `server/`: Express, Socket.IO, MongoDB/Mongoose, authentication, workspace APIs, and Telegram Bot API polling/sending

The browser communicates with the OmniInbox server only. Telegram credentials and API calls stay server-side. Telegram uses long polling and requires that the bot has no active webhook. See [Telegram Bot API](https://core.telegram.org/bots/api).

## Setup

Requirements: Node.js 18+ and a running MongoDB server (MongoDB Compass is a client, not the database server).

1. In `server/`, install dependencies, copy `.env.example` to `.env`, set a strong `JWT_SECRET`, and set `MONGO_URI`.
2. Create a bot with [@BotFather](https://t.me/BotFather). Put its token in the server `.env` as `TELEGRAM_BOT_TOKEN`. `TELEGRAM_OWNER_ID` defaults to `user_admin`; set it to a different existing user id if another workspace owns the bot. Never put the bot token in the client or commit `.env`.
3. Start the backend with `npm run dev` from `server/`. It creates the demo admin on first startup (`admin@omniinbox.local` / `password123`, username `admin`) and its workspace. `npm run seed` is optional and does not erase user data.
4. In `client/`, install dependencies, copy `.env.example` to `.env`, set `VITE_API_URL=http://localhost:5000/api`, and run `npm run dev`.
5. Open the bot’s `t.me` link shown in the Telegram inbox and press **Start** from a Telegram account. A bot cannot initiate a private conversation before that account starts it. New Telegram messages then appear in the assigned workspace and agent replies are delivered through the bot.

Web Push is configured with VAPID keys in `server/.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`). Generate a fresh key pair for each deployment; keep the private key server-side and use HTTPS in production (localhost is supported for development). In the inbox notification menu, choose **Enable push** and allow browser notifications. Sound and vibration are optional per-account preferences; vibration depends on device/browser support, and background sound follows the device's notification settings.

## Vercel deployment

The `client/vercel.json` builds the Vite client and rewrites direct URLs to the SPA entry page. In Vercel, set the project Root Directory to `client` so Vercel uses this configuration. Add `omnichatinbox.chat` and `www.omnichatinbox.chat` under **Project Settings → Domains**. Use Vercel's recommended DNS values in Namecheap; the usual setup is an apex `A` record for `@` to `76.76.21.21` and a `CNAME` record for `www` to `cname.vercel-dns.com`. If Vercel shows different values for this project, use the dashboard values. Set `www` to redirect to the apex domain. The production client defaults to `https://omniinbox-server.onrender.com/api`; set `VITE_API_URL` in Vercel's project environment variables only if you want to override that API URL.

## Render server deployment

The root `render.yaml` defines the Express/Socket.IO server as a Render web service. In Render, create or sync a Blueprint from this repository and enter the prompted `MONGO_URI`, Telegram token, existing VAPID key pair, and VAPID contact URI through the dashboard; Render generates `JWT_SECRET`. Never put secret values in this repository. The Blueprint allows both `https://omnichatinbox.chat` and `https://www.omnichatinbox.chat` as client origins and uses the apex URL for invite links. Also allow Render's outbound database connections in Atlas Network Access. The free Render service sleeps after 15 minutes without inbound traffic, so Telegram polling pauses while it sleeps; choose an always-on paid plan if continuous Telegram intake is required. [Render free instance behavior](https://render.com/docs/free).

The production build adds canonical, Open Graph, Twitter, and SoftwareApplication metadata, plus `robots.txt` and `sitemap.xml`. It uses `VITE_SITE_URL` when set, or the configured canonical domain `https://omnichatinbox.chat`. After deployment, submit `https://omnichatinbox.chat/sitemap.xml` in Google Search Console. The site currently has one public URL; authenticated conversations are not listed.

WhatsApp and Instagram are deferred pending the required platform access and review. The app reports those channels as unavailable and rejects sends instead of pretending delivery occurred.

## Features

- Account registration and optional workspace invite links
- Workspace-scoped team membership and direct OmniInbox chat over Socket.IO
- Telegram Bot API inbound long polling and outbound text replies
- Telegram support workflow: status, assignee, tags, internal notes, inbox search, and unread counts
- Installable PWA, static shell caching, in-app install guidance, authenticated Web Push, and optional sound/vibration preferences

Authentication, live messaging, and API access need the backend and network. The service worker does not make conversations or sends available offline. Push delivery needs server VAPID keys and a browser subscription. Telegram attachments are currently represented by a notice; their contents are not downloaded or displayed.

For setup and implementation notes, see the [client README](client/README.md) and [server README](server/README.md).
