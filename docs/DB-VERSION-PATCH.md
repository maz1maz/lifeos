# پچ version برای `server.js` (ریسک overwrite)

وضعیت فعلی: هر API کل `db.json` را `read` می‌کند، تغییر می‌دهد، `write` می‌کند. دو درخواست همزمان می‌توانند داده را گم کنند.

## ۱) جایگزین `read` / `write`

بعد از تعریف `DB` و توابع کمکی، این بلوک را جایگزین `function read` و `function write` فعلی کن (همان `x.investments??=[]` و بقیه defaultها را از نسخهٔ فعلی‌ات نگه دار).

```js
function readRaw() {
  const x = JSON.parse(fs.readFileSync(DB, 'utf8'));
  if (!x._meta) x._meta = { version: 1 };
  if (typeof x._meta.version !== 'number') x._meta.version = 1;
  // … همان ??=های فعلی برای آرایه‌ها …
  return x;
}

let _writeChain = Promise.resolve();

function read() {
  return readRaw();
}

function write(db) {
  if (!db._meta) db._meta = { version: 1 };
  db._meta.version = (Number(db._meta.version) || 0) + 1;
  db._meta.updatedAt = new Date().toISOString();
  const payload = JSON.stringify(db, null, 2);
  _writeChain = _writeChain.then(() => {
    const tmp = DB + '.tmp';
    fs.writeFileSync(tmp, payload);
    fs.renameSync(tmp, DB);
  }).catch((e) => console.error('DB write failed', e));
  return _writeChain;
}
```

## ۲) بکاپ روزانه

نزدیک استارت سرور:

```js
function backupDb() {
  try {
    if (!fs.existsSync(DB)) return;
    const dir = path.join(path.dirname(DB), 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    fs.copyFileSync(DB, path.join(dir, 'db-' + stamp + '.json'));
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('db-')).sort();
    while (files.length > 7) fs.unlinkSync(path.join(dir, files.shift()));
  } catch (e) {
    console.error('backup failed', e);
  }
}
backupDb();
setInterval(backupDb, 24 * 60 * 60 * 1000);
```

`data/backups/` را به `.gitignore` اضافه کن اگر نمی‌خواهی بکاپ‌ها commit شوند.

## ۳) Worker (Cloudflare)

روی D1/kv همان فیلد `_meta.version` را قبل از `put` چک کن؛ در صورت اختلاف → `409`.

## هشدار

این پچ را **مستقیم روی production بدون تست لوکال** اعمال نکن. اول روی کپی `db.json` تست کن.
