// Acceptance checks for the second sidebar audit (docs/SIDEBAR-CONTINUATION-AUDIT.md): each line asserts the FIXED behaviour.
// Replaces the diagnostic test/sidebar-continuation-audit.cjs (which expected the defects) now that B01–B13 are fixed.
// Runs only against an isolated in-memory DB. No network or production data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i); assert.ok(j > i, b); return s.slice(i, j); };
const { makeKvD1 } = require('./d1-kv-fake');
const { loadWorkerModule } = require('./load-worker');

(async () => {
  const { default: worker, makeHelpers } = await loadWorkerModule();
  const seed = { users: [{ id: 'adm', email: 'admin@example.test' }, { id: 'a', email: 'a@example.test' }, { id: 'b', email: 'b@example.test', telegramUserId: '123456789' }], sessions: [{ id: 'sad', userId: 'adm' }, { id: 'sa', userId: 'a' }, { id: 'sb', userId: 'b' }], _meta: { currencyUnit: 'IRR', depositXferFixed: true } };
  const env = { DB: makeKvD1(new Map([['db', JSON.stringify(seed)]])), ADMIN_EMAILS: 'admin@example.test', ASSETS: { fetch: async () => new Response('', { status: 404 }) } };
  const call = async (p, method = 'GET', body, sid = 'sa') => {
    const r = await worker.fetch(new Request('https://audit.invalid/api/' + p, { method, headers: { cookie: 'sid=' + sid, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, {});
    return { status: r.status, data: await r.json() };
  };
  let n = 0;
  const ok = (v, msg) => { assert.ok(v, msg); n++; console.log(msg); };
  const post = async (p, body, sid) => { const r = await call(p, 'POST', body, sid); assert.equal(r.status, 201, JSON.stringify(r)); return r.data; };

  // B10: an admin lock on «یادداشت‌ها» closes the notes API itself (inbox + convert), not only shopping.
  const own = await call('inbox', 'POST', { title: 'before lock', text: 'x' }, 'sb');
  ok(own.status === 201, 'CONTROL: unlocked user can write a note');
  ok((await call('admin/users/b/locks', 'POST', { locked: ['notes'] }, 'sad')).status === 200, 'CONTROL: admin can apply notes lock');
  ok((await call('shopping', 'GET', undefined, 'sb')).status === 403, 'CONTROL: locked notes user is refused shopping API');
  ok((await call('inbox', 'GET', undefined, 'sb')).status === 403, 'B10: locked notes user cannot read notes');
  ok((await call('inbox', 'POST', { title: 'locked' }, 'sb')).status === 403, 'B10: locked notes user cannot create notes');
  ok((await call('inbox/' + own.data.id, 'PATCH', { text: 'edited' }, 'sb')).status === 403, 'B10: locked notes user cannot edit notes');
  ok((await call('inbox/' + own.data.id + '/convert', 'POST', { type: 'task', date: '2026-10-20' }, 'sb')).status === 403, 'B10: locked notes user cannot convert notes');
  ok((await call('inbox/' + own.data.id, 'DELETE', undefined, 'sb')).status === 403, 'B10: locked notes user cannot delete notes');
  const db1 = await makeHelpers(env).read();
  ok(!db1.inbox.some(x => x.title === 'locked') && db1.inbox.find(x => x.id === own.data.id).text === 'x' && !db1.tasks.some(x => x.userId === 'b'), 'B10: refused calls changed nothing');
  ok((await call('inbox', 'GET', undefined, 'sa')).status === 200, 'CONTROL: the lock does not affect another user');
  ok((await call('admin/users/b/locks', 'POST', { locked: [] }, 'sad')).status === 200 && (await call('inbox', 'GET', undefined, 'sb')).status === 200, 'B10: removing the lock reopens notes');

  // B11: a bare numeric Telegram id in PATCH /api/me cannot take over another account's link.
  await call('me', 'PATCH', { telegramUserId: '123456789' });
  const db2 = await makeHelpers(env).read();
  ok(db2.users.find(x => x.id === 'b').telegramUserId === '123456789' && db2.users.find(x => x.id === 'a').telegramUserId !== '123456789', 'B11: profile PATCH does not move a Telegram link without link-code proof');


  // B03: converting a note is once-only, also for a double submit.
  const note = await post('inbox', { title: 'conversion audit', text: 'detail' });
  const c1 = call('inbox/' + note.id + '/convert', 'POST', { type: 'task', date: '2026-10-20' }), c2 = call('inbox/' + note.id + '/convert', 'POST', { type: 'task', date: '2026-10-20' });
  await Promise.all([c1, c2]);
  const again = await call('inbox/' + note.id + '/convert', 'POST', { type: 'reminder', date: '2026-10-20' });
  ok(again.status === 200 && again.data.already && (await call('tasks')).data.items.filter(x => x.title === note.title).length === 1 && !(await makeHelpers(env).read()).reminders.some(x => x.title === note.title), 'B03: converting the same note twice (also concurrently) makes one task');

  // B07: a historical interaction never moves the last-contact date backwards.
  const contact = await post('contacts', { name: 'audit contact', phone: '۰۹۱۲۱۲۳۴۵۶۷' });
  await call('contacts/' + contact.id + '/log', 'POST', { date: '2026-10-20', type: 'call' });
  await call('contacts/' + contact.id + '/log', 'POST', { date: '2026-10-01', type: 'call' });
  ok((await call('contacts')).data.items.find(x => x.id === contact.id).lastContactDate === '2026-10-20', 'B07: last-contact stays at the newest interaction');
  await call('contacts/' + contact.id + '/log', 'POST', { date: '2026-10-25', type: 'call' });
  ok((await call('contacts')).data.items.find(x => x.id === contact.id).lastContactDate === '2026-10-25', 'B07: a newer interaction still moves it forward');

  // B01: football details date = the Tehran day the list groups by.
  const football = fs.readFileSync('src/today/src/football.jsx', 'utf8');
  const dateLabel = new Function(between(football, 'const matchDateLabel =', 'const asTeam =') + ';return matchDateLabel;')();
  for (const kickoff of ['2026-10-20T22:00:00Z', '2026-10-20T19:00:00Z', '2026-10-20']) {
    const groupDate = kickoff.length > 10 ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(kickoff)) : kickoff;
    ok(dateLabel({ date: kickoff }) === new Date(groupDate + 'T12:00:00').toLocaleDateString('fa-IR'), 'B01: details date matches the Tehran group day for ' + kickoff);
  }

  // B06: Persian/Arabic digits give a working call/SMS link.
  const contactsSrc = fs.readFileSync('src/today/src/contacts.jsx', 'utf8');
  const links = new Function(between(contactsSrc, 'const PHONE_SPLIT_RE =', 'const daysUntil =') + ';return { telHref, smsHref };')();
  ok(links.telHref('۰۹۱۲۱۲۳۴۵۶۷') === 'tel:09121234567' && links.smsHref('٠٩١٢ ١٢٣ ٤٥٦٧ · 021') === 'sms:09121234567' && links.telHref('+98 912') === 'tel:+98912', 'B06: Persian and Arabic digits produce call/SMS links');

  // B13 + B02: logout waits for the server, keeps everything on failure, and clears account-private browser data on success.
  const main = fs.readFileSync('src/today/src/main.jsx', 'utf8');
  const makeSignOut = (fetchImpl, unsent = 0, agree = true) => {
    const values = new Map([['lifeos-ielts-rd-shared-test', '{"answers":{"1":"account A answer"}}'], ['lifeos-vocab-tutor', '{}'], ['ielts7000.v1::lifeos:a', '{}'], ['lifeos-mode', 'dark']]);
    const st = { redirects: [], cleared: 0, alerts: 0, values };
    const ls = { removeItem: k => values.delete(k) };
    const lsProxy = new Proxy(ls, { ownKeys: () => [...values.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
    const fn = new Function('clearPendingRowSaves', 'flushRowSaves', 'confirm', 'alert', 'fetch', 'caches', 'localStorage', 'sessionStorage', 'location',
      between(main, 'const PRIVATE_LS =', "window.addEventListener('beforeinstallprompt'") + ';return signOut;')(
      () => st.cleared++, async () => unsent, () => agree, () => st.alerts++, fetchImpl, { keys: async () => [] }, lsProxy, { clear: () => {} }, { set href(v) { st.redirects.push(v); } });
    return { fn, st };
  };
  let so = makeSignOut(async () => new Response('{}', { status: 503 }));
  await so.fn();
  ok(!so.st.redirects.length && !so.st.cleared && so.st.alerts === 1 && so.st.values.has('lifeos-ielts-rd-shared-test'), 'B13: failed logout stays signed in, keeps queued saves and says so');
  so = makeSignOut(async () => { throw new TypeError('offline'); });
  await so.fn();
  ok(!so.st.redirects.length && !so.st.cleared, 'B13: network failure on logout changes nothing');
  so = makeSignOut(async () => new Response('{}', { status: 200 }), 2, false);
  await so.fn();
  ok(!so.st.redirects.length && !so.st.cleared, 'B13: with unsent saves, declining the warning cancels logout');
  so = makeSignOut(async () => new Response('{}', { status: 200 }));
  await so.fn();
  ok(so.st.redirects.length === 1 && so.st.cleared === 1, 'B13: successful logout clears the queue and leaves');
  ok(!so.st.values.has('lifeos-ielts-rd-shared-test') && !so.st.values.has('lifeos-vocab-tutor') && !so.st.values.has('ielts7000.v1::lifeos:a') && so.st.values.has('lifeos-mode'), 'B02: logout removes IELTS drafts, tutor history and vocab cache (keeps the theme)');
  ok((await call('auth/logout', 'POST', undefined, 'sa')).status === 200 && (await call('tasks', 'GET', undefined, 'sa')).status === 401, 'CONTROL: successful logout really revokes the server session');

  // B02: the vocabulary cache is per account; an unknown owner never reuses a cached copy.
  const vocab = fs.readFileSync('public/vocab/app.js', 'utf8');
  const pick = remote => new Function('remote', 'DEF', 'load', 'let USER, S;' + between(vocab, '    // B02: the browser copy', '    VIEW = "study";') + ';return { S, USER };')(
    remote, () => ({ cards: {}, settings: {}, quiz: {} }), user => ({ cards: ({ 'lifeos:b': { ownWord: { good: 1 } }, lifeos: { previousAccountWord: { good: 3 } } })[user] || {} }));
  ok(!pick({ state: null, owner: 'c' }).S.cards.ownWord && !pick({ state: null, owner: 'c' }).S.cards.previousAccountWord, 'B02: empty server vocabulary does not load another account cache');
  ok(pick({ state: null, owner: 'b' }).S.cards.ownWord && !Object.keys(pick({ state: null }).S.cards).length, 'B02: own cache is reused; without an owner nothing is');
  ok((await call('vocab', 'GET', undefined, 'sb')).data.owner === 'b', 'B02: /api/vocab names the owner of the state');

  // B04: a failed bookmark save puts the open reader back and shows a message.
  const readingSrc = fs.readFileSync('src/today/src/reading.jsx', 'utf8');
  let list = [{ id: 'fake-article', saved: false }], reader = list[0], msg = '', pending;
  const patchNews = new Function('setItems', 'api', 'load', 'setReading', 'setMsg', between(readingSrc, '  const patch = async (x, body)', '  const del =') + ';return patch;')(
    f => { list = f(list); }, async () => { throw new Error('503'); }, () => { list = [{ id: 'fake-article', saved: false }]; }, f => { reader = f(reader); }, m => { msg = m; });
  const onSave = readingSrc.match(/onSave=\{(\(\) => \{ patch\(reading,[^\n]+?setReading\(r => \(\{ \.\.\.r, saved: !r.saved \}\)\); \})\}/);
  assert.ok(onSave, 'reader onSave callback');
  new Function('patch', 'reading', 'setReading', 'return (' + onSave[1] + ');')((...a) => { pending = patchNews(...a); }, reader, f => { reader = f(reader); })();
  await pending;
  ok(!reader.saved && !list[0].saved && msg.includes('ذخیره نشد'), 'B04: reader bookmark reverts with a message after a failed save');

  // B05: a failed upload keeps the error, the form and the file; the retry only re-sends the file.
  const docs = fs.readFileSync('src/today/src/documents.jsx', 'utf8');
  const toasts = [], cleared = [], calls = []; let error = '', attachFails = true;
  const pendingRef = { current: null };
  const submit = new Function('form', 'titleRef', 'setBusy', 'setError', 'payloadOf', 'editing', 'api', 'file', 'canAttach', 'toast', 'readDataUrl', 'onSaved', 'fromApi', 'setForm', 'emptyForm', 'setFile', 'fileRef', 'pendingRef',
    between(docs, '  const submit = async e =>', '  return (') + ';return submit;')(
    { title: 'fake' }, {}, () => {}, e => { error = e; }, () => ({ title: 'fake' }), null,
    async (url, o) => { calls.push((o && o.method || 'GET') + ' ' + url); if (url.endsWith('/attach') && attachFails) throw new Error('upload failed'); return o ? { id: 'doc1' } : { items: [] }; },
    { name: 'fake.pdf' }, () => true, (m, success = true) => toasts.push({ m, success }), async () => 'data:application/pdf;base64,JVBERg==', () => {}, x => x, () => {}, {}, v => cleared.push(v), { current: null }, pendingRef);
  await submit({ preventDefault() {} });
  ok(!toasts.length && error.includes('فایل آپلود نشد') && !cleared.length && pendingRef.current === 'doc1', 'B05: upload failure stays visible, the chosen file is kept');
  attachFails = false; calls.length = 0;
  await submit({ preventDefault() {} });
  ok(calls.includes('PATCH /api/documents/doc1') && !calls.includes('POST /api/documents') && toasts.length === 1 && toasts[0].success && pendingRef.current === null, 'B05: retry sends the file to the same document, no duplicate');

  // B12: a failed digest save restores the switch.
  const digest = { tgMorningOn: true }, notices = [];
  const saveDigest = new Function('setDigest', 'api', 'setNotice', 'digest', 'useRef', between(main, '  const digestSeq = useRef({});', '  const sendChat =') + ';return saveDigest;')(
    f => Object.assign(digest, f(digest)), async () => { throw new Error('503'); }, x => notices.push(x), { ...digest }, v => ({ current: v }));
  await saveDigest({ tgMorningOn: false });
  ok(digest.tgMorningOn === true && notices[0].includes('503'), 'B12: failed digest save puts the switch back');

  // B08: one failed status read schedules a retry.
  const speech = fs.readFileSync('speech-studio/static/studio.js', 'utf8');
  const timers = [];
  const poll = new Function('sel', 'segs', 'api', 'render', 'refreshJobs', 'setTimeout', 'let timer, pollFails = 0;' + between(speech, '  async function poll()', '  function render(j)') + ';return poll;')('fake-job', [], async () => { throw new Error('temporary disconnect'); }, () => {}, () => {}, (f, ms) => timers.push(ms));
  await poll(); await poll();
  ok(timers.length === 2 && timers[1] > timers[0], 'B08: speech polling retries after a failure, with growing delay');


  // B09: SRT timestamps never carry ",1000" (runs fmt_ts from the source AST, no service/model imports).
  const py = "import ast,sys;src=open('speech-studio/server/app.py',encoding='utf-8').read();f=[n for n in ast.parse(src).body if isinstance(n,ast.FunctionDef) and n.name=='fmt_ts'][0];ns={};exec(compile(ast.Module([f],[]),'fmt','exec'),ns);print('|'.join(ns['fmt_ts'](t,True) for t in (1.9996,1.5,3599.9995)))";
  const r = require('node:child_process').spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status === 0) ok(r.stdout.trim() === '00:00:02,000|00:00:01,500|01:00:00,000', 'B09: SRT timestamps round over the second correctly');
  else console.log('SKIP B09: python3 not available');

  console.log('Sidebar continuation acceptance: ' + n + ' checks passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
