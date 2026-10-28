# ◆ Zirconium

A sleek web proxy powered by [Scramjet](https://github.com/MercuryWorkshop/scramjet) by Mercury Workshop.

## Stack
- **Scramjet** – service-worker-based interception/rewriting proxy
- **bare-mux** + **epoxy-transport** – client transport layer
- **wisp-js** – Wisp protocol server (WebSocket tunnelling)
- **Fastify** – HTTP server

## Run
Requires Node.js 20+.

```bash
npm install
npm start        # http://localhost:8080  (PORT env var to change)
```

> Service workers only work on `localhost` or over **HTTPS**. Deploy behind a TLS reverse proxy (Caddy/Nginx/Cloudflare) and make sure WebSocket upgrades to `/api/ws/` are forwarded.

## Anti-fingerprinting
No default Scramjet/bare-mux/epoxy/wisp paths or filenames are exposed:

| Default | Zirconium |
|---|---|
| `/scramjet/` (proxy prefix) | `/view/` |
| `/scram/scramjet.all.js`, `.wasm.wasm`, `.sync.js` | `/cdn/c.js`, `/cdn/c.wasm`, `/cdn/s.js` |
| `/baremux/index.js`, `/baremux/worker.js` | `/lib/m.js`, `/lib/mw.js` |
| `/epoxy/index.mjs` | `/lib/t.mjs` |
| `/wisp/` | `/api/ws/` |
| `/sw.js` | `/service.js` |
| plain `encodeURIComponent` URL codec | XOR + base64url codec |

To change them, edit the alias map in `src/index.js` and the matching paths in `public/app.js` / `public/service.js`.

## Features
- Search or URL bar with selectable search engine
- In-page browser with back / forward / reload / fullscreen
- Quick shortcuts, tab cloaking and about:blank launcher
- Private/loopback IPs blocked at the Wisp server
