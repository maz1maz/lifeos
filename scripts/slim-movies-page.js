/**
 * Strips base64 @font-face from movies-page.html and links core.css / core.js.
 * Run: node scripts/slim-movies-page.js
 */
const fs = require('fs');
const path = require('path');
const file = path.join('public', 'design', 'movies-page.html');
if (!fs.existsSync(file)) {
  console.error('missing', file);
  process.exit(1);
}
let text = fs.readFileSync(file, 'utf8');
const before = text.length;
text = text.replace(/@font-face\{[^}]*url\(data:font\/[^)]+\)[^}]*\}/g, '/* font externalized */');
if (!text.includes('/assets/css/core.css')) {
  text = text.replace(
    /<title>[^<]*<\/title>/,
    (m) => m + '\n<link rel="stylesheet" href="/assets/css/core.css">\n<link rel="preload" href="/assets/fonts/Estedad.woff2" as="font" type="font/woff2" crossorigin>'
  );
}
if (!text.includes('/assets/js/core.js')) {
  text = text.replace('</body>', '<script src="/assets/js/core.js" defer></script>\n</body>');
}
fs.writeFileSync(file, text);
console.log(file, before, '->', text.length, 'saved', before - text.length);
