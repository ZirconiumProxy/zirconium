// v2
importScripts("/cdn/c.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

let configLoaded = false;
let configPromise = null;

function reloadConfig() {
  if (!configPromise) {
    configPromise = (async () => {
      try {
        scramjet.config = null;
        await scramjet.loadConfig();
        if (scramjet.config) configLoaded = true;
      } finally {
        configPromise = null;
      }
    })();
  }
  return configPromise;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await reloadConfig();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (
    event.data &&
    (event.data.scramjet$type === "loadConfig" || event.data.type === "zr-reload-config")
  ) {
    reloadConfig();
  }
});

async function handleRequest(event) {
  if (configPromise) {
    await configPromise;
  }
  if (!configLoaded || !scramjet.config) {
    await reloadConfig();
  }
  if (scramjet.route(event)) return scramjet.fetch(event);
  return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
