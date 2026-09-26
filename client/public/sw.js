const SHELL_CACHE = 'omniinbox-shell-v2';
const ASSET_CACHE = 'omniinbox-assets-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.svg', '/icons/icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('omniinbox-') && ![SHELL_CACHE, ASSET_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch { payload = {}; }
    const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : '';
    const platform = payload.platform === 'telegram' ? 'telegram' : 'omniinbox';
    const relativeUrl = typeof payload.url === 'string' ? payload.url : `/?platform=${platform}&conversation=${encodeURIComponent(conversationId)}`;
    const notificationData = { url: relativeUrl, conversationId, platform };
    const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const focusedClient = openClients.find((client) => client.visibilityState === 'visible' && client.focused);
    if (focusedClient) {
      focusedClient.postMessage({ type: 'OMNIINBOX_PUSH', payload: notificationData });
      return;
    }

    const options = {
      body: typeof payload.body === 'string' ? payload.body : 'Open OmniInbox to read and reply.',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      tag: `omniinbox-${conversationId || platform}`,
      data: notificationData,
      renotify: false
    };
    if (payload.vibrationEnabled) options.vibrate = [90, 35, 90];
    await self.registration.showNotification(typeof payload.title === 'string' ? payload.title : 'New OmniInbox message', options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    let targetUrl;
    try {
      targetUrl = new URL(event.notification.data?.url || '/', self.location.origin);
      if (targetUrl.origin !== self.location.origin) targetUrl = new URL('/', self.location.origin);
    } catch {
      targetUrl = new URL('/', self.location.origin);
    }
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        if ('navigate' in client) await client.navigate(targetUrl.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl.href);
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/src/') || url.pathname.startsWith('/node_modules/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', response.clone()));
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || (await caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
