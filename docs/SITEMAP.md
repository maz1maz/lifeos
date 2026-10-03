# نقشهٔ سایت و کد LifeOS

به‌روزرسانی: ۲۰۲۶-۰۹-۳۰. خلاصهٔ معماری و دستورات: `CLAUDE.md`.

## ۱) صفحات (UI) → فایل → APIهای مصرفی

| URL | کامپوننت / فایل | API |
|---|---|---|
| `/` امروز | `App` در `src/today/src/main.jsx` | dashboard, tasks, reminders, daily, transactions, inbox, tgju, football/remote/free/matches, ai/chat |
| `/?page=calendar` | `calendar.jsx` | calendar/feed, tasks, reminders, daily |
| `/?page=planner` | `planner.jsx` | tasks, reminders |
| `/?page=finance` | `finance.jsx` (تب‌ها: تراکنش، حساب، بودجه، بدهی، پورتفو، هشدار، بت/پوکر، واردکردن بانک) | transactions(+import-bank, recategorize), accounts, transfers, budgets, debts, finance, portfolio, investments/tx, investments/alerts, bet, poker |
| `/?page=market` | `market.jsx` | tgju, tgju/history (فقط Worker)، market/stocks |
| `/?page=football` | `football.jsx` | football/remote/free/{leagues,matches,standings} |
| `/?page=series` | `SeriesReact` در main.jsx | movies, movies/tvmaze/*, movies/from-tvmaze, import-bingers |
| `/?page=movies` | `MoviesReact` در main.jsx | movies, movies/tmdb/search, movies/from-tmdb |
| `/?page=media` `music` `youtube` | `media.jsx` | media-log, integrations/spotify/*, integrations/youtube/* |
| `/?page=notes` | `notes.jsx` | inbox |
| `/?page=documents` | `documents.jsx` | documents (+`/attach` base64 ≤۱۲MB) |
| `/?page=contacts` | `contacts.jsx` | contacts, contacts/import, contacts/dedupe |
| `/?page=settings` | `SettingsReact` در main.jsx | me, integrations, google-calendar/sync, telegram/link-code, security/pin, backup/telegram (فقط Worker) |
| `/design/login-page.html` | صفحهٔ ورود مستقل (HTML بزرگ) | auth/login, auth/signup, auth/google |
| `/design/*-page.html` | ریدایرکت به `/?page=…` | — |
| legacy | `legacy-today.html`, `old-app.html`, `report.html`, `newtab.html` | — |
| `/?page=settings` → «🌐 اتصال سایت شخصی» | `SiteTokensCard` در main.jsx | site-tokens (ساخت/لغو توکن scope‌دار) |
| سایت ملینا `seyfikhani.ir/studio.html` | `integrations/seyfikhani/` (HTML/JS + پروکسی PHP روی cPanel) | `/api/ext/*` با Bearer توکن (فقط Worker): col/{projects,cards,projectProcesses,courses,students}, students/:id/payments, reminders, me |

## ۲) APIهای بک‌اند **بدون UI در React** (فرصت توسعه)
goals · habits(+history) · exercise · learning · projects · time/timer · trips · shopping · subscriptions · wins · decisions · bookmarks · news(+sources, sync, weekly-summary) · weekly-review · life-review · insights · reports · one-year-ago · calendar/on-this-day · search · export · ai/{report, correlations, tomorrow-priorities, process, suggest-category} · football/{matches, teams, accuracy, remote/odds, 1xbet, sofascore} · movies/{stats, next-episode-alerts} · reminders/statement-check · days.

## ۳) بک‌اند
- `server.js`: helperها ۱–۶۳۳ (auth/PBKDF2، تاریخ تهران/جلالی، پارس پیامک بانکی `parseBankMessage`، متن آزاد `parseLifeText`، Google Calendar sync، فوتبال varzesh3/ESPN/TheSportsDB، بت/پوکر)، `handleRequest` ۶۳۴، مسیرها ۶۳۵–۸۴۱، استاتیک ۸۴۲+، تایمرها (تلگرام long-poll، گزارش صبح/شب، قیمت‌ها) و `createServer` در انتها.
- Worker: `cloudflare/header.js` (makeHelpers + handleApi + مسیرهای فقط-Worker مثل backup/telegram) → `port.js` → `worker.js`. `footer.js`: buildResponse، uploads (R2)، webhook تلگرام، cron هر ۱۵ دقیقه، tgju، دروازهٔ لاگین برای همهٔ مسیرهای غیر API.
- مدل داده: یک blob با آرایه‌های users, sessions, transactions, tasks, inbox, daily, accounts, budgets, investments, investmentTx, assetPrices, priceAlerts, portfolioSnapshots, movies, mediaLog, contacts, documents, habits, habitLogs, matches, news, newsSources, betDays, … (پیش‌فرض‌ها در `read()`).

## ۴) تست‌ها (`test/`)
- `smoke.js`: server.js واقعی روی DB موقت (۴۹۰ چک).
- `worker-smoke.js`: worker.js با D1 شبیه‌سازی‌شده (۱۳۴).
- `verify-script-smoke.js`: `docs/verify-live.console.js` (چک سلامت دیپلوی لایو) — نیاز به build.
- `ui-smoke.js`: باندل React در Chromium (۳۹) — نیاز به build.

## ۵) اسکریپت‌ها و مستندات
- `scripts/`: `prune-stale-bundles.js` (بخشی از build)، بقیه اسکریپت‌های یک‌بارمصرف patch/slim قدیمی (`apply-*`, `fix-db-write-sync`, `slim-*`)، `md2html.js`, `serve-docs.js`.
- `docs/`: WORK-SUMMARY, LIFEOS-WORKLOG (تاریخچه)، SERIES-SPEC، DOCUMENTS-UPLOAD، DB-VERSION-PATCH، DASTYAR-BENCHMARK.
- `public/downloads/`: نسخه‌های قابل دانلود صفحهٔ سریال (قدیمی).

## ۶) نکات/بدهی فنی شناخته‌شده
- blob واحد JSON ⇒ نوشتن همزمان «آخرین برنده». برای یک کاربر OK.
- رمزهای هش‌شده با ۱۳۰k تکرار در Node روی Worker کار نمی‌کنند (سقف ۱۰۰k).
- دو فایل vite config (`vite.config.js` با پلاگین cloudflare، `vite.today.config.mjs` که build واقعی از آن است).
- `public/design/cards-v2.html` (۳۵۰KB) و `login-page.html` (۲۷۰KB) فونت base64 دارند.
- ۲۰۲۶-۰۹-۳۰: `header.js` از `worker.js` عقب بود (fixهای فوتبال دستی در worker.js)؛ همگام شد و `port.js` دوباره سبز است.
