// Removes studio-assets/* files that the freshly built studio.html no longer references.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'integrations', 'seyfikhani', 'public_html');
const html = fs.readFileSync(path.join(dir, 'studio.html'), 'utf8');
const assets = path.join(dir, 'studio-assets');
const keep = new Set([...html.matchAll(/studio-assets\/([^"')\s]+)/g)].map(m => m[1]));
// lazily imported chunks are referenced from the entry chunk, not from the HTML
for (const queue = [...keep]; queue.length;) {
  const f = queue.pop(), p = path.join(assets, f);
  if (!f.endsWith('.js') || !fs.existsSync(p)) continue;
  for (const m of fs.readFileSync(p, 'utf8').matchAll(/([\w.-]+-[\w-]{8}\.(?:js|css))/g)) if (!keep.has(m[1])) { keep.add(m[1]); queue.push(m[1]); }
}
let n = 0;
for (const f of fs.existsSync(assets) ? fs.readdirSync(assets) : []) if (!keep.has(f)) { fs.rmSync(path.join(assets, f)); n++; }
console.log(`prune-studio-assets: removed ${n} stale file(s)`);
