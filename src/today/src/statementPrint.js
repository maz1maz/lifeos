// Printable statement (صورت وضعیت) — designed cover with the employer's and contractor's logos, the financial summary
// (with the payable amount in words), the work sheet and the measurement sheet — plus an Excel export of the same.
// Rendered as a standalone document in a hidden iframe (like projectReportPrint.js) so the app theme never leaks in.
import { fa, jl, num } from './life-core';
import { itemKind, scopeItems, SCOPES } from './statement';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rial = n => fa(Math.round(Number(n) || 0), 0);
const qty = n => fa(Number(n) || 0, 2);
const date = iso => jl(iso) || '—';
const safeImg = u => /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(u || '')) ? u : '';
const fontBase = () => (typeof window !== 'undefined' && window.__lifeosApi) ? new URL('studio-assets/', location.href).href : '/assets/fonts/';

// ── amount in Persian words (ریال) ──
const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'], TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'], HUNDREDS = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALE = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد', 'میلیون میلیارد'];
function under1000(n) { const h = Math.floor(n / 100), r = n % 100, out = []; if (h) out.push(HUNDREDS[h]); if (r >= 10 && r < 20) out.push(TEENS[r - 10]); else { if (Math.floor(r / 10)) out.push(TENS[Math.floor(r / 10)]); if (r % 10) out.push(ONES[r % 10]); } return out.join(' و '); }
export function toPersianWords(value) {
  let n = Math.round(Math.abs(Number(value) || 0)); if (!n) return 'صفر';
  const parts = []; let i = 0;
  while (n > 0 && i < SCALE.length) { const c = n % 1000; if (c) parts.unshift(under1000(c) + (SCALE[i] ? ' ' + SCALE[i] : '')); n = Math.floor(n / 1000); i++; }
  return (Number(value) < 0 ? 'منفی ' : '') + parts.join(' و ');
}

