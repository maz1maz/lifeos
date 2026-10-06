const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log('  ✓', name);
  } else {
    failed++;
    console.error('  ✗', name, detail ? `— ${detail}` : '');
  }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

console.log('\n[UI] پوسته، تم، بازار، فوتبال و اینباکس');

// همهٔ صفحات design/*.html (به‌جز login) الان استاب ریدایرکت به React‌ان — پوستهٔ
// مشترک/نوار ناوبری کامل دیگه لازم ندارن؛ فقط login-page.html واقعیه.
const allPages = ['public/design/login-page.html'];

for (const file of allPages) {
  const html = read(file);
  check(`${path.basename(file)} loads the shared theme controller once`,
    (html.match(/\/shared-ui\.js/g) || []).length === 1);
  check(`${path.basename(file)} loads the final shared shell once`,
    (html.match(/\/shared-shell\.css/g) || []).length === 1);
}

const sharedUi = read('public/shared-ui.js');
const store = new Map([['lifeos-mode', 'light']]);
let domReady;
let ready = false;
let themeClick;
let clickWasCapture = false;
const button = {
  dataset: {}, textContent: '', title: '',
  setAttribute() {},
  addEventListener(type, fn, capture) {
    if (type === 'click') { themeClick = fn; clickWasCapture = capture === true; }
  }
};
const root = { dataset: {} };
const sandbox = {
  localStorage: {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); }
  },
  document: {
    documentElement: root,
    readyState: 'loading',
    getElementById(id) { return ready && id === 'modeBtn' ? button : null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) { if (type === 'DOMContentLoaded') domReady = fn; }
  },
  window: { addEventListener() {} },
  console
};
vm.runInNewContext(sharedUi, sandbox, { filename: 'shared-ui.js' });
check('saved light mode is painted before page content', root.dataset.mode === 'light');
check('legacy mode key is migrated to the canonical value', store.get('mode') === 'light');
ready = true;
domReady();
check('shared theme click handler uses capture to block old duplicate handlers', clickWasCapture);
themeClick({ preventDefault() {}, stopImmediatePropagation() {} });
check('one theme click changes and persists the mode globally',
  root.dataset.mode === 'dark' && store.get('lifeos-mode') === 'dark' && store.get('mode') === 'dark');

