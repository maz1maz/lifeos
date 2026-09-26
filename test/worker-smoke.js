// Worker smoke test: exercises the REAL cloudflare/worker.js artifact in-process,
// with an in-memory fake for the D1 `kv` table.
//
// Why this exists: `node server.js` never sees makeHeaders' `return {...}` or the
// handleApi destructuring, so test/smoke.js stays green even when a helper is
// defined but not exported — while every request to the affected routes dies
// with ReferenceError (HTTP 500) on Cloudflare. This test imports worker.js
// itself, so that exact bug class fails here. Any HTTP 500 anywhere in this
// file is an automatic failure (see call()).
//
// Run with: npm test  (or) node test/worker-smoke.js
// Zero new prerequisites: the static `xlsx` import is stubbed out (the single
// route that needs it is skipped here; production bundles the real package via
// wrangler). Routes that need real network (tgju, news sync) or secrets are
// asserted at their pre-network 503/400 guards instead.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  - ${name}`); }
  else { fail++; console.log(`  FAIL- ${name}` + (extra ? `  [${extra}]` : '')); }
}
function today() {
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = {};
    for (const p of f.formatToParts(new Date())) if (p.type !== 'literal') parts[p.type] = p.value;
    return parts.year + '-' + parts.month + '-' + parts.day;
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}
function daysAgo(n) {
  const dt = new Date(today() + 'T12:00:00Z');
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}

// In-memory fake for the only D1 surface worker.js touches:
//   SELECT value FROM kv WHERE key='db'  -> .first()
//   INSERT INTO kv ... ON CONFLICT DO UPDATE -> .bind(json, ts).run()
function makeEnv() {
  const store = { value: null };
  return {
    DB: {
      prepare(sql) {
        const st = {
          _params: [],
          bind(...p) { st._params = p; return st; },
          async first() {
            if (sql.startsWith('SELECT value FROM kv')) return store.value === null ? null : { value: store.value };
            throw new Error('unexpected SQL in harness: ' + sql);
          },
          async run() {
            if (sql.startsWith('INSERT INTO kv')) { store.value = st._params[0]; return { success: true }; }
            throw new Error('unexpected SQL in harness: ' + sql);
          },
        };
        return st;
      },
    },
    ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
    // No secrets on purpose — same as test/smoke.js (no .env there either).
  };
}

