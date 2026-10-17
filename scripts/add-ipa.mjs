// Adds the IPA pronunciation (US, from the CMU Pronouncing Dictionary) as column 12 of public/vocab/words.json.
// The dictionary is not kept in the repo; pass its index.js:
//   npm i --no-save cmu-pronouncing-dictionary@3.0.0
//   node scripts/add-ipa.mjs node_modules/cmu-pronouncing-dictionary/index.js
// Re-running is safe (column 12 is rewritten). Words the dictionary lacks keep no pronunciation.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const dictPath = process.argv[2];
if (!dictPath) { console.error('usage: node scripts/add-ipa.mjs <cmu-pronouncing-dictionary/index.js>'); process.exit(1); }
const { dictionary } = await import(pathToFileURL(path.resolve(dictPath)).href);

const VOWEL = { AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɜr', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u' };
const CONS = { B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' };
// legal English syllable onsets: the stress mark goes before the longest one that ends a consonant cluster
const ONSETS = new Set(['P R', 'P L', 'B R', 'B L', 'T R', 'D R', 'K R', 'K L', 'G R', 'G L', 'F R', 'F L', 'TH R', 'SH R', 'S P', 'S T', 'S K', 'S M', 'S N', 'S L', 'S W', 'T W', 'D W', 'K W', 'G W', 'TH W', 'P Y', 'B Y', 'F Y', 'K Y', 'M Y', 'V Y', 'HH Y', 'S P R', 'S P L', 'S T R', 'S K R', 'S K W', 'S K Y', 'S P Y']);
const legalOnset = cl => cl.length === 0 || (cl.length === 1 ? cl[0] !== 'NG' : ONSETS.has(cl.join(' ')));

function toIpa(arpa) {
  const toks = arpa.split('#')[0].trim().split(/\s+/).filter(Boolean), ms = toks.map(t => t.match(/^([A-Z]+)([012])?$/));
  if (!toks.length || ms.some(m => !m)) return null;   // entries with notes/odd symbols are skipped
  const ph = ms.map(m => ({ b: m[1], s: m[2] }));
  const vowels = ph.map((p, i) => (p.s !== undefined ? i : -1)).filter(i => i >= 0);
  const marks = new Map();
  if (vowels.length > 1) {
    vowels.forEach((vi, k) => {
      const st = ph[vi].s; if (st !== '1' && st !== '2') return;
      let start = 0;
      if (k > 0) { const prev = vowels[k - 1], cl = ph.slice(prev + 1, vi).map(p => p.b); let n = cl.length; while (n > 0 && !legalOnset(cl.slice(cl.length - n))) n--; start = vi - n; }
      marks.set(start, st === '1' ? 'ˈ' : 'ˌ');
    });
  }
  return ph.map((p, i) => {
    let s = p.s === undefined ? CONS[p.b] : (p.b === 'AH' && p.s === '0' ? 'ə' : p.b === 'ER' && p.s === '0' ? 'ər' : VOWEL[p.b]);
    return s === undefined ? null : (marks.get(i) || '') + s;
  }).reduce((a, x) => (a === null || x === null ? null : a + x), '');
}
// British spellings fall back to the US form (the dictionary is American): flavour→flavor, offence→offense, maths→math
const US = w => [w, w.replace(/our$/, 'or'), w.replace(/ence$/, 'ense'), w.replace(/tre$/, 'ter'), w.replace(/ise$/, 'ize'), w.replace(/s$/, ''), w.replace(/ç/g, 'c')];
const lookup = w => { for (const v of US(w.toLowerCase())) { const a = dictionary[v]; const ipa = a && toIpa(a); if (ipa) return ipa; } return null; };
function ipaFor(word) {
  if (/[\/()]/.test(word)) return null;
  const parts = word.trim().split(/[\s-]+/).filter(Boolean);
  const out = parts.map(lookup);
  return out.every(Boolean) ? out.join(' ') : null;
}

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'vocab', 'words.json');
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
let found = 0; const missing = [];
for (const r of rows) {
  const ipa = ipaFor(r[0]);
  if (ipa) { if (r.length < 12) r[11] = null; r[12] = ipa; found++; }
  else { if (r.length > 12) r.length = 12; missing.push(r[0]); }
}
fs.writeFileSync(file, JSON.stringify(rows));
console.log(`IPA added: ${found}/${rows.length}; without: ${missing.length}`, missing.slice(0, 30).join(', '));
