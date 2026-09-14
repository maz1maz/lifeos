// Smoke test: starts the real server on a throw-away port and hits it over HTTP.
// Run with: npm test  (or) node test/smoke.js
// Guards against regressions of the auth-check crash bug (see REMAINING-WORK.md history):
// any authenticated route must reject an invalid session cookie with 401, never crash.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const ROOT = path.join(__dirname, '..');
// Isolated from the real app's data/db.json on purpose: this file is reset to empty
// at the start AND end of every run. It must NEVER be the same file the dev server
// or a tunnel-exposed production instance is using, or a test run wipes real user data.
const DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-smoke-')), 'db.json');
const PORT = 3979;
const BASE = `http://127.0.0.1:${PORT}`;

const EMPTY_DB = { users: [], sessions: [], transactions: [], tasks: [], inbox: [], daily: [], investments: [], accounts: [], budgets: [], projects: [], timeEntries: [], habits: [], habitLogs: [], subscriptions: [], debts: [], footballTeams: [], matches: [], news: [], movies: [] };

let pass = 0, fail = 0;
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
  let dt = new Date(today() + 'T12:00:00Z');
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}
function startFixtureFeedServer(xml) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/xml' }); res.end(xml); });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
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
      ['PATCH', '/api/me'], ['GET', '/api/integrations'],
      ['POST', '/api/integrations/spotify/disconnect'], ['POST', '/api/integrations/youtube/disconnect'],
      ['GET', '/api/integrations/spotify/connect'], ['GET', '/api/integrations/youtube/connect'],
      ['GET', '/api/integrations/spotify/recent'], ['GET', '/api/integrations/youtube/playlists'],
      ['GET', '/api/integrations/youtube/playlist-items?playlistId=x'],
      ['POST', '/api/media-log'], ['GET', '/api/media-log'],
      ['POST', '/api/ai/chat'], ['GET', '/api/ai/report'],
      ['GET', '/api/ai/correlations'], ['GET', '/api/ai/tomorrow-priorities'],
      ['POST', '/api/ai/suggest-category'],
      ['POST', '/api/transactions/recategorize'],
      ['GET', '/api/football/remote/fixtures'], ['GET', '/api/football/remote/odds?fixture=1'],
      ['GET', '/api/football/remote/1xbet/sports'], ['GET', '/api/football/remote/1xbet/leagues?sportId=1'],
      ['GET', '/api/football/remote/1xbet/matches?sportId=1&leagueId=1'], ['GET', '/api/football/remote/1xbet/odds?matchId=1'],
      ['GET', '/api/football/remote/sofascore/event?eventId=1'], ['GET', '/api/football/remote/sofascore/event/stats?eventId=1'],
      ['GET', '/api/football/remote/sofascore/event/incidents?eventId=1'],
      ['GET', '/api/portfolio'], ['GET', '/api/portfolio/history'], ['POST', '/api/investments/tx'],
      ['GET', '/api/investments/tx'], ['PATCH', '/api/investments/tx/x'], ['DELETE', '/api/investments/tx/x'],
      ['POST', '/api/investments/price'], ['POST', '/api/investments/price/refresh'],
      ['GET', '/api/investments/alerts'], ['POST', '/api/investments/alerts'], ['DELETE', '/api/investments/alerts/x'],
      ['GET', '/api/news/x/related'], ['POST', '/api/news/x/summarize'], ['POST', '/api/news/x/translate'],
      ['GET', '/api/news/sources'], ['POST', '/api/news/sources'], ['PATCH', '/api/news/sources/x'], ['DELETE', '/api/news/sources/x'],
      ['POST', '/api/news/sync'], ['GET', '/api/news/weekly-summary'], ['DELETE', '/api/news/x'],
      ['GET', '/api/contacts'], ['POST', '/api/contacts'], ['PATCH', '/api/contacts/x'], ['DELETE', '/api/contacts/x'],
      ['POST', '/api/contacts/x/log'], ['GET', '/api/contacts/x/log'],
      ['GET', '/api/learning'], ['POST', '/api/learning'], ['PATCH', '/api/learning/x'], ['DELETE', '/api/learning/x'],
      ['GET', '/api/bookmarks'], ['POST', '/api/bookmarks'], ['PATCH', '/api/bookmarks/x'], ['DELETE', '/api/bookmarks/x'],
      ['GET', '/api/shopping'], ['POST', '/api/shopping'], ['POST', '/api/shopping/x/buy'], ['PATCH', '/api/shopping/x'], ['DELETE', '/api/shopping/x'],
      ['GET', '/api/trips'], ['POST', '/api/trips'], ['PATCH', '/api/trips/x'], ['DELETE', '/api/trips/x'],
      ['GET', '/api/trips/x/checklist'], ['POST', '/api/trips/x/checklist'], ['PATCH', '/api/trips/x/checklist/y'], ['DELETE', '/api/trips/x/checklist/y'],
      ['GET', '/api/documents'], ['POST', '/api/documents'], ['POST', '/api/documents/x/attach'], ['PATCH', '/api/documents/x'], ['DELETE', '/api/documents/x'],
      ['GET', '/api/goals'], ['POST', '/api/goals'], ['PATCH', '/api/goals/x'], ['DELETE', '/api/goals/x'],
      ['GET', '/api/wins'], ['POST', '/api/wins'], ['DELETE', '/api/wins/x'],
      ['GET', '/api/decisions'], ['POST', '/api/decisions'], ['PATCH', '/api/decisions/x'], ['DELETE', '/api/decisions/x'],
      ['GET', '/api/life-review'], ['PUT', '/api/life-review'], ['GET', '/api/one-year-ago'],
      ['GET', '/api/movies/tmdb/search'], ['POST', '/api/movies/from-tmdb'],
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
    // /uploads/* is private on purpose (same guard in server.js and the Worker):
    // anonymous fetch must 401, and an authenticated fetch — like a browser <img>
    // tag, which always sends same-origin cookies — must serve the image bytes.
    const receiptAnon = await fetch(`${BASE}${receiptSave.receipt}`);
    check('private uploads reject anonymous fetch -> 401 (receipts are per-user)', receiptAnon.status === 401);
    const receiptServed = await fetch(`${BASE}${receiptSave.receipt}`, { headers: { Cookie: cookie } });
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

    console.log('\n[23] football prediction accuracy');
    const correctMatch = await fetch(`${BASE}/api/football/matches`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ home: 'Real Madrid', away: 'Barcelona', league: 'LaLiga', date: today(), predictionOutcome: 'home' }) }).then(r => r.json());
    const wrongMatch = await fetch(`${BASE}/api/football/matches`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ home: 'City', away: 'Liverpool', league: 'EPL', date: today(), predictionOutcome: 'away' }) }).then(r => r.json());
    const finishCorrect = await fetch(`${BASE}/api/football/matches/${correctMatch.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'finished', homeScore: 2, awayScore: 1 }) }).then(r => r.json());
    check('finishing a match computes outcome from scores', finishCorrect.outcome === 'home');
    check('correct prediction is flagged true', finishCorrect.predictionCorrect === true);
    const finishWrong = await fetch(`${BASE}/api/football/matches/${wrongMatch.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'finished', homeScore: 1, awayScore: 1 }) }).then(r => r.json());
    check('wrong prediction (draw vs predicted away) is flagged false', finishWrong.outcome === 'draw' && finishWrong.predictionCorrect === false);
    const accuracy = await fetch(`${BASE}/api/football/accuracy`, { headers: authHeaders }).then(r => r.json());
    check('accuracy overall counts both finished predictions', accuracy.overall.total === 2 && accuracy.overall.correct === 1);
    check('accuracy broken down by league', accuracy.byLeague['LaLiga'].correct === 1 && accuracy.byLeague['EPL'].correct === 0);

    console.log('\n[24] pre-match reminder in insights');
    await fetch(`${BASE}/api/football/matches`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ home: 'Persepolis', away: 'Esteghlal', date: today(), time: '20:00' }) });
    const insightsWithMatch = await fetch(`${BASE}/api/insights`, { headers: authHeaders }).then(r => r.json());
    check('insights reminds about today\'s upcoming match', insightsWithMatch.items.some(i => i.text.includes('Persepolis') && i.text.includes('Esteghlal')));

    console.log('\n[25] weekly review includes football accuracy for the week');
    const weeklyWithFootball = await fetch(`${BASE}/api/weekly-review?from=${today()}&to=${today()}`, { headers: authHeaders }).then(r => r.json());
    check('weekly review football totals reflect this week\'s finished predictions', weeklyWithFootball.football.total === 2 && weeklyWithFootball.football.correct === 1);

    console.log('\n[26] movies: extended fields, stats, and calendar/dashboard surfacing');
    const movie1 = await fetch(`${BASE}/api/movies`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'Inception', type: 'movie', status: 'completed', rating: 5, genre: 'Sci-Fi', director: 'Christopher Nolan', durationMinutes: 148, platform: 'Netflix', tags: 'mind-bending, must-watch', date: today() }) }).then(r => r.json());
    check('movie keeps extended metadata fields', movie1.genre === 'Sci-Fi' && movie1.director === 'Christopher Nolan' && movie1.durationMinutes === 148);
    const movie2 = await fetch(`${BASE}/api/movies`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'Interstellar', type: 'movie', status: 'completed', rating: 4, genre: 'Sci-Fi', director: 'Christopher Nolan', durationMinutes: 169, date: today() }) }).then(r => r.json());
    const series = await fetch(`${BASE}/api/movies`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'Dark', type: 'series', status: 'watching', currentEpisode: 3, totalEpisodes: 10, date: today() }) }).then(r => r.json());
    check('series keeps episode progress fields', series.currentEpisode === 3 && series.totalEpisodes === 10);
    const movieStats = await fetch(`${BASE}/api/movies/stats`, { headers: authHeaders }).then(r => r.json());
    check('movie stats sums total watched minutes', movieStats.totalMinutes === 148 + 169);
    check('movie stats picks the most common genre', movieStats.topGenre === 'Sci-Fi');
    check('movie stats picks the most common director', movieStats.topDirector === 'Christopher Nolan');
    check('movie stats averages rating across completed items', movieStats.avgRating === 4.5);
    const daysWithMovies = await fetch(`${BASE}/api/days?from=${today()}&to=${today()}`, { headers: authHeaders }).then(r => r.json());
    check('a day with a completed movie shows up on the calendar', daysWithMovies.dates.includes(today()));
    const dashboardWithMovies = await fetch(`${BASE}/api/dashboard?date=${today()}`, { headers: authHeaders }).then(r => r.json());
    check('dashboard surfaces today\'s watched movies', dashboardWithMovies.moviesWatched.some(m => m.id === movie1.id) && dashboardWithMovies.moviesWatched.some(m => m.id === movie2.id));
    check('dashboard does not include the still-watching series as watched', !dashboardWithMovies.moviesWatched.some(m => m.id === series.id));

    console.log('\n[27] service connections: telegram link + spotify/youtube integration surface');
    const integrationsBefore = await fetch(`${BASE}/api/integrations`, { headers: authHeaders }).then(r => r.json());
    check('telegram starts unlinked', integrationsBefore.telegram.connected === false);
    check('spotify starts unconnected', integrationsBefore.spotify.connected === false);
    check('youtube starts unconnected', integrationsBefore.youtube.connected === false);
    check('spotify/youtube report unconfigured with no credentials in test env', integrationsBefore.spotify.configured === false && integrationsBefore.youtube.configured === false);

    const linkTg = await fetch(`${BASE}/api/me`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ telegramUserId: '987654321' }) });
    check('link telegram user id -> 200', linkTg.status === 200);
    const meAfterLink = await fetch(`${BASE}/api/me`, { headers: authHeaders }).then(r => r.json());
    check('telegramUserId round-trips on /api/me', meAfterLink.user.telegramUserId === '987654321');
    const integrationsAfterLink = await fetch(`${BASE}/api/integrations`, { headers: authHeaders }).then(r => r.json());
    check('telegram shows connected after linking', integrationsAfterLink.telegram.connected === true && integrationsAfterLink.telegram.userId === '987654321');

    const unlinkTg = await fetch(`${BASE}/api/me`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ telegramUserId: null }) });
    check('unlink telegram user id -> 200', unlinkTg.status === 200);
    const meAfterUnlink = await fetch(`${BASE}/api/me`, { headers: authHeaders }).then(r => r.json());
    check('telegramUserId clears on /api/me', meAfterUnlink.user.telegramUserId === null);

    const spotifyConnectNotConfigured = await fetch(`${BASE}/api/integrations/spotify/connect`, { headers: authHeaders, redirect: 'manual' });
    check('spotify connect -> 503 when server has no credentials', spotifyConnectNotConfigured.status === 503);
    const youtubeConnectNotConfigured = await fetch(`${BASE}/api/integrations/youtube/connect`, { headers: authHeaders, redirect: 'manual' });
    check('youtube connect -> 503 when server has no credentials', youtubeConnectNotConfigured.status === 503);
    const spotifyRecentNotConnected = await fetch(`${BASE}/api/integrations/spotify/recent`, { headers: authHeaders });
    check('spotify recent -> 400 when not connected', spotifyRecentNotConnected.status === 400);
    const youtubePlaylistsNotConnected = await fetch(`${BASE}/api/integrations/youtube/playlists`, { headers: authHeaders });
    check('youtube playlists -> 400 when not connected', youtubePlaylistsNotConnected.status === 400);

    const spotifyDisconnectNoop = await fetch(`${BASE}/api/integrations/spotify/disconnect`, { method: 'POST', headers: authHeaders });
    check('spotify disconnect is a safe no-op when never connected', spotifyDisconnectNoop.status === 200);
    const youtubeDisconnectNoop = await fetch(`${BASE}/api/integrations/youtube/disconnect`, { method: 'POST', headers: authHeaders });
    check('youtube disconnect is a safe no-op when never connected', youtubeDisconnectNoop.status === 200);

    console.log('\n[28] media activity log (manual save, backs the future Spotify/YouTube "save to today" action)');
    const mediaSave = await fetch(`${BASE}/api/media-log`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ source: 'spotify', title: 'Test Track', meta: 'Test Artist', date: today() }) });
    check('save media log entry -> 201', mediaSave.status === 201);
    const mediaList = await fetch(`${BASE}/api/media-log?date=${today()}`, { headers: authHeaders }).then(r => r.json());
    check('media log entry shows up for today', mediaList.items.some(i => i.title === 'Test Track' && i.source === 'spotify'));
    const mediaMissingFields = await fetch(`${BASE}/api/media-log`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ source: 'spotify' }) });
    check('media log requires a title -> 400', mediaMissingFields.status === 400);

    console.log('\n[29] telegram free-text parsing reused from /api/ai/process (same parser the bot uses)');
    const tgLikeProcess = await fetch(`${BASE}/api/ai/process`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ text: 'امروز ۲ ساعت کار کردم و ۵۰۰۰۰ تومان ناهار خرج کردم' }) });
    check('shared free-text parser still parses time + spend (Telegram bot depends on this)', tgLikeProcess.status === 200);

    console.log('\n[30] AI features: deterministic parts work with no AI key configured, AI-gated parts fail gracefully');
    const catFood = await fetch(`${BASE}/api/ai/suggest-category`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'ناهار رستوران' }) }).then(r => r.json());
    check('keyword category suggestion recognizes food words', catFood.category === 'خوراک' && catFood.source === 'keyword');
    const catEmpty = await fetch(`${BASE}/api/ai/suggest-category`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: '' }) });
    check('category suggestion requires a title -> 400', catEmpty.status === 400);
    const catUnknown = await fetch(`${BASE}/api/ai/suggest-category`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'xyzzy plugh قفلمهر' }) }).then(r => r.json());
    check('unmatched title falls back to متفرقه with no AI key configured', catUnknown.category === 'متفرقه' && catUnknown.source === 'default');

    for (let i = 0; i <= 3; i++) {
      await fetch(`${BASE}/api/daily`, { method: 'PUT', headers: authHeaders, body: JSON.stringify({ date: daysAgo(i), mood: 4 + i, energy: 5, sleep: `${4 + i} ساعت` }) });
    }
    const correlations = await fetch(`${BASE}/api/ai/correlations?days=30`, { headers: authHeaders }).then(r => r.json());
    const sleepMood = correlations.correlations.find(c => c.pair === 'sleep_mood');
    check('correlation endpoint returns a strong positive sleep/mood link for perfectly linear test data', sleepMood && Math.abs(sleepMood.r - 1) < 0.05 && sleepMood.direction === 'مثبت' && sleepMood.strength === 'قوی');
    check('correlation sample size reflects the 4 seeded days', correlations.sampleSize === 4);

    const overdueTaskAi = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'تسک عقب‌افتاده برای تست', deadline: daysAgo(1) }) }).then(r => r.json());
    const tomorrowDate = daysAgo(-1);
    const dueTomorrowTask = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'تسک فردا برای تست', deadline: tomorrowDate }) }).then(r => r.json());
    const habitForTomorrow = await fetch(`${BASE}/api/habits`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'عادت تست فردا' }) }).then(r => r.json());
    const tomorrowPriorities = await fetch(`${BASE}/api/ai/tomorrow-priorities`, { headers: authHeaders }).then(r => r.json());
    check('tomorrow-priorities lists the overdue task', tomorrowPriorities.overdueTasks.some(t => t.id === overdueTaskAi.id));
    check('tomorrow-priorities lists the task due tomorrow', tomorrowPriorities.dueTomorrowTasks.some(t => t.id === dueTomorrowTask.id));
    check('tomorrow-priorities lists the not-yet-done-today habit', tomorrowPriorities.pendingHabits.some(h => h.id === habitForTomorrow.id));
    check('tomorrow-priorities narrative is null with no AI key configured (structured list still works)', tomorrowPriorities.narrative === null);

    const aiChatNoKey = await fetch(`${BASE}/api/ai/chat`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ message: 'سلام' }) });
    check('AI chat -> 503 with no AI_PROVIDER_API_KEY configured (not a crash)', aiChatNoKey.status === 503);
    const aiReportNoKey = await fetch(`${BASE}/api/ai/report?period=daily`, { headers: authHeaders });
    check('AI report -> 503 with no AI_PROVIDER_API_KEY configured (not a crash)', aiReportNoKey.status === 503);

    console.log('\n[31] football data sources: RapidAPI-backed routes (API-FOOTBALL fallback, 1xbet-api, sportapi7) degrade gracefully with no key');
    const fixturesNoKey = await fetch(`${BASE}/api/football/remote/fixtures`, { headers: authHeaders });
    check('fixtures -> 503 with neither API_FOOTBALL_KEY nor RAPIDAPI_KEY configured', fixturesNoKey.status === 503);
    const oddsNoFixture = await fetch(`${BASE}/api/football/remote/odds`, { headers: authHeaders });
    check('odds requires a fixture id -> 400', oddsNoFixture.status === 400);
    const oddsNoKey = await fetch(`${BASE}/api/football/remote/odds?fixture=1`, { headers: authHeaders });
    check('odds -> 503 with no key configured', oddsNoKey.status === 503);
    const xbetSportsNoKey = await fetch(`${BASE}/api/football/remote/1xbet/sports`, { headers: authHeaders });
    check('1xbet sports -> 503 with no RAPIDAPI_KEY configured', xbetSportsNoKey.status === 503);
    const xbetLeaguesNoId = await fetch(`${BASE}/api/football/remote/1xbet/leagues`, { headers: authHeaders });
    check('1xbet leagues requires sportId -> 400', xbetLeaguesNoId.status === 400);
    const xbetMatchesNoId = await fetch(`${BASE}/api/football/remote/1xbet/matches?sportId=1`, { headers: authHeaders });
    check('1xbet matches requires leagueId -> 400', xbetMatchesNoId.status === 400);
    const xbetOddsNoId = await fetch(`${BASE}/api/football/remote/1xbet/odds`, { headers: authHeaders });
    check('1xbet odds requires matchId -> 400', xbetOddsNoId.status === 400);
    const sofaEventNoId = await fetch(`${BASE}/api/football/remote/sofascore/event`, { headers: authHeaders });
    check('sofascore event requires eventId -> 400', sofaEventNoId.status === 400);
    const sofaEventNoKey = await fetch(`${BASE}/api/football/remote/sofascore/event?eventId=1`, { headers: authHeaders });
    check('sofascore event -> 503 with no RAPIDAPI_KEY configured', sofaEventNoKey.status === 503);

    console.log('\n[32] portfolio rebuild: transaction-based holdings, weighted-average cost, alerts, history');
    await fetch(`${BASE}/api/portfolio`, { headers: authHeaders }); // simulate opening the portfolio before any holdings exist (regression: this used to permanently freeze today's snapshot at empty)
    const buyNoQty = await fetch(`${BASE}/api/investments/tx`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'BTC', type: 'buy', price: 100 }) });
    check('buy without quantity -> 400', buyNoQty.status === 400);
    const dividendNoAmount = await fetch(`${BASE}/api/investments/tx`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'BTC', type: 'dividend' }) });
    check('dividend without amount -> 400', dividendNoAmount.status === 400);

    const buy1 = await fetch(`${BASE}/api/investments/tx`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'btc', assetType: 'crypto', type: 'buy', quantity: 1, price: 100, fee: 10, date: today() }) }).then(r => r.json());
    check('symbol is normalized to uppercase', buy1.symbol === 'BTC');
    let portfolio = await fetch(`${BASE}/api/portfolio`, { headers: authHeaders }).then(r => r.json());
    let btc = portfolio.items.find(x => x.symbol === 'BTC');
    check('first buy seeds the current price at the buy price', btc.currentPrice === 100);
    check('first buy sets average cost including the fee', Math.abs(btc.avgCost - 110) < 1e-9);

    await fetch(`${BASE}/api/investments/tx`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'BTC', assetType: 'crypto', type: 'buy', quantity: 1, price: 130, date: today() }) });
    portfolio = await fetch(`${BASE}/api/portfolio`, { headers: authHeaders }).then(r => r.json());
    btc = portfolio.items.find(x => x.symbol === 'BTC');
    check('second buy recomputes a correct weighted-average cost', Math.abs(btc.avgCost - 120) < 1e-9);
    check('quantity accumulates across buys', btc.quantity === 2);

    const sell1 = await fetch(`${BASE}/api/investments/tx`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'BTC', assetType: 'crypto', type: 'sell', quantity: 1, price: 150, fee: 5, date: today() }) }).then(r => r.json());
    portfolio = await fetch(`${BASE}/api/portfolio`, { headers: authHeaders }).then(r => r.json());
    btc = portfolio.items.find(x => x.symbol === 'BTC');
    check('sell reduces quantity but leaves average cost untouched', btc.quantity === 1 && Math.abs(btc.avgCost - 120) < 1e-9);
    check('sell realizes P&L at (sell price - avg cost) * qty - fee', Math.abs(btc.realizedPnl - 25) < 1e-9);

    await fetch(`${BASE}/api/investments/tx`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'BTC', assetType: 'crypto', type: 'dividend', amount: 50, date: today() }) });
    const feeTx = await fetch(`${BASE}/api/investments/tx`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'BTC', assetType: 'crypto', type: 'fee', amount: 15, date: today() }) }).then(r => r.json());
    portfolio = await fetch(`${BASE}/api/portfolio`, { headers: authHeaders }).then(r => r.json());
    btc = portfolio.items.find(x => x.symbol === 'BTC');
    check('standalone dividend and fee transactions are tracked separately from trades', btc.dividends === 50 && btc.fees === 15);

    const txList = await fetch(`${BASE}/api/investments/tx?symbol=BTC`, { headers: authHeaders }).then(r => r.json());
    check('transaction list returns all 5 BTC transactions', txList.items.length === 5);

    const editFee = await fetch(`${BASE}/api/investments/tx/${feeTx.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ amount: 20 }) });
    check('editing a transaction -> 200', editFee.status === 200);
    portfolio = await fetch(`${BASE}/api/portfolio`, { headers: authHeaders }).then(r => r.json());
    btc = portfolio.items.find(x => x.symbol === 'BTC');
    check('holdings recompute after editing a transaction', btc.fees === 20);

    const manualPrice = await fetch(`${BASE}/api/investments/price`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'BTC', assetType: 'crypto', price: 200 }) });
    check('manual price override -> 200', manualPrice.status === 200);
    portfolio = await fetch(`${BASE}/api/portfolio`, { headers: authHeaders }).then(r => r.json());
    btc = portfolio.items.find(x => x.symbol === 'BTC');
    check('manual price override changes current price and market value', btc.currentPrice === 200 && btc.marketValue === 200);
    check('portfolio totals are grouped by currency, not force-merged', portfolio.totals.USD && portfolio.totals.USD.value === 200);

    const refreshUnknownCrypto = await fetch(`${BASE}/api/investments/price/refresh`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'NOTACOIN', assetType: 'crypto' }) });
    check('refreshing an unsupported crypto symbol -> 503 (no network call made)', refreshUnknownCrypto.status === 503);
    const refreshStockNoKey = await fetch(`${BASE}/api/investments/price/refresh`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'AAPL', assetType: 'stock' }) });
    check('refreshing a stock -> 503 with no STOCK_API_KEY configured (no network call made)', refreshStockNoKey.status === 503);

    const alertNoValue = await fetch(`${BASE}/api/investments/alerts`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'BTC', condition: 'price_above' }) });
    check('alert without a value -> 400', alertNoValue.status === 400);
    const alert = await fetch(`${BASE}/api/investments/alerts`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ symbol: 'BTC', condition: 'price_above', value: 150 }) }).then(r => r.json());
    const insightsWithAlert = await fetch(`${BASE}/api/insights`, { headers: authHeaders }).then(r => r.json());
    check('a met price alert shows up in insights', insightsWithAlert.items.some(i => i.text.includes('BTC') && i.text.includes('۱۵۰')));
    const deleteAlert = await fetch(`${BASE}/api/investments/alerts/${alert.id}`, { method: 'DELETE', headers: authHeaders });
    check('delete alert -> 200', deleteAlert.status === 200);

    const deleteDividend = await fetch(`${BASE}/api/investments/tx?symbol=BTC`, { headers: authHeaders }).then(r => r.json()).then(x => x.items.find(t => t.type === 'dividend'));
    await fetch(`${BASE}/api/investments/tx/${deleteDividend.id}`, { method: 'DELETE', headers: authHeaders });
    portfolio = await fetch(`${BASE}/api/portfolio`, { headers: authHeaders }).then(r => r.json());
    btc = portfolio.items.find(x => x.symbol === 'BTC');
    check('deleting a transaction recomputes holdings', btc.dividends === 0);

    const history = await fetch(`${BASE}/api/portfolio/history?days=30`, { headers: authHeaders }).then(r => r.json());
    check('portfolio GET creates a snapshot for today', history.items.some(s => s.date === today() && s.totals.USD));
    check("today's snapshot keeps updating as holdings change, not frozen at the first (empty) call", history.items.filter(s => s.date === today()).length === 1 && history.items.find(s => s.date === today()).totals.USD.value === btc.marketValue);

    console.log('\n[33] news: RSS sources, real feed parsing against a local fixture, filters, related, weekly summary');
    const sourceNoUrl = await fetch(`${BASE}/api/news/sources`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'بی‌بی‌سی' }) });
    check('news source requires a url -> 400', sourceNoUrl.status === 400);

    const fixtureRss = `<?xml version="1.0" encoding="UTF-8"?><rss><channel>
      <item><title>خبر تست یک</title><link>https://example.com/1</link><description>این یک توضیح نسبتاً طولانی برای خبر تست شماره یک است که برای بررسی رفتار خلاصه‌سازی و ذخیره‌سازی صحیح متن خبر در سیستم نوشته شده و باید حداقل چند صد کاراکتر داشته باشد تا آزمون خلاصه‌سازی هوشمند هم قابل بررسی باشد و به اندازهٔ کافی طولانی به نظر برسد برای این تست خودکار.</description><guid>fixture-guid-1</guid><pubDate>Tue, 01 Sep 2026 08:00:00 GMT</pubDate></item>
      <item><title>خبر تست دو دربارهٔ تست یک</title><link>https://example.com/2</link><description>توضیح کوتاه خبر دو.</description><guid>fixture-guid-2</guid></item>
    </channel></rss>`;
    const fixture = await startFixtureFeedServer(fixtureRss);
    try {
      const source = await fetch(`${BASE}/api/news/sources`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'فید تست', url: `http://127.0.0.1:${fixture.port}/feed.xml`, category: 'تکنولوژی' }) }).then(r => r.json());
      const sync1 = await fetch(`${BASE}/api/news/sync`, { method: 'POST', headers: authHeaders }).then(r => r.json());
      check('sync against a real (local fixture) feed parses both RSS items', sync1.added === 2);
      check('sync records a per-source success result', sync1.results[0].ok === true && sync1.results[0].found === 2);

      const newsItems = await fetch(`${BASE}/api/news?category=تکنولوژی`, { headers: authHeaders }).then(r => r.json());
      const item1 = newsItems.items.find(x => x.guid === 'fixture-guid-1');
      const item2 = newsItems.items.find(x => x.guid === 'fixture-guid-2');
      check('RSS item title/link/guid parsed correctly', item1 && item1.title === 'خبر تست یک' && item1.url === 'https://example.com/1');
      check('RSS item is tagged with the source name and its configured category', item1.source === 'فید تست' && item1.category === 'تکنولوژی');

      const sync2 = await fetch(`${BASE}/api/news/sync`, { method: 'POST', headers: authHeaders }).then(r => r.json());
      check('re-syncing the same feed does not duplicate items (dedup by guid)', sync2.added === 0);

      const bySource = await fetch(`${BASE}/api/news?source=${encodeURIComponent('فید تست')}`, { headers: authHeaders }).then(r => r.json());
      check('filtering news by source works', bySource.items.length === 2);

      const related = await fetch(`${BASE}/api/news/${item1.id}/related`, { headers: authHeaders }).then(r => r.json());
      check('related news finds the other item via shared category + title word overlap', related.items.some(x => x.id === item2.id));

      const summarizeShort = await fetch(`${BASE}/api/news/${item2.id}/summarize`, { method: 'POST', headers: authHeaders });
      check('summarizing -> 503 with no AI key configured, checked before the length validation (not a crash)', summarizeShort.status === 503);
      const summarizeLong = await fetch(`${BASE}/api/news/${item1.id}/summarize`, { method: 'POST', headers: authHeaders });
      check('summarizing a long item -> 503 with no AI key configured (not a crash)', summarizeLong.status === 503);
      const translate = await fetch(`${BASE}/api/news/${item1.id}/translate`, { method: 'POST', headers: authHeaders });
      check('translate -> 503 with no AI key configured (not a crash)', translate.status === 503);

      const savedFilter = await fetch(`${BASE}/api/news?saved=true`, { headers: authHeaders }).then(r => r.json());
      check('saved=true filter excludes freshly-synced (unsaved) items', !savedFilter.items.some(x => x.id === item1.id));
      const markSaved = await fetch(`${BASE}/api/news/${item1.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ saved: true }) });
      check('marking a news item saved -> 200', markSaved.status === 200);
      const savedFilter2 = await fetch(`${BASE}/api/news?saved=true`, { headers: authHeaders }).then(r => r.json());
      check('saved=true filter includes it after marking saved', savedFilter2.items.some(x => x.id === item1.id));

      const weekly = await fetch(`${BASE}/api/news/weekly-summary`, { headers: authHeaders }).then(r => r.json());
      check('weekly summary counts synced items and buckets by category/source', weekly.stats.total >= 2 && weekly.stats.byCategory['تکنولوژی'] >= 2 && weekly.stats.bySource['فید تست'] >= 2);
      check('weekly summary narrative is null with no AI key configured', weekly.narrative === null);

      const deleteNews = await fetch(`${BASE}/api/news/${item2.id}`, { method: 'DELETE', headers: authHeaders });
      check('delete a news item -> 200', deleteNews.status === 200);

      const deleteSource = await fetch(`${BASE}/api/news/sources/${source.id}`, { method: 'DELETE', headers: authHeaders });
      check('delete a news source -> 200', deleteSource.status === 200);
      const sourcesAfterDelete = await fetch(`${BASE}/api/news/sources`, { headers: authHeaders }).then(r => r.json());
      check('deleted source no longer listed', !sourcesAfterDelete.items.some(x => x.id === source.id));
    } finally {
      fixture.server.close();
    }

    const syncNoSources = await fetch(`${BASE}/api/news/sync`, { method: 'POST', headers: authHeaders }).then(r => r.json());
    check('sync with zero active sources is a safe no-op', syncNoSources.added === 0 && syncNoSources.results.length === 0);

    console.log('\n[34] contacts / relationships: CRUD, interaction log, birthday + follow-up reminders in insights');
    const contactNoName = await fetch(`${BASE}/api/contacts`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ relationship: 'friend' }) });
    check('contact requires a name -> 400', contactNoName.status === 400);
    const futureBirthday = daysAgo(-2);
    const contact = await fetch(`${BASE}/api/contacts`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'علی رضایی', relationship: 'friend', birthday: '1990-' + futureBirthday.slice(5), followUpDate: daysAgo(-1) }) }).then(r => r.json());
    const contactsList = await fetch(`${BASE}/api/contacts`, { headers: authHeaders }).then(r => r.json());
    check('contact created and listed', contactsList.items.some(c => c.id === contact.id));
    const logEntry = await fetch(`${BASE}/api/contacts/${contact.id}/log`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ type: 'call', note: 'تماس تلفنی دربارهٔ پروژه' }) }).then(r => r.json());
    const contactAfterLog = await fetch(`${BASE}/api/contacts`, { headers: authHeaders }).then(r => r.json()).then(x => x.items.find(c => c.id === contact.id));
    check('logging an interaction sets lastContactDate', contactAfterLog.lastContactDate === today());
    const logsList = await fetch(`${BASE}/api/contacts/${contact.id}/log`, { headers: authHeaders }).then(r => r.json());
    check('interaction log is retrievable', logsList.items.some(l => l.id === logEntry.id));
    const insightsWithContact = await fetch(`${BASE}/api/insights`, { headers: authHeaders }).then(r => r.json());
    check('upcoming birthday shows up in insights', insightsWithContact.items.some(i => i.text.includes('علی رضایی') && i.icon === '🎂'));
    check('follow-up reminder shows up in insights', insightsWithContact.items.some(i => i.text.includes('علی رضایی') && i.icon === '🤝'));
    const editContact = await fetch(`${BASE}/api/contacts/${contact.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ phone: '09120000000' }) });
    check('editing a contact -> 200', editContact.status === 200);
    const deleteContact = await fetch(`${BASE}/api/contacts/${contact.id}`, { method: 'DELETE', headers: authHeaders });
    check('deleting a contact -> 200', deleteContact.status === 200);
    const logsAfterDelete = await fetch(`${BASE}/api/contacts/${contact.id}/log`, { headers: authHeaders }).then(r => r.json());
    check('deleting a contact cascades its interaction logs', logsAfterDelete.items.length === 0);

    console.log('\n[35] learning tracker + bookmarks');
    const learnNoTitle = await fetch(`${BASE}/api/learning`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ type: 'book' }) });
    check('learning item requires a title -> 400', learnNoTitle.status === 400);
    const book = await fetch(`${BASE}/api/learning`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'Atomic Habits', type: 'book', progressTotal: 250 }) }).then(r => r.json());
    check('new learning item has no startedAt until in_progress', book.startedAt === null);
    const bookInProgress = await fetch(`${BASE}/api/learning/${book.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'in_progress', progressCurrent: 40 }) }).then(r => r.json());
    check('moving to in_progress sets startedAt', bookInProgress.startedAt === today());
    const bookCompleted = await fetch(`${BASE}/api/learning/${book.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'completed', progressCurrent: 250 }) }).then(r => r.json());
    check('moving to completed sets completedAt', bookCompleted.completedAt === today());
    const learningFiltered = await fetch(`${BASE}/api/learning?status=completed`, { headers: authHeaders }).then(r => r.json());
    check('filtering learning items by status works', learningFiltered.items.some(x => x.id === book.id));
    const deleteLearning = await fetch(`${BASE}/api/learning/${book.id}`, { method: 'DELETE', headers: authHeaders });
    check('deleting a learning item -> 200', deleteLearning.status === 200);

    const bookmarkNoUrl = await fetch(`${BASE}/api/bookmarks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'یک لینک' }) });
    check('bookmark requires a url -> 400', bookmarkNoUrl.status === 400);
    const bookmark = await fetch(`${BASE}/api/bookmarks`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'مقالهٔ خوب', url: 'https://example.com/article' }) }).then(r => r.json());
    check('bookmark defaults to read-later', bookmark.readLater === true);
    const readLaterFiltered = await fetch(`${BASE}/api/bookmarks?readLater=true`, { headers: authHeaders }).then(r => r.json());
    check('filtering bookmarks by readLater works', readLaterFiltered.items.some(x => x.id === bookmark.id));
    const markRead = await fetch(`${BASE}/api/bookmarks/${bookmark.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ readLater: false }) });
    check('marking a bookmark as read -> 200', markRead.status === 200);
    const deleteBookmark = await fetch(`${BASE}/api/bookmarks/${bookmark.id}`, { method: 'DELETE', headers: authHeaders });
    check('deleting a bookmark -> 200', deleteBookmark.status === 200);

    console.log('\n[36] shopping list -> transaction conversion, trips + checklist + linked spend, documents + expiry reminder');
    const shopNoTitle = await fetch(`${BASE}/api/shopping`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ quantity: 2 }) });
    check('shopping item requires a title -> 400', shopNoTitle.status === 400);
    const shopItem = await fetch(`${BASE}/api/shopping`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'کفش دویدن', category: 'پوشاک' }) }).then(r => r.json());
    const buyNoPrice = await fetch(`${BASE}/api/shopping/${shopItem.id}/buy`, { method: 'POST', headers: authHeaders, body: JSON.stringify({}) });
    check('buying without a price -> 400', buyNoPrice.status === 400);
    const buyResult = await fetch(`${BASE}/api/shopping/${shopItem.id}/buy`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ price: 850000 }) }).then(r => r.json());
    check('buying a shopping item creates a real expense transaction', buyResult.transaction.amount === 850000 && buyResult.transaction.category === 'پوشاک');
    check('bought shopping item is marked bought with the actual price', buyResult.item.bought === true && buyResult.item.price === 850000);
    const boughtFilter = await fetch(`${BASE}/api/shopping?bought=true`, { headers: authHeaders }).then(r => r.json());
    check('filtering shopping list by bought works', boughtFilter.items.some(x => x.id === shopItem.id));

    const tripNoDestination = await fetch(`${BASE}/api/trips`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ budget: 1000 }) });
    check('trip requires a destination -> 400', tripNoDestination.status === 400);
    const trip = await fetch(`${BASE}/api/trips`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ destination: 'استانبول', startDate: today(), budget: 5000000 }) }).then(r => r.json());
    await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'بلیط پرواز', amount: 3000000, kind: 'expense', tripId: trip.id, date: today() }) });
    const tripsList = await fetch(`${BASE}/api/trips`, { headers: authHeaders }).then(r => r.json());
    check('trip spend is computed from transactions tagged with its tripId', tripsList.items.find(t => t.id === trip.id).spent === 3000000);
    const checklistItem = await fetch(`${BASE}/api/trips/${trip.id}/checklist`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ text: 'گرفتن ویزا' }) }).then(r => r.json());
    const checklistList = await fetch(`${BASE}/api/trips/${trip.id}/checklist`, { headers: authHeaders }).then(r => r.json());
    check('trip checklist item created and listed', checklistList.items.some(x => x.id === checklistItem.id));
    const checkOffItem = await fetch(`${BASE}/api/trips/${trip.id}/checklist/${checklistItem.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ done: true }) });
    check('checking off a checklist item -> 200', checkOffItem.status === 200);
    const deleteTrip = await fetch(`${BASE}/api/trips/${trip.id}`, { method: 'DELETE', headers: authHeaders });
    check('deleting a trip -> 200', deleteTrip.status === 200);
    const checklistAfterTripDelete = await fetch(`${BASE}/api/trips/${trip.id}/checklist`, { headers: authHeaders }).then(r => r.json());
    check('deleting a trip cascades its checklist', checklistAfterTripDelete.items.length === 0);

    const docNoTitle = await fetch(`${BASE}/api/documents`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ type: 'warranty' }) });
    check('document requires a title -> 400', docNoTitle.status === 400);
    const doc = await fetch(`${BASE}/api/documents`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'گارانتی یخچال', type: 'warranty', expiryDate: daysAgo(-2) }) }).then(r => r.json());
    const tinyPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const attachDoc = await fetch(`${BASE}/api/documents/${doc.id}/attach`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ image: 'data:image/png;base64,' + tinyPngB64 }) }).then(r => r.json());
    check('attaching a file to a document sets fileUrl', attachDoc.fileUrl && attachDoc.fileUrl.startsWith('/uploads/'));
    const insightsWithDoc = await fetch(`${BASE}/api/insights`, { headers: authHeaders }).then(r => r.json());
    check('soon-to-expire document shows up in insights', insightsWithDoc.items.some(i => i.icon === '📄'));
    const deleteDoc = await fetch(`${BASE}/api/documents/${doc.id}`, { method: 'DELETE', headers: authHeaders });
    check('deleting a document -> 200', deleteDoc.status === 200);

    console.log('\n[37] goals linked to real data, wins, decision journal, life review, one-year-ago');
    const habitForGoal = await fetch(`${BASE}/api/habits`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'عادت هدف‌دار' }) }).then(r => r.json());
    await fetch(`${BASE}/api/habits/${habitForGoal.id}/toggle`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ date: today() }) });
    const monthKey = today().slice(0, 7);
    const goalNoPeriodKey = await fetch(`${BASE}/api/goals`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'بدون بازه' }) });
    check('goal requires a periodKey -> 400', goalNoPeriodKey.status === 400);
    const habitGoal = await fetch(`${BASE}/api/goals`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'انجام عادت ۲۰ روز', period: 'monthly', periodKey: monthKey, linkedType: 'habit', linkedId: habitForGoal.id, targetValue: 20 }) }).then(r => r.json());
    const goalsList = await fetch(`${BASE}/api/goals?period=monthly`, { headers: authHeaders }).then(r => r.json());
    check('goal linked to a habit computes currentValue from real habit logs', goalsList.items.find(g => g.id === habitGoal.id).currentValue === 1);
    const editGoal = await fetch(`${BASE}/api/goals/${habitGoal.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'done' }) });
    check('editing a goal -> 200', editGoal.status === 200);
    const deleteGoal = await fetch(`${BASE}/api/goals/${habitGoal.id}`, { method: 'DELETE', headers: authHeaders });
    check('deleting a goal -> 200', deleteGoal.status === 200);

    const winNoText = await fetch(`${BASE}/api/wins`, { method: 'POST', headers: authHeaders, body: JSON.stringify({}) });
    check('win requires text -> 400', winNoText.status === 400);
    const win = await fetch(`${BASE}/api/wins`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ text: 'اولین قرارداد مشتری جدید را بستم' }) }).then(r => r.json());
    const winsList = await fetch(`${BASE}/api/wins`, { headers: authHeaders }).then(r => r.json());
    check('win created and listed', winsList.items.some(w => w.id === win.id));

    const decisionNoTitle = await fetch(`${BASE}/api/decisions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({}) });
    check('decision requires a title -> 400', decisionNoTitle.status === 400);
    const decision = await fetch(`${BASE}/api/decisions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'تغییر شغل؟', options: 'ماندن / رفتن', reasoning: 'رشد بیشتر' }) }).then(r => r.json());
    const decisionWithOutcome = await fetch(`${BASE}/api/decisions/${decision.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ outcome: 'رفتم و راضی بودم' }) }).then(r => r.json());
    check('recording a decision outcome later works', decisionWithOutcome.outcome === 'رفتم و راضی بودم');
    const deleteDecision = await fetch(`${BASE}/api/decisions/${decision.id}`, { method: 'DELETE', headers: authHeaders });
    check('deleting a decision -> 200', deleteDecision.status === 200);

    const lifeReviewGet = await fetch(`${BASE}/api/life-review?period=monthly&key=${monthKey}`, { headers: authHeaders }).then(r => r.json());
    check('life review stats are computed deterministically (winsCount includes the win above)', lifeReviewGet.stats.winsCount >= 1);
    check('life review narrative is null with no AI key configured', lifeReviewGet.narrative === null);
    const saveReflection = await fetch(`${BASE}/api/life-review`, { method: 'PUT', headers: authHeaders, body: JSON.stringify({ period: 'monthly', periodKey: monthKey, reflection: 'ماه پرکاری بود.' }) });
    check('saving a reflection -> 200', saveReflection.status === 200);
    const lifeReviewGet2 = await fetch(`${BASE}/api/life-review?period=monthly&key=${monthKey}`, { headers: authHeaders }).then(r => r.json());
    check('saved reflection round-trips back', lifeReviewGet2.reflection === 'ماه پرکاری بود.');

    const oneYearAgoDate = (() => { const dt = new Date(); dt.setFullYear(dt.getFullYear() - 1); return dt.toISOString().slice(0, 10); })();
    await fetch(`${BASE}/api/daily`, { method: 'PUT', headers: authHeaders, body: JSON.stringify({ date: oneYearAgoDate, mood: 9, note: 'روز خیلی خوبی بود' }) });
    const oneYearAgo = await fetch(`${BASE}/api/one-year-ago`, { headers: authHeaders }).then(r => r.json());
    check('one-year-ago pulls the real daily journal entry from exactly a year back', oneYearAgo.date === oneYearAgoDate && oneYearAgo.daily && oneYearAgo.daily.note === 'روز خیلی خوبی بود');
    check('one-year-ago flags that there is something to show', oneYearAgo.hasAnything === true);

    console.log('\n[38] TMDB integration: validation only (a real key may be present in .env, so no live network calls here - see manual QA for the real search/import flow)');
    const tmdbSearchNoQuery = await fetch(`${BASE}/api/movies/tmdb/search`, { headers: authHeaders });
    check('TMDB search requires a query -> 400 before any network call', tmdbSearchNoQuery.status === 400);
    const tmdbImportNoId = await fetch(`${BASE}/api/movies/from-tmdb`, { method: 'POST', headers: authHeaders, body: JSON.stringify({}) });
    check('TMDB import requires tmdbId + mediaType -> 400 before any network call', tmdbImportNoId.status === 400);

    console.log('\n[39] weather city selection: per-user save, round-trip, validation');
    const cityPatch = await fetch(`${BASE}/api/me`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ weather: { name: 'شیراز', lat: 29.5918, lon: 52.5838 } }) });
    check('PATCH /api/me accepts a valid city -> 200', cityPatch.status === 200);
    const meWithCity = await fetch(`${BASE}/api/me`, { headers: authHeaders }).then(r => r.json());
    check('city round-trips on the user profile', !!(meWithCity.user && meWithCity.user.weather) && meWithCity.user.weather.name === 'شیراز' && Math.abs(meWithCity.user.weather.lat - 29.5918) < 0.001);
    const badCity = await fetch(`${BASE}/api/me`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ weather: { name: 'هیچاکجا', lat: 999, lon: 0 } }) });
    check('invalid latitude is rejected -> 400', badCity.status === 400);
    const clearCity = await fetch(`${BASE}/api/me`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ weather: null }) });
    const meNoCity = await fetch(`${BASE}/api/me`, { headers: authHeaders }).then(r => r.json());
    check('city resets to null (Tehran default)', clearCity.status === 200 && meNoCity.user.weather === null);

    console.log('\n[40] bank message parsing: copy app, rial SMS, deposit, old simple text');
    const bankAppMsg = 'مبلغ: ۱۵,۰۰۰,۰۰۰ تومان\nبابت: نظافت منزل\n۱۴۰۵.۰۶.۲۳\nموجودی: ۵۰,۰۰۰,۰۰۰ تومان';
    const bankAppRes = await fetch(`${BASE}/api/ai/process`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ text: bankAppMsg }) }).then(r => r.json());
    check('bank copy app: amount, kind, and title parsed', bankAppRes.actions.length === 1 && bankAppRes.actions[0].amount === 15000000 && bankAppRes.actions[0].title === 'نظافت منزل' && bankAppRes.actions[0].kind === 'expense');
    check('bank copy app: jalali date converts to Gregorian ISO', bankAppRes.actions.length === 1 && bankAppRes.actions[0].date === '2026-09-14');

    const bankSmsExpense = '۵۰۰,۰۰۰ ریال از حساب شما کسر شد.\nخرید فروشگاهی\nموجودی: ۲,۰۰۰,۰۰۰ ریال';
    const bankSmsExpRes = await fetch(`${BASE}/api/ai/process`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ text: bankSmsExpense }) }).then(r => r.json());
    check('bank SMS expense: rial divided by 10 to toman', bankSmsExpRes.actions.length === 1 && bankSmsExpRes.actions[0].amount === 50000 && bankSmsExpRes.actions[0].kind === 'expense');

    const bankSmsDeposit = '۱,۲۰۰,۰۰۰ ریال به حساب شما واریز شد.\nواریز حقوق';
    const bankSmsDepRes = await fetch(`${BASE}/api/ai/process`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ text: bankSmsDeposit }) }).then(r => r.json());
    check('bank SMS deposit: detects income kind and converts amount', bankSmsDepRes.actions.length === 1 && bankSmsDepRes.actions[0].amount === 120000 && bankSmsDepRes.actions[0].kind === 'income');

    const bankEngDate = 'مبلغ: ۲۵۰,۰۰۰ تومان\nبابت: کتاب\nSep 14, 2026';
    const bankEngRes = await fetch(`${BASE}/api/ai/process`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ text: bankEngDate }) }).then(r => r.json());
    check('bank message with English date parsed correctly', bankEngRes.actions.length === 1 && bankEngRes.actions[0].amount === 250000 && bankEngRes.actions[0].date === '2026-09-14');

    const simpleOldText = '۵۰ هزار ناهار';
    const simpleRes = await fetch(`${BASE}/api/ai/process`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ text: simpleOldText }) }).then(r => r.json());
    check('traditional simple text still parses correctly without bank pattern', simpleRes.actions.length === 1 && simpleRes.actions[0].amount === 50000 && simpleRes.actions[0].title.includes('ناهار'));

    console.log('\n[41] bulk recategorization of «متفرقه» transactions (preview → apply → revert)');
    const recatSeed = [
      { title: 'شارژ ساختمان مرداد', amount: 2500000, kind: 'expense' },   // longest-match → مسکن, not قبض
      { title: 'اسنپ', amount: 85000, kind: 'expense' },                     // → حمل‌ونقل
      { title: 'بیمه شخص ثالث', amount: 4200000, kind: 'expense' },          // → حمل‌ونقل, not قبض
      { title: 'سوپرمارکت جانبو', amount: 640000, kind: 'expense' },         // → خوراک
      { title: 'داروخانه', amount: 310000, kind: 'expense' },                // → سلامت
      { title: 'هتل رامسر', amount: 8800000, kind: 'expense' },              // → سفر
      { title: 'واریز حقوق شهریور', amount: 45000000, kind: 'income' },      // → حقوق
      { title: 'یه چیز کاملاً بی‌ربط', amount: 1000, kind: 'expense' },      // → no match, stays
    ];
    for (const t of recatSeed) await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ ...t, date: today() }) });
    const recatTransfer = await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'انتقال به سپرده', amount: 5000000, kind: 'recatTransfer', category: 'انتقال', date: today() }) }).then(r => r.json());

    const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const catOf = (id) => (readDb().transactions.find(t => t.id === id) || {}).category;
    const recatPost = (body) => fetch(`${BASE}/api/transactions/recategorize`, { method: 'POST', headers: authHeaders, body: JSON.stringify(body) }).then(r => r.json().then(d => ({ status: r.status, d })));

    const preview = await recatPost({});
    check('preview returns 200', preview.status === 200);
    check('preview is not applied by default', preview.d.applied === false);
    const seedTitles = recatSeed.map(t => t.title);
    const seedChanges = preview.d.changes.filter(c => seedTitles.includes(c.title));
    check('preview proposes exactly the 7 matchable seeded transactions', seedChanges.length === 7 && preview.d.matched >= 7);
    check('preview leaves the unmatchable seeded one alone', !preview.d.changes.some(c => c.title === 'یه چیز کاملاً بی‌ربط') && preview.d.noMatch >= 1);
    const byTitle = Object.fromEntries(preview.d.changes.map(c => [c.title, c]));
    check('«شارژ ساختمان» → مسکن (longest keyword beats قبض\'s bare «شارژ»)', byTitle['شارژ ساختمان مرداد'] && byTitle['شارژ ساختمان مرداد'].to === 'مسکن');
    check('«بیمه شخص ثالث» → حمل‌ونقل (longest keyword beats قبض\'s bare «بیمه»)', byTitle['بیمه شخص ثالث'] && byTitle['بیمه شخص ثالث'].to === 'حمل‌ونقل');
    check('«اسنپ» → حمل‌ونقل', byTitle['اسنپ'] && byTitle['اسنپ'].to === 'حمل‌ونقل');
    check('«سوپرمارکت جانبو» → خوراک', byTitle['سوپرمارکت جانبو'] && byTitle['سوپرمارکت جانبو'].to === 'خوراک');
    check('«هتل رامسر» → سفر', byTitle['هتل رامسر'] && byTitle['هتل رامسر'].to === 'سفر');
    check('income «واریز حقوق شهریور» → حقوق', byTitle['واریز حقوق شهریور'] && byTitle['واریز حقوق شهریور'].to === 'حقوق');
    const seededSum = seedChanges.reduce((n, c) => n + c.amount, 0);
    check('summary totals the money moving out of «متفرقه»', seededSum === 2500000 + 85000 + 4200000 + 640000 + 310000 + 8800000 + 45000000 && preview.d.sumAmount >= seededSum);
    check('preview wrote nothing to disk', catOf(byTitle['اسنپ'].id) === 'متفرقه');
    check('transfers are never proposed for recategorization', !preview.d.changes.some(c => c.id === recatTransfer.id));

    const applied = await recatPost({ apply: true });
    await new Promise(r => setTimeout(r, 80)); /* write() is an async chain on the Node server; let it flush before reading db.json */
    check('apply reports applied=true and revertible=true', applied.d.applied === true && applied.d.revertible === true);
    check('apply actually changed the دسته on disk', catOf(byTitle['اسنپ'].id) === 'حمل‌ونقل' && catOf(byTitle['شارژ ساختمان مرداد'].id) === 'مسکن');
    check('apply kept the previous دسته for undo', (readDb().transactions.find(t => t.id === byTitle['اسنپ'].id) || {}).catPrev === 'متفرقه');
    check('recatTransfer untouched by apply', catOf(recatTransfer.id) === 'انتقال');

    const rerun = await recatPost({});
    check('second preview is idempotent — nothing left to fix in متفرقه', rerun.d.matched === 0 && rerun.d.scanned >= 8);

    const allScope = await recatPost({ scope: 'all' });
    const allBig = await recatPost({ scope: 'all', minAmount: 1e12 });
    check('scope=all widens the scan beyond «متفرقه» only', allScope.status === 200 && allScope.d.scanned >= applied.d.scanned);
    check('minAmount filters the scan down', allBig.status === 200 && allBig.d.scanned <= allScope.d.scanned && allBig.d.matched === 0);

    const customRule = await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'فروشگاه برادران نوری', amount: 730000, kind: 'expense', date: today() }) }).then(r => r.json());
    const noRule = await recatPost({});
    check('unknown merchant is not guessed without a user rule', !noRule.d.changes.some(c => c.id === customRule.id));
    const withRule = await recatPost({ rules: [{ word: 'برادران نوری', cat: 'خوراک' }] });
    const proposed = withRule.d.changes.find(c => c.id === customRule.id);
    check('user-defined keyword maps the merchant to the chosen دسته', !!proposed && proposed.to === 'خوراک' && proposed.keyword === 'برادران نوری');

    const manualTx = await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'داروخانه', amount: 500000, kind: 'expense', category: 'متفرقه', date: today() }) }).then(r => r.json());
    await fetch(`${BASE}/api/transactions/${manualTx.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ category: 'هدیه و کمک' }) });
    check('manual دسته edit is flagged catManual', (readDb().transactions.find(t => t.id === manualTx.id) || {}).catManual === true);
    const autoScope = await recatPost({ scope: 'auto', apply: true });
    check("scope=auto never overwrites a hand-picked دسته", catOf(manualTx.id) === 'هدیه و کمک' && !autoScope.d.changes.some(c => c.id === manualTx.id));

    const reverted = await recatPost({ revert: true });
    check('revert restores every bulk-changed دسته', reverted.d.reverted > 0 && catOf(byTitle['اسنپ'].id) === 'متفرقه' && catOf(byTitle['شارژ ساختمان مرداد'].id) === 'متفرقه');
    check('revert leaves hand-picked دسته alone', catOf(manualTx.id) === 'هدیه و کمک');
    const revertAgain = await recatPost({ revert: true });
    check('second revert is a no-op', revertAgain.d.reverted === 0);

    console.log('\n[41b] synonyms must not create phantom changes or corrupt undo');
    const salaryTx = await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'واریز حقوق مهر', amount: 48000000, kind: 'income', category: 'حقوق', date: today() }) }).then(r => r.json());
    const allScan = await recatPost({ scope: 'all' });
    check('«حقوق» is a distinct category, not silently folded into «درآمد»', !allScan.d.changes.some(c => c.id === salaryTx.id));
    const foodTx = await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'رستوران', amount: 300000, kind: 'expense', category: 'خورد و خوراک', date: today() }) }).then(r => r.json());
    const synScan = await recatPost({ scope: 'all' });
    check('a synonym spelling («خورد و خوراک») is not proposed as a change to itself', !synScan.d.changes.some(c => c.id === foodTx.id));
    const countsAddUp = await recatPost({ scope: 'all' });
    check('scanned = matched + untouched (no silently dropped records)', countsAddUp.d.scanned === countsAddUp.d.matched + countsAddUp.d.alreadyOk + countsAddUp.d.noMatch);
    const rawCatTx = await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title: 'هتل رامسر', amount: 9000000, kind: 'expense', category: 'خورد و خوراک', date: today() }) }).then(r => r.json());
    const rawApply = await recatPost({ scope: 'all', apply: true });
    await new Promise(r => setTimeout(r, 80)); /* write() is an async chain on the Node server; let it flush before reading db.json */
    const rawProposed = rawApply.d.changes.find(c => c.id === rawCatTx.id);
    const rawRec = readDb().transactions.find(t => t.id === rawCatTx.id);
    check('a non-canonical raw category is proposed for a real change', !!rawProposed && rawProposed.to === 'سفر');
    check('catPrev stores the RAW previous category for lossless undo', rawRec.catPrev === 'خورد و خوراک' && rawProposed.from === 'خورد و خوراک');
    await recatPost({ revert: true });
    await new Promise(r => setTimeout(r, 80)); /* write() is an async chain on the Node server; let it flush before reading db.json */
    check('undo restores the exact raw spelling, not the normalized one', catOf(rawCatTx.id) === 'خورد و خوراک');

    console.log('\n[42] recategorization is scoped to the signed-in user');
    const email2 = `smoke2_${Date.now()}@example.com`;
    await fetch(`${BASE}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Other', email: email2, password: 'secret123' }) });
    const login2 = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email2, password: 'secret123' }) });
    const headers2 = { 'Content-Type': 'application/json', Cookie: login2.headers.get('set-cookie').split(';')[0] };
    const otherTx = await fetch(`${BASE}/api/transactions`, { method: 'POST', headers: headers2, body: JSON.stringify({ title: 'اسنپ', amount: 120000, kind: 'expense', date: today() }) }).then(r => r.json());
    const otherPreview = await fetch(`${BASE}/api/transactions/recategorize`, { method: 'POST', headers: headers2, body: JSON.stringify({}) }).then(r => r.json());
    check('second user sees only their own transaction', otherPreview.scanned === 1 && otherPreview.matched === 1);
    const firstApply = await recatPost({ apply: true });
    check("first user's apply does not touch the second user's data", catOf(otherTx.id) === 'متفرقه' && firstApply.status === 200);
    const unauth = await fetch(`${BASE}/api/transactions/recategorize`, { method: 'POST', headers: { Cookie: 'sid=not-a-real-session' }, body: '{}' });
    check('recategorize with an invalid cookie -> 401 (not a crash)', unauth.status === 401);

    /* [43] «درآمد لحاظ نشود» (notIncome) — خواستهٔ واقعی: بعضی دریافت‌ها درآمد نیستند
       (انتقال بین کارت‌های خودم، اصل پول، پول برگشتی). کاربر می‌خواهد خودش تعیین کند
       کدام دریافت درآمد شمرده شود. قاعدهٔ توافق‌شده: فقط از آمار درآمد بیرون می‌رود،
       ماندهٔ حساب دست‌نخورده می‌ماند.
       همهٔ انتظارها «تفاضلی» نوشته شده‌اند تا دادهٔ تست‌های قبلی روی نتیجه اثر نگذارد. */
    console.log('\n[43] notIncome: «این دریافت درآمد نیست» — آمار درآمد نه، ماندهٔ حساب بله');
    const ACC = 'حساب تست notIncome';
    const mkAcc = (name) => fetch(`${BASE}/api/accounts`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name, openingBalance: 0 }) });
    const accRes = await mkAcc(ACC);
    check('dedicated test account created', accRes.status === 201 || accRes.status === 409);
    const mkTx = (title, amount, kind) => fetch(`${BASE}/api/transactions`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ title, amount, kind, category: kind === 'income' ? 'درآمد' : 'متفرقه', account: ACC, date: today() }) }).then(r => r.json());
    const salary = await mkTx('حقوق تست ۱', 10_000_000, 'income');
    const passing = await mkTx('انتقال بین کارت‌های خودم', 4_000_000, 'income');
    await mkTx('هزینه تست ۱', 1_000_000, 'expense');
    const finance = () => fetch(`${BASE}/api/finance?month=${today().slice(0, 7)}`, { headers: authHeaders }).then(r => r.json());
    const balanceOf = async (name) => {
      const a = await fetch(`${BASE}/api/accounts`, { headers: authHeaders }).then(r => r.json());
      const row = (a.accounts || []).find(x => x.name === name);
      return row ? Math.round(row.balance) : null;
    };
    const financeBefore = await finance();
    check('before: nothing is opted out', financeBefore.incomeOffCount === 0);
    check('before: the three rows add up on the account (10M + 4M − 1M)', (await balanceOf(ACC)) === 13_000_000);
    const reportsTodayIncome = async () => {
      const r = await fetch(`${BASE}/api/reports?month=${today().slice(0, 7)}`, { headers: authHeaders }).then(x => x.json());
      const row = (r.days || []).find(x => x.date === today());
      return row ? row.income : null;
    };
    const reportBefore = await reportsTodayIncome();

    const offRes = await fetch(`${BASE}/api/transactions/${passing.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ notIncome: true }) });
    const offTx = await offRes.json();
    check('PATCH notIncome:true -> 200 and flag persisted', offRes.status === 200 && offTx.notIncome === true);
    const financeAfter = await finance();
    check('income drops by exactly the opted-out amount', financeBefore.income - financeAfter.income === 4_000_000, `${financeBefore.income} -> ${financeAfter.income}`);
    check('expense is untouched by the flag', financeAfter.expense === financeBefore.expense);
    check('opted-out rows are reported (count + sum) instead of silently vanishing', financeAfter.incomeOffCount === 1 && financeAfter.incomeOffSum === 4_000_000);
    check('balance now reflects only counted income', financeAfter.balance === financeAfter.income - financeAfter.expense);

    // قلبِ تصمیم: پول واقعاً وارد کارت شده، پس ماندهٔ حساب نباید عوض شود
    check('account balance is UNCHANGED — real money still counts there', (await balanceOf(ACC)) === 13_000_000);
    check('/api/reports daily row excludes the opted-out receive too', reportBefore - (await reportsTodayIncome()) === 4_000_000);
    const listRows = await fetch(`${BASE}/api/transactions?from=${today()}&to=${today()}`, { headers: authHeaders }).then(r => r.json());
    const listRow = (listRows.items || []).find(x => x.id === passing.id);
    check('GET /api/transactions exposes the flag (what the finance page reads)', listRow && listRow.notIncome === true);
    check('a normal receive keeps no flag', (listRows.items || []).find(x => x.id === salary.id)?.notIncome === undefined);

    // برگشت‌پذیری
    const backOn = await fetch(`${BASE}/api/transactions/${passing.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ notIncome: false }) }).then(r => r.json());
    const financeReverted = await finance();
    check('notIncome:false clears the flag from the record', backOn.notIncome === undefined);
    check('income is back where it started after reverting', financeReverted.income === financeBefore.income && financeReverted.incomeOffCount === 0);
    check('account balance still 13M after the round-trip', (await balanceOf(ACC)) === 13_000_000);

    // فقط صاحب تراکنش می‌تواند این تغییر را بزند
    const foreign = await fetch(`${BASE}/api/transactions/${passing.id}`, { method: 'PATCH', headers: headers2, body: JSON.stringify({ notIncome: true }) });
    check('another user cannot flip the flag on someone else\'s transaction', foreign.status === 404);
    const stillClean = await finance();
    check('…and nothing changed for the owner', stillClean.incomeOffCount === 0 && stillClean.income === financeBefore.income);

  } finally {
    child.kill();
    fs.rmSync(path.dirname(DB_PATH), { recursive: true, force: true });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
