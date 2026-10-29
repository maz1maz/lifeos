// Characterizations of existing defects, not fixed-behavior regression tests.
// Isolated Worker database and verbatim frontend functions; no production calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { makeKvD1 } = require('./d1-kv-fake');
const { loadWorkerModule } = require('./load-worker');
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); const j = s.indexOf(b, i); assert.ok(j > i, b); return s.slice(i, j); };
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
  const post = async (p, body) => { const r = await call(p, 'POST', body); assert.equal(r.status, 201, JSON.stringify(r)); return r.data; };
  for (const path of ['admin/overview', 'admin/users/b/disable', 'admin/users/b/locks', 'admin/users/b/logout']) {
    ok((await call(path, path.endsWith('overview') ? 'GET' : 'POST', path.endsWith('overview') ? undefined : {})).status === 403, 'CONTROL: non-admin refused ' + path);
  }
  const note = await post('inbox', { title: 'conversion audit', text: 'detail' });
  ok((await call('inbox/' + note.id, 'PATCH', { text: 'foreign' }, 'sb')).status === 404, 'CONTROL: note refuses foreign edit');
  await call('inbox/' + note.id + '/convert', 'POST', { type: 'task', date: '2026-10-20' });
  await call('inbox/' + note.id + '/convert', 'POST', { type: 'task', date: '2026-10-20' });
  ok((await call('tasks')).data.items.filter(x => x.title === note.title).length === 2, 'BUG: converting an already archived note again creates duplicate tasks');
  ok((await makeHelpers(env).read()).inbox.some(x => x.id === note.id && x.archived), 'CONTROL: converted note is marked archived');
  const doc = await post('documents', { title: 'audit document' });
  ok((await call('documents/' + doc.id, 'PATCH', { title: 'foreign' }, 'sb')).status === 404, 'CONTROL: document refuses foreign edit');
  ok((await call('documents/' + doc.id + '/file', 'GET', undefined, 'sb')).status === 404, 'CONTROL: document refuses foreign file read');
  ok((await call('documents/' + doc.id + '/attach', 'POST', { file: 'data:application/pdf;base64,JVBERg==' })).status === 503, 'CONTROL: document upload explicitly refuses missing Telegram connection');
  const contact = await post('contacts', { name: 'audit contact', phone: '۰۹۱۲۱۲۳۴۵۶۷' });
  ok((await call('contacts/' + contact.id, 'DELETE', undefined, 'sb')).status === 404, 'CONTROL: contact refuses foreign deletion');
  await call('contacts/' + contact.id + '/log', 'POST', { date: '2026-10-20', type: 'call' });
  await call('contacts/' + contact.id + '/log', 'POST', { date: '2026-10-01', type: 'call' });
  ok((await call('contacts')).data.items.find(x => x.id === contact.id).lastContactDate === '2026-10-01', 'BUG: recording a historical interaction moves last-contact date backwards');
  await call('contacts/' + contact.id, 'DELETE');
  ok(!(await call('contacts/' + contact.id + '/log')).data.items.length, 'CONTROL: contact deletion removes own logs');
  const news = await post('news', { title: 'audit article', summary: 'sample' });
  ok((await call('news/' + news.id, 'PATCH', { saved: true }, 'sb')).status === 404, 'CONTROL: news refuses foreign mutation');
  ok((await call('news/' + news.id, 'PATCH', { saved: true })).data.saved, 'CONTROL: news save persists');
  const lock = await call('admin/users/b/locks', 'POST', { locked: ['notes'] }, 'sad');
  ok(lock.status === 200, 'CONTROL: admin can apply notes lock');
  ok((await call('shopping', 'GET', undefined, 'sb')).status === 403, 'CONTROL: locked notes user is refused shopping API');
  ok((await call('inbox', 'GET', undefined, 'sb')).status === 200, 'BUG: locked notes user still reads the notes API');
  ok((await call('inbox', 'POST', { title: 'locked but writable' }, 'sb')).status === 201, 'BUG: locked notes user still writes the notes API');
  const hijack = await call('me', 'PATCH', { telegramUserId: '123456789' });
  const db = await makeHelpers(env).read();
  ok(hijack.status === 200 && db.users.find(x => x.id === 'a').telegramUserId === '123456789' && !db.users.find(x => x.id === 'b').telegramUserId, 'BUG: profile PATCH moves Telegram link from another user without link-code proof');
  const football = fs.readFileSync('src/today/src/football.jsx', 'utf8');
  const dateLabel = new Function(between(football, 'const matchDateLabel =', 'const asTeam =') + ';return matchDateLabel;')();
  const kickoff = '2026-10-20T22:00:00Z';
  const groupDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(kickoff));
  const expectedLabel = new Date(groupDate + 'T12:00:00').toLocaleDateString('fa-IR');
  ok(dateLabel({ date: kickoff }) !== expectedLabel, 'BUG: football details date differs from Tehran group date near midnight');
  const contacts = fs.readFileSync('src/today/src/contacts.jsx', 'utf8');
  const telHref = new Function(between(contacts, 'const PHONE_SPLIT_RE =', 'const smsHref =') + ';return telHref;')();
  ok(telHref('۰۹۱۲۱۲۳۴۵۶۷') === null, 'BUG: Persian phone digits produce no call link');
  const main = fs.readFileSync('src/today/src/main.jsx', 'utf8');
  const values = new Map([['lifeos-ielts-rd-shared-test', JSON.stringify({ answers: { 1: 'account A answer' } })], ['lifeos-vocab-tutor', JSON.stringify({ modes: { chat: { hist: [{ content: 'account A text' }] } } })]]);
  const redirects = [], queue = [];
  const location = { set href(v) { redirects.push(v); } };
  const storage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const signOut = new Function('clearPendingRowSaves', 'fetch', 'caches', 'localStorage', 'sessionStorage', 'location', between(main, 'async function signOut()', "window.addEventListener('beforeinstallprompt'") + ';return signOut;')(
    () => queue.push('cleared'), async () => new Response('{}', { status: 503 }), { keys: async () => [] }, storage, { clear: () => {} }, location);
  await signOut();
  ok(redirects.length === 1 && queue.length === 1, 'BUG: failed logout redirects and clears pending saves without confirming session revocation');
  ok(values.has('lifeos-ielts-rd-shared-test') && values.has('lifeos-vocab-tutor'), 'BUG: logout leaves IELTS answers and tutor history in shared local storage');
  const draftSource = fs.readFileSync('src/today/src/ielts-exams-store.js', 'utf8').replaceAll('export const', 'const');
  const drafts = new Function('localStorage', draftSource + ';return {loadDraft,saveDraft};')(storage);
  ok(drafts.loadDraft('rd-shared-test').answers[1] === 'account A answer', 'BUG: the same shared exam id loads the previous account answer');
  const vocab = fs.readFileSync('public/vocab/app.js', 'utf8');
  const selectedState = new Function('remote', 'DEF', 'load', 'let USER, S;' + between(vocab, '    USER = "lifeos";', '    VIEW = "study";') + ';return S;')(
    { state: null }, () => ({ cards: {}, settings: {}, quiz: {} }), user => { assert.equal(user, 'lifeos'); return { cards: { previousAccountWord: { good: 3 } } }; });
  ok(selectedState.cards.previousAccountWord.good === 3, 'BUG: empty server vocabulary falls back to the shared previous-account cache');
  const readingSource = fs.readFileSync('src/today/src/reading.jsx', 'utf8');
  let articleList = [{ id: 'fake-article', saved: false }], reader = articleList[0], patchPending;
  const patchNews = new Function('setItems', 'api', 'load', between(readingSource, '  const patch = async (x, body)', '  const del =') + ';return patch;')(
    f => { articleList = f(articleList); }, async () => { throw new Error('503'); }, () => { articleList = [{ id: 'fake-article', saved: false }]; });
  const readerSave = readingSource.match(/onSave=\{(\(\) => \{ patch\(reading,[^\n]+?setReading\(r => \(\{ \.\.\.r, saved: !r.saved \}\)\); \})\}/);
  assert.ok(readerSave, 'reader onSave callback');
  new Function('patch', 'reading', 'setReading', 'return (' + readerSave[1] + ');')(
    (...args) => { patchPending = patchNews(...args); }, reader, f => { reader = f(reader); })();
  await patchPending;
  ok(reader.saved && !articleList[0].saved, 'BUG: reader bookmark stays selected after failed save restores the list');
  const speech = fs.readFileSync('speech-studio/static/studio.js', 'utf8');
  const timers = [];
  const poll = new Function('sel', 'segs', 'api', 'render', 'refreshJobs', 'setTimeout', between(speech, '  async function poll()', '  function render(j)') + ';return poll;')('fake-job', [], async () => { throw new Error('temporary disconnect'); }, () => {}, () => {}, () => timers.push('retry'));
  await poll();
  ok(timers.length === 0, 'BUG: one speech polling failure stops all automatic progress polling');
  // The document composer emits an error toast then overwrites it with success.
  const docs = fs.readFileSync('src/today/src/documents.jsx', 'utf8');
  const toasts = [], fileCleared = [];
  const submitCode = between(docs, '  const submit = async e =>', '  return (');
  const submit = new Function('form', 'titleRef', 'setBusy', 'setError', 'payloadOf', 'editing', 'api', 'file', 'canAttach', 'toast', 'readDataUrl', 'onSaved', 'fromApi', 'setForm', 'emptyForm', 'setFile', 'fileRef', submitCode + ';return submit;')(
    { title: 'fake' }, {}, () => {}, () => {}, () => ({ title: 'fake' }), null,
    async (url, options) => { if (url.endsWith('/attach')) throw new Error('upload failed'); return options ? { id: 'fake' } : { items: [] }; },
    { name: 'fake.pdf' }, () => true, (message, success = true) => toasts.push({ message, success }), async () => 'data:application/pdf;base64,JVBERg==', () => {}, x => x, () => {}, {}, value => fileCleared.push(value), { current: null });
  await submit({ preventDefault() {} });
  ok(toasts.length === 2 && !toasts[0].success && toasts[1].success && fileCleared[0] === null, 'BUG: document upload failure is overwritten by success and chosen file cleared');
  const failedNotice = [], digest = {};
  const saveDigest = new Function('setDigest', 'api', 'setNotice', between(main, '  const saveDigest = async patch =>', '  const sendChat =') + ';return saveDigest;')(f => Object.assign(digest, f(digest)), async () => { throw new Error('503'); }, x => failedNotice.push(x));
  await saveDigest({ tgMorningOn: false });
  ok(digest.tgMorningOn === false && failedNotice[0] === '503', 'BUG: failed digest save leaves the optimistic switch looking disabled');
  ok((await call('auth/logout', 'POST')).status === 200 && (await call('tasks')).status === 401, 'CONTROL: successful logout really revokes the server session');
  console.log('Completed ' + n + ' isolated checks. BUG lines characterize existing defects; no fixes or production mutations.');
})().catch(e => { console.error(e); process.exitCode = 1; });
