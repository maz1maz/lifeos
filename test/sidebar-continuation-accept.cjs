// Acceptance checks for the second sidebar audit (docs/SIDEBAR-CONTINUATION-AUDIT.md): each line asserts the FIXED behaviour.
// Items still open stay characterized in test/sidebar-continuation-audit.cjs; move them here as they are fixed.
// Runs only against an isolated in-memory DB. No network or production data.
const assert = require('node:assert/strict');
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

  console.log('Sidebar continuation acceptance: ' + n + ' checks passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
