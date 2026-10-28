import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));
const scriptsPath = fileURLToPath(new URL("../scripts/", import.meta.url));
const erudaPath = fileURLToPath(new URL("../node_modules/eruda/", import.meta.url));

// Set WISP_LOG=debug to see Wisp connection details when troubleshooting
logging.set_level(process.env.WISP_LOG === "debug" ? logging.DEBUG : logging.ERROR);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  // Block requests to private/local networks from the proxy server
  allow_private_ips: false,
  allow_loopback_ips: false,
  // Prefer IPv4: many home/ISP networks hand out broken or half-working IPv6
  // routes, which makes outbound connections hang silently.
  dns_result_order: "ipv4first",
});

const fastify = Fastify({
  serverFactory: (handler) =>
    createServer()
      .on("request", handler)
      .on("upgrade", (req, socket, head) => {
        if (req.url.endsWith("/api/ws/")) wisp.routeRequest(req, socket, head);
        else socket.end();
      }),
});

fastify.register(fastifyStatic, { root: publicPath, decorateReply: true });

// Library files are served under neutral paths/filenames (no "scram", "epoxy",
// "baremux", "wisp" etc.) so filters can't fingerprint the proxy by URL.
// Keep these in sync with public/app.js and public/service.js.
const aliases = {
  "/cdn/c.js": [scramjetPath, "scramjet.all.js"],
  "/cdn/c.wasm": [scramjetPath, "scramjet.wasm.wasm"],
  "/cdn/s.js": [scramjetPath, "scramjet.sync.js"],
  "/lib/m.js": [baremuxPath, "index.js"],
  "/lib/mw.js": [baremuxPath, "worker.js"],
  "/lib/t.mjs": [epoxyPath, "index.mjs"],
  "/lib/d.js": [erudaPath, "eruda.js"],
};
for (const [route, [root, file]] of Object.entries(aliases)) {
  fastify.get(route, (req, reply) => reply.sendFile(file, root));
}

// Per-site userscripts from scripts/ folder (e.g. scripts/example-com.js)
fastify.get("/api/us", async (req, reply) => {
  const host = String(req.query.h || "").toLowerCase().trim();
  if (!host) return reply.type("application/javascript").send("");
  try {
    const files = new Set(await readdir(scriptsPath));
    const slug = (s) => s.replace(/\./g, "-") + ".js";
    const stripped = host.replace(/^www\./, "");
    const candidates = ["_all.js"];
    // Match exact host, stripped www., and parent domains (e.g. m.youtube.com -> youtube-com.js)
    const parts = stripped.split(".");
    for (let i = parts.length - 2; i >= 0; i--) {
      candidates.push(slug(parts.slice(i).join(".")));
    }
    if (host !== stripped) candidates.push(slug(host));

    const matched = [...new Set(candidates)].filter((f) => files.has(f));
    if (!matched.length) return reply.type("application/javascript").send("");
    const chunks = await Promise.all(
      matched.map(async (f) => `// [userscript: ${f}]\n` + (await readFile(join(scriptsPath, f), "utf8")))
    );
    return reply.type("application/javascript").send(chunks.join("\n;\n"));
  } catch {
    return reply.type("application/javascript").send("");
  }
});

fastify.setNotFoundHandler((req, reply) =>
  reply.code(404).type("text/html").sendFile("404.html")
);

const port = parseInt(process.env.PORT || "8080", 10);

fastify.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`\n  ◆ Zirconium is live at http://localhost:${port}\n`);
});

function shutdown() {
  console.log("Shutting down Zirconium...");
  fastify.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
