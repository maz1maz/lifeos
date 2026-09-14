// One-time build script: extracts the route-handling body from ../server.js
// and mechanically converts Node-only APIs (fs, Buffer, crypto.*Sync) to
// Workers-compatible equivalents. Run with: node cloudflare/port.js
// Not part of the deployed app itself.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const lines = src.split('\n');

// Route block: from the signup route through the last investments/alerts route,
// i.e. everything inside handleRequest's try{} except the static-file fallback.
const startMarker = " if(p==='/api/auth/signup'";
const endMarker = " let file=p==='/'?'/index.html':p;";
const startIdx = lines.findIndex(l => l.startsWith(startMarker));
const endIdx = lines.findIndex(l => l.startsWith(endMarker));
if (startIdx === -1 || endIdx === -1) throw new Error('markers not found — server.js structure changed, update port.js markers');
let block = lines.slice(startIdx, endIdx).join('\n');

const beforeRouteCount = (block.match(/ if\(p===/g) || []).length + (block.match(/ if\(p\.startsWith/g) || []).length;

// 1) Special-case Node-only crypto/fs/Buffer usages (must run before the generic pass
//    so their own read()/write() calls still get caught by step 2).
const specialCases = [
  ["let buf=Buffer.from(m[3],'base64');if(buf.length>12*1024*1024)return json(res,400,{error:'حجم فایل حداکثر ۱۲ مگابایت.'});let filename=id()+'.'+ext;fs.writeFileSync(path.join(UPLOADS_DIR,filename),buf);r.fileUrl='/uploads/'+filename;r.fileMime=mime;r.fileName=d.fileName||filename;write(db);return json(res,200,r)}", "let buf=bytesFromBase64(m[3]);if(buf.byteLength>12*1024*1024)return json(res,400,{error:'حجم فایل حداکثر ۱۲ مگابایت.'});let filename=id()+'.'+ext;if(!TELEGRAM_BOT_TOKEN||!user.telegramUserId)return json(res,503,{error:'برای آپلود فایل، اول بات تلگرام را از تنظیمات → اتصال‌ها وصل کن.'});let tgFileId=await tgSendDocument(user.telegramUserId,buf,d.fileName||filename,mime,'📎 سند: '+(r.title||''));r.fileUrl='/uploads/'+filename;r.fileTgId=tgFileId;r.fileMime=mime;r.fileName=d.fileName||filename;await write(db);return json(res,200,r)}"],
  [`crypto.randomBytes(16).toString('hex')`, `randHex(16)`],
  [`crypto.randomBytes(24).toString('hex')`, `randHex(24)`],
  [`hash(d.password,salt)`, `await hash(d.password,salt)`],
  [`hash(d.password||'',(user&&user.salt)||'0000000000000000000000000000000')`, `await hash(d.password||'',(user&&user.salt)||'0000000000000000000000000000000')`],
  [`crypto.timingSafeEqual(Buffer.from(candidate),Buffer.from(user.password))`, `timingSafeEqualHex(candidate,user.password)`],
  [`Buffer.from(SPOTIFY_CLIENT_ID+':'+SPOTIFY_CLIENT_SECRET).toString('base64')`, `b64(SPOTIFY_CLIENT_ID+':'+SPOTIFY_CLIENT_SECRET)`],
  [`Buffer.from(d.fileBase64,'base64').toString('utf8')`, `textFromBase64(d.fileBase64)`],
  [`XLSX.read(Buffer.from(d.fileBase64,'base64'),{type:'buffer'})`, `XLSX.read(bytesFromBase64(d.fileBase64),{type:'array'})`],
  [`Buffer.from(String(d.libraryCsvBase64||'').replace(/^data:[^;]+;base64,/,''),'base64').toString('utf8')`, `textFromBase64(String(d.libraryCsvBase64||'').replace(/^data:[^;]+;base64,/,''))`],
  [`Buffer.from(String(d.watchesCsvBase64||'').replace(/^data:[^;]+;base64,/,''),'base64').toString('utf8')`, `textFromBase64(String(d.watchesCsvBase64||'').replace(/^data:[^;]+;base64,/,''))`],
  [
    `let ext=m[1]==='jpeg'?'jpg':m[1],filename=id()+'.'+ext;fs.writeFileSync(path.join(UPLOADS_DIR,filename),Buffer.from(m[2],'base64'));r.receipt='/uploads/'+filename;write(db);return json(res,200,r)}`,
    `let ext=m[1]==='jpeg'?'jpg':m[1],filename=id()+'.'+ext;if(!TELEGRAM_BOT_TOKEN||!user.telegramUserId)return json(res,503,{error:'برای آپلود رسید، اول بات تلگرام را از تنظیمات → اتصال‌ها وصل کن.'});let tgFileId=await tgSendDocument(user.telegramUserId,bytesFromBase64(m[2]),filename,'image/'+m[1],'🧾 رسید تراکنش: '+(r.title||''));r.receipt='/uploads/'+filename;r.receiptTgId=tgFileId;r.receiptMime='image/'+m[1];await write(db);return json(res,200,r)}`,
  ],
  [
    `let ext=m[1]==='jpeg'?'jpg':m[1],filename=id()+'.'+ext;fs.writeFileSync(path.join(UPLOADS_DIR,filename),Buffer.from(m[2],'base64'));r.fileUrl='/uploads/'+filename;write(db);return json(res,200,r)}`,
    `let ext=m[1]==='jpeg'?'jpg':m[1],filename=id()+'.'+ext;if(!env.UPLOADS)return json(res,503,{error:'ذخیره‌سازی فایل (R2) هنوز روی این استقرار فعال نشده است.'});await env.UPLOADS.put(filename,bytesFromBase64(m[2]),{httpMetadata:{contentType:'image/'+m[1]},customMetadata:{userId:user.id}});r.fileUrl='/uploads/'+filename;await write(db);return json(res,200,r)}`,
  ],
  [`let bin=Buffer.from(mm[2],'base64');res.writeHead(200,{'Content-Type':mm[1],'Content-Length':String(bin.length)});return res.end(bin)}`, `let bin=bytesFromBase64(mm[2]);res.writeHead(200,{'Content-Type':mm[1],'Content-Length':String(bin.byteLength)});return res.end(bin)}`],
];
let specialCounts = [];
for (const [find, replace] of specialCases) {
  const count = block.split(find).length - 1;
  specialCounts.push([find.slice(0, 40), count]);
  block = block.split(find).join(replace);
}

// 2) Generic mechanical persistence-layer conversion.
// header.js's read()/write(db) are closures over `env` (defined inside
// makeHelpers(env)) and take NO env parameter of their own - read() ignores
// any argument, but write(db) has exactly one declared parameter, so an
// extra leading env argument silently shadows the real db object and gets
// serialized instead. Do not pass env to either.
const beforeReadCount = (block.match(/=read\(\)/g) || []).length;
const beforeWriteCount = (block.match(/write\(db\)/g) || []).length;
block = block.replace(/=read\(\)/g, '=await read()');
block = block.replace(/(?<!await )write\(db\)/g, 'await write(db)');

const afterRouteCount = (block.match(/ if\(p===/g) || []).length + (block.match(/ if\(p\.startsWith/g) || []).length;

console.log('Route count before/after:', beforeRouteCount, afterRouteCount, beforeRouteCount === afterRouteCount ? 'OK' : 'MISMATCH');
console.log('read() call sites converted:', beforeReadCount);
console.log('write(db) call sites converted:', beforeWriteCount);
console.log('Special-case replacements applied:', JSON.stringify(specialCounts));
if (block.includes('crypto.randomBytes') || block.includes('crypto.timingSafeEqual') || block.includes('Buffer.from') || block.includes('fs.writeFileSync')) {
  console.error('WARNING: leftover Node-only API calls still present in ported block!');
  process.exit(1);
}

const header = fs.readFileSync(path.join(__dirname, 'header.js'), 'utf8');
const footer = fs.readFileSync(path.join(__dirname, 'footer.js'), 'utf8');

// ---------------------------------------------------------------------------
// Drift guard: the route block below is copied from server.js, but every helper
// it calls must already exist in header.js / footer.js — those two files are
// hand-written and are NOT generated from server.js. If a helper is added to
// server.js only, the generated worker.js ends up calling an undefined function
// and every request to that route dies with a ReferenceError on Cloudflare,
// while `node server.js` and `npm test` keep passing locally. Fail loudly here.
// ---------------------------------------------------------------------------
function collectDefs(text) {
  const names = new Set();
  const pats = [
    /(?:^|[\s;{}])(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g,
    /(?:^|[\s;{}])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /import\s+\*\s+as\s+([A-Za-z_$][\w$]*)/g,
    /import\s+([A-Za-z_$][\w$]*)\s+from/g,
    /class\s+([A-Za-z_$][\w$]*)/g,
  ];
  for (const re of pats) { let m; while ((m = re.exec(text)) !== null) names.add(m[1]); }
  for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)+)\s*=/g))
    m[1].split(',').forEach(n => names.add(n.trim()));
  return names;
}
// whole-word reference check without RegExp escaping (identifiers may contain $)
function referencedIn(hay, name) {
  let i = -1;
  while ((i = hay.indexOf(name, i + 1)) !== -1) {
    const before = i > 0 ? hay[i - 1] : '';
    const after = hay[i + name.length] || '';
    if (!/[.\w$]/.test(before) && !/[\w$]/.test(after)) return true;
  }
  return false;
}

// Only module-level definitions matter. In server.js those start at column 0, and
// a column-0 line is either a whole single-line function (take its name only —
// its inner 'let x=' locals must NOT count) or a top-level const/let/var.
const NODE_BUILTINS = new Set(['fs', 'path', 'http', 'https', 'crypto', 'os', 'url', 'zlib',
  'util', 'stream', 'events', 'Buffer', 'process', '__dirname', '__filename', 'require',
  'module', 'exports']);
const allServerLines = src.split('\n');
const serverHelperNames = new Set();
for (const l of allServerLines.slice(0, startIdx).concat(allServerLines.slice(endIdx))) {
  let m;
  if ((m = l.match(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/)) || (m = l.match(/^class\s+([A-Za-z_$][\w$]*)/))) {
    serverHelperNames.add(m[1]);
  } else if (/^(?:const|let|var)\s/.test(l)) {
    for (const n of collectDefs(l)) serverHelperNames.add(n);
  }
}
for (const n of NODE_BUILTINS) serverHelperNames.delete(n);
const workerDefs = collectDefs(header + '\n' + footer);

const missing = [];
for (const name of serverHelperNames) {
  if (workerDefs.has(name)) continue;
  if (referencedIn(block, name)) missing.push(name);
}
if (missing.length) {
  console.error('');
  console.error('ERROR: the ported route block calls helper(s) that exist in server.js but NOT in');
  console.error('cloudflare/header.js or cloudflare/footer.js. The generated worker.js would throw a');
  console.error('ReferenceError on Cloudflare even though `node server.js` works fine locally.');
  console.error('');
  console.error('  missing: ' + missing.sort().join(', '));
  console.error('');
  console.error('Fix: copy those helpers into cloudflare/header.js (inside makeHelpers(env), indented');
  console.error('by two spaces), then re-run: node cloudflare/port.js');
  console.error('');
  process.exit(1);
}
console.log('Drift guard OK: every server.js helper referenced by the route block exists in header.js/footer.js (' + serverHelperNames.size + ' checked)');

fs.writeFileSync(path.join(__dirname, 'worker.js'), header + block + footer);
console.log('Wrote cloudflare/worker.js (' + (header + block + footer).split('\n').length + ' lines)');
console.log('header.js and footer.js are hand-written (not generated) — edit those directly for anything');
console.log('outside the mechanically-ported route bodies, then re-run this script.');
