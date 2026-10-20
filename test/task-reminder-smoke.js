const assert = require('node:assert/strict');
const { makeKvD1 } = require('./d1-kv-fake');
const { loadWorkerModule } = require('./load-worker');

async function main() {
  const { default: worker, makeHelpers } = await loadWorkerModule();
  const DB = makeKvD1(new Map([['db', JSON.stringify({ users: [{ id: 'u1', name: 'Test' }, { id: 'u2', name: 'Other' }], sessions: [{ id: 's1', userId: 'u1' }, { id: 's2', userId: 'u2' }], _meta: { currencyUnit: 'IRR', depositXferFixed: true } })]]));
  const env = { DB, ASSETS: { fetch: async () => new Response('', { status: 404 }) } };
  const call = async (path, method = 'GET', body, session = 's1') => {
    const r = await worker.fetch(new Request('https://task-test.local/api/' + path, { method, headers: { cookie: 'sid=' + session, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, {});
    const data = await r.json();
    assert.notEqual(r.status, 500, `${method} ${path}: ${JSON.stringify(data)}`);
    return { status: r.status, data };
  };
  const create = async (kind, body) => { const r = await call(kind, 'POST', body); assert.equal(r.status, 201); return r.data; };
  const patch = async (kind, row, body) => { const r = await call(`${kind}/${row.id}`, 'PATCH', body); assert.equal(r.status, 200); return r.data; };
  const items = async kind => (await call(kind)).data.items;
  let pass = 0, fail = 0;
  const test = async (name, run) => { try { await run(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + ': ' + e.message); } };

  await test('ordinary task ticks, unticks, and reloads without generating copies', async () => {
    const t = await create('tasks', { title: 'ordinary', date: '2026-10-20' });
    for (const done of [true, true, false, true]) { await patch('tasks', t, { done }); assert.equal((await items('tasks')).find(x => x.id === t.id).done, done); }
    assert.equal((await items('tasks')).filter(x => x.title === t.title).length, 1);
  });
  await test('task and all linked reminders synchronize both ways', async () => {
    const t = await create('tasks', { title: 'linked' });
    const a = await create('reminders', { title: 'linked A', taskId: t.id });
    const b = await create('reminders', { title: 'linked B', taskId: t.id });
    await patch('tasks', t, { done: true });
    assert.ok((await items('reminders')).filter(x => x.taskId === t.id).every(x => x.done));
    await patch('reminders', a, { done: false });
    assert.equal((await items('tasks')).find(x => x.id === t.id).done, false);
    assert.equal((await items('reminders')).find(x => x.id === b.id).done, false);
    await call(`reminders/${a.id}/act`, 'POST', { act: 'done' });
    assert.ok((await items('tasks')).find(x => x.id === t.id).done);
  });
  await test('a task delete also deletes child reminders and attachment records, preserving other owners', async () => {
    const t = await create('tasks', { title: 'delete parent' });
    const child = await create('tasks', { title: 'delete child', parentTaskId: t.id });
    const rem = await create('reminders', { title: 'delete reminder', taskId: child.id });
    const h = makeHelpers(env), db = await h.read();
    db.tasks.push({ id: 'foreign-child', userId: 'u2', parentTaskId: t.id, title: 'foreign', date: '2026-10-20', done: false });
    db.attachments = [{ id: 'test-att', userId: 'u1', ownerType: 'task', ownerId: child.id }, { id: 'rem-att', userId: 'u1', ownerType: 'reminder', ownerId: rem.id }];
    await h.write(db);
    assert.equal((await call(`tasks/${t.id}`, 'DELETE')).status, 200);
    const after = await makeHelpers(env).read();
    assert.ok(!after.tasks.some(x => x.id === child.id));
    assert.ok(!after.reminders.some(x => x.id === rem.id));
    assert.equal(after.attachments.length, 0);
    assert.ok(after.tasks.some(x => x.id === 'foreign-child'));
  });
  await test('deleting a reminder preserves its task and removes reminder attachments', async () => {
    const t = await create('tasks', { title: 'keep task' });
    const r = await create('reminders', { title: 'remove only reminder', taskId: t.id });
    const h = makeHelpers(env), db = await h.read(); db.attachments.push({ id: 'only-rem-att', userId: 'u1', ownerType: 'reminder', ownerId: r.id }); await h.write(db);
    await call(`reminders/${r.id}`, 'DELETE');
    assert.ok((await items('tasks')).some(x => x.id === t.id));
    assert.ok(!(await makeHelpers(env).read()).attachments.some(x => x.id === 'only-rem-att'));
  });
  await test('recurring task reticks do not duplicate or resurrect the next task', async () => {
    const t = await create('tasks', { title: 'daily', date: '2026-10-20', recurrence: 'daily', startTime: '09:15', durationMinutes: 45 });
    for (const done of [true, false, true]) await patch('tasks', t, { done });
    const next = (await items('tasks')).filter(x => x.title === t.title && x.id !== t.id);
    assert.equal(next.length, 1); assert.equal(next[0].date, '2026-10-21'); assert.equal(next[0].startTime, '09:15'); assert.equal(next[0].durationMinutes, 45);
    await call(`tasks/${next[0].id}`, 'DELETE');
    for (const done of [false, true]) await patch('tasks', t, { done });
    assert.equal((await items('tasks')).filter(x => x.title === t.title).length, 1);
  });
  await test('monthly tasks clamp the next date to the last day of February', async () => {
    const t = await create('tasks', { title: 'month end', date: '2026-01-31', recurrence: 'monthly' });
    await patch('tasks', t, { done: true });
    assert.ok((await items('tasks')).some(x => x.title === t.title && x.date === '2026-02-28'));
  });
  await test('separate recurring tasks sharing a title retain separate series', async () => {
    const a = await create('tasks', { title: 'same title', date: '2026-10-20', recurrence: 'daily' });
    const b = await create('tasks', { title: 'same title', date: '2026-10-20', recurrence: 'daily' });
    await patch('tasks', a, { done: true }); await patch('tasks', b, { done: true });
    assert.equal((await items('tasks')).filter(x => x.title === a.title && x.date === '2026-10-21').length, 2);
  });
  await test('linked recurring task and reminder advance together with one linked next pair', async () => {
    const t = await create('tasks', { title: 'linked recurring', date: '2026-10-20', recurrence: 'daily' });
    const r = await create('reminders', { title: t.title, date: '2026-10-20', recurrence: 'daily', taskId: t.id, time: '08:00', leadMinutes: 30 });
    await patch('reminders', r, { done: true });
    const next = (await items('tasks')).find(x => x.title === t.title && x.date === '2026-10-21'); assert.ok(next);
    const nextRems = (await items('reminders')).filter(x => x.title === t.title && x.date === '2026-10-21'); assert.equal(nextRems.length, 1); assert.equal(nextRems[0].taskId, next.id); assert.equal(nextRems[0].leadMinutes, 30);
  });
  await test('standalone reminder recurrence is idempotent across PATCH and action API', async () => {
    const r = await create('reminders', { title: 'standalone daily', date: '2026-10-20', recurrence: 'daily', leadMinutes: 60 });
    await patch('reminders', r, { done: true }); await call(`reminders/${r.id}/act`, 'POST', { act: 'done' });
    let next = (await items('reminders')).filter(x => x.title === r.title && x.id !== r.id); assert.equal(next.length, 1); assert.equal(next[0].leadMinutes, 60);
    await call(`reminders/${next[0].id}`, 'DELETE');
    for (const done of [false, true]) await patch('reminders', r, { done });
    next = (await items('reminders')).filter(x => x.title === r.title && x.id !== r.id); assert.equal(next.length, 0);
  });
  await test('explicitly undated task stays undated after listing and editing', async () => {
    const t = await create('tasks', { title: 'undated', loose: true });
    assert.equal((await items('tasks')).find(x => x.id === t.id).date, '');
    await patch('tasks', t, { title: 'undated edited' });
    assert.equal((await items('tasks')).find(x => x.id === t.id).date, '');
  });
  await test('reject blank titles, nonboolean done, invalid recurrence/dates and foreign links', async () => {
    for (const kind of ['tasks', 'reminders']) {
      assert.equal((await call(kind, 'POST', { title: '   ' })).status, 400);
      const r = await create(kind, { title: 'validation' });
      for (const body of [null, [], { done: 'false' }, { recurrence: false }, { recurrence: 'garbage' }, { date: '2026-02-31' }]) assert.equal((await call(`${kind}/${r.id}`, 'PATCH', body)).status, 400);
      assert.equal((await call(`${kind}/${r.id}`, 'PATCH', { done: true }, 's2')).status, 404);
    }
    const other = (await call('tasks', 'POST', { title: 'foreign link' }, 's2')).data;
    assert.equal((await call('reminders', 'POST', { title: 'bad link', taskId: other.id })).status, 400);
  });
  await test('weekly and leap-year monthly recurrence keep valid dates', async () => {
    for (const [date, recurrence, expected] of [['2026-12-28', 'weekly', '2027-01-04'], ['2028-01-31', 'monthly', '2028-02-29']]) {
      const t = await create('tasks', { title: 'boundary ' + date, date, recurrence });
      await patch('tasks', t, { done: true });
      assert.ok((await items('tasks')).some(x => x.recurrenceSourceId === t.id && x.date === expected));
    }
  });
  await test('disabling recurrence stops new copies and reopening clears notification markers', async () => {
    const r = await create('reminders', { title: 'stop repetition', recurrence: 'daily' });
    const h = makeHelpers(env), db = await h.read(), stored = db.reminders.find(x => x.id === r.id);
    stored.notifiedAt = 123; stored.leadSentAt = 123; stored.done = true; await h.write(db);
    await patch('reminders', r, { done: false, recurrence: null });
    const reopened = (await items('reminders')).find(x => x.id === r.id);
    assert.equal(reopened.notifiedAt, undefined); assert.equal(reopened.leadSentAt, undefined);
    await patch('reminders', r, { done: true });
    assert.equal((await items('reminders')).filter(x => x.title === r.title).length, 1);
  });
  await test('calendar feed reflects a task and linked reminder tick after reload', async () => {
    const t = await create('tasks', { title: 'calendar tick', date: '2026-10-20' });
    const r = await create('reminders', { title: t.title, date: t.date, taskId: t.id });
    await patch('tasks', t, { done: true });
    const feed = (await call('calendar/feed?from=2026-10-20&to=2026-10-20')).data.items;
    assert.ok(feed.find(x => x.id === 'task:' + t.id).done);
    assert.ok(feed.find(x => x.id === 'reminder:' + r.id).done);
  });
  await test('slow database: six concurrent ticks keep every row and a repeated tick creates one next copy', async () => {
    const batch = DB.batch.bind(DB), prepare = DB.prepare.bind(DB);
    let serial = Promise.resolve();
    const delay = () => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 12)));
    DB.prepare = sql => { const st = prepare(sql); for (const key of ['first', 'all']) { const original = st[key].bind(st); st[key] = async () => { await delay(); return original(); }; } return st; };
    // Preserve D1's atomic transaction semantics, including during retries.
    DB.batch = statements => { const run = serial.then(async () => { await delay(); return batch(statements); }); serial = run.catch(() => {}); return run; };
    try {
      for (let round = 0; round < 3; round++) {
        const rows = [];
        for (let i = 0; i < 6; i++) rows.push(await create('tasks', { title: `stress ${round} ${i}` }));
        await Promise.all(rows.map(t => patch('tasks', t, { done: true })));
        const loaded = await items('tasks'); assert.ok(rows.every(t => loaded.find(x => x.id === t.id).done));
        const rec = await create('tasks', { title: 'stress recurrence ' + round, date: '2026-10-20', recurrence: 'daily' });
        await Promise.all(Array.from({ length: 6 }, () => patch('tasks', rec, { done: true })));
        assert.equal((await items('tasks')).filter(x => x.recurrenceSourceId === rec.id).length, 1);
      }
    } finally { DB.batch = batch; DB.prepare = prepare; }
  });
  await test('browser request ordering rejects old snapshots and suppresses double submissions through refresh', async () => {
    const { createTaskRequestState } = await import('../src/today/src/task-request-state.mjs');
    const state = createTaskRequestState();
    const older = state.beginRead(), newer = state.beginRead();
    assert.equal(state.isCurrent(older), false); assert.equal(state.isCurrent(newer), true);
    let release, saves = 0;
    const blocked = new Promise(resolve => { release = resolve; });
    const action = async () => { saves++; await blocked; };
    const a = state.run('tick:1', action), b = state.run('tick:1', action);
    assert.equal(a, b); assert.equal(state.isCurrent(newer), false);
    await Promise.resolve(); assert.equal(saves, 1);
    release(); await a;
    await state.run('tick:1', async () => { saves++; }); assert.equal(saves, 2);
    await assert.rejects(state.run('error', async () => { throw new Error('offline'); }));
    await state.run('error', async () => { saves++; }); assert.equal(saves, 3);
  });
  await test('current saveRow keeps tap order, retries transient errors, and uses keepalive', async () => {
    const fs = require('node:fs'), path = require('node:path');
    const source = fs.readFileSync(path.join(__dirname, '../src/today/src/rowsave.js'), 'utf8');
    const { saveRow } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    const originalFetch = global.fetch;
    let release, entered;
    const blocked = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    const sent = []; let transient = 0, badRequest = 0;
    global.fetch = async (url, options) => {
      sent.push({ url, done: JSON.parse(options.body).done, keepalive: options.keepalive });
      if (url === '/slow' && sent.filter(x => x.url === '/slow').length === 1) { entered(); await blocked; }
      if (url === '/transient' && transient++ === 0) return new Response('{}', { status: 503 });
      if (url === '/invalid') { badRequest++; return new Response('{}', { status: 400 }); }
      return new Response('{}');
    };
    try {
      const a = saveRow('one', '/slow', { done: true });
      const b = saveRow('one', '/slow', { done: false });
      const other = saveRow('two', '/other', { done: true });
      await started; await other;
      assert.equal(sent.filter(x => x.url === '/slow').length, 1);
      release(); await Promise.all([a, b]);
      assert.deepEqual(sent.filter(x => x.url === '/slow').map(x => x.done), [true, false]);
      assert.ok(sent.every(x => x.keepalive));
      await saveRow('retry', '/transient', { done: true }); assert.equal(transient, 2);
      await assert.rejects(saveRow('bad', '/invalid', { done: false })); assert.equal(badRequest, 1);
    } finally { release(); global.fetch = originalFetch; }
  });
  await test('calendar edit data retains notes, priority and recurrence', async () => {
    const t = await create('tasks', { title: 'calendar details', date: '2026-10-20', notes: 'keep notes', priority: 'high', recurrence: 'weekly' });
    const r = await create('reminders', { title: 'calendar linked', date: t.date, taskId: t.id, recurrence: 'weekly', leadMinutes: 30 });
    const feed = (await call('calendar/feed?from=2026-10-20&to=2026-10-20')).data.items;
    const task = feed.find(x => x.id === 'task:' + t.id), rem = feed.find(x => x.id === 'reminder:' + r.id);
    assert.equal(task.notes, 'keep notes'); assert.equal(task.priority, 'high'); assert.equal(task.recurrence, 'weekly');
    assert.equal(rem.taskId, t.id); assert.equal(rem.leadMinutes, 30); assert.equal(rem.recurrence, 'weekly');
  });
  await test('a failed linked-reminder save reports the already-saved task so the drawer cannot create it twice', async () => {
    const esbuild = require('esbuild'), path = require('node:path');
    const compiled = await esbuild.build({ stdin: { contents: "export { createPlannerItem } from './src/today/src/planner.jsx';", resolveDir: path.resolve(__dirname, '..'), loader: 'jsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
    const exported = { exports: {} };
    new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, exported, exported.exports);
    const originalFetch = global.fetch; const requests = [];
    global.fetch = async (url, options) => { requests.push(url); return url === '/api/tasks' ? new Response(JSON.stringify({ id: 'already-saved', title: 'saved task' }), { status: 201 }) : new Response(JSON.stringify({ error: 'reminder refused' }), { status: 400 }); };
    try {
      await assert.rejects(exported.exports.createPlannerItem('task', { title: 'saved task', date: '2026-10-20', reminderOn: true, reminderDate: '2026-10-20' }), e => e.recordSaved === true && e.message.includes('reminder refused'));
      assert.deepEqual(requests, ['/api/tasks', '/api/reminders']);
      global.fetch = async () => new Response(JSON.stringify({ error: 'task refused' }), { status: 400 });
      await assert.rejects(exported.exports.createPlannerItem('task', { title: 'new task' }), e => !e.recordSaved);
    } finally { global.fetch = originalFetch; }
  });
  await test('legacy repeated rows are reused without silently deleting existing duplicates', async () => {
    const h = makeHelpers(env), db = await h.read();
    db.tasks.push({ id: 'legacy-original', userId: 'u1', title: 'legacy daily', date: '2026-10-20', done: false, recurrence: 'daily' },
      { id: 'legacy-next-a', userId: 'u1', title: 'legacy daily', date: '2026-10-21', done: false, recurrence: 'daily', createdAt: 1 },
      { id: 'legacy-next-b', userId: 'u1', title: 'legacy daily', date: '2026-10-21', done: false, recurrence: 'daily', createdAt: 2 });
    await h.write(db);
    await patch('tasks', { id: 'legacy-original' }, { done: true });
    const rows = (await items('tasks')).filter(x => x.title === 'legacy daily');
    assert.equal(rows.length, 3); assert.equal(rows.find(x => x.id === 'legacy-original').recurrenceNextId, 'legacy-next-a');
  });
  console.log(`Task/reminder audit: ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
