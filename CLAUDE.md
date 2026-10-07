# LifeOS («هِسته») — راهنمای سریع برای Claude

داشبورد شخصی فارسی/RTL. یک کاربر. لایو: https://pdmaz.hamidreza-mazlaghani.workers.dev
نقشهٔ کامل فایل‌ها و APIها: `docs/SITEMAP.md` — قبل از جست‌وجوی گسترده آن را بخوان.
بک‌لاگ: `REMAINING-WORK.md` (اولویت‌بندی‌شده) · تاریخچه: `docs/WORK-SUMMARY.md`, `docs/LIFEOS-WORKLOG.md`.

## معماری در یک نگاه
- **بک‌اند = فقط Worker** (`server.js`/`port.js`/`header.js`/`footer.js` در ۲۰۲۶-۱۰ با تأیید کاربر حذف شدند). فایل‌ها:
  - `cloudflare/worker.js` = ورودی کوچک: `export default { fetch, scheduled }`، دروازهٔ لاگین و مسیرهای خاص.
  - `cloudflare/lib/helpers.js` = `makeHelpers(env)` (همهٔ helperها: auth، تاریخ، پارسرها، storage، تلگرام، AI…).
  - `cloudflare/lib/api.js` = `handleApi` (همهٔ مسیرهای `/api/*`). مسیر تازه اینجا.
  - `cloudflare/lib/edge.js` = webhook تلگرام، cron، tgju، uploads، لیست خرید اشتراکی. `cloudflare/lib/security.js` = CSP و هدرهای امنیتی.
  - helper تازه: داخل `makeHelpers` + در `return {…}` آن + destructuring بالای `handleApi`.
  - ذخیره: D1 `pdmaz-db`، جدول `kv`، state به‌صورت shardهای `state:v2:*` (کلید قدیمی `db` خودکار مهاجرت می‌کند). PBKDF2 سقف ۱۰۰k.
  - فایل‌ها (رسید، مدارک) در چت تلگرام کاربر ذخیره می‌شوند؛ بدون اتصال بات → 503.
  - cron (wrangler.jsonc) جای تایمرهای پس‌زمینه است؛ گزارش‌های تلگرام (صبح/عصر با یادداشت هوشمند `withAiNote`، هفتگی، ماهانه) از `tgCheckReports` در helpers.
  - فوتبال: منابع (varzesh3، footba11، ESPN، TheSportsDB، SofaScore) سقف ۸ ثانیه دارند (`fetch` سایه‌شده در بالای helpers.js) و نتیجهٔ هر لیگ ۱۰ دقیقه کش می‌شود (`cachedLeagueRange`). لاگ لایو: `api.cloudflare.com` … `workers/observability/telemetry/query` (اعتبار از پروکسی).
- **فرانت = React 19 + Vite** در `src/today/` → build داخل `public/` (`index.html` و `assets/index-*.js` gitignore هستند).
  - یک SPA؛ روتینگ با `/?page=<name>` در `src/today/src/main.jsx` (تابع `Routes`؛ `App` با رویداد `lifeos:captured` صفحه را re-mount می‌کند تا بعد از ثبت در Ctrl+K داده تازه شود).
  - هاب‌های تب‌دار با `TabHub`: برنامه‌ریز (`planner|calendar|habits|focus|time`)، «مرور و اهداف» (`review|goals|week|stats|logbook`)، یادگیری (`learning|vocab`)، یادداشت (`notes|journal|shopping`)، تماشا (`WatchHub`). صفحهٔ «بینش» = `insights`.
  - صفحه‌ها lazy هستند (`PAGE_CHUNKS` + `lazyPage` در main.jsx)؛ CSSشان در main.jsx قبل از `mobile.css` import می‌شود تا ترتیب cascade عوض نشود. صفحهٔ تازه = فایل `<page>.jsx` + یک ورودی در `PAGE_CHUNKS`.
  - `life.jsx` (صفحه‌های زندگی/پروژه، lazy) → helperهای مشترک در `life-core.jsx` (api, fa, Page, FormDrawer, useCol…) و کارت‌های صفحهٔ امروز در `life-cards.jsx`. ماژول کوچک از `life-core` import کند، نه `life` (وگرنه کل life به باندل اصلی برمی‌گردد). life.jsx همه را re-export می‌کند (پنل ملینا).
  - منو: `NAV_GROUPS` (۶ گروه) + `TopNav` + نوار پایین موبایل `BOTTOM_TABS` در main.jsx. `public/design/*-page.html` فقط ریدایرکت به `/?page=` هستند (به‌جز login-page.html که صفحهٔ واقعی ورود است). قفل PIN = `public/app-lock.js` (در `src/today/index.html` لود می‌شود).
  - مشترک: `public/shared-ui.js` (تم `lifeos-mode`)، `shared-shell.css`، `shared-theme.css`، `assets/css/core.css`، `assets/js/core.js`. آیکون: `lucide-react`. لوگو: `public/assets/img/logo.png` (طلایی).
  - legacy (دست نزن مگر لازم): `public/newtab.html` + `newtab-extension/` (چک لایو و تست‌ها به newtab.html وابسته‌اند).
- **امنیت (`cloudflare/lib/security.js`):** همهٔ پاسخ‌ها هدر امنیتی می‌گیرند؛ HTML یک CSP که اسکریپت inline را فقط با sha256 همان صفحه اجازه می‌دهد (خودکار حساب می‌شود). پس **هیچ handler inline (`onclick=` و…) ننویس**. مرورگر فقط به open-meteo و CoinGecko مستقیم وصل می‌شود: سرویس بیرونی تازه‌ای که از فرانت `fetch` شود باید به `connect-src` اضافه شود. اسکن DAST: `stackhawk.yml` + `node scripts/gen-openapi.js` (کلید HawkScan هرگز در ریپو نه).

