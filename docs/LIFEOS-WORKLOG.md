# LifeOS — گزارش کارها (انجام‌شده / باقی‌مانده / ضروری)

آخرین به‌روزرسانی: ۲۰۲۶-۰۹-۰۸  
مخزن: `maz1maz/lifeos`

این سند خلاصهٔ کارهای انجام‌شده در بازبینی و بهبود سایت، کارهای نیمه‌تمام، و کارهای لازم بعدی است.

---

## ۱) انجام‌شده

### ۱.۱ فرانت — هستهٔ مشترک و سبک‌سازی

| مورد | مسیر | وضعیت |
|------|------|--------|
| استایل مشترک | `public/assets/css/core.css` | ✅ در ریپو |
| اسکریپت مشترک (تم، nav، toast، auth، `LifeCore.fa/esc/toast`) | `public/assets/js/core.js` | ✅ |
| فونت Estedad خارجی | `public/assets/fonts/Estedad.woff2` | ✅ |
| راهنمای assets | `public/assets/README.md` | ✅ |
| slim صفحه سریال (حذف base64 فونت + لینک core) | `public/design/series-page.html` | ✅ |
| اسکریپت slim سریال | `scripts/slim-series-page.js` | ✅ |
| اسکریپت slim فیلم | `scripts/slim-movies-page.js` | ✅ |

**اثر:** حجم سریال حدود ۱MB → ~۵۰۰KB (حذف فونت‌های embed).

### ۱.۲ بک‌اند — DB امن‌تر

| مورد | توضیح | وضعیت |
|------|--------|--------|
| `_meta.version` روی blob | نسخه برای تشخیص تداخل | ✅ (اعمال‌شده روی `server.js`) |
| نوشتن atomic | `db.json.tmp` → `rename` | ✅ |
| بکاپ روزانه | `data/backups/db-YYYY-MM-DD.json` (حداکثر ۷ روز) | ✅ |
| `dbLock` | از قبل برای سریال‌کردن درخواست‌ها وجود داشت | ✅ قبلی |
| اصلاح write همگام | جلوگیری از race وقتی handlerها `await write` ندارند | ⚠️ اسکریپت آماده؛ اگر هنوز `_writeChain` دیدی اجرا کن |
| نادیده گرفتن بکاپ در git | `data/backups/` در `.gitignore` | ✅ |

اسکریپت‌ها:

- `scripts/apply-db-patch.js`
- `scripts/fix-db-write-sync.js`
- `docs/DB-VERSION-PATCH.md`

### ۱.۳ Bingers / سریال

| مورد | وضعیت |
|------|--------|
| بررسی منطق فصل/قسمت، isWaiting، import | بررسی و پیشنهاد فیکس |
| BOM در CSV | راهنما + `fileToText` پیشنهادی |
| اگر status=watchlist ولی پیشرفت دارد → `watching` | اسکریپت `scripts/apply-bingers-fix.js` |
| Lioness: for_later + پیشرفت → نباید فقط watchlist خالی بماند | با فیکس بالا |

### ۱.۴ مدارک / آپلود بدون R2

| مورد | وضعیت |
|------|--------|
| ذخیره روی دیسک `public/uploads/` | از قبل در `server.js` |
| API: POST سند → POST `…/attach` (base64، سقف ~۱۲MB) | از قبل |
| مستند بدون نیاز به R2 | `docs/DOCUMENTS-UPLOAD.md` ✅ |

**نتیجه:** روی Node/VPS برای مدارک شخصی **R2 لازم نیست**. R2 بیشتر برای Worker روی Cloudflare با فایل زیاد است.

### ۱.۵ اسکریپت یک‌مرحله‌ای

```bash
git pull origin master
node scripts/apply-all-improvements.js
git add -A
git commit -m "Apply lifeos improvements"
git push origin master
```

شامل: DB patch، sync write، Bingers fix، slim series، slim movies.

### ۱.۶ بات تلگرام (وضع موجود — از قبل در کد)

- اتصال با کد (`/api/telegram/link-code`)
- متن آزاد → `parseLifeText` (+ AI اختیاری)
- فرمان‌ها: `/امروز` `/کارها` `/یادآوری‌ها` `/موجودی` `/پرتفوی` `/گزارش_ماه` `/انجام` `/گزارش_صبح` `/گزارش_شب`
- کیبورد پایدار
- گزارش خودکار صبح/شب (تهران) + هوا

---

## ۲) نیمه‌تمام / باید لوکال تأیید شود

| کار | چرا |
|-----|-----|
| اجرای `apply-all-improvements.js` روی ماشین تو | فایل‌های بزرگ از API گیت‌هاب یک‌جا قابل بازنویسی مطمئن نبودند |
| `movies-page.html` هنوز ممکن است base64 داشته باشد تا اسکریپت slim اجرا شود | اسکریپت آماده است |
| اگر `server.js` هنوز `_writeChain` دارد | `node scripts/fix-db-write-sync.js` |
| Worker (`cloudflare/worker.js`) همان version/backup را ندارد | جدا باید پچ شود |

