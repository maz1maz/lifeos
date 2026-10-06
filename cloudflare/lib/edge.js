// Routes handled outside handleApi (Response building, session lookup, private uploads, the shared shopping
// list, the Telegram webhook, cron, tgju prices/history). Split out of worker.js in 2026-10; code unchanged.
import { makeHelpers } from './helpers.js';

export function buildResponse(res) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(res._headers)) {
    // Secure cookie on HTTPS (Workers always HTTPS on *.workers.dev / custom).
    // Set-Cookie must stay as N separate headers, never merged into one —
    // Headers.get/.set() on 'Set-Cookie' collapses multi-cookie responses
    // (e.g. the Google login callback, which sets sid + clears google_state
    // together) into a single garbled header that browsers can't parse.
    if (k.toLowerCase() === 'set-cookie') {
      for (let c of (Array.isArray(v) ? v : [v])) {
        if (!/;\s*Secure/i.test(c)) c += '; Secure';
        headers.append('Set-Cookie', c);
      }
    } else if (Array.isArray(v)) { for (const vv of v) headers.append(k, vv) }
    else headers.set(k, v);
  }
  if (!headers.has('X-Content-Type-Options')) headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.has('X-Frame-Options')) headers.set('X-Frame-Options', 'SAMEORIGIN');
  if (!headers.has('Referrer-Policy')) headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return new Response(res._body, { status: res._status, headers });
}

// Non-API entry points (assets, uploads and market endpoints) need the same
// session lookup as the API. Keep it on top of makeHelpers().read() so these
// paths remain compatible after legacy kv/db is migrated to state shards.
export async function sessionState(request, env) {
  const sid = (request.headers.get('cookie') || '').match(/(?:^|;\s*)sid=([^;]+)/);
  if (!sid) return { db: null, user: null };
  const db = await makeHelpers(env).read();
  const session = (db.sessions || []).find(x => x.id === sid[1]);
  const user = session && (db.users || []).find(x => x.id === session.userId && !x.disabled);
  return { db, user: user || null };
}

// Files live in Telegram, not R2: an upload route (see the ported
// /receipt and /attach handlers) sends the bytes to the owner's own bot
// chat and keeps only the returned file_id on the record. A GET here looks
// up which record owns this /uploads/<key> URL, resolves its file_id
// through Telegram's getFile + file download, and streams that back —
// the bot token never reaches the client.
export async function handleUploadGet(pathname, request, env) {
  const J = { 'Content-Type': 'application/json; charset=utf-8' };
  let userId = null, db = null;
  try {
    const state = await sessionState(request, env);
    db = state.db; userId = state.user && state.user.id;
  } catch (e) {}
  if (!userId || !db) return new Response(JSON.stringify({ error: 'ابتدا وارد حساب شوید.' }), { status: 401, headers: J });
  const url = pathname;
  const doc = (db.documents || []).find(d => d.userId === userId && d.fileUrl === url);
  const tx = !doc && (db.transactions || []).find(t => t.userId === userId && t.receipt === url);
  const att = !doc && !tx && (db.attachments || []).find(a => a.userId === userId && a.url === url);
  const fileId = doc ? doc.fileTgId : (tx ? tx.receiptTgId : (att ? att.tgId : null));
  const mime = doc ? doc.fileMime : (tx ? tx.receiptMime : (att ? att.mime : null));
  if (!fileId) return new Response('Not found', { status: 404 });
  if (!env.TELEGRAM_BOT_TOKEN) return new Response(JSON.stringify({ error: 'بات تلگرام روی این استقرار تنظیم نشده.' }), { status: 503, headers: J });
  const meta = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`).then(r => r.json()).catch(() => null);
  if (!meta || !meta.ok) return new Response('Not found', { status: 404 });
  const fileRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${meta.result.file_path}`);
  if (!fileRes.ok) return new Response('Not found', { status: 404 });
  return new Response(fileRes.body, { headers: {
    'Content-Type': mime || fileRes.headers.get('content-type') || 'application/octet-stream',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  }});
}


