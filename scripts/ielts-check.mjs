// Checks IELTS test files (JSON) before the admin imports them in LifeOS («افزودن آزمون» → «برای همهٔ کاربران»).
// Uses the same rules as the Worker (cloudflare/lib/ielts.js), plus: size limit, duplicate ids, a key-graded dry run
// (answering every question with its own key must score 100%), and a short summary per file. Format: docs/IELTS-CONTENT.md.
//   node scripts/ielts-check.mjs <file.json|folder> […]
//   node scripts/ielts-check.mjs --img chart.png      → prints a data URL for a writing task / question image
import fs from 'node:fs';
import path from 'node:path';
import { validateTest, publicTest, gradeTest, OPEN_SKILLS } from '../cloudflare/lib/ielts.js';

const args = process.argv.slice(2);
if (!args.length) { console.log('usage: node scripts/ielts-check.mjs <file.json|folder> …  |  --img <image>'); process.exit(1); }
if (args[0] === '--img') {
  const f = args[1], ext = path.extname(f).slice(1).toLowerCase().replace('jpg', 'jpeg');
  if (!['png', 'jpeg', 'webp', 'gif'].includes(ext)) { console.error('png, jpg, webp or gif'); process.exit(1); }
  const b = fs.readFileSync(f);
  if (b.length > 400e3) console.error(`warning: ${Math.round(b.length / 1e3)} KB — shrink it (webp, ~1000px wide) to keep the test small`);
  process.stdout.write(`data:image/${ext};base64,${b.toString('base64')}`);
  process.exit(0);
}

const files = args.flatMap(a => fs.statSync(a).isDirectory() ? fs.readdirSync(a).filter(f => f.endsWith('.json')).map(f => path.join(a, f)) : [a]);
const ids = new Map(); let bad = 0;
for (const f of files) {
  const out = []; let t;
  const raw = fs.readFileSync(f, 'utf8');
  try { t = JSON.parse(raw); } catch (e) { console.log(`✗ ${f}: JSON نامعتبر — ${e.message}`); bad++; continue; }
  if (raw.length > 1500000) out.push(`حجم ${Math.round(raw.length / 1e3)} KB؛ سقف ۱۵۰۰ KB است`);
  const err = validateTest(t); if (err) out.push(err);
  if (ids.has(t.id)) out.push(`شناسهٔ تکراری؛ همان ${ids.get(t.id)}`); else ids.set(t.id, f);
  let info = '';
  if (!err && !OPEN_SKILLS.includes(t.skill)) {
    // every question answered with its own key → must be full marks
    const a = {};
    for (const [n, k] of Object.entries(t.key)) { if (Array.isArray(k)) a[n] = k[0]; else if (k && k.anyOf) k.group.forEach((g, i) => { a[g] = k.anyOf[i]; }); }
    const g = gradeTest(t, a), pt = publicTest(t);
    if (g.raw !== g.total) out.push(`با کلید خودش ${g.raw} از ${g.total} شد؛ کلید سؤال‌های ${g.results.filter(r => !r.ok).map(r => r.n).join(', ')} مشکل دارد`);
    const extra = Object.keys(t.key).map(Number).filter(n => !g.results.some(r => r.n === n) && !Object.values(t.key).some(k => k && k.group && k.group.includes(n)));
    if (extra.length) out.push(`کلید برای سؤال‌هایی هست که در برگه نیستند: ${extra.join(', ')}`);
    if (t.skill === 'listening' && !t.tape) out.push('هشدار: متن صوت (tape) ندارد؛ در بازبینی نشان داده نمی‌شود');
    info = `${t.skill || 'listening'}${t.module ? '/' + t.module : ''} · ${pt.total} سؤال · بخش‌ها ${pt.parts.join('+')}`;
  } else if (!err) {
    info = t.skill === 'writing' ? `writing${t.module ? '/' + t.module : ''} · ${t.tasks.length} تسک${t.tasks.some(k => k.task === 'task1' && !k.image && t.module !== 'general') ? ' · هشدار: Task 1 آکادمیک بدون تصویر' : ''}${t.tasks.some(k => k.image && !k.data) ? ' · هشدار: نمودار بدون data (مصحح AI تصویر را نمی‌بیند)' : ''}` : `speaking · ${t.cards.length} کارت`;
  }
  if (out.some(x => !x.startsWith('هشدار'))) bad++;
  console.log(`${out.some(x => !x.startsWith('هشدار')) ? '✗' : '✓'} ${path.basename(f)}  ${t.id || ''}  ${info}`);
  for (const x of out) console.log(`    - ${x}`);
}
console.log(`\n${files.length} فایل، ${bad} مشکل‌دار`);
process.exit(bad ? 1 : 0);
