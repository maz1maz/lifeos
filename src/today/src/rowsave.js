// Row saves for ticks and toggles: the same row in tap order (a tick and an untick sent together could land
// out of order on the server, so the older state won), different rows in parallel, retried twice on server or
// network errors (not on 4xx), and small bodies sent with keepalive so a refresh doesn't cancel a save already sent.
// No imports: usable from any page, the studio panel included.
const chains = new Map();
async function send(url, method, body) {
  const json = body === undefined ? undefined : JSON.stringify(body);
  const r = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: !!json && json.length < 60000 });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'ذخیره نشد.'); e.status = r.status; throw e; }
  return d;
}
export function saveRow(key, url, body, method = 'PATCH') {
  const attempt = async () => {
    for (let i = 0; ; i++) {
      try { return await send(url, method, body); }
      catch (e) { if (i >= 2 || (e.status && e.status < 500)) throw e; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
    }
  };
  const run = (chains.get(key) || Promise.resolve()).then(attempt, attempt);
  chains.set(key, run.catch(() => {}));
  return run;
}
