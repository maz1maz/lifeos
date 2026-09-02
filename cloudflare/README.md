# پروداکشن روی Cloudflare (PDMAZ)

اپ «هِسته» الان واقعاً آنلاینه: **https://pdmaz.hamidreza-mazlaghani.workers.dev**

signup، login، سشن، تسک، داشبورد و متن فارسی همه به‌صورت زنده روی دیتابیس واقعی تست و تأیید شدند. این پوشه اپ رو به‌صورت Cloudflare Worker آماده می‌کنه — به‌جای فایل `server.js` که روی سیستم خودت اجرا می‌شه، این نسخه همیشه‌روشنه و آدرس ثابت داره.

## چیزهایی که همین الان واقعی و آماده‌ست

- **دیتابیس D1** به نام `pdmaz-db` ساخته شده و حساب واقعی‌ات (بدون سشن‌های قدیمی) داخلش کپی شده.
- **کد کامل Worker** در [`worker.js`](worker.js) — پورت کامل و تست‌شدهٔ همهٔ ۱۴۰ مسیر API از `server.js`، دیپلوی‌شده و کارش زنده تأیید شده.
- **`wrangler.toml`** با تنظیمات دیتابیس، فایل‌های استاتیک (`public/`)، و Cron هر ۱۵ دقیقه (برای گزارش تلگرام، قیمت‌های زنده و همگام‌سازی خودکار RSS، چون Worker برخلاف `server.js` نمی‌تونه یک تایمر دائمی داشته باشه).

⚠️ یک باگ واقعی در `cloudflare/port.js` پیدا و رفع شد که باعث می‌شد هر «ذخیره» به‌جای دادهٔ واقعی، یک دامپ بی‌ربط بنویسه (جزئیات در REMAINING-WORK.md). اگر دوباره `node cloudflare/port.js` رو اجرا کردی (مثلاً بعد از تغییر در `server.js`)، حتماً قبل از اعتماد به خروجی، یک‌بار با `wrangler dev --remote` یک signup/login واقعی تست کن.

## قبل از deploy — این کارها فقط با خودته

### ۱) فعال‌سازی R2 (برای آپلود رسید)
یک‌بار برو به داشبورد Cloudflare → Storage & Databases → R2 → فعالش کن (این مرحله فقط از داخل داشبورد قابل انجامه، API اجازه نمی‌ده). بعدش به من بگو تا bucket بسازم و در `wrangler.toml` وصلش کنم. تا اون موقع، آپلود رسید یک خطای روشن برمی‌گردونه، نه کرش.

### ۲) رمز عبور حساب واقعی‌ات
یک محدودیت واقعی پیدا شد: Cloudflare Workers فقط تا ۱۰۰٬۰۰۰ تکرار PBKDF2 اجازه می‌ده، ولی رمز فعلی‌ات با ۱۳۰٬۰۰۰ تکرار (توسط `server.js`) هش شده. یعنی **رمز فعلی‌ات روی این دیپلوی جواب نمی‌ده** — باید یک‌بار بعد از deploy، رمز جدید بسازی (یا با «ورود Google» اگر وصل کرده باشی وارد شو). سیستم «فراموشی رمز» هنوز ساخته نشده (این هم جزو همین اولویته، در ادامه می‌سازمش)؛ فعلاً اگر رمز فعلی یادت رفت به من بگو تا مستقیم توی D1 برات ریست کنم.

### ۳) کلیدهای API (Secrets)
هر کدوم از این‌ها رو که داری (یا بعداً می‌گیری)، با این دستور اضافه کن — مقدارش رو مستقیم توی ترمینال می‌پرسه، جایی ذخیره/نمایش داده نمی‌شه:
```bash
cd cloudflare
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REDIRECT_URI   # باید https://pdmaz.<subdomain>.workers.dev/api/auth/google/callback باشه
npx wrangler secret put API_FOOTBALL_KEY
npx wrangler secret put TMDB_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
npx wrangler secret put SPOTIFY_REDIRECT_URI
npx wrangler secret put YOUTUBE_REDIRECT_URI
npx wrangler secret put AI_PROVIDER_API_KEY
npx wrangler secret put AI_MODEL              # اختیاری، پیش‌فرض claude-sonnet-5
npx wrangler secret put RAPIDAPI_KEY
npx wrangler secret put STOCK_API_KEY
```
هر کدوم رو نداشتی، رد کن — همون رفتار «هنوز فعال نشده» رو می‌ده که توی نسخهٔ محلی هم داشت.

