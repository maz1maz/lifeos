// Converts BandReady's core-en practice bank (JSONL, CC0, Luxshan2000/ielts-prep) into LifeOS IELTS test files
// (docs/IELTS-CONTENT.md). Output is for the admin import («افزودن آزمون») and is never written into the repo.
//   node scripts/ielts-convert-bandready.mjs <core-en/data dir> <out dir>
// Questions that cannot be mapped to a LifeOS group type (diagrams, maps) are skipped and listed in _report.json.
// Every output file is then checked with scripts/ielts-check.mjs.
import fs from 'node:fs';
import path from 'node:path';

const [srcDir, outDir] = process.argv.slice(2);
if (!srcDir || !outDir) { console.log('usage: node scripts/ielts-convert-bandready.mjs <core-en/data dir> <out dir>'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const read = name => fs.readFileSync(path.join(srcDir, name + '.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const readingTests = read('reading_tests');
const passages = Object.fromEntries(read('reading_passages').map(p => [p.id, p]));
const listeningTests = read('listening_tests');
const scripts = Object.fromEntries(read('listening_scripts').map(s => [s.id, s]));
const writingPrompts = read('writing_prompts');

const report = { files: [], skipped: [] };
const skip = (test, what, reason) => report.skipped.push({ test, what, reason });
const flat = answers => (answers || []).flatMap(a => (Array.isArray(a) ? a : (a && typeof a === 'object' ? [a.value] : [a]))).filter(v => v != null && String(v).trim() !== '').map(String);
const rangeOf = nums => { const s = [...nums].sort((a, b) => a - b); return s.length ? `${s[0]}–${s[s.length - 1]}` : ''; };
const titleOf = nums => { const s = [...nums].sort((a, b) => a - b); return s.length ? `Questions ${s[0]}–${s[s.length - 1]}` : ''; };
const numsIn = text => [...String(text).matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1]));
const BLANK = /_{3,}/;

// ---- shared group conversion for the fill-in family -------------------------------------------------
// Returns {lines} or {table} or null (when the layout cannot cover every question number).
function fillLines(group, qs) {
  const want = new Set(qs.map(q => q.number ?? q.n));
  const layout = group.layout;
  if (layout && (layout.kind === 'note' || layout.kind === 'flow_chart') && layout.lines || layout && layout.steps) {
    const src = layout.lines || layout.steps;
    const have = new Set(src.flatMap(numsIn));
    if ([...want].every(n => have.has(n)) && have.size === want.size) {
      return { lines: src.map(l => l.replace(/\{\{(\d+)\}\}/g, '[$1]')) };
    }
  }
  if (layout && layout.kind === 'table') {
    const cells = layout.rows.flat().join(' ');
    const have = new Set(numsIn(cells));
    if ([...want].every(n => have.has(n)) && have.size === want.size) {
      return { table: { head: layout.columns, rows: layout.rows.map(r => r.map(c => String(c).replace(/\{\{(\d+)\}\}/g, '[$1]'))) } };
    }
  }
  // fallback: one line per question, from its own prompt
  const lines = qs.map(q => {
    const n = q.number ?? q.n;
    const p = String(q.prompt || '');
    if (/\{\{gap\}\}/.test(p)) return p.replace('{{gap}}', `[${n}]`);
    return `${p} [${n}]`;
  });
  return { lines };
}

// ---- reading -------------------------------------------------------------------------------------------
function convertReadingGroup(testLabel, g, key, sectionNums) {
  const qs = g.questions || [];
  const nums = qs.map(q => q.number);
  for (const q of qs) key[q.number] = flat(q.answers).map(v => v.toUpperCase() === v ? v : v);
  const base = { title: titleOf(nums), instr: g.instructions_extra || '' };
  const opts = (g.options || []).map(o => ({ k: o.key, t: o.text }));
  switch (g.type) {
    case 'true_false_not_given':
      return { ...base, choices: ['TRUE', 'FALSE', 'NOT GIVEN'], questions: qs.map(q => ({ n: q.number, q: q.prompt })) };
    case 'yes_no_not_given':
      return { ...base, choices: ['YES', 'NO', 'NOT GIVEN'], questions: qs.map(q => ({ n: q.number, q: q.prompt })) };
    case 'multiple_choice':
      return { ...base, questions: qs.map(q => ({ n: q.number, q: q.prompt, options: opts })) };
    case 'matching_headings':
      return { ...base, listTitle: 'List of Headings', options: opts, questions: qs.map(q => ({ n: q.number, q: q.prompt })) };
    case 'matching_information':
      return { ...base, listTitle: 'Paragraphs', options: opts, questions: qs.map(q => ({ n: q.number, q: q.prompt })) };
    case 'matching_features':
      return { ...base, listTitle: 'Names', options: opts, questions: qs.map(q => ({ n: q.number, q: q.prompt })) };
    case 'matching_sentence_endings':
      return { ...base, listTitle: 'Sentence endings', options: opts, questions: qs.map(q => ({ n: q.number, q: q.prompt })) };
    case 'summary_completion_bank': {
      const f = fillLines(g, qs);
      return { ...base, ...(f.lines ? { lines: f.lines } : { table: f.table }), bankItems: opts };
    }
    case 'sentence_completion':
    case 'short_answer':
    case 'summary_completion':
    case 'note_completion':
    case 'table_completion':
    case 'flow_chart_completion':
      return { ...base, ...fillLines(g, qs) };
    default:
      skip(testLabel, g.type, 'unsupported group type');
      for (const q of qs) delete key[q.number];
      return null;
  }
}

function convertReadingTest(rt, idx) {
  const testLabel = rt.id;
  const module = rt.format === 'general' ? 'general' : 'academic';
  const key = {};
  const sections = [];
  for (const [i, pid] of [rt.p1_id, rt.p2_id, rt.p3_id].entries()) {
    const p = passages[pid];
    if (!p) { skip(testLabel, pid, 'passage missing'); continue; }
    const pj = p.passage_json;
    const paragraphs = pj.texts.flatMap(t => [
      ...(t.heading ? [{ text: t.heading }] : []),
      ...t.paragraphs.map(x => ({ label: x.id, text: x.text })),
    ]);
    const groups = [];
    const nums = new Set();
    for (const g of pj.question_groups) {
      const conv = convertReadingGroup(testLabel, g, key, nums);
      if (conv) { groups.push({ id: g.id, ...conv }); g.questions.forEach(q => nums.add(q.number)); }
    }
    sections.push({ n: i + 1, title: pj.title || p.title, range: rangeOf(nums), passage: { title: p.title, paragraphs }, groups });
  }
  return {
    id: `br-read-${module === 'general' ? 'gt' : 'ac'}-${idx + 1}`, skill: 'reading', module,
    title: `BandReady Reading — ${module === 'general' ? 'General' : 'Academic'} Test ${idx + 1}`,
    source: 'BandReady Core (English)', minutes: 60, sections, key,
  };
}

// ---- listening -----------------------------------------------------------------------------------------
function convertListeningPart(testLabel, s, key, partNo) {
  const groups = []; const nums = new Set();
  const names = Object.fromEntries((s.script_json.speakers || []).map(sp => [sp.id, sp.name]));
  const tape = { section: partNo, lines: (s.script_json.lines || []).map(l => `${names[l.speaker] || l.speaker}: ${l.text}`) };
  for (const g of s.script_json.groups) {
    const qs = s.script_json.questions.filter(q => (g.questions || []).includes(q.n));
    for (const q of qs) key[q.n] = flat(q.answers);
    const base = { title: titleOf(qs.map(q => q.n)), instr: g.instruction || '' };
    let conv = null;
    if (g.type === 'map_labelling') { skip(testLabel, `part ${partNo} map ${g.id}`, 'map image'); for (const q of qs) delete key[q.n]; }
    else if (g.type === 'multiple_choice') {
      conv = { ...base, questions: qs.map(q => ({ n: q.n, q: q.prompt, options: Object.entries(q.options || {}).map(([k, t]) => ({ k, t })) })) };
    } else if (g.type === 'matching') {
      const o = qs[0] && qs[0].options ? Object.entries(qs[0].options).map(([k, t]) => ({ k, t })) : [];
      conv = { ...base, listTitle: 'Options', options: o, questions: qs.map(q => ({ n: q.n, q: q.prompt })) };
    } else if (g.type === 'table_completion') {
      const table = tableFromMarkdown(qs);
      if (table) conv = { ...base, table }; else skip(testLabel, `part ${partNo} ${g.id}`, 'table markup not understood');
    } else if (['form_completion', 'note_completion', 'sentence_completion', 'short_answer'].includes(g.type)) {
      conv = { ...base, lines: linesFromPrompts(qs) };
    } else skip(testLabel, `part ${partNo} ${g.type}`, 'unsupported group type');
    if (conv) { groups.push({ id: g.id, ...conv }); qs.forEach(q => nums.add(q.n)); }
  }
  return { section: { n: partNo, title: s.script_json.title || s.title, range: rangeOf(nums), groups }, tape };
}

// «Surname: ______» → «Surname: [1]»; a question without a blank gets «[n]» at its end.
function linesFromPrompts(qs) {
  const out = []; let headerDone = false;
  for (const q of qs) {
    const parts = String(q.prompt || '').split('\n');
    const blankAt = parts.findIndex(l => BLANK.test(l));
    if (!headerDone && blankAt > 0) { out.push(...parts.slice(0, blankAt)); headerDone = true; }
    if (blankAt >= 0) out.push(parts[blankAt].replace(BLANK, `[${q.n}]`));
    else out.push(`${parts[parts.length - 1]} [${q.n}]`);
  }
  return out;
}

// table prompt is markdown; each blank is marked **n** ______
function tableFromMarkdown(qs) {
  const md = String(qs[0].prompt || '');
  const rows = md.split('\n').filter(l => l.trim().startsWith('|') && !/^\|\s*-/.test(l.trim()));
  if (!rows.length) return null;
  const cells = l => l.split('|').slice(1, -1).map(c => c.trim());
  const [head, ...body] = rows.map(cells);
  let ok = true;
  const fixed = body.map(r => r.map(c => {
    const c2 = c.replace(/\*\*(\d+)\*\*\s*_{3,}/g, '[$1]');
    if (BLANK.test(c2)) ok = false;
    return c2;
  }));
  return ok ? { head, rows: fixed } : null;
}

function convertListeningTest(lt, idx) {
  const key = {}; const sections = []; const tapes = [];
  [lt.p1_id, lt.p2_id, lt.p3_id, lt.p4_id].forEach((sid, i) => {
    const s = scripts[sid];
    if (!s) { skip(lt.id, sid, 'script missing'); return; }
    const { section, tape } = convertListeningPart(lt.id, s, key, i + 1);
    sections.push(section); tapes.push(tape);
  });
  return {
    id: `br-listen-${idx + 1}`, skill: 'listening',
    title: `BandReady Listening — Test ${idx + 1}`, source: 'BandReady Core (English)',
    sections, key, tape: tapes,
  };
}

// ---- writing -------------------------------------------------------------------------------------------
function chartText(spec) {
  if (!spec) return undefined;
  const cats = spec.x_axis && spec.x_axis.categories;
  const series = spec.series || [];
  if (!cats || !series.length) return spec.title ? `${spec.title}.` : undefined;
  const body = series.map(s => `${s.name}: ` + cats.map((c, i) => `${c} ${s.values[i]}`).join(', ')).join('. ');
  return `${spec.title}. Unit: ${spec.unit || ''}. ${body}.`.replace(/\s+/g, ' ');
}
const wTask = w => (w.task_type === 'task2' ? 'task2' : 'task1');
const wModule = w => (w.task_type === 'gt_task1' ? 'general' : 'academic');
function writingTask(w) {
  const t = { task: wTask(w), prompt: w.prompt_text };
  const data = chartText(w.chart_spec);
  if (data) t.data = data;
  return t;
}
function writingTests(list) {
  const ac1 = list.filter(w => w.task_type === 'ac_task1');
  const t2 = list.filter(w => w.task_type === 'task2');
  const gt = list.filter(w => w.task_type === 'gt_task1');
  const out = [];
  const pairs = Math.min(ac1.length, t2.length);
  for (let i = 0; i < pairs; i++) out.push({ module: 'academic', tasks: [writingTask(ac1[i]), writingTask(t2[i])], ids: [ac1[i].id, t2[i].id] });
  for (const w of [...ac1.slice(pairs), ...t2.slice(pairs)]) out.push({ module: 'academic', tasks: [writingTask(w)], ids: [w.id] });
  for (const w of gt) out.push({ module: 'general', tasks: [writingTask(w)], ids: [w.id] });
  return out.map((x, i) => ({
    id: `br-write-${String(i + 1).padStart(3, '0')}`, skill: 'writing', module: x.module,
    title: `BandReady Writing — ${x.module === 'general' ? 'General' : 'Academic'} ${String(i + 1).padStart(3, '0')}`,
    source: 'BandReady Core (English)', tasks: x.tasks, sourceIds: x.ids,
  }));
}

// ---- write -----------------------------------------------------------------------------------------------
const save = obj => {
  const f = path.join(outDir, obj.id + '.json');
  fs.writeFileSync(f, JSON.stringify(obj, null, 2));
  report.files.push(path.basename(f));
};

readingTests.forEach((rt, i) => save(convertReadingTest(rt, i)));
listeningTests.forEach((lt, i) => save(convertListeningTest(lt, i)));
writingTests(writingPrompts).forEach(save);

// report sits next to the output folder, not inside it, so the checker does not read it as a test
const reportFile = outDir.replace(/[\\/]+$/, '') + '-report.json';
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(`${report.files.length} files written; ${report.skipped.length} skipped items (see ${path.basename(reportFile)})`);
