// Printable A4 project report. Rendered as a standalone document inside a hidden
// iframe so the app's dark theme, layout and fixed headers never leak into the PDF.
import { api, fa, jl, jShort, money, todayIso, weightedProgress, isInstallStage, stageWeight, contractAreaText } from './life';
import { isoToJ } from './jdate';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cssStr = s => String(s ?? '').replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const rial = n => `${fa(Math.round(Number(n) || 0), 0)} ریال`;
const pct = n => `${fa(n, 0)}٪`;
const DEPT_COLORS = { 'کنترل پروژه': '#7c3aed', 'فنی': '#2563eb', 'تأمین': '#d97706', 'اجرا': '#059669' };
const SETTLEMENT = { cash: 'نقدی', check: 'چک', statement: 'صورت‌وضعیتی', barter: 'تهاتری', other: 'سایر' };

const CSS = (brand, reportNo) => `
@font-face{font-family:'Vazirmatn';font-weight:100 900;font-display:block;src:url('/assets/fonts/vazirmatn-arabic.woff2') format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC}
@font-face{font-family:'Vazirmatn';font-weight:100 900;font-display:block;src:url('/assets/fonts/vazirmatn-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2212}
@page{size:A4 portrait;margin:16mm 13mm 18mm;
  @bottom-left{content:"صفحهٔ " counter(page, persian) " از " counter(pages, persian);font:500 8pt Vazirmatn,Tahoma,sans-serif;color:#64748b}
  @bottom-right{content:"${cssStr(brand.footerText || '')}";font:400 8pt Vazirmatn,Tahoma,sans-serif;color:#64748b}
  @top-left{content:"${cssStr(reportNo)}";font:400 7.5pt Vazirmatn,Tahoma,sans-serif;color:#94a3b8}}
@page:first{@top-left{content:none}}
html.capture body{width:695px}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;color:#0f172a;font:400 9.5pt/1.7 Vazirmatn,Tahoma,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{direction:rtl}
.num,td.n{font-feature-settings:"tnum";white-space:nowrap}
header.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:10px;border-bottom:2.5px solid #0f172a}
header.top .kicker{font-size:8.5pt;color:#475569}
header.top h1{font-size:18pt;font-weight:800;line-height:1.35;margin:2px 0}
header.top .meta{font-size:8pt;color:#475569}
header.top .brand{text-align:left;max-width:60mm;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
header.top .brand img{max-height:16mm;max-width:45mm;object-fit:contain}
header.top .brand b{font-size:10pt}
.status{display:inline-block;margin-top:6px;padding:2px 10px;border-radius:99px;font-size:8.5pt;font-weight:700;border:1px solid}
.status.ok{color:#047857;border-color:#6ee7b7;background:#ecfdf5}.status.warn{color:#b45309;border-color:#fcd34d;background:#fffbeb}.status.bad{color:#be123c;border-color:#fda4af;background:#fff1f2}
h2.pb{break-before:page}
.p1{break-after:page;overflow:hidden}.p1i{transform-origin:top right}
@media print{html,body{height:auto!important}}
h2{font-size:11pt;font-weight:800;margin:16px 0 7px;padding-inline-start:8px;border-inline-start:3.5px solid #0f172a;break-after:avoid}
.summary{margin-top:10px;padding:9px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:9.5pt}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;break-inside:avoid}
.kpi{border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px}
.kpi small{display:block;font-size:7.5pt;color:#64748b}
.kpi b{display:block;font-size:15pt;font-weight:800;line-height:1.4}
.kpi span{font-size:7.5pt;color:#475569}
.kpi .bar,.dept .bar{height:5px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-top:4px}
.bar i{display:block;height:100%;border-radius:3px}
.kpi.bad b{color:#be123c}.kpi.good b{color:#047857}
table{width:100%;border-collapse:collapse;font-size:8.5pt}
thead{display:table-header-group}tr{break-inside:avoid}
th{background:#f1f5f9;color:#334155;font-weight:700;text-align:right;padding:5px 6px;border-bottom:1.5px solid #cbd5e1}
td{padding:4.5px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}
tfoot td{font-weight:800;background:#f8fafc;border-top:1.5px solid #cbd5e1}
table.kv td{width:25%}table.kv td.k{color:#64748b;width:17%}table.kv td.v{font-weight:600;width:33%}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px;break-inside:avoid}
.dept{display:grid;grid-template-columns:70px 1fr 64px;align-items:center;gap:8px;padding:3px 0}
.dept b{font-size:9pt}.dept span{font-size:8pt;color:#475569;text-align:left}
.badge{display:inline-block;padding:0 7px;border-radius:99px;font-size:7.5pt;font-weight:700;white-space:nowrap}
.b-done{background:#dcfce7;color:#166534}.b-doing{background:#dbeafe;color:#1e40af}.b-todo{background:#f1f5f9;color:#475569}.b-late{background:#ffe4e6;color:#9f1239}
tr.grp td{background:#f8fafc;font-weight:800;color:#0f172a;border-bottom:1px solid #cbd5e1}
tr.done td{color:#475569}
.muted{color:#94a3b8}
.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:22px;break-inside:avoid}
.sign div{border-top:1px solid #94a3b8;padding-top:5px;text-align:center;font-size:8.5pt;color:#475569;min-height:22mm}
.empty{color:#94a3b8;font-size:8.5pt;padding:6px 0}
`;

