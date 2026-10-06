// Runs the real cloudflare/worker.js inside Node behind a plain HTTP server, so test/smoke.js can drive the
// Worker exactly the way it used to drive server.js (spawned process, PORT, DB_PATH).
//
// Storage: the fake D1 kv table from test/d1-kv-fake.js, mirrored to DB_PATH as one JSON object:
//  - after every request the full state (as the Worker's own read() sees it) is written to DB_PATH;
//  - if a test edits DB_PATH directly, the next request loads that JSON as the legacy `db` row, which the
//    Worker migrates into its v2 shards (same path a pre-v2 production database takes).
// Static files come from public/ (SPA fallback to index.html), like the wrangler `assets` binding.
//
// Usage: PORT=3000 DB_PATH=/tmp/db.json node test/worker-host.js   — env vars are passed to the Worker as `env`.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const { makeKvD1 } = require('./d1-kv-fake');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

async function loadWorker() {
  // worker.js is an ES module; import a copy with makeHelpers exported so the host can read the full state.
  const src = fs.readFileSync(path.join(ROOT, 'cloudflare', 'worker.js'), 'utf8');
  if (!/\nfunction makeHelpers\(env\)/.test(src)) throw new Error('worker.js: makeHelpers(env) not found — update test/worker-host.js');
  const tmp = path.join(__dirname, `.tmp-worker-host-${process.pid}.mjs`);
  fs.writeFileSync(tmp, src + '\nexport { makeHelpers as __makeHelpers };\n');
  try { return await import(pathToFileURL(tmp).href); } finally { fs.rmSync(tmp, { force: true }); }
}

function assets() {
  const file = p => { try { const f = path.join(PUBLIC, decodeURIComponent(p)); if (!f.startsWith(PUBLIC)) return null; const st = fs.statSync(f); return st.isFile() ? f : st.isDirectory() && fs.existsSync(path.join(f, 'index.html')) ? path.join(f, 'index.html') : null; } catch { return null; } };
  return {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      const f = file(pathname) || file(pathname + '.html') || (path.extname(pathname) ? null : file('/index.html'));
      if (!f) return new Response('not found', { status: 404 });
      return new Response(fs.readFileSync(f), { status: 200, headers: { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' } });
    },
  };
}

async function main() {
  const PORT = Number(process.env.PORT) || 3000;
  const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : null;
  const mod = await loadWorker();
  const worker = mod.default;
  const store = new Map();
  const env = { ...process.env, DB: makeKvD1(store), ASSETS: assets() };
  let mirrored = null; // the DB_PATH text this host wrote last

  const syncIn = () => {
    if (!DB_PATH || !fs.existsSync(DB_PATH)) return;
    const text = fs.readFileSync(DB_PATH, 'utf8');
    if (text === mirrored) return;
    // edited (or created) outside the Worker: start from it, as a legacy single-row database
    for (const k of [...store.keys()]) if (k === 'db' || k.startsWith('state:v2:')) store.delete(k);
    store.set('db', text);
    mirrored = text;
  };
  const syncOut = async () => {
    if (!DB_PATH) return;
    const db = await mod.__makeHelpers(env).read();
    const text = JSON.stringify(db, null, 2);
    if (text !== mirrored) { fs.writeFileSync(DB_PATH, text); mirrored = text; }
  };

  // Requests run concurrently, like production isolates: a slow upstream fetch (tgju, weather) must not stall
  // the rest. The Worker's own D1 write guards handle overlapping writes.
  const server = http.createServer((req, res) => {
    (async () => {
      try {
        syncIn();
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = chunks.length && !['GET', 'HEAD'].includes(req.method) ? Buffer.concat(chunks) : undefined;
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
        const request = new Request(`http://${req.headers.host || 'localhost:' + PORT}${req.url}`, { method: req.method, headers, body, redirect: 'manual' });
        const waits = [];
        const response = await worker.fetch(request, env, { waitUntil: p => waits.push(Promise.resolve(p).catch(() => {})), passThroughOnException() {} });
        await Promise.all(waits);
        await syncOut();
        const out = {};
        response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
        const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
        if (cookies.length) out['set-cookie'] = cookies;
        const buf = Buffer.from(await response.arrayBuffer());
        res.writeHead(response.status, out);
        res.end(req.method === 'HEAD' ? undefined : buf);
      } catch (e) {
        console.error('worker-host error', e);
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('worker-host error: ' + (e && e.message));
      }
    })();
  });
  server.listen(PORT, '127.0.0.1', () => console.log(`worker-host on ${PORT}${DB_PATH ? ' · DB_PATH=' + DB_PATH : ''}`));
}

main().catch(e => { console.error(e); process.exit(1); });