const shell = read('public/shared-shell.css');
check('shared shell pins a full-width fixed nav',
  /html body \.nav\{[\s\S]*position:fixed!important/.test(shell) && /width:100%!important/.test(shell));
check('shared shell forces one heading font for navigation',
  /html body \.nav \.navlinks a\{[\s\S]*font-family:var\(--fh\)!important/.test(shell));

// نسخهٔ قدیمی بازار/فوتبال (چیدمان چهارستونه/دوستونه ثابت) بازنشسته شده؛
// معادل React‌شون تو main.jsx با endpoint واقعی چک می‌شه (پایین‌تر).
// از بازطراحی صفحه‌ها به بعد هر صفحه فایل React جدای خودش را دارد
// (calendar.jsx, finance.jsx, market.jsx, football.jsx, …)؛ main.jsx فقط شِل/روتر است.

const home = read('public/index.html');
const todaySource = read('src/today/src/main.jsx');
const calendarSource = read('src/today/src/calendar.jsx');
const financeSource = read('src/today/src/finance.jsx');
const marketSource = read('src/today/src/market.jsx');
const footballSource = read('src/today/src/football.jsx');
check('today page is the Vite React entry point',
  home.includes('id="root"') && /assets\/index-.*\.js/.test(home));
check('React today screen keeps the existing Worker task/reminder APIs',
  todaySource.includes("'/api/tasks'") && todaySource.includes("'/api/reminders'") &&
  todaySource.includes('`/api/tasks/${task.id}`') && todaySource.includes('`/api/reminders/${reminder.id}`'));
check('React today screen keeps dashboard and daily-log APIs',
  todaySource.includes('`/api/dashboard?date=${today}`') && todaySource.includes("'/api/daily'"));
check('React calendar uses the real unified feed and selected-day daily endpoint',
  calendarSource.includes('/api/calendar/feed?from=') &&
  calendarSource.includes('/api/daily?date=') && calendarSource.includes("method: 'PUT'"));
check('React calendar supports Jalali/Gregorian switching and month navigation',
  calendarSource.includes("m === 'jalali' ? 'gregorian' : 'jalali'") && calendarSource.includes('shift('));
check('React finance keeps the existing finance APIs for budgets, transfers, debts and investments',
  financeSource.includes("'/api/budgets'") && financeSource.includes("'/api/transfers'") &&
  financeSource.includes("'/api/debts'") && financeSource.includes("'/api/investments/tx'"));
check('React finance supports transaction editing and bank-import preview before commit',
  financeSource.includes("'/api/transactions/import-bank/preview'") &&
  financeSource.includes("'/api/transactions/import-bank/commit'") && financeSource.includes("setEditing({ type: 'transaction', item })"));
check('React today route no longer embeds the legacy today iframe',
  !todaySource.includes('title="LifeOS امروز" src="/legacy-today.html"'));
check('React market page fetches Tehran market and US stock prices',
  marketSource.includes("'/api/tgju'") && marketSource.includes("'/api/market/stocks'"));
check('React football page fetches real matches for a league',
  footballSource.includes('/api/football/remote/free/matches?league=') &&
  footballSource.includes('/api/football/remote/free/standings?league='));
const migratedRoutes = {
  'finance-page.html': 'finance', 'market-page.html': 'market', 'football-page.html': 'football',
  'movies-page.html': 'movies', 'series-page.html': 'series', 'spotify-page.html': 'music',
  'youtube-page.html': 'youtube', 'notes-page.html': 'notes', 'documents-page.html': 'documents',
  'contacts-page.html': 'contacts', 'settings-page.html': 'settings'
};
for (const [file, route] of Object.entries(migratedRoutes)) {
  check(`${file} redirects to its React route`,
    new RegExp(`location\\.replace\\('/\\?page=${route}'`).test(read(`public/design/${file}`)));
}

const calendarRedirect = read('public/design/calendar-page.html');
check('published calendar route opens the React calendar host',
  calendarRedirect.includes("/?page=calendar") && calendarRedirect.includes('location.replace'));
check('vocabulary app has the «جزوه» tab backed by notes.md (topics as ## sections)',
  read('public/vocab/index.html').includes('data-v="notes"') && read('public/vocab/app.js').includes('function renderNotes') && (read('public/vocab/notes.md').match(/^## /gm) || []).length >= 10);
check('vocabulary page loads its bundled Vazirmatn font instead of relying on a device fallback',
  read('public/vocab/index.html').includes("font-family:'Vazirmatn'") && read('public/vocab/index.html').includes("/assets/fonts/vazirmatn-arabic.woff2"));
check('React settings exposes a real Google Calendar OAuth/sync/disconnect card',
  todaySource.includes('id="googleCalendarCard"') && todaySource.includes('/api/integrations/${id}/connect') &&
  todaySource.includes('/api/integrations/google-calendar/sync') && todaySource.includes('/api/integrations/${name}/disconnect'));
check('Projects provides a dossier for project, contract, repeatable statements, and procurement records',
  read('src/today/src/life.jsx').includes('PROJECT_FILE_TABS') && read('src/today/src/life.jsx').includes("useCol('projectContracts')") &&
  read('src/today/src/life.jsx').includes("useCol('projectFinancials')") && read('src/today/src/life.jsx').includes("useCol('projectSupplies')") &&
  read('src/today/src/life.jsx').includes('processTemplate(') && read('src/today/src/life.jsx').includes("useCol('projectProcesses')") &&
  read('src/today/src/life.jsx').includes('noticeApprovedDate') && read('src/today/src/life.jsx').includes('statementSentDate') &&
  read('src/today/src/life.jsx').includes('nextStatementNo'));
check('Project checklist has accessible unit filters and matching unit chart colours',
  read('src/today/src/life.jsx').includes('departmentFilter') && read('src/today/src/life.jsx').includes('aria-pressed={departmentFilter === x.department}') &&
  read('src/today/src/life.css').includes('.lf-process-dept-stats>.dept-کنترل-پروژه') && read('src/today/src/life.css').includes('.lf-process-row .lf-process-check{display:grid;place-items:center;width:36px'));
check('Project checklist is a labelled touch-friendly card layout on phones',
  read('src/today/src/life.jsx').includes('lf-process-row-head') && read('src/today/src/life.jsx').includes('lf-process-row-fields') &&
  read('src/today/src/life.css').includes("grid-template-areas:'head' 'fields'") && read('src/today/src/life.css').includes('width:44px;height:44px'));
check('Project PDF reports include configurable branding and automatic page numbering',
  read('src/today/src/life.jsx').includes("api('/api/report-brand')") && read('src/today/src/life.jsx').includes('lf-report-print-brand') &&
  read('src/today/src/life.css').includes('counter(page)') && todaySource.includes('reportPrintSettings') && todaySource.includes('compactReportLogo'));
check('React settings explains the dedicated LifeOS calendar and non-destructive delete policy',
  todaySource.includes('تقویم اختصاصی LifeOS') && todaySource.includes('حذف آن در گوگل دادهٔ هسته را پاک نمی‌کند'));
const workerSource = read('cloudflare/worker.js');
check('Worker backups redact Calendar refresh tokens and live sessions',
  workerSource.includes('delete u.googleCalendarRefreshToken') && workerSource.includes('clone.sessions=[]'));
check('Google OAuth uses read-only visible-calendar access plus app-created-calendar write access, never full calendar scope',
  workerSource.includes('auth/calendar.readonly') && workerSource.includes('auth/calendar.app.created') &&
  !/SCOPES\s*=\s*'https:\/\/www\.googleapis\.com\/auth\/calendar'/.test(workerSource));
for (const file of ['public/design/calendar-page.html','public/design/settings-page.html']) {
  const html = read(file);
  let syntaxOk = true, detail = '';
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { new vm.Script(m[1], { filename: file }); } catch (e) { syntaxOk = false; detail = e.message; break; }
  }
  check(`${path.basename(file)} inline scripts parse`, syntaxOk, detail);
}

// باندل‌های Vite: بیلد مستقیم توی public/ می‌ریزه (emptyOutDir:false)، پس هر بیلد
// یک index-<hash> تازه می‌سازه و قبلی‌ها می‌مونن، commit می‌شن و با هر deploy آپلود
// می‌شن بی‌آنکه کسی لودشون کنه. scripts/prune-stale-bundles.js بعد از بیلد پاکشون
// می‌کنه؛ این‌جا مطمئن می‌شیم شِل به باندلی اشاره می‌کنه که واقعاً هست و باندل مرده‌ای
// در درخت نمونده.
{
  const { referencedBundles, staleBundles } = require('../scripts/prune-stale-bundles.js');
  const live = [...referencedBundles()];
  // index-c-*.js = lazy chunks (e.g. PDF export) listed only in the manifest
  const entry = live.filter((f) => !f.startsWith('index-c-'));
  check('index.html points at exactly one JS bundle and one CSS bundle',
    entry.filter((f) => f.endsWith('.js')).length === 1 && entry.filter((f) => f.endsWith('.css')).length === 1, live.join(', '));
  check('every bundle index.html references actually exists in public/assets',
    live.every((f) => fs.existsSync(path.join(ROOT, 'public', 'assets', f))), live.join(', '));
  const stale = staleBundles();
  check('no stale (unreferenced) index-*.js|css bundles are left in public/assets — run: node scripts/prune-stale-bundles.js',
    stale.length === 0, stale.length + ' stale: ' + stale.slice(0, 5).join(', ') + (stale.length > 5 ? ', …' : ''));
}

console.log(`\nUI smoke: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
