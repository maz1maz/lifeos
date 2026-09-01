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
  [`crypto.randomBytes(16).toString('hex')`, `randHex(16)`],
  [`crypto.randomBytes(24).toString('hex')`, `randHex(24)`],
  [`hash(d.password,salt)`, `await hash(d.password,salt)`],
  [`hash(d.password||'',(user&&user.salt)||'0000000000000000000000000000000')`, `await hash(d.password||'',(user&&user.salt)||'0000000000000000000000000000000')`],
  [`crypto.timingSafeEqual(Buffer.from(candidate),Buffer.from(user.password))`, `timingSafeEqualHex(candidate,user.password)`],
  [`Buffer.from(SPOTIFY_CLIENT_ID+':'+SPOTIFY_CLIENT_SECRET).toString('base64')`, `b64(SPOTIFY_CLIENT_ID+':'+SPOTIFY_CLIENT_SECRET)`],
  [
    `let ext=m[1]==='jpeg'?'jpg':m[1],filename=id()+'.'+ext;fs.writeFileSync(path.join(UPLOADS_DIR,filename),Buffer.from(m[2],'base64'));r.receipt='/uploads/'+filename;write(db);return json(res,200,r)}`,
    `let ext=m[1]==='jpeg'?'jpg':m[1],filename=id()+'.'+ext;if(!env.UPLOADS)return json(res,503,{error:'ذخیره‌سازی فایل (R2) هنوز روی این استقرار فعال نشده است.'});await env.UPLOADS.put(filename,bytesFromBase64(m[2]),{httpMetadata:{contentType:'image/'+m[1]}});r.receipt='/uploads/'+filename;await write(env,db);return json(res,200,r)}`,
  ],
];
let specialCounts = [];
for (const [find, replace] of specialCases) {
  const count = block.split(find).length - 1;
  specialCounts.push([find.slice(0, 40), count]);
  block = block.split(find).join(replace);
}

// 2) Generic mechanical persistence-layer conversion.
const beforeReadCount = (block.match(/=read\(\)/g) || []).length;
const beforeWriteCount = (block.match(/write\(db\)/g) || []).length;
block = block.replace(/=read\(\)/g, '=await read(env)');
// avoid double-prefixing the one write(db) already rewritten to await write(env,db) by the special case above
block = block.replace(/(?<!await write\(env,)write\(db\)/g, 'await write(env,db)');

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
fs.writeFileSync(path.join(__dirname, 'worker.js'), header + block + footer);
console.log('Wrote cloudflare/worker.js (' + (header + block + footer).split('\n').length + ' lines)');
console.log('header.js and footer.js are hand-written (not generated) — edit those directly for anything');
console.log('outside the mechanically-ported route bodies, then re-run this script.');
