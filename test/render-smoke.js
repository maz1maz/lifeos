// Renders data-heavy React components to HTML in Node (esbuild bundle + react-dom/server) with real-looking data.
// Catches what the other suites can't: a component that throws while rendering (the page then stays blank/black),
// e.g. a variable removed in one place and still used in another. No browser needed, so it runs in CI before deploy.
const path = require('path');
const fs = require('fs');
const os = require('os');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
const check = (name, ok, detail = '') => { if (ok) { passed++; console.log('  ✓', name); } else { failed++; console.error('  ✗', name, detail ? `— ${detail}` : ''); } };

(async () => {
  console.log('\n[render] React components render with data');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-render-'));
  const entry = path.join(dir, 'entry.jsx');
  fs.writeFileSync(entry, `
    import { renderToString } from 'react-dom/server';
    import { createElement as h } from 'react';
    import { FunOverview, PfTrend } from ${JSON.stringify(path.join(ROOT, 'src/today/src/fun.jsx'))};
    export { renderToString, h, FunOverview, PfTrend };
  `);
  const out = path.join(dir, 'bundle.cjs');
  await esbuild.build({
    entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, jsx: 'automatic', logLevel: 'silent',
    loader: { '.css': 'empty', '.png': 'empty', '.svg': 'empty', '.woff2': 'empty' },
    nodePaths: [path.join(ROOT, 'node_modules')], define: { 'import.meta.env.DEV': 'false' },
  });
  global.window = global.window || { location: { search: '' }, matchMedia: () => ({ matches: false }) };
  global.localStorage = { getItem: () => null, setItem: () => {} };
  const { renderToString, h, FunOverview, PfTrend } = require(out);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
  const day = n => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const poker = [[40, 5e6, 9e6], [20, 6e6, 2e6], [9, 4e6, 12e6], [2, 5e6, 1e6]].map(([n, i, o], k) => ({ id: 'p' + k, date: day(n), buyIn: i, cashOut: o, createdAt: k }));
  const bet = [[30, 100, 160], [5, 160, 90]].map(([n, s, b], k) => ({ id: 'b' + k, date: day(n), start: s, deposit: 0, withdraw: 0, balance: b, result: b - s, usdRate: 1000000 }));
  const monthStart = today.slice(0, 8) + '01';
  for (const mode of ['all', 'poker', 'bet']) {
    for (const [label, p, b] of [['poker + bet', poker, bet], ['poker only', poker, []], ['nothing', [], []]]) {
      let html = '', err = '';
      try { html = renderToString(h(FunOverview, { poker: p, bet: b, usdRate: 1000000, monthFrom: monthStart, monthTo: today, mode })); } catch (e) { err = e.stack || e.message; }
      check(`FunOverview renders · ${mode} · ${label}`, !err && html.length > 50, err.split('\n').slice(0, 3).join(' | '));
    }
  }
  // a past month (ranges count back from its end)
  { let err = ''; try { renderToString(h(FunOverview, { poker, bet, usdRate: 1000000, monthFrom: day(60), monthTo: day(35), mode: 'all' })); } catch (e) { err = e.message; } check('FunOverview renders for a past month', !err, err); }
  const snaps = [5, 3, 1, 0].map(n => ({ date: day(n), value: 1e9 + n * 1e7, cost: 9e8, est: n > 1 }));
  for (const to of [undefined, day(2)]) { let err = ''; try { renderToString(h(PfTrend, { snaps, to })); } catch (e) { err = e.message; } check(`PfTrend renders${to ? ' (past month)' : ''}`, !err, err); }

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\nRender smoke: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
