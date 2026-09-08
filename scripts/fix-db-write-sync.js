/**
 * If server.js already has async _writeChain write(), convert to sync atomic write.
 * dbLock already serializes requests; async write without await is unsafe.
 * Run: node scripts/fix-db-write-sync.js
 */
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'server.js');
let t = fs.readFileSync(f, 'utf8');

const asyncWrite = /let _writeChain=Promise\.resolve\(\);\s*function write\(x\)\{if\(!x\._meta\)x\._meta=\{version:1\};x\._meta\.version=\(Number\(x\._meta\.version\)\|\|0\)\+1;x\._meta\.updatedAt=new Date\(\)\.toISOString\(\);let payload=JSON\.stringify\(x,null,2\);_writeChain=_writeChain\.then\(function\(\)\{let tmp=DB\+'\.tmp';fs\.writeFileSync\(tmp,payload\);fs\.renameSync\(tmp,DB\)\}\)\.catch\(function\(e\)\{console\.error\('DB write failed',e\)\}\);return _writeChain\}/;

const syncWrite = `function write(x){if(!x._meta)x._meta={version:1};x._meta.version=(Number(x._meta.version)||0)+1;x._meta.updatedAt=new Date().toISOString();let tmp=DB+'.tmp';fs.writeFileSync(tmp,JSON.stringify(x,null,2));fs.renameSync(tmp,DB)}`;

if (!t.includes('_writeChain')) {
  if (t.includes("fs.renameSync(tmp,DB)") && t.includes('_meta.version')) {
    console.log('Write already synchronous + versioned.');
    process.exit(0);
  }
  console.log('No _writeChain found; nothing to fix (run apply-db-patch.js first if needed).');
  process.exit(0);
}

if (!asyncWrite.test(t)) {
  console.error('Async write pattern not matched; manual check needed.');
  process.exit(1);
}

t = t.replace(asyncWrite, syncWrite);
fs.writeFileSync(f, t);
console.log('Converted write() to synchronous atomic versioned write.');
