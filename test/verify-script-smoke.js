// Guards the live-verification script itself: `docs/verify-live.console.js` is what
// the human pastes into their browser console to prove the deploy is the merged
// tree — if that script silently stops detecting a bad worker, the whole "quick
// verification" step becomes a rubber stamp.
//
// This suite therefore runs the REAL browser script (unmodified source, with a
// browser-like fetch shim + a real session cookie) against the REAL worker.js,
// in-process, four times:
//   1. against the current (fixed) worker      -> expects all four checks green;
//   2. against the same worker with the two helper names removed from BOTH export
//      lists (i.e. the exact pre-fix production state: `categorizeTransaction` and
//      `normalizeCategoryName` defined but not exported) -> expects checks 3 and 4
//      to go red with HTTP 500, check 2 (title-only PATCH) to stay green.
// That last expectation documents a nuance found while writing the script: a title
// edit short-circuits before the helper, so it can never catch this bug.
//
// Run with: npm test  (or) node test/verify-script-smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://verify-script-smoke.local';
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  - ${name}`); }
  else { fail++; console.log(`  FAIL- ${name}` + (extra ? `  [${extra}]` : '')); }
}

// Fake for the only D1 surface the worker touches (same shape as worker-smoke.js):
//   SELECT value FROM kv WHERE key='db' / INSERT INTO kv ... ON CONFLICT DO UPDATE
function makeEnv(assetMode) {
  const mode = assetMode || 'plain';
  const store = { value: null };
  return {
    DB: {
      prepare(sql) {
        const st = { _params: [], bind(...p) { st._params = p; return st; },
          async first() { if (sql.startsWith('SELECT value FROM kv')) return store.value === null ? null : { value: store.value }; throw new Error('unexpected SQL in harness: ' + sql); },
          async run() { if (sql.startsWith('INSERT INTO kv')) { store.value = st._params[0]; return { success: true }; } throw new Error('unexpected SQL in harness: ' + sql); } };
        return st;
      },
    },
    // Serve real files from public/, like the production ASSETS binding does.
    //   mode 'plain' — exact paths only (a server with no html_handling at all)
    //   mode 'cf'    — Cloudflare's default asset behaviour on top of that:
    //                  `/x.html` answers 307 → `/x`, and `/x` serves `x.html`
    //   mode 'none'  — nothing deployed: every asset request 404s
    ASSETS: {
      fetch: async (req) => {
        const notFound = new Response('not found', { status: 404 });
        if (mode === 'none') return notFound;
        const pth = new URL(req.url).pathname;
        if (pth.includes('..')) return notFound;
        const fileFor = (q) => path.join(ROOT, 'public', q === '/' ? 'index.html' : q.replace(/^\//, ''));
        const readIfFile = (f) => (fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f) : null);
        const ok = (buf) => new Response(buf, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
        if (mode === 'cf' && pth.endsWith('.html')) {
          const clean = pth === '/index.html' ? '/' : pth.slice(0, -'.html'.length);
          const cleanFile = clean === '/' ? fileFor('/') : fileFor(clean) + '.html';
          if (readIfFile(cleanFile) !== null) return new Response(null, { status: 307, headers: { location: clean } });
        }
        const own = readIfFile(fileFor(pth));
        if (own !== null) return ok(own);
        if (mode === 'cf' && !path.extname(pth)) {
          const viaClean = readIfFile(fileFor(pth + '.html'));
          if (viaClean !== null) return ok(viaClean);
        }
        return notFound;
      },
    },
  };
}

async function loadWorker(src) {
  const tmp = path.join(__dirname, '.tmp-verify-worker.mjs');
  const XLSX_IMPORT = "import * as XLSX from 'xlsx';";
  if (!src.includes(XLSX_IMPORT)) throw new Error('xlsx import line changed — update this harness stub');
  fs.writeFileSync(tmp, src.replace(XLSX_IMPORT, 'const XLSX = null; // harness stub'));
  try {
    return (await import(pathToFileURL(tmp).href + '?v=' + Math.random())).default;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// Runs docs/verify-live.console.js the way a browser would: same-origin requests
// carry the session cookie, 3xx redirects are followed.
async function runVerifyScript(worker, env) {
  const script = fs.readFileSync(path.join(ROOT, 'docs', 'verify-live.console.js'), 'utf8');
  let cookie = '';
  const rawFetch = async (input, init) => {
    const headers = Object.assign({}, (init && init.headers) || {});
    if (cookie) headers.cookie = cookie;
    let url = String(input);
    let res = await worker.fetch(new Request(url, { method: (init && init.method) || 'GET', headers, body: init && init.body }), env, {});
    let redirected = false;
    // up to 5 hops: gate-302 followed by asset-307 is a legit chain, an endless
    // loop is not — the cap keeps a looping worker from hanging the suite.
    for (let hop = 0; hop < 5 && res.status >= 300 && res.status < 400; hop++) {
      const loc = res.headers.get('location');
      if (!loc) break;
      redirected = true;
      url = new URL(loc, url).toString();
      res = await worker.fetch(new Request(url, { method: 'GET', headers }), env, {});
    }
    const text = await res.text();
    const out = new Response(text, { status: res.status });
    Object.defineProperty(out, 'redirected', { value: redirected });
    Object.defineProperty(out, 'url', { value: res.url || url });
    return out;
  };

  // Sign up (same route the browser uses) and seed one categorised transaction,
  // because the script edits the first transaction it finds.
  const email = `vscripts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@example.com`;
  const su = await worker.fetch(new Request(ORIGIN + '/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Verify', email, password: 'secret123' }) }), env, {});
  const setCookies = typeof su.headers.getSetCookie === 'function' ? su.headers.getSetCookie() : [su.headers.get('set-cookie')];
  cookie = String(setCookies[0] || '').split(';')[0];
  await worker.fetch(new Request(ORIGIN + '/api/transactions', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'نان', amount: 30000, kind: 'expense', category: 'متفرقه', date: new Date().toISOString().slice(0, 10) }) }), env, {});

  const saved = { fetch: globalThis.fetch, location: globalThis.location, error: console.error };
  const lines = [];
  const internalErrors = [];
  const realLog = console.log, realWarn = console.warn;
  globalThis.fetch = rawFetch;
  globalThis.location = { origin: ORIGIN, protocol: 'https:', hostname: 'verify-script-smoke.local', url: ORIGIN + '/' };
  // split on newlines: the script also prints its whole result block in one call
  console.log = (...a) => lines.push(...a.join(' ').split('\n'));
  console.warn = (...a) => lines.push('warn: ' + a.join(' '));
  console.error = (...a) => internalErrors.push(String((a[0] && a[0].message) || a[0])); // worker logs the 500 cause here
  try {
    // vm.runInThisContext returns the script's completion value — the IIFE's
    // promise — so we really wait for the last check before restoring the globals.
    // (new Function(script) would run it too, but return undefined: the console
    // and fetch overrides would be torn down mid-run.)
    await vm.runInThisContext(script, { filename: 'verify-live.console.js' });
  } finally {
    console.log = realLog; console.warn = realWarn; console.error = saved.error;
    globalThis.fetch = saved.fetch; globalThis.location = saved.location;
  }
  const printed = lines.filter((l) => /^(✅|❌)/.test(l));
  printed.internalErrors = internalErrors;
  return printed;
}

async function main() {
  const fixedSrc = fs.readFileSync(path.join(ROOT, 'cloudflare', 'worker.js'), 'utf8');

  // Build the pre-fix variant: the two helpers exist but are missing from both the
  // makeHelpers `return {...}` list and the handleApi destructuring.
  const UNEXPORTED = 'normalizeCategoryName, categorizeTransaction, ';
  const occurrences = fixedSrc.split(UNEXPORTED).length - 1;
  check('harness: finds both export lists to break (return + destructuring)', occurrences === 2, `found ${occurrences}`);
  const brokenSrc = fixedSrc.split(UNEXPORTED).join('');

  console.log('\n[V1] the verify script on the current (fixed) worker');
  const fixedLines = await runVerifyScript(await loadWorker(fixedSrc), makeEnv());
  // The script prints Persian numerals («چک ۳»), so match those. Each check shows up
  // twice on purpose (once live, once inside the copy-paste block) — so assert on all.
  const FA = ['۱', '۲', '۳', '۴', '۵'];
  const checks = (lines, n) => lines.filter((l) => l.includes(`چک ${FA[n - 1]} `));
  const allGreen = (lines, n) => { const c = checks(lines, n); return c.length >= 1 && c.every((l) => l.startsWith('✅')); };
  check('script wired into real worker (5 check lines + session line)', fixedLines.length >= 6, fixedLines.length + ' lines');
  check('no ❌ at all', fixedLines.every((l) => !l.startsWith('❌')), fixedLines.filter((l) => l.startsWith('❌')).join(' | '));
  check('check 1 (/newtab.html) green', allGreen(fixedLines, 1));
  check('check 2 (title PATCH) green', allGreen(fixedLines, 2));
  check('check 3 (category PATCH) green — the route that 500’d', allGreen(fixedLines, 3));
  check('check 4 (recategorize preview) green — the button that 500’d', allGreen(fixedLines, 4));
  check('check 5 (finance-page asset with the notIncome switch) green', allGreen(fixedLines, 5));

  console.log('\n[V1b] the SAME script against Cloudflare-style asset URLs (/x.html -> 307 -> /x)');
  const cfLines = await runVerifyScript(await loadWorker(fixedSrc), makeEnv('cf'));
  check('nothing goes red through the .html -> extensionless rewrite', cfLines.every((l) => !l.startsWith('❌')), cfLines.filter((l) => l.startsWith('❌')).join(' | '));
  check('check 1 stays green when /newtab.html redirects to /newtab', allGreen(cfLines, 1));
  check('check 1 names the rewrite instead of blaming the login gate', checks(cfLines, 1).some((l) => /\/newtab\.html \u2192 \/newtab\)/.test(l)));
  check('check 5 (finance-page asset) survives the rewrite too', allGreen(cfLines, 5));

  console.log('\n[V1c] and with nothing deployed (the asset binding 404s everything)');
  const noLines = await runVerifyScript(await loadWorker(fixedSrc), makeEnv('none'));
  const no1 = checks(noLines, 1);
  check('check 1 goes red with HTTP 404 when the asset is missing', no1.length >= 1 && no1.every((l) => l.startsWith('❌') && /HTTP 404/.test(l)), no1.join(' | '));
  check('check 5 goes red when the asset is missing', checks(noLines, 5).every((l) => l.startsWith('❌')));
  check('the API checks stay green — only the assets are missing', allGreen(noLines, 2) && allGreen(noLines, 3) && allGreen(noLines, 4));

  console.log('\n[V2] the SAME script on the pre-fix worker (helpers not exported)');
  const brokenLines = await runVerifyScript(await loadWorker(brokenSrc), makeEnv());
  const red = brokenLines.filter((l) => l.startsWith('❌'));
  check('the bug is actually detected (≥2 red)', red.length >= 2, red.length + ' red');
  const allRedWith500 = (lines, n) => { const c = checks(lines, n); return c.length >= 1 && c.every((l) => l.startsWith('❌')) && c.every((l) => /500/.test(l)); };
  check('check 3 goes red with 500', allRedWith500(brokenLines, 3));
  check('check 4 goes red with 500', allRedWith500(brokenLines, 4));
  check('check 2 (title-only) stays green — short-circuits before the helper', allGreen(brokenLines, 2));
  check('check 1 (/newtab.html) stays green — assets are not affected', allGreen(brokenLines, 1));
  check('check 5 stays green on the pre-fix worker — it reads assets, not helpers', allGreen(brokenLines, 5));
  check('the 500s are the ReferenceError the fix removed',
    brokenLines.internalErrors.length >= 2 && brokenLines.internalErrors.every((m) => /is not defined/.test(m)),
    brokenLines.internalErrors.join(' | '));
  check('the fixed worker logs no internal error at all',
    fixedLines.internalErrors.length === 0, fixedLines.internalErrors.join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