async function main() {
  // worker.js is an ES module (`export default`); copy it next to this file as
  // .mjs so node imports it as ESM, with the `xlsx` bare import stubbed out.
  const workerSrc = fs.readFileSync(path.join(ROOT, 'cloudflare', 'worker.js'), 'utf8');
  const XLSX_IMPORT = "import * as XLSX from 'xlsx';";
  if (!workerSrc.includes(XLSX_IMPORT)) throw new Error('xlsx import line changed — update the worker-smoke harness stub');
  const tmpFile = path.join(__dirname, '.tmp-worker.mjs');
  fs.writeFileSync(tmpFile, workerSrc.replace(
    XLSX_IMPORT,
    'const XLSX = null; // harness stub: seal-toman import route is skipped in worker-smoke (production bundles real xlsx)'
  ));
  let worker;
  try {
    worker = (await import(pathToFileURL(tmpFile).href)).default;
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
  if (!worker || typeof worker.fetch !== 'function') throw new Error('worker.js did not export { fetch }');

  const env = makeEnv();
  async function call(p, { method = 'GET', cookie = null, body = null } = {}) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    let b;
    if (body !== null) { headers['content-type'] = 'application/json'; b = JSON.stringify(body); }
    const res = await worker.fetch(new Request('https://worker-smoke.local' + p, { method, headers, body: b }), env, {});
    const text = await res.text();
    let d = null;
    try { d = text ? JSON.parse(text) : null; } catch (e) { /* non-JSON body */ }
    // The whole point of this file: any 500 (e.g. ReferenceError from a helper
    // that is defined but not exported) fails immediately, with the route shown.
    if (res.status === 500) check(`no 500 on ${method} ${p}`, false, String(text).slice(0, 160));
    return { status: res.status, d, text, headers: res.headers };
  }

  console.log('\n[W1] auth on the worker artifact');
  const email = `wsmoke_${Date.now()}@example.com`;
  const signup = await call('/api/auth/signup', { method: 'POST', body: { name: 'Wsmoke', email, password: 'secret123' } });
  check('signup -> 201', signup.status === 201);
  const setCookies = typeof signup.headers.getSetCookie === 'function' ? signup.headers.getSetCookie() : [signup.headers.get('set-cookie')];
  const sidCookie = String(setCookies[0] || '').split(';')[0];
  check('signup sets an sid cookie', sidCookie.startsWith('sid='));
  const wrongPw = await call('/api/auth/login', { method: 'POST', body: { email, password: 'WRONG' } });
  check('login wrong password -> 401', wrongPw.status === 401);
  const login = await call('/api/auth/login', { method: 'POST', body: { email, password: 'secret123' } });
  check('login correct password -> 200', login.status === 200);
  const cookie = String((typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie()[0] : login.headers.get('set-cookie')) || '').split(';')[0];
  const badAuth = await call('/api/tasks', { method: 'POST', cookie: 'sid=not-a-real-session', body: { title: 'x' } });
  check('invalid cookie on mutating route -> 401 (not a crash)', badAuth.status === 401);

  console.log('\n[W2] REGRESSION: the two routes that 500’d with ReferenceError on deploy');
  const tx = (await call('/api/transactions', { method: 'POST', cookie, body: { title: 'اسنپ', amount: 85000, kind: 'expense', date: today() } })).d;
  const patched = await call(`/api/transactions/${tx.id}`, { method: 'PATCH', cookie, body: { category: 'حمل‌ونقل' } });
  check('PATCH transaction category -> 200 (normalizeCategoryName wired)', patched.status === 200);
  check('manual category edit flags catManual', patched.d && patched.d.catManual === true);
  await call('/api/transactions', { method: 'POST', cookie, body: { title: 'داروخانه', amount: 310000, kind: 'expense', date: today() } });
  const preview = await call('/api/transactions/recategorize', { method: 'POST', cookie, body: {} });
  check('recategorize preview -> 200 (categorizeTransaction wired)', preview.status === 200 && preview.d && preview.d.applied === false && preview.d.matched >= 1);
  {
    await call('/api/debts', { method: 'POST', cookie, body: { person: 'تست', amount: 5000000, type: 'payable', dueDate: today() } });
    const jp = Object.fromEntries(new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    const rep = await call(`/api/finance/monthly-report?jy=${parseInt(jp.year)}&jm=${parseInt(jp.month)}`, { cookie });
    check('monthly report -> 200 with income/expense lines', rep.status === 200 && /گزارش ماهانه/.test(rep.d?.text || '') && /هزینه/.test(rep.d.text), (rep.d?.text || rep.text).slice(0, 200));
    check('monthly report lists the due debt', /بدهی به تست/.test(rep.d?.text || ''));
    const bad = await call('/api/finance/monthly-report?jy=1405&jm=13', { cookie });
    check('monthly report rejects bad month -> 400', bad.status === 400);
    const deb = (await call('/api/debts', { cookie })).d.items.find((x) => x.person === 'تست');
    const pay = await call(`/api/debts/${deb.id}/pay`, { method: 'POST', cookie, body: { amount: 2000000 } });
    check('partial debt payment reduces amount', pay.status === 200 && pay.d.amount === 3000000 && pay.d.paid === 2000000);
    const rec = await call('/api/transactions', { method: 'POST', cookie, body: { title: 'اجاره', amount: 1000, kind: 'expense', category: 'مسکن', date: daysAgo(70), recurrence: 'jmonthly' } });
    check('jalali-monthly recurring tx created', rec.status === 201 && rec.d.recurrenceId);
    const rl = await call('/api/transactions/recurring', { cookie });
    const chain = (rl.d?.items || []).find((x) => x.title === 'اجاره');
    check('recurring list advances the chain (>=2 occurrences, next date in future)', chain && chain.count >= 2 && chain.nextDate > today(), JSON.stringify(chain));
    const stop = await call('/api/transactions/recurring/stop', { method: 'POST', cookie, body: { recurrenceId: rec.d.recurrenceId } });
    check('stop recurring', stop.status === 200 && stop.d.stopped >= 1);
    const yr = await call(`/api/finance/year?jy=${parseInt(jp.year)}`, { cookie });
    check('year comparison -> 12+12 months', yr.status === 200 && yr.d.current.length === 12 && yr.d.previous.length === 12);
    const g = await call('/api/savings-goals', { method: 'POST', cookie, body: { title: 'لپ‌تاپ', target: 100 } });
    const dep = await call(`/api/savings-goals/${g.d.id}/deposit`, { method: 'POST', cookie, body: { amount: 40 } });
    check('savings goal deposit', dep.status === 200 && dep.d.saved === 40);
    const wr = await call('/api/finance/weekly-report', { cookie });
    check('weekly report text', wr.status === 200 && /مرور هفته/.test(wr.d.text));
    const scan = await call('/api/transactions/receipt-scan', { method: 'POST', cookie, body: { image: 'data:image/png;base64,AAAA' } });
    check('receipt scan without AI key -> 503 (not 500)', scan.status === 503);
    const nd = await call('/api/tasks', { method: 'POST', cookie, body: { title: 'بدون تاریخ', date: '' } });
    check('task without a chosen date defaults to today', nd.status === 201 && nd.d.date === today(), nd.d && nd.d.date);
    const att = await call('/api/attachments', { method: 'POST', cookie, body: { ownerType: 'task', ownerId: nd.d.id, name: 'a.txt', dataUrl: 'data:text/plain;base64,aGk=' } });
    check('attachment without telegram -> 503 with message (not 500)', att.status === 503);
    const mods = await call('/api/me', { method: 'PATCH', cookie, body: { modules: { football: false, watch: false } } });
    const me2 = await call('/api/me', { cookie });
    check('per-user modules saved', mods.status === 200 && me2.d.user.modules && me2.d.user.modules.football === false && me2.d.user.modules.finance === true);
    const rm = await call('/api/reminders', { method: 'POST', cookie, body: { title: 'قرص', date: today(), time: '09:00', leadMinutes: 10 } });
    check('reminder stores lead time', rm.status === 201 && rm.d.leadMinutes === 10);
    const sn = await call(`/api/reminders/${rm.d.id}/act`, { method: 'POST', cookie, body: { act: 'snooze' } });
    check('reminder snooze moves time ~15 min ahead', sn.status === 200 && /^\d{2}:\d{2}$/.test(sn.d.reminder.time) && sn.d.reminder.time !== '09:00');
    const tm = await call(`/api/reminders/${rm.d.id}/act`, { method: 'POST', cookie, body: { act: 'tomorrow' } });
    check('reminder tomorrow', tm.status === 200 && tm.d.reminder.date > today());
    const dn = await call(`/api/reminders/${rm.d.id}/act`, { method: 'POST', cookie, body: { act: 'done' } });
    check('reminder done', dn.status === 200 && dn.d.reminder.done === true);
    const pk = await call('/api/push/key', { cookie });
    check('VAPID public key generated (65-byte P-256, base64url)', pk.status === 200 && /^[A-Za-z0-9_-]{86,88}$/.test(pk.d.publicKey), pk.d && pk.d.publicKey);
    const pk2 = await call('/api/push/key', { cookie });
    check('VAPID key is stable', pk2.d.publicKey === pk.d.publicKey);
    const c1 = await call('/api/col/health', { method: 'POST', cookie, body: { date: today(), weight: 80.5, id: 'hack', userId: 'x' } });
    check('collection create strips id/userId', c1.status === 201 && c1.d.weight === 80.5 && c1.d.id !== 'hack');
    const c2 = await call(`/api/col/health/${c1.d.id}`, { method: 'PATCH', cookie, body: { weight: 80 } });
    check('collection patch', c2.status === 200 && c2.d.weight === 80);
    check('unknown collection -> 404', (await call('/api/col/secrets', { cookie })).status === 404);
    const sh = await call('/api/shop/share', { method: 'POST', cookie, body: {} });
    const pub = await worker.fetch(new Request(`https://worker-smoke.local/api/s/${sh.d.code}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ add: 'نان، شیر' }) }), env, {});
    const pj = await pub.json();
    check('shared shopping list works without login', pub.status === 200 && pj.items.length === 2);
    check('shared list page served', (await worker.fetch(new Request(`https://worker-smoke.local/s/${sh.d.code}`), env, {})).status === 200);
    check('bad share code -> 404', (await worker.fetch(new Request('https://worker-smoke.local/s/deadbeef00'), env, {})).status === 404);
    const upc = await call('/api/movies/upcoming', { cookie });
    check('upcoming episodes -> 200 with lists', upc.status === 200 && Array.isArray(upc.d.upcoming) && Array.isArray(upc.d.recent));
    const recs = await call('/api/movies/recommendations?type=series', { cookie });
    check('recommendations without seeds -> 200 with message (no crash)', recs.status === 200 && Array.isArray(recs.d.items));
  }
  const applied = await call('/api/transactions/recategorize', { method: 'POST', cookie, body: { apply: true } });
  check('recategorize apply -> 200', applied.status === 200 && applied.d && applied.d.applied === true);
  const reverted = await call('/api/transactions/recategorize', { method: 'POST', cookie, body: { revert: true } });
  check('recategorize revert -> 200', reverted.status === 200 && typeof reverted.d.reverted === 'number');

  console.log('\n[W3] core CRUD across domains (broad ReferenceError net)');
  const task = (await call('/api/tasks', { method: 'POST', cookie, body: { title: 'w-t1', date: today() } })).d;
  check('task create -> 201', !!task.id);
  check('task patch -> 200', (await call(`/api/tasks/${task.id}`, { method: 'PATCH', cookie, body: { done: true } })).status === 200);
  check('task delete -> 200', (await call(`/api/tasks/${task.id}`, { method: 'DELETE', cookie })).status === 200);
  check('transactions list -> 200', (await call(`/api/transactions?from=2000-01-01&to=2030-01-01`, { cookie })).status === 200);
  const accA = (await call('/api/accounts', { method: 'POST', cookie, body: { name: 'WA', openingBalance: 1000 } })).d;
  const accB = (await call('/api/accounts', { method: 'POST', cookie, body: { name: 'WB', openingBalance: 0 } })).d;
  check('accounts create -> 201', !!accA.id && !!accB.id);
  check('transfer -> 201', (await call('/api/transfers', { method: 'POST', cookie, body: { fromAccount: 'WA', toAccount: 'WB', amount: 400 } })).status === 201);
  check('budgets save -> 201', (await call('/api/budgets', { method: 'POST', cookie, body: { category: 'خوراک', limit: 500, month: today().slice(0, 7) } })).status === 201);
  const debt = (await call('/api/debts', { method: 'POST', cookie, body: { person: 'W', amount: 100, type: 'payable' } })).d;
  check('debt settle -> 200 + expense tx', (await call(`/api/debts/${debt.id}/settle`, { method: 'POST', cookie, body: { account: 'WA' } })).d.transaction.kind === 'expense');
  const sub = (await call('/api/subscriptions', { method: 'POST', cookie, body: { name: 'Wsub', amount: 50, nextDate: daysAgo(-3) } })).d;
  check('subscription pay -> 200', (await call(`/api/subscriptions/${sub.id}/pay`, { method: 'POST', cookie, body: {} })).status === 200);
  const rem = (await call('/api/reminders', { method: 'POST', cookie, body: { title: 'w-rem', date: today() } })).d;
  check('reminder -> 201 then 200 on patch', !!rem.id && (await call(`/api/reminders/${rem.id}`, { method: 'PATCH', cookie, body: { done: true } })).status === 200);
  const inbox = (await call('/api/inbox', { method: 'POST', cookie, body: { text: 'w-note' } })).d;
  check('inbox -> 201 then convert -> 200', !!inbox.id && (await call(`/api/inbox/${inbox.id}/convert`, { method: 'POST', cookie, body: { type: 'task' } })).status === 200);
  check('daily PUT/GET round-trip', (await call('/api/daily', { method: 'PUT', cookie, body: { date: today(), mood: 8, water: 500 } })).status === 200
    && (await call(`/api/daily?date=${today()}`, { cookie })).d.item.mood === 8);
  const t0 = await call('/api/timer/start', { method: 'POST', cookie, body: { title: 'w' } });
  check('timer start/stop', t0.status === 201 && (await call('/api/timer/stop', { method: 'POST', cookie, body: {} })).status === 200);
  const ex = (await call('/api/exercise', { method: 'POST', cookie, body: { type: 'run', minutes: 20 } })).d;
  check('exercise log + delete', !!ex.id && (await call(`/api/exercise/${ex.id}`, { method: 'DELETE', cookie })).status === 200);
  check('media-log -> 201', (await call('/api/media-log', { method: 'POST', cookie, body: { source: 'spotify', title: 'wt' } })).status === 201);

  console.log('\n[W4] telegram link + spotify/youtube guards');
  check('link telegram id -> 200', (await call('/api/me', { method: 'PATCH', cookie, body: { telegramUserId: '123456789' } })).status === 200);
  check('telegramUserId round-trips on /api/me', (await call('/api/me', { cookie })).d.user.telegramUserId === '123456789');
  const integ = await call('/api/integrations', { cookie });
  check('integrations shows telegram connected', integ.d.telegram.connected === true && integ.d.telegram.userId === '123456789');
  check('unlink telegram -> 200', (await call('/api/me', { method: 'PATCH', cookie, body: { telegramUserId: null } })).status === 200);
  check('spotify connect -> 503 (no creds, pre-network)', (await call('/api/integrations/spotify/connect', { cookie })).status === 503);
  check('youtube connect -> 503 (no creds, pre-network)', (await call('/api/integrations/youtube/connect', { cookie })).status === 503);
  check('spotify recent -> 400 when unconnected', (await call('/api/integrations/spotify/recent', { cookie })).status === 400);

  console.log('\n[W5] movies + TMDB validation order');
  const mov = (await call('/api/movies', { method: 'POST', cookie, body: { title: 'W', type: 'movie', status: 'completed', rating: 5, durationMinutes: 100, date: today() } })).d;
  check('movie create -> 201', !!mov.id);
  check('movie stats -> 200', (await call('/api/movies/stats', { cookie })).d.totalMinutes === 100);
  check('TMDB search without q -> 400 (not 503)', (await call('/api/movies/tmdb/search', { cookie })).status === 400);
  check('TMDB import without ids -> 400 (not 503)', (await call('/api/movies/from-tmdb', { method: 'POST', cookie, body: {} })).status === 400);

  console.log('\n[W6] ai + dashboard + finance surfaces');
  check('ai/process bank msg -> 200 with actions', ((await call('/api/ai/process', { method: 'POST', cookie, body: { text: '۵۰ هزار ناهار' } })).d.done || []).length > 0);
  check('suggest-category -> 200', (await call('/api/ai/suggest-category', { method: 'POST', cookie, body: { title: 'ناهار رستوران' } })).d.category === 'خوراک');
  check('correlations -> 200', (await call('/api/ai/correlations?days=30', { cookie })).status === 200);
  check('tomorrow-priorities -> 200', (await call('/api/ai/tomorrow-priorities', { cookie })).status === 200);
  check('ai/chat -> 503 with no key', (await call('/api/ai/chat', { method: 'POST', cookie, body: { message: 'hi' } })).status === 503);
  check('ai/report -> 503 with no key', (await call('/api/ai/report?period=daily', { cookie })).status === 503);
  const dash = await call(`/api/dashboard?date=${today()}`, { cookie });
  check('dashboard -> 200 with shape', dash.status === 200 && Array.isArray(dash.d.tasks) && Array.isArray(dash.d.transactions));
  check('finance -> 200', (await call(`/api/finance?month=${today().slice(0, 7)}`, { cookie })).status === 200);
  check('insights -> 200', (await call('/api/insights', { cookie })).status === 200);
  check('search -> 200', (await call('/api/search?q=w', { cookie })).status === 200);
  const csv = await call('/api/transactions/export?from=2000-01-01&to=2030-01-01', { cookie });
  check('CSV export -> 200 csv', csv.status === 200 && (csv.headers.get('content-type') || '').includes('csv'));

  console.log('\n[W7] portfolio + football + long tail (GET sweep: any 500 fails)');
  check('invest buy -> 201', (await call('/api/investments/tx', { method: 'POST', cookie, body: { symbol: 'BTC', assetType: 'crypto', type: 'buy', quantity: 1, price: 100, date: today() } })).status === 201);
  check('portfolio -> 200', (await call('/api/portfolio', { cookie })).status === 200);
  check('portfolio history -> 200', (await call('/api/portfolio/history?days=30', { cookie })).status === 200);
  const alert = (await call('/api/investments/alerts', { method: 'POST', cookie, body: { symbol: 'BTC', condition: 'price_above', value: 150 } })).d;
  check('alert create + delete', !!alert.id && (await call(`/api/investments/alerts/${alert.id}`, { method: 'DELETE', cookie })).status === 200);
  check('stock refresh -> 503 (no key, pre-network)', (await call('/api/investments/price/refresh', { method: 'POST', cookie, body: { symbol: 'AAPL', assetType: 'stock' } })).status === 503);
  const match = (await call('/api/football/matches', { method: 'POST', cookie, body: { home: 'A', away: 'B', date: today() } })).d;
  check('football match + accuracy', !!match.id && (await call('/api/football/accuracy', { cookie })).status === 200);
  const freeFootballLeagues = (await call('/api/football/remote/free/leagues', { cookie })).d.items;
  check('football catalog has Europa + AFC Elite on the deployed artifact',
    freeFootballLeagues.some(l => l.id === 'uefa.europa') &&
    freeFootballLeagues.some(l => l.id === 'afc.champions' && l.name === 'لیگ نخبگان آسیا'));
  check('football fixtures -> 503 (no key, pre-network)', (await call('/api/football/remote/fixtures', { cookie })).status === 503);
  const sweeps = [
    '/api/habits', '/api/habits/history?from=2020-01-01&to=2030-01-01', '/api/weekly-review?from=' + today() + '&to=' + today(),
    '/api/news', '/api/news/sources', '/api/news/weekly-summary', '/api/contacts', '/api/learning', '/api/bookmarks',
    '/api/shopping', '/api/trips', '/api/documents', '/api/goals?period=monthly', '/api/wins', '/api/decisions',
    '/api/life-review?period=monthly&key=' + today().slice(0, 7), '/api/one-year-ago', '/api/media-log',
    '/api/timer', '/api/exercise?from=' + today() + '&to=' + today(), '/api/days?from=' + today() + '&to=' + today(),
    '/api/reminders', '/api/investments/tx', '/api/investments/alerts',
  ];
  for (const p of sweeps) {
    const r = await call(p, { cookie });
    check(`GET ${p.split('?')[0]} -> 200`, r.status === 200);
  }
  const habit = (await call('/api/habits', { method: 'POST', cookie, body: { name: 'wh' } })).d;
  check('habit toggle -> 200', !!habit.id && (await call(`/api/habits/${habit.id}/toggle`, { method: 'POST', cookie, body: { date: today() } })).status === 200);
  const shop = (await call('/api/shopping', { method: 'POST', cookie, body: { title: 'ws' } })).d;
  check('shopping buy -> 200', !!shop.id && (await call(`/api/shopping/${shop.id}/buy`, { method: 'POST', cookie, body: { price: 10 } })).status === 200);
  const trip = (await call('/api/trips', { method: 'POST', cookie, body: { destination: 'WT' } })).d;
  check('trip + checklist', !!trip.id && (await call(`/api/trips/${trip.id}/checklist`, { method: 'POST', cookie, body: { text: 'w' } })).status === 201);
  const doc = (await call('/api/documents', { method: 'POST', cookie, body: { title: 'wd', type: 'warranty' } })).d;
  check('document create -> 201', !!doc.id);
  check('document attach -> 503 (no bot token, pre-network)', (await call(`/api/documents/${doc.id}/attach`, { method: 'POST', cookie, body: { image: 'data:image/png;base64,iVBORw0KGgo=' } })).status === 503);
  check('backup-to-telegram -> 503 (no bot token, pre-network)', (await call('/api/backup/telegram', { method: 'POST', cookie, body: {} })).status === 503);

  // [W8] «درآمد لحاظ نشود» روی خودِ آرتیفکت دیپلوی‌شده. این helper تازه است، یعنی دقیقاً
  // همان کلاس باگی که یک‌بار پروداکشن را ۵۰۰ کرد (هلپر تعریف‌شده ولی export‌نشده) این‌جا
  // هم پوشش داده می‌شود: اگر isIncomeTx در یکی از دو فهرست جا بیفتد، /api/finance و
  // PATCH این‌جا قرمز می‌شوند، نه روی سرور واقعی.
  console.log('\n[W8] notIncome on the deployed artifact (helper must be exported)');
  await call('/api/accounts', { method: 'POST', cookie, body: { name: 'W8', openingBalance: 0 } });
  const w8income = (await call('/api/transactions', { method: 'POST', cookie, body: { title: 'حقوق W8', amount: 9_000_000, kind: 'income', category: 'درآمد', account: 'W8', date: today() } })).d;
  const w8pass = (await call('/api/transactions', { method: 'POST', cookie, body: { title: 'انتقال W8', amount: 2_500_000, kind: 'income', category: 'درآمد', account: 'W8', date: today() } })).d;
  const fin1 = (await call(`/api/finance?month=${today().slice(0, 7)}`, { cookie })).d;
  check('finance counts both receives before opting out', fin1.income >= 11_500_000 && fin1.incomeOffCount === 0);
  const off = await call(`/api/transactions/${w8pass.id}`, { method: 'PATCH', cookie, body: { notIncome: true } });
  check('PATCH notIncome:true -> 200 on the worker (isIncomeTx route path works)', off.status === 200 && off.d && off.d.notIncome === true);
  const fin2 = (await call(`/api/finance?month=${today().slice(0, 7)}`, { cookie })).d;
  check('finance income drops by exactly the opted-out amount', fin1.income - fin2.income === 2_500_000);
  check('opted-out amount is reported, not silently dropped', fin2.incomeOffCount === 1 && fin2.incomeOffSum === 2_500_000);
  const accs = (await call('/api/accounts', { cookie })).d;
  const w8acc = (accs.accounts || []).find(a => a.name === 'W8');
  check('account balance still holds the real money (9M + 2.5M)', w8acc && Math.round(w8acc.balance) === 11_500_000);
  const rows = (await call(`/api/transactions?from=${today()}&to=${today()}`, { cookie })).d;
  check('the flag round-trips through GET /api/transactions', (rows.items || []).find(x => x.id === w8pass.id)?.notIncome === true);
  const w8salary = (rows.items || []).find(x => x.id === w8income.id);
  check('a normal receive keeps no flag', w8salary && w8salary.notIncome === undefined);

  // [W9] ریال/تومان روی خودِ آرتیفکت دیپلوی‌شده. stripBalanceNotes/stripRefNumbers تازه‌اند:
  // اگر از فهرست exportها جا بیفتند، مسیر پیامک بانکی روی Cloudflare می‌شکند در حالی که
  // `node server.js` سالم است — همان کلاس باگی که این فایل برایش نوشته شده.
  console.log('\n[W9] rial-native amounts (تومان ×10, ریال as typed) + balance guard on the deployed artifact');
  const w9ids = async () => new Set((((await call(`/api/transactions?from=${today()}&to=${today()}`, { cookie })).d.items) || []).map(x => x.id));
  const w9parse = async (text) => {
    const before = await w9ids();
    const res = await call('/api/ai/process', { method: 'POST', cookie, body: { text } });
    const items = ((await call(`/api/transactions?from=${today()}&to=${today()}`, { cookie })).d.items) || [];
    return { status: res.status, actions: (res.d && res.d.actions) || [], created: items.filter(x => !before.has(x.id)) };
  };
  const w9sms = await w9parse('۲۴بلو انتقال پل حمیدرضا عزیز 15,000,000 ریال از حساب شما پرید. موجودی: 3,879,270,699 ریال 15:40 1405.06.23');
  check('worker: reported SMS keeps 15,000,000 ریال as 15,000,000 rial (no divide)', w9sms.status === 200 && w9sms.actions.length === 1 && w9sms.actions[0].amount === 15_000_000, JSON.stringify(w9sms.actions));
  check('worker: stored row carries the rial amount, never the balance', w9sms.created.length === 1 && w9sms.created[0].amount === 15_000_000);
  const w9bal = await w9parse('موجودی: 3,879,270,699 ریال');
  check('worker: balance-only text creates nothing (stripBalanceNotes must be exported)', w9bal.status === 200 && w9bal.actions.length === 0 && w9bal.created.length === 0);
  const w9ref = await w9parse('شناسه پرداخت ۱۲۳۴۵۶۷۸۹۰');
  check('worker: reference-number-only text creates nothing (stripRefNumbers must be exported)', w9ref.status === 200 && w9ref.actions.length === 0 && w9ref.created.length === 0);
  const w9composite = await w9parse('مبلغ: ۱۵٬۰۰۰٬۰۰۰ تومان\nبابت: نظافت منزل\nتاریخ: Sep 14, 2026 at 23:29\n\nبلو\nانتقال پل\nحمیدرضا عزیز، 15,000,000 ریال از حساب شما پرید.\nموجودی: 3,879,270,699 ریال');
  check('worker: user\'s real combined message -> 15,000,000 rial (the bank line wins), title=نظافت منزل', w9composite.actions.length === 1 && w9composite.actions[0].amount === 15_000_000 && w9composite.actions[0].title === 'نظافت منزل', JSON.stringify(w9composite.actions));
  const w9before = await w9parse('ریال ۱۵,۰۰۰,۰۰۰ انتقال به حمیدرضا');
  check('worker: «ریال» written before the number is also kept as rial', w9before.actions.length === 1 && w9before.actions[0].amount === 15_000_000);
  const w9toman = await w9parse('خرید ۱۵,۰۰۰,۰۰۰ تومان');
  check('worker: تومان amounts are converted to rial (×10)', w9toman.actions.length === 1 && w9toman.actions[0].amount === 150_000_000);

  // [W10] یادآوری سرِ ماه + مطابقت صورتحساب روی خودِ آرتیفکت دیپلوی‌شده.
  // matchBankStatementItems / ensureStatementReminder / jalaliMonthLabel توابع تازه‌اند:
  // اگر از فهرست exportها یا از makeHelpers جا بیفتند، این مسیرها روی Cloudflare ۵۰۰
  // می‌شوند در حالی که `node server.js` سالم است (همان باگی که این فایل شکار می‌کند).
  console.log('\n[W10] monthly reminder + statement reconciliation on the deployed artifact');
  {
    const w10email = `wsmoke_rem_${Date.now()}@example.com`;
    await call('/api/auth/signup', { method: 'POST', body: { name: 'W10', email: w10email, password: 'secret123' } });
    const w10login = await call('/api/auth/login', { method: 'POST', body: { email: w10email, password: 'secret123' } });
    const c10 = String((typeof w10login.headers.getSetCookie === 'function' ? w10login.headers.getSetCookie()[0] : w10login.headers.get('set-cookie')) || '').split(';')[0];
    const w10check = async (date) => (await call('/api/reminders/statement-check', { method: 'POST', cookie: c10, body: date ? { date } : {} })).d;
    const w10csv = ['تاریخ,شرح,واریز,برداشت,شماره سند',
      '1405/06/23,نظافت منزل,0,"1,500,000",9001',
      '1405/06/21,خرید نان,0,"500,000",9002',
      '1405/06/25,واریز حقوق,"12,000,000",0,9003'].join('\n');
    const w10preview = async (csv) => (await call('/api/transactions/import-bank/preview', { method: 'POST', cookie: c10, body: { fileType: 'csv', filename: 'bank.csv', fileBase64: Buffer.from('\ufeff' + csv, 'utf8').toString('base64') } })).d;

    const w10first = await w10check('2026-09-23');
    check('worker: 1st of the month -> bank-statement reminder for the previous month', w10first.created === 1 && w10first.month === 'شهریور' && !!w10first.reminder && w10first.reminder.auto === 'bank-import:1405-06', JSON.stringify(w10first));
    const w10again = await w10check('2026-09-23');
    check('worker: the reminder is not duplicated on a second check', w10again.created === 0 && !!w10again.reminder && w10again.reminder.id === w10first.reminder.id, JSON.stringify(w10again));
    const w10mid = await w10check('2026-09-10');
    check('worker: mid-month check does nothing', w10mid.created === 0 && w10mid.checked === false, JSON.stringify(w10mid));

    const w10manual = (await call('/api/transactions', { method: 'POST', cookie: c10, body: { title: 'نظافت منزل', amount: 1_500_000, kind: 'expense', account: 'بدون حساب', date: '2026-09-14' } })).d;
    check('worker: manual row recorded for the reconciliation test (rial, same scale as the file)', !!w10manual && w10manual.amount === 1_500_000);
    const w10p1 = await w10preview(w10csv);
    check('worker: preview skips the already-entered row (1 already / 2 new)', w10p1.newCount === 2 && w10p1.alreadyCount === 1, JSON.stringify({ n: w10p1.newCount, a: w10p1.alreadyCount, d: w10p1.duplicateCount }));
    check('worker: فایل ریالی بدون تبدیل می‌ماند (1,500,000 ریال = 1,500,000 rial)', (w10p1.items || [])[0]?.amount === 1_500_000, JSON.stringify((w10p1.items || []).map(x => [x.title, x.amount])));
    const w10c1 = (await call('/api/transactions/import-bank/commit', { method: 'POST', cookie: c10, body: { items: w10p1.items, account: 'بدون حساب' } })).d;
    check('worker: commit imports only the missing rows', w10c1.imported === 2 && w10c1.skippedExisting === 1, JSON.stringify(w10c1));
    const w10rows = ((await call(`/api/transactions?from=2026-01-01&to=2026-12-31`, { cookie: c10 })).d.items || []);
    check('worker: the manual row was not duplicated', w10rows.filter(x => x.title === 'نظافت منزل').length === 1, JSON.stringify(w10rows.map(x => [x.title, x.amount])));
    const w10p2 = await w10preview(w10csv);
    const w10c2 = (await call('/api/transactions/import-bank/commit', { method: 'POST', cookie: c10, body: { items: w10p2.items, account: 'بدون حساب' } })).d;
    check('worker: re-uploading the same statement adds nothing', w10p2.newCount === 0 && w10c2.imported === 0 && w10c2.skippedExisting === 3, JSON.stringify({ p: w10p2.newCount, c: w10c2 }));
    await call('/api/transactions', { method: 'POST', cookie: c10, body: { title: 'تاکسی', amount: 700_000, kind: 'expense', account: 'بدون حساب', date: '2026-09-13' } });
    const w10near = await w10preview('تاریخ,شرح,واریز,برداشت,شماره سند\n1405/06/21,تاکسی,0,"700,000",7777');
    check('worker: a row one day off an existing row is flagged near-duplicate, not dropped', w10near.nearDuplicateCount === 1 && (w10near.items || [])[0]?.nearDuplicate === true && w10near.newCount === 1, JSON.stringify(w10near));
  }

  // [W11] پوکر/بت روی خودِ آرتیفکت: متن پوکر/بت نباید تراکنش بسازد. (هم هلپر تازه‌ی
  // parseGambleText باید در هر دو نسخه یکی باشد، هم مسیر /api/ai/process روی ورکر.)
  console.log('\n[W11] poker/bet messages never become transactions (deployed artifact)');
  {
    const w11email = `wsmoke_gamble_${Date.now()}@example.com`;
    await call('/api/auth/signup', { method: 'POST', body: { name: 'W11', email: w11email, password: 'secret123' } });
    const w11login = await call('/api/auth/login', { method: 'POST', body: { email: w11email, password: 'secret123' } });
    const c11 = String((typeof w11login.headers.getSetCookie === 'function' ? w11login.headers.getSetCookie()[0] : w11login.headers.get('set-cookie')) || '').split(';')[0];
    const say11 = async (text) => (await call('/api/ai/process', { method: 'POST', cookie: c11, body: { text } })).d;
    const rows11 = async () => ((await call('/api/transactions?from=2026-01-01&to=2026-12-31', { cookie: c11 })).d.items) || [];
    const pk11 = async () => ((await call('/api/poker', { cookie: c11 })).d.items) || [];

    const w11s = await say11('پوکر خانه دوستان ۵۰ میلیون ورودی ۴۲ میلیون خروجی');
    check('worker: poker text creates no transaction', (await rows11()).length === 0, JSON.stringify(await rows11()));
    check('worker: poker text becomes a poker session (50M in / 42M out)', (w11s.actions || [])[0]?.type === 'poker' && w11s.actions[0].buyIn === 50_000_000 && w11s.actions[0].cashOut === 42_000_000, JSON.stringify(w11s.actions));
    check('worker: the session is stored in the poker panel data', (await pk11()).length === 1 && (await pk11())[0].cashOut === 42_000_000);
    const w11b = await say11('بت ۵۰ میلیون واریز کردم');
    check('worker: bet text creates no transaction', (await rows11()).length === 0 && (w11b.done || []).some(x => /Inbox/.test(x)), JSON.stringify(w11b.done));
    const w11c = await say11('خرید نان ۵۰۰ هزار');
    check('worker: normal expense text still works', (w11c.actions || []).length === 1 && (await rows11()).length === 1 && (await rows11())[0].amount === 500_000, JSON.stringify(w11c.actions));
  }

  // [W12] بخش «بت» روی آرتیفکت دیپلوی‌شده: هلپرهای تازه (betRollup/betAutoStart/betDaysOf)
  // باید در هر دو فهرست export باشند، وگرنه مسیر /api/bet روی کلودفلر ۵۰۰ می‌شود.
  console.log('\n[W12] bet ledger on the deployed artifact (USD, one row per day)');
  {
    const w12email = `wsmoke_bet_${Date.now()}@example.com`;
    await call('/api/auth/signup', { method: 'POST', body: { name: 'W12', email: w12email, password: 'secret123' } });
    const w12login = await call('/api/auth/login', { method: 'POST', body: { email: w12email, password: 'secret123' } });
    const c12 = String((typeof w12login.headers.getSetCookie === 'function' ? w12login.headers.getSetCookie()[0] : w12login.headers.get('set-cookie')) || '').split(';')[0];
    const put12 = async (body) => (await call('/api/bet', { method: 'POST', cookie: c12, body })).d;
    const w12base = await put12({ date: '2026-09-09', balance: 500 });
    check('worker: the very first entry is a baseline (no phantom win)', w12base.day.result === 0 && w12base.day.start === 500, JSON.stringify(w12base.day));
    await call(`/api/bet/${w12base.day.id}`, { method: 'DELETE', cookie: c12 });
    const w12a = await put12({ date: '2026-09-10', deposit: 100, balance: 120 });
    const w12b = await put12({ date: '2026-09-11', balance: 95 });
    const w12c = await put12({ date: '2026-09-12', deposit: 50, balance: 160 });
    check('worker: day results are computed correctly (+20, −25, +15)', w12a.day.result === 20 && w12b.day.result === -25 && w12b.day.start === 120 && w12c.day.result === 15, JSON.stringify([w12a.day.result, w12b.day.start, w12b.day.result, w12c.day.result]));
    const w12m = await call('/api/bet?month=2026-09', { cookie: c12 });
    check('worker: monthly stats (profit / wins / losses / win-rate)', w12m.d.stats.days === 3 && w12m.d.stats.profit === 10 && w12m.d.stats.wins === 2 && w12m.d.stats.losses === 1 && w12m.d.stats.winRate === 67, JSON.stringify(w12m.d.stats));
    const w12bad = await call('/api/bet', { method: 'POST', cookie: c12, body: { date: '2026-09-13' } });
    check('worker: balance is required (400)', w12bad.status === 400);
    const w12rows = ((await call('/api/transactions?from=2026-01-01&to=2026-12-31', { cookie: c12 })).d.items) || [];
    check('worker: the bet ledger never creates a transaction', w12rows.length === 0, JSON.stringify(w12rows.length));
    const w12del = await call(`/api/bet/${w12c.day.id}`, { method: 'DELETE', cookie: c12 });
    const w12m2 = await call('/api/bet?month=2026-09', { cookie: c12 });
    check('worker: deleting a day works and recomputes', w12del.d.ok === true && w12m2.d.stats.days === 2 && w12m2.d.stats.profit === -5, JSON.stringify(w12m2.d.stats));
    // the bet balance can also be typed as text (one row per day, never a transaction)
    const w12today = (typeof today === 'function') ? today() : new Date().toISOString().slice(0, 10);
    const w12s0 = (await call('/api/bet', { cookie: c12 })).d.suggestedStart;
    const w12t1 = await call('/api/ai/process', { method: 'POST', cookie: c12, body: { text: 'بت موجودی ۳۰۰ دلار' } });
    const w12r1 = await call('/api/bet', { cookie: c12 });
    const w12row = ((w12r1.d && w12r1.d.items) || []).find(x => x.date === w12today);
    check('worker: typing the bet balance logs today (betDay action, start auto-filled from yesterday)',
      !!((w12t1.d && w12t1.d.actions) || []).find(x => x.type === 'betDay') && !!w12row && w12row.balance === 300 && w12row.start === w12s0 && w12row.result === 300 - w12s0,
      JSON.stringify({ actions: w12t1.d && w12t1.d.actions, row: w12row }));
    await call('/api/ai/process', { method: 'POST', cookie: c12, body: { text: 'بت موجودی ۳۵۰ دلار' } });
    const w12r2 = await call('/api/bet', { cookie: c12 });
    const w12rowsT = ((w12r2.d && w12r2.d.items) || []).filter(x => x.date === w12today);
    const w12tx = ((await call('/api/transactions?from=2026-01-01&to=2026-12-31', { cookie: c12 })).d.items) || [];
    check('worker: the second text of the same day updates it (+$50, still one row, no transactions)',
      w12rowsT.length === 1 && w12rowsT[0].balance === 350 && w12rowsT[0].result === 350 - w12s0 && w12tx.length === 0,
      JSON.stringify({ rows: w12rowsT, tx: w12tx.length }));
  }

  // [W13] «دلار» روی آرتیفکت دیپلوی‌شده: بدون نماد و بدون قیمت، هر دلار = ۱ دلار
  console.log('\n[W13] portfolio: dollar holding on the deployed artifact (amount only)');
  {
    const w13email = `wsmoke_usd_${Date.now()}@example.com`;
    await call('/api/auth/signup', { method: 'POST', body: { name: 'W13', email: w13email, password: 'secret123' } });
    const w13login = await call('/api/auth/login', { method: 'POST', body: { email: w13email, password: 'secret123' } });
    const c13 = String((typeof w13login.headers.getSetCookie === 'function' ? w13login.headers.getSetCookie()[0] : w13login.headers.get('set-cookie')) || '').split(';')[0];
    const w13buy = (body) => call('/api/investments/tx', { method: 'POST', cookie: c13, body });
    const w13pf = () => call('/api/portfolio', { cookie: c13 });

    const w13a = await w13buy({ assetType: 'dollar', quantity: 500 });
    const w13p1 = await w13pf();
    const w13usd = (w13p1.d.items || []).find(x => x.assetType === 'dollar');
    check('worker: a dollar holding needs only an amount (price fixed at $1)',
      w13a.status === 201 && !!w13usd && w13usd.currentPrice === 1 && w13usd.marketValue === 500 && w13usd.unrealizedPnl === 0,
      JSON.stringify(w13usd && { qty: w13usd.quantity, price: w13usd.currentPrice, val: w13usd.marketValue }));
    await w13buy({ assetType: 'dollar', quantity: 250 });
    const w13p2 = await w13pf();
    const w13rows = (w13p2.d.items || []).filter(x => x.assetType === 'dollar');
    check('worker: buying again merges into one dollar row (750)', w13rows.length === 1 && w13rows[0].quantity === 750, JSON.stringify(w13rows.map(x => x.quantity)));
    const w13bad = await w13buy({ assetType: 'dollar' });
    check('worker: an empty dollar amount is a 400 with a dollar-specific message', w13bad.status === 400 && /دلار/.test((w13bad.d && w13bad.d.error) || ''), JSON.stringify(w13bad.d));
    const w13crypto = await w13buy({ assetType: 'crypto', symbol: 'BTC', quantity: 1 });
    check('worker: crypto still requires a price (shortcut is dollar-only)', w13crypto.status === 400, String(w13crypto.status));
  }

  console.log('\n[W14] Google Calendar routes on the deployed Worker artifact');
  {
    const wt = await call('/api/tasks', { method: 'POST', cookie, body: { title: 'Worker calendar task', date: '2026-09-20', startTime: '08:30', durationMinutes: 45 } });
    const wr = await call('/api/reminders', { method: 'POST', cookie, body: { title: 'Worker calendar reminder', date: '2026-09-21' } });
    const ws = await call('/api/integrations/google-calendar/status', { cookie });
    check('worker: calendar status route is present and reports missing server config safely', ws.status === 200 && ws.d.configured === false && ws.d.connected === false && ws.d.writeMode === 'dedicated-calendar', JSON.stringify(ws.d));
    const wf = await call('/api/calendar/feed?from=2026-09-19&to=2026-09-22', { cookie });
    check('worker: calendar feed returns local timed tasks and all-day reminders while Google is disconnected', wf.status === 200 && wf.d.connected === false && wf.d.items.some(x => x.id === 'task:' + wt.d.id && x.time === '08:30' && x.allDay === false) && wf.d.items.some(x => x.id === 'reminder:' + wr.d.id && x.allDay === true), JSON.stringify(wf.d));
    const wc = await call('/api/integrations/google-calendar/connect', { cookie });
    check('worker: OAuth connect fails closed with a clear 503 when secrets are absent', wc.status === 503 && /Google Calendar/.test(wc.d.error || ''), JSON.stringify(wc.d));
    const wy = await call('/api/integrations/google-calendar/sync', { method: 'POST', cookie, body: {} });
    check('worker: manual sync requires a connected account', wy.status === 400 && /وصل/.test(wy.d.error || ''), JSON.stringify(wy.d));
  }

  console.log('\n[W16] the login gate vs Cloudflare\'s extensionless asset URLs');
  {
    // Cloudflare serves static assets with "clean" URLs: `/x.html` answers 307 →
    // `/x` and `/x` is what actually gets served. That means one page view reaches
    // the Worker gate TWICE, and the second time the path has no extension — so the
    // gate must treat both forms of the login page as public, or an anonymous
    // visitor spins in a redirect loop (and the console script's check 1 used to
    // call the healthy rewrite a failure, which is what this section pins).
    const fileFor = (q) => path.join(ROOT, 'public', q === '/' ? 'index.html' : q.replace(/^\//, ''));
    const readIfFile = (f) => (fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f) : null);
    const htmlRes = (buf) => new Response(buf, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    const cfAssets = {
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        if (p.endsWith('.html')) {
          const clean = p === '/index.html' ? '/' : p.slice(0, -'.html'.length);
          const target = clean === '/' ? fileFor('/') : fileFor(clean) + '.html';
          if (readIfFile(target) !== null) return new Response(null, { status: 307, headers: { location: clean } });
        }
        const own = readIfFile(fileFor(p));
        if (own !== null) return htmlRes(own);
        const viaClean = path.extname(p) ? null : readIfFile(fileFor(p) + '.html');
        return viaClean === null ? new Response('not found', { status: 404 }) : htmlRes(viaClean);
      },
    };
    const w16env = Object.assign({}, env, { ASSETS: cfAssets });
    async function w16hop(w, p, cookie) {
      const headers = {};
      if (cookie) headers.cookie = cookie;
      let url = 'https://worker-smoke.local' + p;
      let res = await w.fetch(new Request(url, { headers }), w16env, {});
      const chain = [p];
      for (let i = 0; i < 6 && res.status >= 300 && res.status < 400; i++) {
        const loc = res.headers.get('location');
        if (!loc) break;
        url = new URL(loc, url).toString();
        chain.push(new URL(url).pathname);
        res = await w.fetch(new Request(url, { headers }), w16env, {});
      }
      const text = await res.text();
      return { status: res.status, chain, text, looping: res.status >= 300 && res.status < 400 };
    }
    const w16anon = await w16hop(worker, '/newtab.html', null);
    check('worker: an anonymous /newtab.html lands on the login page through the rewrite (no loop)',
      !w16anon.looping && w16anon.status === 200 && /id="fEmail"/.test(w16anon.text)
        && w16anon.chain.join(' ') === '/newtab.html /design/login-page.html /design/login-page',
      JSON.stringify({ chain: w16anon.chain, status: w16anon.status }));
    const w16login = await w16hop(worker, '/design/login-page', null);
    check('worker: the extensionless login URL is public too, so the rewrite has nowhere to loop',
      !w16login.looping && w16login.status === 200 && /id="fEmail"/.test(w16login.text),
      JSON.stringify({ chain: w16login.chain, status: w16login.status }));
    const w16email = `wsmoke_gate_${Date.now()}@example.com`;
    await call('/api/auth/signup', { method: 'POST', body: { name: 'W16', email: w16email, password: 'secret123' } });
    const w16lg = await call('/api/auth/login', { method: 'POST', body: { email: w16email, password: 'secret123' } });
    const c16 = String((typeof w16lg.headers.getSetCookie === 'function' ? w16lg.headers.getSetCookie()[0] : w16lg.headers.get('set-cookie')) || '').split(';')[0];
    const w16auth = await w16hop(worker, '/newtab.html', c16);
    check('worker: with a session the rewrite is harmless and the real newtab is served',
      !w16auth.looping && w16auth.status === 200 && /id="qIn"/.test(w16auth.text)
        && w16auth.chain.join(' ') === '/newtab.html /newtab',
      JSON.stringify({ chain: w16auth.chain, status: w16auth.status }));
    const w16gateLine = "const isPublic = /^\\/design\\/login-page(\\.html)?$/.test(url.pathname)";
    if (!workerSrc.includes(w16gateLine)) throw new Error('the isPublic line changed shape — update this guard');
    const w16brokenSrc = workerSrc
      .replace(XLSX_IMPORT, 'const XLSX = null; // harness stub (see the loader above)')
      .replace(w16gateLine, "const isPublic = /^\\/design\\/login-page\\.html$/.test(url.pathname)");
    const w16tmp = path.join(__dirname, '.tmp-w16-worker.mjs');
    fs.writeFileSync(w16tmp, w16brokenSrc);
    let w16broken;
    try {
      w16broken = (await import(pathToFileURL(w16tmp).href + '?v=' + Math.random())).default;
    } finally {
      fs.rmSync(w16tmp, { force: true });
    }
    const w16loop = await w16hop(w16broken, '/newtab.html', null);
    check('[W16] teeth: a gate that only knows /design/login-page.html loops every anonymous visitor',
      w16loop.looping, JSON.stringify(w16loop.chain));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
