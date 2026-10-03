/* =========================================================================
   IELTS 7000 Flashcards  —  single-file app
   Data: WORDS  (injected by build/bundle.py)
   Features: Leitner SRS, flip cards, TTS, quiz (2 modes), browse + edit,
             stats, export/import, daily goals, keyboard shortcuts
   ========================================================================= */
(() => {
"use strict";

let DECK = [];
const BASE = "ielts7000.v1";
const KACC = BASE + ".accounts";      // user table
const KCUR = BASE + ".current";       // remembered session
const KEY = BASE;                     // legacy single-profile key (migrated on first signup)
const DAY = 86400000;
const MIN = 60000;
/* Leitner boxes: 1..6 — interval to the next review */
const INTERVALS = [0, 10 * MIN, 1 * DAY, 3 * DAY, 7 * DAY, 21 * DAY, 60 * DAY];
const BOX_LABEL = ["", "جعبه ۱ (دقیقه‌ای)", "جعبه ۲ (۱ روز)", "جعبه ۳ (۳ روز)", "جعبه ۴ (۱ هفته)", "جعبه ۵ (۳ هفته)", "تسلط (۲ ماه)"];

/* ------------------------------------------------------------------ state */
const DEF = () => ({
  v: 1,
  cards: {},                 // word -> {b, due, seen, good, bad, last, fa}
  settings: { dailyNew: 15, dailyGoal: 60, order: "mix", autoSpeak: true, autoRepeat: 1, rate: .95, theme: "dark" },
  days: {},                  // yyyy-mm-dd -> {r: reviews, n: new}
  stars: [],
  quiz: { rounds: 0, best: 0, correct: 0, total: 0 },
});
let S = DEF();
let USER = null;                       // current username
const keyFor = u => BASE + "::" + u;

/* Safe storage helper: supports localStorage, fallback to sessionStorage, or in-memory map
   when running locally with restrictive file:// policies or incognito mode */
const memStore = {};
const Store = {
  get(key) {
    try {
      if (typeof localStorage !== "undefined") {
        const v = localStorage.getItem(key);
        if (v !== null) return v;
      }
    } catch (e) {}
    try {
      if (typeof sessionStorage !== "undefined") {
        const v = sessionStorage.getItem(key);
        if (v !== null) return v;
      }
    } catch (e) {}
    return memStore[key] !== undefined ? memStore[key] : null;
  },
  set(key, val) {
    memStore[key] = String(val);
    let saved = false;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, String(val));
        saved = true;
      }
    } catch (e) {}
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(key, String(val));
        saved = true;
      }
    } catch (e) {}
    return saved;
  },
  remove(key) {
    delete memStore[key];
    try { if (typeof localStorage !== "undefined") localStorage.removeItem(key); } catch (e) {}
    try { if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key); } catch (e) {}
  }
};

function load(forUser) {
  try {
    const raw = Store.get(keyFor(forUser || USER));
    if (!raw) return DEF();
    const o = JSON.parse(raw);
    const d = DEF();
    return { ...d, ...o, settings: { ...d.settings, ...(o.settings || {}) }, quiz: { ...d.quiz, ...(o.quiz || {}) } };
  } catch (e) { return DEF(); }
}
let saveTimer = null;
function save(now) {
  if (!USER) return;
  clearTimeout(saveTimer);
  const run = () => { Store.set(keyFor(USER), JSON.stringify(S)); pushRemote(now); };
  now ? run() : (saveTimer = setTimeout(run, 250));
}
/* LifeOS sync: progress lives on the server (per LifeOS account); the browser copy is only a cache. */
let pushTimer = null, pushing = false, dirty = false;
function pushRemote(now) {
  dirty = true; clearTimeout(pushTimer);
  const go = () => {
    if (pushing) { pushTimer = setTimeout(go, 800); return; }
    pushing = true; dirty = false;
    fetch("/api/vocab", { method: "PUT", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: S }) })
      .then(r => { if (!r.ok) throw 0; syncNote(""); }).catch(() => { dirty = true; syncNote("ذخیره روی سرور نشد — دوباره تلاش می‌شود"); pushTimer = setTimeout(go, 15000); })
      .finally(() => { pushing = false; });
  };
  now ? go() : (pushTimer = setTimeout(go, 1500));
}
function syncNote(t) { const el = document.getElementById("syncNote"); if (el) el.textContent = t; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && dirty && USER) { clearTimeout(pushTimer); try { navigator.sendBeacon && fetch("/api/vocab", { method: "PUT", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: S }) }); dirty = false; } catch (e) {} } });
const today = () => {
  const d = new Date(), y = d.getFullYear();
  return y + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
function dayRec() { return (S.days[today()] = S.days[today()] || { r: 0, n: 0 }); }
function cardOf(w) { return S.cards[w]; }
function boxOf(w) { const c = S.cards[w]; return c ? c.b : 0; }
function isMastered(w) { return boxOf(w) >= 6; }
function isLearning(w) { const b = boxOf(w); return b > 0 && b < 6; }
function meaningsOf(w) { const c = S.cards[w]; return (c && c.fa && c.fa.length) ? c.fa : (w.fa || []); }
function byWord(w) { return DECK.find(x => x.w === w); }

/* ---------------------------------------------------------------- helpers */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const SPK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="vertical-align:-2px"><path d="M4 9v6h3.5L12 19V5L7.5 9H4zm11.5-.9v7.8a4 4 0 0 0 0-7.8zm0-3.6v2.1a6 6 0 0 1 0 10.8v2.1a8 8 0 0 0 0-15z"/></svg>';
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fa = n => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 2200);
}
function levelClass(lv) { return ({ A1: "b3", A2: "b3", B1: "b2", B2: "b2", C1: "b1", C2: "b1" })[lv] || ""; }

/* ------------------------------------------------------------------ speech */
let voice = null;
let speechTurn = 0;                  // invalidates queued repetitions on navigation
const hasTTS = () => typeof window.speechSynthesis !== "undefined" && !!window.speechSynthesis &&
  typeof window.speechSynthesis.speak === "function" && typeof window.SpeechSynthesisUtterance === "function";
function pickVoice() {
  if (!hasTTS() || typeof speechSynthesis.getVoices !== "function") return;
  const vs = speechSynthesis.getVoices() || [];
  voice = vs.find(v => /en[-_]GB/i.test(v.lang)) || vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if (hasTTS()) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function stopSpeaking() {
  speechTurn++;
  if (hasTTS()) try { speechSynthesis.cancel(); } catch (e) {}
}
function speak(text, repeats = 1, automatic = false) {
  // Auto-speech can be disabled without disabling the pronunciation buttons.
  if (automatic && !S.settings.autoSpeak) return;
  if (!hasTTS()) { if (!automatic) toast("تلفظ صوتی در این مرورگر پشتیبانی نمی‌شود"); return; }
  if (!text) return;
  const n = Math.max(1, Math.min(3, Math.round(Number(repeats) || 1)));
  stopSpeaking();
  const turn = speechTurn;
  let played = 0;
  const playNext = () => {
    if (turn !== speechTurn || played >= n) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice ? voice.lang : "en-GB";
    utterance.rate = S.settings.rate;
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      played++;
      if (played < n && turn === speechTurn) setTimeout(playNext, 260);
    };
    utterance.onerror = () => { /* do not repeat a failed voice endlessly */ };
    try { speechSynthesis.speak(utterance); }
    catch (e) { if (!automatic) toast("پخش تلفظ ممکن نشد"); }
  };
  playNext();
}
function autoSpeak(text) {
  if (S.settings.autoSpeak) speak(text, S.settings.autoRepeat, true);
}

/* -------------------------------------------------------------- srs engine */
function rate(w, kind) {
  const c = S.cards[w] || (S.cards[w] = { b: 0, due: 0, seen: 0, good: 0, bad: 0, last: 0, fa: null });
  const d = dayRec();
  c.seen++; c.last = Date.now();
  const b = c.b || 1;
  if (kind === "again") { c.b = 1; c.bad++; c.due = Date.now() + INTERVALS[1]; }
  else if (kind === "hard") { c.b = Math.max(1, b); c.good++; c.bad++; c.due = Date.now() + Math.round(INTERVALS[Math.max(1, b)] * .7); }
  else if (kind === "good") { c.b = Math.min(6, b + 1); c.good++; c.due = Date.now() + INTERVALS[c.b]; }
  else { c.b = Math.min(6, b + 2); c.good++; c.due = Date.now() + Math.round(INTERVALS[c.b] * 1.25); }
  d.r++;
  save(); return c;
}
function nextCard(list) {
  const now = Date.now();
  const due = list.filter(x => S.cards[x.w] && S.cards[x.w].due <= now)
    .sort((a, b) => S.cards[a.w].due - S.cards[b.w].due);
  if (due.length) return due[0];
  const fresh = dayRec().n >= S.settings.dailyNew ? [] :
    // ultra-common function words (the / of / to ...) are pushed to the end:
    // they carry little value for a band-7 candidate
    list.filter(x => !S.cards[x.w]).sort((a, b) => {
      if (S.settings.order === "rand") return Math.random() - .5;
      if (S.settings.order === "freq") return (a.z >= 6.4) - (b.z >= 6.4) || b.z - a.z;
      const ka = (a.z >= 6.4 ? 1 : 0), kb = (b.z >= 6.4 ? 1 : 0);
      return ka - kb || (0.55 + Math.random()) * (b.z - a.z);   // mix
    });
  if (fresh.length) return fresh[0];
  // nothing due & no new allowance -> earliest scheduled card
  const up = list.filter(x => S.cards[x.w]).sort((a, b) => S.cards[a.w].due - S.cards[b.w].due);
  return up[0] || list[0] || null;
}
function newCount(list) { return dayRec().n >= S.settings.dailyNew ? 0 : list.filter(x => !S.cards[x.w]).length; }
function dueCount(list) { const n = Date.now(); return list.filter(x => S.cards[x.w] && S.cards[x.w].due <= n).length; }

