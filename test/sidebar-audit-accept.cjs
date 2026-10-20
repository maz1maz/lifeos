// Acceptance checks for the sidebar audit (docs/SIDEBAR-TECHNICAL-AUDIT.md): each line asserts the FIXED behaviour.
// Runs only against an isolated in-memory DB. No network or production data.
const assert = require('node:assert/strict');
const { makeKvD1 } = require('./d1-kv-fake');
const { loadWorkerModule } = require('./load-worker');

(async () => {
  const { default: worker } = await loadWorkerModule();
  const DB = makeKvD1(new Map([['db', JSON.stringify({ users: [{ id: 'audit-a' }, { id: 'audit-b' }], sessions: [{ id: 'audit-session', userId: 'audit-a' }, { id: 'other-session', userId: 'audit-b' }], _meta: { currencyUnit: 'IRR', depositXferFixed: true } })]]));
  const env = { DB, ASSETS: { fetch: async () => new Response('', { status: 404 }) } };
  const call = async (path, method = 'GET', body, session = 'audit-session') => {
    const response = await worker.fetch(new Request('https://audit.invalid/api/' + path, { method, headers: { cookie: 'sid=' + session, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, {});
    return { status: response.status, data: await response.json() };
  };
  let checks = 0;
  const ok = (value, message) => { assert.ok(value, message); checks++; console.log(message); };
  const post = async (path, body) => { const r = await call(path, 'POST', body); assert.equal(r.status, 201, JSON.stringify(r)); return r.data; };
  for (const name of ['ygoals', 'projects', 'courses', 'students', 'customers', 'deals', 'health', 'vehicles', 'carlogs', 'trips']) {
    const row = await post('col/' + name, { title: name, name, date: '2026-10-20' });
    ok((await call('col/' + name + '/' + row.id, 'PATCH', { title: 'foreign' }, 'other-session')).status === 404, 'CONTROL: ' + name + ' rejects another user editing the row');
    ok(!(await call('col/' + name, 'GET', undefined, 'other-session')).data.items.some(x => x.id === row.id), 'CONTROL: ' + name + ' hides rows from another user');
    ok((await call('col/' + name + '/' + row.id, 'PATCH', { title: 'updated' })).data.title === 'updated', 'CONTROL: ' + name + ' updates its own row');
    await call('col/' + name + '/' + row.id, 'DELETE');
  }
  const rem = await post('reminders', { title: 'notes proof', date: '2026-10-20', notes: 'details must survive' });
  ok(rem.notes === 'details must survive', 'A06: reminder POST keeps notes');
  const patched = await call('reminders/' + rem.id, 'PATCH', { notes: 'edited details' });
  ok(patched.data.notes === 'edited details', 'A06: reminder PATCH keeps notes');
  await post('reminders', { title: 'old overdue', date: '2026-08-01' });
  const planner = await call('reminders?from=0000-01-01&to=9999-12-31');
  ok(planner.data.items.some(x => x.title === 'old overdue') && require('node:fs').readFileSync('src/today/src/main.jsx', 'utf8').includes('/api/reminders?from=0000-01-01'), 'A05: Home loads open reminders of any age');
  // A14 (one health row per day) is client-side: the health page waits for the first POST (covered by the browser run).
  const vehicle = await post('col/vehicles', { name: 'audit vehicle' });
  const log = await post('col/carlogs', { vehicleId: vehicle.id, amount: 100, date: '2026-10-20' });
  ok((await call('col/vehicles/' + vehicle.id, 'DELETE')).status === 409 && (await call('col/carlogs')).data.items.some(x => x.id === log.id), 'A15: a vehicle with cost records cannot be deleted');
  const customer = await post('col/customers', { name: 'audit customer' });
  const deal = await post('col/deals', { customerId: customer.id, title: 'audit deal' });
  ok((await call('col/customers/' + customer.id, 'DELETE')).status === 409 && (await call('col/deals')).data.items.some(x => x.id === deal.id && x.customerId === customer.id), 'A10: a customer with deals cannot be deleted');
  const account = await post('accounts', { name: 'audit old', openingBalance: 1000 });
  await post('transactions', { title: 'audit expense', amount: 200, kind: 'expense', account: 'audit old', date: '2026-10-20' });
  ok((await call('accounts')).data.accounts.find(x => x.id === account.id).balance === 800, 'CONTROL: account balance includes its expense before rename');
  await call('accounts/' + account.id, 'PATCH', { name: 'audit new' });
  ok((await call('accounts')).data.accounts.find(x => x.id === account.id).balance === 800, 'A02: renaming an account keeps its balance');
  const neg = await call('transactions', 'POST', { title: 'negative expense', amount: -100, kind: 'expense', date: '2026-10-20' });
  ok(neg.status === 400, 'A11: a negative amount is rejected');
  const project = await post('col/projects', { name: 'cascade control' });
  const card = await post('col/cards', { projectId: project.id, title: 'child' });
  await call('col/projects/' + project.id, 'DELETE');
  ok(!(await call('col/cards')).data.items.some(x => x.id === card.id), 'CONTROL: deleting project removes its cards');
  await call('daily', 'PUT', { date: '2026-10-20', userId: 'audit-b', note: 'injected from audit-a' });
  const foreignDaily = await call('daily?date=2026-10-20', 'GET', undefined, 'other-session');
  ok(!foreignDaily.data.item, 'A01: daily PUT ignores body.userId');
  const media = await post('media-log', { source: 'youtube', title: 'audit media' });
  ok((await call('media-log/' + media.entry.id, 'DELETE', undefined, 'other-session')).status === 404, 'CONTROL: media log rejects foreign deletion');
  ok((await call('media-log/' + media.entry.id, 'DELETE')).status === 200, 'CONTROL: media log deletes own entry');
  const movie = await post('movies', { title: 'audit movie', type: 'movie' });
  ok((await call('movies/' + movie.id, 'PATCH', { status: 'completed' }, 'other-session')).status === 404, 'CONTROL: watch rejects foreign changes');
  ok((await call('movies/' + movie.id, 'PATCH', { status: 'completed' })).data.status === 'completed', 'CONTROL: watch completion persists');
  // Execute verbatim frontend function bodies with isolated dependency doubles.
  const fs = require('node:fs');
  const between = (source, start, end) => { const a = source.indexOf(start); assert.ok(a >= 0, start); const b = source.indexOf(end, a); assert.ok(b > a, end); return source.slice(a, b); };
  const watchSource = fs.readFileSync('src/today/src/watch-pages.jsx', 'utf8');
  const watchDetail = watchSource.slice(watchSource.indexOf('const [row, setRow] = useState(item)'));
  const watchMessages = [];
  const markSeason = new Function('api', 'row', 'setRow', 'flash', 'episodes', 'seasonAiredCount', 'fa',
    between(watchDetail, '  const patch = async body =>', '  const seasons =') +
    between(watchDetail, '  const markSeason = async season =>', '  const clearSeason =') + '; return markSeason;')(
      async () => { throw new Error('503 test failure'); }, { id: 'fake' }, () => {}, x => watchMessages.push(x), [{ season: 1, number: 1, aired: true }], () => 1, String);
  await markSeason(1);
  ok(watchMessages.length === 1 && watchMessages[0].includes('503'), 'A18: marking a season announces success only after a successful PATCH');
  const mediaSource = fs.readFileSync('src/today/src/media.jsx', 'utf8');
  const mediaMessages = [];
  const notices = [];
  const disconnect = new Function('setBusy', 'fetch', 'loadInteg', 'note', 'setNotice', between(mediaSource, '  async function disconnect(kind)', '  async function search(e)') + '; return disconnect;')(
    () => {}, async () => new Response('{}', { status: 503 }), async () => {}, (level, message) => mediaMessages.push({ level, message }), x => notices.push(x));
  await disconnect('youtube');
  ok(!mediaMessages.length && notices.length === 1, 'A19: media disconnect reports failure on HTTP 503');
  const marketSource = fs.readFileSync('src/today/src/market.jsx', 'utf8');
  const marketHours = new Function(between(marketSource, 'function zoneParts(now, timeZone)', '// TGJU free-market') + '; return marketHours;')();
  ok(!marketHours(new Date('2026-10-18T15:00:00Z')).us && marketHours(new Date('2026-10-19T15:00:00Z')).us && marketHours(new Date('2026-10-23T15:00:00Z')).us, 'A13: US market is open Mon-Fri and closed on Sunday (New York time)');
  const marketMessages = [];
  const saveAlert = new Function('alertTarget', 'showAlert', 'setAlerts', 'setShowAlert', 'setAlertTarget', 'flash', 'setAlertErr',
    between(marketSource, '  const saveAlert = () =>', '  const convOut =') + '; return saveAlert;')('۱۲۳', { id: 'audit', price: 100 }, () => marketMessages.push('saved'), () => {}, () => {}, x => marketMessages.push(x), () => {});
  saveAlert();
  ok(marketMessages.includes('saved'), 'A12: Persian digits are accepted for a market alert');
  const lifeSource = fs.readFileSync('src/today/src/life.jsx', 'utf8');
  const kmSpanExpr = lifeSource.match(/const kmSpan = ([^,]+), cons = ([^;]+);/);
  const consumption = new Function('fuel', 'const kmSpan = ' + kmSpanExpr[1] + '; return (' + kmSpanExpr[2] + ')')([{ liters: 20, odometer: 1000 }, { liters: 30, odometer: 1000 }]);
  ok(consumption === null, 'A16: equal odometers give no fuel consumption instead of Infinity');
  const courseSource = fs.readFileSync('src/today/src/courses.jsx', 'utf8');
  const receipts = [], paymentMessages = [];
  const addPayment = new Function('api', 'cur', 'KIND', 'rid', 'students', 'setReceipt', 'flash', 'rial',
    between(courseSource, '  const finTx = async (st, p) =>', '  const editPayment =') + '; return addPayment;')(
      async () => ({ id: 'finance-created' }), { name: 'audit' }, { deposit: 'deposit' }, () => 'fake-payment',
      { patch: async () => undefined }, // useCol.patch resolves undefined after a failed save
      x => receipts.push(x), x => paymentMessages.push(x), String);
  await addPayment({ id: 'fake-student', name: 'audit', payments: [] }, { kind: 'deposit', amount: 100, date: '2026-10-20', toFinance: true });
  ok(!receipts.length && !paymentMessages.length, 'A04: no receipt or success message when the student save failed');
  console.log('Sidebar audit acceptance: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
