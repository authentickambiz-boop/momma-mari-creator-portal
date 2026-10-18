self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === "string" && payload.title ? payload.title : "Momma Mari";
  const body = typeof payload.body === "string" ? payload.body : "";
  const url = portalUrl(payload.url);
  event.waitUntil(self.registration.showNotification(title, { body, data: { url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = portalUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(self.clients.openWindow(url));
});

function portalUrl(value) {
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  const path = typeof value === "string" && value.startsWith("/") ? value.slice(1) : "";
  return new URL(path, self.registration.scope).href;
}
