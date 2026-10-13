// IELTS Listening tests: validation of an imported test, answer normalisation, marking and the raw → band table.
// Tests (questions + answer key + tapescript) live in their own kv rows, never in the repo: the book material is
// copyrighted and the repository is public. Audio is a Telegram file (like receipts) streamed by the Worker.

const NUM_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };

// Spelling must match, case and punctuation don't (a hyphen between words counts as a space); "$", "£", a leading article and number words vs digits don't matter.
export function normAnswer(s) {
  let t = String(s == null ? '' : s).toLowerCase().normalize('NFKC')
    .replace(/[’‘`´]/g, "'").replace(/[£$€]/g, ' ').replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/([a-z])-(?=[a-z])/g, '$1 ').replace(/[^a-z0-9.' -]+/g, ' ').replace(/[.'-]+(\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(a|an|the) /, '');
  return t.split(' ').map(w => (w in NUM_WORDS ? String(NUM_WORDS[w]) : w)).join(' ');
}

// Listening raw score (out of 40) → band, the commonly published IELTS conversion.
const BANDS = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1]];
export function listeningBand(raw, total) {
  const r = Math.round((Number(raw) || 0) * 40 / (Number(total) || 40));
  for (const [min, band] of BANDS) if (r >= min) return band;
  return 0;
}

const isLetter = v => typeof v === 'string' && /^[A-Z]$/.test(v);
// Question numbers asked by a test (every [n] gap, every question in a group); used to check the key covers them.
function askedNumbers(test) {
  const out = new Set();
  for (const s of test.sections) for (const g of s.groups || []) {
    for (const q of g.questions || []) out.add(Number(q.n));
    for (const line of g.lines || []) for (const m of String(line).matchAll(/\[(\d{1,3})\]/g)) out.add(Number(m[1]));
    for (const n of g.pick || []) out.add(Number(n));
  }
  return out;
}

// Returns an error string, or null when the imported test can be stored.
export function validateTest(t) {
  if (!t || typeof t !== 'object') return 'فایل آزمون نامعتبر است.';
  if (!/^[a-z0-9-]{3,40}$/.test(String(t.id || ''))) return 'شناسهٔ آزمون (id) فقط حروف کوچک انگلیسی، عدد و خط تیره.';
  if (!String(t.title || '').trim()) return 'عنوان آزمون لازم است.';
  if (!Array.isArray(t.sections) || !t.sections.length || t.sections.length > 6) return 'بخش‌های آزمون (sections) نامعتبر است.';
  if (!t.key || typeof t.key !== 'object') return 'کلید جواب‌ها (key) لازم است.';
  const asked = askedNumbers(t);
  if (!asked.size || asked.size > 60) return 'تعداد سؤال‌ها نامعتبر است.';
  for (const n of asked) {
    const k = t.key[n];
    if (Array.isArray(k) ? !k.length || k.some(x => typeof x !== 'string' || !x.trim()) : !(k && Array.isArray(k.anyOf) && k.anyOf.every(isLetter) && Array.isArray(k.group))) return `کلید سؤال ${n} نامعتبر است یا نیست.`;
  }
  return null;
}

// What the browser gets before the attempt: no key, no tapescript, no evidence lines.
export function publicTest(t) {
  const { key, tape, evidence, ...rest } = t;
  return { ...rest, total: askedNumbers(t).size };
}

// Marks one attempt. Letter questions compare letters; a pick group ("choose THREE", any order) credits each distinct
// correct letter once. Returns per-question results in question order.
export function gradeListening(test, answers) {
  const a = answers && typeof answers === 'object' ? answers : {};
  const nums = [...askedNumbers(test)].sort((x, y) => x - y);
  const usedInGroup = new Map();
  const results = nums.map(n => {
    const k = test.key[n], given = String(a[n] == null ? '' : a[n]).trim().slice(0, 120);
    let ok = false, accepted;
    if (Array.isArray(k)) {
      accepted = k;
      ok = !!given && k.some(x => isLetter(x) ? given.toUpperCase() === x : normAnswer(x) === normAnswer(given));
    } else {
      accepted = k.anyOf;
      const g = given.toUpperCase(), gid = k.group.join(','), used = usedInGroup.get(gid) || new Set();
      ok = k.anyOf.includes(g) && !used.has(g);
      if (ok) used.add(g);
      usedInGroup.set(gid, used);
    }
    return { n, given, ok, accepted };
  });
  const raw = results.filter(r => r.ok).length;
  return { raw, total: results.length, band: listeningBand(raw, results.length), results };
}
