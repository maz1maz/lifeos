# assets — منابع مشترک فرانت

هدف: سبک‌کردن صفحات `public/design/*` با حذف فونت base64 و اسکریپت/استایل تکراری.

## فایل‌ها

| مسیر | نقش |
|------|-----|
| `css/core.css` | تم، nav، toast، دکمه‌های پایه، `@font-face` |
| `js/core.js` | `LifeCore.fa / esc / toast` + تم + منوی موبایل + auth |
| `fonts/Estedad.woff2` | **باید یک‌بار استخراج شود** (هنوز در ریپو نیست) |

## استخراج فونت از series-page

```bash
node -e "
const fs=require('fs');
const h=fs.readFileSync('public/design/series-page.html','utf8');
const m=h.match(/url\\(data:font\\/woff2;base64,([A-Za-z0-9+\\/=]+)\\)/);
if(!m){console.error('no font found');process.exit(1)}
fs.mkdirSync('public/assets/fonts',{recursive:true});
fs.writeFileSync('public/assets/fonts/Estedad.woff2', Buffer.from(m[1],'base64'));
console.log('OK bytes', Buffer.from(m[1],'base64').length);
"
```

## اتصال به یک صفحه (مثلاً series)

در `<head>` (به‌جای `@font-face` غول‌پیکر):

```html
<link rel="stylesheet" href="/assets/css/core.css">
<link rel="preload" href="/assets/fonts/Estedad.woff2" as="font" type="font/woff2" crossorigin>
```

قبل از `</body>`:

```html
<div id="toast"></div>
<script src="/assets/js/core.js" defer></script>
<script>
  var fa = LifeCore.fa, esc = LifeCore.esc, toast = LifeCore.toast;
  // ... منطق مخصوص صفحه ...
</script>
```

سپس اسکریپت‌های تکراری تم / منوی موبایل / auth / toast را از همان HTML حذف کن.

## DB version + backup

پچ پیشنهادی برای `server.js` در `docs/DB-VERSION-PATCH.md`.
