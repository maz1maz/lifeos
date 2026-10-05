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

// In-memory D1 `kv` table. Storage v2 reads a marker plus a key prefix and
// commits its migration through D1.batch(), so the harness intentionally
// models those three surfaces as well as ordinary prepared statements.
function makeEnv(legacy = null) {
  const store = new Map();
  if (legacy !== null) store.set('db', JSON.stringify(legacy));
  const run = async (sql, params) => {
    if (sql.startsWith('INSERT INTO kv (key,value,updated_at) VALUES (?,?,?) ON CONFLICT')) {
      store.set(params[0], params[1]);
      return { success: true };
    }
    if (sql.startsWith('INSERT INTO kv (key,value,updated_at) VALUES (?,?,?)')) {
      if (store.has(params[0])) throw new Error('UNIQUE constraint failed: kv.key');
      store.set(params[0], params[1]);
      return { success: true };
    }
    // write guards: fail (UNIQUE on the existing meta key) when a shard changed since it was read
    if (sql.startsWith("INSERT INTO kv (key,value,updated_at) SELECT ?,'',0 WHERE NOT EXISTS")) {
      if (store.get(params[1]) !== params[2]) throw new Error('UNIQUE constraint failed: kv.key');
      return { success: true };
    }
    if (sql.startsWith("INSERT INTO kv (key,value,updated_at) SELECT ?,'',0 WHERE EXISTS")) {
      if (store.has(params[1])) throw new Error('UNIQUE constraint failed: kv.key');
      return { success: true };
    }
    if (sql.startsWith('DELETE FROM kv WHERE key=?')) {
      store.delete(params[0]);
      return { success: true };
    }
    throw new Error('unexpected SQL in harness: ' + sql);
  };
  return {
    DB: {
      _store: store,
      prepare(sql) {
        const st = {
          _params: [],
          bind(...p) { st._params = p; return st; },
          async first() {
            if (sql.startsWith('SELECT value FROM kv WHERE key=?')) { const v = store.get(st._params[0]); return v === undefined ? null : { value: v }; }
            throw new Error('unexpected SQL in harness: ' + sql);
          },
          async all() {
            if (sql.startsWith('SELECT key,value FROM kv WHERE key LIKE ?')) {
              const prefix = String(st._params[0] || '').replace(/%$/, '');
              return { results: [...store.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value })) };
            }
            throw new Error('unexpected SQL in harness: ' + sql);
          },
          async run() {
            return run(sql, st._params);
          },
        };
        return st;
      },
      // D1 batches are transactions: a failing statement rolls back the whole batch
      async batch(statements) {
        const snapshot = new Map(store);
        try { for (const statement of statements) await statement.run(); }
        catch (e) { store.clear(); for (const [k, v] of snapshot) store.set(k, v); throw e; }
        return statements.map(() => ({ success: true }));
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

  // The legacy value is just under D1's former hard limit. It contains a
  // user-owned array large enough to prove that v2 splits it before saving.
  const env = makeEnv({
    users: [], sessions: [], tasks: [], inbox: [], daily: [],
    transactions: Array.from({ length: 4 }, (_, i) => ({ id: 'seed-' + i, userId: 'seed-user', note: 'x'.repeat(400000) })),
    _meta: { currencyUnit: 'IRR' },
  });
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
  const v2Rows = [...env.DB._store.entries()].filter(([key]) => key.startsWith('state:v2:'));
  check('legacy state migrates to v2 shards', env.DB._store.has('state:v2:meta') && !env.DB._store.has('db') && v2Rows.some(([key]) => key.includes('seed-user')));
  check('each persisted state shard stays below the safe size', v2Rows.filter(([key]) => key !== 'state:v2:meta').every(([, value]) => Buffer.byteLength(value) <= 1600000));
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
    // v44: loss limit, poker+bet month status, project report, portfolio snapshots, top-3 tasks
    check('me exposes backup/limit/project-report settings', await (async () => { const m = (await call('/api/me', { cookie })).d.user; return m.backupFreq === 'weekly' && m.funLossLimit === 0 && m.tgProjectsOn === true; })());
    const reportBrand = await call('/api/report-brand', { method: 'PATCH', cookie, body: { headerText: 'شرکت نما <b>', footerText: 'تهران · تلفن ۱۲۳', logo: 'data:image/png;base64,AA==' } });
    check('project PDF branding saves sanitized header, footer and logo', reportBrand.status === 200 && reportBrand.d.headerText === 'شرکت نما b' && reportBrand.d.footerText === 'تهران · تلفن ۱۲۳' && reportBrand.d.logo === 'data:image/png;base64,AA==');
    check('project PDF branding rejects an oversized logo', (await call('/api/report-brand', { method: 'PATCH', cookie, body: { logo: 'data:image/png;base64,' + 'A'.repeat(230000) } })).status === 400);
    await call('/api/me', { method: 'PATCH', cookie, body: { funLossLimit: '100,000,000', backupFreq: 'daily' } });
    const me44 = (await call('/api/me', { cookie })).d.user;
    check('loss limit accepts grouped digits; backup freq saved', me44.funLossLimit === 100000000 && me44.backupFreq === 'daily');
    await call('/api/me', { method: 'PATCH', cookie, body: { backupFreq: 'hourly' } });
    check('invalid backup freq ignored', (await call('/api/me', { cookie })).d.user.backupFreq === 'daily');
    await call('/api/poker', { method: 'POST', cookie, body: { date: today(), buyIn: 300000000, cashOut: 100000000, location: 'X', usdRate: 1000000 } });
    await call('/api/bet', { method: 'POST', cookie, body: { date: today(), start: 100, balance: 50, usdRate: 1000000 } });
    const bt44 = (await call('/api/bet', { cookie })).d.items.find(x => x.date === today());
    check('bet day keeps the dollar rate it was entered with', bt44 && bt44.usdRate === 1000000, JSON.stringify(bt44));
    const fs44 = (await call('/api/fun/status', { cookie })).d;
    check('fun status: month net = poker + bet×rate', fs44.limit === 100000000 && fs44.poker === -200000000 && fs44.betUsd === -50 && fs44.net === -250000000, JSON.stringify(fs44));
    const pr44 = (await call('/api/col/projects', { method: 'POST', cookie, body: { name: 'پروژه تست', deadline: today() } })).d;
    await call('/api/col/cards', { method: 'POST', cookie, body: { projectId: pr44.id, title: 'کارت ۱', col: 'done', doneAt: Date.now() } });
    await call('/api/col/cards', { method: 'POST', cookie, body: { projectId: pr44.id, title: 'کارت ۲', col: 'todo' } });
    const rep44 = (await call('/api/projects/report', { cookie })).d;
    check('weekly project report text', /پروژه تست/.test(rep44.text) && /۵۰٪/.test(rep44.text) && /کارت ۱/.test(rep44.text), rep44.text);
    check('project report send without telegram -> 503', (await call('/api/projects/report', { method: 'POST', cookie })).status === 503);
    await call('/api/portfolio/snapshots', { method: 'POST', cookie, body: { date: '2026-01-01', value: 1000, cost: 800 } });
    await call('/api/portfolio/snapshots', { method: 'POST', cookie, body: { date: '2026-01-01', value: 1200, cost: 800 } });
    const ps44 = (await call('/api/portfolio/snapshots', { cookie })).d.items;
    check('portfolio snapshot upserts per day', ps44.length === 1 && ps44[0].value === 1200);
    check('bad snapshot -> 400', (await call('/api/portfolio/snapshots', { method: 'POST', cookie, body: { value: 'x' } })).status === 400);
    const t44 = (await call('/api/tasks', { method: 'POST', cookie, body: { title: 'مهم' } })).d;
    const m44 = await call(`/api/tasks/${t44.id}`, { method: 'PATCH', cookie, body: { mit: today() } });
    check('task can be starred as one of today\'s three', m44.d && m44.d.mit === today());
    check('bad mit value cleared', (await call(`/api/tasks/${t44.id}`, { method: 'PATCH', cookie, body: { mit: '<x>' } })).d.mit === '');
    // v45: admin overview — only the first account (no ADMIN_EMAILS) may read it
    const ad1 = await call('/api/admin/overview', { cookie });
    const meA = (await call('/api/me', { cookie })).d.user;
    check('admin flag matches access', (ad1.status === 200) === (meA.isAdmin === true), `${ad1.status} ${meA.isAdmin}`);
    if (ad1.status === 200) check('admin overview lists users without secrets', ad1.d.totals.users >= 1 && ad1.d.users.every(u => !('password' in u) && !('salt' in u)) && ad1.d.weeks.length === 12);
    const em45 = `wsmoke_second_${Date.now()}@example.com`;
    await call('/api/auth/signup', { method: 'POST', body: { name: 'Second', email: em45, password: 'secret123' } });
    const lg45 = await call('/api/auth/login', { method: 'POST', body: { email: em45, password: 'secret123' } });
    const ck45 = String((typeof lg45.headers.getSetCookie === 'function' ? lg45.headers.getSetCookie()[0] : lg45.headers.get('set-cookie')) || '').split(';')[0];
    check('a later account is not admin -> 403', (await call('/api/admin/overview', { cookie: ck45 })).status === 403);
    check('me.isAdmin false for later account', (await call('/api/me', { cookie: ck45 })).d.user.isAdmin === false);
    check('anonymous admin -> 401', (await call('/api/admin/overview')).status === 401);
    if (ad1.status === 200) {
      const sec = (await call('/api/admin/overview', { cookie })).d.users.find(u => u.email === em45);
      const lo = await call(`/api/admin/users/${sec.id}/logout`, { method: 'POST', cookie, body: {} });
      check('admin force-logout closes the other user\'s sessions', lo.status === 200 && lo.d.closed >= 1 && !(await call('/api/me', { cookie: ck45 })).d.user);
      const lg2 = await call('/api/auth/login', { method: 'POST', body: { email: em45, password: 'secret123' } });
      const ck2 = String((typeof lg2.headers.getSetCookie === 'function' ? lg2.headers.getSetCookie()[0] : lg2.headers.get('set-cookie')) || '').split(';')[0];
      const dis = await call(`/api/admin/users/${sec.id}/disable`, { method: 'POST', cookie, body: { disabled: true } });
      check('disable -> session dead, login refused 403', dis.status === 200 && !(await call('/api/me', { cookie: ck2 })).d.user && (await call('/api/auth/login', { method: 'POST', body: { email: em45, password: 'secret123' } })).status === 403);
      check('admin cannot disable self', (await call(`/api/admin/users/${ad1.d.users.find(u => u.admin).id}/disable`, { method: 'POST', cookie, body: { disabled: true } })).status === 400);
      await call(`/api/admin/users/${sec.id}/disable`, { method: 'POST', cookie, body: { disabled: false } });
      check('re-enabled user can log in again', (await call('/api/auth/login', { method: 'POST', body: { email: em45, password: 'secret123' } })).status === 200);
      check('non-admin cannot use admin actions', (await call(`/api/admin/users/${sec.id}/logout`, { method: 'POST', cookie: ck2, body: {} })).status !== 200);
      const lg3 = await call('/api/auth/login', { method: 'POST', body: { email: em45, password: 'secret123' } });
      const ck3 = String((typeof lg3.headers.getSetCookie === 'function' ? lg3.headers.getSetCookie()[0] : lg3.headers.get('set-cookie')) || '').split(';')[0];
      const sm = await call('/api/admin/message', { method: 'POST', cookie, body: { to: [sec.id], text: 'سلام، نسخهٔ تازه آمد' } });
      const inb = (await call('/api/me', { cookie: ck3 })).d.user.msgs;
      check('admin message reaches the user inbox', sm.status === 200 && sm.d.n === 1 && inb.length === 1 && inb[0].text === 'سلام، نسخهٔ تازه آمد', JSON.stringify(inb));
      await call(`/api/messages/${inb[0].id}/read`, { method: 'POST', cookie: ck3, body: {} });
      check('read message leaves the inbox', (await call('/api/me', { cookie: ck3 })).d.user.msgs.length === 0);
      check('non-admin cannot send messages', (await call('/api/admin/message', { method: 'POST', cookie: ck3, body: { to: 'all', text: 'x' } })).status === 403);
      check('empty message refused', (await call('/api/admin/message', { method: 'POST', cookie, body: { to: 'all', text: '  ' } })).status === 400);
      const all = await call('/api/admin/message', { method: 'POST', cookie, body: { to: 'all', text: 'به همه' } });
      check('broadcast skips the admin, logged in sentMsgs', all.status === 200 && all.d.n >= 1 && (await call('/api/admin/overview', { cookie })).d.sentMsgs[0].text === 'به همه' && (await call('/api/me', { cookie })).d.user.msgs.length === 0);
    }
    // v52: courses & students — dues from payments, withdrawn students owe nothing
    const co52 = (await call('/api/col/courses', { method: 'POST', cookie, body: { name: 'نما ۱', price: 100000000 } })).d;
    const due = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    await call('/api/col/students', { method: 'POST', cookie, body: { courseId: co52.id, name: 'علی', fee: 100000000, dueDate: due, payments: [{ id: 'a', kind: 'deposit', amount: 30000000 }, { id: 'b', kind: 'installment', amount: 20000000 }] } });
    await call('/api/col/students', { method: 'POST', cookie, body: { courseId: co52.id, name: 'سارا', fee: 100000000, dueDate: due, status: 'withdrawn', payments: [{ id: 'c', kind: 'deposit', amount: 30000000 }] } });
    await call('/api/col/students', { method: 'POST', cookie, body: { courseId: co52.id, name: 'رضا', fee: 100000000, dueDate: due, payments: [{ id: 'd', kind: 'deposit', amount: 100000000 }] } });
    const du52 = (await call('/api/courses/due', { cookie })).d.items;
    check('course dues: only students still owing, with the right remaining', du52.length === 1 && du52[0].name === 'علی' && du52[0].remaining === 50000000 && du52[0].course === 'نما ۱', JSON.stringify(du52));
    await call('/api/me', { method: 'PATCH', cookie, body: { modules: { courses: true } } });
    const mo52 = (await call('/api/me', { cookie })).d.user.modules;
    check('modules: courses kept, CRM is opt-in (off unless crmOn)', mo52.courses === true && mo52.crmOn === false);
    { const t0 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()), y0 = new Date(Date.parse(t0 + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10), n0 = new Date(Date.parse(t0 + 'T12:00:00Z') + 5 * 864e5).toISOString().slice(0, 10);
      const pr = (await call('/api/col/projects', { method: 'POST', cookie, body: { name: 'سایت', color: '#60a5fa' } })).d, pa = (await call('/api/col/projects', { method: 'POST', cookie, body: { name: 'قدیمی', archived: true } })).d;
      const c1 = (await call('/api/col/cards', { method: 'POST', cookie, body: { projectId: pr.id, title: 'امروزی', col: 'todo', due: t0, prio: 'h' } })).d;
      await call('/api/col/cards', { method: 'POST', cookie, body: { projectId: pr.id, title: 'عقب', col: 'doing', due: y0 } });
      await call('/api/col/cards', { method: 'POST', cookie, body: { projectId: pr.id, title: 'تمام', col: 'done', due: y0 } });
      await call('/api/col/cards', { method: 'POST', cookie, body: { projectId: pr.id, title: 'بعدا', col: 'todo', due: n0 } });
      await call('/api/col/cards', { method: 'POST', cookie, body: { projectId: pa.id, title: 'بایگانی', col: 'todo', due: t0 } });
      const pd = (await call('/api/projects/due', { cookie })).d.items;
      check('project dues: today + overdue, not done/archived/future, with project name+colour', pd.length === 2 && pd[0].title === 'عقب' && pd[1].title === 'امروزی' && pd[1].project === 'سایت' && pd[1].color === '#60a5fa', JSON.stringify(pd));
      const cf = (await call(`/api/calendar/feed?from=${y0}&to=${n0}`, { cookie })).d.items.filter(x => x.kind === 'card');
      check('calendar feed includes open project cards on their due date', cf.length === 3 && cf.every(x => x.source === 'lifeos'), JSON.stringify(cf));
      await call(`/api/col/cards/${c1.id}`, { method: 'PATCH', cookie, body: { col: 'done', doneAt: Date.now() } });
      check('ticked card leaves the due list', (await call('/api/projects/due', { cookie })).d.items.length === 1);
    }
    { // Project dossier: contract, finance and procurement records stay isolated per project/user.
      const p = (await call('/api/col/projects', { method: 'POST', cookie, body: { name: 'پروندهٔ پروژه', projectCode: 'P-1405', contractNo: 'C-12' } })).d;
      const ct = await call('/api/col/projectContracts', { method: 'POST', cookie, body: { projectId: p.id, contractName: 'قرارداد نما', amount: 5000000 } });
      const fn = await call('/api/col/projectFinancials', { method: 'POST', cookie, body: { projectId: p.id, title: 'پیش‌پرداخت', kind: 'expense', amount: 700000 } });
      const sp = await call('/api/col/projectSupplies', { method: 'POST', cookie, body: { projectId: p.id, title: 'سنگ', category: 'مصالح', quantity: 2, unit: 'تن', unitPrice: 300000 } });
      const pp = await call('/api/col/projectProcesses', { method: 'POST', cookie, body: { projectId: p.id, department: 'فنی', title: 'ابعادبرداری دقیق', status: 'todo' } });
      const got = (await call('/api/col/projectContracts', { cookie })).d.items;
      check('project dossier stores contract, financial, supply, and process records', ct.status === 201 && fn.status === 201 && sp.status === 201 && pp.status === 201 && got.some(x => x.id === ct.d.id && x.projectId === p.id && x.amount === 5000000), JSON.stringify({ ct: ct.status, fn: fn.status, sp: sp.status, pp: pp.status }));
      const repeatProcess = await call('/api/col/projectProcesses', { method: 'POST', cookie, body: { projectId: p.id, department: 'فنی', title: 'ابعادبرداری دقیق', status: 'done' } });
      const projectProcesses = (await call('/api/col/projectProcesses', { cookie })).d.items.filter(x => x.projectId === p.id && x.department === 'فنی' && x.title === 'ابعادبرداری دقیق');
      check('project process seed cannot undo an already ticked stage', repeatProcess.status === 200 && repeatProcess.d.id === pp.d.id && repeatProcess.d.status === 'done' && projectProcesses.length === 1, JSON.stringify({ repeatProcess, projectProcesses }));
      // batch seed from the app (useCol.addMany): real rows, deduped, never a junk {items:[…]} row, never undoes a tick
      const seeded = await call('/api/col/projectProcesses', { method: 'POST', cookie, body: { items: [{ projectId: p.id, department: 'فنی', title: 'ابعادبرداری دقیق', status: 'todo' }, { projectId: p.id, department: 'اجرا', title: 'شروع نصب — پنجره', status: 'done', note: 'از ردیف قدیمی' }] } });
      const afterSeed = (await call('/api/col/projectProcesses', { cookie })).d.items.filter(x => x.projectId === p.id);
      check('process batch seed creates real rows and keeps existing ticks', seeded.status === 201 && seeded.d.items.length === 2 && seeded.d.items[0].id === pp.d.id && afterSeed.find(x => x.id === pp.d.id).status === 'done' && afterSeed.some(x => x.title === 'شروع نصب — پنجره' && x.note === 'از ردیف قدیمی') && !afterSeed.some(x => Array.isArray(x.items)), JSON.stringify(seeded.d));
      const rem = (await call('/api/reminders', { method: 'POST', cookie, body: { title: 'یادآوری مرحله', date: '2030-01-01', time: '09:00' } })).d;
      await call(`/api/col/projectProcesses/${pp.d.id}`, { method: 'PATCH', cookie, body: { reminderId: rem.id } });
      const delP = await call(`/api/col/projects/${p.id}`, { method: 'DELETE', cookie });
      const left = {}; for (const k of ['projects', 'projectContracts', 'projectFinancials', 'projectSupplies', 'projectProcesses']) left[k] = (await call(`/api/col/${k}`, { cookie })).d.items.filter(x => (x.projectId || x.id) === p.id).length;
      const remLeft = ((await call('/api/reminders?from=2029-12-01&to=2030-02-01', { cookie })).d.items || []).filter(x => x.id === rem.id).length;
      check('deleting a project removes its contract, statements, supplies, stages and stage reminders in one request', delP.status === 200 && !!rem.id && Object.values(left).every(n => n === 0) && remLeft === 0, JSON.stringify({ delP: delP.status, left, remLeft, rem: rem.id }));
    }
    { // v63: course sessions from start date + weekdays, cancel pushes later, move changes date
      const cs = (await call('/api/col/courses', { method: 'POST', cookie, body: { name: 'کلاس', startDate: '2030-01-05', sessions: 4, days: [6, 2], time: '18:00' } })).d; // 2030-01-05 is Saturday
      const feed = async () => (await call('/api/calendar/feed?from=2030-01-01&to=2030-02-28', { cookie })).d.items.filter(x => x.kind === 'session' && x.courseId === cs.id).map(x => x.date + ' ' + x.time);
      const f1 = await feed();
      check('sessions generated on class weekdays', JSON.stringify(f1) === JSON.stringify(['2030-01-05 18:00', '2030-01-08 18:00', '2030-01-12 18:00', '2030-01-15 18:00']), JSON.stringify(f1));
      await call(`/api/col/courses/${cs.id}`, { method: 'PATCH', cookie, body: { skip: ['2030-01-08'], moves: { '2030-01-12': { date: '2030-01-13', time: '10:00' } } } });
      const f2 = await feed();
      check('cancelled session shifts the rest, moved session keeps its number', JSON.stringify(f2) === JSON.stringify(['2030-01-05 18:00', '2030-01-13 10:00', '2030-01-15 18:00', '2030-01-19 18:00']), JSON.stringify(f2));
    }
    { // v65: vocab progress stored per user in its own kv row + summary
      check('vocab: empty state at first', (await call('/api/vocab', { cookie })).d.state === null);
      const t0 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()), y = new Date(Date.parse(t0 + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
      const st = { cards: { apple: { b: 2, due: Date.now() - 1000 }, facade: { b: 6, due: Date.now() + 9e9 }, cladding: { b: 3, due: Date.now() + 9e7 } }, settings: { dailyNew: 10 }, days: { [t0]: { r: 5, n: 3 }, [y]: { r: 2, n: 0 } } };
      check('vocab: save -> 200', (await call('/api/vocab', { method: 'PUT', cookie, body: { state: st } })).status === 200);
      check('vocab: read back', Object.keys((await call('/api/vocab', { cookie })).d.state.cards).length === 3);
      const sm = (await call('/api/vocab/summary', { cookie })).d.summary;
      check('vocab summary: due/new/learning/mastered/streak', sm.due === 1 && sm.newLeft === 7 && sm.learning === 2 && sm.mastered === 1 && sm.streak === 2, JSON.stringify(sm));
      check('vocab summary: no hard word before any «نمی‌دانستم»', (await call('/api/vocab/summary?hard=1', { cookie })).d.hard === null);
      check('vocab summary: hard word only when asked', !('hard' in (await call('/api/vocab/summary', { cookie })).d) || (await call('/api/vocab/summary', { cookie })).d.hard === undefined);
      { // morning brief on Telegram carries one random hard word
        await call('/api/vocab', { method: 'PUT', cookie, body: { state: { ...st, cards: { ...st.cards, abandon: { b: 1, bad: 2, due: 0 } } } } });
        await call('/api/me', { method: 'PATCH', cookie, body: { telegramUserId: '777002' } });
        const sent = [], realFetch = globalThis.fetch, realAssets = env.ASSETS;
        env.TELEGRAM_BOT_TOKEN = 'TEST';
        env.ASSETS = { fetch: async r => new URL(r.url).pathname === '/vocab/words.json' ? new Response(JSON.stringify([['abandon', ['ترک کردن'], 0, 'A1', 'فعل', 0, 'They abandon the car.', 0, 9, 'ماشین را رها می‌کنند.']])) : new Response('not found', { status: 404 }) };
        globalThis.fetch = async (url, init) => {
          if (String(url).includes('api.telegram.org')) { if (typeof init.body === 'string') sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { headers: { 'content-type': 'application/json' } }); }
          return new Response('{}', { status: 404 });
        };
        try { await worker.fetch(new Request('https://worker-smoke.local/api/telegram/webhook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ update_id: 1, message: { message_id: 1, date: 1, chat: { id: 777002, type: 'private' }, from: { id: 777002 }, text: '/صبح' } }) }), env, { waitUntil() {} }); }
        finally { globalThis.fetch = realFetch; env.ASSETS = realAssets; delete env.TELEGRAM_BOT_TOKEN; }
        const hm = sent.find(m => /🧠 واژهٔ سخت/.test(m.text || ''));
        check('telegram morning brief: random hard word with meaning + example', !!hm && /🧠 واژهٔ سخت: abandon فعل — ترک کردن/.test(hm.text) && /They abandon the car/.test(hm.text), JSON.stringify(sent.map(m => m.text)).slice(-300));
        check('hard word message has a «یاد گرفتم» button', !!hm && hm.reply_markup.inline_keyboard[0][0].callback_data === 'vl:abandon');
        globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'content-type': 'application/json' } }); env.TELEGRAM_BOT_TOKEN = 'TEST';
        try { await worker.fetch(new Request('https://worker-smoke.local/api/telegram/webhook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ update_id: 2, callback_query: { id: 'q1', from: { id: 777002 }, data: 'vl:abandon', message: { message_id: 5, chat: { id: 777002 }, text: 'x' } } }) }), env, { waitUntil() {} }); }
        finally { globalThis.fetch = realFetch; delete env.TELEGRAM_BOT_TOKEN; }
        const learned = (await call('/api/vocab', { cookie })).d.state.cards.abandon;
        check('«یاد گرفتم» in Telegram masters the word and drops it from hard words', learned.b === 6 && learned.bad === 0 && (await call('/api/vocab/summary?hard=1', { cookie })).d.hard === null, JSON.stringify(learned));
        check('POST /api/vocab/learned: unknown word -> 404', (await call('/api/vocab/learned', { method: 'POST', cookie, body: { w: 'nope-xyz' } })).status === 404);
        check('POST /api/vocab/learned: known word -> 200', (await call('/api/vocab/learned', { method: 'POST', cookie, body: { w: 'apple' } })).status === 200 && (await call('/api/vocab', { cookie })).d.state.cards.apple.b === 6);
      }
      check('vocab: bad payload refused', (await call('/api/vocab', { method: 'PUT', cookie, body: { state: { cards: [] } } })).status === 400);
      check('vocab: anonymous 401', (await call('/api/vocab')).status === 401);
      check('db row stays small (vocab not inside main db)', !JSON.stringify((await call('/api/me', { cookie })).d).includes('cladding'));
    }
    { // v64: fee reminders due within 2 days + monthly course report text
      const t0 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()), plus = n => new Date(Date.parse(t0 + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
      const cr = (await call('/api/col/courses', { method: 'POST', cookie, body: { name: 'گزارشی', price: 100 } })).d;
      await call('/api/col/students', { method: 'POST', cookie, body: { courseId: cr.id, name: 'نزدیک', phone: '09121234567', fee: 1000000, dueDate: plus(1), payments: [{ id: 'q1', kind: 'deposit', amount: 400000, date: t0 }] } });
      await call('/api/col/students', { method: 'POST', cookie, body: { courseId: cr.id, name: 'دور', fee: 1000000, dueDate: plus(9), payments: [] } });
      await call('/api/col/students', { method: 'POST', cookie, body: { courseId: cr.id, name: 'تسویه', fee: 1000000, dueDate: plus(1), payments: [{ id: 'q2', kind: 'full', amount: 1000000, date: t0 }] } });
      const rep = (await call('/api/courses/report?prev=0', { cookie })).d;
      check('fee reminders: only owing students due within 2 days', rep.fees.includes('نزدیک') && !rep.fees.includes('دور') && !rep.fees.includes('تسویه'), JSON.stringify(rep.fees));
      check('monthly course report lists course, received and owing', /گزارشی/.test(rep.text) && /دریافتی/.test(rep.text) && /بدهکار/.test(rep.text), rep.text);
      const me64 = (await call('/api/me', { method: 'PATCH', cookie, body: { tgFeeRemindOn: false } }), (await call('/api/me', { cookie })).d.user);
      check('fee reminder toggle saved', me64.tgFeeRemindOn === false && me64.tgCoursesMonthlyOn === true);
    }
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
  check('project report PDF -> 503 without bot token (no network)', (await call('/api/projects/report-pdf', { method: 'POST', cookie, body: { filename: 'r.pdf', data: 'data:application/pdf;base64,JVBERi0=' } })).status === 503);
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
  {
    // explicit done is idempotent: a repeated / stale click can no longer untick a day
    const hd = '2026-01-10', set = done => call(`/api/habits/${habit.id}/toggle`, { method: 'POST', cookie, body: { date: hd, done } });
    const a1 = (await set(true)).d, a2 = (await set(true)).d, a3 = (await set(false)).d;
    check('habit toggle with done:true twice stays done, done:false clears', a1.done === true && a2.done === true && a3.done === false, JSON.stringify([a1, a2, a3]));
    const timed = (await call('/api/habits', { method: 'POST', cookie, body: { name: 'آب ۳۰ روزه', days: 30, startDate: '2026-10-01' } })).d;
    const cleared = (await call(`/api/habits/${timed.id}`, { method: 'PATCH', cookie, body: { days: 0 } })).d;
    check('habit with a length keeps days + startDate; days:0 makes it open-ended', timed.days === 30 && timed.startDate === '2026-10-01' && cleared.days === undefined, JSON.stringify([timed, cleared]));
  }
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

  console.log('\n[W17] personal-site bridge: scoped tokens + /api/ext/*');
  {
    const ext = async (p, { method = 'GET', token, body = null } = {}) => {
      const headers = {};
      if (token) headers.authorization = 'Bearer ' + token;
      let b; if (body !== null) { headers['content-type'] = 'application/json'; b = JSON.stringify(body); }
      const res = await worker.fetch(new Request('https://worker-smoke.local' + p, { method, headers, body: b }), env, {});
      const text = await res.text(); let d = null; try { d = text ? JSON.parse(text) : null; } catch (e) {}
      if (res.status === 500) check(`no 500 on ${method} ${p}`, false, String(text).slice(0, 160));
      return { status: res.status, d };
    };
    check('site tokens need a session', (await call('/api/site-tokens')).status === 401);
    const mk = await call('/api/site-tokens', { method: 'POST', cookie, body: { label: 'seyfikhani.ir', scopes: ['projects', 'courses'] } });
    const token = mk.d && mk.d.token;
    check('create site token -> 201 + plaintext token once', mk.status === 201 && /^lfs_[0-9a-f]{64}$/.test(token || ''), JSON.stringify(mk.d));
    const listed = await call('/api/site-tokens', { cookie });
    check('token list never returns the token or its hash', listed.status === 200 && listed.d.items.length >= 1 && !JSON.stringify(listed.d).includes(token) && !JSON.stringify(listed.d).includes('"hash"'));
    check('ext without token -> 401', (await ext('/api/ext/me')).status === 401);
    check('ext with a cookie but no token -> 401', (await call('/api/ext/me', { cookie })).status === 401);
    check('ext with a wrong token -> 401', (await ext('/api/ext/me', { token: 'lfs_' + '0'.repeat(64) })).status === 401);
    const viaHeader = await worker.fetch(new Request('https://worker-smoke.local/api/ext/me', { headers: { 'x-lifeos-token': token } }), env, {});
    check('token also accepted via X-LifeOS-Token (hosts that drop Authorization)', viaHeader.status === 200);
    const meR = await ext('/api/ext/me', { token });
    check('ext /me -> scopes', meR.status === 200 && meR.d.scopes.includes('projects') && meR.d.scopes.includes('courses'), JSON.stringify(meR.d));

    // projects: both directions share one record
    const proj = await ext('/api/ext/col/projects', { method: 'POST', token, body: { name: 'نمای ویلا لواسان', client: 'آقای الف' } });
    check('site creates a project -> 201', proj.status === 201 && proj.d.id && !('userId' in proj.d), JSON.stringify(proj.d));
    const inApp = (await call('/api/col/projects', { cookie })).d.items.find(x => x.id === proj.d.id);
    check('…and LifeOS sees it', !!inApp && inApp.client === 'آقای الف');
    await call('/api/col/projects/' + proj.d.id, { method: 'PATCH', cookie, body: { deadline: '2026-12-01' } });
    const back = (await ext('/api/ext/col/projects', { token })).d.items.find(x => x.id === proj.d.id);
    check('LifeOS edit shows on the site', back && back.deadline === '2026-12-01');
    check('site cannot read finance collections without the projectFiles scope', (await ext('/api/ext/col/projectFinancials', { token })).status === 403);
    check('site cannot reach non-allowlisted collections', (await ext('/api/ext/col/health', { token })).status === 403);
    check('site cannot reach normal APIs with the token', (await ext('/api/transactions', { token })).status === 401);
    const card = await ext('/api/ext/col/cards', { method: 'POST', token, body: { projectId: proj.d.id, title: 'نقشه‌های اجرایی', col: 'todo' } });
    check('site adds a kanban card', card.status === 201);
    const pg = (await ext('/api/ext/col/cards?offset=0&limit=1', { token })).d;
    check('ext lists page with ?offset=&limit=', pg.items.length === 1 && pg.total >= 1, JSON.stringify(pg));
    check('card under a foreign/unknown project is refused', (await ext('/api/ext/col/cards', { method: 'POST', token, body: { projectId: 'nope', title: 'x' } })).status === 400);
    check('project with children cannot be deleted from the site', (await ext('/api/ext/col/projects/' + proj.d.id, { method: 'DELETE', token })).status === 409);

    // process stage reminder → real db.reminders row
    const stage = await ext('/api/ext/col/projectProcesses', { method: 'POST', token, body: { projectId: proj.d.id, department: 'فنی', title: 'ابعادبرداری دقیق', status: 'todo' } });
    // same calls ProjectsPage makes: POST /api/reminders (no projectId) then PATCH the stage with reminderId
    const sr0 = await ext('/api/ext/reminders', { method: 'POST', token, body: { title: 'یادآوری پروژهٔ x: ابعادبرداری دقیق', date: today(), whenLabel: today(), notes: 'مسئول: ملینا' } });
    await ext('/api/ext/col/projectProcesses/' + stage.d.id, { method: 'PATCH', token, body: { reminderDate: today(), reminderId: sr0.d.id } });
    const sr = (await call('/api/reminders', { cookie })).d.items.find(r => r.id === sr0.d.id);
    check('stage reminder from the site is a real LifeOS reminder (time defaults to 09:00)', sr0.status === 201 && !!sr && sr.time === '09:00', JSON.stringify(sr0.d));
    check('ext can PATCH a reminder referenced by a stage', (await ext('/api/ext/reminders/' + sr.id, { method: 'PATCH', token, body: { date: '2027-01-01' } })).status === 200);
    const appRem = (await call('/api/reminders', { method: 'POST', cookie, body: { title: 'private', date: today(), time: '10:00' } })).d;
    check('ext cannot touch an unrelated LifeOS reminder', (await ext('/api/ext/reminders/' + appRem.id, { method: 'DELETE', token })).status === 404);
    check('ext reminder list does not leak unrelated reminders', !(await ext('/api/ext/reminders', { token })).d.items.some(r => r.id === appRem.id));
    const batch = await ext('/api/ext/col/projectProcesses', { method: 'POST', token, body: { items: [{ projectId: proj.d.id, department: 'فنی', title: 'ابعادبرداری دقیق' }, { projectId: proj.d.id, department: 'فنی', title: 'تهیه نقشهٔ شاپ' }, { projectId: 'nope', department: 'فنی', title: 'x' }] } });
    check('batch insert dedupes stages and skips foreign parents', batch.status === 201 && batch.d.items.length === 2 && batch.d.items[0].id === stage.d.id, JSON.stringify(batch.d));
    // concurrent saves on one collection (slow panel proxy + retries) must not overwrite each other
    const many = (await ext('/api/ext/col/projectProcesses', { method: 'POST', token, body: { items: [1, 2, 3, 4, 5].map(n => ({ projectId: proj.d.id, department: 'اجرا', title: 'race ' + n, status: 'todo' })) } })).d.items;
    await Promise.all([...many.map(x => ext('/api/ext/col/projectProcesses/' + x.id, { method: 'PATCH', token, body: { status: 'done' } })),
      call('/api/col/projectProcesses/' + many[0].id, { method: 'PATCH', cookie, body: { note: 'هم‌زمان' } }),
      ext('/api/ext/col/projectProcesses', { method: 'POST', token, body: { projectId: proj.d.id, department: 'اجرا', title: 'race new' } })]);
    const raced = (await ext('/api/ext/col/projectProcesses', { token })).d.items;
    check('concurrent stage saves all survive (rows + fields merged)', many.every(x => raced.find(y => y.id === x.id)?.status === 'done') && raced.find(y => y.id === many[0].id)?.note === 'هم‌زمان' && raced.some(y => y.title === 'race new'), JSON.stringify(raced.filter(y => String(y.title).startsWith('race')).map(y => [y.title, y.status, y.note])));

    // free reminder tied to a project, then delivered by the real cron → Telegram path
    check('reminder tied to an unknown project is refused', (await ext('/api/ext/reminders', { method: 'POST', token, body: { projectId: 'nope', title: 'x', date: today(), time: '10:00' } })).status === 400);
    const tz = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(Date.now() - 2 * 60e3));
    const rr = await ext('/api/ext/reminders', { method: 'POST', token, body: { projectId: proj.d.id, title: 'تماس با کارفرما', date: today(), time: tz, notes: 'از سایت' } });
    check('site reminder -> 201 and listed for the site', rr.status === 201 && (await ext('/api/ext/reminders', { token })).d.items.some(r => r.id === rr.d.id), JSON.stringify(rr.d));
    check('site reminder appears in LifeOS reminders', (await call('/api/reminders', { cookie })).d.items.some(r => r.id === rr.d.id));
    if (tz > '00:05') {
      await call('/api/me', { method: 'PATCH', cookie, body: { telegramUserId: '777001' } });
      const sent = [], realFetch = globalThis.fetch;
      env.TELEGRAM_BOT_TOKEN = 'TEST';
      globalThis.fetch = async (url, init) => {
        if (String(url).includes('api.telegram.org')) { if (typeof init.body === 'string') sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { headers: { 'content-type': 'application/json' } }); }
        return new Response('{}', { status: 404 });
      };
      try { const waits = []; await worker.scheduled({ cron: '*/5 * * * *', scheduledTime: Date.now() }, env, { waitUntil: p => waits.push(p) }); await Promise.allSettled(waits); }
      finally { globalThis.fetch = realFetch; delete env.TELEGRAM_BOT_TOKEN; }
      const msg = sent.find(m => /تماس با کارفرما/.test(m.text || ''));
      check('cron sends the site-made reminder to Telegram', !!msg && msg.chat_id === '777001' && /از سایت/.test(msg.text), JSON.stringify(sent.map(m => m.text)).slice(0, 300));
      await call('/api/me', { method: 'PATCH', cookie, body: { telegramUserId: null } });
    }
    check('site deletes its reminder', (await ext('/api/ext/reminders/' + rr.d.id, { method: 'DELETE', token })).status === 200);

    // project report PDF → Telegram, uploaded in pieces
    {
      const pdf = Buffer.from('%PDF-1.4\n' + 'x'.repeat(5000)).toString('base64'), half = Math.ceil(pdf.length / 2), up = 'a1b2c3d4e5f60718';
      for (const [n, data] of [[0, pdf.slice(0, half)], [1, pdf.slice(half)]]) await ext('/api/ext/report-chunk', { method: 'POST', token, body: { uploadId: up, n, total: 2, data } });
      const noTg = await ext('/api/ext/report-send', { method: 'POST', token, body: { uploadId: up, total: 2, filename: 'r.pdf' } });
      check('report-send without Telegram linked -> 503 and pieces are cleaned up', noTg.status === 503 && ![...env.DB._store.keys()].some(k => k.includes(up)), JSON.stringify(noTg.d));
      await call('/api/me', { method: 'PATCH', cookie, body: { telegramUserId: '777002' } });
      const sentDocs = [], realFetch = globalThis.fetch; env.TELEGRAM_BOT_TOKEN = 'TEST';
      globalThis.fetch = async (url, init) => { if (String(url).includes('sendDocument')) { sentDocs.push(init.body); return new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'content-type': 'application/json' } }); } return new Response('{}', { status: 404 }); };
      try {
        for (const [n, data] of [[1, pdf.slice(half)], [0, pdf.slice(0, half)]]) await ext('/api/ext/report-chunk', { method: 'POST', token, body: { uploadId: up, n, total: 2, data } });
        const ok2 = await ext('/api/ext/report-send', { method: 'POST', token, body: { uploadId: up, total: 2, filename: 'گزارش.pdf', caption: 'test' } });
        check('report pieces (any order) are joined and sent to Telegram as one PDF', ok2.status === 200 && sentDocs.length === 1 && ![...env.DB._store.keys()].some(k => k.includes(up)), JSON.stringify(ok2.d));
        const bad = await ext('/api/ext/report-send', { method: 'POST', token, body: { uploadId: 'ffffffffffffffff', total: 1 } });
        check('report-send with missing pieces -> 400', bad.status === 400);
      } finally { globalThis.fetch = realFetch; delete env.TELEGRAM_BOT_TOKEN; await call('/api/me', { method: 'PATCH', cookie, body: { telegramUserId: null } }); }
    }

    // instant form notice → Telegram
    {
      const noTg = await ext('/api/ext/notify', { method: 'POST', token, body: { text: 'فرم تماس' } });
      check('notify without Telegram linked -> 503', noTg.status === 503 && /تلگرام در LifeOS وصل نیست/.test(noTg.d.error), JSON.stringify(noTg.d));
      check('notify with empty text -> 400', (await ext('/api/ext/notify', { method: 'POST', token, body: { text: ' \r\n ' } })).status === 400);
      check('notify GET -> 405', (await ext('/api/ext/notify', { token })).status === 405);
      await call('/api/me', { method: 'PATCH', cookie, body: { telegramUserId: '777003' } });
      const sentMsgs = [], realFetch = globalThis.fetch; env.TELEGRAM_BOT_TOKEN = 'TEST';
      globalThis.fetch = async (url, init) => { if (String(url).includes('sendMessage')) { sentMsgs.push(JSON.parse(init.body)); return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { headers: { 'content-type': 'application/json' } }); } return new Response('{}', { status: 404 }); };
      try {
        const ok3 = await ext('/api/ext/notify', { method: 'POST', token, body: { text: '  درخواست مشاوره\r\nنام: سارا  ' } });
        const m = sentMsgs[0] || {};
        check('notify sends the text instantly to the token owner on Telegram', ok3.status === 200 && ok3.d.ok === true && sentMsgs.length === 1 && m.chat_id === '777003' && m.text === 'درخواست مشاوره\nنام: سارا' && m.disable_web_page_preview === true, JSON.stringify([ok3.d, m]));
        await ext('/api/ext/notify', { method: 'POST', token, body: { text: 'x'.repeat(5000) } });
        check('notify caps text at 3900 chars', (sentMsgs[1] || {}).text?.length === 3900);
      } finally { globalThis.fetch = realFetch; delete env.TELEGRAM_BOT_TOKEN; await call('/api/me', { method: 'PATCH', cookie, body: { telegramUserId: null } }); }
    }

    // bank SMS (iPhone Shortcut) → transaction; bankSms scope only
    {
      const sms = 'بلو\nبرداشت پول\nحمیدرضا عزیز، 10,560,000 ریال از حساب شما پرید.\nموجودی: 2,406,466,090 ریال\n۱۹:۵۴\n۱۴۰۵.۰۷.۰۹';
      check('bank-sms without bankSms scope -> 403', (await ext('/api/ext/bank-sms', { method: 'POST', token, body: { text: sms } })).status === 403);
      const smsTok = (await call('/api/site-tokens', { method: 'POST', cookie, body: { label: 'iPhone', scopes: ['bankSms'] } })).d.token;
      check('bankSms-only token cannot read projects', (await ext('/api/ext/col/projects', { token: smsTok })).status === 403);
      check('bank-sms GET -> 405', (await ext('/api/ext/bank-sms', { token: smsTok })).status === 405);
      check('bank-sms empty -> 400', (await ext('/api/ext/bank-sms', { method: 'POST', token: smsTok, body: { text: '  ' } })).status === 400);
      const r1 = await ext('/api/ext/bank-sms', { method: 'POST', token: smsTok, body: { text: sms } });
      const tx = (await call('/api/transactions', { cookie })).d.items.filter(t => /پرید|برداشت|بلو/.test(t.title || '') || t.amount === 1056000 || t.amount === 10560000);
      check('bank-sms records one expense (balance ignored, date from SMS)', r1.status === 201 && tx.length === 1 && tx[0].kind === 'expense' && tx[0].date === '2026-10-01', JSON.stringify([r1.d, tx]));
      const r2 = await ext('/api/ext/bank-sms', { method: 'POST', token: smsTok, body: { text: sms } });
      check('same SMS twice is ignored', r2.status === 200 && r2.d.duplicate === true && (await call('/api/transactions', { cookie })).d.items.filter(t => t.id === (tx[0] || {}).id || (t.amount === (tx[0] || {}).amount && t.date === '2026-10-01')).length === 1, JSON.stringify(r2.d));
      check('non-transaction text -> 422, nothing else applied', (await ext('/api/ext/bank-sms', { method: 'POST', token: smsTok, body: { text: 'کار خرید نان' } })).status === 422 && !(await call('/api/tasks', { cookie })).d.items?.some?.(t => t.title === 'خرید نان'));
      const login = await ext('/api/ext/bank-sms', { method: 'POST', token: smsTok, body: { text: 'بلو\nحمیدرضا عزیز خوش آمدید.\n13:35:57\n1405.07.12' } });
      check('login/welcome SMS is ignored quietly (200, nothing recorded)', login.status === 200 && login.d.ignored === true, JSON.stringify(login.d));
      const sms2 = 'بلو\nبرداشت پول\nحمیدرضا عزیز، 313,131 ریال از حساب شما پرید.\nموجودی: 2,440,911,747 ریال\n۱۳:۴۴\n۱۴۰۵.۰۷.۱۲';
      const q = await ext('/api/ext/bank-sms', { method: 'POST', token: smsTok, body: { text: sms + '\n###\n' + sms2 + '\n###\nبلو\nحمیدرضا عزیز خوش آمدید.\n###\n' } });
      const qtx = (await call('/api/transactions', { cookie })).d.items.filter(t => t.date === '2026-10-04' && t.kind === 'expense' && /برداشت/.test(t.title || ''));
      check('queue file: new SMS recorded, old one skipped as duplicate, welcome ignored', q.status === 200 && q.d.ok && q.d.recorded === 1 && q.d.duplicates === 1 && q.d.ignored === 1 && qtx.length === 1, JSON.stringify([q.d, qtx]));
      for (const t of [...qtx, tx[0]].filter(Boolean)) await call('/api/transactions/' + t.id, { method: 'DELETE', cookie });
    }

    // learn-by-title: generic bank titles must not spread one category to every store
    {
      const mk = async (title) => (await call('/api/transactions', { method: 'POST', cookie, body: { title, amount: 1000, category: 'متفرقه', date: '2026-10-02' } })).d;
      const a = await mk('خرید از فروشگاه 111222'), b = await mk('خرید از فروشگاه 333444');
      const r = (await call('/api/transactions/' + a.id, { method: 'PATCH', cookie, body: { category: 'هدیه', learn: true } })).d;
      const bb = (await call('/api/transactions', { cookie })).d.items.find(t => t.id === b.id);
      check('generic title: only the edited one changes', r.learnSkipped === true && !r.learned && bb.category === 'متفرقه', JSON.stringify([r, bb]));
      const c = await mk('اسنپ 12'), e = await mk('اسنپ 98');
      const r2 = (await call('/api/transactions/' + c.id, { method: 'PATCH', cookie, body: { category: 'حمل و نقل', learn: true } })).d;
      check('specific title still learns its look-alikes', r2.learned === 1 && !!r2.learnBatch, JSON.stringify(r2));
      const u = (await call('/api/transactions/recategorize', { method: 'POST', cookie, body: { revert: true, learnBatch: r2.learnBatch } })).d;
      const ee = (await call('/api/transactions', { cookie })).d.items.find(t => t.id === e.id), cc = (await call('/api/transactions', { cookie })).d.items.find(t => t.id === c.id);
      check('undo of a learn batch restores look-alikes only', u.reverted === 1 && ee.category === 'متفرقه' && cc.category === 'حمل و نقل', JSON.stringify([u, ee, cc]));
      check('genericLearned revert -> 200', (await call('/api/transactions/recategorize', { method: 'POST', cookie, body: { revert: true, genericLearned: true } })).status === 200);
      for (const t of [a, b, c, e]) await call('/api/transactions/' + t.id, { method: 'DELETE', cookie });
    }

    // courses + students + payments
    const course = await ext('/api/ext/col/courses', { method: 'POST', token, body: { name: 'دورهٔ نما ۱', price: 50000000, sessions: 8 } });
    const stu = await ext('/api/ext/col/students', { method: 'POST', token, body: { courseId: course.d.id, name: 'سارا', phone: '09120000000', fee: 50000000, payments: [], attendance: [] } });
    check('site adds course + student', course.status === 201 && stu.status === 201);
    const pay = await ext('/api/ext/students/' + stu.d.id + '/payments', { method: 'POST', token, body: { kind: 'deposit', amount: 10000000, toFinance: true } });
    const txId = pay.d && pay.d.payments && pay.d.payments[0] && pay.d.payments[0].txId;
    const txs = (await call('/api/transactions', { cookie })).d.items;
    check('payment with toFinance mirrors an «آموزش» income in LifeOS', pay.status === 201 && txs.some(t => t.id === txId && t.category === 'آموزش' && t.kind === 'income' && t.amount === 10000000), JSON.stringify(pay.d));
    await ext('/api/ext/students/' + stu.d.id + '/payments/' + pay.d.payments[0].id, { method: 'DELETE', token });
    // CoursesPage path: /api/transactions → only «آموزش» rows are reachable
    const tx2 = await ext('/api/ext/transactions', { method: 'POST', token, body: { title: 'قسط شهریه', amount: 5000000, kind: 'income', category: 'خوراک', date: today() } });
    check('ext transaction is forced into «آموزش»', tx2.status === 201 && tx2.d.category === 'آموزش' && tx2.d.amount === 5000000, JSON.stringify(tx2.d));
    const food = (await call('/api/transactions', { method: 'POST', cookie, body: { title: 'نان', amount: 1000, category: 'خوراک' } })).d;
    check('ext cannot edit a non-education transaction', (await ext('/api/ext/transactions/' + food.id, { method: 'PATCH', token, body: { amount: 1 } })).status === 404);
    check('ext deletes its education transaction', (await ext('/api/ext/transactions/' + tx2.d.id, { method: 'DELETE', token })).status === 200);
    check('deleting the payment removes its transaction', !(await call('/api/transactions', { cookie })).d.items.some(t => t.id === txId));
    await call('/api/col/students/' + stu.d.id, { method: 'PATCH', cookie, body: { attendance: [1, 2] } });
    check('LifeOS attendance edit shows on the site', ((await ext('/api/ext/col/students', { token })).d.items.find(s => s.id === stu.d.id) || {}).attendance.join() === '1,2');

    // contract/finance/supply need the projectFiles scope; contract end date → renewal reminder
    const full = (await call('/api/site-tokens', { method: 'POST', cookie, body: { scopes: ['projects', 'projectFiles'] } })).d.token;
    const ctr = await ext('/api/ext/col/projectContracts', { method: 'POST', token: full, body: { projectId: proj.d.id, contractNo: 'C-7', contractEndDate: '2027-03-20', amount: 9000000000 } });
    check('projectFiles token: contract saved', ctr.status === 201 && ctr.d.contractNo === 'C-7', JSON.stringify(ctr.d));
    check('projectFiles token reaches financials + supplies', (await ext('/api/ext/col/projectFinancials', { method: 'POST', token: full, body: { projectId: proj.d.id, statementNo: 1, amount: 100 } })).status === 201 && (await ext('/api/ext/col/projectSupplies', { token: full })).status === 200);

    // token scope + revoke
    const onlyCourses = (await call('/api/site-tokens', { method: 'POST', cookie, body: { scopes: ['courses'] } })).d.token;
    check('courses-only token cannot read projects', (await ext('/api/ext/col/projects', { token: onlyCourses })).status === 403);
    const tid = (await call('/api/site-tokens', { cookie })).d.items.find(t => token.startsWith(t.prefix)).id;
    check('revoke token -> 200', (await call('/api/site-tokens/' + tid, { method: 'DELETE', cookie })).status === 200);
    check('revoked token -> 401', (await ext('/api/ext/me', { token })).status === 401);
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
