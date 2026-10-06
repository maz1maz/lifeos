// هِسته / Haste — Cloudflare Worker entry (the app's only backend).
// Code lives in cloudflare/lib/: helpers.js (makeHelpers), api.js (handleApi, all /api/* routes),
// edge.js (webhook, cron, tgju, uploads, shared list), security.js (CSP + security headers).
// Edit those files directly. Tests: test/worker-smoke.js, test/smoke.js (via test/worker-host.js).
// Persistence: D1 `kv` shards the application state so no individual row can approach D1's 2 MB value
// ceiling; read()/write() keep the legacy in-memory object shape, so routes don't know how state is stored.
import { handleApi } from './lib/api.js';
import { sessionState, handleUploadGet, handleSharedShop, handleTelegramWebhook, runScheduled, handleTgju, handleTgjuHistory } from './lib/edge.js';
import { withSecurityHeaders } from './lib/security.js';

export default {
  async fetch(request, env, ctx) {
    return withSecurityHeaders(await routeRequest(request, env, ctx));
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  },
};

async function routeRequest(request, env, ctx) {
  {
    const url = new URL(request.url);
    if (url.pathname === '/api/telegram/webhook' && request.method === 'POST') return handleTelegramWebhook(request, env);
    if (url.pathname === '/api/tgju') return handleTgju(request, env);
    if (url.pathname === '/api/tgju/history') return handleTgjuHistory(request, env);
    if (url.pathname.startsWith('/uploads/') && request.method === 'GET') return handleUploadGet(url.pathname, request, env);
    if (url.pathname.startsWith('/s/') || url.pathname.startsWith('/api/s/')) return handleSharedShop(url, request, env);
    if (!url.pathname.startsWith('/api/')) {
      // 🚧 دروازه‌ی لاگین: بدون نشست معتبر، هیچ محتوایی سرو نمی‌شود — فقط صفحه‌ی ورود
      const isPublic = /^\/design\/login-page(\.html)?$/.test(url.pathname) || url.pathname === '/shared-theme.css' || url.pathname === '/shared-ui.js' || url.pathname === '/shared-shell.css' || /^\/assets\/fonts\/vazirmatn-(arabic|latin)\.woff2$/.test(url.pathname) || url.pathname === '/manifest.webmanifest' || /^\/assets\/img\/(icon-\d+|apple-touch-icon|favicon-32|logo|logo-[a-z]+)\.png$/.test(url.pathname) || url.pathname === '/favicon.ico';
      if (!isPublic) {
        let authed = false;
        try {
          authed = !!(await sessionState(request, env)).user;
        } catch (e) {}
        if (!authed) return Response.redirect(new URL('/design/login-page.html', url).toString(), 302);
      }
      return env.ASSETS.fetch(request);
    }
    return handleApi(request, env);
  }
}

