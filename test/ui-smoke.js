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

const navPages = [
  'public/design/contacts-page.html',
  'public/design/documents-page.html',
  'public/design/finance-page.html',
  'public/design/football-page.html',
  'public/design/market-page.html',
  'public/design/movies-page.html',
  'public/design/series-page.html',
  'public/design/settings-page.html',
  'public/design/spotify-page.html',
  'public/design/youtube-page.html'
];
const allPages = navPages.concat('public/design/login-page.html');
const canonicalLinks = [
  '/', '/design/calendar-page.html', '/design/finance-page.html',
  '/design/market-page.html', '/design/football-page.html',
  '/design/series-page.html', '/design/movies-page.html',
  '/design/spotify-page.html', '/design/youtube-page.html', '/design/notes-page.html',
  '/design/documents-page.html', '/design/contacts-page.html',
  '/design/settings-page.html'
];

for (const file of allPages) {
  const html = read(file);
  check(`${path.basename(file)} loads the shared theme controller once`,
    (html.match(/\/shared-ui\.js/g) || []).length === 1);
  check(`${path.basename(file)} loads the final shared shell once`,
    (html.match(/\/shared-shell\.css/g) || []).length === 1);
}
for (const file of navPages) {
  const html = read(file);
  const nav = (html.match(/<nav class="nav">([\s\S]*?)<\/nav>/) || [])[1] || '';
  const links = [...nav.matchAll(/<a[^>]*href="([^"]+)"/g)].map(x => x[1]).slice(1);
  const expectedLinks = file === 'public/design/documents-page.html'
    ? canonicalLinks.filter(link => link !== '/design/notes-page.html')
    : canonicalLinks;
  check(`${path.basename(file)} uses the canonical navigation links`,
    JSON.stringify(links) === JSON.stringify(expectedLinks), links.join(' | '));
  check(`${path.basename(file)} has exactly one closing tag for its nav`,
    !/<\/nav>\s*<\/nav>/.test(html));
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

const market = read('public/design/market-page.html');
const marketBlock = market.slice(market.indexOf('MARKET (چهارستونه)'), market.indexOf('\n</div>\n<script>', market.indexOf('MARKET (چهارستونه)')));
check('market uses a four-column desktop grid',
  market.includes('.trio{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))'));
check('US stocks are the fourth card inside the market grid',
  (marketBlock.match(/class="mcard"/g) || []).length === 4 &&
  marketBlock.indexOf('سهام آمریکا') > marketBlock.indexOf('بازار تومان'));
check('market keeps responsive two/one-column fallbacks',
  market.includes('.page3,.trio{grid-template-columns:repeat(2') &&
  /@media\(max-width:900px\)[\s\S]*?\.trio\{grid-template-columns:1fr!important\}/.test(market));

const football = read('public/design/football-page.html');
check('football has one explicit two-column layout',
  football.includes('class="fb-layout"') && football.includes('grid-template-columns:minmax(390px,.88fr) minmax(480px,1.12fr)'));
check('football places standings left and matches right',
  football.includes('.fb-table-card{grid-column:1}') && football.includes('.fb-matches-card{grid-column:2}'));
check('football groups and sorts match dates newest first',
  football.includes('order.sort(function(a,b){return b.localeCompare(a)})'));
check('football standings are horizontally compact',
  football.includes('min-width:370px') && football.includes('padding:5px 3px'));
check('football exposes UEFA Europa and AFC Champions League Elite tabs',
  football.includes("{id:'uefa.europa',label:'لیگ اروپا'") &&
  football.includes("{id:'afc.champions',label:'لیگ نخبگان آسیا'"));

const home = read('public/index.html');
const todaySource = read('src/today/src/main.jsx');
check('today page is the Vite React entry point',
  home.includes('id="root"') && /assets\/index-.*\.js/.test(home));
check('React today screen keeps the existing Worker task/reminder APIs',
  todaySource.includes("'/api/tasks'") && todaySource.includes("'/api/reminders'") &&
  todaySource.includes('`/api/tasks/${task.id}`') && todaySource.includes('`/api/reminders/${reminder.id}`'));
check('React today screen keeps dashboard and daily-log APIs',
  todaySource.includes('`/api/dashboard?date=${today}`') && todaySource.includes("'/api/daily'"));
check('React calendar uses the real unified feed and selected-day daily endpoint',
  todaySource.includes('`/api/calendar/feed?from=${range.from}&to=${range.to}`') &&
  todaySource.includes('`/api/daily?date=${date}`') && todaySource.includes("method: 'PUT'"));
check('React calendar supports Jalali/Gregorian switching and month navigation',
  todaySource.includes('const switchMode = ()') && todaySource.includes('const moveMonth = direction') &&
  todaySource.includes('toGregorian(cursor.jy, cursor.jm, 1)'));
check('React finance keeps the existing finance APIs for budgets, transfers, debts and investments',
  todaySource.includes("'/api/budgets'") && todaySource.includes("'/api/transfers'") &&
  todaySource.includes("'/api/debts'") && todaySource.includes("'/api/investments/tx'"));
check('React finance supports transaction editing and bank-import preview before commit',
  todaySource.includes("'/api/transactions/import-bank/preview'") &&
  todaySource.includes("'/api/transactions/import-bank/commit'") && todaySource.includes("setEditing({ type: 'transaction', item })"));
check('React today route no longer embeds the legacy today iframe',
  !todaySource.includes('title="LifeOS امروز" src="/legacy-today.html"'));
const migratedRoutes = {
  'finance-page.html': 'finance', 'market-page.html': 'market', 'football-page.html': 'football',
  'movies-page.html': 'movies', 'series-page.html': 'series', 'spotify-page.html': 'music',
  'youtube-page.html': 'youtube', 'notes-page.html': 'notes', 'documents-page.html': 'documents',
  'contacts-page.html': 'contacts', 'settings-page.html': 'settings'
};
for (const [file, route] of Object.entries(migratedRoutes)) {
  check(`${file} redirects to its React route`,
    read(`public/design/${file}`).includes(`location.replace('/?page=${route}')`));
}

const settings = read('public/design/settings-page.html');
const calendarRedirect = read('public/design/calendar-page.html');
check('published calendar route opens the React calendar host',
  calendarRedirect.includes("/?page=calendar") && calendarRedirect.includes('location.replace'));
check('settings exposes a real Google Calendar OAuth/sync/disconnect card',
  settings.includes('id="googleCalendarCard"') && settings.includes('/api/integrations/google-calendar/connect') &&
  settings.includes('/api/integrations/google-calendar/sync') && settings.includes('/api/integrations/google-calendar/disconnect'));
check('settings explains the dedicated LifeOS calendar and non-destructive delete policy',
  settings.includes('تقویم اختصاصی LifeOS') && settings.includes('حذف آن در گوگل دادهٔ هسته را پاک نمی‌کند'));
const serverSource = read('server.js');
const workerHeader = read('cloudflare/header.js');
check('Node and Worker backups redact Calendar refresh tokens and live sessions',
  serverSource.includes('delete u.googleCalendarRefreshToken') && workerHeader.includes('delete u.googleCalendarRefreshToken') &&
  serverSource.includes('clone.sessions=[]') && workerHeader.includes('clone.sessions=[]'));
check('Google OAuth uses read-only visible-calendar access plus app-created-calendar write access, never full calendar scope',
  serverSource.includes('auth/calendar.readonly') && serverSource.includes('auth/calendar.app.created') &&
  !serverSource.includes("SCOPES='https://www.googleapis.com/auth/calendar'"));
for (const file of ['public/design/calendar-page.html','public/design/settings-page.html']) {
  const html = read(file);
  let syntaxOk = true, detail = '';
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { new vm.Script(m[1], { filename: file }); } catch (e) { syntaxOk = false; detail = e.message; break; }
  }
  check(`${path.basename(file)} inline scripts parse`, syntaxOk, detail);
}

console.log(`\nUI smoke: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
