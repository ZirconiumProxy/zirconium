"use strict";

const $ = (id) => document.getElementById(id);

// ---- Scramjet + transport setup ----
const { ScramjetController } = $scramjetLoadController();
const scramjet = new ScramjetController({
  // Neutral prefix instead of Scramjet's default "/scramjet/"
  prefix: "/view/",
  files: {
    wasm: "/cdn/c.wasm",
    all: "/cdn/c.js",
    sync: "/cdn/s.js",
  },
  // XOR + base64url codec so proxied URLs (e.g. youtube.com) never appear
  // in plain text in the address bar / request path.
  codec: {
    encode: `(url) => {
      if (!url) return url;
      const k = "zr";
      let o = "";
      for (let i = 0; i < url.length; i++) o += String.fromCharCode(url.charCodeAt(i) ^ k.charCodeAt(i % k.length));
      return btoa(unescape(encodeURIComponent(o))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
    }`,
    decode: `(str) => {
      if (!str) return str;
      const q = str.indexOf("?");
      const h = str.indexOf("#");
      const cut = q !== -1 && h !== -1 ? Math.min(q, h) : q !== -1 ? q : h;
      const base = cut !== -1 ? str.slice(0, cut) : str;
      let suffix = cut !== -1 ? str.slice(cut) : "";
      try {
        const k = "zr";
        let b = base.replace(/-/g, "+").replace(/_/g, "/");
        while (b.length % 4) b += "=";
        const s = decodeURIComponent(escape(atob(b)));
        let o = "";
        for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length));
        if (suffix.startsWith("?") && o.includes("?")) suffix = "&" + suffix.slice(1);
        return o + suffix;
      } catch { return str; }
    }`,
  },
});
const initPromise = scramjet.init();

const connection = new BareMux.BareMuxConnection("/lib/mw.js");
const wispUrl =
  (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/api/ws/";
const TRANSPORT = "/lib/t.mjs";

async function ensureReady() {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers are not supported in this browser.");
  await initPromise;
  const reg = await navigator.serviceWorker.register("/service.js");
  reg.update().catch(() => {});
  const swReady = await navigator.serviceWorker.ready;
  await scramjet.modifyConfig({});
  (navigator.serviceWorker.controller || swReady.active)?.postMessage({
    type: "zr-reload-config",
  });
  if ((await connection.getTransport()) !== TRANSPORT) {
    await connection.setTransport(TRANSPORT, [{ wisp: wispUrl }]);
  }
}

// ---- Settings ----
const engineSel = $("engine");
const cloakSel = $("cloak");
engineSel.value = localStorage.getItem("zr-engine") || engineSel.value;
cloakSel.value = localStorage.getItem("zr-cloak") || "";
engineSel.onchange = () => localStorage.setItem("zr-engine", engineSel.value);
cloakSel.onchange = () => { localStorage.setItem("zr-cloak", cloakSel.value); applyCloak(); };

function applyCloak() {
  if (!cloakSel.value) return;
  const [title, icon] = cloakSel.value.split("|");
  document.title = title;
  document.querySelector("link[rel=icon]").href = icon;
}
applyCloak();

$("aboutblank").onclick = () => {
  const w = window.open("about:blank", "_blank");
  if (!w) return;
  const f = w.document.createElement("iframe");
  f.src = location.href;
  f.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0";
  w.document.body.style.margin = "0";
  w.document.body.appendChild(f);
  location.replace("https://classroom.google.com");
};

// ---- URL handling ----
function toUrl(input) {
  input = input.trim();
  try { return new URL(input).toString(); } catch {}
  try {
    const u = new URL("https://" + input);
    if (u.hostname.includes(".") && !input.includes(" ")) return u.toString();
  } catch {}
  return engineSel.value.replace("%s", encodeURIComponent(input));
}

// ---- Browser view ----
const frame = scramjet.createFrame();
frame.frame.id = "zr-frame";
$("frame-holder").appendChild(frame.frame);

frame.addEventListener("urlchange", (e) => {
  if (e.url) {
    $("bar").value = e.url;
    runSiteScripts();
  }
});

// ---- Per-site userscript runner (scripts/<domain-slug>.js) ----
async function runSiteScripts() {
  const win = frame.frame.contentWindow;
  const doc = frame.frame.contentDocument;
  if (!win || !doc || doc.URL === "about:blank") return;
  if (doc.readyState === "loading") return; // wait for 'load' event
  if (win._zrScriptRanFor === doc) return;

  const rawUrl = $("bar").value;
  if (!rawUrl) return;
  let host;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    return;
  }
  win._zrScriptRanFor = doc;
  try {
    const code = await fetch("/api/us?h=" + encodeURIComponent(host)).then((r) => r.text());
    if (!code.trim()) return;
    win.eval(code);
  } catch (err) {
    console.warn("Userscript error on " + host + ":", err);
  }
}

frame.frame.addEventListener("load", runSiteScripts);

async function go(input) {
  $("error").textContent = "";
  try {
    await ensureReady();
  } catch (err) {
    $("error").textContent = "Failed to start proxy: " + err.message;
    return;
  }
  const url = toUrl(input);
  $("home").hidden = true;
  $("home").style.display = "none";
  $("browser").hidden = false;
  $("bar").value = url;
  frame.go(url);
}

function goHome() {
  $("browser").hidden = true;
  $("home").style.display = "";
  $("home").hidden = false;
  frame.frame.src = "about:blank";
}

$("search-form").onsubmit = (e) => { e.preventDefault(); const v = $("address").value; if (v.trim()) go(v); };
$("bar-form").onsubmit = (e) => { e.preventDefault(); go($("bar").value); };
document.querySelectorAll(".shortcuts button").forEach((b) => (b.onclick = () => go(b.dataset.url)));
$("home-btn").onclick = goHome;
$("back-btn").onclick = () => frame.back();
$("fwd-btn").onclick = () => frame.forward();
$("reload-btn").onclick = () => frame.reload();
$("full-btn").onclick = () => frame.frame.requestFullscreen?.();
$("inspect-btn").onclick = async () => {
  try {
    const win = frame.frame.contentWindow;
    const doc = frame.frame.contentDocument || win.document;
    if (!win || !doc) return;
    if (win.eruda) {
      if (win._zrErudaShown) {
        win.eruda.hide();
        win._zrErudaShown = false;
      } else {
        win.eruda.show();
        win._zrErudaShown = true;
      }
      return;
    }
    const code = await fetch("/lib/d.js").then((r) => r.text());
    win.eval(code);
    win.eruda.init();
    win.eruda.show();
    win._zrErudaShown = true;
  } catch (e) {
    console.error("Inspect error:", e);
  }
};

// Pre-warm the service worker & transport
ensureReady().catch(() => {});