/* ---------------------------------------------------------------- filtering */
let FILTER = { topic: "all", lv: "all", starsOnly: false };
function filtered() {
  return DECK.filter(x =>
    (FILTER.topic === "all" || x.t === FILTER.topic) &&
    (FILTER.lv === "all" || x.lv === FILTER.lv) &&
    (!FILTER.starsOnly || S.stars.includes(x.w))
  );
}
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
// topic counts follow the chosen level, so «C2 → عمومی» shows how many C2 words that topic has
function topics() {
  const m = new Map();
  DECK.forEach(x => { if (FILTER.lv === "all" || x.lv === FILTER.lv) m.set(x.t, (m.get(x.t) || 0) + 1); });
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

/* ================================================================ VIEWS */
let VIEW = "study";

function render() {
  $$(".tab").forEach(t => t.classList.toggle("on", t.dataset.v === VIEW));
  $$(".view").forEach(v => v.classList.toggle("hide", v.id !== "v-" + VIEW));
  const fc = $("#filterCard"); if (fc) fc.classList.toggle("hide", VIEW === "notes");   // level/topic filters do not apply to the notes
  if (VIEW === "study") renderStudy();
  if (VIEW === "quiz") renderQuizHome();
  if (VIEW === "browse") renderBrowse();
  if (VIEW === "notes") renderNotes();
  if (VIEW === "stats") renderStats();
  if (VIEW === "settings") renderSettings();
}


/* ---------------------------------------------------------------- notes
   «جزوه»: the private-class notes in notes.md (topic → vocabulary tables + grammar),
   collapsible by topic, searchable in English and Persian, with 🔊 on English words. */
let NOTES = null, notesQ = "";
const ntInline = t => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
// "colleague / co-worker (n.)" → "colleague"; "boss = manager" → "boss"
const ntSay = t => String(t).replace(/\([^)]*\)/g, "").split(/\s[\/=]\s|\s*\/\s*|\s=\s/)[0].replace(/[*`]/g, "").trim();
function ntBlocks(lines) {
  let html = "", i = 0;
  const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^###\s/.test(l)) { html += `<h4>${ntInline(l.replace(/^###\s+/, ""))}</h4>`; i++; continue; }
    if (/^\|/.test(l.trim())) {
      const rows = []; while (i < lines.length && /^\|/.test(lines[i].trim())) rows.push(lines[i++]);
      const head = cells(rows[0]), body = rows.slice(/^\|[\s:|-]+\|?$/.test((rows[1] || "").trim()) ? 2 : 1).map(cells);
      const enCol = head.findIndex(h => /^english$/i.test(h));
      html += `<div class="nt-tw"><table><thead><tr>${head.map(h => `<th>${ntInline(h)}</th>`).join("")}</tr></thead><tbody>` +
        body.map(r => `<tr>${r.map((c, k) => k === enCol ? `<td class="nt-en"><button type="button" data-say="${esc(ntSay(c))}" aria-label="تلفظ">🔊</button>${ntInline(c)}</td>` : `<td dir="auto">${ntInline(c)}</td>`).join("")}</tr>`).join("") + "</tbody></table></div>";
      continue;
    }
    if (/^\s*([-*]|\d+[.)])\s/.test(l)) {
      const items = []; while (i < lines.length && /^\s*([-*]|\d+[.)])\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+[.)])\s+/, ""));
      html += `<ul>${items.map(t => `<li>${ntInline(t)}</li>`).join("")}</ul>`; continue;
    }
    const para = []; while (i < lines.length && lines[i].trim() && !/^(###\s|\||\s*([-*]|\d+[.)])\s)/.test(lines[i])) para.push(lines[i++]);
    html += `<p>${ntInline(para.join(" "))}</p>`;
  }
  return html;
}
function ntParse(md) {
  const lines = md.replace(/\r/g, "").split("\n"), out = { title: "", sections: [] };
  let cur = null;
  for (const l of lines) {
    if (/^#\s/.test(l)) { out.title = l.replace(/^#\s+/, ""); continue; }
    if (/^##\s/.test(l)) { cur = { title: l.replace(/^##\s+/, ""), lines: [] }; out.sections.push(cur); continue; }
    if (cur) cur.lines.push(l);
  }
  out.sections.forEach(x => { x.html = ntBlocks(x.lines); x.words = x.lines.filter(l => /^\|/.test(l.trim()) && !/^\|[\s:|-]+\|?$/.test(l.trim())).length; });
  return out;
}
async function renderNotes() {
  const box = $("#notesMain");
  if (!NOTES) {
    box.innerHTML = `<p class="muted pad">در حال بارگذاری جزوه…</p>`;
    try { await loadNotes(); }
    catch (e) { box.innerHTML = `<p class="muted pad">جزوه بارگذاری نشد.</p>`; return; }
    if (VIEW !== "notes") return;
  }
  box.innerHTML = `<div class="nt-top"><input id="ntQ" type="search" placeholder="جستجو در جزوه (انگلیسی یا فارسی)…" value="${esc(notesQ)}" autocomplete="off"><span class="muted" id="ntN"></span><button type="button" class="btn sm" id="ntPdf" title="نسخهٔ چاپی / PDF">PDF ⬇</button></div>` +
    NOTES.sections.map((x, k) => `<details class="nt-sec"${k === 0 ? " open" : ""}><summary>${ntInline(x.title)}${x.words > 2 ? `<em>${x.words.toLocaleString("fa-IR")} ردیف</em>` : ""}</summary><div class="nt-body">${x.html}</div></details>`).join("");
  const q = $("#ntQ");
  q.oninput = () => { notesQ = q.value; ntFilter(); };
  $("#ntPdf").onclick = ntPdf;
  box.onclick = e => { const b = e.target.closest("button[data-say]"); if (b) { e.preventDefault(); speak(b.dataset.say); } };
  ntFilter();
}
/* Printable booklets (notes / starred words) → the browser's «Save as PDF». Colours follow the current LifeOS theme. */
const NT_PARTS = [
  [/^واژگان تکمیلی[^:]*:\s*/, "بخش چهارم — واژگان تکمیلی (جلسه ۲۳)"],
  [/^تمرین گفتاری:\s*/, "بخش سوم — تمرین گفتاری"],
  [/^(گرامر:\s*|(?=جمع‌بندی))/, "بخش دوم — گرامر کامل"],
  [/^(واژگان:\s*|(?=تلفظ))/, "بخش اول — واژگان"],
];
function printBook({ title, kicker, heading, sub, toc, body }) {
  const dark = document.documentElement.dataset.mode !== "light";
  const C = dark
    ? { page: "#0a0a0b", paper: "#141416", soft: "#1b1b1d", line: "rgba(255,255,255,.12)", tx: "#f5f5f5", tx2: "#9a9a9f", acc: "#d8a44c", accfg: "#221904", head: "#e6b563" }
    : { page: "#f4f2ee", paper: "#ffffff", soft: "#f3f0ea", line: "rgba(28,26,23,.14)", tx: "#1c1a17", tx2: "#6b665e", acc: "#c48a2c", accfg: "#ffffff", head: "#8a5d14" };
  const font = f => new URL("/assets/fonts/vazirmatn-" + f + ".woff2", location.href).href;
  const logo = new URL("/assets/img/logo-mask.png", location.href).href;
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
@font-face{font-family:V;font-weight:100 900;src:url('${font("arabic")}') format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200F,U+FB50-FDFF,U+FE70-FEFC}
@font-face{font-family:V;font-weight:100 900;src:url('${font("latin")}') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02B0-02FF,U+2000-206F,U+2122,U+2212}
@page{size:A4;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;background:${C.page};color:${C.tx};font-family:V,Tahoma,sans-serif;font-size:12.5px;line-height:1.85}
.bar{position:sticky;top:0;z-index:2;display:flex;gap:10px;align-items:center;justify-content:center;padding:10px;background:${C.acc};color:${C.accfg};font-size:14px}
.bar button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:8px 18px;background:${C.paper};color:${C.tx};cursor:pointer}
main{max-width:210mm;margin:0 auto;padding:12mm 12mm}
.cover{min-height:272mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always}
.cover .logo{width:60px;height:60px;margin-bottom:22px;background:${C.acc};-webkit-mask:url('${logo}') center/contain no-repeat;mask:url('${logo}') center/contain no-repeat}
.cover .k{color:${C.acc};font-weight:700;font-size:13px}
.cover h1{color:${C.tx};font-size:38px;line-height:1.45;margin:14px 0}
.cover p{color:${C.tx2};font-size:15px;max-width:120mm;margin:0}
.cover i{display:block;width:60px;height:4px;border-radius:4px;background:${C.acc};margin:36px auto 0}
.toc{page-break-after:always}
h2{color:${C.tx};font-size:22px;margin:0 0 10px;padding-bottom:10px;border-bottom:2px solid ${C.acc}}
.toc h2{border:0}
.tp{color:${C.acc};font-weight:700;font-size:11px;margin:16px 0 4px}
.tr{display:flex;gap:16px;padding:9px 0;border-bottom:1px dotted ${C.line};font-size:13.5px;break-inside:avoid}
.tr b{color:${C.acc};min-width:20px}
.pg{page-break-before:always}
.kick{color:${C.acc};font-weight:700;font-size:11px;margin-bottom:6px}
h4{color:${C.head};font-size:15px;margin:20px 0 10px;padding-inline-start:10px;border-inline-start:4px solid ${C.acc};break-after:avoid}
p,li{font-size:13px}
ul{padding-inline-start:20px}
table{width:100%;border-collapse:collapse;margin:4px 0 14px;font-size:12px;background:${C.paper};border-radius:10px;overflow:hidden}
thead{display:table-header-group}
th{background:${C.acc};color:${C.accfg};text-align:start;padding:9px 10px;font-weight:700}
td{padding:8px 10px;border-bottom:1px solid ${C.line};vertical-align:top}
tr{break-inside:avoid}
tbody tr:nth-child(even){background:${C.soft}}
td.nt-en,td.en{direction:ltr;text-align:left;font-weight:600}
td+td{border-inline-start:1px solid ${C.line}}
td.ex{direction:ltr;text-align:left;color:${C.tx2}}
button[data-say]{display:none}
code{direction:ltr;unicode-bidi:isolate;background:${C.soft};border-radius:4px;padding:0 4px}
strong{color:${C.head}}
@media print{.bar{display:none}}
</style></head><body>
<div class="bar"><span>برای PDF، در پنجرهٔ چاپ «Save as PDF» را بزن · گزینهٔ «Background graphics» روشن باشد</span><button type="button" onclick="print()">چاپ / PDF</button></div>
<main>
<div class="cover"><div class="logo"></div><div class="k">${kicker}</div><h1>${heading}</h1><p>${sub}</p><i></i></div>
${toc ? `<div class="toc"><h2>فهرست مطالب</h2>${toc}</div>` : ""}
${body}
</main>
<script>document.fonts.ready.then(function(){setTimeout(function(){print()},400)})<\/script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast("پنجرهٔ تازه باز نشد؛ اجازهٔ پاپ‌آپ را بده."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
function ntPdf() {
  if (!NOTES) return;
  const secs = NOTES.sections.map(x => {
    for (const [re, part] of NT_PARTS) if (re.test(x.title)) return { ...x, part, name: x.title.replace(re, "") };
    return { ...x, part: "", name: x.title };
  });
  let n = 0, lastPart = "", toc = "", body = "";
  for (const x of secs) {
    if (!x.part) { body += `<section class="pg"><h2>${ntInline(x.name)}</h2>${x.html}</section>`; continue; }
    const no = String(++n).padStart(2, "0");
    if (x.part !== lastPart) { toc += `<div class="tp">${esc(x.part)}</div>`; lastPart = x.part; }
    toc += `<div class="tr"><b>${no}</b><span>${ntInline(x.name)}</span></div>`;
    body += `<section class="pg"><div class="kick">${esc(x.part.replace(" — ", " · "))}</div><h2>${ntInline(x.name)}</h2>${x.html}</section>`;
  }
  printBook({ title: "جزوه زبان — واژگان و گرامر", kicker: "جزوه خصوصی زبان انگلیسی · آماده‌سازی آیلتس", heading: "واژگان و گرامر<br>مرتب‌شده", sub: "بازنویسی و دسته‌بندی موضوعی ۱۴۴ صفحه یادداشت دست‌نویس کلاس خصوصی زبان", toc, body });
}
function starsPdf() {
  const words = DECK.filter(x => S.stars.includes(x.w));
  if (!words.length) { toast("هنوز واژهٔ ستاره‌داری نداری."); return; }
  const byLv = {};
  words.forEach(x => (byLv[x.lv] ||= []).push(x));
  const body = Object.keys(byLv).sort().map((lv, k) => `<section style="margin-top:${k ? 18 : 0}px"><div class="kick">واژه‌های ستاره‌دار</div><h2>سطح ${esc(lv)} <small style="font-size:13px;font-weight:400">(${fa(byLv[lv].length)} واژه)</small></h2>
    <table><thead><tr><th>English</th><th>معنی</th><th>مثال</th></tr></thead><tbody>${byLv[lv].sort((a, b) => a.w.localeCompare(b.w)).map(x => `<tr><td class="en">${esc(x.w)}${x.p ? `<br><small style="font-weight:400">${esc(x.p)}</small>` : ""}</td><td>${esc(meaningsOf(x).slice(0, 3).join("، "))}</td><td class="ex">${esc(x.e || "")}${x.ef ? `<div dir="rtl" style="text-align:right">${esc(x.ef)}</div>` : ""}</td></tr>`).join("")}</tbody></table></section>`).join("");
  printBook({ title: "واژه‌های ستاره‌دار", kicker: "۷۰۰۰ واژهٔ آیلتس", heading: "واژه‌های<br>ستاره‌دار من", sub: `${fa(words.length)} واژه · مرتب بر اساس سطح`, toc: "", body: `<div style="page-break-before:auto">${body}</div>` });
}
function ntFilter() {
  const q = notesQ.trim().toLowerCase(), secs = $$("#notesMain .nt-sec");
  let hits = 0;
  secs.forEach(sec => {
    if (!q) { sec.style.display = ""; sec.querySelectorAll("tr,p,li,h4,.nt-tw").forEach(e => e.style.display = ""); return; }
    let n = 0;
    sec.querySelectorAll("tbody tr,.nt-body>p,.nt-body li").forEach(e => { const ok = e.textContent.toLowerCase().includes(q); e.style.display = ok ? "" : "none"; if (ok) n++; });
    sec.querySelectorAll(".nt-tw").forEach(t => t.style.display = t.querySelector("tbody tr:not([style*='none'])") ? "" : "none");
    sec.querySelectorAll(".nt-body>h4").forEach(h => h.style.display = "none");
    sec.style.display = n || sec.querySelector("summary").textContent.toLowerCase().includes(q) ? "" : "none";
    if (n) sec.open = true;
    hits += n;
  });
  const N = $("#ntN"); if (N) N.textContent = q ? `${hits.toLocaleString("fa-IR")} مورد` : "";
}

/* ---------------------------------------------------------------- study */
let cur = null, flipped = false, session = { n: 0, again: 0 };

function renderStudy() {
  const list = filtered();
  if (!list.length) { $("#studyMain").innerHTML = `<div class="card pad">برای این فیلتر واژه‌ای نیست. فیلترها را عوض کن.</div>`; return; }
  if (!cur || !list.some(x => x.w === cur.w)) { cur = nextCard(list); flipped = false; }
  const today_ = dayRec();
  const goal = Math.max(1, S.settings.dailyGoal);
  const pct = Math.min(100, Math.round(today_.r / goal * 100));
  const done = Object.keys(S.cards).filter(isMastered).length;

  $("#studyMain").innerHTML = `
  <div class="grid g4" style="margin-bottom:12px">
    <div class="stat"><b>${fa(dueCount(list))}</b><span>واژه آمادهٔ مرور</span></div>
    <div class="stat"><b>${fa(newCount(list))}</b><span>واژهٔ نو (سهم امروز)</span></div>
    <div class="stat"><b>${fa(done)}</b><span>واژهٔ تسلط‌یافته</span></div>
    <div class="stat"><b>${fa(today_.r)}</b><span>مرور امروز (هدف: ${fa(goal)})</span></div>
  </div>
  <div class="bar" title="پیشرفت هدف امروز"><i style="width:${pct}%"></i></div>

  <div class="fcwrap"><div class="fc ${flipped ? "flip" : ""}" id="fc">
    <div class="face front">
      <div class="between">
        <span class="row" style="gap:6px"><span class="pill ${levelClass(cur.lv)}">${esc(cur.lv)}</span>${cur.t ? `<span class="pill">${esc(cur.t)}</span>` : ""}</span>
        <span class="row" style="gap:6px">
          ${cur.p ? `<span class="pill">${esc(cur.p)}</span>` : ""}
          <span class="pill" style="cursor:pointer" id="starBtn" title="ستاره‌دار کردن">${S.stars.includes(cur.w) ? "★" : "☆"}</span>
        </span>
      </div>
      <div style="text-align:center;margin-top:26px">
        <h1 class="word en">${esc(cur.w)}</h1>
        <div class="row" style="justify-content:center;margin-top:16px">
          <button class="btn sm" id="speakBtn" title="هر بار برای شنیدن دوباره بزن">${SPK} تلفظ</button>
          <button class="btn sm" id="repeatBtn" title="سه بار پشت‌سرهم پخش کن">↻ ۳ بار</button>
          <span class="muted">${boxOf(cur.w) ? BOX_LABEL[boxOf(cur.w)] : "واژهٔ نو"}</span>
        </div>
      </div>
      <div class="progline" style="position:absolute;inset-inline:22px;bottom:18px">
        ${[1,2,3,4,5,6].map(i => `<span class="dot ${boxOf(cur.w) >= i ? "on" : ""}"></span>`).join("")}
      </div>
      <div class="muted" style="position:absolute;inset-inline:22px;bottom:34px;text-align:center">
        برای دیدن معنی، روی کارت بزن<span class="kbonly"> یا <span class="kbd">Space</span> بزن</span>
      </div>
    </div>

    <div class="face back">
      <div class="between">
        <span class="row" style="gap:6px"><span class="pill ${levelClass(cur.lv)}">${esc(cur.lv)}</span>${cur.t ? `<span class="pill">${esc(cur.t)}</span>` : ""}</span>
        <span class="row" style="gap:6px">${cur.p ? `<span class="pill">${esc(cur.p)}</span>` : ""}</span>
      </div>
      <div style="text-align:center;margin-top:10px">
        <div class="en muted" style="font-size:20px;font-weight:700">${esc(cur.w)}</div>
        <div class="meaning">${meaningsOf(cur).map(esc).join(" • ") || "—"}</div>
      </div>
      ${cur.d ? `<div class="def def-c"><span class="defen en">${esc(cur.d)}</span>${cur.df ? `<span class="deffa">${esc(cur.df)}</span>` : ""}</div>` : ""}
      ${cur.e ? `<div class="exbox"><div class="ex">“${esc(cur.e)}”</div>${cur.ef ? `<div class="exfa">${esc(cur.ef)}</div>` : ""}</div>` : ""}
      ${sensesHtml(cur)}
      ${(cur.s && cur.s.length) ? `<div class="syn"><span class="muted syn-l">هم‌معنی:</span>${cur.s.map(x => `<span class="pill en">${esc(x)}</span>`).join("")}</div>` : ""}
      <div class="row" style="margin-top:14px">
        <button class="btn sm" id="speakBtn2">${SPK} تلفظ</button>
        <button class="btn sm" id="repeatBtn2">↻ ۳ بار</button>
      </div>
    </div>
  </div></div>

  <div class="swhint">کشیدن کارت به راست = بلد بودم · به چپ = نمی‌دانستم</div>
  <div class="ratebar">
    <button class="btn bad" data-r="again">۱ — نمی‌دانستم<br><span class="muted">۱۰ دقیقهٔ دیگر</span></button>
    <button class="btn warn" data-r="hard">۲ — سخت بود<br><span class="muted">کوتاه‌تر</span></button>
    <button class="btn ok" data-r="good">۳ — خوب بود<br><span class="muted">مرور بعدی</span></button>
    <button class="btn pri" data-r="easy">۴ — آسان<br><span class="muted">فاصلهٔ بلندتر</span></button>
  </div>
  <div class="row" style="margin-top:10px;justify-content:center">
    <button class="btn sm ghost" id="prevBtn">قبلی</button>
    <button class="btn sm ghost" id="skipBtn">پرش به واژهٔ بعد</button>
    <span class="muted kbonly">میان‌بر: <span class="kbd">Space</span> برگرداندن · <span class="kbd">۱..۴</span> ارزیابی · <span class="kbd">S</span> تلفظ</span>
  </div>`;

  // events
  const fc = $("#fc");
  const flip = () => { flipped = !flipped; fc.classList.toggle("flip", flipped); };
  fc.addEventListener("click", e => {
    if (e.target.closest("button")) return;
    flip();
  });
  // phone: swipe the card right = «خوب بود», left = «نمی‌دانستم»
  let sx = null, sy = 0, dx = 0;
  fc.addEventListener("touchstart", e => { if (e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; fc.style.transition = "none"; }, { passive: true });
  fc.addEventListener("touchmove", e => {
    if (sx === null) return;
    dx = e.touches[0].clientX - sx;
    if (Math.abs(e.touches[0].clientY - sy) > Math.abs(dx)) { dx = 0; fc.style.transform = ""; return; }
    fc.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)${flipped ? " rotateY(180deg)" : ""}`;
    fc.classList.toggle("sw-r", dx > 70); fc.classList.toggle("sw-l", dx < -70);
  }, { passive: true });
  fc.addEventListener("touchend", () => {
    if (sx === null) return; sx = null;
    fc.style.transition = ""; fc.style.transform = ""; fc.classList.remove("sw-r", "sw-l");
    if (Math.abs(dx) > 70) { flipped = true; const b = $(`.ratebar [data-r="${dx > 0 ? "good" : "again"}"]`); if (b) b.click(); }
  });
  $("#speakBtn") && $("#speakBtn").addEventListener("click", () => speak(cur.w));
  $("#speakBtn2") && $("#speakBtn2").addEventListener("click", () => speak(cur.w));
  $("#repeatBtn").addEventListener("click", () => speak(cur.w, 3));
  $("#repeatBtn2").addEventListener("click", () => speak(cur.w, 3));
  $("#starBtn").addEventListener("click", () => toggleStar(cur.w));
  $("#editBtn") && $("#editBtn").addEventListener("click", () => editCard(cur.w));
  $("#prevBtn").addEventListener("click", () => { stopSpeaking(); flipped = false; cur = nextCard(list); renderStudy(); });
  $("#skipBtn").addEventListener("click", () => { stopSpeaking(); flipped = false; cur = pickOther(list, cur.w); renderStudy(); });
  $$(".ratebar .btn").forEach(b => b.addEventListener("click", () => {
    if (!flipped) { flip(); return; }
    const w = cur.w, wasNew = !S.cards[w];
    stopSpeaking();
    rate(w, b.dataset.r);
    if (wasNew) dayRec().n++;
    session.n++;
    if (b.dataset.r === "again") session.again++;
    flipped = false;
    const nxt = nextCard(list);
    cur = (nxt && nxt.w !== w) ? nxt : pickOther(list, w);
    renderStudy();
    save();
  }));
  if (cur && !flipped) autoSpeak(cur.w);
}
function pickOther(list, w) {
  const rest = list.filter(x => x.w !== w);
  return rest.length ? rest[Math.floor(Math.random() * rest.length)] : (list[0] || null);
}
function toggleStar(w) {
  const i = S.stars.indexOf(w);
  i >= 0 ? S.stars.splice(i, 1) : S.stars.push(w);
  save(true); renderStudy(); toast(i >= 0 ? "ستاره برداشته شد" : "ستاره‌دار شد ★");
}

/* ------------------------------------------------------------- edit card */
function editCard(w) {
  const c = byWord(w);
  const m = document.createElement("div");
  m.className = "mask";
  m.innerHTML = `<div class="card pad modal">
    <h3 class="en">${esc(w)}</h3>
    <div class="muted" style="margin-bottom:8px">معنی‌های این واژه را می‌توانی اصلاح کنی؛ با ویرگول جدا کن. این تغییر فقط برای تو ذخیره می‌شود.</div>
    <textarea id="faEdit" rows="3">${esc(meaningsOf(w).join("، "))}</textarea>
    <div class="row" style="margin-top:12px;justify-content:flex-end">
      <button class="btn ghost" id="mCancel">انصراف</button>
      <button class="btn pri" id="mSave">ذخیره</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", e => { if (e.target === m) m.remove(); });
  $("#mCancel").onclick = () => m.remove();
  $("#mSave").onclick = () => {
    const val = $("#faEdit").value.split(/[،,]/).map(s => s.trim()).filter(Boolean);
    const c2 = S.cards[w] || (S.cards[w] = { b: 0, due: 0, seen: 0, good: 0, bad: 0, last: 0, fa: null });
    c2.fa = val.length ? val : null;
    save(true); m.remove(); renderStudy(); toast("ذخیره شد");
  };
}

/* ------------------------------------------------------------------ quiz */
let quiz = null;
function renderQuizHome() {
  $("#quizMain").innerHTML = `
  <div class="card pad">
    <h2>آزمون</h2>
    <div class="muted" style="margin-bottom:12px">۱۰ پرسش چهارگزینه‌ای از واژه‌هایی که در همین فیلتر انتخاب کرده‌ای. گزینه‌های غلط از واژه‌های هم‌سطح ساخته می‌شوند.</div>
    <div class="grid g3">
      <div><label class="f">جهت پرسش</label>
        <select id="qdir"><option value="en2fa">انگلیسی ← فارسی</option><option value="fa2en">فارسی ← انگلیسی</option><option value="mix">ترکیبی</option></select></div>
      <div><label class="f">دامنهٔ واژه‌ها</label>
        <select id="qpool"><option value="all">همهٔ واژه‌های فیلترشده</option><option value="seen">واژه‌های دیده‌شده</option><option value="star">فقط ستاره‌دار</option><option value="box">در جعبه‌های مرور</option></select></div>
      <div><label class="f">تعداد پرسش</label>
        <select id="qlen"><option>10</option><option>20</option><option>30</option></select></div>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn pri" id="qStart">شروع آزمون</button>
      <span class="muted">بهترین نتیجه: ${fa(S.quiz.best)}% از ${fa(S.quiz.rounds)} دوره</span>
    </div>
  </div>`;
  $("#qStart").onclick = () => startQuiz($("#qdir").value, $("#qpool").value, +$("#qlen").value);
}

function startQuiz(dir, pool, len) {
  let words = filtered();
  if (pool === "seen") words = words.filter(x => S.cards[x.w]);
  if (pool === "star") words = words.filter(x => S.stars.includes(x.w));
  if (pool === "box") words = words.filter(x => isLearning(x.w));
  if (words.length < 4) { toast("برای آزمون حداقل ۴ واژه لازم است"); return; }
  const n = Math.min(len, words.length);
  const pick = words.slice().sort(() => Math.random() - .5).slice(0, n);
  quiz = { dir, i: 0, score: 0, items: pick, answered: false, log: [] };
  drawQuestion();
}

function drawQuestion() {
  const it = quiz.items[quiz.i];
  const d = quiz.dir === "mix" ? (Math.random() < .5 ? "en2fa" : "fa2en") : quiz.dir;
  const opts = makeOptions(it, d);
  quiz.cur = { it, d, opts };
  quiz.answered = false;
  $("#quizMain").innerHTML = `
  <div class="card pad">
    <div class="between" style="margin-bottom:10px">
      <span class="muted">پرسش ${fa(quiz.i + 1)} از ${fa(quiz.items.length)}</span>
      <span class="pill">امتیاز: ${fa(quiz.score)}</span>
    </div>
    <div class="bar" style="margin-bottom:16px"><i style="width:${Math.round(quiz.i / quiz.items.length * 100)}%"></i></div>
    <div style="text-align:center;margin:6px 0 16px">
      ${d === "en2fa"
        ? `<div class="word en" style="font-size:clamp(30px,6vw,44px)">${esc(it.w)}</div>
           <button class="btn sm" id="qSpeak">${SPK} تلفظ</button>
           <div class="muted" style="margin-top:8px">معنی درست کدام است؟</div>`
        : `<div class="meaning">${meaningsOf(it).map(esc).join(" • ")}</div>
           <div class="muted" style="margin-top:8px">معادل انگلیسی درست کدام است؟</div>`}
    </div>
    <div class="grid" id="qOpts" style="gap:8px">
      ${opts.map((o, i) => `<button class="qopt ${d === "fa2en" ? "en" : ""}" data-i="${i}"><span class="num">${fa(i + 1)}</span>${esc(o.text)}</button>`).join("")}
    </div>
    <div id="qAfter"></div>
  </div>`;
  $("#qSpeak") && $("#qSpeak").addEventListener("click", () => speak(it.w));
  $$("#qOpts .qopt").forEach(b => b.addEventListener("click", () => answer(+b.dataset.i)));
  if (d === "en2fa") autoSpeak(it.w);
}

function sensesHtml(w) {
  if (!w.x || w.x.length < 2) return "";
  return `<div class="senses">${w.x.slice(1).map(([p, fa, d, df, e, ef], i) => `<div class="def"><b>معنی ${i + 2}${p ? " · " + esc(p) : ""}: ${esc(fa)}</b>${d ? `<span class="defen en">${esc(d)}</span>` : ""}${df ? `<span class="deffa">${esc(df)}</span>` : ""}${e ? `<div class="ex">“${esc(e)}”</div>` : ""}${ef ? `<div class="exfa">${esc(ef)}</div>` : ""}</div>`).join("")}</div>`;
}
function label(x) { return meaningsOf(x)[0] || x.w; }
function makeOptions(it, dir) {
  const key = o => dir === "en2fa" ? label(o) : o.w;
  const right = { text: key(it), ok: true };
  const pool = DECK.filter(x => x.w !== it.w && (dir === "fa2en" ? true : x.lv === it.lv));
  const seen = new Set([right.text]);
  const wrong = [];
  for (const x of pool.sort(() => Math.random() - .5)) {
    const t = key(x);
    if (!t || seen.has(t)) continue;
    seen.add(t); wrong.push({ text: t, ok: false });
    if (wrong.length === 3) break;
  }
  return [right, ...wrong].sort(() => Math.random() - .5);
}

function answer(i) {
  if (quiz.answered) return;
  quiz.answered = true;
  const { it, opts, d } = quiz.cur;
  const ok = opts[i].ok;
  quiz.score += ok ? 1 : 0;
  quiz.log.push({ w: it.w, ok });
  S.quiz.total++; if (ok) S.quiz.correct++;
  // quiz answers also feed the SRS (lighter than a full review)
  rate(it.w, ok ? "good" : "again");
  if (!S.cards[it.w] || S.cards[it.w].seen === 1) dayRec().n++;
  save();
  $$("#qOpts .qopt").forEach((b, k) => {
    b.classList.add(opts[k].ok ? "right" : "wrong");
    if (k === i && !ok) b.classList.add("wrong");
  });
  $("#qAfter").innerHTML = `
    <div class="def" style="margin-top:14px">
      <b>${ok ? "✅ درست!" : "❌ نادرست"}</b> —
      <span class="en">${esc(it.w)}</span>: ${meaningsOf(it).map(esc).join(" • ")}
      ${it.d ? `<div class="muted en" style="margin-top:6px">${esc(it.d)}</div>` : ""}
      <div class="muted" style="margin-top:6px">${esc(it.t)} · ${esc(it.lv)}</div>
    </div>
    <div class="row" style="margin-top:12px;justify-content:flex-end">
      <button class="btn pri" id="qNext">${quiz.i + 1 === quiz.items.length ? "پایان و نتیجه" : "پرسش بعدی ⟵"}</button>
    </div>`;
  $("#qNext").onclick = () => {
    stopSpeaking();
    quiz.i++;
    if (quiz.i >= quiz.items.length) finishQuiz(); else drawQuestion();
  };
  $("#qNext").focus();
}

function finishQuiz() {
  const pct = Math.round(quiz.score / quiz.items.length * 100);
  S.quiz.rounds++; S.quiz.best = Math.max(S.quiz.best, pct); save(true);
  const wrong = quiz.log.filter(x => !x.ok).map(x => x.w);
  $("#quizMain").innerHTML = `
  <div class="card pad" style="text-align:center">
    <h2>${pct >= 90 ? "عالی بود! ✓" : pct >= 70 ? "خوب بود" : "نیاز به مرور دارد"}</h2>
    <div class="stat" style="margin:14px auto;max-width:260px">
      <b>${fa(pct)}%</b><span>${fa(quiz.score)} از ${fa(quiz.items.length)} پاسخ درست</span>
    </div>
    ${wrong.length ? `<div style="text-align:start;margin-top:14px">
      <h3>واژه‌هایی که باید مرور کنی</h3>
      <div class="row">${wrong.map(w => `<span class="pill en">${esc(w)}</span>`).join("")}</div></div>` : ""}
    <div class="row" style="justify-content:center;margin-top:16px">
      <button class="btn pri" id="qAgain">یک دورهٔ دیگر</button>
      <button class="btn ghost" id="qBack">بازگشت</button>
    </div>
  </div>`;
  $("#qAgain").onclick = () => renderQuizHome();
  $("#qBack").onclick = () => renderQuizHome();
}

/* ---------------------------------------------------------------- browse */
let shown = 60, query = "";
function renderBrowse() {
  const q = query.trim().toLowerCase();
  let list = filtered();
  if (q) list = list.filter(x => x.w.includes(q) || meaningsOf(x).some(m => m.includes(q)));
  list = list.slice();
  if (sortMode === "az") list.sort((a, b) => a.w.localeCompare(b.w));
  else if (sortMode === "dur") list.sort((a, b) => {
    const da = S.cards[a.w] ? S.cards[a.w].due : Number.MAX_SAFE_INTEGER;
    const db = S.cards[b.w] ? S.cards[b.w].due : Number.MAX_SAFE_INTEGER;
    return da - db;
  });
  else list.sort((a, b) => b.z - a.z);
  const page = list.slice(0, shown);
  $("#browseMain").innerHTML = `
  <div class="card pad">
    <div class="row" style="gap:8px">
      <input type="search" id="bq" placeholder="جست‌وجو: واژهٔ انگلیسی یا معنی فارسی…" value="${esc(query)}">
      <select id="bsort" style="width:auto"><option value="freq">ترتیب فراوانی</option><option value="az">الفبایی</option><option value="dur">زودترین مرور</option></select>
    </div>
    <div class="row" style="margin-top:10px;gap:6px">
      ${["all","A1","A2","B1","B2","C1","C2"].map(l => `<span class="chip ${FILTER.lv === l ? "on" : ""}" data-lv="${l}">${l === "all" ? "همهٔ سطوح" : l}</span>`).join("")}
      <span class="chip ${FILTER.starsOnly ? "on" : ""}" data-star="1">★ ستاره‌دار</span>
      <span class="chip" data-clear="1">پاک‌کردن فیلترها</span>
      ${S.stars.length ? `<span class="chip" data-starpdf="1" title="نسخهٔ چاپی / PDF">🖨 چاپ ستاره‌دارها (${fa(S.stars.length)})</span>` : ""}
    </div>
    <div class="muted" style="margin:10px 0">${fa(list.length)} واژه یافت شد${S.settings.dailyNew ? "" : ""}</div>
    <div style="overflow:auto;max-height:62vh">
      <table>
        <thead><tr><th>واژه</th><th>معنی</th><th>سطح</th><th>موضوع</th><th>وضعیت</th><th></th></tr></thead>
        <tbody>
          ${page.map(x => `<tr data-w="${esc(x.w)}" style="cursor:pointer">
            <td class="en" style="font-weight:700">${esc(x.w)}</td>
            <td>${esc(meaningsOf(x).slice(0, 2).join("، "))}</td>
            <td><span class="pill ${levelClass(x.lv)}">${esc(x.lv)}</span></td>
            <td class="muted">${esc(x.t)}</td>
            <td class="muted">${!S.cards[x.w] ? "نو" : isMastered(x.w) ? "مسلط" : "در حال یادگیری"}</td>
            <td style="color:var(--warn)">${S.stars.includes(x.w) ? "★" : ""}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div id="bNotes"></div>
    ${list.length > shown ? `<div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="more">نمایش ۶۰ واژهٔ بیشتر (${fa(list.length - shown)} باقی‌مانده)</button></div>` : ""}
  </div>`;
  $("#bq").addEventListener("input", e => { query = e.target.value; shown = 60; renderBrowse(); $("#bq").focus(); });
  $("#bsort").addEventListener("change", e => { shown = 60; sortMode = e.target.value; renderBrowse(); });
  $$("[data-lv]").forEach(c => c.onclick = () => { FILTER.lv = c.dataset.lv; renderFilters(); render(); });
  $$("[data-star]").forEach(c => c.onclick = () => { FILTER.starsOnly = !FILTER.starsOnly; render(); });
  $$("[data-clear]").forEach(c => c.onclick = () => { FILTER = { topic: "all", lv: "all", starsOnly: false }; query = ""; renderFilters(); render(); });
  $$("[data-starpdf]").forEach(c => c.onclick = starsPdf);
  if (q) browseNotes(q);
  const m = $("#more"); if (m) m.onclick = () => { shown += 60; renderBrowse(); };
  $$("tbody tr").forEach(tr => tr.onclick = () => wordSheet(tr.dataset.w));
}
let sortMode = "freq";
// the search box of «فهرست واژه‌ها» also looks inside the class notes (جزوه)
async function loadNotes() {
  if (!NOTES) { const r = await fetch("notes.md", { cache: "no-cache" }); if (!r.ok) throw 0; NOTES = ntParse(await r.text()); }
  return NOTES;
}
async function browseNotes(q) {
  let N; try { N = await loadNotes(); } catch (e) { return; }
  const box = $("#bNotes"); if (!box || query.trim().toLowerCase() !== q) return;
  const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const hits = [];
  for (const sec of N.sections) for (const l of sec.lines) {
    const t = l.trim();
    if (!/^\|/.test(t) || /^\|[\s:|-]+\|?$/.test(t) || /^\|\s*english\s*\|/i.test(t)) continue;
    if (t.toLowerCase().includes(q)) hits.push({ sec: sec.title.replace(/^[^:]*:\s*/, ""), c: cells(t) });
    if (hits.length >= 40) break;
  }
  box.innerHTML = hits.length ? `<div class="bn"><div class="bn-h">📒 در جزوه: ${fa(hits.length)}${hits.length >= 40 ? "+" : ""} مورد <button class="btn sm ghost" type="button" id="bnOpen">باز کردن جزوه</button></div>
    <div class="nt-tw"><table><tbody>${hits.map(h => `<tr><td class="en" style="font-weight:700">${ntInline(h.c[0] || "")}</td><td dir="auto">${h.c.slice(1).map(ntInline).join(" · ")}</td><td class="muted" style="font-size:11.5px">${ntInline(h.sec)}</td></tr>`).join("")}</tbody></table></div></div>` : "";
  const o = $("#bnOpen"); if (o) o.onclick = () => { notesQ = query; VIEW = "notes"; render(); };
}

function wordSheet(w) {
  const x = byWord(w), c = S.cards[w];
  const m = document.createElement("div");
  m.className = "mask";
  m.innerHTML = `<div class="card pad modal">
    <div class="between">
      <h2 class="en" style="margin:0">${esc(w)}</h2>
      <span class="row" style="gap:6px">${x.p ? `<span class="pill">${esc(x.p)}</span>` : ""}<span class="pill ${levelClass(x.lv)}">${esc(x.lv)}</span><span class="pill">${esc(x.t)}</span></span>
    </div>
    <div class="meaning" style="font-size:22px">${meaningsOf(x).map(esc).join(" • ")}</div>
    ${x.d ? `<div class="def"><b>تعریف</b><span class="defen en">${esc(x.d)}</span>${x.df ? `<span class="deffa">${esc(x.df)}</span>` : ""}</div>` : ""}
    ${x.e ? `<div class="exbox"><div class="ex">“${esc(x.e)}”</div>${x.ef ? `<div class="exfa">${esc(x.ef)}</div>` : ""}</div>` : ""}
    ${sensesHtml(x)}
    ${(x.s || []).length ? `<div class="syn">${x.s.map(s => `<span class="pill en">${esc(s)}</span>`).join("")}</div>` : ""}
    <div class="muted" style="margin-top:12px">
      وضعیت: ${!c ? "واژهٔ نو" : BOX_LABEL[c.b]} · مرور بعدی: ${c && c.due ? new Date(c.due).toLocaleString("fa-IR") : "—"}
      · پاسخ درست/غلط: ${c ? fa(c.good) + "/" + fa(c.bad) : "۰"}
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn sm" id="wSpeak">${SPK} تلفظ</button>
      <button class="btn sm" id="wStar">${S.stars.includes(w) ? "★ برداشتن ستاره" : "☆ ستاره‌دار کردن"}</button>
      <button class="btn sm" id="wReset">بازنشانی این کارت</button>
      <button class="btn sm pri" id="wClose">بستن</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", e => { if (e.target === m) m.remove(); });
  $("#wSpeak").onclick = () => speak(w);
  $("#wStar").onclick = () => { toggleStar(w); m.remove(); };
  $("#wReset").onclick = () => { delete S.cards[w]; save(true); m.remove(); render(); toast("کارت بازنشانی شد"); };
  $("#wClose").onclick = () => m.remove();
}

/* ----------------------------------------------------------------- stats */
function renderStats() {
  const all = DECK;
  const st = { new: 0, l: 0, m: 0 }, box = [0, 0, 0, 0, 0, 0, 0];
  all.forEach(x => { const b = boxOf(x.w); box[b]++; if (!b) st.new++; else if (b >= 6) st.m++; else st.l++; });
  const days = Object.keys(S.days).sort().slice(-21);
  const maxDay = Math.max(1, ...days.map(d => S.days[d].r));
  // streak
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = (() => { const x = new Date(); x.setDate(x.getDate() - i); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); })();
    if (S.days[d] && S.days[d].r > 0) streak++; else if (i > 0) break;
  }
  const perTopic = topics().map(([t, n]) => {
    const done = all.filter(x => x.t === t && isMastered(x.w)).length;
    const touched = all.filter(x => x.t === t && S.cards[x.w]).length;
    return { t, n, done, touched };
  }).sort((a, b) => b.n - a.n).slice(0, 14);
  const acc = S.quiz.total ? Math.round(S.quiz.correct / S.quiz.total * 100) : 0;

  $("#statsMain").innerHTML = `
  <div class="grid g4" style="margin-bottom:12px">
    <div class="stat"><b>${fa(st.new)}</b><span>واژهٔ نو</span></div>
    <div class="stat"><b>${fa(st.l)}</b><span>در حال یادگیری</span></div>
    <div class="stat"><b>${fa(st.m)}</b><span>تسلط‌یافته</span></div>
    <div class="stat"><b>${fa(streak)}</b><span>روز پیوسته</span></div>
  </div>

  <div class="grid g2">
    <div class="card pad">
      <h3>جعبه‌های لایتنر</h3>
      ${box.slice(1).map((n, i) => `<div style="margin-bottom:9px">
        <div class="between"><span class="muted">${BOX_LABEL[i + 1]}</span><span class="en muted">${fa(n)}</span></div>
        <div class="bar"><i style="width:${Math.round(n / all.length * 100)}%"></i></div></div>`).join("")}
      <div class="muted" style="margin-top:8px">جمع واژه‌های واردشده به مرور: ${fa(all.length - st.new)} واژه</div>
    </div>

    <div class="card pad">
      <h3>۲۱ روز گذشته</h3>
      <div style="display:flex;align-items:flex-end;gap:4px;height:120px">
        ${days.length ? days.map(d => `<div title="${d}: ${fa(S.days[d].r)} مرور" style="flex:1;background:linear-gradient(180deg,var(--acc),var(--pur));height:${Math.max(6, S.days[d].r / maxDay * 100)}%;border-radius:4px"></div>`).join("") : '<div class="muted" style="align-self:center;margin:auto">هنوز مروری ثبت نشده — چند کارت مرور کن و این نمودار پر می‌شود.</div>'}
      </div>
      <div class="muted" style="margin-top:8px">میانگین روزانه: ${fa(days.length ? Math.round(days.reduce((s, d) => s + S.days[d].r, 0) / days.length) : 0)} مرور</div>
      <h3 style="margin-top:14px">آزمون‌ها</h3>
      <div class="muted">دقت کل: ${fa(acc)}% · بهترین دوره: ${fa(S.quiz.best)}% · تعداد دوره‌ها: ${fa(S.quiz.rounds)}</div>
    </div>
  </div>

  <div class="card pad" style="margin-top:12px">
    <h3>پیشرفت موضوعی</h3>
    ${perTopic.map(p => `<div style="margin-bottom:9px">
      <div class="between"><span>${esc(p.t)} <span class="muted">— ${fa(p.done)} از ${fa(p.n)} مسلط</span></span>
      <span class="muted">${Math.round(p.done / p.n * 100)}%</span></div>
      <div class="bar"><i style="width:${Math.round(p.done / p.n * 100)}%"></i></div></div>`).join("")}
  </div>

  <div class="card pad" style="margin-top:12px">
    <h3>پشتیبان‌گیری</h3>
    <div class="muted" style="margin-bottom:10px">پیشرفت در همین مرورگر ذخیره می‌شود. برای انتقال به دستگاه دیگر، فایل پشتیبان را بگیر.</div>
    <div class="row">
      <button class="btn" id="exBtn">↓ خروجی پیشرفت</button>
      <label class="btn" style="cursor:pointer">↑ ورود فایل<input type="file" id="imFile" accept=".json" class="hide"></label>
      <button class="btn bad" id="reBtn">پاک‌کردن همهٔ پیشرفت</button>
    </div>
  </div>`;

  $("#exBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(S)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lifeos-vocab-progress-" + today() + ".json";
    a.click();
  };
  $("#imFile").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(r.result);
        if (!o.cards) throw 0;
        S = { ...DEF(), ...o, settings: { ...DEF().settings, ...(o.settings || {}) } };
        save(true); render(); toast("پیشرفت بازگردانی شد");
      } catch (err) { toast("فایل معتبر نبود"); }
    };
    r.readAsText(f);
  };
  $("#reBtn").onclick = () => {
    if (confirm("همهٔ پیشرفت (جعبه‌ها، ستاره‌ها، آمار) پاک شود؟")) {
      S = DEF(); save(true); FILTER = { topic: "all", lv: "all", starsOnly: false };
      cur = null; render(); toast("همه‌چیز پاک شد");
    }
  };
}

