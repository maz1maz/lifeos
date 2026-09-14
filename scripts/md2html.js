#!/usr/bin/env node
/**
 * md2html.js — تبدیل Markdown ساده به HTML راست‌به‌چپ و خوانا (فارسی)
 *
 * بدون هیچ وابستگی npm. فقط چیزهایی را پشتیبانی می‌کند که در docs/*.md این پروژه
 * واقعاً استفاده شده: تیتر، پاراگراف، جدول، لیست (تودو/بولت/شماره‌دار)،
 * بلوک کد، نقل‌قول، خط جداکننده، و تأکید درون‌خطی (بولد/ایتالیک/کد/لینک).
 *
 * استفاده:
 *   node scripts/md2html.js docs/DASTYAR-BENCHMARK.md docs/DASTYAR-BENCHMARK.html "عنوان صفحه"
 */
const fs = require('fs');
const path = require('path');

/* ---------------------------------------------------------------- helpers */

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** تأکید درون‌خطی. ورودی قبلاً escape شده باشد. */
function inline(s) {
  // ابتدا کد درون‌خطی را استخراج می‌کنیم تا داخلش چیزی تفسیر نشود
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000C${codes.length - 1}\u0000`;
  });

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, alt, src, title) => `<img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ''}>`);

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, text, href, title) =>
      `<a href="${href}"${title ? ` title="${title}"` : ''} target="_blank" rel="noopener">${text}</a>`);

  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  s = s.replace(/\u0000C(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
  return s;
}

/**
 * سلول‌های یک ردیف جدول.
 * `|` فرار‌کرده (\|) جداکنندهٔ ستون نیست؛ اول با یک نویسهٔ جایگزین محافظت می‌شود
 * و در پایان به `|` معمولی برمی‌گردد.
 */
const PIPE = '\u0001';
const cells = (row) =>
  row
    .replace(/\\\|/g, PIPE)
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim().replace(new RegExp(PIPE, 'g'), '|'));

const isTableSep = (row) => /^\|?[\s:|-]+\|?$/.test(row) && row.includes('-');

/** متن تیتر → شناسهٔ لینک‌پذیر */
function slug(text, used) {
  let s = text
    .replace(/[`*_~]/g, '')
    .replace(/[()]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  if (!/[\w-]/.test(s)) s = 'sec';
  if (used.has(s)) { let i = 2; while (used.has(`${s}-${i}`)) i++; s = `${s}-${i}`; }
  used.add(s);
  return s;
}

/* ---------------------------------------------------------------- parser */