const CSS = () => `
@font-face{font-family:'Vazirmatn';font-weight:100 900;font-display:block;src:url('${fontBase()}vazirmatn-arabic.woff2') format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC}
@font-face{font-family:'Vazirmatn';font-weight:100 900;font-display:block;src:url('${fontBase()}vazirmatn-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2212}
@page{size:A4 portrait;margin:12mm 11mm 14mm}
@page cover{size:A4 portrait;margin:0}
@page wide{size:A4 landscape;margin:10mm 10mm 12mm}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;color:#0f172a;font:400 9.5pt/1.65 Vazirmatn,Tahoma,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{direction:rtl}
.n{font-feature-settings:"tnum";white-space:nowrap}
:root{--navy:#0b1f3a;--navy2:#163a6b;--gold:#c8a24a;--gold2:#f2d68a;--ink:#0f172a;--mut:#64748b;--line:#e2e8f0}
/* ── cover ── */
.cover{page:cover;width:210mm;height:297mm;position:relative;overflow:hidden;break-after:page;background:#fff}
.hero{position:relative;height:128mm;background:linear-gradient(135deg,var(--navy) 0%,var(--navy2) 62%,#1f4f8f 100%);color:#fff;padding:16mm 15mm 0;overflow:hidden}
.hero:before{content:"";position:absolute;inset:auto -30mm -48mm auto;width:150mm;height:150mm;border-radius:50%;border:1.2mm solid rgba(242,214,138,.22)}
.hero:after{content:"";position:absolute;left:-40mm;top:-50mm;width:120mm;height:120mm;border-radius:50%;background:radial-gradient(circle,rgba(200,162,74,.28),rgba(200,162,74,0) 70%)}
.hero .stripe{position:absolute;left:0;right:0;bottom:0;height:3mm;background:linear-gradient(90deg,var(--gold),var(--gold2),var(--gold))}
.parties{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start;gap:10mm}
.party{width:56mm;text-align:center}
.party .logo{width:34mm;height:34mm;margin:0 auto;border-radius:6mm;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2mm 6mm rgba(0,0,0,.28);padding:3.5mm}
.party .logo img{max-width:100%;max-height:100%;object-fit:contain}
.party .logo i{font-style:normal;font-size:20pt;font-weight:800;color:var(--navy)}
.party small{display:block;margin-top:3mm;font-size:8pt;color:var(--gold2);letter-spacing:.3mm}
.party b{display:block;font-size:11pt;font-weight:800;line-height:1.5}
.titles{position:relative;z-index:1;text-align:center;margin-top:9mm}
.titles .kicker{display:inline-block;font-size:8.5pt;color:var(--navy);background:var(--gold2);border-radius:99px;padding:.6mm 5mm;font-weight:700}
.titles h1{font-size:25pt;font-weight:900;line-height:1.35;margin-top:3mm}
.titles h2{font-size:12.5pt;font-weight:600;color:#dbe7ff;margin-top:1mm}
.kpis{position:relative;z-index:2;margin:-17mm 13mm 0;display:grid;grid-template-columns:1fr 1fr 1fr;background:#fff;border-radius:5mm;box-shadow:0 2.5mm 9mm rgba(15,23,42,.16);overflow:hidden}
.kpi{padding:5mm 5mm 4.5mm;border-inline-start:1px solid var(--line)}.kpi:first-child{border:0}
.kpi small{display:block;font-size:8pt;color:var(--mut)}.kpi b{display:block;font-size:13.5pt;font-weight:900;color:var(--ink);margin-top:1mm}.kpi span{font-size:7.5pt;color:var(--mut)}
.kpi.main{background:linear-gradient(135deg,#fff8e6,#fff)}.kpi.main b{color:#8a6414}
.bar{height:2mm;background:#e2e8f0;border-radius:2mm;margin-top:2mm;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--navy2))}
.info{margin:9mm 13mm 0;display:grid;grid-template-columns:1fr 1fr;gap:3.2mm}
.info div{border:1px solid var(--line);border-radius:3mm;padding:3mm 4mm;background:#f8fafc}
.info div.wide{grid-column:1/-1}
.info small{display:block;font-size:7.5pt;color:var(--mut)}.info b{font-size:10pt;font-weight:700}
.signs{position:absolute;left:13mm;right:13mm;bottom:15mm;display:grid;grid-template-columns:1fr 1fr;gap:8mm}
.signs div{height:30mm;border:1.2px dashed #94a3b8;border-radius:3mm;padding:3mm 4mm;font-size:8.5pt;color:var(--mut)}
.signs div b{display:block;color:var(--ink);font-size:9.5pt}
.foot{position:absolute;left:0;right:0;bottom:0;height:7mm;background:var(--navy);color:#cbd5e1;font-size:7pt;display:flex;align-items:center;justify-content:space-between;padding:0 13mm}
.foot:before{content:"";position:absolute;left:0;right:0;top:0;height:.8mm;background:var(--gold)}
/* ── inner pages ── */
.sheet{break-before:page}
.sheet.wide{page:wide}
.head{display:grid;grid-template-columns:22mm 1fr 22mm;align-items:center;gap:4mm;padding-bottom:3mm;border-bottom:2px solid var(--navy);margin-bottom:4mm}
.head .lg{height:16mm;display:flex;align-items:center;justify-content:center}.head .lg img{max-height:16mm;max-width:22mm;object-fit:contain}
.head .t{text-align:center}.head .t b{display:block;font-size:13pt;font-weight:900;color:var(--navy)}.head .t span{font-size:8pt;color:var(--mut)}
.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5mm 5mm;font-size:8.3pt;margin-bottom:4mm;padding:2.5mm 4mm;background:#f8fafc;border:1px solid var(--line);border-radius:2mm}
.meta span{color:var(--mut)}
table{width:100%;border-collapse:collapse;font-size:8.4pt}
thead{display:table-header-group}tr{break-inside:avoid}
th{background:var(--navy);color:#fff;font-weight:700;padding:2mm 1.5mm;border:1px solid var(--navy);font-size:7.8pt}
td{padding:1.6mm 1.6mm;border:1px solid #cbd5e1;text-align:center}
td.d{text-align:right}
tbody tr:nth-child(even) td{background:#f8fafc}
tr.extra td:first-child{color:#8a6414;font-weight:700}
tr.over td{background:#fff7e6!important}
tr.tot td{font-weight:800;background:#eef2f7!important}
td.l{text-align:right}
.sum{width:100%;max-width:150mm;margin:0 auto}
.sum td:first-child{text-align:right;width:62%}.sum td:last-child{font-weight:700}
.sum tr.g td{background:var(--navy)!important;color:#fff;text-align:right;font-weight:800}
.sum tr.s td{background:#eef2f7!important;font-weight:800}
.sum tr.f td{background:#fff3cf!important;font-weight:900;font-size:10pt;color:#6b4c0c}
.words{max-width:150mm;margin:4mm auto 0;padding:3mm 4mm;border:1px solid var(--gold);border-radius:2mm;background:#fffaf0;font-size:9pt}
.words small{display:block;color:var(--mut);font-size:7.5pt}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:8mm}.sg div{border-top:1.2px solid #94a3b8;padding-top:2mm;text-align:center;font-size:8.5pt;color:var(--mut);height:22mm}
.note{font-size:7.5pt;color:var(--mut);margin-top:2mm}
.wide table{font-size:7.8pt}.wide td{padding:.8mm 1.3mm;line-height:1.45}.wide th{padding:1.4mm 1.2mm}.wide .sg{margin-top:5mm;break-inside:avoid}.wide .sg div{height:15mm}.wide .head{padding-bottom:2mm;margin-bottom:3mm}.wide .meta{margin-bottom:3mm;padding:2mm 4mm}
.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}
`;

