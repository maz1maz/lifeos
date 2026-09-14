    return json(res, 404, { error: 'Not found' });
  }
  try {
    await runRoutes();
  } catch (e) {
    if (e instanceof AuthError) { /* auth() already wrote 401 onto res */ }
    else { console.error(e); json(res, 500, { error: 'خطای داخلی سرور' }); }
  }
  return buildResponse(res);
}

function buildResponse(res) {
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

// Files live in Telegram, not R2: an upload route (see the ported
// /receipt and /attach handlers) sends the bytes to the owner's own bot
// chat and keeps only the returned file_id on the record. A GET here looks
// up which record owns this /uploads/<key> URL, resolves its file_id
// through Telegram's getFile + file download, and streams that back —
// the bot token never reaches the client.
async function handleUploadGet(pathname, request, env) {
  const J = { 'Content-Type': 'application/json; charset=utf-8' };
  let userId = null, db = null;
  try {
    const sid = (request.headers.get('cookie') || '').match(/(?:^|;\s*)sid=([^;]+)/);
    if (sid) {
      const row = await env.DB.prepare("SELECT value FROM kv WHERE key='db'").first();
      if (row) {
        db = JSON.parse(row.value);
        const s = (db.sessions || []).find(x => x.id === sid[1]);
        const u = s && (db.users || []).find(x => x.id === s.userId);
        if (u) userId = u.id;
      }
    }
  } catch (e) {}
  if (!userId || !db) return new Response(JSON.stringify({ error: 'ابتدا وارد حساب شوید.' }), { status: 401, headers: J });
  const url = pathname;
  const doc = (db.documents || []).find(d => d.userId === userId && d.fileUrl === url);
  const tx = !doc && (db.transactions || []).find(t => t.userId === userId && t.receipt === url);
  const fileId = doc ? doc.fileTgId : (tx ? tx.receiptTgId : null);
  const mime = doc ? doc.fileMime : (tx ? tx.receiptMime : null);
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

async function handleTelegramWebhook(request, env) {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (got !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  }
  const H = makeHelpers(env);
  try {
    const update = await request.json();
    if (update.message && (update.message.text !== undefined || update.message.photo)) {
      const db = await H.read();
      await H.handleTelegramMessage(db, update.message);
    }
  } catch (e) { console.error('telegram webhook error', e); }
  return new Response('ok');
}

// Runs on a Cron Trigger (see wrangler.toml) instead of the Node setInterval
// loops in server.js, since a Worker has no persistent background process.
async function runScheduled(env) {
  const H = makeHelpers(env);
  const db = await H.read();
  const changed1 = await H.tgCheckReports(db);
  const changed2 = await H.refreshPricesAndAlerts(db);
  const { changed: changed3 } = await H.syncAllNewsSources(db).catch(() => ({ changed: false }));
  const changed4 = await H.backupDbToTelegram(db).catch(() => false);
  const changed5 = (await H.ensureStatementReminder(db).catch(() => ({ created: 0 }))).created > 0;
  if (changed1 || changed2 || changed3 || changed4 || changed5) await H.write(db);
}

let TGJU_CACHE = null;
async function handleTgju(request, env) {
  // دروازه‌ی لاگین — مثل بقیه‌ی APIها
  let authed = false;
  try {
    const sid = (request.headers.get('cookie') || '').match(/(?:^|;\s*)sid=([^;]+)/);
    if (sid) {
      const row = await env.DB.prepare("SELECT value FROM kv WHERE key='db'").first();
      if (row) { const db = JSON.parse(row.value); const s = (db.sessions || []).find(x => x.id === sid[1]); authed = !!(s && (db.users || []).find(u => u.id === s.userId)); }
    }
  } catch (e) { }
  const J = { 'Content-Type': 'application/json; charset=utf-8' };
  if (!authed) return new Response(JSON.stringify({ error: 'ابتدا وارد حساب شوید.' }), { status: 401, headers: J });
  if (TGJU_CACHE && Date.now() - TGJU_CACHE.at < 300000) return new Response(TGJU_CACHE.body, { headers: Object.assign({}, J, { 'Cache-Control': 'public,max-age=300' }) });
  const KEYS = 'price_dollar_rl,price_eur,price_gbp,price_aed,price_try,geram18,geram24,sekee,sekeb,rob,nim,mesghal,oil_brent,oil,nickel,platinum,copper,silver';
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
const TGJU_HIST_KEYS = new Set('price_dollar_rl,price_eur,price_gbp,price_aed,price_try,geram18,geram24,sekee,sekeb,rob,nim,mesghal,oil_brent,oil,nickel,platinum,copper,silver'.split(','));
const TGJU_HIST_CACHE = new Map();
async function handleTgjuHistory(request, env) {
  const J = { 'Content-Type': 'application/json; charset=utf-8' };
  let authed = false;
  try {
    const sid = (request.headers.get('cookie') || '').match(/(?:^|;\s*)sid=([^;]+)/);
    if (sid) {
      const row = await env.DB.prepare("SELECT value FROM kv WHERE key='db'").first();
      if (row) { const db = JSON.parse(row.value); const s = (db.sessions || []).find(x => x.id === sid[1]); authed = !!(s && (db.users || []).find(u => u.id === s.userId)); }
    }
  } catch (e) { }
  if (!authed) return new Response(JSON.stringify({ error: 'ابتدا وارد حساب شوید.' }), { status: 401, headers: J });
  const url = new URL(request.url);
  const key = String(url.searchParams.get('key') || '');
  if (!TGJU_HIST_KEYS.has(key)) return new Response(JSON.stringify({ error: 'نماد نامعتبر است.' }), { status: 400, headers: J });
  const days = Math.min(730, Math.max(30, parseInt(url.searchParams.get('days') || '365', 10) || 365));
  const cached = TGJU_HIST_CACHE.get(key);
  if (cached && Date.now() - cached.at < 3600000) return new Response(cached.body, { headers: Object.assign({}, J, { 'Cache-Control': 'public,max-age=3600' }) });
  let items;
  try {
    const r = await fetch('https://api.tgju.org/v1/market/indicator/summary-table-data/' + encodeURIComponent(key), { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const rows = Array.isArray(d.data) ? d.data.slice(0, days) : [];
    items = rows.map(row => {
      const price = parseFloat(String(row[3]).replace(/,/g, ''));
      const g = String(row[6] || '').split('/'); // YYYY/MM/DD میلادی
      const date = g.length === 3 ? g[0] + '-' + g[1].padStart(2, '0') + '-' + g[2].padStart(2, '0') : null;
      return date && isFinite(price) ? { date, price } : null;
    }).filter(Boolean).reverse(); // قدیم به جدید
  } catch (e) { return new Response(JSON.stringify({ error: 'دریافت تاریخچه از TGJU ناموفق بود.' }), { status: 502, headers: J }); }
  const body = JSON.stringify({ key, items });
  TGJU_HIST_CACHE.set(key, { at: Date.now(), body });
  return new Response(body, { headers: Object.assign({}, J, { 'Cache-Control': 'public,max-age=3600' }) });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/telegram/webhook' && request.method === 'POST') return handleTelegramWebhook(request, env);
    if (url.pathname === '/api/tgju') return handleTgju(request, env);
    if (url.pathname === '/api/tgju/history') return handleTgjuHistory(request, env);
    if (url.pathname.startsWith('/uploads/') && request.method === 'GET') return handleUploadGet(url.pathname, request, env);
    if (!url.pathname.startsWith('/api/')) {
      // 🚧 دروازه‌ی لاگین: بدون نشست معتبر، هیچ محتوایی سرو نمی‌شود — فقط صفحه‌ی ورود
      const isPublic = /^\/design\/login-page(\.html)?$/.test(url.pathname) || url.pathname === '/shared-theme.css';
      if (!isPublic) {
        let authed = false;
        try {
          const sid = (request.headers.get('cookie') || '').match(/(?:^|;\s*)sid=([^;]+)/);
          if (sid) {
            const row = await env.DB.prepare("SELECT value FROM kv WHERE key='db'").first();
            if (row) {
              const db = JSON.parse(row.value);
              const s = (db.sessions || []).find(x => x.id === sid[1]);
              authed = !!(s && (db.users || []).find(u => u.id === s.userId));
            }
          }
        } catch (e) {}
        if (!authed) return Response.redirect(new URL('/design/login-page.html', url).toString(), 302);
      }
      return env.ASSETS.fetch(request);
    }
    return handleApi(request, env);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  },
};
