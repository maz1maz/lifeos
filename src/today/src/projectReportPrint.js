// Printable A4 project report. Rendered as a standalone document inside a hidden
// iframe so the app's dark theme, layout and fixed headers never leak into the PDF.
import { api, fa, jl, jShort, money, todayIso, weightedProgress, isInstallStage, contractAreaText, statementLedger, itemProgress, itemOptionsText, contractScope } from './life';
import { isoToJ } from './jdate';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cssStr = s => String(s ?? '').replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const rial = n => `${fa(Math.round(Number(n) || 0), 0)} ریال`;
const pct = n => `${fa(n, 0)}٪`;
const ITEM_COLORS = ['#2563eb', '#db2777', '#d97706', '#7c3aed', '#0d9488', '#ea580c', '#65a30d', '#0284c7'];
const DEPTS = ['کنترل پروژه', 'فنی', 'تأمین', 'اجرا'];
const DEPT_COLORS = { 'کنترل پروژه': '#7c3aed', 'فنی': '#2563eb', 'تأمین': '#d97706', 'اجرا': '#059669' };
const SETTLEMENT = { cash: 'نقدی', check: 'چک', statement: 'صورت‌وضعیتی', barter: 'تهاتری', other: 'سایر' };

// the seyfikhani panel ships the fonts next to studio.html (studio-assets/), LifeOS serves them from /assets/fonts/
const fontBase = () => (typeof window !== 'undefined' && window.__lifeosApi) ? new URL('studio-assets/', location.href).href : '/assets/fonts/';
const CSS = (brand, reportNo) => `
@font-face{font-family:'Vazirmatn';font-weight:100 900;font-display:block;src:url('${fontBase()}vazirmatn-arabic.woff2') format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC}
@font-face{font-family:'Vazirmatn';font-weight:100 900;font-display:block;src:url('${fontBase()}vazirmatn-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2212}
@page{size:A4 portrait;margin:16mm 13mm 18mm;
  @bottom-left{content:"صفحهٔ " counter(page, persian) " از " counter(pages, persian);font:500 8pt Vazirmatn,Tahoma,sans-serif;color:#64748b}
  @bottom-right{content:"${cssStr(brand.footerText || '')}";font:400 8pt Vazirmatn,Tahoma,sans-serif;color:#64748b}
  @top-left{content:"${cssStr(reportNo)}";font:400 7.5pt Vazirmatn,Tahoma,sans-serif;color:#94a3b8}}
@page:first{@top-left{content:none}}
html.capture body{width:695px;padding:0 4px 24px}header.top .meta{white-space:nowrap}.status,.slegend span,.legend span,.badge,.st{white-space:nowrap}
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
.bar{height:5px;background:#e2e8f0;border-radius:3px;overflow:hidden}.kpi .bar,.dept .bar{margin-top:4px}
.bar i{display:block;height:100%;border-radius:3px}
.kpi.bad b{color:#be123c}.kpi.good b{color:#047857}
table{width:100%;border-collapse:collapse;font-size:8.5pt}
thead{display:table-header-group}tr{break-inside:avoid}
th{background:#f1f5f9;color:#334155;font-weight:700;text-align:right;padding:5px 6px;border-bottom:1.5px solid #cbd5e1}
td{padding:4.5px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}
tfoot td{font-weight:800;background:#f8fafc;border-top:1.5px solid #cbd5e1}
table.stages{table-layout:auto;width:100%;font-size:7.6pt}table.stages tr:not(.igrp) td:not(.note){white-space:nowrap}table.stages .note{width:100%}table.stages th{font-size:7.2pt;white-space:nowrap;padding:5px 4px}table.stages td{padding:4px;vertical-align:middle}table.stages tr:not(.igrp) td:first-child,table.stages th:first-child{padding-inline-end:0;text-align:center}table.stages td:nth-child(2),table.stages th:nth-child(2){padding-inline-start:2px}table.stages td:nth-child(3){font-size:6.6pt;color:#475569;white-space:nowrap}table.stages tr.igrp .gopts{font-weight:600;font-size:7pt;color:#334155;margin-inline-start:8px;padding:0 6px;border:1px solid #c7d2fe;border-radius:99px;background:#fff}tr.igrp td{font-size:7.6pt;white-space:normal;color:#0f172a}table.stages td,table.stages th{overflow-wrap:anywhere;word-break:break-word}td.note{font-size:10.5px;line-height:1.6;white-space:pre-wrap}p.note{margin:6px 0;font-size:12px;line-height:1.8}tr.noterow td{font-size:11px;background:#f8fafc}table.kv td{width:25%}table.kv td.k{color:#64748b;width:17%}table.kv td.v{font-weight:600;width:33%}
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
.ring{display:block}
.sharebar{display:flex;gap:2px;height:22px;margin:4px 0 6px;break-inside:avoid}
.sharebar span{position:relative;display:block;min-width:2px;border-radius:4px;overflow:hidden;background:#e2e8f0}.slegend{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:7.5pt;color:#334155;margin-bottom:4px}.slegend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-inline-end:4px;vertical-align:middle}.slegend em{font-style:normal;color:#64748b}
.sharebar span i{position:absolute;inset-block:0;right:0;display:block}
.sharebar span b{position:relative;display:block;padding:0 5px;font-size:7.5pt;line-height:22px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
table.items td{vertical-align:middle}table.items .sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-inline-end:5px;vertical-align:middle}
table.items .mini{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}table.items .mini div{font-size:6.5pt;color:#64748b;text-align:center}table.items .mini .bar{margin-top:2px}
tr.igrp td{background:#eef2ff;font-weight:800;color:#0f172a;border-bottom:1.5px solid #c7d2fe}tr.igrp td .bar{display:inline-block;width:90px;vertical-align:middle;margin:0 8px}tr.igrp.fixed td{background:#f8fafc;border-bottom-color:#cbd5e1}tr.igrp.complete td{background:#ecfdf5;border-bottom-color:#a7f3d0}

`;

