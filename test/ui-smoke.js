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
  'public/index.html',
  'public/design/calendar-page.html',
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
  '/design/spotify-page.html', '/design/youtube-page.html',
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
  check(`${path.basename(file)} uses the canonical navigation links`,
    JSON.stringify(links) === JSON.stringify(canonicalLinks), links.join(' | '));
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
check('today page exposes a visible quick-note inbox',
  home.includes('id="inboxCard"') && home.includes('id="inboxList"') && home.includes('اینباکس یادداشت‌ها'));
check('new quick notes appear in the inbox immediately',
  home.includes('INBOX.unshift(x.d)') && home.includes("if(typeof renderInbox==='function')renderInbox()"));
check('inbox items can become a task or a daily note',
  home.includes("data-inbox-to=\"task\"") && home.includes("data-inbox-to=\"note\"") &&
  home.includes("'/api/inbox/'+encodeURIComponent(id)+'/convert'"));

console.log(`\nUI smoke: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