---

## ۳) باقی‌مانده — پیشنهادی و لازم

### ۳.۱ ضروری (اولویت بالا)

1. **اجرای اسکریپت‌های لوکال + push** اگر هنوز نکردی  
2. **sync بودن `write`** روی production  
3. **بکاپ منظم** `db.json` + در صورت استفاده `public/uploads/`  
4. **اسرار:** توکن گیت‌هابی که در چت paste شد را revoke کن؛ `.env` commit نشود  
5. **Worker:** اگر production روی CF است، version روی kv و استراتژی فایل (R2 یا لینک) را مشخص کن  

### ۳.۲ صفحه «امروز» / خانه (`public/index.html`)

اولویت UX (موبایل و دسکتاپ):

| اولویت | کار |
|--------|-----|
| A | ترتیب کارت‌ها: کارها و حال بالا، پول پایین‌تر |
| B | باکس «۳ کار بعدی» |
| C | سریال فقط «آماده امروز / backlog aired» |
| D | چیپ سریع مود/خواب/آب |
| E | slim خانه (core + فونت؛ هنوز base64 دارد) |
| F | ورودی یک‌خطی متن آزاد (همان parseLifeText) |

### ۳.۳ بات تلگرام — فازبندی پیشنهادی

**فاز ۱**
- دکمه اینلاین برای تیک کار (به‌جای فقط `/انجام 1`)
- یادآوری نزدیک به ساعت (۵–۱۰ دقیقه قبل)
- گزارش صبح کوتاه‌تر با ۳ کار + هوا

**فاز ۲**
- `/سریال` + دکمه «دیدم»
- تأیید دو مرحله‌ای برای خرج بزرگ

**فاز ۳**
- `/هفته` خلاصه
- webhook به‌جای long-poll (برای Worker/پایداری)
- ویس → متن (اختیاری)

### ۳.۴ فرانت باقی صفحات

- `movies-page.html` → slim  
- `index.html` → slim  
- بقیه `public/design/*` به تدریج به `core.css` / `core.js`

### ۳.۵ امنیت (سبک، لازم)

- مرور rate limit روی auth (از قبل هست؛ گسترش به endpointهای حساس)
- عدم لو رفتن کلید API در کلاینت
- PIN / قفل اپ در صورت نیاز
- CORS و cookie Secure در production

### ۳.۶ مدارک

- UI واضح: ایجاد سند → انتخاب فایل → attach  
- بکاپ `uploads`  
- فقط اگر Worker + فایل زیاد: R2  

---

## ۴) کارهای عمداً انجام‌نشده / رد شده

- بازنویسی کامل monolith به میکروسرویس  
- اجبار R2 برای لوکال  
- تغییر گسترده schema.sql بدون نیاز فوری (فعلاً JSON blob + dbLock)  
- چت آزاد بی‌هدف با AI داخل بات  

---

## ۵) دستورهای سریع مرجع

```bash
# گرفتن آخرین تغییرات
git checkout master
git pull origin master

# اعمال پچ‌های آماده‌شده
node scripts/apply-all-improvements.js

# فقط فیکس write همگام
node scripts/fix-db-write-sync.js

# فقط slim فیلم
node scripts/slim-movies-page.js

# commit
git add -A
git status
git commit -m "Apply lifeos improvements"
git push origin master
```

---

## ۶) اسناد مرتبط در ریپو

| سند | موضوع |
|-----|--------|
| `docs/LIFEOS-WORKLOG.md` | همین فایل |
| `docs/DB-VERSION-PATCH.md` | پچ version / backup |
| `docs/DOCUMENTS-UPLOAD.md` | آپلود بدون R2 |
| `public/assets/README.md` | core و فونت |
| `scripts/apply-all-improvements.js` | یک‌مرحله‌ای |

---

## ۷) نقشهٔ راه کوتاه (پیشنهادی)

```text
هفته ۱: apply-all لوکال + تأیید DB write sync + slim movies/index
هفته ۲: UX صفحه امروز (۳ کار + ترتیب کارت) + تلگرام فاز ۱
هفته ۳: سریال از تلگرام + امنیت سبک + تصمیم Worker/R2
```

---

## ۸) نکته برای ادامه کار با دستیار

برای پیاده‌سازی بعدی، اولویت پیشنهادی کاربر در گفتگوها:

1. DB و پایداری داده  
2. سبک فرانت  
3. صفحه امروز  
4. بات تلگرام  
5. مدارک بدون R2 (مستند شد؛ UI اختیاری)  

اگر فقط یک کار بعدی بخواهی: **`node scripts/apply-all-improvements.js` سپس push**، بعد **تلگرام فاز ۱** یا **slim خانه**.