مهم: هر Redirect URI (گوگل، اسپاتیفای، یوتیوب) باید توی کنسول همون سرویس (Google Cloud Console / Spotify Developer Dashboard) هم به‌عنوان آدرس مجاز اضافه بشه، وگرنه ورود با خطا مواجه می‌شه.

### ۴) وب‌هوک تلگرام (اگر بات رو فعال کردی)
بعد از اولین deploy، این را یک‌بار اجرا کن تا تلگرام پیام‌ها رو به‌جای Long Polling مستقیم به Worker بفرسته:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://pdmaz.<subdomain>.workers.dev/api/telegram/webhook"
```

## دیپلوی

```bash
cd cloudflare
npx wrangler deploy
```
بعد از اولین اجرا، یک آدرس شبیه `https://pdmaz.<subdomain>.workers.dev` بهت می‌ده — همون آدرس دائمی و رایگان اپته.

برای تست قبل از دیپلوی نهایی (بدون اینکه چیزی واقعاً عوض بشه، ولی روی دیتابیس واقعی):
```bash
npx wrangler dev --remote
```

## محدودیت‌های شناخته‌شده (صادقانه، نه پنهان)

- **مدل ذخیره‌سازی D1**: به‌جای یک اسکیمای کاملاً رابطه‌ای (که در `schema.sql` طراحی شده بود ولی با حجم این پروژه به‌روز نمونده)، فعلاً کل دیتابیس به‌صورت یک بلاک JSON در یک جدول ساده (`kv`) نگه‌داری می‌شه — دقیقاً همون فرمت `db.json` قبلی، فقط داخل D1. این باعث شد بشه ~۹۵٪ منطق مسیرها رو بدون بازنویسی کامل منتقل کرد، ولی یعنی دو درخواست *همزمان* که هر دو چیزی رو تغییر بدن، ممکنه یکی از تغییرات رو گم کنن (آخرین نوشتن برنده می‌شه). برای یک کاربر شخصی این ریسک خیلی کمه، ولی اگر بعداً چند کاربر واقعی همزمان استفاده کنن، باید به اسکیمای رابطه‌ای واقعی مهاجرت کرد.
- **محدودیت سهمیهٔ رایگان D1**: حساب Cloudflareت بین چند پروژه مشترکه و امروز به سقف روزانهٔ خواندن رایگان D1 رسیدیم (نیمه‌شب UTC ریست می‌شه). اگر می‌خوای همین امروز تست کنی، باید پلن D1 رو آپگرید کنی (خیلی ارزونه، pay-as-you-go).
- **بات تلگرام**: از Long Polling به Webhook تغییر کرد (چون Worker نمی‌تونه یک حلقهٔ دائمی داشته باشه) — نیاز به یک بار تنظیم `setWebhook` داره (بالا نوشته شده).
- **گزارش صبح/شب و هشدار قیمت**: به‌جای هر ۵ و ۱۵ دقیقه، حالا یک Cron هر ۱۵ دقیقه هر دو رو چک می‌کنه — یعنی ممکنه گزارش صبح ساعت ۸ با چند دقیقه تأخیر برسه، نه دقیقاً سر ساعت.
- **رمز عبور**: به دلیل سقف تکرار PBKDF2 در Workers (بالا توضیح داده شد)، رمزهای هش‌شده با `server.js` روی این دیپلوی کار نمی‌کنن.

## هنوز ساخته نشده (بقیهٔ اولویت ۱۰)

- فراموشی/بازیابی رمز، تأیید ایمیل — نیاز به یک سرویس ارسال ایمیل (مثلاً Cloudflare Email Workers یا Resend) دارن که هنوز انتخاب/وصل نشده.
- Rate Limit و لاگ امنیتی — Cloudflare یک Rate Limiting Rule سطح حساب داره که می‌شه از داشبورد فعال کرد؛ لاگ امنیتی سفارشی هنوز نوشته نشده.
- PWA کامل و حالت آفلاین — `manifest.webmanifest` موجوده ولی Service Worker هنوز نوشته نشده.
- بکاپ خودکار — می‌شه با یک Cron دیگه، خروجی D1 رو دوره‌ای به R2 نوشت؛ هنوز پیاده نشده.
