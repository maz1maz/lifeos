// Smoke test: starts the real server on a throw-away port and hits it over HTTP.
// Run with: npm test  (or) node test/smoke.js
// Guards against regressions of the auth-check crash bug (see REMAINING-WORK.md history):
// any authenticated route must reject an invalid session cookie with 401, never crash.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..');
// Isolated from the real app's data/db.json on purpose: this file is reset to empty
// at the start AND end of every run. It must NEVER be the same file the dev server
// or a tunnel-exposed production instance is using, or a test run wipes real user data.
const DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-smoke-')), 'db.json');
const PORT = 3979;
const BASE = `http://127.0.0.1:${PORT}`;

const EMPTY_DB = { users: [], sessions: [], transactions: [], tasks: [], inbox: [], daily: [], investments: [], accounts: [], budgets: [], projects: [], timeEntries: [], habits: [], habitLogs: [], subscriptions: [], debts: [], footballTeams: [], matches: [], news: [], movies: [] };

let pass = 0, fail = 0;
function today() { return new Date().toISOString().slice(0, 10); }
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  - ${name}`); }
  else { fail++; console.log(`  FAIL- ${name}`); }
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${BASE}/api/me`); return; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('server did not come up');
}

async function main() {
  fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2));
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DB_PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
  let crashed = false;
  child.on('exit', (code, signal) => { if (code !== null && code !== 0) crashed = true; });
  child.stderr.on('data', d => process.stderr.write(`[server] ${d}`));

  try {
    await waitForServer();

    console.log('\n[1] invalid-cookie crash repro on every mutating route');
    const badCookie = { Cookie: 'sid=not-a-real-session' };
    const routes = [
      ['DELETE', '/api/tasks/x'], ['POST', '/api/inbox/x/convert'],
      ['DELETE', '/api/movies/x'], ['PATCH', '/api/movies/x'],
      ['PATCH', '/api/news/x'], ['PATCH', '/api/football/matches/x'],
      ['POST', '/api/debts/x/settle'], ['POST', '/api/subscriptions/x/pay'],
      ['DELETE', '/api/projects/x'], ['DELETE', '/api/time/x'],
      ['GET', '/api/search?q=x'],
    ];
    for (const [method, p] of routes) {
      const r = await fetch(BASE + p, { method, headers: badCookie });
      check(`${method} ${p} -> 401 (not a crash)`, r.status === 401);
    }
    const alive = await fetch(`${BASE}/api/me`);
    check('server still alive after invalid-cookie storm', alive.status === 200);
    check('server process did not exit', !crashed);

    console.log('\n[2] auth flows');
    const email = `smoke_${Date.now()}@example.com`;
    const signup = await fetch(`${BASE}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Smoke', email, password: 'secret123' }) });
    check('signup -> 201', signup.status === 201);
    const wrongPw = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'WRONG' }) });
    check('login wrong password -> 401', wrongPw.status === 401);
    const rightPw = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'secret123' }) });
    check('login correct password -> 200', rightPw.status === 200);
    const cookie = rightPw.headers.get('set-cookie').split(';')[0];
    const unknownEmail = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nobody@example.com', password: 'x' }) });
    check('login unknown email -> 401 (no crash)', unknownEmail.status === 401);

    console.log('\n[3] subtask cascade delete (3 levels)');
    const authHeaders = { 'Content-Type': 'application/json', Cookie: cookie };
    const root = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'root' }) }).then(r => r.json());
    const child_ = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'child', parentTaskId: root.id }) }).then(r => r.json());
    const grandchild = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'grandchild', parentTaskId: child_.id }) }).then(r => r.json());
    const del = await fetch(`${BASE}/api/tasks/${root.id}`, { method: 'DELETE', headers: authHeaders });
    check('delete root -> 200', del.status === 200);
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const remaining = db.tasks.filter(t => [root.id, child_.id, grandchild.id].includes(t.id));
    check('root, child, and grandchild all removed', remaining.length === 0);

    console.log('\n[4] authenticated happy path');
    const proj = await fetch(`${BASE}/api/projects`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'P1' }) }).then(r => r.json());
    check('create project -> got id', !!proj.id);
    const delProj = await fetch(`${BASE}/api/projects/${proj.id}`, { method: 'DELETE', headers: authHeaders });
    check('delete project -> 200', delProj.status === 200);

    console.log('\n[5] recurring task auto-next');
    const recurring = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'daily standup', recurrence: 'daily', date: '2026-01-01' }) }).then(r => r.json());
    await fetch(`${BASE}/api/tasks/${recurring.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ done: true }) });
    const dashboard2 = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')).tasks.filter(t => t.title === 'daily standup');
    check('completing a recurring task creates exactly one next instance', dashboard2.length === 2);
    check('next instance is scheduled the following day, not done', dashboard2.some(t => t.date === '2026-01-02' && !t.done));
    const recurring2 = await fetch(`${BASE}/api/tasks/${recurring.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ note: 'noop' }) });
    const dashboard3 = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')).tasks.filter(t => t.title === 'daily standup');
    check('re-patching an already-done recurring task does not duplicate it', dashboard3.length === 2);

    console.log('\n[6] time entry edit');
    const timeEntry = await fetch(`${BASE}/api/time`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'writing', minutes: 30 }) }).then(r => r.json());
    const timeEdit = await fetch(`${BASE}/api/time/${timeEntry.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ minutes: 90 }) });
    check('PATCH time entry -> 200', timeEdit.status === 200);
    const timeEdited = await timeEdit.json();
    check('time entry minutes updated', timeEdited.minutes === 90);

    console.log('\n[7] habit edit / archive / delete');
    const habit = await fetch(`${BASE}/api/habits`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'water' }) }).then(r => r.json());
    await fetch(`${BASE}/api/habits/${habit.id}/toggle`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ date: today() }) });
    const loggedDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    check('first-ever toggle actually persists a habitLog row', loggedDb.habitLogs.some(l => l.habitId === habit.id && l.done));
    const habitEdit = await fetch(`${BASE}/api/habits/${habit.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ name: 'drink water' }) });
    check('PATCH habit -> 200', habitEdit.status === 200);
    const habitArchive = await fetch(`${BASE}/api/habits/${habit.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ archived: true }) });
    check('archive habit -> 200', habitArchive.status === 200);
    const habitsAfterArchive = await fetch(`${BASE}/api/habits?date=${today()}`, { headers: authHeaders }).then(r => r.json());
    check('archived habit no longer listed', !habitsAfterArchive.items.some(h => h.id === habit.id));
    const habitDelete = await fetch(`${BASE}/api/habits/${habit.id}`, { method: 'DELETE', headers: authHeaders });
    check('delete habit -> 200', habitDelete.status === 200);
    const dbAfterHabitDelete = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    check('deleted habit and its logs are gone', !dbAfterHabitDelete.habits.some(h => h.id === habit.id) && !dbAfterHabitDelete.habitLogs.some(l => l.habitId === habit.id));

    console.log('\n[8] daily journal extra fields round-trip');
    const dailySave = await fetch(`${BASE}/api/daily`, { method: 'PUT', headers: authHeaders, body: JSON.stringify({ date: today(), bestMoment: 'coffee', gratitude: 'sunshine', tomorrowPlan: 'ship it' }) }).then(r => r.json());
    check('daily journal keeps bestMoment/gratitude/tomorrowPlan', dailySave.bestMoment === 'coffee' && dailySave.gratitude === 'sunshine' && dailySave.tomorrowPlan === 'ship it');

    console.log('\n[9] live timer + Pomodoro backend');
    const noTimer = await fetch(`${BASE}/api/timer`, { headers: authHeaders }).then(r => r.json());
    check('no active timer initially', noTimer.timer === null);
    const started = await fetch(`${BASE}/api/timer/start`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'deep work' }) }).then(r => r.json());
    check('start timer -> got startedAt', !!started.startedAt);
    const doubleStart = await fetch(`${BASE}/api/timer/start`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'other' }) });
    check('starting a second timer while one runs -> 409', doubleStart.status === 409);
    const runningNow = await fetch(`${BASE}/api/timer`, { headers: authHeaders }).then(r => r.json());
    check('GET /api/timer reflects the running timer across a fresh request', runningNow.timer && runningNow.timer.id === started.id);
    await new Promise(r => setTimeout(r, 1100));
    const stopped = await fetch(`${BASE}/api/timer/stop`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ date: '2026-03-03' }) }).then(r => r.json());
    check('stopping the timer creates a real time entry with minutes >= 1', stopped.minutes >= 1 && stopped.title === 'deep work');
    check('stop respects a client-supplied date instead of always using server today() (guards the UTC/local-midnight mismatch bug)', stopped.date === '2026-03-03');
    const afterStop = await fetch(`${BASE}/api/timer`, { headers: authHeaders }).then(r => r.json());
    check('no active timer after stop', afterStop.timer === null);
    const stopAgain = await fetch(`${BASE}/api/timer/stop`, { method: 'POST', headers: authHeaders });
    check('stopping with nothing running -> 404, not a crash', stopAgain.status === 404);

    const pomodoro = await fetch(`${BASE}/api/timer/start`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'pomodoro session', deadlineAt: Date.now() + 60000 }) }).then(r => r.json());
    check('pomodoro-style start persists a deadlineAt', !!pomodoro.deadlineAt);
    await fetch(`${BASE}/api/timer/cancel`, { method: 'POST', headers: authHeaders });
    const afterCancel = await fetch(`${BASE}/api/timer`, { headers: authHeaders }).then(r => r.json());
    check('cancel discards the timer without logging time', afterCancel.timer === null);

    console.log('\n[10] exercise logging');
    const ex = await fetch(`${BASE}/api/exercise`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ type: 'دویدن', minutes: 30 }) }).then(r => r.json());
    check('log exercise -> got id', !!ex.id);
    const exList = await fetch(`${BASE}/api/exercise?from=${today()}&to=${today()}`, { headers: authHeaders }).then(r => r.json());
    check('exercise shows up in today range', exList.items.some(i => i.id === ex.id));
    const exDel = await fetch(`${BASE}/api/exercise/${ex.id}`, { method: 'DELETE', headers: authHeaders });
    check('delete exercise -> 200', exDel.status === 200);

    console.log('\n[11] daily journal water/weight/meds fields');
    const dailyHealth = await fetch(`${BASE}/api/daily`, { method: 'PUT', headers: authHeaders, body: JSON.stringify({ date: today(), water: 1500, weight: 74.2, meds: 'ویتامین D' }) }).then(r => r.json());
    check('daily journal keeps water/weight/meds', dailyHealth.water === 1500 && dailyHealth.weight === 74.2 && dailyHealth.meds === 'ویتامین D');

    console.log('\n[12] habit history for charting');
    const habit2 = await fetch(`${BASE}/api/habits`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'مطالعه' }) }).then(r => r.json());
    await fetch(`${BASE}/api/habits/${habit2.id}/toggle`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ date: today() }) });
    const hist = await fetch(`${BASE}/api/habits/history?from=2026-01-01&to=2026-12-31`, { headers: authHeaders }).then(r => r.json());
    check('habit history includes the habit', hist.habits.some(h => h.id === habit2.id));
    check('habit history includes today\'s completed log', hist.logs.some(l => l.habitId === habit2.id && l.date === today()));

    console.log('\n[13] task time-blocking fields');
    const scheduled = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'جلسه تیم', startTime: '14:00', durationMinutes: 45, date: today() }) }).then(r => r.json());
    check('task keeps startTime/durationMinutes on create', scheduled.startTime === '14:00' && scheduled.durationMinutes === 45);
    const unscheduled = await fetch(`${BASE}/api/tasks/${scheduled.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ startTime: null }) }).then(r => r.json());
    check('clearing startTime via PATCH works', unscheduled.startTime === null);

    console.log('\n[14] weekly review');
    const overdueTask = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'overdue thing', date: '2020-01-01', deadline: '2020-01-01' }) }).then(r => r.json());
    const doneTask = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'won this week', date: today() }) }).then(r => r.json());
    await fetch(`${BASE}/api/tasks/${doneTask.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ done: true }) });
    const weekReview = await fetch(`${BASE}/api/weekly-review?from=${today()}&to=${today()}`, { headers: authHeaders }).then(r => r.json());
    check('weekly review lists the completed task as a win', weekReview.wins.some(t => t.id === doneTask.id));
    check('weekly review lists the overdue task regardless of range', weekReview.overdue.some(t => t.id === overdueTask.id));
    const savedPriority = await fetch(`${BASE}/api/weekly-review`, { method: 'PUT', headers: authHeaders, body: JSON.stringify({ weekStart: today(), priority: 'ship the redesign' }) });
    check('save weekly priority -> 200', savedPriority.status === 200);
    const reReadReview = await fetch(`${BASE}/api/weekly-review?from=${today()}&to=${today()}`, { headers: authHeaders }).then(r => r.json());
    check('weekly priority round-trips back on GET', reReadReview.priority === 'ship the redesign');

    console.log('\n[15] accounts: edit, archive, transfer');
    const accA = await fetch(`${BASE}/api/accounts`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'Card A', openingBalance: 1000000 }) }).then(r => r.json());
    const accB = await fetch(`${BASE}/api/accounts`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'Card B', openingBalance: 0 }) }).then(r => r.json());
    const accEdit = await fetch(`${BASE}/api/accounts/${accB.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ name: 'Card B Renamed' }) });
    check('PATCH account rename -> 200', accEdit.status === 200);
    const transfer = await fetch(`${BASE}/api/transfers`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ fromAccount: 'Card A', toAccount: 'Card B Renamed', amount: 200000 }) });
    check('create transfer -> 201', transfer.status === 201);
    const accountsAfter = await fetch(`${BASE}/api/accounts`, { headers: authHeaders }).then(r => r.json());
    const cardA = accountsAfter.accounts.find(a => a.id === accA.id);
    const cardB = accountsAfter.accounts.find(a => a.id === accB.id);
    check('transfer debits source account', cardA.balance === 800000);
    check('transfer credits destination account', cardB.balance === 200000);
    const financeAfterTransfer = await fetch(`${BASE}/api/finance?month=${today().slice(0, 7)}`, { headers: authHeaders }).then(r => r.json());
    check('transfer does not count as expense in finance summary', financeAfterTransfer.expense === 0);
    const archiveAcc = await fetch(`${BASE}/api/accounts/${accB.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ archived: true }) });
    check('archive account -> 200', archiveAcc.status === 200);
    const accountsAfterArchive = await fetch(`${BASE}/api/accounts`, { headers: authHeaders }).then(r => r.json());
    check('archived account no longer listed', !accountsAfterArchive.accounts.some(a => a.id === accB.id));

    console.log('\n[16] recurring transactions auto-generate next instance');
    const pastDate = '2020-01-01';
    const recurTx = await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'Rent', amount: 5000000, kind: 'expense', date: pastDate, recurrence: 'monthly' }) }).then(r => r.json());
    const afterAdvance = await fetch(`${BASE}/api/transactions?from=2020-01-01&to=2020-03-01`, { headers: authHeaders }).then(r => r.json());
    const chain = afterAdvance.items.filter(x => x.recurrenceId === recurTx.recurrenceId);
    check('recurring transaction generated at least one next instance', chain.length >= 2);
    check('generated instance is exactly one period after the source', chain.some(x => x.date === '2020-02-01'));

    console.log('\n[17] total monthly budget');
    const totalBudgetMonth = '2025-06';
    await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'groceries', amount: 300000, kind: 'expense', category: 'خوراک', date: totalBudgetMonth + '-05' }) });
    const totalBudgetSave = await fetch(`${BASE}/api/budgets`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ category: '__total__', limit: 10000000, month: totalBudgetMonth }) });
    check('save total budget -> 201', totalBudgetSave.status === 201);
    const budgetsGet = await fetch(`${BASE}/api/budgets?month=${totalBudgetMonth}`, { headers: authHeaders }).then(r => r.json());
    check('totalBudget returned separately from per-category budgets', budgetsGet.totalBudget === 10000000);
    check('__total__ excluded from the regular budgets list', !budgetsGet.budgets.some(b => b.category === '__total__'));
    check('totalSpent reflects all expenses that month', budgetsGet.totalSpent === 300000);

    console.log('\n[18] settling a debt records a real transaction');
    const debt = await fetch(`${BASE}/api/debts`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ person: 'Ali', amount: 150000, type: 'payable' }) }).then(r => r.json());
    const settled = await fetch(`${BASE}/api/debts/${debt.id}/settle`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ account: 'Card A' }) }).then(r => r.json());
    check('settling a payable debt creates an expense transaction', settled.transaction && settled.transaction.kind === 'expense' && settled.transaction.amount === 150000);

    console.log('\n[19] transaction filters');
    await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'big one', amount: 9000000, kind: 'expense', category: 'حمل‌ونقل', account: 'Card A', date: today() }) });
    const filtered = await fetch(`${BASE}/api/transactions?from=1900-01-01&to=2100-01-01&category=حمل‌ونقل&minAmount=5000000`, { headers: authHeaders }).then(r => r.json());
    check('filter by category+minAmount returns only matching rows', filtered.items.length > 0 && filtered.items.every(x => x.category === 'حمل‌ونقل' && x.amount >= 5000000));

    console.log('\n[20] CSV export');
    const csvRes = await fetch(`${BASE}/api/transactions/export?from=1900-01-01&to=2100-01-01`, { headers: authHeaders });
    const csvText = await csvRes.text();
    check('CSV export -> 200 with csv content-type', csvRes.status === 200 && (csvRes.headers.get('content-type') || '').includes('csv'));
    check('CSV export includes a known row', csvText.includes('big one'));

    console.log('\n[21] receipt photo attach');
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const receiptTx = await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'with receipt', amount: 10000, date: today() }) }).then(r => r.json());
    const receiptSave = await fetch(`${BASE}/api/transactions/${receiptTx.id}/receipt`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ image: tinyPng }) }).then(r => r.json());
    check('receipt upload sets a /uploads path', !!(receiptSave.receipt && receiptSave.receipt.startsWith('/uploads/')));
    const uploadedFileExists = fs.existsSync(path.join(ROOT, 'public', receiptSave.receipt));
    check('receipt file actually written to disk', uploadedFileExists);
    const receiptServed = await fetch(`${BASE}${receiptSave.receipt}`);
    check('uploaded receipt is served with an image content-type, not text/plain', (receiptServed.headers.get('content-type') || '').startsWith('image/'));
    if (uploadedFileExists) fs.unlinkSync(path.join(ROOT, 'public', receiptSave.receipt));

    console.log('\n[22] insights: debt/subscription due-soon reminders');
    const soon = new Date(); soon.setDate(soon.getDate() + 1);
    const soonStr = soon.toISOString().slice(0, 10);
    await fetch(`${BASE}/api/debts`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ person: 'Sara', amount: 50000, type: 'receivable', dueDate: soonStr }) });
    await fetch(`${BASE}/api/subscriptions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'Spotify', amount: 100000, nextDate: soonStr }) });
    const insightsRes = await fetch(`${BASE}/api/insights`, { headers: authHeaders }).then(r => r.json());
    check('insights mentions a due-soon subscription', insightsRes.items.some(i => i.text.includes('اشتراک') && i.text.includes('روز')));
    check('insights mentions a due-soon debt', insightsRes.items.some(i => i.text.includes('بدهی/طلب')));

  } finally {
    child.kill();
    fs.rmSync(path.dirname(DB_PATH), { recursive: true, force: true });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
