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
const robots = path.join(dir, 'robots.txt');
if (fs.existsSync(robots)) {
  let r = fs.readFileSync(robots, 'utf8');
  for (const line of ['Disallow: /studio-api.php', 'Disallow: /studio.html']) if (!r.includes(line)) r = r.replace(/(Disallow: \/private\/\r?\n)/, `$1${line}\n`);
  fs.writeFileSync(robots, r);
}
console.log(`${changed} page(s) updated`);
