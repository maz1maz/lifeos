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
    if (Array.isArray(v)) { for (const vv of v) headers.append(k, vv) }
    else headers.set(k, v);
  }
  if (!headers.has('X-Content-Type-Options')) headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.has('X-Frame-Options')) headers.set('X-Frame-Options', 'SAMEORIGIN');
  if (!headers.has('Referrer-Policy')) headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Secure cookie on HTTPS (Workers always HTTPS on *.workers.dev / custom)
  const sc = headers.get('Set-Cookie');
  if (sc && !/;\s*Secure/i.test(sc)) headers.set('Set-Cookie', sc + '; Secure');
  return new Response(res._body, { status: res._status, headers });
}

async function handleUploadGet(pathname, request, env) {
  const J = { 'Content-Type': 'application/json; charset=utf-8' };
  if (!env.UPLOADS) return new Response(JSON.stringify({ error: 'ذخیره‌سازی فایل (R2) هنوز روی این استقرار فعال نشده است.' }), { status: 404, headers: J });
  let userId = null;
  try {
    const sid = (request.headers.get('cookie') || '').match(/(?:^|;\s*)sid=([^;]+)/);
    if (sid) {
      const row = await env.DB.prepare("SELECT value FROM kv WHERE key='db'").first();
      if (row) {
        const db = JSON.parse(row.value);
        const s = (db.sessions || []).find(x => x.id === sid[1]);
        const u = s && (db.users || []).find(x => x.id === s.userId);
        if (u) userId = u.id;
      }
    }
  } catch (e) {}
  if (!userId) return new Response(JSON.stringify({ error: 'ابتدا وارد حساب شوید.' }), { status: 401, headers: J });
  const key = pathname.slice('/uploads/'.length).replace(/\.\./g, '').replace(/^\/+/, '');
  if (!key || key.includes('/')) return new Response('Not found', { status: 404 });
  const obj = await env.UPLOADS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const owner = (obj.customMetadata && (obj.customMetadata.userId || obj.customMetadata.owner)) || null;
  if (owner && owner !== userId) return new Response(JSON.stringify({ error: 'دسترسی مجاز نیست.' }), { status: 403, headers: J });
  if (!owner) {
    try {
      const row = await env.DB.prepare("SELECT value FROM kv WHERE key='db'").first();
      const db = row ? JSON.parse(row.value) : { documents: [], transactions: [] };
      const url = '/uploads/' + key;
      const mine = (db.documents || []).some(d => d.userId === userId && d.fileUrl === url)
        || (db.transactions || []).some(t => t.userId === userId && t.receipt === url);
      if (!mine) return new Response(JSON.stringify({ error: 'دسترسی مجاز نیست.' }), { status: 403, headers: J });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'دسترسی مجاز نیست.' }), { status: 403, headers: J });
    }
  }
  return new Response(obj.body, { headers: {
    'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
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
    if (update.message && update.message.text !== undefined) {
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
  if (changed1 || changed2 || changed3) await H.write(db);
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/telegram/webhook' && request.method === 'POST') return handleTelegramWebhook(request, env);
    if (url.pathname === '/api/tgju') return handleTgju(request, env);
    if (url.pathname.startsWith('/uploads/') && request.method === 'GET') return handleUploadGet(url.pathname, request, env);
    if (!url.pathname.startsWith('/api/')) {
      // 🚧 دروازه‌ی لاگین: بدون نشست معتبر، هیچ محتوایی سرو نمی‌شود — فقط صفحه‌ی ورود
      const isPublic = /^\/design\/login-page(\.html)?$/.test(url.pathname);
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
