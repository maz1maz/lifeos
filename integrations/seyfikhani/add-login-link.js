#!/usr/bin/env node
// Adds a small «ورود» link (→ studio.html) to the footer of every page of the site, and keeps
// studio.html / studio-api.php out of search engines via robots.txt. Idempotent.
// Usage:  node add-login-link.js <path-to-public_html>
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, 'index.html'))) { console.error('usage: node add-login-link.js <public_html>'); process.exit(1); }
const LINK = ' · <a href="studio.html" rel="nofollow" class="footer-login" style="color:inherit;opacity:.75">ورود</a>';
const COPY = /(محفوظ است © [۰-۹0-9]+)(<\/p>)/;
let changed = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'studio.html')) {
  const p = path.join(dir, f), s = fs.readFileSync(p, 'utf8');
  if (s.includes('href="studio.html"') || !COPY.test(s)) continue;
  fs.writeFileSync(p, s.replace(COPY, `$1${LINK}$2`)); changed++; console.log('footer link →', f);
}
// Desktop navbar: a small lock icon before «درخواست مشاوره» (hidden ≤992px like that button; mobile keeps the footer link).
const LOCK_CSS = '<style id="nav-login-css">.nav-login{display:inline-grid;place-items:center;width:38px;height:38px;margin-inline-start:.5rem;border-radius:var(--border-radius-md,10px);color:var(--primary,#24402f);border:1px solid currentColor;opacity:.55;transition:opacity .2s}.nav-login:hover,.nav-login:focus-visible{opacity:1}@media (max-width:992px){.nav-login{display:none}}</style>';
const LOCK = '<a href="studio.html" class="nav-login" rel="nofollow" aria-label="ورود" title="ورود"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></a>\n            ';
let locked = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'studio.html')) {
  const p = path.join(dir, f); let s = fs.readFileSync(p, 'utf8');
  if (s.includes('class="nav-login"') || !/<a href="consultation\.html" class="nav-cta-btn/.test(s)) continue;
  s = s.replace(/(<a href="consultation\.html" class="nav-cta-btn)/, LOCK + '$1').replace('</head>', LOCK_CSS + '\n</head>');
  fs.writeFileSync(p, s); locked++; console.log('navbar lock →', f);
}
console.log(`${locked} navbar(s) updated`);
const robots = path.join(dir, 'robots.txt');
if (fs.existsSync(robots)) {
  let r = fs.readFileSync(robots, 'utf8');
  for (const line of ['Disallow: /studio-api.php', 'Disallow: /studio.html']) if (!r.includes(line)) r = r.replace(/(Disallow: \/private\/\r?\n)/, `$1${line}\n`);
  fs.writeFileSync(robots, r);
}
console.log(`${changed} page(s) updated`);
