const CACHE_NAME = "origem-conecta-v3";
const APP_SHELL = ["/", "/login", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin)
    return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);

        if (response.ok) {
          // Faça a cópia antes de devolver a resposta ao navegador, que pode
          // começar a consumir o corpo imediatamente.
          const responseToCache = response.clone();
          await caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache))
            .catch(() => undefined);
        }

        return response;
      } catch {
        return (await caches.match(event.request)) || (await caches.match("/"));
      }
    })(),
  );
});
self.addEventListener("push", (event) => {
  let payload = { title: "Origem Conecta", body: "Você tem uma nova atualização.", url: "/" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: payload,
      tag: payload.notificationId ? `notification-${payload.notificationId}` : undefined,
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(targetUrl);
        return;
      }
      await self.clients.openWindow(targetUrl);
    }),
  );
});