export function projectReportHtml(d) {
  const { project, contract, brand, stages, departments, statements } = d;
  const today = todayIso();
  const done = stages.filter(s => s.status === 'done').length;
  const progress = weightedProgress(stages);
  const contractTotal = Number(contract?.amount) || 0, advance = Number(contract?.advancePayment) || 0;
  const stTotal = statements.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const paid = statements.reduce((s, x) => s + (Number(x.paidAmount) || 0), 0);
  const received = advance + paid, receivedPct = contractTotal ? Math.min(100, Math.round(received / contractTotal * 100)) : 0;
  const valid = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
  const start = contract?.contractStartDate, end = contract?.contractEndDate;
  const totalDays = valid(start) && valid(end) ? Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 864e5)) : 0;
  const elapsed = totalDays ? Math.max(0, Math.min(totalDays, Math.round((Date.parse(today) - Date.parse(start)) / 864e5))) : 0;
  const timePct = totalDays ? Math.round(elapsed / totalDays * 100) : null;
  const daysLeft = valid(end) ? Math.round((Date.parse(end) - Date.parse(today)) / 864e5) : null;
  const variance = timePct == null ? null : progress - timePct;
  const late = stages.filter(s => s.status !== 'done' && valid(s.date) && s.date < today);
  const state = progress === 100 ? ['ok', 'تکمیل‌شده'] : (variance != null && variance < -15) || late.length ? ['bad', 'نیازمند پیگیری'] : variance != null && variance < 0 ? ['warn', 'اندکی عقب از برنامه'] : ['ok', 'مطابق برنامه'];
  const reportNo = `${project.name} – ${jl(today)}`;
  const printedAt = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date());
  const logo = /^data:image\/(?:png|jpeg|webp);base64,/i.test(String(brand.logo || '')) ? brand.logo : '';
  const bar = (v, c) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${c}"></i></div>`;

  const summary = [
    `پیشرفت اجرایی پروژه <b>${pct(progress)}</b> است (${fa(done)} از ${fa(stages.length)} مرحله)`,
    timePct != null ? `در حالی که <b>${pct(timePct)}</b> از زمان قرارداد سپری شده${variance < 0 ? `؛ یعنی <b>${fa(-variance)} واحد درصد عقب‌تر</b> از برنامهٔ خطی` : variance > 0 ? `؛ یعنی ${fa(variance)} واحد درصد جلوتر از برنامهٔ خطی` : ''}` : 'تاریخ شروع/پایان قرارداد ثبت نشده است',
    daysLeft != null ? (daysLeft >= 0 ? `${fa(daysLeft)} روز تا پایان قرارداد باقی مانده است` : `${fa(-daysLeft)} روز از پایان قرارداد گذشته است`) : '',
    contractTotal ? `تاکنون ${pct(receivedPct)} از مبلغ قرارداد دریافت شده و ${money(Math.max(0, stTotal - paid))} از صورت‌وضعیت‌ها معوق است` : '',
    late.length ? `<b>${fa(late.length)} مرحله</b> از تاریخ برنامه‌ریزی‌شده عقب افتاده است` : ''
  ].filter(Boolean).join('؛ ') + '.';

  const kv = [['کد پروژه', project.projectCode], ['شماره قرارداد', contract?.contractNo], ['کارفرما', project.client], ['تلفن کارفرما', project.clientPhone], ['مسئول ارتباط', project.owner], ['تلفن مسئول', project.contactPhone], ['موضوع قرارداد', contract?.subject], ['متراژ', contractAreaText(contract)], ['نوع تسویه', SETTLEMENT[contract?.settlementType]], ['مدت قرارداد', totalDays ? `${fa(totalDays)} روز` : ''], ['تاریخ شروع', valid(start) ? jl(start) : ''], ['تاریخ پایان', valid(end) ? jl(end) : '']];
  const kvRows = []; for (let i = 0; i < kv.length; i += 2) kvRows.push(`<tr>${kv.slice(i, i + 2).map(([k, v]) => `<td class="k">${k}</td><td class="v">${v ? esc(v) : '<span class="muted">—</span>'}</td>`).join('')}</tr>`);

  const stRows = statements.map(s => { const a = Number(s.amount) || 0, p = Number(s.paidAmount) || 0; const step = s.statementSent ? `ارسال صورت‌وضعیت${s.statementSentDate ? '، ' + jShort(s.statementSentDate) : ''}` : s.noticeApproved ? `تأیید اعلام وضعیت${s.noticeApprovedDate ? '، ' + jShort(s.noticeApprovedDate) : ''}` : s.noticeSent ? `ارسال اعلام وضعیت${s.noticeSentDate ? '، ' + jShort(s.noticeSentDate) : ''}` : 'ثبت اولیه'; return `<tr><td class="n">${fa(s.statementNo || 0)}${s.item ? `<br><span class="muted">${esc(s.item)}</span>` : ''}</td><td>${step}</td><td class="n">${rial(a)}</td><td class="n">${rial(p)}</td><td class="n">${s.paymentDate ? jShort(s.paymentDate) : '<span class="muted">—</span>'}</td><td class="n">${a - p > 0 ? rial(a - p) : '<span class="badge b-done">تسویه</span>'}</td></tr>`; }).join('');

  const statusBadge = s => s.status === 'done' ? '<span class="badge b-done">انجام شد</span>' : valid(s.date) && s.date < today ? '<span class="badge b-late">عقب‌افتاده</span>' : isInstallStage(s) && Number(s.percent) > 0 ? `<span class="badge b-doing">${fa(Number(s.percent), 0)}٪ نصب</span>` : s.status === 'doing' ? '<span class="badge b-doing">در حال انجام</span>' : '<span class="badge b-todo">در انتظار</span>';
  let n = 0;
  const stageRows = departments.map(dep => { const rows = stages.filter(s => s.department === dep.department); return `<tr class="grp"><td colspan="6">${esc(dep.department)} <span class="muted">(${fa(dep.done)} از ${fa(dep.total)} انجام‌شده)</span></td></tr>` + rows.map(s => `<tr class="${s.status === 'done' ? 'done' : ''}"><td class="n">${fa(++n)}</td><td>${esc(s.title)}${s.note ? `<div class="muted">${esc(s.note)}</div>` : ''}</td><td class="n">${fa(stageWeight(s, stages), 1)}٪</td><td>${statusBadge(s)}</td><td class="n">${valid(s.date) ? jShort(s.date) : '<span class="muted">—</span>'}</td><td>${s.owner ? esc(s.owner) : '<span class="muted">—</span>'}</td></tr>`).join(''); }).join('');
  const next = stages.filter(s => s.status !== 'done').sort((a, b) => (valid(a.date) ? a.date : '9').localeCompare(valid(b.date) ? b.date : '9')).slice(0, 6);

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${esc(reportNo)}</title><style>${CSS(brand, reportNo)}</style></head><body>
<section class="p1"><div class="p1i">
<header class="top"><div><div class="kicker">گزارش وضعیت پروژه</div><h1>${esc(project.name)}</h1><div class="meta">تاریخ تهیه: ${esc(printedAt)}${project.client ? `  |  کارفرما: ${esc(project.client)}` : ''}</div><span class="status ${state[0]}">${state[1]}</span></div>
<div class="brand">${logo ? `<img src="${logo}" alt="">` : ''}${brand.headerText ? `<b>${esc(brand.headerText)}</b>` : ''}</div></header>
<div class="summary"><b>خلاصهٔ مدیریتی:</b> ${summary}</div>
<div class="kpis">
<div class="kpi"><small>پیشرفت اجرایی (وزنی)</small><b class="num">${pct(progress)}</b>${bar(progress, '#0f172a')}<span>${fa(done)} از ${fa(stages.length)} مرحله</span></div>
<div class="kpi"><small>زمان سپری‌شده</small><b class="num">${timePct == null ? '—' : pct(timePct)}</b>${bar(timePct || 0, '#64748b')}<span>${totalDays ? `${fa(elapsed)} از ${fa(totalDays)} روز` : 'تاریخ ثبت نشده'}</span></div>
<div class="kpi ${variance == null ? '' : variance < 0 ? 'bad' : 'good'}"><small>انحراف از برنامه</small><b class="num">${variance == null ? '—' : variance === 0 ? 'منطبق' : `${pct(Math.abs(variance))} ${variance < 0 ? 'عقب' : 'جلو'}`}</b><span>پیشرفت اجرایی نسبت به زمان</span></div>
<div class="kpi"><small>وصولی از قرارداد</small><b class="num">${pct(receivedPct)}</b>${bar(receivedPct, '#059669')}<span>${money(received)} از ${money(contractTotal)}</span></div>
</div>
<h2>مشخصات پروژه و قرارداد</h2><table class="kv"><tbody>${kvRows.join('')}</tbody></table>
<div class="two"><div><h2>پیشرفت به تفکیک واحد</h2>${departments.map(x => `<div class="dept"><b>${esc(x.department)}</b>${bar(x.progress, DEPT_COLORS[x.department] || '#0f172a')}<span>${pct(x.progress)} (${fa(x.done)} از ${fa(x.total)})</span></div>`).join('')}</div>
<div><h2>خلاصهٔ مالی</h2><table><tbody>
<tr><td>مبلغ کل قرارداد</td><td class="n">${rial(contractTotal)}</td></tr>
<tr><td>پیش‌پرداخت</td><td class="n">${rial(advance)}</td></tr>
<tr><td>جمع صورت‌وضعیت‌ها</td><td class="n">${rial(stTotal)}</td></tr>
<tr><td>جمع واریزی‌ها</td><td class="n">${rial(paid)}</td></tr>
<tr><td>مطالبات معوق صورت‌وضعیت</td><td class="n">${rial(Math.max(0, stTotal - paid))}</td></tr>
</tbody><tfoot><tr><td>ماندهٔ قرارداد (پس از دریافتی‌ها)</td><td class="n">${rial(Math.max(0, contractTotal - received))}</td></tr></tfoot></table></div></div>
</div></section>
<h2>صورت‌وضعیت‌ها</h2>${statements.length ? `<table><thead><tr><th>شماره</th><th>آخرین مرحله</th><th>مبلغ</th><th>واریزی</th><th>تاریخ واریز</th><th>مانده</th></tr></thead><tbody>${stRows}</tbody><tfoot><tr><td colspan="2">جمع</td><td class="n">${rial(stTotal)}</td><td class="n">${rial(paid)}</td><td></td><td class="n">${rial(Math.max(0, stTotal - paid))}</td></tr></tfoot></table>` : '<p class="empty">هنوز صورت‌وضعیتی ثبت نشده است.</p>'}
${next.length ? `<h2 class="pb">اقدامات بعدی</h2><table><thead><tr><th>مرحله</th><th>واحد</th><th>وضعیت</th><th>تاریخ برنامه</th><th>مسئول</th></tr></thead><tbody>${next.map(s => `<tr><td>${esc(s.title)}</td><td>${esc(s.department)}</td><td>${statusBadge(s)}</td><td class="n">${valid(s.date) ? jShort(s.date) : '<span class="muted">—</span>'}</td><td>${s.owner ? esc(s.owner) : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table>` : ''}
<h2 class="pb">وضعیت مراحل اجرایی</h2><table><thead><tr><th style="width:7%">ردیف</th><th>مرحله</th><th style="width:8%">وزن</th><th style="width:15%">وضعیت</th><th style="width:13%">تاریخ</th><th style="width:18%">مسئول</th></tr></thead><tbody>${stageRows}</tbody></table>
<div class="sign"><div>تهیه‌کننده</div><div>تأیید مدیر پروژه</div><div>رؤیت کارفرما</div></div>
</body></html>`;
}

// Page 1 (header → financial summary) must fit on one A4 page so statements start on page 2.
// If it is taller (long names, logo, many fields), widen the inner box and scale it down to fit.
function fitFirstPage(doc, W) {
  const outer = doc.querySelector('.p1'), inner = doc.querySelector('.p1i');
  if (!outer || !inner) return;
  const avail = Math.floor(W * 256 / 184);
  let k = 1, h = inner.offsetHeight;
  for (let i = 0; i < 3 && h * k > avail; i++) {
    k = Math.max(0.55, avail / h);
    inner.style.width = `${W / k}px`;
    h = inner.offsetHeight;
  }
  k = Math.min(1, avail / h);
  if (k < 1) { inner.style.width = `${W / k}px`; inner.style.transform = `scale(${k})`; outer.style.height = `${Math.ceil(h * k)}px`; }
}

const pad2 = n => String(n).padStart(2, '0');
// "1405-07-08_13-45_<project>.pdf" — sorts by date in any file manager.
export function reportFileName(project) {
  const now = new Date(), iso = todayIso(), j = isoToJ(iso);
  const hm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Tehran' }).format(now).replace(':', '-');
  const name = String(project?.name || 'project').replace(/[\\/<>:"|?*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${j.jy}-${pad2(j.jm)}-${pad2(j.jd)}_${hm}_${name}.pdf`;
}

function mountFrame(id, width, html, hidden = true) {
  document.getElementById(id)?.remove();
  const frame = document.createElement('iframe');
  frame.id = id;
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;width:${width}px;height:10px;border:0;left:-10000px;top:0${hidden ? ';visibility:hidden' : ''}`;
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open(); doc.write(html); doc.close();
  return frame;
}

// A strip of text drawn by the browser (so Persian is shaped correctly) for the PDF header/footer.
function stripImage(doc, right, left, W) {
  const c = doc.createElement('canvas'), k = 2; c.width = W * k; c.height = 18 * k;
  const x = c.getContext('2d'); x.scale(k, k); x.fillStyle = '#fff'; x.fillRect(0, 0, W, 18);
  x.font = '400 10.5px Vazirmatn, Tahoma, sans-serif'; x.fillStyle = '#64748b'; x.textBaseline = 'middle'; x.direction = 'rtl';
  if (right) { x.textAlign = 'right'; x.fillText(right, W, 9); }
  if (left) { x.textAlign = 'left'; x.fillText(left, 0, 9); }
  return c.toDataURL('image/png');
}

// Builds the same report as a real PDF file (A4, rasterised at 2x) for sending to Telegram.
export async function projectReportPdf(data) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const W = 695, pageH = Math.floor(W * 261 / 184), MX = 13, MT = 16;
  const frame = mountFrame('lf-report-pdf-frame', W, projectReportHtml(data));
  try {
    const doc = frame.contentDocument;
    doc.documentElement.classList.add('capture');
    await (doc.fonts?.ready || Promise.resolve());
    fitFirstPage(doc, W);
    await (doc.fonts?.ready || Promise.resolve());
    const body = doc.body, total = Math.ceil(body.scrollHeight);
    frame.style.height = total + 'px';
    const top0 = body.getBoundingClientRect().top;
    const breaks = [...doc.querySelectorAll('tr, h2, .kpis, .two, .sign, .summary, p.empty')].map(el => Math.round(el.getBoundingClientRect().top - top0)).filter(y => y > 0).sort((a, b) => a - b);
    const p1 = doc.querySelector('.p1');
    const forced = [
      ...(p1 ? [Math.round(p1.getBoundingClientRect().bottom - top0)] : []),
      ...[...doc.querySelectorAll('h2.pb')].map(el => Math.round(el.getBoundingClientRect().top - top0) - 8)
    ].filter(y => y > 0).sort((a, b) => a - b);
    const canvas = await html2canvas(body, { scale: 2, backgroundColor: '#ffffff', width: W, height: total, windowWidth: W, windowHeight: total, logging: false });
    const k = canvas.width / W, pages = [];
    for (let start = 0; start < total - 4;) {
      let end = Math.min(total, start + pageH);
      const f = forced.find(y => y > start + 4 && y <= end);
      if (f) end = f;
      else if (end < total) { const b = breaks.filter(y => y > start + 120 && y <= end).pop(); if (b) end = b; }
      pages.push([start, end]); start = end;
    }
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const faNum = n => Number(n).toLocaleString('fa-IR');
    const running = `${data.project.name} – ${jl(todayIso())}`;
    pages.forEach(([s, e], i) => {
      if (i) pdf.addPage();
      const c = doc.createElement('canvas'); c.width = canvas.width; c.height = Math.round((e - s) * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(canvas, 0, Math.round(s * k), canvas.width, c.height, 0, 0, canvas.width, c.height);
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', MX, MT, 184, (e - s) * 184 / W, undefined, 'FAST');
      const stripH = 18 * 184 / W;
      if (i) pdf.addImage(stripImage(doc, '', running, W), 'PNG', MX, 7, 184, stripH);
      pdf.addImage(stripImage(doc, data.brand?.footerText || '', `صفحهٔ ${faNum(i + 1)} از ${faNum(pages.length)}`, W), 'PNG', MX, 297 - 12, 184, stripH);
    });
    pdf.setProperties({ title: reportFileName(data.project).replace(/\.pdf$/, ''), subject: 'گزارش وضعیت پروژه', creator: 'LifeOS' });
    return pdf.output('blob');
  } finally { frame.remove(); }
}

const blobToDataUrl = blob => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });

export async function sendProjectReportToTelegram(data) {
  const filename = reportFileName(data.project);
  const blob = await projectReportPdf(data);
  await api('/api/projects/report-pdf', { method: 'POST', body: JSON.stringify({ filename, caption: `📄 گزارش وضعیت پروژهٔ ${data.project.name}\n${jl(todayIso())}`, data: await blobToDataUrl(blob) }) });
  return filename;
}

// Opens the browser print dialog; the suggested file name is reportFileName.
export async function printProjectReport(data) {
  const title = reportFileName(data.project).replace(/\.pdf$/, '');
  const frame = mountFrame('lf-report-print-frame', 695, projectReportHtml(data), false);
  const doc = frame.contentDocument;
  doc.title = title;
  doc.documentElement.classList.add('capture');
  await (doc.fonts?.ready || Promise.resolve());
  fitFirstPage(doc, 695);
  const prevTitle = document.title;
  document.title = title;
  try { frame.contentWindow.focus(); frame.contentWindow.print(); } finally { document.title = prevTitle; }
}