/* --------------------------------------------------------------- settings */
function renderSettings() {
  const s = S.settings;
  $("#setMain").innerHTML = `
  <div class="card pad">
    <h2>تنظیمات</h2>
    <div class="grid g2" style="margin-top:8px">
      <div><label class="f">واژه‌های نو در روز</label><input type="number" id="sNew" min="0" max="200" value="${s.dailyNew}"></div>
      <div><label class="f">هدف مرور روزانه</label><input type="number" id="sGoal" min="5" max="500" value="${s.dailyGoal}"></div>
      <div><label class="f">ترتیب واژه‌های نو</label>
        <select id="sOrder">
          <option value="mix" ${s.order === "mix" ? "selected" : ""}>ترکیبی (پیشنهادی)</option>
          <option value="freq" ${s.order === "freq" ? "selected" : ""}>از پرکاربردترین</option>
          <option value="rand" ${s.order === "rand" ? "selected" : ""}>تصادفی</option>
        </select></div>
      <div><label class="f">سرعت تلفظ</label><input type="number" id="sRate" step="0.05" min="0.6" max="1.4" value="${s.rate}"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <label class="sw"><input type="checkbox" id="sAuto" ${s.autoSpeak ? "checked" : ""}> تلفظ خودکار واژه هنگام نمایش</label>
      <label class="sw">تکرار خودکار:
        <select id="sAutoRepeat" style="width:auto;padding:7px">
          ${[1,2,3].map(n => `<option value="${n}" ${+s.autoRepeat === n ? "selected" : ""}>${fa(n)} بار</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="muted" style="margin-top:8px">دکمهٔ «تلفظ» هر بار قابل زدن است؛ «۳ بار» واژه را پشت‌سرهم تکرار می‌کند. خاموش‌کردن تلفظ خودکار روی دکمه‌ها اثری ندارد.</div>
    <div class="row" style="margin-top:14px"><button class="btn pri" id="sSave">ذخیرهٔ تنظیمات</button></div>
  </div>

  <div class="card pad" style="margin-top:12px">
    <h3>روش کار با این اپ (برای رسیدن به نمرهٔ ۷)</h3>
    <ul style="line-height:2;padding-inline-start:18px;color:var(--tx2);font-size:14.5px">
      <li>هر روز <b>۱۰ تا ۲۰ واژهٔ نو</b> بگیر و همان روز چند بار مرور کن؛ کیفیت از تعداد مهم‌تر است.</li>
      <li>هر واژه را <b>در جمله</b> بساز (نوشتاری) و در مکالمه به کار ببر؛ واژهٔ فعال = نمرهٔ ۷.</li>
      <li>روی <b>ترکیب‌های رایج</b> (collocations) و بازگویی (paraphrase) بیشتر از لغات عجیب کار کن.</li>
      <li>موضوع‌های رایتینگ (محیط زیست، تحصیل، سلامت، تکنولوژی، جامعه) را جدا مرور کن — با فیلتر موضوعی همین اپ.</li>
      <li>هر چند روز یک‌بار <b>آزمون</b> بده تا واژه‌های ضعیف خودشان را لو بدهند.</li>
      <li>جعبهٔ ۱ و ۲ را زودتر از موعد رها نکن؛ مرور با فاصله همان چیزی است که واژه را تثبیت می‌کند.</li>
    </ul>
  </div>

  <div class="card pad" style="margin-top:12px">
    <h3>دربارهٔ داده‌های این اپ</h3>
    <div class="muted" style="line-height:2;font-size:14px">
      ${fa(DECK.length)} واژه و اصطلاح: ۷۰۰۰ واژهٔ عمومی و آکادمیک، به‌علاوهٔ واژه‌های تخصصی نما و ساختمان.
      برای کارت‌های تخصصیِ این بخش معنی و مثال مرتبط با معماری نوشته شده است؛
      در بخش عمومی معنی‌های فارسی از دیکشنری‌های باز و تعریف/مثال/هم‌معنی از WordNet هستند. سطح واژه‌ها از فهرست‌های CEFR-J و Octanove گرفته شده است.
      سطح‌ها تقریبی‌اند و برای عبارت‌های تخصصی به‌صورت دستی تعیین شده‌اند.
      اگر معنی واژه‌ای نادرست بود، در کارت روی «ویرایش معنی» بزن و درستش کن — برای خودت ذخیره می‌شود.
    </div>
  </div>

  <div class="card pad" style="margin-top:12px">
    <h3>راهنمای سریع</h3>
    <div class="muted" style="line-height:2;font-size:14px">
      <span class="kbd">Space</span> برگرداندن کارت · <span class="kbd">۱</span> نمی‌دانستم ·
      <span class="kbd">۲</span> سخت · <span class="kbd">۳</span> خوب · <span class="kbd">۴</span> آسان ·
      <span class="kbd">S</span> تلفظ یک‌بار (قابل تکرار) · دکمهٔ «۳ بار» تکرار پیاپی · <span class="kbd">Esc</span> بستن پنجره
      <br>تلفظ با موتور صوتی خود مرورگر انجام می‌شود؛ اگر صدایی نیامد، یعنی مرورگر/دستگاه فعلی از آن پشتیبانی نمی‌کند.
    </div>
  </div>`;
  $("#sSave").onclick = () => {
    S.settings.dailyNew = Math.max(0, +$("#sNew").value || 0);
    S.settings.dailyGoal = Math.max(5, +$("#sGoal").value || 60);
    S.settings.order = $("#sOrder").value;
    S.settings.rate = Math.min(1.4, Math.max(.6, +$("#sRate").value || .95));
    S.settings.autoSpeak = $("#sAuto").checked;
    S.settings.autoRepeat = Math.max(1, Math.min(3, +$("#sAutoRepeat").value || 1));
    save(true); toast("ذخیره شد");
  };
}


/* =========================================================================
   ACCOUNTS  —  local profiles: signup / login / lock / per-user progress
   (a convenience lock for sharing one device, not server-grade security)
   ========================================================================= */
function normStr(v) {
  if (!v) return "";
  return String(v)
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .trim();
}
function accs() {
  try { return JSON.parse(Store.get(KACC)) || { users: {} }; }
  catch (e) { return { users: {} }; }
}
function saveAccs(a) { Store.set(KACC, JSON.stringify(a)); }

/* --- random salt --- */
function randHex(n) {
  const b = new Uint8Array(n);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}
/* --- password hash: PBKDF2-SHA256 when available, iterated fallback otherwise --- */
const ITER = 120000;
function fallbackHash(pw, salt, rounds) {
  let h1 = 0x811c9dc5, h2 = 0xc2b2ae35;
  const s = salt + "|" + pw;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i) + r;
      h1 = (h1 ^ c) >>> 0; h1 = (h1 + ((h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24))) >>> 0;
      h2 = (h2 + c * (r + 7)) >>> 0; h2 = (h2 ^ (h2 >>> 13)) >>> 0;
    }
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}
async function hashPw(pw, saltHex) {
  const salt = new Uint8Array((saltHex.match(/../g) || []).map(h => parseInt(h, 16)));
  if (window.crypto && crypto.subtle && crypto.subtle.importKey) {
    try {
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, key, 256);
      return "pbkdf2$" + Array.from(new Uint8Array(bits)).map(x => x.toString(16).padStart(2, "0")).join("");
    } catch (e) { /* fall through */ }
  }
  return "fb$" + fallbackHash(pw, saltHex, 20000);
}
async function verifyPw(pw, rec) {
  const h = await hashPw(pw, rec.salt);
  return h === rec.hash;
}

/* --- session helpers --- */
function setSession(u, remember) {
  Store.set(KCUR, u);
}
function clearSession() { Store.remove(KCUR); }
function getSession() {
  return Store.get(KCUR);
}

/* --- login / signup screen --- */
let AUTH_MODE = "login";
function showLogin(msg) {
  USER = null;
  $("#appShell").classList.add("hide");
  $("#loginShell").classList.remove("hide");
  drawLogin(msg);
}
function drawLogin(msg) {
  const a = accs();
  const users = Object.keys(a.users);
  if (!users.length && AUTH_MODE !== "login") AUTH_MODE = "signup";
  const u = AUTH_MODE;
  $("#loginMain").innerHTML = `
  <div class="logincard card pad">
    <div style="text-align:center;margin-bottom:6px">
      <div class="logo big">۷K</div>
      <h2 style="margin-top:10px">۷۰۰۰ واژهٔ آیلتس</h2>
      <div class="muted">${u === "login" ? "نام کاربری و رمزت را بزن و وارد شو." : "یک حساب محلی بساز تا پیشرفتت ذخیره شود."}</div>
    </div>
    <div class="row" style="gap:6px;justify-content:center;margin:14px 0">
      <button type="button" class="chip ${u === "login" ? "on" : ""}" data-auth="login">ورود به حساب</button>
      <button type="button" class="chip ${u === "signup" ? "on" : ""}" data-auth="signup">ساخت حساب تازه</button>
    </div>
    ${msg ? `<div class="alert">${esc(msg)}</div>` : ""}
    ${!users.length && u === "login" ? `<div class="alert" style="background:#252010;border-color:#5c4815;color:#fce49b">هنوز حسابی روی این مرورگر ساخته نشده است. ابتدا روی «ساخت حساب تازه» بزن یا از دکمهٔ «ورود سریع به عنوان مهمان» استفاده کن.</div>` : ""}
    <form id="authForm" onsubmit="return false;">
      <div class="grid" style="gap:10px">
        <div><label class="f">نام کاربری (حداقل ۳ حرف انگلیسی)</label>
          <input type="text" id="aUser" class="en" autocomplete="username" spellcheck="false" placeholder="مثلاً ali" ${users.length && u === "login" ? 'list="userlist"' : ""}></div>
        ${users.length && u === "login" ? `<datalist id="userlist">${users.map(x => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}
        ${u === "signup" ? `<div><label class="f">نام نمایشی دلخواه (اختیاری)</label><input type="text" id="aName" placeholder="مثلاً علی"></div>` : ""}
        <div><label class="f">رمز عبور (حداقل ۴ کاراکتر)</label><input type="password" id="aPass" autocomplete="${u === "login" ? "current-password" : "new-password"}"></div>
        ${u === "signup" ? `<div><label class="f">تکرار رمز عبور</label><input type="password" id="aPass2" autocomplete="new-password"></div>` : ""}
        <label class="sw"><input type="checkbox" id="aRemember" checked> مرا به خاطر بسپار (روی این دستگاه)</label>
      </div>
      <div class="row" style="margin-top:14px;gap:8px">
        <button type="submit" class="btn pri" id="aGo" style="flex:1">${u === "login" ? "ورود به حساب" : "ساخت حساب و شروع"}</button>
      </div>
      <div class="row" style="margin-top:8px">
        <button type="button" class="btn ghost sm" id="aGuest" style="width:100%;color:var(--tx2)">ورود مستقیم به عنوان مهمان (بدون رمز)</button>
      </div>
    </form>
    <div class="muted" style="margin-top:12px;font-size:12.5px;line-height:1.9">
      ${u === "login"
        ? `حساب نساخته‌ای؟ روی «ساخت حساب تازه» در بالا کلیک کن.`
        : `رمز به‌صورت رمزنگاری‌شده در همین مرورگر نگه داشته می‌شود و به هیچ سروری ارسال نمی‌شود.`}
      <br>هر کاربر روی این مرورگر جعبه‌ها، ستاره‌ها و پیشرفت مستقل خودش را دارد.
    </div>
  </div>`;

  $$("[data-auth]").forEach(c => c.onclick = () => { AUTH_MODE = c.dataset.auth; drawLogin(); });
  $("#authForm").onsubmit = e => {
    e.preventDefault();
    if (AUTH_MODE === "login") doLogin(); else doSignup();
  };
  $("#aGuest").onclick = () => {
    enterApp("guest", false);
    toast("به عنوان مهمان وارد شدی! پیشرفتت در همین مرورگر ذخیره می‌شود.");
  };
  const first = $("#aUser");
  if (first) {
    first.focus();
    if (users.length && AUTH_MODE === "login" && !first.value) first.value = users[0];
  }
}

async function doSignup() {
  const a = accs();
  const name = normStr($("#aUser").value).toLowerCase();
  const disp = normStr($("#aName") ? $("#aName").value : "");
  const p1 = normStr($("#aPass").value), p2 = normStr($("#aPass2") ? $("#aPass2").value : "");
  if (!name) return drawLogin("لطفاً یک نام کاربری وارد کن (مثلاً ali).");
  if (!/^[a-z0-9._\-]{3,20}$/.test(name)) return drawLogin("نام کاربری باید ۳ تا ۲۰ کاراکتر و فقط حروف انگلیسی، عدد، نقطه یا خط تیره باشد.");
  if (a.users[name]) return drawLogin("این نام کاربری از قبل وجود دارد. لطفاً وارد شو یا نام دیگری بگذار.");
  if ((p1 || "").length < 4) return drawLogin("رمز عبور باید حداقل ۴ کاراکتر باشد.");
  if (p1 !== p2) return drawLogin("رمز عبور و تکرارش یکسان نیستند؛ دوباره بررسی کن.");
  const btn = $("#aGo"); if (btn) { btn.disabled = true; btn.textContent = "در حال ساخت حساب…"; }
  try {
    const firstProfile = Object.keys(a.users).length === 0;
    const salt = randHex(16);
    const hash = await hashPw(p1, salt);
    a.users[name] = { salt, hash, disp: disp || name, created: Date.now(), last: Date.now() };
    saveAccs(a);
    let migrated = false;
    try {
      const legacy = firstProfile ? Store.get(KEY) : null;
      if (legacy && !Store.get(keyFor(name))) {
        Store.set(keyFor(name), legacy);
        Store.remove(KEY);
        migrated = true;
      }
    } catch (e) {}
    enterApp(name, $("#aRemember").checked);
    toast(migrated ? "پیشرفت قبلی همین دستگاه به حسابت منتقل شد" : "خوش آمدی " + (disp || name) + "!");
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "ساخت حساب و شروع"; }
    drawLogin("خطا در ایجاد حساب: " + (err.message || err));
  }
}