function partyBox(role, name, logo) {
  const img = safeImg(logo);
  return `<div class="party"><div class="logo">${img ? `<img src="${img}" alt="">` : `<i>${esc((name || role).trim().charAt(0) || '؟')}</i>`}</div><small>${esc(role)}</small><b>${esc(name || '—')}</b></div>`;
}
function coverHtml(d) {
  const s = d.summary, real = d.contractAmount ? Math.round(s.gross / d.contractAmount * 100) : 0, pct = Math.max(0, Math.min(100, real));
  const scope = d.scope && d.scope !== 'all' ? ` — ${SCOPES.find(x => x[0] === d.scope)?.[1] || ''}` : '';
  return `<section class="cover">
  <div class="hero">${''}<div class="parties">${partyBox('کارفرما', d.employerName, d.employerLogo)}${partyBox('پیمانکار', d.contractorName, d.contractorLogo)}</div>
    <div class="titles"><span class="kicker">صورت وضعیت${esc(scope)}</span><h1>${esc(d.title)}</h1><h2>${esc(d.projectName || '')}</h2></div><div class="stripe"></div></div>
  <div class="kpis"><div class="kpi"><small>کارکرد ناخالص تجمعی</small><b class="n">${rial(s.gross)}</b><span>ریال · این دوره: ${rial(s.current)}</span></div>
    <div class="kpi main"><small>خالص قابل پرداخت</small><b class="n">${rial(s.payableWithVat)}</b><span>ریال${num(s.rates.vat) ? ' · با مالیات بر ارزش افزوده' : ''}</span></div>
    <div class="kpi"><small>پیشرفت مالی نسبت به قرارداد</small><b class="n">${fa(real)}٪</b><div class="bar"><i style="width:${pct}%"></i></div></div></div>
  <div class="info"><div class="wide"><small>موضوع قرارداد</small><b>${esc(d.subject || '—')}</b></div>
    <div><small>شماره قرارداد</small><b class="n"><span class="ltr">${esc(d.contractNo || '—')}</span></b></div><div><small>تاریخ قرارداد</small><b>${date(d.contractDate)}</b></div>
    <div><small>مبلغ قرارداد</small><b class="n">${rial(d.contractAmount)} ریال</b></div><div><small>دورهٔ کارکرد</small><b>${d.from || d.to ? `${date(d.from)} تا ${date(d.to)}` : '—'}</b></div>
    <div><small>تاریخ تهیهٔ صورت وضعیت</small><b>${date(d.prep)}</b></div><div><small>شمارهٔ صورت وضعیت</small><b>${d.isFinal ? 'قطعی' : fa(d.n)}</b></div></div>
  <div class="signs"><div><b>نمایندهٔ کارفرما</b>نام، مهر و امضا</div><div><b>نمایندهٔ پیمانکار</b>نام، مهر و امضا</div></div>
  <div class="foot"><span>${esc(d.contractorName || '')}</span><span>${esc(d.title)} · ${esc(d.projectName || '')}</span></div>
</section>`;
}
function headHtml(d, title, wide) {
  const e = safeImg(d.employerLogo), c = safeImg(d.contractorLogo);
  return `<div class="head"><div class="lg">${e ? `<img src="${e}" alt="">` : ''}</div><div class="t"><b>${esc(title)}</b><span>${esc(d.projectName || '')} · ${esc(d.title)}</span></div><div class="lg">${c ? `<img src="${c}" alt="">` : ''}</div></div>
  <div class="meta"${wide ? ' style="grid-template-columns:repeat(4,1fr)"' : ''}><div><span>کارفرما: </span>${esc(d.employerName || '—')}</div><div><span>پیمانکار: </span>${esc(d.contractorName || '—')}</div><div><span>شماره قرارداد: </span><b class="n"><span class="ltr">${esc(d.contractNo || '—')}</span></b></div><div><span>دورهٔ کارکرد: </span>${d.from || d.to ? `${date(d.from)} تا ${date(d.to)}` : '—'}</div>${wide ? `<div><span>تاریخ تهیه: </span>${date(d.prep)}</div><div><span>مبلغ قرارداد: </span><b class="n">${rial(d.contractAmount)}</b></div>` : `<div><span>تاریخ تهیه: </span>${date(d.prep)}</div><div><span>مبلغ قرارداد: </span><b class="n">${rial(d.contractAmount)}</b></div>`}</div>`;
}
function summaryHtml(d) {
  const s = d.summary, r = (l, v, c = '') => `<tr class="${c}"><td>${esc(l)}</td><td class="n">${rial(v)}</td></tr>`;
  return `<section class="sheet">${headHtml(d, 'خلاصهٔ مالی صورت وضعیت')}
  <table class="sum"><tbody>
    <tr class="g"><td colspan="2">کارکرد</td></tr>
    ${r('کارکرد ناخالص تجمعی تا کنون', s.gross)}${r('کارکرد ناخالص تا صورت وضعیت قبلی', s.prevGross)}${r('کارکرد ناخالص این دوره', s.current)}
    ${s.addInsurance ? r(`سپرده بیمه (${fa(s.rates.insurance, 2)}٪ مبنای ${rial(s.insuranceBase)})`, s.insuranceAdded) : ''}
    <tr class="g"><td colspan="2">کسورات</td></tr>
    ${r(`تخفیف (${fa(s.rates.discount, 3)}٪ اقلام قرارداد)`, s.discount)}${r(`سپرده حسن انجام کار (${fa(s.retentionRate)}٪)`, s.retention)}${s.addInsurance ? '' : r(`سپرده بیمه (${fa(s.rates.insurance, 2)}٪)`, s.insuranceDeducted)}${r(`استهلاک پیش‌پرداخت (${fa(s.rates.advance)}٪)`, s.advance)}${r('مجموع پرداخت صورت وضعیت‌های قبلی', s.paidBefore)}
    ${r('جمع کسورات', s.deductions, 's')}
    ${r('مبلغ خالص قابل پرداخت (بدون مالیات بر ارزش افزوده)', s.payable, 's')}
    ${num(s.rates.vat) ? r(`مالیات بر ارزش افزوده (${fa(s.rates.vat)}٪)`, s.vat) : ''}
    ${r(num(s.rates.vat) ? 'مبلغ خالص قابل پرداخت (با مالیات بر ارزش افزوده)' : 'مبلغ خالص قابل پرداخت', s.payableWithVat, 'f')}
  </tbody></table>
  <div class="words"><small>مبلغ خالص قابل پرداخت به حروف</small>${esc(toPersianWords(s.payableWithVat))} ریال</div>
  <div class="sg"><div>نمایندهٔ کارفرما — مهر و امضا</div><div>نمایندهٔ پیمانکار — مهر و امضا</div></div></section>`;
}
function workHtml(d) {
  const items = scopeItems(d.boq, d.scope);
  let g = 0, pg = 0;
  const rows = items.map(it => { const t = d.now[it.id] || 0, p = d.before[it.id] || 0, price = num(it.price), over = !it.extra && num(it.qty) > 0 && t > num(it.qty) + 1e-9; g += t * price; pg += p * price;
    return `<tr class="${it.extra ? 'extra' : ''} ${over ? 'over' : ''}"><td>${esc(d.labels[it.id])}</td><td class="d">${esc(it.desc)}</td><td class="n">${qty(it.qty)}</td><td class="n">${qty(t - p)}</td><td class="n">${qty(p)}</td><td class="n"><b>${qty(t)}</b></td><td>${esc(it.unit)}</td><td class="n">${rial(price)}</td><td class="n"><b>${rial(t * price)}</b></td></tr>`; }).join('');
  const s = d.summary, ins = d.scope === 'install' ? `<tr class="tot"><td class="l" colspan="8">سپرده بیمه (${fa(s.rates.insurance, 2)}٪ مبنای ${rial(s.insuranceBase)})</td><td class="n">${rial(s.insurance)}</td></tr>` : '';
  return `<section class="sheet wide">${headHtml(d, d.scope === 'install' ? 'صورت کارکرد نصب' : d.scope === 'supply' ? 'صورت کارکرد فروش' : 'صورت کارکرد', true)}
  <table><thead><tr><th>ردیف</th><th>شرح آیتم قرارداد</th><th>مقدار قرارداد</th><th>مقدار این صورت وضعیت</th><th>تا صورت وضعیت قبلی</th><th>کل تا کنون</th><th>واحد</th><th>فی (ریال)</th><th>مبلغ تجمعی (ریال)</th></tr></thead>
  <tbody>${rows}<tr class="tot"><td class="l" colspan="8">جمع کل صورت کارکرد ناخالص تجمعی تا کنون</td><td class="n">${rial(g)}</td></tr><tr class="tot"><td class="l" colspan="8">جمع کل صورت کارکرد ناخالص تا صورت وضعیت قبلی</td><td class="n">${rial(pg)}</td></tr><tr class="tot"><td class="l" colspan="8">جمع کل صورت کارکرد ناخالص فعلی</td><td class="n">${rial(g - pg)}</td></tr>${ins}</tbody></table>
  <div class="sg"><div>نمایندهٔ کارفرما — مهر و امضا</div><div>نمایندهٔ پیمانکار — مهر و امضا</div></div></section>`;
}
const measureRows = d => { const keep = new Set(scopeItems(d.boq, d.scope).map(x => x.id)), byId = Object.fromEntries(d.boq.map(b => [b.id, b])); return d.measures.filter(m => (Number(m.statementNo) || 0) <= d.n && keep.has(m.itemId)).sort((a, b) => (Number(a.statementNo) || 0) - (Number(b.statementNo) || 0) || String(a.date || '').localeCompare(String(b.date || ''))).map(m => ({ m, it: byId[m.itemId] })); };
function measureHtml(d) {
  const list = measureRows(d); let total = 0;
  const rows = list.map(({ m, it }) => { const a = num(m.qty) * num(it?.price); total += a; const out = d.from && d.to && m.date && (m.date < d.from || m.date > d.to) && Number(m.statementNo) === d.n; return `<tr class="${it?.extra ? 'extra' : ''} ${out ? 'over' : ''}"><td>${esc(d.labels[m.itemId] || '')}</td><td>${fa(m.statementNo)}</td><td>${date(m.date)}</td><td class="d">${esc(it?.desc || '')}</td><td class="n">${qty(m.qty)}</td><td>${esc(it?.unit || '')}</td><td class="n">${rial(it?.price)}</td><td class="n">${rial(a)}</td><td class="d">${esc(m.note || '')}</td></tr>`; }).join('');
  return `<section class="sheet wide">${headHtml(d, 'ریزمترهٔ ' + d.title, true)}
  <table><thead><tr><th>آیتم قرارداد</th><th>شمارهٔ صورت وضعیت</th><th>تاریخ انجام</th><th>شرح آیتم قرارداد</th><th>مقدار انجام‌شده</th><th>واحد</th><th>فی (ریال)</th><th>مبلغ (ریال)</th><th>توضیحات</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="9">ردیفی ثبت نشده.</td></tr>'}<tr class="tot"><td class="l" colspan="7">جمع ریزمتره تا این صورت وضعیت</td><td class="n">${rial(total)}</td><td></td></tr></tbody></table></section>`;
}

