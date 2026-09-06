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
  return new Response(res._body, { status: res._status, headers });
}

async function handleUploadGet(pathname, env) {
  if (!env.UPLOADS) return new Response(JSON.stringify({ error: 'ذخیره‌سازی فایل (R2) هنوز روی این استقرار فعال نشده است.' }), { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  const key = pathname.slice('/uploads/'.length);
  const obj = await env.UPLOADS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, { headers: { 'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream' } });
}

async function handleTelegramWebhook(request, env) {
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/telegram/webhook' && request.method === 'POST') return handleTelegramWebhook(request, env);
    if (url.pathname.startsWith('/uploads/') && request.method === 'GET') return handleUploadGet(url.pathname, env);
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
