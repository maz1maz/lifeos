/**
 * Strips base64 @font-face from series-page.html and links core.css / core.js.
 * Run from repo root: node scripts/slim-series-page.js
 */
const fs = require('fs');
const path = require('path');
const targets = [
  path.join('public', 'design', 'series-page.html'),
  path.join('public', 'downloads', 'series-page.html'),
];
function slim(file) {
  if (!fs.existsSync(file)) {
    console.warn('skip missing', file);
    return;
  }
  let text = fs.readFileSync(file, 'utf8');
  const before = text.length;
  text = text.replace(/@font-face\{[^}]*url\(data:font\/[^)]+\)[^}]*\}/g, '/* font externalized */');
  if (!text.includes('/assets/css/core.css')) {
    text = text.replace(
      /<title>سریال‌ها · هسته<\/title>/,
      '<title>سریال‌ها · هسته</title>\n<link rel="stylesheet" href="/assets/css/core.css">\n<link rel="preload" href="/assets/fonts/Estedad.woff2" as="font" type="font/woff2" crossorigin>'
    );
  }
  if (!text.includes('/assets/js/core.js')) {
    text = text.replace('</body>', '<script src="/assets/js/core.js" defer></script>\n</body>');
  }
  fs.writeFileSync(file, text);
  console.log(file, before, '->', text.length, 'saved', before - text.length);
}
targets.forEach(slim);
