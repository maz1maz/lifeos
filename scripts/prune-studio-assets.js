// Post-build for the seyfikhani.ir studio (npm run build:studio):
// 1) LifeOS CSS points at /assets/fonts/* and /assets/img/* (LifeOS's own host); copy those files next to the
//    studio CSS and make the URLs relative, so the site serves them itself (no Google Fonts).
// 2) remove studio-assets/* files the fresh studio.html no longer references (directly or via chunks/CSS).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'integrations', 'seyfikhani', 'public_html');
const assets = path.join(dir, 'studio-assets');
const pub = path.join(root, 'public', 'assets');
const html = fs.readFileSync(path.join(dir, 'studio.html'), 'utf8');
const keep = new Set([...html.matchAll(/studio-assets\/([^"')\s]+)/g)].map(m => m[1]));
let copied = 0;
// the statement workbook's blank Excel form («📄 فایل نمونه»), served next to the studio assets
const tpl = path.join(root, 'public', 'templates', 'statement-template.xlsx');
if (fs.existsSync(tpl)) { fs.copyFileSync(tpl, path.join(assets, 'statement-template.xlsx')); keep.add('statement-template.xlsx'); copied++; }
for (const f of [...keep].filter(f => f.endsWith('.css'))) {
  const p = path.join(assets, f);
  const css = fs.readFileSync(p, 'utf8').replace(/url\((['"]?)\/assets\/(fonts|img)\/([\w.-]+)\1\)/g, (m, q, sub, name) => {
    if (!fs.existsSync(path.join(pub, sub, name))) return m;
    fs.copyFileSync(path.join(pub, sub, name), path.join(assets, name)); copied++;
    return `url(${q}${name}${q})`;
  });
  fs.writeFileSync(p, css);
  for (const m of css.matchAll(/url\((['"]?)(?:\.\/)?([\w.-]+\.(?:woff2?|ttf|otf|png|svg|webp))\1\)/g)) keep.add(m[2]);
}
for (const queue = [...keep]; queue.length;) {
  const f = queue.pop(), p = path.join(assets, f);
  if (!f.endsWith('.js') || !fs.existsSync(p)) continue;
  for (const m of fs.readFileSync(p, 'utf8').matchAll(/([\w.-]+-[\w-]{8}\.(?:js|css))/g)) if (!keep.has(m[1])) { keep.add(m[1]); queue.push(m[1]); }
}
let n = 0;
for (const f of fs.existsSync(assets) ? fs.readdirSync(assets) : []) if (!keep.has(f)) { fs.rmSync(path.join(assets, f)); n++; }
console.log(`studio post-build: ${copied} font url(s) made local, removed ${n} stale file(s)`);
