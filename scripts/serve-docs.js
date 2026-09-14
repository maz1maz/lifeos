#!/usr/bin/env node
/**
 * serve-docs.js — سرور استاتیک کوچک برای خواندن گزارش‌های HTML در مرورگر
 *
 * بدون هیچ وابستگی npm. فقط برای مشاهدهٔ راحت‌تر فایل‌های docs/ است،
 * نه برای production (production روی Cloudflare Workers است).
 *
 *   node scripts/serve-docs.js            # پورت ۴۳۲۱
 *   PORT=8080 node scripts/serve-docs.js  # پورت دلخواه
 *
 * آدرس پیش‌فرض: /docs/DASTYAR-BENCHMARK.html
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 4321);
const HOME = '/docs/DASTYAR-BENCHMARK.html';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(url.parse(req.url).pathname); } catch { p = '/'; }
  if (p === '/' || p === '') p = HOME;

  // محافظت در برابر path traversal
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('403'); }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 — ' + p); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  });
});

// روی همهٔ اینترفیس‌ها bind می‌شود تا از preview بیرونی هم قابل دسترسی باشد
server.listen(PORT, '0.0.0.0', () => {
  console.log(`گزارش‌ها روی پورت ${PORT} در دسترس است → ${HOME}`);
});
