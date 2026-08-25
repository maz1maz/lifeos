// Smoke test: starts the real server on a throw-away port and hits it over HTTP.
// Run with: npm test  (or) node test/smoke.js
// Guards against regressions of the auth-check crash bug (see REMAINING-WORK.md history):
// any authenticated route must reject an invalid session cookie with 401, never crash.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'db.json');
const PORT = 3979;
const BASE = `http://127.0.0.1:${PORT}`;

const EMPTY_DB = { users: [], sessions: [], transactions: [], tasks: [], inbox: [], daily: [], investments: [], accounts: [], budgets: [], projects: [], timeEntries: [], habits: [], habitLogs: [], subscriptions: [], debts: [], footballTeams: [], matches: [], news: [], movies: [] };

let pass = 0, fail = 0;
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
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
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

  } finally {
    child.kill();
    fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
