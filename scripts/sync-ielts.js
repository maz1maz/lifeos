#!/usr/bin/env node
// Copies the Persian build of IELTS Atlas (sallowayma-git/IELTS-practice + js/i18n-fa.js, GPL-3.0) into public/ielts/.
// Usage: node scripts/sync-ielts.js <path-to-IELTS-practice-fa>
// public/ is served behind the LifeOS login (worker.js isPublic must never list /ielts/): the question bank is
// for personal use only. Dev-only folders and upstream docs are left out; README-FA.md and LICENSE are kept.
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src || !fs.existsSync(path.join(src, 'index.html')) || !fs.existsSync(path.join(src, 'js', 'i18n-fa.js'))) {
  console.error('usage: node scripts/sync-ielts.js <IELTS-practice-fa folder (needs index.html and js/i18n-fa.js)>');
  process.exit(1);
}
const dest = path.join(__dirname, '..', 'public', 'ielts');
const SKIP_DIRS = new Set(['.git', '.github', 'developer', 'fa-tools', 'scripts', 'node_modules', 'templates/ci-practice-fixtures']);
// template_base.html is an unused authoring template full of onclick= handlers (blocked by the CSP anyway)
const SKIP_FILE = rel => rel === 'templates/template_base.html' || !rel.includes('/') && (/^README(?!-FA\.md$).*\.md$/i.test(rel) || /^(CONTRIBUTING|RELEASE_NOTE).*\.md$/i.test(rel) || /^\.git/.test(rel));

let files = 0, bytes = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(path.join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${ent.name}` : ent.name;
    if (ent.isDirectory()) { if (!SKIP_DIRS.has(rel)) walk(rel); continue; }
    if (!ent.isFile() || SKIP_FILE(rel)) continue;
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, rel), to);
    files++; bytes += fs.statSync(to).size;
  }
}
fs.rmSync(dest, { recursive: true, force: true });
walk('');

// The LifeOS CSP blocks inline handlers (onclick=…): rebind the one the app actually loads to a listener inside the
// page's single inline script (its sha256 is computed by the Worker, so editing it is fine).
const ph = path.join(dest, 'templates', 'exam-placeholder.html');
let html = fs.readFileSync(ph, 'utf8');
const before = html;
html = html.replace('<button onclick="window.close()"', '<button type="button" data-ielts-close')
  .replace(/\n<script>\n/, "\n<script>\ndocument.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-ielts-close]')) window.close(); });\n");
if (html === before || / on[a-z]+="/.test(html)) { console.error('exam-placeholder.html: inline handler patch did not apply'); process.exit(1); }
fs.writeFileSync(ph, html);
console.log(`public/ielts: ${files} files, ${(bytes / 1048576).toFixed(1)} MB`);

// Question-bank numbers for the «آیلتس» tab (src/today/src/ielts.jsx reads /ielts/lifeos-stats.json).
const vm = require('vm');
const rdir = path.join(dest, 'assets', 'generated', 'reading-exams');
const mctx = {}; mctx.globalThis = mctx; mctx.window = mctx;
vm.runInNewContext(fs.readFileSync(path.join(rdir, 'manifest.js'), 'utf8'), mctx);
const FREQ = { '高频': 'high', '次高频': 'medium', low: 'low', high: 'high', medium: 'medium' };
const stats = { passages: 0, questions: 0, parts: {}, kinds: {} };
for (const e of Object.values(mctx.__READING_EXAM_MANIFEST__)) {
  const part = stats.parts[e.category] ||= { passages: 0, questions: 0, high: 0, medium: 0, low: 0, diffSum: 0, diffN: 0 };
  part.passages++; stats.passages++;
  part[FREQ[e.frequency] || 'low']++;
  if (Number(e.difficultyScore) > 0) { part.diffSum += Number(e.difficultyScore); part.diffN++; }
  let data = null;
  const ctx = { __READING_EXAM_DATA__: { register: (k, d) => { data = d; } } }; ctx.globalThis = ctx; ctx.window = ctx;
  try { vm.runInNewContext(fs.readFileSync(path.join(rdir, e.script), 'utf8'), ctx); } catch (err) { continue; }
  const n = (data.questionOrder || []).length;
  part.questions += n; stats.questions += n;
  for (const g of data.questionGroups || []) stats.kinds[g.kind] = (stats.kinds[g.kind] || 0) + 1;
}
for (const p of Object.values(stats.parts)) { p.difficulty = p.diffN ? Math.round(p.diffSum / p.diffN * 10) / 10 : null; delete p.diffSum; delete p.diffN; }
fs.writeFileSync(path.join(dest, 'lifeos-stats.json'), JSON.stringify(stats));
console.log(`stats: ${stats.passages} passages, ${stats.questions} questions`, JSON.stringify(stats.kinds));
