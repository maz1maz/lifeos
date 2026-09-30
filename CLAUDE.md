# LifeOS («هِسته») — راهنمای سریع برای Claude

داشبورد شخصی فارسی/RTL. یک کاربر. لایو: https://pdmaz.hamidreza-mazlaghani.workers.dev
نقشهٔ کامل فایل‌ها و APIها: `docs/SITEMAP.md` — قبل از جست‌وجوی گسترده آن را بخوان.
بک‌لاگ: `REMAINING-WORK.md` (اولویت‌بندی‌شده) · تاریخچه: `docs/WORK-SUMMARY.md`, `docs/LIFEOS-WORKLOG.md`.

## معماری در یک نگاه
- **بک‌اند مرجع = `server.js`** (Node خام، بدون فریم‌ورک، ~۹۷۵ خط ولی خطوط خیلی بلند/minified-style).
  - دادهٔ محلی: `data/db.json` (یک blob JSON) + بکاپ روزانه در `data/backups/`.
  - helperها: خطوط ۱–۶۳۳ · `handleRequest`: خط ~۶۳۴ · بلوک مسیرها: از `if(p==='/api/auth/signup'` تا `let file=p==='/'…` (~۸۴۲) · سرو استاتیک و تایمرها بعد از آن.
- **Worker کلادفلر = `cloudflare/worker.js` — تولیدی، دستی ویرایش نکن.**
  - `node cloudflare/port.js` = `cloudflare/header.js` + بلوک مسیرهای server.js (تبدیل‌شده به Web API) + `cloudflare/footer.js`.
  - helper جدید در server.js ⇒ همان را داخل `makeHelpers(env)` در `header.js` هم اضافه کن (گاردهای Drift/Export/Helper-parity در port.js چک می‌کنند).
  - مسیرهای فقط-Worker (tgju، webhook تلگرام، uploads، cron، دروازهٔ لاگین) در `footer.js` هستند.
  - ذخیره: D1 `pdmaz-db`، جدول `kv`، key=`db` (همان blob). PBKDF2 روی Worker سقف ۱۰۰k دارد.
- **فرانت = React 19 + Vite** در `src/today/` → build داخل `public/` (`index.html` و `assets/index-*.js` gitignore هستند).
  - یک SPA؛ روتینگ با `/?page=<name>` در `src/today/src/main.jsx` (تابع `App`، ~خط ۱۵۷).
  - صفحات: calendar, planner, finance, market, football, series, movies, media(music/youtube), notes, documents, contacts, settings. هر کدام `src/today/src/<page>.jsx` + `.css` (series/movies/settings داخل main.jsx).
  - منو: `NAV_PAGES` + `TopNav` در main.jsx. `public/design/*-page.html` فقط ریدایرکت به `/?page=` هستند (به‌جز login-page.html که صفحهٔ واقعی ورود است).
  - مشترک: `public/shared-ui.js` (تم `lifeos-mode`)، `shared-shell.css`، `shared-theme.css`، `assets/css/core.css`، `assets/js/core.js`. آیکون: `lucide-react`.
  - فایل‌های legacy (دست نزن مگر لازم): `public/legacy-today.html`, `old-app.html`, `report.html`, `newtab.html`, `newtab-extension/`.

## دستورات
```bash
npm ci
npm run build:today      # حتماً قبل از تست؛ بدون build، ui/verify تست‌ها قرمز می‌شوند
npm test                 # smoke(490) + worker-smoke(134) + verify-script(26) + ui-smoke(39) — همه باید سبز باشند
npm start                # server.js روی :3000
npm run dev:today        # vite dev
node cloudflare/port.js  # بعد از هر تغییر مسیر/helper در server.js
npm run deploy           # build + wrangler deploy (فقط با اجازهٔ کاربر)
```

## قواعد کار
- هر تغییر API: اول `server.js` → بعد `node cloudflare/port.js` → `npm test`.
- متن UI فارسی، `dir=rtl`، اعداد با `fa()`/`toLocaleString('fa-IR')`. واحد پول ذخیره‌شده **ریال** است (`_meta.currencyUnit='IRR'`)، نمایش تومان = ÷۱۰.
- تاریخ‌ها ISO با منطقهٔ `Asia/Tehran`؛ نمایش جلالی با `Intl` (`fa-IR-u-ca-persian`).
- کلیدهای API در `.env` (نمونه: `.env.example`) / `wrangler secret`. هرگز commit نکن.
- `ielts-content-all-45-files-COMPLETE.zip` در ریشه = دادهٔ واژگان IELTS (۴۵ فایل JSON، ۴۴۹۴ واژه) برای ماژول آیندهٔ یادگیری؛ هنوز به اپ وصل نشده.