export function projectReportHtml(d) {
  const { project, contract, brand, stages, departments, statements, items = [] } = d;
  const today = todayIso();
  const done = stages.filter(s => s.status === 'done').length;
  const progress = weightedProgress(stages);
  const contractTotal = Number(contract?.amount) || 0, advance = Number(contract?.advancePayment) || 0;
  const ledger = statementLedger(statements), stTotal = ledger.billed;
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
  // SVG ring: renders the same in the browser print path and the canvas PDF path
  const ring = (v, c, size = 46) => { const r = size / 2 - 5, L = 2 * Math.PI * r, p = Math.max(0, Math.min(100, v)); return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="6"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(L * p / 100).toFixed(2)} ${L.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${size / 4.2}" font-weight="800" fill="#0f172a" font-family="Vazirmatn,Tahoma">${fa(p, 0)}٪</text></svg>`; };
  const itemRows = items.map((x, i) => ({ ...x, color: ITEM_COLORS[i % ITEM_COLORS.length], depts: DEPTS.map(dp => [dp, stages.some(st => st.item === x.item && st.department === dp) ? itemProgress(stages, x.item, dp) : null]), done: stages.filter(st => st.item === x.item && st.status === 'done').length, total: stages.filter(st => st.item === x.item).length }));
  const itemsSection = itemRows.length ? `<h2>پیشرفت آیتم‌های قرارداد</h2>
<div class="sharebar">${itemRows.map(x => `<span style="flex:${Math.max(x.share, 2)};background:${x.color}2e;border:1px solid ${x.color}"><i style="width:${x.progress}%;background:${x.color}"></i>${x.share >= 9 ? `<b>${esc(x.item)}</b>` : ''}</span>`).join('')}</div>
<div class="slegend">${itemRows.map(x => `<span><i style="background:${x.color}"></i>${esc(x.item)} <em>${pct(x.share)}</em></span>`).join('')}</div>
<p class="muted" style="font-size:7.5pt;margin-bottom:6px">عرض هر بخش = سهم آیتم از پروژه (بر اساس متراژ) · پرشدگی = پیشرفت همان آیتم</p>
<table class="items"><thead><tr><th style="width:22%">آیتم</th><th style="width:9%">سهم</th><th style="width:12%">پیشرفت</th><th style="width:11%">مراحل</th><th>پیشرفت واحدها (کنترل · فنی · تأمین · اجرا)</th></tr></thead><tbody>${itemRows.map(x => `<tr><td><span class="sw" style="background:${x.color}"></span><b>${esc(x.item)}</b>${x.progress === 100 ? ' <span class="badge b-done">تمام شد</span>' : ''}</td><td class="n">${pct(x.share)}</td><td>${ring(x.progress, x.progress === 100 ? '#059669' : x.color, 40)}</td><td class="n">${fa(x.done)} از ${fa(x.total)}</td><td><div class="mini">${x.depts.map(([dp, v]) => `<div>${v == null ? '—' : `${dp === 'کنترل پروژه' ? 'کنترل' : dp} ${pct(v)}${bar(v, DEPT_COLORS[dp])}`}</div>`).join('')}</div></td></tr>`).join('')}</tbody></table>` : '';

  const summary = [
    `پیشرفت اجرایی پروژه <b>${pct(progress)}</b> است (${fa(done)} از ${fa(stages.length)} مرحله)`,
    timePct != null ? `در حالی که <b>${pct(timePct)}</b> از زمان قرارداد سپری شده${variance < 0 ? `؛ یعنی <b>${fa(-variance)} واحد درصد عقب‌تر</b> از برنامهٔ خطی` : variance > 0 ? `؛ یعنی ${fa(variance)} واحد درصد جلوتر از برنامهٔ خطی` : ''}` : 'تاریخ شروع/پایان قرارداد ثبت نشده است',
    daysLeft != null ? (daysLeft >= 0 ? `${fa(daysLeft)} روز تا پایان قرارداد باقی مانده است` : `${fa(-daysLeft)} روز از پایان قرارداد گذشته است`) : '',
    contractTotal ? `تاکنون ${pct(receivedPct)} از مبلغ قرارداد دریافت شده و ${money(Math.max(0, stTotal - paid))} از صورت‌وضعیت‌ها معوق است` : '',
    late.length ? `<b>${fa(late.length)} مرحله</b> از تاریخ برنامه‌ریزی‌شده عقب افتاده است` : ''
  ].filter(Boolean).join('؛ ') + '.';

  const kv = [['کد پروژه', project.projectCode], ['شماره قرارداد', contract?.contractNo], ['کارفرما', project.client], ['تلفن کارفرما', project.clientPhone], ['مسئول ارتباط', project.owner], ['تلفن مسئول', project.contactPhone], ['موضوع قرارداد', contract?.subject], ['متراژ', contractAreaText(contract)], ...contractScope(contract).filter(it => itemOptionsText(contract, it)).map(it => [`گزینه‌های ${it}`, itemOptionsText(contract, it)]), ['نوع تسویه', SETTLEMENT[contract?.settlementType]], ['مدت قرارداد', totalDays ? `${fa(totalDays)} روز` : ''], ['تاریخ شروع', valid(start) ? jl(start) : ''], ['تاریخ پایان', valid(end) ? jl(end) : '']];
  const kvRows = []; for (let i = 0; i < kv.length; i += 2) kvRows.push(`<tr>${kv.slice(i, i + 2).map(([k, v]) => `<td class="k">${k}</td><td class="v">${v ? esc(v) : '<span class="muted">—</span>'}</td>`).join('')}</tr>`);

  const stRows = ledger.list.map(s => { const a = Number(s.amount) || 0, p = Number(s.paidAmount) || 0, rem = s.remaining; const step = s.statementSent ? `ارسال صورت‌وضعیت${s.statementSentDate ? '، ' + jShort(s.statementSentDate) : ''}` : s.noticeApproved ? `تأیید اعلام وضعیت${s.noticeApprovedDate ? '، ' + jShort(s.noticeApprovedDate) : ''}` : s.noticeSent ? `ارسال اعلام وضعیت${s.noticeSentDate ? '، ' + jShort(s.noticeSentDate) : ''}` : 'ثبت اولیه'; return `<tr><td class="n">${fa(s.statementNo || 0)}</td><td>${step}</td><td class="n">${rial(a)}</td><td class="n">${rial(p)}</td><td class="n">${s.paymentDate ? jShort(s.paymentDate) : '<span class="muted">—</span>'}</td><td class="n">${rem > 0 ? rial(rem) : '<span class="badge b-done">تسویه</span>'}</td></tr>` + (s.note ? `<tr class="noterow"><td colspan="6"><span class="muted">توضیحات:</span> ${esc(s.note)}</td></tr>` : ''); }).join('');

  const statusBadge = s => s.status === 'done' ? '<span class="badge b-done">انجام شد</span>' : valid(s.date) && s.date < today ? '<span class="badge b-late">عقب‌افتاده</span>' : isInstallStage(s) && Number(s.percent) > 0 ? `<span class="badge b-doing">${fa(Number(s.percent), 0)}٪ نصب</span>` : s.status === 'doing' ? '<span class="badge b-doing">در حال انجام</span>' : '<span class="badge b-todo">در انتظار</span>';
  let n = 0;
  const groupOf = st => st.group || (st.item ? `item:${st.item}` : 'start');
  const groups = []; for (const st of stages) { const g = groupOf(st); let G = groups.find(x => x.key === g); if (!G) groups.push(G = { key: g, item: st.item || '', rows: [] }); G.rows.push(st); }
  const stageRows = groups.map(G => {
    const dn = G.rows.filter(x => x.status === 'done').length, all = G.rows.length, ir = itemRows.find(x => x.item === G.item);
    const head = G.item ? `<tr class="igrp ${ir?.progress === 100 ? 'complete' : ''}"><td colspan="7">${esc(G.item)}${ir ? `${bar(ir.progress, ir.progress === 100 ? '#059669' : ir.color)}${pct(ir.progress)} · سهم ${pct(ir.share)}` : ''} <span class="muted">(${fa(dn)} از ${fa(all)} انجام‌شده)</span>${itemOptionsText(contract, G.item) ? ` <span class="gopts">${esc(itemOptionsText(contract, G.item))}</span>` : ''}</td></tr>`
      : `<tr class="igrp fixed ${dn === all ? 'complete' : ''}"><td colspan="7">${G.key === 'end' ? 'تحویل پروژه' : G.key === 'start' ? 'مراحل عمومی پروژه' : 'مراحل اجرایی'} <span class="muted">(${fa(dn)} از ${fa(all)} انجام‌شده)</span></td></tr>`;
    return head + G.rows.map(st => `<tr class="${st.status === 'done' ? 'done' : ''}"><td class="n">${fa(++n)}</td><td>${esc(st.base || st.title)}</td><td>${esc(st.department)}</td><td>${statusBadge(st)}</td><td class="n">${valid(st.date) ? jShort(st.date) : '<span class="muted">—</span>'}</td><td>${st.owner ? esc(st.owner) : '<span class="muted">—</span>'}</td><td class="note">${st.note ? esc(st.note) : '<span class="muted">—</span>'}</td></tr>`).join('');
  }).join('');
  const next = stages.filter(s => s.status !== 'done').sort((a, b) => (valid(a.date) ? a.date : '9').localeCompare(valid(b.date) ? b.date : '9')).slice(0, 6);

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${esc(reportNo)}</title><style>${CSS(brand, reportNo)}</style></head><body>
<section class="p1"><div class="p1i">
<header class="top"><div><div class="kicker">گزارش وضعیت پروژه</div><h1>${esc(project.name)}</h1><div class="meta">تاریخ تهیه: ${esc(printedAt)}${project.client ? `  |  کارفرما: ${esc(project.client)}` : ''}</div><span class="status ${state[0]}">${state[1]}</span></div>
<div class="brand">${logo ? `<img src="${logo}" alt="">` : ''}${brand.headerText ? `<b>${esc(brand.headerText)}</b>` : ''}</div></header>
<div class="summary"><b>خلاصهٔ مدیریتی:</b> ${summary}</div>
<div class="kpis">
<div class="kpi" style="display:flex;align-items:center;gap:8px">${ring(progress, progress === 100 ? '#059669' : '#0f172a', 52)}<div><small>پیشرفت اجرایی (وزنی)</small><span>${fa(done)} از ${fa(stages.length)} مرحله</span></div></div>
<div class="kpi"><small>زمان سپری‌شده</small><b class="num">${timePct == null ? '—' : pct(timePct)}</b>${bar(timePct || 0, '#64748b')}<span>${totalDays ? `${fa(elapsed)} از ${fa(totalDays)} روز` : 'تاریخ ثبت نشده'}</span></div>
<div class="kpi ${variance == null ? '' : variance < 0 ? 'bad' : 'good'}"><small>انحراف از برنامه</small><b class="num">${variance == null ? '—' : variance === 0 ? 'منطبق' : `${pct(Math.abs(variance))} ${variance < 0 ? 'عقب' : 'جلو'}`}</b><span>پیشرفت اجرایی نسبت به زمان</span></div>
<div class="kpi"><small>وصولی از قرارداد</small><b class="num">${pct(receivedPct)}</b>${bar(receivedPct, '#059669')}<span>${money(received)} از ${money(contractTotal)}</span></div>
</div>
<h2>مشخصات پروژه و قرارداد</h2><table class="kv"><tbody>${kvRows.join('')}</tbody></table>${project.note ? `<p class="note"><b>توضیحات پروژه:</b> ${esc(project.note)}</p>` : ''}${contract?.note ? `<p class="note"><b>توضیحات قرارداد:</b> ${esc(contract.note)}</p>` : ''}
<div class="two"><div><h2>پیشرفت به تفکیک واحد</h2>${departments.map(x => `<div class="dept"><b>${esc(x.department)}</b>${bar(x.progress, DEPT_COLORS[x.department] || '#0f172a')}<span>${pct(x.progress)} (${fa(x.done)} از ${fa(x.total)})</span></div>`).join('')}</div>
<div><h2>خلاصهٔ مالی</h2><table><tbody>
<tr><td>مبلغ کل قرارداد</td><td class="n">${rial(contractTotal)}</td></tr>
<tr><td>پیش‌پرداخت</td><td class="n">${rial(advance)}</td></tr>
<tr><td>آخرین صورت‌وضعیت (تجمعی)</td><td class="n">${rial(stTotal)}</td></tr>
<tr><td>جمع واریزی‌ها</td><td class="n">${rial(paid)}</td></tr>
<tr><td>مطالبات معوق صورت‌وضعیت</td><td class="n">${rial(Math.max(0, stTotal - paid))}</td></tr>
</tbody></table></div></div>
</div></section>
${itemsSection}
<h2>صورت‌وضعیت‌ها</h2>${statements.length ? `<table><thead><tr><th>شماره</th><th>آخرین مرحله</th><th>مبلغ</th><th>واریزی</th><th>تاریخ واریز</th><th>مانده</th></tr></thead><tbody>${stRows}</tbody><tfoot><tr><td colspan="2">آخرین صورت‌وضعیت (تجمعی) / جمع واریزی / معوق</td><td class="n">${rial(stTotal)}</td><td class="n">${rial(paid)}</td><td></td><td class="n">${rial(Math.max(0, stTotal - paid))}</td></tr></tfoot></table>` : '<p class="empty">هنوز صورت‌وضعیتی ثبت نشده است.</p>'}
${next.length ? `<h2>اقدامات بعدی</h2><table><thead><tr><th>مرحله</th><th>واحد</th><th>وضعیت</th><th>تاریخ برنامه</th><th>مسئول</th></tr></thead><tbody>${next.map(s => `<tr><td>${esc(s.title)}</td><td>${esc(s.department)}</td><td>${statusBadge(s)}</td><td class="n">${valid(s.date) ? jShort(s.date) : '<span class="muted">—</span>'}</td><td>${s.owner ? esc(s.owner) : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table>` : ''}
<h2>وضعیت مراحل اجرایی</h2><table class="stages"><thead><tr><th>ردیف</th><th>مرحله</th><th>واحد</th><th>وضعیت</th><th>تاریخ انجام</th><th>مسئول</th><th class="note">توضیحات</th></tr></thead><tbody>${stageRows}</tbody></table>
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

async function inlineFonts(doc) {
  const toData = async url => { const r = await fetch(url); if (!r.ok) throw new Error(); return blobToDataUrl(await r.blob()); };
  for (const st of doc.querySelectorAll('style')) {
    const urls = [...new Set([...st.textContent.matchAll(/url\('([^']+\.woff2)'\)/g)].map(m => m[1]))];
    for (const u of urls) { try { st.textContent = st.textContent.split(`url('${u}')`).join(`url('${await toData(u)}')`); } catch { /* keep the URL; text still renders with a fallback font */ } }
  }
  await (doc.fonts?.ready || Promise.resolve());
}
// Builds the same report as a real PDF file (A4, rasterised at 2x) for sending to Telegram.
export function projectReportPdf(data) {
  return renderPdf(projectReportHtml(data), { running: `${data.project.name} – ${jl(todayIso())}`, footer: data.brand?.footerText || '', title: reportFileName(data.project).replace(/\.pdf$/, ''), subject: 'گزارش وضعیت پروژه' });
}
async function renderPdf(html, { running, footer, title, subject }) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const W = 695, pageH = Math.floor(W * 261 / 184), MX = 13, MT = 16;
  const frame = mountFrame('lf-report-pdf-frame', W, html);
  try {
    const doc = frame.contentDocument;
    doc.documentElement.classList.add('capture');
    await (doc.fonts?.ready || Promise.resolve());
    // foreignObject rendering lets the browser lay the text out itself: html2canvas's own text path drops the
    // spaces between Persian words and misplaces «٪». Fonts are inlined first (an SVG image can't fetch them),
    // and before measuring, so the layout we measure is the one that gets drawn.
    await inlineFonts(doc);
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
    const canvas = await html2canvas(body, { scale: 2, backgroundColor: '#ffffff', width: W, height: total, windowWidth: W, windowHeight: total, logging: false, foreignObjectRendering: true });
    const k = canvas.width / W, pages = [];
    // the drawn image can sit a few px off the measured layout, so every cut is snapped up to the nearest
    // pixel row of the image that is one flat colour (a gap between rows), never through a line of text
    const cx = canvas.getContext('2d', { willReadFrequently: true });
    const flat = py => { const d = cx.getImageData(0, py, canvas.width, 1).data; if (d[0] < 245 || d[1] < 245 || d[2] < 245) return false; for (let i = 8; i < d.length; i += 8) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 30) return false; return true; };
    const snap = (y, min) => { try { for (let py = Math.floor(y * k); py > min * k; py--) if (flat(py) && flat(py - 1)) return py / k; } catch { /* unreadable canvas: keep the measured cut */ } return y; };
    for (let start = 0; start < total - 4;) {
      let end = Math.min(total, start + pageH);
      const f = forced.find(y => y > start + 4 && y <= end);
      if (f) end = f;
      else if (end < total) { const b = breaks.filter(y => y > start + 120 && y <= end).pop(); if (b) end = b; }
      if (end < total) end = snap(end, Math.max(start + 60, end - 90));
      pages.push([start, end]); start = end;
    }
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const faNum = n => Number(n).toLocaleString('fa-IR');
    pages.forEach(([s, e], i) => {
      if (i) pdf.addPage();
      const c = doc.createElement('canvas'); c.width = canvas.width; c.height = Math.round((e - s) * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(canvas, 0, Math.round(s * k), canvas.width, c.height, 0, 0, canvas.width, c.height);
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', MX, MT, 184, (e - s) * 184 / W, undefined, 'FAST');
      const stripH = 18 * 184 / W;
      if (i) pdf.addImage(stripImage(doc, '', running, W), 'PNG', MX, 7, 184, stripH);
      pdf.addImage(stripImage(doc, footer, `صفحهٔ ${faNum(i + 1)} از ${faNum(pages.length)}`, W), 'PNG', MX, 297 - 12, 184, stripH);
    });
    pdf.setProperties({ title, subject, creator: 'LifeOS' });
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

// ── Projects comparison report (portfolio): KPIs, progress-vs-time chart, status mix and the full table ──
const CMP_W = 1000; // landscape A4 content width at the report's 695px-per-184mm scale
const STATE_FA = { bad: 'نیازمند پیگیری', warn: 'اندکی عقب', ok: 'مطابق برنامه', done: 'تکمیل‌شده', none: 'قرارداد ناقص' };
const STATE_CLR = { bad: '#f43f5e', warn: '#f59e0b', ok: '#3b82f6', done: '#10b981', none: '#cbd5e1' };
const STATE_TXT = { bad: '#be123c', warn: '#b45309', ok: '#1d4ed8', done: '#047857', none: '#64748b' };
// «خط تولید»: projects grouped by their items' next stage (same rule as the screen), in checklist order
const PIPE_ORDER = ['فرم ابعادبرداری برآوردی', 'ابعادبرداری برآوردی', 'تهیه جزئیات برآورد جهت تأیید به کارفرما', 'دریافت تأیید جزئیات برآورد از کارفرما', 'ارسال جزئیات برآورد به کارخانه', 'فرم ابعادبرداری دقیق', 'ابعادبرداری دقیق', 'تهیه نقشهٔ جزئیات ساخت', 'دریافت تأیید نقشهٔ جزئیات ساخت از کارفرما', 'ارسال جزئیات ساخت به کارخانه', 'تهیه لیست شیشه', 'سفارش شیشه', 'ارسال به پروژه', 'شروع نصب', 'پایان نصب'];
const PIPE_DEPT = { 'فرم ابعادبرداری برآوردی': 'کنترل پروژه', 'ابعادبرداری برآوردی': 'اجرا', 'تهیه جزئیات برآورد جهت تأیید به کارفرما': 'فنی', 'دریافت تأیید جزئیات برآورد از کارفرما': 'کنترل پروژه', 'ارسال جزئیات برآورد به کارخانه': 'فنی', 'فرم ابعادبرداری دقیق': 'کنترل پروژه', 'ابعادبرداری دقیق': 'اجرا', 'تهیه نقشهٔ جزئیات ساخت': 'فنی', 'دریافت تأیید نقشهٔ جزئیات ساخت از کارفرما': 'کنترل پروژه', 'ارسال جزئیات ساخت به کارخانه': 'فنی', 'تهیه لیست شیشه': 'فنی', 'سفارش شیشه': 'تأمین', 'ارسال به پروژه': 'تأمین', 'شروع نصب': 'اجرا', 'پایان نصب': 'اجرا' };
function pipelineOf(rows) {
  const map = new Map();
  for (const r of rows) for (const s of r.m.nextSteps || []) { if (!map.has(s.base)) map.set(s.base, new Map()); const pm = map.get(s.base); if (!pm.has(r.p.id)) pm.set(r.p.id, { p: r.p, items: [] }); if (s.item) pm.get(r.p.id).items.push(s.item); }
  return [...map].sort((a, b) => (PIPE_ORDER.indexOf(a[0]) + 1 || 99) - (PIPE_ORDER.indexOf(b[0]) + 1 || 99)).map(([base, pm]) => ({ base, department: PIPE_DEPT[base] || '', projects: [...pm.values()] }));
}
const NEXT_WATCH_PRINT = [['ارسال به پروژه', 'آمادهٔ ارسال به پروژه'], ['شروع نصب', 'آمادهٔ شروع نصب']];
export function compareReportHtml({ rows, brand = {} }) {
  const today = todayIso(), printedAt = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date());
  const title = `مقایسهٔ پروژه‌ها – ${jl(today)}`;
  const sum = f => rows.reduce((a, r) => a + (Number(f(r.m)) || 0), 0);
  const avg = rows.length ? Math.round(sum(m => m.progress) / rows.length) : 0;
  const amount = sum(m => m.amount), received = sum(m => m.received), outstanding = sum(m => m.outstanding), late = sum(m => m.late);
  const counts = ['bad', 'warn', 'ok', 'done', 'none'].map(k => [k, rows.filter(r => r.m.state === k).length]).filter(([, n]) => n);
  const logo = /^data:image\/(?:png|jpeg|webp);base64,/i.test(String(brand.logo || '')) ? brand.logo : '';
  // graphic cover page: one ring per project (its progress), title, totals and who prepared the report
  const coverHtml = (() => {
    const list = rows.slice(0, 14), cx = 160, cy = 160, gap = Math.min(11, 120 / Math.max(1, list.length)), sw = Math.max(3, gap - 3);
    const rings = list.map(({ p, m }, i) => { const r = 140 - i * gap, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, m.progress || 0)); const col = /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : '#6366f1';
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef2f7" stroke-width="${sw}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`; }).join('');
    const inner = Math.max(30, 140 - list.length * gap - 6);
    const svg = `<svg viewBox="0 0 320 320" aria-hidden="true">${rings}<circle cx="${cx}" cy="${cy}" r="${inner}" fill="#fff"/><text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="${Math.min(34, inner * .7)}" font-weight="900" fill="#0f172a">${pct(avg)}</text><text x="${cx}" y="${cy + Math.min(20, inner * .45)}" text-anchor="middle" font-size="${Math.min(11, inner * .28)}" fill="#64748b">میانگین پیشرفت</text></svg>`;
    const preparer = String(brand.preparer || '').trim();
    return `<section class="cover"><div class="grid"></div><div class="glow"></div><div class="txt">
<div class="brandc">${logo ? `<img src="${logo}" alt="">` : ''}${brand.headerText ? `<b>${esc(brand.headerText)}</b>` : ''}</div>
<div class="kick">گزارش پرتفوی پروژه‌ها</div><h1>مقایسهٔ پروژه‌ها</h1><div class="line"></div>
<div class="sub">${esc(jl(today))}</div>
<div class="stats"><div><b>${fa(rows.length)}</b><small>پروژه</small></div><div><b>${pct(avg)}</b><small>میانگین پیشرفت</small></div><div><b>${amount ? pct(Math.round(received / amount * 100)) : '—'}</b><small>وصول از قراردادها</small></div><div><b>${fa(late)}</b><small>مرحلهٔ عقب‌افتاده</small></div></div>
</div><div class="ringw">${svg}<div class="rleg">${list.map(({ p, m }) => `<span><i style="background:${/^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : '#6366f1'}"></i>${esc(p.name)} ${pct(m.progress)}</span>`).join('')}</div></div>
<div class="prep"><span>${preparer ? `تهیه‌کننده<b>${esc(preparer)}</b>` : ''}</span><span>تاریخ تهیه: ${esc(printedAt)}</span></div></section>`;
  })();
  const bar = (v, c) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v || 0))}%;background:${c}"></i></div>`;
  // progress (filled bar) against elapsed contract time (dark tick): a bar left of its tick is behind schedule
  const pc = p => /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : '#6366f1';
  const chart = rows.map(({ p, m }) => `<div class="cr"><b><span class="dot" style="background:${pc(p)}"></span>${esc(p.name)}</b><div class="track" style="background:${pc(p)}1f"><i style="width:${Math.max(m.progress, m.progress ? 2 : 0)}%;background:${pc(p)}"></i>${m.timePct != null ? `<u style="right:${Math.min(100, m.timePct)}%"></u>` : ''}</div><span class="vals"><b class="num">${pct(m.progress)}</b>${m.timePct != null ? `<small>زمان ${pct(m.timePct)}</small>` : '<small>بدون تاریخ</small>'}</span></div>`).join('');
  const mix = counts.map(([k, n]) => `<span style="flex:${n};background:${STATE_CLR[k]}"></span>`).join('');
  const varTxt = v => v == null ? '—' : v === 0 ? 'منطبق' : `${pct(Math.abs(v))} ${v < 0 ? 'عقب' : 'جلو'}`;
  const tr = rows.map(({ p, m }, i) => `<tr><td class="n">${fa(i + 1)}</td><td><span class="dot" style="background:${pc(p)}"></span><b>${esc(p.name)}</b>${p.client ? `<div class="muted">${esc(p.client)}</div>` : ''}</td><td><div class="pg"><b class="num">${pct(m.progress)}</b>${bar(m.progress, pc(p))}</div><span class="sm">${fa(m.done)} از ${fa(m.total)} مرحله</span></td><td class="n">${m.timePct == null ? '—' : pct(m.timePct)}</td><td class="n ${m.variance < 0 ? 'neg' : m.variance > 0 ? 'pos' : ''}">${varTxt(m.variance)}</td><td class="n">${m.end ? jShort(m.end) : '—'}${m.daysLeft != null ? `<div class="muted">${m.daysLeft >= 0 ? `${fa(m.daysLeft)} روز مانده` : `${fa(-m.daysLeft)} روز گذشته`}</div>` : ''}</td><td class="n">${m.amount ? money(m.amount) : '—'}</td><td class="n">${m.amount ? money(m.received) : '—'}${m.receivedPct != null ? `<div class="muted">${pct(m.receivedPct)}</div>` : ''}</td><td class="n ${m.outstanding ? 'neg' : ''}">${m.outstanding ? money(m.outstanding) : '—'}</td><td class="n ${m.late ? 'neg' : ''}">${m.late ? fa(m.late) : '—'}</td><td><span class="st" style="color:${STATE_TXT[m.state]};background:${STATE_CLR[m.state]}22;border-color:${STATE_CLR[m.state]}">${STATE_FA[m.state] || '—'}</span></td></tr>`).join('');
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS(brand, title)}
@page{size:A4 landscape;margin:12mm 12mm 14mm}
html.capture body{width:${CMP_W}px}
.cmp-top{display:grid;grid-template-columns:2.2fr 1fr;gap:16px;align-items:start;break-inside:avoid}
.cmp-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:10px}.cmp-kpis .kpi b{font-size:12.5pt}
.mix{display:flex;gap:2px;height:9px;border-radius:5px;overflow:hidden;margin:4px 0 6px}.legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:7.5pt;color:#475569}.legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-inline-end:4px;vertical-align:middle}
.cr{display:grid;grid-template-columns:170px 1fr 80px;align-items:center;gap:10px;padding:4px 0;break-inside:avoid}.cr>b{font-size:8.5pt;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cr .vals{display:flex;flex-direction:column;align-items:flex-end;line-height:1.3}.cr .vals b{font-size:9pt;font-weight:800;color:#0f172a}.cr .vals small{font-size:6.8pt;color:#64748b}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-inline-end:5px;vertical-align:middle}
.track{position:relative;height:9px;background:#eef2f7;border-radius:5px}.track i{position:absolute;inset-block:0;right:0;border-radius:5px}.track u{position:absolute;top:-4px;bottom:-4px;width:2px;border-radius:1px;background:#334155;transform:translateX(50%)}
table.cmp{font-size:7.8pt;font-feature-settings:'tnum'}table.cmp td,table.cmp th{padding:5px 4px;vertical-align:middle}table.cmp .pg{display:flex;align-items:center;gap:6px}table.cmp .pg b{font-size:8.5pt;font-weight:800;min-width:26px}table.cmp .pg .bar{flex:1;height:5px;margin:0}.sm{font-size:6.8pt;color:#64748b}table.cmp .dot{margin-inline-end:4px}.num{font-weight:700}
.nx{display:grid;grid-template-columns:1fr 1fr;gap:16px;break-inside:avoid}.nx ul{margin:4px 0 0;padding:0;list-style:none;font-size:8.5pt}.nx li{padding:3px 0;border-bottom:1px dashed #e2e8f0}
.neg{color:#be123c}.pos{color:#047857}.st{display:inline-block;padding:0 6px;border:1px solid;border-radius:99px;font-size:7pt;font-weight:700;white-space:nowrap}
.cover{position:relative;height:178mm;overflow:hidden;border:1px solid #e2e8f0;border-radius:6mm;background:#fff;color:#0f172a;break-after:page;page-break-after:always;display:grid;grid-template-columns:1.15fr 1fr;align-items:center;padding:0 14mm}
.cover .glow{position:absolute;top:0;right:0;width:5mm;height:100%;background:#d4a843}
.cover .grid{position:absolute;inset:0;background-image:none;background-size:9mm 9mm}
.cover .txt{position:relative;z-index:1}
.cover .brandc{display:flex;align-items:center;gap:10px;margin-bottom:16mm}.cover .brandc img{max-height:16mm;max-width:46mm;object-fit:contain}.cover .brandc b{font-size:12pt;font-weight:800;color:#334155}
.cover .kick{font-size:10pt;letter-spacing:.5px;color:#a16207;font-weight:700}
.cover h1{font-size:34pt;font-weight:900;line-height:1.25;margin:3mm 0 4mm}
.cover .line{width:34mm;height:1.6mm;border-radius:1mm;background:linear-gradient(90deg,#d4a843,#f5d98a);margin-bottom:6mm}
.cover .sub{font-size:11pt;color:#475569}
.cover .stats{display:flex;gap:6mm;margin-top:10mm}.cover .stats div{display:flex;flex-direction:column;border-inline-start:2px solid #d4a843;padding-inline-start:3mm}.cover .stats b{font-size:17pt;font-weight:900}.cover .stats small{font-size:8pt;color:#64748b}
.cover .prep{position:absolute;bottom:10mm;right:14mm;left:14mm;display:flex;justify-content:space-between;align-items:flex-end;font-size:9pt;color:#64748b;z-index:1;border-top:1px solid #e2e8f0;padding-top:3mm}.cover .prep b{display:block;font-size:12.5pt;color:#0f172a;font-weight:800}
.cover .ringw{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:3mm}.cover svg{width:100%;max-height:120mm}.cover .rleg{display:flex;flex-wrap:wrap;justify-content:center;gap:1.5mm 4mm;font-size:7.5pt;color:#475569;max-width:120mm}.cover .rleg i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-inline-end:4px;vertical-align:middle}
</style></head><body>
${coverHtml}
<header class="top"><div><div class="kicker">گزارش پرتفوی پروژه‌ها</div><h1>مقایسهٔ پروژه‌ها</h1><div class="meta">تاریخ تهیه: ${esc(printedAt)}  |  ${fa(rows.length)} پروژه</div></div>
<div class="brand">${logo ? `<img src="${logo}" alt="">` : ''}${brand.headerText ? `<b>${esc(brand.headerText)}</b>` : ''}</div></header>
<div class="cmp-kpis">
<div class="kpi"><small>میانگین پیشرفت</small><b class="num">${pct(avg)}</b>${bar(avg, '#0f172a')}</div>
<div class="kpi"><small>جمع مبلغ قراردادها</small><b class="num">${money(amount)}</b></div>
<div class="kpi"><small>جمع وصولی</small><b class="num">${money(received)}</b>${bar(amount ? received / amount * 100 : 0, '#059669')}<span>${amount ? pct(Math.round(received / amount * 100)) : '—'} از قراردادها</span></div>
<div class="kpi ${outstanding ? 'bad' : ''}"><small>جمع مطالبات معوق</small><b class="num">${money(outstanding)}</b></div>
<div class="kpi ${late ? 'bad' : ''}"><small>مراحل عقب‌افتاده</small><b class="num">${fa(late)}</b><span>در همهٔ پروژه‌ها</span></div>
</div>
<div class="cmp-top"><div>
<h2>پیشرفت در برابر زمان</h2><p class="muted" style="font-size:7.5pt;margin-bottom:4px">نوار رنگی = پیشرفت اجرایی · خط عمودی = زمان سپری‌شدهٔ قرارداد؛ اگر نوار به خط نرسیده، پروژه عقب است.</p>${chart || '<p class="empty">پروژه‌ای نیست.</p>'}</div>
<div><h2>وضعیت پروژه‌ها</h2><div class="mix">${mix}</div><div class="legend" style="flex-direction:column">${counts.map(([k, n]) => `<span><i style="background:${STATE_CLR[k]}"></i>${STATE_FA[k]}: ${fa(n)} پروژه</span>`).join('')}</div></div></div>
<h2>جدول مقایسه</h2><table class="cmp"><thead><tr><th style="width:3%">#</th><th style="width:15%">پروژه</th><th style="width:13%">پیشرفت</th><th>زمان</th><th>انحراف</th><th>پایان قرارداد</th><th>مبلغ قرارداد</th><th>وصولی</th><th>معوق</th><th>عقب</th><th>وضعیت</th></tr></thead><tbody>${tr}</tbody>
<tfoot><tr><td colspan="2">جمع ${fa(rows.length)} پروژه</td><td>${pct(avg)} میانگین</td><td></td><td></td><td></td><td class="n">${money(amount)}</td><td class="n">${money(received)}</td><td class="n">${money(outstanding)}</td><td class="n">${fa(late)}</td><td></td></tr></tfoot></table>
<div class="nx">${NEXT_WATCH_PRINT.map(([base, label]) => { const list = rows.map(r => { const hit = (r.m.nextSteps || []).filter(x => x.base === base); return { p: r.p, hit: hit.length, items: hit.map(x => x.item).filter(Boolean) }; }).filter(r => r.hit);
  return `<div><h2>${esc(label)} <span class="sm">(${fa(list.length)} پروژه · اقدام بعدی «${esc(base)}»)</span></h2>${list.length ? `<ul>${list.map(({ p, items }) => `<li><span class="dot" style="background:${pc(p)}"></span><b>${esc(p.name)}</b>${items.length ? ` <span class="sm">— ${items.map(esc).join('، ')}</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted">پروژه‌ای در این مرحله نیست.</p>'}</div>`; }).join('')}</div>
${(() => { const pipe = pipelineOf(rows); if (!pipe.length) return ''; const max = Math.max(1, ...pipe.map(x => x.projects.length));
  return `<h2>خط تولید · اقدام بعدی پروژه‌ها</h2><table class="cmp"><thead><tr><th style="width:9%">واحد</th><th style="width:22%">مرحلهٔ بعدی</th><th style="width:6%">تعداد</th><th style="width:14%"></th><th>پروژه‌ها (آیتم‌ها)</th></tr></thead><tbody>${pipe.map(x => `<tr><td class="sm">${esc(x.department)}</td><td><b>${esc(x.base)}</b></td><td class="n"><b>${fa(x.projects.length)}</b></td><td>${bar(x.projects.length / max * 100, '#0f172a')}</td><td>${x.projects.map(({ p, items }) => `<span class="dot" style="background:${pc(p)}"></span>${esc(p.name)}${items.length ? ` <span class="sm">(${items.map(esc).join('، ')})</span>` : ''}`).join(' &nbsp;·&nbsp; ')}</td></tr>`).join('')}</tbody></table>`; })()}
</body></html>`;
}
const compareFileName = () => { const j = isoToJ(todayIso()); return `${j.jy}-${pad2(j.jm)}-${pad2(j.jd)}_مقایسه-پروژه‌ها.pdf`; };

// Print dialog (Save as PDF): the browser's own text engine shapes Persian correctly, unlike the canvas path
export async function printCompareReport(data) {
  const title = compareFileName().replace(/\.pdf$/, '');
  const frame = mountFrame('lf-compare-print-frame', CMP_W, compareReportHtml(data), false);
  const doc = frame.contentDocument;
  doc.title = title;
  doc.documentElement.classList.add('capture');
  await (doc.fonts?.ready || Promise.resolve());
  const prevTitle = document.title;
  document.title = title;
  try { frame.contentWindow.focus(); frame.contentWindow.print(); } finally { document.title = prevTitle; }
}
