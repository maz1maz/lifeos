import{_ as F,j as u,s as k,n,i as z,S as U,f as p}from"./studio-DyeR-aK4.js";const r=t=>String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]),l=t=>p(Math.round(Number(t)||0),0),$=t=>p(Number(t)||0,2),g=t=>u(t)||"—",w=t=>/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(t||""))?t:"",N=()=>typeof window<"u"&&window.__lifeosApi?new URL("studio-assets/",location.href).href:"/assets/fonts/",M=["","یک","دو","سه","چهار","پنج","شش","هفت","هشت","نه"],I=["ده","یازده","دوازده","سیزده","چهارده","پانزده","شانزده","هفده","هجده","نوزده"],L=["","","بیست","سی","چهل","پنجاه","شصت","هفتاد","هشتاد","نود"],R=["","یکصد","دویست","سیصد","چهارصد","پانصد","ششصد","هفتصد","هشتصد","نهصد"],y=["","هزار","میلیون","میلیارد","هزار میلیارد","میلیون میلیارد"];function V(t){const e=Math.floor(t/100),a=t%100,o=[];return e&&o.push(R[e]),a>=10&&a<20?o.push(I[a-10]):(Math.floor(a/10)&&o.push(L[Math.floor(a/10)]),a%10&&o.push(M[a%10])),o.join(" و ")}function A(t){let e=Math.round(Math.abs(Number(t)||0));if(!e)return"صفر";const a=[];let o=0;for(;e>0&&o<y.length;){const i=e%1e3;i&&a.unshift(V(i)+(y[o]?" "+y[o]:"")),e=Math.floor(e/1e3),o++}return(Number(t)<0?"منفی ":"")+a.join(" و ")}const B=()=>`
@font-face{font-family:'Vazirmatn';font-weight:100 900;font-display:block;src:url('${N()}vazirmatn-arabic.woff2') format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC}
@font-face{font-family:'Vazirmatn';font-weight:100 900;font-display:block;src:url('${N()}vazirmatn-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2212}
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
`;function j(t,e,a){const o=w(a);return`<div class="party"><div class="logo">${o?`<img src="${o}" alt="">`:`<i>${r((e||t).trim().charAt(0)||"؟")}</i>`}</div><small>${r(t)}</small><b>${r(e||"—")}</b></div>`}function _(t){const e=t.summary,a=t.contractAmount?Math.round(e.gross/t.contractAmount*100):0,o=Math.max(0,Math.min(100,a)),i=t.scope&&t.scope!=="all"?` — ${U.find(m=>m[0]===t.scope)?.[1]||""}`:"";return`<section class="cover">
  <div class="hero"><div class="parties">${j("کارفرما",t.employerName,t.employerLogo)}${j("پیمانکار",t.contractorName,t.contractorLogo)}</div>
    <div class="titles"><span class="kicker">صورت وضعیت${r(i)}</span><h1>${r(t.title)}</h1><h2>${r(t.projectName||"")}</h2></div><div class="stripe"></div></div>
  <div class="kpis"><div class="kpi"><small>کارکرد ناخالص تجمعی</small><b class="n">${l(e.gross)}</b><span>ریال · این دوره: ${l(e.current)}</span></div>
    <div class="kpi main"><small>خالص قابل پرداخت</small><b class="n">${l(e.payableWithVat)}</b><span>ریال${n(e.rates.vat)?" · با مالیات بر ارزش افزوده":""}</span></div>
    <div class="kpi"><small>پیشرفت مالی نسبت به قرارداد</small><b class="n">${p(a)}٪</b><div class="bar"><i style="width:${o}%"></i></div></div></div>
  <div class="info"><div class="wide"><small>موضوع قرارداد</small><b>${r(t.subject||"—")}</b></div>
    <div><small>شماره قرارداد</small><b class="n"><span class="ltr">${r(t.contractNo||"—")}</span></b></div><div><small>تاریخ قرارداد</small><b>${g(t.contractDate)}</b></div>
    <div><small>مبلغ قرارداد</small><b class="n">${l(t.contractAmount)} ریال</b></div><div><small>دورهٔ کارکرد</small><b>${t.from||t.to?`${g(t.from)} تا ${g(t.to)}`:"—"}</b></div>
    <div><small>تاریخ تهیهٔ صورت وضعیت</small><b>${g(t.prep)}</b></div><div><small>شمارهٔ صورت وضعیت</small><b>${t.isFinal?"قطعی":p(t.n)}</b></div></div>
  <div class="signs"><div><b>نمایندهٔ کارفرما</b>نام، مهر و امضا</div><div><b>نمایندهٔ پیمانکار</b>نام، مهر و امضا</div></div>
  <div class="foot"><span>${r(t.contractorName||"")}</span><span>${r(t.title)} · ${r(t.projectName||"")}</span></div>
</section>`}function x(t,e,a){const o=w(t.employerLogo),i=w(t.contractorLogo);return`<div class="head"><div class="lg">${o?`<img src="${o}" alt="">`:""}</div><div class="t"><b>${r(e)}</b><span>${r(t.projectName||"")} · ${r(t.title)}</span></div><div class="lg">${i?`<img src="${i}" alt="">`:""}</div></div>
  <div class="meta"${a?' style="grid-template-columns:repeat(4,1fr)"':""}><div><span>کارفرما: </span>${r(t.employerName||"—")}</div><div><span>پیمانکار: </span>${r(t.contractorName||"—")}</div><div><span>شماره قرارداد: </span><b class="n"><span class="ltr">${r(t.contractNo||"—")}</span></b></div><div><span>دورهٔ کارکرد: </span>${t.from||t.to?`${g(t.from)} تا ${g(t.to)}`:"—"}</div>${a?`<div><span>تاریخ تهیه: </span>${g(t.prep)}</div><div><span>مبلغ قرارداد: </span><b class="n">${l(t.contractAmount)}</b></div>`:`<div><span>تاریخ تهیه: </span>${g(t.prep)}</div><div><span>مبلغ قرارداد: </span><b class="n">${l(t.contractAmount)}</b></div>`}</div>`}function D(t){const e=t.summary,a=(o,i,m="")=>`<tr class="${m}"><td>${r(o)}</td><td class="n">${l(i)}</td></tr>`;return`<section class="sheet">${x(t,"خلاصهٔ مالی صورت وضعیت")}
  <table class="sum"><tbody>
    <tr class="g"><td colspan="2">کارکرد</td></tr>
    ${a("کارکرد ناخالص تجمعی تا کنون",e.gross)}${a("کارکرد ناخالص تا صورت وضعیت قبلی",e.prevGross)}${a("کارکرد ناخالص این دوره",e.current)}
    ${e.addInsurance?a(`سپرده بیمه (${p(e.rates.insurance,2)}٪ مبنای ${l(e.insuranceBase)})`,e.insuranceAdded):""}
    <tr class="g"><td colspan="2">کسورات</td></tr>
    ${a(`تخفیف (${p(e.rates.discount,3)}٪ اقلام قرارداد)`,e.discount)}${a(`سپرده حسن انجام کار (${p(e.retentionRate)}٪)`,e.retention)}${e.addInsurance?"":a(`سپرده بیمه (${p(e.rates.insurance,2)}٪)`,e.insuranceDeducted)}${a(`استهلاک پیش‌پرداخت (${p(e.rates.advance)}٪)`,e.advance)}${a("مجموع پرداخت صورت وضعیت‌های قبلی",e.paidBefore)}
    ${a("جمع کسورات",e.deductions,"s")}
    ${a("مبلغ خالص قابل پرداخت (بدون مالیات بر ارزش افزوده)",e.payable,"s")}
    ${n(e.rates.vat)?a(`مالیات بر ارزش افزوده (${p(e.rates.vat)}٪)`,e.vat):""}
    ${a(n(e.rates.vat)?"مبلغ خالص قابل پرداخت (با مالیات بر ارزش افزوده)":"مبلغ خالص قابل پرداخت",e.payableWithVat,"f")}
  </tbody></table>
  <div class="words"><small>مبلغ خالص قابل پرداخت به حروف</small>${r(A(e.payableWithVat))} ریال</div>
  <div class="sg"><div>نمایندهٔ کارفرما — مهر و امضا</div><div>نمایندهٔ پیمانکار — مهر و امضا</div></div></section>`}function W(t){const e=k(t.boq,t.scope);let a=0,o=0;const i=e.map(d=>{const b=t.now[d.id]||0,f=t.before[d.id]||0,s=n(d.price),c=!d.extra&&n(d.qty)>0&&b>n(d.qty)+1e-9;return a+=b*s,o+=f*s,`<tr class="${d.extra?"extra":""} ${c?"over":""}"><td>${r(t.labels[d.id])}</td><td class="d">${r(d.desc)}</td><td class="n">${$(d.qty)}</td><td class="n">${$(b-f)}</td><td class="n">${$(f)}</td><td class="n"><b>${$(b)}</b></td><td>${r(d.unit)}</td><td class="n">${l(s)}</td><td class="n"><b>${l(b*s)}</b></td></tr>`}).join(""),m=t.summary,h=t.scope==="install"?`<tr class="tot"><td class="l" colspan="8">سپرده بیمه (${p(m.rates.insurance,2)}٪ مبنای ${l(m.insuranceBase)})</td><td class="n">${l(m.insurance)}</td></tr>`:"";return`<section class="sheet wide">${x(t,t.scope==="install"?"صورت کارکرد نصب":t.scope==="supply"?"صورت کارکرد فروش":"صورت کارکرد",!0)}
  <table><thead><tr><th>ردیف</th><th>شرح آیتم قرارداد</th><th>مقدار قرارداد</th><th>مقدار این صورت وضعیت</th><th>تا صورت وضعیت قبلی</th><th>کل تا کنون</th><th>واحد</th><th>فی (ریال)</th><th>مبلغ تجمعی (ریال)</th></tr></thead>
  <tbody>${i}<tr class="tot"><td class="l" colspan="8">جمع کل صورت کارکرد ناخالص تجمعی تا کنون</td><td class="n">${l(a)}</td></tr><tr class="tot"><td class="l" colspan="8">جمع کل صورت کارکرد ناخالص تا صورت وضعیت قبلی</td><td class="n">${l(o)}</td></tr><tr class="tot"><td class="l" colspan="8">جمع کل صورت کارکرد ناخالص فعلی</td><td class="n">${l(a-o)}</td></tr>${h}</tbody></table>
  <div class="sg"><div>نمایندهٔ کارفرما — مهر و امضا</div><div>نمایندهٔ پیمانکار — مهر و امضا</div></div></section>`}const S=t=>{const e=new Set(k(t.boq,t.scope).map(o=>o.id)),a=Object.fromEntries(t.boq.map(o=>[o.id,o]));return t.measures.filter(o=>(Number(o.statementNo)||0)<=t.n&&e.has(o.itemId)).sort((o,i)=>(Number(o.statementNo)||0)-(Number(i.statementNo)||0)||String(o.date||"").localeCompare(String(i.date||""))).map(o=>({m:o,it:a[o.itemId]}))};function C(t){const e=S(t);let a=0;const o=e.map(({m:i,it:m})=>{const h=n(i.qty)*n(m?.price);a+=h;const d=t.from&&t.to&&i.date&&(i.date<t.from||i.date>t.to)&&Number(i.statementNo)===t.n;return`<tr class="${m?.extra?"extra":""} ${d?"over":""}"><td>${r(t.labels[i.itemId]||"")}</td><td>${p(i.statementNo)}</td><td>${g(i.date)}</td><td class="d">${r(m?.desc||"")}</td><td class="n">${$(i.qty)}</td><td>${r(m?.unit||"")}</td><td class="n">${l(m?.price)}</td><td class="n">${l(h)}</td><td class="d">${r(i.note||"")}</td></tr>`}).join("");return`<section class="sheet wide">${x(t,"ریزمترهٔ "+t.title,!0)}
  <table><thead><tr><th>آیتم قرارداد</th><th>شمارهٔ صورت وضعیت</th><th>تاریخ انجام</th><th>شرح آیتم قرارداد</th><th>مقدار انجام‌شده</th><th>واحد</th><th>فی (ریال)</th><th>مبلغ (ریال)</th><th>توضیحات</th></tr></thead>
  <tbody>${o||'<tr><td colspan="9">ردیفی ثبت نشده.</td></tr>'}<tr class="tot"><td class="l" colspan="7">جمع ریزمتره تا این صورت وضعیت</td><td class="n">${l(a)}</td><td></td></tr></tbody></table></section>`}function T(t,{only:e}={}){const a=e==="cover"?_(t):_(t)+D(t)+W(t)+C(t);return`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${r(t.title)}</title><style>${B()}${e==="cover"?"html,body{width:210mm}":""}</style></head><body>${a}</body></html>`}const q=t=>`${t.title} - ${t.projectName||"پروژه"}`.replace(/[\\/:*?"<>|]+/g," ").trim();async function P(t){document.getElementById("lf-sv-print-frame")?.remove();const e=document.createElement("iframe");e.id="lf-sv-print-frame",e.setAttribute("aria-hidden","true"),e.style.cssText="position:fixed;width:794px;height:10px;border:0;left:-10000px;top:0",document.body.appendChild(e);const a=e.contentDocument;a.open(),a.write(T(t)),a.close(),await(a.fonts?.ready||Promise.resolve()),await Promise.all([...a.images].map(i=>i.complete?null:new Promise(m=>{i.onload=i.onerror=m})));const o=document.title;document.title=q(t);try{e.contentWindow.focus(),e.contentWindow.print()}finally{document.title=o}}async function O(t){const e=await F(()=>import("./xlsx-QOIw0qXl.js"),[],import.meta.url),a=t.summary,o=e.utils.book_new(),i=(s,c)=>{const v=e.utils.aoa_to_sheet(s);return v["!cols"]=c.map(E=>({wch:E})),v},m=s=>z(s)==="install"?"نصب / خدمات":z(s)==="other"?"سایر":"فروش / تأمین";e.utils.book_append_sheet(o,i([[t.title],[],["نام پروژه",t.projectName],["موضوع قرارداد",t.subject],["کارفرما",t.employerName],["پیمانکار",t.contractorName],["شماره قرارداد",t.contractNo],["تاریخ قرارداد",u(t.contractDate)],["مبلغ قرارداد (ریال)",t.contractAmount],["دورهٔ کارکرد",t.from||t.to?`${u(t.from)} تا ${u(t.to)}`:""],["تاریخ تهیه",u(t.prep)],[],["کارکرد","مبلغ (ریال)"],["کارکرد ناخالص تجمعی تا کنون",a.gross],["کارکرد ناخالص تا صورت وضعیت قبلی",a.prevGross],["کارکرد ناخالص این دوره",a.current],...a.addInsurance?[[`سپرده بیمه (${a.rates.insurance}٪)`,a.insuranceAdded]]:[],[],["کسورات",""],[`تخفیف (${a.rates.discount}٪)`,a.discount],[`سپرده حسن انجام کار (${a.retentionRate}٪)`,a.retention],...a.addInsurance?[]:[[`سپرده بیمه (${a.rates.insurance}٪)`,a.insuranceDeducted]],[`استهلاک پیش‌پرداخت (${a.rates.advance}٪)`,a.advance],["مجموع پرداخت صورت وضعیت‌های قبلی",a.paidBefore],["جمع کسورات",a.deductions],[],["مبلغ خالص قابل پرداخت (بدون مالیات)",a.payable],[`مالیات بر ارزش افزوده (${a.rates.vat}٪)`,a.vat],["مبلغ خالص قابل پرداخت",a.payableWithVat],["به حروف",A(a.payableWithVat)+" ریال"]],[42,60]),"صورت وضعیت");const h=k(t.boq,t.scope);e.utils.book_append_sheet(o,i([["ردیف","شرح آیتم قرارداد","مقدار قرارداد","مقدار این صورت وضعیت","تا صورت وضعیت قبلی","کل تا کنون","واحد","فی (ریال)","مبلغ تجمعی (ریال)"],...h.map(s=>{const c=t.now[s.id]||0,v=t.before[s.id]||0;return[t.labels[s.id],s.desc,n(s.qty),c-v,v,c,s.unit,n(s.price),Math.round(c*n(s.price))]}),[],["جمع کل تجمعی","","","","","","","",h.reduce((s,c)=>s+Math.round((t.now[c.id]||0)*n(c.price)),0)]],[16,48,12,14,14,12,10,16,20]),"صورت کارکرد"),e.utils.book_append_sheet(o,i([["آیتم قرارداد","شمارهٔ صورت وضعیت","تاریخ انجام","شرح آیتم قرارداد","مقدار انجام‌شده","واحد","فی (ریال)","مبلغ (ریال)","توضیحات"],...S(t).map(({m:s,it:c})=>[t.labels[s.itemId],Number(s.statementNo)||"",u(s.date),c?.desc||"",n(s.qty),c?.unit||"",n(c?.price),Math.round(n(s.qty)*n(c?.price)),s.note||""])],[16,12,16,48,12,10,16,18,40]),"ریزمتره"),e.utils.book_append_sheet(o,i([["ردیف","شرح","نوع","مقدار","واحد","فی (ریال)","مبلغ (ریال)"],...t.boq.map(s=>[t.labels[s.id],s.desc,(s.extra?"مازاد — ":"")+m(s),n(s.qty),s.unit,n(s.price),Math.round(n(s.qty)*n(s.price))])],[16,48,22,12,10,16,20]),"آیتم‌های قرارداد"),o.Workbook={Views:[{RTL:!0}]};const d=new Blob([e.write(o,{type:"array",bookType:"xlsx"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),b=URL.createObjectURL(d),f=document.createElement("a");f.href=b,f.download=q(t)+".xlsx",document.body.appendChild(f),f.click(),f.remove(),setTimeout(()=>URL.revokeObjectURL(b),4e3)}export{O as exportStatementExcel,P as printStatement,q as statementFileName,T as statementHtml,A as toPersianWords};