async function doLogin() {
  const a = accs();
  const users = Object.keys(a.users);
  const name = normStr($("#aUser").value).toLowerCase();
  const pw = normStr($("#aPass").value);
  if (!name) return drawLogin("نام کاربری را وارد کن.");
  if (!users.length) {
    AUTH_MODE = "signup";
    return drawLogin("هنوز هیچ حسابی ثبت نشده است. لطفاً ابتدا یک حساب بساز.");
  }
  const rec = a.users[name];
  if (!rec) return drawLogin("کاربری با نام «" + name + "» یافت نشد. املای نام را بررسی کن یا حساب بساز.");
  if (!pw) return drawLogin("رمز عبور را وارد کن.");
  const btn = $("#aGo"); if (btn) { btn.disabled = true; btn.textContent = "در حال بررسی…"; }
  try {
    const ok = await verifyPw(pw, rec);
    if (!ok) {
      if (btn) { btn.disabled = false; btn.textContent = "ورود به حساب"; }
      return drawLogin("رمز عبور نادرست است.");
    }
    rec.last = Date.now(); saveAccs(a);
    enterApp(name, $("#aRemember").checked);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "ورود به حساب"; }
    drawLogin("خطا هنگام ورود: " + (err.message || err));
  }
}
function enterApp(name, remember) {
  USER = name;
  setSession(name, remember);
  S = load(name);
  $("#loginShell").classList.add("hide");
  $("#appShell").classList.remove("hide");
  VIEW = "study"; cur = null; shown = 60; query = ""; FILTER = { topic: "all", lv: "all", starsOnly: false };
  const a = accs(), rec = a.users[name] || {};
  const chip = $("#userBtn"); if (chip) chip.textContent = "کاربر: " + (rec.disp || name);
  $("#deckSize").textContent = fa(DECK.length);
  renderFilters(); render();
}

