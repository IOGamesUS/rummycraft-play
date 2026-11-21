// Rummycraft's service worker (spec: /tech/web-build.md, "The app's service worker", 2026-11-20).
// The web export's own worker is replaced with this file after every export (.github/workflows/web.yml).
//
// Why: Godot's worker served the page and the 50 MB of engine and game files from its own cache
// first. An installed iPhone app could then keep an old copy, or a copy iOS had partly cleared,
// and stall on the loading bar (Ian's iPhone, 2026-11-20: stuck at about 25% from the home screen
// while Safari itself loaded). This worker keeps only what the offline page needs:
// - the page itself always comes from the network, so every launch is the newest build;
// - the engine and game files are left to the browser's normal cache, never copied here;
// - with no network, the offline page shows instead;
// - old caches (Godot's, about 50 MB) are deleted when this worker takes over.
// It still answers the page's "claim", "update" and "clear" messages, which Godot's engine sends.

const CACHE_NAME = 'Rummycraft-shell-1';
const OFFLINE_URL = 'index.offline.html';
const KEEP = [OFFLINE_URL, 'index.icon.png', 'index.apple-touch-icon.png'];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME)
		.then((cache) => cache.addAll(KEEP))
		.catch(() => null)
		.then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(caches.keys()
		.then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
		.then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
	if (event.request.mode !== 'navigate') {
		return; // everything else goes to the network and the browser's own cache
	}
	event.respondWith((async () => {
		try {
			return await fetch(event.request);
		} catch (e) {
			const offline = await caches.match(OFFLINE_URL);
			return offline || Response.error();
		}
	})());
});

self.addEventListener('message', (event) => {
	if (event.origin !== self.origin) {
		return;
	}
	const msg = event.data || '';
	if (msg === 'claim') {
		self.skipWaiting().then(() => self.clients.claim());
	} else if (msg === 'clear') {
		caches.delete(CACHE_NAME);
	} else if (msg === 'update') {
		self.skipWaiting()
			.then(() => self.clients.claim())
			.then(() => self.clients.matchAll())
			.then((all) => all.forEach((c) => c.navigate(c.url)));
	}
});