function mdToHtml(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const toc = [];
  const usedSlugs = new Set();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    /* بلوک کد ``` */
    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, '').trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // رد شدن از ``` پایانی
      out.push(`<pre${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    /* خط جداکننده */
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    /* تیتر */
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const id = slug(text, usedSlugs);
      if (level >= 2 && level <= 3) toc.push({ level, text, id });
      out.push(
        `<h${level} id="${id}">${inline(esc(text))}` +
        `<a class="anchor" href="#${id}" aria-label="پیوند این بخش">#</a></h${level}>`
      );
      i++;
      continue;
    }

    /* نقل‌قول */
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${mdToHtml(buf.join('\n')).body}</blockquote>`);
      continue;
    }

    /* جدول */
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }

      const th = head.map((c) => `<th>${inline(esc(c))}</th>`).join('');
      const tbody = rows.map((r) => {
        const td = head.map((_, ci) => `<td>${inline(esc(r[ci] || ''))}</td>`).join('');
        return `<tr>${td}</tr>`;
      }).join('\n');

      out.push(`<div class="tablewrap"><table><thead><tr>${th}</tr></thead><tbody>${tbody}</tbody></table></div>`);
      continue;
    }

    /* لیست (تودو / بولت / شماره‌دار) */
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items = [];
      let hasTask = false;

      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) {
          // خط ادامه‌ایِ تورفتگی‌دار برای همان آیتم قبلی
          if (/^\s{2,}\S/.test(lines[i]) && items.length && !/^\s*(#{1,6}|>|```)/.test(lines[i])) {
            items[items.length - 1].push(lines[i].trim());
            i++;
            continue;
          }
          break;
        }
        let text = m[3];
        const task = text.match(/^\[( |x|X)\]\s*(.*)$/);
        let checked = null;
        if (task) { checked = task[1].toLowerCase() === 'x'; text = task[2]; hasTask = true; }
        items.push([text]);
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i])) {
          items[items.length - 1].push(lines[i].trim());
          i++;
        }
      }

      const body = items.map((parts) => {
        let text = parts.join(' ');
        let cls = '';
        const task = text.match(/^\[( |x|X)\]\s*(.*)$/);
        if (task) {
          cls = task[1].toLowerCase() === 'x' ? ' class="done"' : ' class="todo"';
          const box = task[1].toLowerCase() === 'x'
            ? '<span class="box checked">✓</span>'
            : '<span class="box"></span>';
          text = box + inline(esc(task[2]));
        } else {
          text = inline(esc(text));
        }
        return `<li${cls}>${text}</li>`;
      }).join('\n');

      out.push(`<${ordered ? 'ol' : 'ul'}${hasTask ? ' class="tasklist"' : ''}>${body}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }

    /* خط خالی */
    if (!line.trim()) { i++; continue; }

    /* پاراگراف */
    const buf = [line];
    i++;
    while (
      i < lines.length && lines[i].trim() &&
      !/^(#{1,6})\s/.test(lines[i]) && !/^\s*```/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !(lines[i].trim().startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(esc(buf.join(' ')))}</p>`);
  }

  return { body: out.join('\n'), toc };
}

/* ---------------------------------------------------------------- shell */

const CSS = `
:root{
  --bg:#0b1020; --panel:#111a2e; --panel2:#16223a; --border:#22314f; --border2:#2e4266;
  --text:#e7eaf2; --muted:#9aa9c4; --faint:#6d7f9e;
  --acc:#22d3ee; --good:#34d399; --warn:#fbbf24; --bad:#f87171;
  --code:#0d1526;
}
html[data-theme="light"]{
  --bg:#f6f7fb; --panel:#ffffff; --panel2:#eef1f8; --border:#e2e7f1; --border2:#c8d2e6;
  --text:#161d2e; --muted:#5a667e; --faint:#8a94ab; --code:#f0f3fa;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0; background:var(--bg); color:var(--text);
  font-family:'Estedad','Vazirmatn',Tahoma,'Segoe UI',sans-serif;
  font-size:16.5px; line-height:2; direction:rtl;
  background-image:radial-gradient(900px 500px at 92% -8%, rgba(34,211,238,.10), transparent 60%);
  background-attachment:fixed;
}
.layout{display:grid; grid-template-columns:minmax(0,1fr) 268px; gap:34px; max-width:1240px; margin:0 auto; padding:26px 22px 90px}
@media(max-width:1080px){.layout{grid-template-columns:minmax(0,1fr); padding:18px 16px 70px}}

/* سربرگ */
.topbar{position:sticky; top:0; z-index:40; display:flex; align-items:center; gap:14px;
  padding:11px 22px; border-bottom:1px solid var(--border);
  background:color-mix(in srgb,var(--bg) 86%,transparent); backdrop-filter:blur(14px)}
.topbar .logo{width:34px;height:34px;border-radius:10px;flex:none;display:grid;place-items:center;
  background:color-mix(in srgb,var(--acc) 16%,transparent); border:1px solid color-mix(in srgb,var(--acc) 40%,transparent);
  color:var(--acc); font-weight:800; font-size:18px}
.topbar .t{font-weight:800; font-size:15.5px; letter-spacing:-.2px}
.topbar .s{color:var(--faint); font-size:12.5px; line-height:1.7}
.topbar .sp{flex:1}
.tbtn{border:1px solid var(--border); background:var(--panel); color:var(--muted);
  border-radius:10px; padding:6px 12px; font:inherit; font-size:13px; cursor:pointer; white-space:nowrap}
.tbtn:hover{color:var(--text); border-color:var(--border2)}
#bar{position:fixed; top:0; right:0; height:2px; width:0; background:var(--acc); z-index:60; transition:width .1s}

/* فهرست */
.toc{position:sticky; top:76px; align-self:start; max-height:calc(100vh - 100px); overflow:auto;
  border:1px solid var(--border); border-radius:16px; background:var(--panel); padding:14px 12px}
.toc h4{margin:2px 8px 10px; font-size:12.5px; color:var(--faint); font-weight:700; letter-spacing:.4px}
.toc a{display:block; color:var(--muted); text-decoration:none; font-size:13.5px; line-height:1.85;
  padding:4px 9px; border-radius:9px; border-right:2px solid transparent}
.toc a:hover{color:var(--text); background:var(--panel2)}
.toc a.l3{padding-right:22px; font-size:12.8px; color:var(--faint)}
.toc a.on{color:var(--acc); background:color-mix(in srgb,var(--acc) 10%,transparent); border-right-color:var(--acc)}
@media(max-width:1080px){.toc{display:none}}

/* محتوا */
main{min-width:0}
h1,h2,h3,h4{font-weight:800; line-height:1.65; scroll-margin-top:84px; letter-spacing:-.3px}
h1{font-size:29px; margin:6px 0 18px; padding-bottom:14px; border-bottom:2px solid var(--border)}
h2{font-size:22px; margin:44px 0 14px; padding:9px 14px; border-radius:12px;
  background:linear-gradient(90deg, color-mix(in srgb,var(--acc) 12%,transparent), transparent 70%);
  border-right:4px solid var(--acc)}
h3{font-size:17.5px; margin:28px 0 10px; color:var(--text)}
h4{font-size:15.5px; margin:22px 0 8px; color:var(--muted)}
.anchor{opacity:0; margin-right:8px; color:var(--faint); text-decoration:none; font-size:.8em; transition:opacity .15s}
h1:hover .anchor,h2:hover .anchor,h3:hover .anchor{opacity:.7}

p{margin:11px 0}
a{color:var(--acc)}
strong{color:#fff; font-weight:800}
html[data-theme="light"] strong{color:#0b1220}
em{color:var(--muted); font-style:normal; border-bottom:1px dotted var(--border2)}
del{color:var(--faint)}
hr{border:0; height:1px; background:var(--border); margin:34px 0}

code{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:.855em; background:var(--code); border:1px solid var(--border);
  border-radius:6px; padding:1.5px 6px; color:var(--acc); direction:ltr; unicode-bidi:embed; white-space:nowrap}
pre{background:var(--code); border:1px solid var(--border); border-radius:14px;
  padding:15px 17px; overflow:auto; direction:ltr; text-align:left; margin:16px 0}
pre code{background:none; border:0; padding:0; color:var(--muted); white-space:pre; font-size:13px; line-height:1.85}

ul,ol{margin:12px 0; padding-right:24px}
li{margin:6px 0}
ul.tasklist{list-style:none; padding-right:6px}
ul.tasklist li{display:flex; align-items:flex-start; gap:9px}
.box{flex:none; width:19px; height:19px; margin-top:9px; border-radius:6px;
  border:1.5px solid var(--border2); background:var(--panel)}
.box.checked{background:color-mix(in srgb,var(--good) 18%,transparent); border-color:var(--good);
  color:var(--good); font-size:12px; font-weight:800; display:grid; place-items:center; line-height:1}
li.done{color:var(--muted)}
li.done strong{color:var(--good)}
li.todo strong{color:var(--warn)}

blockquote{margin:18px 0; padding:13px 18px; border-right:4px solid var(--warn);
  background:color-mix(in srgb,var(--warn) 8%,transparent); border-radius:0 14px 14px 0; color:var(--muted)}
blockquote p{margin:6px 0}
blockquote strong{color:var(--warn)}

.tablewrap{overflow-x:auto; margin:16px 0; border:1px solid var(--border); border-radius:14px; background:var(--panel)}
table{border-collapse:collapse; width:100%; font-size:14.5px}
th{background:var(--panel2); color:var(--text); font-weight:800; text-align:right;
  padding:11px 13px; border-bottom:1px solid var(--border2); white-space:nowrap; font-size:13.5px}
td{padding:10px 13px; border-bottom:1px solid var(--border); vertical-align:top; line-height:1.85}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover{background:color-mix(in srgb,var(--acc) 5%,transparent)}
td code,th code{white-space:nowrap}

.top{position:fixed; bottom:22px; left:22px; width:44px; height:44px; border-radius:13px;
  border:1px solid var(--border2); background:var(--panel); color:var(--acc); font-size:19px;
  cursor:pointer; opacity:0; pointer-events:none; transition:opacity .2s; z-index:50}
.top.on{opacity:1; pointer-events:auto}
.foot{margin-top:52px; padding-top:18px; border-top:1px solid var(--border);
  color:var(--faint); font-size:13px; text-align:center}
@media print{
  body{background:#fff; color:#000; font-size:11.5pt}
  .topbar,.toc,.top,#bar,.anchor{display:none!important}
  .layout{display:block; max-width:none; padding:0}
  h2{background:none; border-right:3px solid #000; color:#000}
  .tablewrap,pre,blockquote{break-inside:avoid}
  a{color:#000; text-decoration:underline}
  strong{color:#000}
}
`;

function build(md, title, srcName) {
  const { body, toc } = mdToHtml(md);

  const tocHtml = toc.map((t) =>
    `<a class="l${t.level}" href="#${t.id}">${esc(t.text.replace(/[`*]/g, ''))}</a>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(title)} — گزارش مقایسه و تحلیل شکاف">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>">
<style>${CSS}</style>
</head>
<body>
<div id="bar"></div>
<header class="topbar">
  <div class="logo">هـ</div>
  <div>
    <div class="t">${esc(title)}</div>
    <div class="s">گزارش مقایسه · ${esc(srcName)}</div>
  </div>
  <div class="sp"></div>
  <button class="tbtn" id="themeBtn" title="تغییر تم روشن/تاریک">🌙 تاریک</button>
  <button class="tbtn" onclick="window.print()" title="چاپ یا ذخیره به PDF">🖨 چاپ</button>
</header>

<div class="layout">
  <main>
${body}
    <div class="foot">ساخته‌شده از <code>${esc(srcName)}</code> · پروژهٔ هسته (lifeos)</div>
  </main>
  <nav class="toc" id="toc">
    <h4>فهرست</h4>
${tocHtml}
  </nav>
</div>

<button class="top" id="topBtn" title="بازگشت به بالا">↑</button>
<script>
(function(){
  var b=document.getElementById('bar'),t=document.getElementById('topBtn');
  function onScroll(){
    var h=document.documentElement, m=h.scrollHeight-h.clientHeight;
    b.style.width=(m>0?(h.scrollTop/m*100):0)+'%';
    t.classList.toggle('on', h.scrollTop>420);
  }
  addEventListener('scroll',onScroll,{passive:true}); onScroll();
  t.onclick=function(){scrollTo({top:0,behavior:'smooth'})};

  var btn=document.getElementById('themeBtn');
  function setTheme(x){
    document.documentElement.setAttribute('data-theme',x);
    btn.textContent = x==='light' ? '☀️ روشن' : '🌙 تاریک';
    try{localStorage.setItem('md2html-theme',x)}catch(e){}
  }
  var saved=null; try{saved=localStorage.getItem('md2html-theme')}catch(e){}
  setTheme(saved==='light'?'light':'dark');
  btn.onclick=function(){setTheme(document.documentElement.getAttribute('data-theme')==='light'?'dark':'light')};

  var links=[].slice.call(document.querySelectorAll('#toc a'));
  var heads=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1))}).filter(Boolean);
  if('IntersectionObserver' in window && heads.length){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(!e.isIntersecting) return;
        links.forEach(function(a){a.classList.remove('on')});
        var i=heads.indexOf(e.target); if(i>-1) links[i].classList.add('on');
      });
    },{rootMargin:'-80px 0px -70% 0px',threshold:0});
    heads.forEach(function(h){io.observe(h)});
  }
})();
</script>
</body>
</html>
`;
}

/* ---------------------------------------------------------------- main */

function main() {
  const [, , inFile, outFile, titleArg] = process.argv;
  if (!inFile) {
    console.error('استفاده: node scripts/md2html.js <ورودی.md> [خروجی.html] [عنوان]');
    process.exit(1);
  }
  const src = path.resolve(inFile);
  const md = fs.readFileSync(src, 'utf8');
  const m = md.match(/^#\s+(.+)$/m);
  const title = titleArg || (m ? m[1].trim() : path.basename(src, '.md'));
  const out = path.resolve(outFile || src.replace(/\.md$/i, '') + '.html');
  fs.writeFileSync(out, build(md, title, path.basename(src)), 'utf8');

  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`✅ ${path.relative(process.cwd(), out)}  (${kb} KB)`);
}

if (require.main === module) main();
module.exports = { mdToHtml, build };
