// Ordered row saves. Task ticks are journalled before sending, so queued taps
// survive a reload as well as the request already in flight.
const chains = new Map();
const OUTBOX = 'lifeos-row-outbox-v1', CLIENT = 'lifeos-row-client-v1';
let recovery;
function storage() { try { return globalThis.sessionStorage; } catch { return null; } }
function readPending() { try { const rows = JSON.parse(storage()?.getItem(OUTBOX) || '[]'); return Array.isArray(rows) ? rows.filter(r => r && /^\/api\/(tasks|reminders)\/[^/]+$/.test(r.url) && r.method === 'PATCH' && r.body?._rowSave) : []; } catch { return []; } }
function writePending(rows) { try { if (rows.length) storage()?.setItem(OUTBOX, JSON.stringify(rows)); else storage()?.removeItem(OUTBOX); } catch { /* private mode / storage full: the normal ordered save still runs */ } }
function removePending(id) { writePending(readPending().filter(r => r.id !== id)); }
function journal(key, url, body, method) {
  if (method !== 'PATCH' || !/^\/api\/(tasks|reminders)\/[^/]+$/.test(url) || (!('done' in (body || {})) && !('mit' in (body || {})))) return { key, url, body, method };
  let client;
  try { client = JSON.parse(storage()?.getItem(CLIENT) || 'null'); } catch {}
  if (!client || typeof client.id !== 'string' || !Number.isSafeInteger(client.seq)) client = { id: crypto.randomUUID(), seq: 0 };
  client.seq++;
  try { storage()?.setItem(CLIENT, JSON.stringify(client)); } catch {}
  const meta = { client: client.id, seq: client.seq };
  const entry = { id: client.id + ':' + client.seq, key, url, method, body: { ...body, _rowSave: meta } };
  writePending([...readPending(), entry]);
  return entry;
}
async function send(entry) {
  const json = entry.body === undefined ? undefined : JSON.stringify(entry.body);
  const r = await fetch(entry.url, { method: entry.method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: !!json && json.length < 60000 });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'ذخیره نشد.'); e.status = r.status; throw e; }
  return d;
}
function enqueue(entry) {
  const attempt = async () => {
    for (let i = 0; ; i++) {
      try { const data = await send(entry); if (entry.id) removePending(entry.id); return data; }
      catch (e) { if (e.status && e.status < 500 && entry.id) removePending(entry.id); if (i >= 2 || (e.status && e.status < 500)) throw e; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
    }
  };
  const run = (chains.get(entry.key) || Promise.resolve()).then(attempt, attempt);
  const settled = run.catch(() => {});
  chains.set(entry.key, settled);
  settled.then(() => { if (chains.get(entry.key) === settled) chains.delete(entry.key); });
  return run;
}
export function saveRow(key, url, body, method = 'PATCH') { return enqueue(journal(key, url, body, method)); }
export function recoverRowSaves() {
  if (!recovery) recovery = Promise.allSettled(readPending().map(enqueue)).then(rows => rows.filter(r => r.status === 'rejected').map(r => r.reason.message));
  return recovery;
}
export function clearPendingRowSaves() { writePending([]); recovery = undefined; }
