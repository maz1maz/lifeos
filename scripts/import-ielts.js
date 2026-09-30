#!/usr/bin/env node
// Merge the curated IELTS flashcard content into public/vocab/words.json.
// Usage: unzip ielts-content-all-45-files-COMPLETE.zip -d <dir> && node scripts/import-ielts.js <dir>
// Row format: [w, fa[], topic, level, pos, def, ex, syn[], score, exFa, defFa, senses?]
// Only meaning/pos/definition/example fields are replaced; topic, level, synonyms and score stay.
// senses (index 11) is added only when a word has more than one sense: [[pos, fa, d, df, e, ef], ...]
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/import-ielts.js <extracted-zip-dir>'); process.exit(1); }
const out = path.join(__dirname, '..', 'public', 'vocab', 'words.json');
const rows = JSON.parse(fs.readFileSync(out, 'utf8'));
const byWord = new Map(rows.map(r => [r[0].toLowerCase(), r]));

const files = fs.readdirSync(dir).filter(f => /^words-\d+\.json$/.test(f)).sort();
let updated = 0; const missing = []; const bad = [];
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const [word, senses] of Object.entries(data)) {
    const ok = Array.isArray(senses) && senses.length && senses.every(s => s && typeof s.fa === 'string' && s.fa.trim());
    if (!ok) { bad.push(f + ':' + word); continue; }
    const r = byWord.get(word.toLowerCase());
    if (!r) { missing.push(word); continue; }
    const s0 = senses[0];
    r[1] = [...new Set(senses.map(s => s.fa.trim()))];
    r[4] = s0.pos || ''; r[5] = s0.d || ''; r[6] = s0.e || ''; r[9] = s0.ef || ''; r[10] = s0.df || '';
    r.length = 11;
    if (senses.length > 1) r[11] = senses.map(s => [s.pos || '', s.fa.trim(), s.d || '', s.df || '', s.e || '', s.ef || '']);
    updated++;
  }
}
if (bad.length) { console.error('invalid entries:', bad.slice(0, 20).join(', ')); process.exit(1); }
fs.writeFileSync(out, JSON.stringify(rows));
console.log(`files ${files.length} · updated ${updated} · missing ${missing.length}${missing.length ? ' (' + missing.slice(0, 20).join(', ') + ')' : ''}`);