## دستورات
```bash
npm ci
npm run build:today      # حتماً قبل از تست؛ بدون build، ui/verify تست‌ها قرمز می‌شوند
npm test                 # smoke(۴۸۹، روی worker از طریق test/worker-host.js) + worker-smoke(~۳۰۳) + verify-script(۲۶) + ui-smoke(۴۷) — همه سبز
                         # تست‌ها Worker را با test/load-worker.js لود می‌کنند (کپی cloudflare/ در پوشهٔ موقت)
npm start                # Worker واقعی محلی روی :3000 (wrangler dev --local + جدول kv در D1 محلی؛ کلیدها از .dev.vars)
PORT=3000 DB_PATH=/tmp/db.json node test/worker-host.js   # همان Worker بدون wrangler (D1 جعلی، state در DB_PATH؛ با TLS_CERT/TLS_KEY روی https)
npm run dev:today        # vite dev
npm run deploy           # build + wrangler deploy (فقط با اجازهٔ کاربر)
npm run build:studio     # پنل seyfikhani.ir (ProjectsPage+CoursesPage) → integrations/seyfikhani/public_html
```

## قواعد کار
- هر تغییر API: `cloudflare/lib/api.js` (+ helper در `lib/helpers.js`) + تست در `test/worker-smoke.js` یا `test/smoke.js` → `npm test`. بعد از افزودن مسیر: `node scripts/gen-openapi.js`.
- تغییر UI را با مرورگر (Playwright، `test/worker-host.js` + کوکی sid) و اسکرین‌شات هم ببین، نه فقط تست.
- اپ زبان: `public/vocab/` (`words.json` = آرایهٔ فشرده) + `src/today/src/vocab.jsx` + `/api/vocab`.
- **جهت فلش‌های قبل/بعد (RTL — کاربر بارها تذکر داده):** دکمهٔ «قبل» سمت راست است و فلشش به راست (`ChevronRight` / `›` / `»`)؛ «بعد» سمت چپ و فلشش به چپ (`ChevronLeft` / `‹` / `«`). یعنی در DOM اول «قبل» بیاید. ⚠️ نویسه‌های `‹ › « »` در متن RTL خودکار برعکس نمایش داده می‌شوند؛ دکمهٔ متنی حتماً `dir="ltr"` بگیرد (یا آیکون lucide). تست `ui-smoke` هر دو را چک می‌کند؛ ولی همیشه با اسکرین‌شات هم ببین.
- متن UI فارسی، `dir=rtl`، اعداد با `fa()`/`toLocaleString('fa-IR')`. واحد پول ذخیره‌شده **ریال** است (`_meta.currencyUnit='IRR'`)، نمایش تومان = ÷۱۰.
- تاریخ‌ها ISO با منطقهٔ `Asia/Tehran`؛ نمایش جلالی با `Intl` (`fa-IR-u-ca-persian`).
- کلیدهای API: محلی در `.dev.vars` (نمونه: `.env.example`)، لایو با `wrangler secret`. هرگز commit نکن.
- بستهٔ IELTS (zip، از ریپو حذف شد — در تاریخچهٔ git پیش از این کامیت هست) = دادهٔ واژگان IELTS (۴۵ فایل JSON، ۴۴۹۴ واژه) واردشده با `node scripts/import-ielts.js <dir>` (بعد از unzip). ستون ۱۱ اختیاری `words.json` = معنی‌های اضافه `[[pos,fa,d,df,e,ef],…]`.

## روال کار با کاربر (مهم)
- تغییرات جزئی زیادند: همه را پشت سر هم انجام بده، تست کن، و پیش‌نمایش (عکس/توضیح) بفرست.
- بعد از هر تغییرِ تست‌شده، خودت روی شاخهٔ کار **commit و push** کن (کاربر گفت «همیشه ذخیره کن»).
- **PR، ساخت پنل ملینا، مرج و deploy فقط با تأیید صریح کاربر.** هیچ‌کدام را خودسرانه انجام نده.
- وقتی کاربر گفت «بساز/PR کن»، همهٔ تغییرات جمع‌شده یک‌جا commit و PR شوند.

## پنل ملینا (seyfikhani.ir) — هم‌گام با «پروژه‌ها»/«دوره‌ها»
فقط وقتی کاربر اجازه داد (بعد از تغییر در `src/today/src/life.jsx`، `life.css`، `home.css`، `projectReportPrint.js`، `sidelist.jsx`، `studio.jsx` یا فایل‌های دوره‌ها/دانشجوها `courses.*`):
1. `npm run build:today && npm test` — همه سبز.
2. `npm run build:studio` → `integrations/seyfikhani/public_html/studio.html` + `studio-assets/`.
3. `git add -A integrations/seyfikhani/public_html` (حذف assetهای قدیمی هم commit شود).
4. push + PR بساز؛ قبل از مرج به کاربر خبر بده.
5. در پیام بگو روی هاست ملینا آپلود شود: `studio.html` و کل `studio-assets/` (بعد از پاک‌کردن فایل‌های قدیمی آن پوشه). کاربر زیپ این دو را می‌خواهد (برای extract در `public_html`).
- deploy فقط با اجازهٔ کاربر.
- endpoint تازه برای پنل: `/api/ext/*` فقط در `cloudflare/worker.js` (با بررسی scope توکن) + مسیر در `$allowed` فایل `integrations/seyfikhani/public_html/studio-api.php` + تست در `test/worker-smoke.js`.
- اگر ساخت پنل شکست خورد یا تغییر در پنل کار نکرد، صریح گزارش بده.
