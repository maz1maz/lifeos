# نقشهٔ سایت و کد LifeOS

به‌روزرسانی: ۲۰۲۶-۱۱-۱۷ (هم‌گام با master). خلاصهٔ معماری و دستورات: `CLAUDE.md`.

## ۱) صفحات (UI) → فایل → APIهای مصرفی

| URL | کامپوننت / فایل | API |
|---|---|---|
| `/` امروز | `App` در `src/today/src/main.jsx` | dashboard, tasks, reminders, daily, transactions, inbox, tgju, football/remote/free/matches, ai/chat |
| `/?page=calendar` | `calendar.jsx` | calendar/feed, tasks, reminders, daily |
| `/?page=planner` (هاب: `planner\|calendar\|habits\|focus\|time`) | `planner.jsx`؛ عادت‌ها `HabitsPage` در `habits.jsx`؛ تمرکز `FocusPage` در `life.jsx` | tasks, reminders, habits(+history), time |
| `/?page=review` (هاب: `goals\|week\|stats\|logbook`) | `GoalsPage`/`LifeStatsPage` در `life.jsx`، `WeeklyPage` در `habits.jsx`، `logbook.jsx` | col/ygoals, goals, weekly-review, life-review, wins, decisions |
| `/?page=projects` `health` `car` `travel` `crm` `learning` `journal` | `life.jsx` (lazy؛ helperها در `life-core.jsx`، کارت‌های امروز در `life-cards.jsx`)؛ صورت وضعیت پروژه: `statement.jsx` + `statementImport.js` + `statementPrint.js` (خروجی PDF/Excel) | col/{projects,cards,health,vehicles,carlogs,trips,customers,deals,learning,journal}, trips |
| `/?page=courses` | `courses.jsx` (کلاس امروز: `ClassTodayCard`) | col/courses, col/students, courses/payment |
| `/?page=vocab` `ielts` (هاب یادگیری: `ielts\|vocab\|learning`) | `vocab.jsx` + اپ مستقل `public/vocab/` (iframe)، `ielts*.jsx` (بخش آیلتس پایین) | vocab(+learned, summary, star)، ielts/* |
| `/?page=upcoming` `discover` (هاب تماشا) | `watchx.jsx` (`UpcomingPage`, `DiscoverPage`) | movies/upcoming, movies/recommendations, movies/from-tmdb, movies/from-tvmaze |
| `/?page=speech` استودیوی گفتار | `speech.jsx` → سرویس محلی `speech-studio/` (Python، روی سیستم کاربر با `run.bat`؛ صوت از سیستم بیرون نمی‌رود) | API همان سرویس محلی (`/api/jobs/*`)، نه Worker |
| `/?page=finance` | `finance.jsx` (تب‌ها: تراکنش، حساب، بودجه، بدهی، پورتفو، هشدار، بت/پوکر، واردکردن بانک) | transactions(+import-bank, recategorize), accounts, transfers, budgets, debts, finance, portfolio, investments/tx, investments/alerts, bet, poker |
| `/?page=market` | `market.jsx` | tgju, tgju/history (فقط Worker)، market/stocks |
| `/?page=crypto` کیف‌پول کریپتو (فقط مدیر) | `crypto.jsx` + `crypto.css` (lazy؛ `ADMIN_ONLY` در main.jsx). قیمت از CoinGecko در مرورگر هر ۵ دقیقه؛ `&chart=<COIN>` = نمودار TradingView (iframe، Binance `<COIN>USDT`؛ BTT→BTTCUSDT، EOS→AUSDT) | col/cryptoWallets, col/cryptoHistory, crypto/alert (۴۰۳ برای غیرمدیر) |
| `/?page=football` | `football.jsx` | football/remote/free/{leagues,matches,standings} |
| `/?page=series` | `SeriesReact` در `watch-pages.jsx` (lazy؛ helperها در `main-util.jsx`) | movies, movies/tvmaze/*, movies/from-tvmaze, import-bingers |
| `/?page=movies` | `MoviesReact` در `watch-pages.jsx` | movies, movies/tmdb/search, movies/from-tmdb |
| `/?page=media` `music` `youtube` | `media.jsx` | media-log, integrations/spotify/*, integrations/youtube/* |
| `/?page=notes` | `notes.jsx` | inbox |
| `/?page=documents` | `documents.jsx` | documents (+`/attach` base64 ≤۱۲MB) |
| `/?page=contacts` | `contacts.jsx` | contacts, contacts/import, contacts/dedupe |
| `/?page=insights` بینش | `insights.jsx` (+ کارت `insights-card.jsx`) | ai/report, ai/tomorrow-priorities, insights, ai/correlations, one-year-ago |
| `/?page=logbook` دفتر و مرور | `logbook.jsx` (+ نوار روزانهٔ خرج/حال از reports) | life-review (period=jmonthly), wins, decisions, reports |
| `/?page=time` زمان کار (تب برنامه‌ریز) | `timelog.jsx` | timer(+start/stop/cancel), time (+:id PATCH/DELETE), col/projects |
| `/?page=exercise` ورزش (تب کنار سلامت) | `exercise.jsx` | exercise (type, minutes, date, km?, note?) |
| `/?page=reading` اخبار | `reading.jsx` (تگ خودکار `autoTag`، خوانندهٔ درون‌برنامه `Reader`، پایش زنده) | news(+sources با کشف فید/تیتر صفحه/rss2json، sync، :id/read، :id/summarize، :id/translate)، news/live-monitor(+translate) از `cloudflare/lib/live-monitor.js` |
| `/?page=bookmarks` لینک‌ها (تب یادداشت‌ها) | `BookmarksPage` در `reading.jsx` | bookmarks |
| دستیار (همهٔ صفحه‌ها) | `assistant.jsx` (lazy، دکمهٔ شناور فقط وقتی aiConfigured) | ai/chat با `page` → `pageContext` در api.js |
| `/?page=admin` | `admin.jsx` (lazy) + `msgbar.jsx` (نوار پیام مدیر) | admin/overview, admin/users/:id/{logout,disable,locks}, admin/message |
| `/?page=settings` | `SettingsReact` در main.jsx | me, integrations, google-calendar/sync, telegram/link-code, security/pin, backup/telegram (فقط Worker) |
| `/design/login-page.html` | صفحهٔ ورود مستقل (HTML بزرگ) | auth/login, auth/signup, auth/google, auth/forgot + auth/reset (کد ۶ رقمی به تلگرام) |
| `/design/*-page.html` | ریدایرکت به `/?page=…` | — |
| legacy | `legacy-today.html`, `old-app.html`, `report.html`, `newtab.html` | — |
| `/?page=settings` → «🌐 اتصال سایت شخصی» | `SiteTokensCard` در main.jsx | site-tokens (ساخت/لغو توکن scope‌دار) |
| سایت ملینا `seyfikhani.ir/studio.html` | `integrations/seyfikhani/` (HTML/JS + پروکسی PHP روی cPanel) | `/api/ext/*` با Bearer توکن (فقط Worker): col/{projects,cards,projectProcesses,courses,students}, students/:id/payments, reminders, me |

### قابلیت‌های سراسری (۲۰۲۶-۱۰)
- قفل بخش‌ها توسط مدیر: `user.lockedModules` (کلیدهای «بخش‌های من») → در `/api/me` ماژول خاموش و API آن بخش ۴۰۳ (`MODULE_API` + `auth` سایه‌شده در `runRoutes`). صفحهٔ قفل: `pageLocked` در main.jsx.
- حالت تمرکز: `lifeos-focus-mode` در localStorage (off/auto/on، ساعت و روز، بخش‌های پنهان) → `withFocus` روی `useModules()`؛ تنظیمات با `useModules(true)` (خام) کار می‌کند.
- کیف‌پول کریپتو (۲۰۲۶-۱۰-۲۸): `cryptoWallets {name, note?, holdings:[{coin, chain, amount, price, flag?}]}` و `cryptoHistory {day:'YYYY-MM-DD'|'backfill', points:[{t, total, wallets, est?}]}` در COLS (ماژول finance در `MODULE_API`). نقطهٔ تاریخچه فقط وقتی صفحه باز است (حداکثر هر ۳۰ دقیقه)؛ `est:true` = تخمین گذشته (مقدار فعلی × قیمت پایانی روز). CSP: فقط `frame-src https://s.tradingview.com`. cron (`cryptoTick` در helpers، ساعتی برای مدیر): قیمت از CoinGecko، نقطهٔ تاریخچه هر ۶ ساعت، هشدار تلگرام وقتی ارزش کل در ۲۴ ساعت `cryptoAlertPct`٪ (پیش‌فرض ۱۰، ۰ = خاموش) جابه‌جا شود، حداکثر هر ۱۲ ساعت. MKR (جفت Binance حذف‌شده) = «بدون نمودار». فایل ورود JSON موجودی دارد؛ هرگز commit نشود.
- ورودی صوتی Ctrl+K (Web Speech، fa-IR). صف آفلاین ثبت سریع: `postOrQueue`/`flushOutbox` در palette.jsx؛ ردیف‌های ثبت سریع بخش‌های قفل‌شده پنهان‌اند (`lockedSection`).
- ذخیرهٔ ترتیبی ردیف‌ها (تیک تسک/یادآوری): `rowsave.js` (`saveRow`، ژورنال در sessionStorage تا بعد از reload هم برسد، `flushRowSaves`).
- خروج از حساب (`signOut` در main.jsx، ۲۰۲۶-۱۱): اول صف ذخیره فرستاده می‌شود (یا هشدار)، فقط با تأیید سرور پاک‌سازی می‌شود، و دادهٔ خصوصی مرورگر (`PRIVATE_LS`: پیش‌نویس آیلتس، تاریخچهٔ معلم زبان، کش واژگان) حذف می‌شود. کش واژگان per-account است (`owner` در `GET /api/vocab`).
- PWA: `public/sw.js` (shell کش‌شده، خواندن آفلاین `/api/*`، Web Push) + `manifest.webmanifest`. قفل PIN: `public/app-lock.js`.
- قفل `notes` شامل `/api/inbox` (خواندن/ساخت/ویرایش/حذف/تبدیل) و لیست خرید است؛ تبدیل یادداشت یک‌بار است (`convertedTo`، شناسهٔ نتیجه `cv-<noteId>`).

### هاب‌های منو (`TabHub` در main.jsx) — ۲۰۲۶-۱۰-۰۶
- برنامه‌ریز: `planner|calendar|habits|focus|time` · مرور و اهداف: `review|goals|week|stats|logbook` · سلامت: `health|exercise` · یادگیری: `ielts|vocab|learning` · یادداشت: `notes|journal|shopping|bookmarks` · تماشا: `series|movies|upcoming|discover` (WatchHub).
- گروه‌های منو: روزانه، کار، مالی، زندگی، سرگرمی، یادگیری و آرشیو. موبایل (≤۷۰۰px): نوار پایین `.bnav` (امروز، برنامه، مالی، یادداشت، همه).
- ماژول تازهٔ قابل خاموش‌کردن: `habits`؛ `vocab` و `habits` به whitelist ماژول‌ها در worker.js اضافه شدند.

## ۲) APIهای بک‌اند **بدون UI در React** (فرصت توسعه)
(به‌روز ۲۰۲۶-۱۰) هنوز بدون صفحه: news/weekly-summary · trips (سفر در life.jsx با col است). صفحه دارند: goals, habits, learning, projects, shopping, subscriptions (قبض‌ها)، weekly-review, insights, one-year-ago (بینش)، wins, decisions, life-review (دفتر و مرور)، search (Ctrl+K).

## ۳) بک‌اند
- **تنها بک‌اند: Worker** — ورودی `cloudflare/worker.js` + `cloudflare/lib/{helpers,api,edge,security}.js` (۲۰۲۶-۱۰ از یک فایل ۴۶۶KB جدا شد) — `makeHelpers(env)` (auth/PBKDF2، تاریخ تهران/جلالی، پارس پیامک بانکی `parseBankMessage`، متن آزاد `parseLifeText`، Google Calendar، فوتبال، بت/پوکر، storage v2 روی D1)، `handleApi`، و در `export default`: tgju، webhook تلگرام، uploads (در تلگرام)، cron، دروازهٔ لاگین. `server.js`/`port.js`/`header.js`/`footer.js` در ۲۰۲۶-۱۰ حذف شدند.
- ذخیره (`read`/`write` در helpers): state به shardهای `state:v2:*` در جدول `kv` شکسته شده؛ `write` هر shard را با guard می‌نویسد و در تعارض تا ۵ بار با ادغام سه‌طرفه (`mergeState`) دوباره تلاش می‌کند. کلید قدیمی `db` خودکار مهاجرت می‌کند.
- ماژول‌های دیگر lib: `ielts.js` (تصحیح و باند آیلتس)، `live-monitor.js` (فیدهای RSS پایش زنده)، `task-state.js` (چرخهٔ مشترک تسک/یادآور برای API، تقویم و تلگرام).
- تلگرام (`edge.js`): پیام/عکس → `handleTelegramMessage`؛ فایل Excel صورت‌حساب بانک → `importTelegramBankWorkbook` (ورود تراکنش با حذف تکراری‌ها).
- مدل داده: آرایه‌های users, sessions, transactions, tasks, inbox, daily, accounts, budgets, investments, investmentTx, assetPrices, priceAlerts, portfolioSnapshots, movies, mediaLog, contacts, documents, habits, habitLogs, matches, news, newsSources, betDays, … (پیش‌فرض‌ها در `read()`).

### حذف server.js (۲۰۲۶-۱۰-۰۶)
- پیش از حذف: server.js ۱۵۹ مسیر داشت و worker.js ۱۹۷ (۳۸ مسیر فقط در Worker؛ مسیری فقط در server.js نبود). تست‌های smoke.js حالا روی Worker اجرا می‌شوند.
- اجرای محلی: `npm start` (= `wrangler dev --local --port 3000`) یا `node test/worker-host.js` (بدون wrangler).

## ۴) تست‌ها (`test/`)
همه با `npm test` (به این ترتیب؛ قبلش `npm run build:today`). Worker با `load-worker.js` (کپی `cloudflare/` در پوشهٔ موقت) و D1 جعلی `d1-kv-fake.js` لود می‌شود. شمارش‌ها: اجرای ۲۰۲۶-۱۱-۱۷.
- `smoke.js`: worker.js واقعی از طریق `test/worker-host.js` (سرور HTTP نود + D1 جعلی که state را در DB_PATH آینه می‌کند) — ۵۰۰ چک.
- `worker-smoke.js`: worker.js با D1 شبیه‌سازی‌شده — ۴۹۴.
- `task-reminder-smoke.js`: چرخهٔ تسک/یادآور و ذخیرهٔ ترتیبی — ۲۳.
- `verify-script-smoke.js`: `docs/verify-live.console.js` (چک سلامت دیپلوی لایو) — ۲۶، نیاز به build.
- `ui-smoke.js`: باندل React در Chromium (شامل جهت فلش‌های RTL) — ۴۹، نیاز به build.
- `statement-finance-smoke.js`: محاسبهٔ صورت وضعیت پروژه و مانده‌طلب (`statement.jsx` + `life.jsx`).
- `render-smoke.js`: رندر کامپوننت‌ها با داده (خطای صفحهٔ سیاه) — ۱۲.
- `sidebar-audit-accept.cjs` (A01–A19، ۵۶) و `sidebar-continuation-accept.cjs` (B01–B13، ۳۴): تست پذیرش دو ممیزی منو (`docs/SIDEBAR-*-AUDIT.md`).
- خارج از `npm test`: `vocab-quality-smoke.js` (کیفیت دادهٔ `words.json`).

## ۵) اسکریپت‌ها و مستندات
- `scripts/` — build: `prune-stale-bundles.js`، `prune-studio-assets.js` (پنل ملینا)؛ API: `gen-openapi.js` (برای HawkScan)؛ آیلتس: `ielts-check.mjs`، `ielts-convert-bandready.mjs`، `ielts-chart-svg.mjs`، `ielts-pdf.py`، `import-ielts.js`؛ واژگان: `add-ipa.mjs`، `cefr-levels.py`، `repair-vocab-quality.js`، `apply-vocab-fixes.py`؛ دیگر: `gen-statement-template.py`، `get-season-photos.mjs`، `md2html.js`، `serve-docs.js`؛ یک‌بارمصرف قدیمی: `apply-all-improvements.js`، `slim-movies-page.js`، `slim-series-page.js`.
- `docs/`: WORK-SUMMARY, LIFEOS-WORKLOG (تاریخچه)، SIDEBAR-TECHNICAL-AUDIT + SIDEBAR-CONTINUATION-AUDIT + TASK-REMINDER-AUDIT (ممیزی‌ها، همه اصلاح‌شده)، IELTS-CONTENT، SERIES-SPEC، SERIES-CODE-COPY، DOCUMENTS-UPLOAD، IPHONE-SHORTCUT، DASTYAR-BENCHMARK، `verify-live.console.js`. منسوخ: DB-VERSION-PATCH (دربارهٔ server.js حذف‌شده).
- `public/downloads/`: نسخه‌های قابل دانلود صفحهٔ سریال (قدیمی).

## ۶) نکات/بدهی فنی شناخته‌شده
- (کاهش یافت ۲۰۲۶-۱۰) نوشتن هم‌زمان: با shardهای v2 و guard/retry/merge دیگر «آخرین برنده» نیست؛ مهاجرت به جدول‌های SQL واقعی همچنان اختیاری.
- PBKDF2 روی Worker سقف ۱۰۰k تکرار دارد.
- (حل شد ۲۰۲۶-۱۰) `vite.config.js` و `@cloudflare/vite-plugin` حذف شدند؛ build فقط با `vite.today.config.mjs`. قبلاً: دو فایل vite config (`vite.today.config.mjs` که build واقعی از آن است).
- `public/design/cards-v2.html` (۳۵۰KB) و `login-page.html` (۲۷۰KB) فونت base64 دارند.

## آیلتس (`?page=ielts&s=reading|listening|writing|speaking`، تب سوم هاب یادگیری؛ ماژول `vocab`)
- چهار بخش با تب: ریدینگ (بانک آزمون با فیلتر پسیج/تکرار + واژگان)، لیسنینگ (آزمون‌ها)، رایتینگ (تصحیح AI)، اسپیکینگ (`ielts-speaking.jsx`: ساختار و معیارها، کارت Part 2 با تایمر و ضبط محلی، سؤال‌های Part 1/3، لینک معلم). آزمون‌ها را فقط مدیر اضافه می‌کند.
- `src/today/src/ielts.jsx` + `ielts.css`: تب‌های مهارت، تصحیح رایتینگ AI (با تسک انتخابی از کتاب، تصویر نمودار و تایمر ۲۰/۴۰ دقیقه)، لینک‌ها و منابع.
- بالای صفحه `ielts-status.jsx`: تب مهارت‌ها با آخرین باند هر مهارت، باند تخمینی کل، هدف و شمارش معکوس روز آزمون (localStorage `lifeos-ielts-goal`). هاب یادگیری: آیلتس اول؛ «کتاب و دوره» = `?page=learning&t=books`.
- واژه از پسیج ریدینگ ← انتخاب ← «واژه»: `POST /api/vocab/star {w}` (ستاره‌دار در اپ زبان؛ `vocabStar` در helpers).
- آماده‌سازی کتاب‌ها: `docs/IELTS-CONTENT.md` (قالب JSON) + `node scripts/ielts-check.mjs <پوشه>` (اعتبارسنجی + تصحیح با کلید خودش) و `--img` برای data URL تصویر.
- رایتینگ و اسپیکینگ کتاب‌ها: `ielts-book.jsx` (`WritingBook`، `SpeakingBook`). همان کتابخانهٔ مشترک با `skill:'writing'` = `tasks[{task:'task1'|'task2', prompt, image? (data URL), data? (نمودار به متن برای مصحح AI), model? (نمونه‌پاسخ کتاب)}]` و `skill:'speaking'` = `cards[{title, text, ask?, notes? (یادداشت ممتحن)}]`؛ بدون کلید، بدون attempt و صوت.
- بانک ریدینگ: ۲۴۲ پسیج IELTS Atlas (برنامهٔ جدا که در ۲۰۲۶-۱۰ حذف شد) به JSON همین قالب تبدیل و در کتابخانهٔ مشترک وارد شده‌اند (`id` = `atlas-<p1|p2|p3>-<freq>-<n>`، `bank:'atlas'`، `part`، `freq`، توضیح فارسی در `explain`).
- آزمون‌ها (ریدینگ و لیسنینگ): `ielts-exams.jsx` (کارت + نما) → `ielts-reading.jsx` (متن | سؤال با جداکنندهٔ کشیدنی، هایلایت و یادداشت روی متن، علامت مرور، اندازهٔ متن، تایمر ۶۰ دقیقه / ۲۰ دقیقه برای یک پسیج، تحویل خودکار) و `ielts-listening.jsx` (صوت یک بار + ۱۰ دقیقه بازبینی)، پوستهٔ مشترک `ielts-cd.jsx`، برگهٔ سؤال و نتیجه `ielts-paper.jsx`، پیش‌نویس در `ielts-exams-store.js`. سرور: `cloudflare/lib/ielts.js` (اعتبارسنجی، نرمال‌سازی جواب، تصحیح، جدول باند listening/academic/general). آزمون = JSON (`skill`, `module`, `book`, `test`, `sections[{passage?, groups}]`, `key`، برای لیسنینگ `tape`/`evidence`) در ردیف kv جدا `ielts:ex:<uid>:<id>` (فهرست `ielts:ex:<uid>`) یا در کتابخانهٔ مشترک `ielts:ex:shared[:<id>]` که فقط مدیر سایت پر می‌کند و همه می‌بینند (`?shared=1` هنگام ورود، `PATCH {shared}` برای جابه‌جایی)، **هرگز در ریپو** (کتاب کپی‌رایت دارد و ریپو عمومی است)؛ صوت در چت تلگرام کاربر. انواع گروه سؤال: چندگزینه‌ای، `choices` (TFNG/YNNG)، `options` (تطبیق)، `lines` با [n] (+`bank` لیست کلمات)، `table`، `pick`. API: `GET /api/ielts/exams`، `POST …/tests`، `GET|DELETE …/tests/:id` (بدون کلید)، `POST|GET …/tests/:id/audio`، `POST …/attempts` (`parts` برای یک پسیج، `marks` هایلایت‌ها)، `GET|DELETE …/attempts/:id`. نتیجه‌ها در `db.ieltsAttempts`.
- API: `GET|POST /api/ielts/writing`، `DELETE /api/ielts/writing/:id` (ذخیره در `db.ieltsWritings`، ۵۰ مورد آخر؛ نمرهٔ کل در سرور از میانگین ۴ معیار گرد به نیم‌باند).
