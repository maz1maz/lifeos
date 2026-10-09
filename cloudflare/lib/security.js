// Security headers on every response (HawkScan DAST findings, 2026-10). HTML also gets a CSP: no third-party
// scripts, plugins, <base> hijacking or framing by other sites. Inline <script> blocks are allowed only by their
// exact sha256 — computed here from the page being served, so editing an inline script can never be blocked by
// a stale hash. Inline styles stay allowed (React and the vocab app set style attributes). The browser only calls
// open-meteo and CoinGecko directly (everything else goes through /api). Images still come from many https hosts
// (TMDB, TVmaze, team logos, Unsplash, Spotify, YouTube, URLs saved in the data), so img-src keeps https:.
const CSP_REST = [
  "default-src 'self'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:", "media-src 'self' data: blob:", "font-src 'self' data:",
  "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://air-quality-api.open-meteo.com https://api.coingecko.com", "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://open.spotify.com",
  "worker-src 'self'", "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'",
].join('; ');
const INLINE_SCRIPT_RE = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const scriptHashCache = new Map(); // html text -> "'sha256-…' …" (pages are static assets, so this stays tiny)
async function inlineScriptHashes(html) {
  if (scriptHashCache.has(html)) return scriptHashCache.get(html);
  const out = [];
  for (const m of html.matchAll(INLINE_SCRIPT_RE)) {
    if (!m[1].trim()) continue;
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m[1])));
    let bin = ''; for (const b of d) bin += String.fromCharCode(b);
    out.push(`'sha256-${btoa(bin)}'`);
  }
  const v = [...new Set(out)].join(' ');
  if (scriptHashCache.size > 200) scriptHashCache.clear();
  scriptHashCache.set(html, v);
  return v;
}
export async function withSecurityHeaders(res) {
  if (!res || res.status === 101) return res;
  const isHtml = /text\/html/i.test(res.headers.get('content-type') || '');
  let body = res.body, csp = null;
  if (isHtml && res.body) {
    body = await res.text();
    csp = `script-src 'self' ${await inlineScriptHashes(body)}`.trim() + '; ' + CSP_REST;
  }
  // stored report pages (/r/<id>): their HTML was built in the browser, so nothing in them may run
  const report = res.headers.get('X-Lifeos-Csp') === 'report';
  if (report && isHtml) csp = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  const out = new Response(body, res); // Response.redirect()/fetch() headers are immutable
  const h = out.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  h.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(self), payment=()');
  if (csp) { h.set('Content-Security-Policy', csp); h.delete('content-length'); }
  if (report) h.delete('X-Lifeos-Csp');
  return out;
}