function logout(lockOnly) {
  stopSpeaking();
  save(true);               // flush pending reviews before changing profiles
  clearSession();
  AUTH_MODE = "login";
  const name = USER;
  USER = null;
  S = DEF();
  drawLogin(lockOnly ? "قفل شد. برای ادامه رمز را وارد کن." : "از حساب خارج شدی.");
  $("#loginShell").classList.remove("hide");
  $("#appShell").classList.add("hide");
  $$(".tab").forEach(t => t.classList.remove("on"));
  const u = $("#aUser"); if (u && name) u.value = name;
}

/* --- profile sheet --- */
function profileSheet() {
  const a = accs(), rec = a.users[USER] || {};
  const m = document.createElement("div");
  m.className = "mask";
  m.innerHTML = `<div class="card pad modal">
    <div class="between">
      <h2 style="margin:0">حساب من</h2>
      <span class="pill en">${esc(USER)}</span>
    </div>
    <div class="muted" style="margin:6px 0 12px">نام نمایشی: <b>${esc(rec.disp || USER)}</b> · ساخته‌شده: ${rec.created ? new Date(rec.created).toLocaleDateString("fa-IR") : "—"}</div>

    <h3>تغییر نام نمایشی</h3>
    <div class="row" style="gap:8px"><input type="text" id="pName" value="${esc(rec.disp || USER)}" style="flex:1"><button class="btn sm" id="pNameGo">ذخیره</button></div>

    <h3 style="margin-top:16px">تغییر رمز عبور</h3>
    <div class="grid g2" style="gap:8px">
      <div><label class="f">رمز فعلی</label><input type="password" id="pOld"></div>
      <div><label class="f">رمز تازه</label><input type="password" id="pNew"></div>
    </div>
    <div class="row" style="margin-top:8px"><button class="btn sm" id="pPassGo">تغییر رمز</button></div>
    <div id="pMsg" class="muted" style="margin-top:8px;color:var(--warn)"></div>

    <h3 style="margin-top:18px">دسترسی سریع</h3>
    <div class="row">
      <button class="btn sm" id="pLock">قفل کردن اپ</button>
      <button class="btn sm" id="pOut">خروج از حساب</button>
      <button class="btn sm bad" id="pDel">حذف این حساب</button>
      <button class="btn sm ghost" id="pClose">بستن</button>
    </div>
    <div class="muted" style="margin-top:10px;font-size:12.5px">پیشرفت این حساب جدا از بقیهٔ پروفایل‌های همین مرورگر ذخیره می‌شود. برای بردنش به دستگاه دیگر از «پیشرفت ← خروجی پیشرفت» فایل پشتیبان بگیر.</div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", e => { if (e.target === m) m.remove(); });
  const msg = t => { const x = $("#pMsg"); if (x) { x.textContent = t; x.style.color = "var(--bad)"; } };
  $("#pClose").onclick = () => m.remove();
  $("#pNameGo").onclick = () => {
    const v = $("#pName").value.trim() || USER;
    a.users[USER].disp = v; saveAccs(a);
    $("#userBtn").textContent = "کاربر: " + v; m.remove(); toast("نام نمایشی ذخیره شد");
  };
  $("#pPassGo").onclick = async () => {
    const oldPw = $("#pOld").value, newPw = $("#pNew").value;
    if (!(await verifyPw(oldPw, a.users[USER]))) return msg("رمز فعلی نادرست است.");
    if (newPw.length < 4) return msg("رمز تازه باید حداقل ۴ کاراکتر باشد.");
    const salt = randHex(16);
    a.users[USER].salt = salt; a.users[USER].hash = await hashPw(newPw, salt);
    saveAccs(a); $("#pMsg").style.color = "var(--ok)"; msg(""); $("#pMsg").textContent = "رمز تغییر کرد"; $("#pMsg").style.color = "var(--ok)";
  };
  $("#pLock").onclick = () => { m.remove(); logout(true); };
  $("#pOut").onclick = () => { m.remove(); logout(false); };
  $("#pDel").onclick = () => {
    if (!confirm("حساب «" + USER + "» با همهٔ پیشرفتش حذف شود؟ این کار برگشت‌پذیر نیست.")) return;
    delete a.users[USER];
    if (!Object.keys(a.users).length) Store.remove(KACC); else saveAccs(a);
    Store.remove(keyFor(USER));
    m.remove(); logout(false);
  };
}

/* ------------------------------------------------------------ filter chips */
function renderFilters() {
  const lvCount = l => DECK.filter(x => x.lv === l).length;
  const lb = $("#levelBar");
  if (lb) {
    lb.innerHTML = `<span class="chip ${FILTER.lv === "all" ? "on" : ""}" data-lvf="all">همهٔ سطوح</span>` +
      LEVELS.map(l => `<span class="chip ${FILTER.lv === l ? "on" : ""}" data-lvf="${l}">${l} <small>(${fa(lvCount(l))})</small></span>`).join("");
    $$("#levelBar [data-lvf]").forEach(c => c.onclick = () => { FILTER.lv = c.dataset.lvf; cur = null; renderFilters(); render(); });
  }
  const tl = topics();
  if (FILTER.topic !== "all" && !tl.some(([t]) => t === FILTER.topic)) tl.push([FILTER.topic, 0]);
  const inLevel = tl.reduce((a, [, n]) => a + n, 0);
  $("#topicBar").innerHTML = `<span class="chip ${FILTER.topic === "all" ? "on" : ""}" data-t="all">همهٔ موضوع‌ها (${fa(inLevel)})</span>` +
    tl.map(([t, n]) => `<span class="chip ${FILTER.topic === t ? "on" : ""}" data-t="${esc(t)}">${esc(t)} (${fa(n)})</span>`).join("");
  $$("#topicBar [data-t]").forEach(c => c.onclick = () => { FILTER.topic = c.dataset.t; cur = null; renderFilters(); render(); });
  const tg = $("#topicToggle");
  if (tg) {
    // one scrolling row by default; «همه ▾» opens every topic as wrapped chips (all screen sizes)
    const bar = $("#topicBar");
    tg.style.display = "";
    tg.textContent = bar.classList.contains("exp") ? "بستن ▴" : "همهٔ موضوع‌ها ▾";
    tg.onclick = () => {
      const on = bar.classList.toggle("exp");
      tg.textContent = on ? "بستن ▴" : "همهٔ موضوع‌ها ▾";
    };
  }
}

/* a mouse wheel scrolls the one-row chip bars sideways (touch already can) */
function wheelScrollX(el) {
  if (!el || el.dataset.wheel) return;
  el.dataset.wheel = "1";
  el.addEventListener("wheel", e => {
    if (el.classList.contains("exp") || el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    el.scrollLeft -= e.deltaY;   // RTL: wheel down moves towards the end of the row
  }, { passive: false });
}

/* ------------------------------------------------------------------- boot */
function boot() {
  wheelScrollX($("#levelBar")); wheelScrollX($("#topicBar"));
  $("#deckSize").textContent = fa(DECK.length);
  $$(".tab").forEach(t => t.onclick = () => { if (VIEW !== t.dataset.v) stopSpeaking(); VIEW = t.dataset.v; render(); });
  $("#helpBtn").onclick = () => { VIEW = "settings"; render(); };
  $("#userBtn").onclick = () => { if (USER) profileSheet(); };
  $("#logoutBtn").onclick = () => { if (USER) profileSheet(); };
  document.addEventListener("keydown", e => {
    if (e.target.matches("input,textarea,select")) return;
    if (e.key === "Escape") { const m = $(".mask"); if (m) m.remove(); return; }
    if (VIEW !== "study") return;
    if (e.code === "Space") { e.preventDefault(); const fc = $("#fc"); if (fc) { flipped = !flipped; fc.classList.toggle("flip", flipped); } }
    if (["1", "2", "3", "4"].includes(e.key)) { const b = $(`.ratebar [data-r="${["again", "hard", "good", "easy"][+e.key - 1]}"]`); if (b) b.click(); }
    if (e.key.toLowerCase() === "s") { if (cur) speak(cur.w); }
  });
  // LifeOS: signed in already (the page is behind the LifeOS login) — load words + server progress
  $("#userBtn").remove(); $("#logoutBtn").remove();
  $("#studyMain").innerHTML = '<div class="card pad" style="text-align:center">در حال بارگذاری واژه‌ها…</div>';
  $("#appShell").classList.remove("hide");
  Promise.all([
    fetch("words.json").then(r => r.json()),
    fetch("/api/vocab", { credentials: "same-origin" }).then(r => r.ok ? r.json() : { state: null })
  ]).then(([rows, remote]) => {
    DECK = rows.map(r => ({ w: r[0], fa: r[1], t: r[2], lv: r[3], p: r[4], d: r[5], e: r[6], s: r[7], z: r[8], ef: r[9], df: r[10] || '', x: r[11] || [] }));
    USER = "lifeos";
    const o = remote && remote.state;
    const d = DEF();
    S = o && o.cards ? { ...d, ...o, settings: { ...d.settings, ...(o.settings || {}) }, quiz: { ...d.quiz, ...(o.quiz || {}) } } : load("lifeos");
    VIEW = "study"; cur = null; shown = 60; query = ""; FILTER = { topic: "all", lv: "all", starsOnly: false };
    $("#deckSize").textContent = fa(DECK.length);
    renderFilters(); render();
    if (!(o && o.cards) && Object.keys(S.cards).length) save(true);   // first run: upload a cached copy
  }).catch(() => { $("#studyMain").innerHTML = '<div class="card pad">بارگذاری ناموفق بود. صفحه را دوباره باز کن.</div>'; });
}
document.addEventListener("DOMContentLoaded", boot);
})();