// Shared shopping list: family members open /s/<code> without an account; only the shopping list is exposed.
export async function handleSharedShop(url, request, env) {
  const H = makeHelpers(env), J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const code = url.pathname.split('/').filter(Boolean).pop() || '';
  if (!/^[a-f0-9]{8,32}$/.test(code)) return new Response('not found', { status: 404 });
  const db = await H.read(), user = db.users.find(u => u.shopCode === code);
  if (!user) return new Response('این لینک معتبر نیست.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  if (url.pathname.startsWith('/api/s/')) {
    const list = H.colOf(db, 'shopping');
    if (request.method === 'POST') {
      const d = await request.json().catch(() => ({}));
      if (d.add) H.shopAdd(db, user, String(d.add).split(/[،,\n]+/));
      if (d.toggle) { const it = list.find(x => x.id === d.toggle && x.userId === user.id); if (it) { it.done = !it.done; it.updatedAt = Date.now(); } }
      if (d.clearDone) db.col.shopping = list.filter(x => !(x.userId === user.id && x.done));
      await H.write(db);
    }
    const items = H.colOf(db, 'shopping').filter(x => x.userId === user.id).map(x => ({ id: x.id, text: x.text, done: !!x.done }));
    return new Response(JSON.stringify({ owner: user.displayName || user.name || '', items }), { headers: J });
  }
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لیست خرید</title><style>body{margin:0;background:#0a0a0b;color:#eee;font-family:Vazirmatn,Tahoma,sans-serif}main{max-width:560px;margin:0 auto;padding:18px 14px}h1{font-size:22px;margin:6px 0 14px}form{display:flex;gap:8px;margin-bottom:14px}input{flex:1;height:46px;border-radius:12px;border:1px solid #333;background:#151517;color:#eee;padding:0 12px;font:inherit;font-size:15px}button{height:46px;border:0;border-radius:12px;background:#d8a44c;color:#221904;font:inherit;font-weight:800;padding:0 18px}ul{list-style:none;padding:0;margin:0;display:grid;gap:6px}li{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #232327;border-radius:12px;background:#141416;font-size:16px;cursor:pointer}li i{width:22px;height:22px;border-radius:7px;border:2px solid #555;flex:none;display:grid;place-items:center;font-style:normal}li.d{opacity:.5;text-decoration:line-through}li.d i{background:#34d399;border-color:#34d399;color:#06281c}small{color:#888}.c{background:transparent;color:#fb7185;border:1px solid #fb718555;height:36px;margin-top:12px}</style></head><body><main><h1>🛒 لیست خرید <small id="o"></small></h1><form id="f"><input id="t" placeholder="چی بخریم؟ (چندتا را با ویرگول جدا کن)"><button>افزودن</button></form><ul id="l"></ul><button class="c" id="c">پاک کردن خریده‌شده‌ها</button></main><script>const A='/api/s/${code}';async function go(b){const r=await fetch(A,b?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}:{});const d=await r.json();document.getElementById('o').textContent=d.owner?'· '+d.owner:'';const l=document.getElementById('l');l.innerHTML='';d.items.sort((a,b)=>a.done-b.done).forEach(x=>{const li=document.createElement('li');li.className=x.done?'d':'';li.innerHTML='<i>'+(x.done?'✓':'')+'</i>';const s=document.createElement('span');s.textContent=x.text;li.appendChild(s);li.onclick=()=>go({toggle:x.id});l.appendChild(li)})}document.getElementById('f').onsubmit=e=>{e.preventDefault();const t=document.getElementById('t');if(t.value.trim())go({add:t.value});t.value=''};document.getElementById('c').onclick=()=>go({clearDone:true});go();setInterval(()=>go(),15000)</script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function handleTelegramWebhook(request, env) {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (got !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  }
  const H = makeHelpers(env);
  try {
    const update = await request.json();
    if (update.callback_query) {
      const db = await H.read();
      await H.handleTelegramCallback(db, update.callback_query);
    } else if (update.message && (update.message.text !== undefined || update.message.photo)) {
      const db = await H.read();
      await H.handleTelegramMessage(db, update.message);
    }
  } catch (e) { console.error('telegram webhook error', e); }
  return new Response('ok');
}

// Runs on a Cron Trigger (see wrangler.toml) instead of the Node setInterval
// loops in server.js, since a Worker has no persistent background process.
export async function runScheduled(env) {
  const H = makeHelpers(env);
  const db = await H.read();
  // reminders run on every tick (cron is every 5 min); the heavier jobs keep their old 15-minute pace
  const changed0 = await H.checkReminderNotifications(db).catch(e => { console.error('reminders', e); return false; });
  const heavy = new Date().getUTCMinutes() % 15 < 5;
  const changed1 = await H.tgCheckReports(db);
  const changed2 = heavy ? await H.refreshPricesAndAlerts(db) : false;
  const { changed: changed3 } = heavy ? await H.syncAllNewsSources(db).catch(() => ({ changed: false })) : { changed: false };
  const changed4 = await H.backupDbToTelegram(db).catch(() => false);
  const changed5 = heavy ? (await H.ensureStatementReminder(db).catch(() => ({ created: 0 }))).created > 0 : false;
  const changed6 = heavy ? (await H.syncAllGoogleCalendars(db).catch(() => ({ changed: false }))).changed : false;
  if (changed0 || changed1 || changed2 || changed3 || changed4 || changed5 || changed6) await H.write(db);
}

let TGJU_CACHE = null;
export async function handleTgju(request, env) {
  // دروازه‌ی لاگین — مثل بقیه‌ی APIها
  let authed = false;
  try {
    authed = !!(await sessionState(request, env)).user;
  } catch (e) { }
  const J = { 'Content-Type': 'application/json; charset=utf-8' };
  if (!authed) return new Response(JSON.stringify({ error: 'ابتدا وارد حساب شوید.' }), { status: 401, headers: J });
  if (TGJU_CACHE && Date.now() - TGJU_CACHE.at < 300000) return new Response(TGJU_CACHE.body, { headers: Object.assign({}, J, { 'Cache-Control': 'public,max-age=300' }) });
  const KEYS = 'price_dollar_rl,price_eur,price_gbp,price_aed,price_try,geram18,geram24,sekee,sekeb,rob,nim,mesghal,ons,oil_brent,oil,nickel,platinum,copper,silver,aluminium,aluminum';
  let items = {};
  try {
    const r = await fetch('https://call.tgju.org/ajax.json', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', 'Accept': 'application/json' } });
    const d = await r.json(); const cur = d.current || {};
    KEYS.split(',').forEach(k => { const v = cur[k]; if (v) items[k] = { p: parseFloat(String(v.p).replace(/,/g, '')) || 0, d: parseFloat(String(v.d).replace(/,/g, '')) || 0, dp: parseFloat(v.dp) || 0 }; });
  } catch (e) { return new Response(JSON.stringify({ error: 'دریافت از TGJU ناموفق بود.' }), { status: 502, headers: J }); }
  const body = JSON.stringify({ ts: Date.now(), items });
  TGJU_CACHE = { at: Date.now(), body };
  return new Response(body, { headers: Object.assign({}, J, { 'Cache-Control': 'public,max-age=300' }) });
}

// یک‌سال (یا هر بازه) نمودار برای یک ردیف بازارها — TGJU جدول تاریخی کامل هر
// نماد را در یک درخواست برمی‌گرداند (بدون صفحه‌بندی)، ستون چهارم همان قیمت
// پایانی روز است (تأییدشده روی صفحه‌ی خودِ TGJU، فیلد last_trade.PDrCotVal).
const TGJU_HIST_KEYS = new Set('price_dollar_rl,price_eur,price_gbp,price_aed,price_try,geram18,geram24,sekee,sekeb,rob,nim,mesghal,ons,oil_brent,oil,nickel,platinum,copper,silver,aluminium,aluminum'.split(','));
const TGJU_HIST_CACHE = new Map();
export const FIN_INSIGHTS = new Map(); // per-user «پیشنهادهای مالی», 6 h
// daily [{date, price}] old→new for one TGJU key (same source and cache as /api/tgju/history)
export async function tgjuSeries(key) {
  const c = TGJU_HIST_CACHE.get(key);
  if (c && Date.now() - c.at < 3600000) return JSON.parse(c.body).items || [];
  try {
    const r = await fetch('https://api.tgju.org/v1/market/indicator/summary-table-data/' + encodeURIComponent(key), { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json(), rows = Array.isArray(d.data) ? d.data.slice(0, 730) : [];
    const items = rows.map(row => { const price = parseFloat(String(row[3]).replace(/,/g, '')), g = String(row[6] || '').split('/'); const date = g.length === 3 ? g[0] + '-' + g[1].padStart(2, '0') + '-' + g[2].padStart(2, '0') : null; return date && isFinite(price) ? { date, price } : null; }).filter(Boolean).reverse();
    if (items.length) TGJU_HIST_CACHE.set(key, { at: Date.now(), body: JSON.stringify({ key, items }) });
    return items.length ? items : (c ? JSON.parse(c.body).items || [] : []);
  } catch (e) { return c ? JSON.parse(c.body).items || [] : []; }
}
// trend numbers for a daily series: changes over 1/3/12/24 months, yearly volatility, max drawdown, distance from the 200-day average
export function seriesStats(items) {
  if (!items || items.length < 20) return null;
  const last = items[items.length - 1], at = days => { const t = Date.parse(last.date) - days * 864e5; let best = items[0]; for (const x of items) { if (Date.parse(x.date) <= t) best = x; else break; } return best.price; };
  const ch = days => { const v = at(days); return v ? Math.round((last.price / v - 1) * 1000) / 10 : null; };
  const rets = []; for (let i = 1; i < items.length; i++) if (items[i - 1].price) rets.push(Math.log(items[i].price / items[i - 1].price));
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1), sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
  let peak = 0, dd = 0; for (const x of items) { peak = Math.max(peak, x.price); dd = Math.min(dd, x.price / peak - 1); }
  const tail = items.slice(-200), ma200 = tail.reduce((a, x) => a + x.price, 0) / tail.length;
  const step = Math.max(1, Math.floor(items.length / 60)), spark = items.filter((_, i) => i % step === 0 || i === items.length - 1).map(x => x.price);
  return { last: last.price, lastDate: last.date, from: items[0].date, ch1m: ch(30), ch3m: ch(91), ch1y: ch(365), ch2y: ch(730), vol: Math.round(sd * Math.sqrt(250) * 1000) / 10, maxDD: Math.round(dd * 1000) / 10, vsMa200: Math.round((last.price / ma200 - 1) * 1000) / 10, spark };
}
export async function handleTgjuHistory(request, env) {
  const J = { 'Content-Type': 'application/json; charset=utf-8' };
  let authed = false;
  try {
    authed = !!(await sessionState(request, env)).user;
  } catch (e) { }
  if (!authed) return new Response(JSON.stringify({ error: 'ابتدا وارد حساب شوید.' }), { status: 401, headers: J });
  const url = new URL(request.url);
  const key = String(url.searchParams.get('key') || '');
  // any TGJU indicator key (the Today card can show any item of the feed), not only the old fixed list
  if (!TGJU_HIST_KEYS.has(key) && !/^[a-z][a-z0-9_-]{1,40}$/.test(key)) return new Response(JSON.stringify({ error: 'نماد نامعتبر است.' }), { status: 400, headers: J });
  const days = Math.min(730, Math.max(30, parseInt(url.searchParams.get('days') || '365', 10) || 365));
  const cached = TGJU_HIST_CACHE.get(key);
  const slice = body => { const o = JSON.parse(body); o.items = (o.items || []).slice(-days); return JSON.stringify(o); };
  if (cached && Date.now() - cached.at < 3600000) return new Response(slice(cached.body), { headers: Object.assign({}, J, { 'Cache-Control': 'public,max-age=3600' }) });
  let items;
  try {
    const r = await fetch('https://api.tgju.org/v1/market/indicator/summary-table-data/' + encodeURIComponent(key), { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const rows = Array.isArray(d.data) ? d.data.slice(0, 730) : [];
    items = rows.map(row => {
      const price = parseFloat(String(row[3]).replace(/,/g, ''));
      const g = String(row[6] || '').split('/'); // YYYY/MM/DD میلادی
      const date = g.length === 3 ? g[0] + '-' + g[1].padStart(2, '0') + '-' + g[2].padStart(2, '0') : null;
      return date && isFinite(price) ? { date, price } : null;
    }).filter(Boolean).reverse(); // قدیم به جدید
  } catch (e) {
    // TGJU refused / timed out: an older copy is better than no chart
    if (cached) return new Response(slice(cached.body), { headers: Object.assign({}, J, { 'Cache-Control': 'no-store' }) });
    return new Response(JSON.stringify({ error: 'دریافت تاریخچه از TGJU ناموفق بود.' }), { status: 502, headers: J });
  }
  if (!items.length && cached) return new Response(slice(cached.body), { headers: Object.assign({}, J, { 'Cache-Control': 'no-store' }) });
  const body = JSON.stringify({ key, items });
  TGJU_HIST_CACHE.set(key, { at: Date.now(), body });
  if (TGJU_HIST_CACHE.size > 150) TGJU_HIST_CACHE.delete(TGJU_HIST_CACHE.keys().next().value);
  return new Response(slice(body), { headers: Object.assign({}, J, { 'Cache-Control': 'public,max-age=3600' }) });
}