export function statementHtml(d, { only } = {}) {
  const body = only === 'cover' ? coverHtml(d) : coverHtml(d) + summaryHtml(d) + workHtml(d) + measureHtml(d);
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>${CSS()}${only === 'cover' ? 'html,body{width:210mm}' : ''}</style></head><body>${body}</body></html>`;
}
export const statementFileName = d => `${d.title} - ${d.projectName || 'پروژه'}`.replace(/[\\/:*?"<>|]+/g, ' ').trim();

export async function printStatement(d) {
  document.getElementById('lf-sv-print-frame')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'lf-sv-print-frame'; frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:794px;height:10px;border:0;left:-10000px;top:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument; doc.open(); doc.write(statementHtml(d)); doc.close();
  await (doc.fonts?.ready || Promise.resolve());
  await Promise.all([...doc.images].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
  const prev = document.title; document.title = statementFileName(d);
  try { frame.contentWindow.focus(); frame.contentWindow.print(); } finally { document.title = prev; }
}

// Excel: four RTL sheets with real numbers (sum-able), same content as the printout
export async function exportStatementExcel(d) {
  const XLSX = await import('xlsx');
  const s = d.summary, wb = XLSX.utils.book_new();
  const sheet = (rows, cols) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = cols.map(w => ({ wch: w })); return ws; };
  const kindName = it => itemKind(it) === 'install' ? 'نصب / خدمات' : itemKind(it) === 'other' ? 'سایر' : 'فروش / تأمین';
  XLSX.utils.book_append_sheet(wb, sheet([
    [d.title], [],
    ['نام پروژه', d.projectName], ['موضوع قرارداد', d.subject], ['کارفرما', d.employerName], ['پیمانکار', d.contractorName],
    ['شماره قرارداد', d.contractNo], ['تاریخ قرارداد', jl(d.contractDate)], ['مبلغ قرارداد (ریال)', d.contractAmount],
    ['دورهٔ کارکرد', d.from || d.to ? `${jl(d.from)} تا ${jl(d.to)}` : ''], ['تاریخ تهیه', jl(d.prep)], [],
    ['کارکرد', 'مبلغ (ریال)'], ['کارکرد ناخالص تجمعی تا کنون', s.gross], ['کارکرد ناخالص تا صورت وضعیت قبلی', s.prevGross], ['کارکرد ناخالص این دوره', s.current],
    ...(s.addInsurance ? [[`سپرده بیمه (${s.rates.insurance}٪)`, s.insuranceAdded]] : []), [],
    ['کسورات', ''], [`تخفیف (${s.rates.discount}٪)`, s.discount], [`سپرده حسن انجام کار (${s.retentionRate}٪)`, s.retention], ...(s.addInsurance ? [] : [[`سپرده بیمه (${s.rates.insurance}٪)`, s.insuranceDeducted]]),
    [`استهلاک پیش‌پرداخت (${s.rates.advance}٪)`, s.advance], ['مجموع پرداخت صورت وضعیت‌های قبلی', s.paidBefore], ['جمع کسورات', s.deductions], [],
    ['مبلغ خالص قابل پرداخت (بدون مالیات)', s.payable], [`مالیات بر ارزش افزوده (${s.rates.vat}٪)`, s.vat], ['مبلغ خالص قابل پرداخت', s.payableWithVat], ['به حروف', toPersianWords(s.payableWithVat) + ' ریال']
  ], [42, 60]), 'صورت وضعیت');
  const items = scopeItems(d.boq, d.scope);
  XLSX.utils.book_append_sheet(wb, sheet([
    ['ردیف', 'شرح آیتم قرارداد', 'مقدار قرارداد', 'مقدار این صورت وضعیت', 'تا صورت وضعیت قبلی', 'کل تا کنون', 'واحد', 'فی (ریال)', 'مبلغ تجمعی (ریال)'],
    ...items.map(it => { const t = d.now[it.id] || 0, p = d.before[it.id] || 0; return [d.labels[it.id], it.desc, num(it.qty), t - p, p, t, it.unit, num(it.price), Math.round(t * num(it.price))]; }),
    [], ['جمع کل تجمعی', '', '', '', '', '', '', '', items.reduce((a, it) => a + Math.round((d.now[it.id] || 0) * num(it.price)), 0)]
  ], [16, 48, 12, 14, 14, 12, 10, 16, 20]), 'صورت کارکرد');
  XLSX.utils.book_append_sheet(wb, sheet([
    ['آیتم قرارداد', 'شمارهٔ صورت وضعیت', 'تاریخ انجام', 'شرح آیتم قرارداد', 'مقدار انجام‌شده', 'واحد', 'فی (ریال)', 'مبلغ (ریال)', 'توضیحات'],
    ...measureRows(d).map(({ m, it }) => [d.labels[m.itemId], Number(m.statementNo) || '', jl(m.date), it?.desc || '', num(m.qty), it?.unit || '', num(it?.price), Math.round(num(m.qty) * num(it?.price)), m.note || ''])
  ], [16, 12, 16, 48, 12, 10, 16, 18, 40]), 'ریزمتره');
  XLSX.utils.book_append_sheet(wb, sheet([
    ['ردیف', 'شرح', 'نوع', 'مقدار', 'واحد', 'فی (ریال)', 'مبلغ (ریال)'],
    ...d.boq.map(it => [d.labels[it.id], it.desc, (it.extra ? 'مازاد — ' : '') + kindName(it), num(it.qty), it.unit, num(it.price), Math.round(num(it.qty) * num(it.price))])
  ], [16, 48, 22, 12, 10, 16, 20]), 'آیتم‌های قرارداد');
  wb.Workbook = { Views: [{ RTL: true }] };
  const blob = new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = statementFileName(d) + '.xlsx'; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
