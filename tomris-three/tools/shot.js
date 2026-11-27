#!/usr/bin/env node
// Fast preview frames without HyperFrames (software WebGL is slow: use this while iterating).
//   node tools/shot.js --t 7.5,20,40 [--sub 1] [--scale 0.5] [--out renders/preview] [--page index.html] [--q "a=b&c=d"]
//   --frames 603,1450   film frames instead of seconds
// Writes <out>/f<frame>.jpg (picture area only) and prints ms per frame. Serialised machine-wide with a lock
// so parallel callers queue instead of fighting over 4 CPU cores.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
const root = path.resolve(__dirname, "..", ".."), FPS = 30;
const page = arg("page", "tomris-three/index.html"), sub = arg("sub", "1"), scale = arg("scale", "0.5"), extra = arg("q", "");
const out = path.resolve(arg("out", path.join(root, "tomris-three/renders/preview")));
const times = arg("frames") ? arg("frames").split(",").map((f) => +f / FPS) : arg("t", "20").split(",").map(Number);
const mime = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".ktx2": "image/ktx2" };
const LOCK = "/tmp/tomris-gl.lock";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (;;) { try { fs.mkdirSync(LOCK); break; } catch { try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 30 * 60e3) fs.rmdirSync(LOCK); } catch {} await sleep(3000); } }
  const unlock = () => { try { fs.rmdirSync(LOCK); } catch {} };
  process.on("exit", unlock); process.on("SIGINT", () => process.exit(1)); process.on("SIGTERM", () => process.exit(1));
  const srv = http.createServer((q, r) => {
    const p = path.join(root, decodeURIComponent(q.url.split("?")[0]));
    fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": mime[path.extname(p)] || "application/octet-stream" }); r.end(d); } });
  });
  await new Promise((r) => srv.listen(0, r));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on("console", (m) => { if (m.type() === "error" && !/GL_INVALID_OPERATION/.test(m.text())) console.log("console.error:", m.text().slice(0, 300)); });
  p.on("pageerror", (e) => console.log("PAGE ERROR:", String(e).slice(0, 600)));
  const t0 = Date.now();
  await p.goto(`http://localhost:${srv.address().port}/${page}?sub=${sub}&scale=${scale}&warm=0${extra ? "&" + extra : ""}`);
  await p.waitForFunction(() => window.__tomris, null, { timeout: 900000 });
  console.log(`ready ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  fs.mkdirSync(out, { recursive: true });
  for (const t of times) {
    const t1 = Date.now();
    const url = await p.evaluate((t) => { window.__tomris.renderAt(t); return document.getElementById("gl").toDataURL("image/jpeg", 0.92); }, t);
    const f = path.join(out, `f${String(Math.round(t * FPS)).padStart(4, "0")}.jpg`);
    fs.writeFileSync(f, Buffer.from(url.split(",")[1], "base64"));
    fs.utimesSync(LOCK, new Date(), new Date());
    console.log(`${f}  ${Date.now() - t1} ms`);
  }
  await b.close(); srv.close(); unlock();
})().catch((e) => { console.error(e); process.exit(1); });
