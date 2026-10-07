// Contract statement workbook (صورت وضعیت): the user fills the contract items and the measurement sheet (ریزمتره);
// the work sheet (صورت کارکرد) and the statement summary (صورت وضعیت) are computed from them, and the cover page +
// all sheets print (statementPrint.js) or export to Excel.
// Everything lives on the project's contract record: boq (items; extra=true → «مازاد»), measures (ریزمتره rows),
// svRates (deduction percents + insuranceMode), svPeriods ({[n]: {from, to, prep}}), svFinal (the final statement's
// number) and svBrand (names + logos of the employer and contractor for the cover).
// Amounts are cumulative per statement N: gross(N) = Σ measures up to N; each deduction is a % of gross(N);
// payable(N) = gross(N) (+ insurance when it is paid on top) − deductions(N) − payable of the statements before N.
import { useEffect, useRef, useState } from 'react';
import { JalaliDateInput } from './jdate';
import { fa, jl, num, todayIso } from './life-core';

export const BOQ_UNITS = ['مترمربع', 'مترطول', 'مترمکعب', 'عدد', 'کیلوگرم', 'تن', 'دستگاه', 'سرویس', 'کنترات'];
export const boqAmount = row => Math.round(num(row?.qty) * num(row?.price));
export const boqTotal = rows => (rows || []).reduce((a, r) => a + boqAmount(r), 0);
export const SV_RATES = [['discount', 'تخفیف', 0], ['retention', 'حسن انجام کار', 10], ['retentionFinal', 'حسن انجام کار در قطعی', 5], ['insurance', 'سپرده بیمه', 16.67], ['advance', 'استهلاک پیش‌پرداخت', 70], ['vat', 'مالیات بر ارزش افزوده', 10]];
// item kind: supply (فروش/تأمین مصالح — no insurance), install (نصب/خدمات — the insurance base), other (no insurance)
export const ITEM_KINDS = [['supply', 'فروش / تأمین'], ['install', 'نصب (مشمول بیمه)'], ['other', 'سایر']];
export const itemKind = it => it?.kind || (/نصب|اجرا|خدمات|برچیدن|بند\s*باز|فلاشینگ/.test(it?.desc || '') ? 'install' : 'supply');
const rid = p => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const rial = n => fa(Math.round(n || 0), 0);
const qtyFa = n => fa(n || 0, 2);
const grouped = v => v === '' || v == null ? '' : num(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const decimalOnly = v => v.replace(/[^0-9۰-۹.٫]/g, '').replace('٫', '.');

// row labels as in the paper forms: contract items 1…k, extras «مازاد (1)»…
export function itemLabels(boq) { let c = 0, e = 0; return Object.fromEntries((boq || []).map(b => [b.id, b.extra ? `مازاد (${fa(++e)})` : fa(++c)])); }
export const hasWorkbook = contract => !!(contract?.boq || []).length && !!(contract?.measures || []).length;
// cumulative quantity of each item up to (and including) statement n
export function cumulativeQty(measures, n) {
  const out = {};
  for (const m of measures || []) if ((Number(m.statementNo) || 0) <= n && m.itemId) out[m.itemId] = (out[m.itemId] || 0) + num(m.qty);
  return out;
}
export function grossUpTo(boq, measures, n) {
  const q = cumulativeQty(measures, n);
  return Math.round((boq || []).reduce((a, it) => a + (q[it.id] || 0) * num(it.price), 0));
}
export const svRatesOf = contract => ({ ...Object.fromEntries(SV_RATES.map(([k, , d]) => [k, d])), insuranceMode: 'add', ...(contract?.svRates || {}) });
// Same rules as the contractor's Excel forms:
// · discount = discount% of the contract (non-extra) items, at most discount% of the contract total;
// · insurance (تأمین اجتماعی, 16.67%) on the install/service items only — contract ones after the discount, extras in full —
//   paid on top of the work (or, if the contract says so, deducted);
// · retention 10% (the final statement keeps only 5%: half is released at provisional delivery);
// · advance amortization 70% of the work, never above the advance paid;
// · «paid before» = the employer's recorded deposits for earlier statements when there are any, else their computed payables.
export function statementSummary(contract, n, payments) {
  const boq = contract?.boq || [], measures = contract?.measures || [], rates = svRatesOf(contract), addInsurance = rates.insuranceMode !== 'deduct';
  const advanceCap = num(contract?.advancePayment), base = boqTotal(boq.filter(b => !b.extra)), d = num(rates.discount) / 100;
  const recorded = (payments || []).filter(x => num(x.paidAmount) > 0);
  let computedBefore = 0, last = null;
  for (let k = 1; k <= Math.max(1, n); k++) {
    const q = cumulativeQty(measures, k), amt = it => (q[it.id] || 0) * num(it.price), sum = f => Math.round(boq.filter(f).reduce((a, it) => a + amt(it), 0));
    const gross = sum(() => true), prevGross = k > 1 ? grossUpTo(boq, measures, k - 1) : 0, contractGross = sum(it => !it.extra);
    const discount = Math.round(Math.min(contractGross, base || contractGross) * d);
    const insuranceBase = Math.round(sum(it => !it.extra && itemKind(it) === 'install') * (1 - d) + sum(it => it.extra && itemKind(it) === 'install'));
    const insurance = Math.round(insuranceBase * num(rates.insurance) / 100);
    const isFinal = Number(contract?.svFinal) === k, retentionRate = isFinal ? num(rates.retentionFinal) : num(rates.retention);
    const retention = Math.round(gross * retentionRate / 100);
    let advance = Math.round(gross * num(rates.advance) / 100); if (advanceCap > 0) advance = Math.min(advance, advanceCap);
    const paidRows = recorded.filter(x => (Number(x.statementNo) || 0) < k), paidBefore = paidRows.length ? paidRows.reduce((a, x) => a + num(x.paidAmount), 0) : computedBefore;
    const insuranceAdded = addInsurance ? insurance : 0, insuranceDeducted = addInsurance ? 0 : insurance;
    const deductions = discount + retention + insuranceDeducted + advance + paidBefore;
    const payable = gross + insuranceAdded - deductions, vat = Math.round(Math.max(0, payable) * num(rates.vat) / 100);
    last = { n: k, gross, prevGross, current: gross - prevGross, contractGross, discount, insuranceBase, insurance, insuranceAdded, insuranceDeducted, retention, retentionRate, advance, paidBefore, paidFromRecords: paidRows.length > 0, deductions, payable, vat, payableWithVat: payable + vat, rates, addInsurance, isFinal };
    computedBefore += payable;
  }
  return last;
}
export const SCOPES = [['all', 'همهٔ اقلام'], ['install', 'فقط نصب / خدمات (برای بیمه)'], ['supply', 'فقط فروش / تأمین']];
export const scopeItems = (boq, scope) => (boq || []).filter(it => scope === 'install' ? itemKind(it) === 'install' : scope === 'supply' ? itemKind(it) !== 'install' : true);
export const statementNumbers = contract => { const max = Math.max(0, ...(contract?.measures || []).map(m => Number(m.statementNo) || 0)); return Array.from({ length: Math.max(1, max) }, (_, i) => i + 1); };
export const contractTotals = boq => { const base = boqTotal((boq || []).filter(b => !b.extra)), extra = boqTotal((boq || []).filter(b => b.extra)); return { base, extra, all: base + extra, extraPct: base ? extra / base * 100 : 0 }; };
export const statementTitle = (contract, n) => Number(contract?.svFinal) === n ? 'صورت وضعیت قطعی' : `صورت وضعیت موقت شماره ${fa(n)}`;
// everything a printout / export needs, with the cover fields resolved from the brand settings → project → contract
export function statementDoc(contract, project, n, payments, scope = 'all') {
  const b = contract?.svBrand || {}, period = contract?.svPeriods?.[n] || {};
  return {
    n, title: statementTitle(contract, n), isFinal: Number(contract?.svFinal) === n,
    projectName: b.projectName || project?.name || '', subject: b.subject || contract?.subject || '',
    employerName: b.employerName || project?.client || '', contractorName: b.contractorName || '',
    employerLogo: b.employerLogo || '', contractorLogo: b.contractorLogo || '',
    contractNo: b.contractNo || contract?.contractNo || '', contractDate: b.contractDate || contract?.contractStartDate || '',
    from: period.from || '', to: period.to || '', prep: period.prep || todayIso(),
    boq: contract?.boq || [], measures: contract?.measures || [], labels: itemLabels(contract?.boq), totals: contractTotals(contract?.boq),
    contractAmount: contractTotals(contract?.boq).base || num(contract?.amount), advancePayment: num(contract?.advancePayment),
    scope, summary: statementSummary(contract, n, payments), now: cumulativeQty(contract?.measures, n), before: cumulativeQty(contract?.measures, n - 1)
  };
}

// a list stored on the contract, edited locally and saved on blur / discrete changes
function useContractList(contract, key, onPatchContract, clean) {
  const [rows, setRows] = useState(() => contract?.[key] || []);
  useEffect(() => { setRows(contract?.[key] || []); }, [contract?.id]);
  const commit = next => { next = clean(next); setRows(next); onPatchContract({ [key]: next }); };
  const edit = (id, k, v) => setRows(xs => xs.map(r => r.id === id ? { ...r, [k]: v } : r));
  const save = () => setRows(xs => { const next = clean(xs); onPatchContract({ [key]: next }); return next; });
  return { rows, commit, edit, save };
}
const cleanNums = (...keys) => xs => xs.map(r => ({ ...r, ...Object.fromEntries(keys.map(k => [k, r[k] === '' || r[k] == null ? '' : num(r[k])])) }));

function BoqSheet({ contract, list, measureList }) {
  const { rows, commit, edit, save } = list;
  const add = extra => commit([...rows, { id: rid('b'), desc: '', qty: '', unit: BOQ_UNITS[0], price: '', ...(extra ? { extra: true } : {}) }]);
  const used = new Set((contract?.measures || []).map(m => m.itemId)), labels = itemLabels(rows), t = contractTotals(rows);
  return <>
    <div className="lf-sv-bar"><span>آیتم‌ها را یک بار تعریف کنید؛ ریزمتره از همین فهرست پر می‌شود.</span><span className="ops"><button type="button" className="lf-btn ghost" onClick={() => add(false)}>＋ آیتم</button><button type="button" className="lf-btn ghost" onClick={() => add(true)}>＋ مازاد</button></span></div>
    {rows.length ? <div className="lf-boq-table" role="table"><div className="lf-boq-row head" role="row"><span>ردیف</span><span>شرح آیتم قرارداد</span><span>نوع</span><span>مقدار</span><span>واحد</span><span>فی (ریال)</span><span>مبلغ (ریال)</span><span /></div>
      {rows.map(r => <div className={`lf-boq-row ${r.extra ? 'extra' : ''}`} role="row" key={r.id}>
        <button type="button" className="no" title={r.extra ? 'تبدیل به آیتم قرارداد' : 'تبدیل به مازاد بر قرارداد'} onClick={() => commit(rows.map(x => x.id === r.id ? { ...x, extra: !x.extra } : x))}>{labels[r.id]}</button>
        <input aria-label="شرح آیتم" value={r.desc || ''} placeholder={r.extra ? 'شرح کار مازاد بر قرارداد' : 'شرح آیتم قرارداد'} onChange={e => edit(r.id, 'desc', e.target.value)} onBlur={save} />
        <select aria-label="نوع آیتم" className={`kind ${itemKind(r)}`} value={itemKind(r)} onChange={e => commit(rows.map(x => x.id === r.id ? { ...x, kind: e.target.value } : x))}>{ITEM_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input aria-label="مقدار" value={r.qty ?? ''} inputMode="decimal" data-raw="" placeholder="مقدار" onChange={e => edit(r.id, 'qty', decimalOnly(e.target.value))} onBlur={save} />
        <select aria-label="واحد" value={r.unit || BOQ_UNITS[0]} onChange={e => commit(rows.map(x => x.id === r.id ? { ...x, unit: e.target.value } : x))}>{[...new Set([...BOQ_UNITS, r.unit || BOQ_UNITS[0]])].map(u => <option key={u}>{u}</option>)}</select>
        <input aria-label="فی (ریال)" dir="ltr" value={grouped(r.price)} inputMode="numeric" placeholder="فی (ریال)" onChange={e => edit(r.id, 'price', String(num(e.target.value.replace(/[^0-9۰-۹,٬.]/g, '')) || ''))} onBlur={save} />
        <output className="amount">{rial(boqAmount(r))}</output>
        <button type="button" className="lf-x" aria-label="حذف آیتم" onClick={() => window.confirm(used.has(r.id) ? 'این آیتم در ریزمتره استفاده شده؛ ردیف‌های ریزمتره‌اش هم حذف می‌شود. ادامه؟' : 'این آیتم حذف شود؟') && (commit(rows.filter(x => x.id !== r.id)), used.has(r.id) && measureList.commit(measureList.rows.filter(m => m.itemId !== r.id)))}>×</button>
      </div>)}
      <div className="lf-boq-row total" role="row"><span /><b>جمع آیتم‌های قرارداد</b><span /><span /><span /><span /><output className="amount">{rial(t.base)}</output><span /></div>
      {t.extra ? <><div className="lf-boq-row total sub" role="row"><span /><b>جمع مازاد بر قرارداد <small className={t.extraPct > 25 ? 'bad' : ''}>({fa(t.extraPct, 1)}٪ مبلغ قرارداد{t.extraPct > 25 ? ' — بیش از ۲۵٪' : ''})</small></b><span /><span /><span /><span /><output className="amount">{rial(t.extra)}</output><span /></div>
        <div className="lf-boq-row total" role="row"><span /><b>جمع کل</b><span /><span /><span /><span /><output className="amount">{rial(t.all)}</output><span /></div></> : null}
    </div> : <p className="lf-empty">هنوز آیتمی ثبت نشده — با «＋ آیتم» اضافه کنید.</p>}
    {rows.length ? <p className="lf-sv-hint">برای علامت‌زدن یک ردیف به‌عنوان «مازاد بر قرارداد» روی شمارهٔ ردیف بزنید. بیمه فقط روی آیتم‌های «نصب / خدمات» حساب می‌شود.</p> : null}
  </>;
}

function MeasureSheet({ contract, onPatchContract, list, n }) {
  const { rows, commit, edit, save } = list;
  const boq = contract?.boq || [], byId = Object.fromEntries(boq.map(b => [b.id, b])), labels = itemLabels(boq);
  const period = contract?.svPeriods?.[n] || {};
  const setPeriod = (k, v) => onPatchContract({ svPeriods: { ...(contract?.svPeriods || {}), [n]: { ...period, [k]: v } } });
  const mine = rows.filter(m => (Number(m.statementNo) || 0) === n);
  const outside = m => m.date && ((period.from && m.date < period.from) || (period.to && m.date > period.to));
  const add = () => commit([...rows, { id: rid('m'), statementNo: n, itemId: boq[0]?.id || '', date: '', qty: '', note: '' }]);
  const total = mine.reduce((a, m) => a + num(m.qty) * num(byId[m.itemId]?.price), 0);
  if (!boq.length) return <p className="lf-empty">اول در «آیتم‌های قرارداد» آیتم تعریف کنید.</p>;
  return <>
    <div className="lf-sv-period"><label><span>دورهٔ کارکرد از</span><JalaliDateInput value={period.from || ''} onChange={v => setPeriod('from', v)} /></label><label><span>تا</span><JalaliDateInput value={period.to || ''} onChange={v => setPeriod('to', v)} /></label><label><span>تاریخ تهیهٔ صورت وضعیت</span><JalaliDateInput value={period.prep || ''} onChange={v => setPeriod('prep', v)} /></label><button type="button" className="lf-btn ghost" onClick={add}>＋ ردیف ریزمتره</button></div>
    {mine.length ? <div className="lf-boq-table lf-measure-table" role="table"><div className="lf-measure-row head" role="row"><span>آیتم قرارداد</span><span>تاریخ انجام</span><span>مقدار انجام‌شده</span><span>فی (ریال)</span><span>مبلغ (ریال)</span><span>توضیحات</span><span /></div>
      {mine.map(m => { const it = byId[m.itemId]; return <div className={`lf-measure-row ${outside(m) ? 'warn' : ''}`} role="row" key={m.id}>
        <select aria-label="آیتم قرارداد" value={m.itemId || ''} onChange={e => commit(rows.map(x => x.id === m.id ? { ...x, itemId: e.target.value } : x))}>{boq.map(b => <option key={b.id} value={b.id}>{labels[b.id]} — {b.desc || 'بی‌نام'}</option>)}</select>
        <span className="date"><JalaliDateInput value={m.date || ''} onChange={v => commit(rows.map(x => x.id === m.id ? { ...x, date: v } : x))} /></span>
        <span className="qty"><input aria-label="مقدار انجام‌شده" value={m.qty ?? ''} inputMode="decimal" data-raw="" placeholder="مقدار" onChange={e => edit(m.id, 'qty', decimalOnly(e.target.value))} onBlur={save} /><em>{it?.unit || ''}</em></span>
        <output>{rial(num(it?.price))}</output>
        <output className="amount">{rial(num(m.qty) * num(it?.price))}</output>
        <input aria-label="توضیحات" value={m.note || ''} placeholder="توضیحات" onChange={e => edit(m.id, 'note', e.target.value)} onBlur={save} />
        <button type="button" className="lf-x" aria-label="حذف ردیف" onClick={() => commit(rows.filter(x => x.id !== m.id))}>×</button>
        {outside(m) ? <small className="lf-sv-warn">تاریخ بیرون از دورهٔ کارکرد است.</small> : null}
      </div>; })}
      <div className="lf-measure-row total" role="row"><b>جمع ریزمتره صورت وضعیت {fa(n)}</b><output className="amount">{rial(total)}</output></div>
    </div> : <p className="lf-empty">برای صورت وضعیت {fa(n)} ردیفی ثبت نشده.</p>}
  </>;
}

function WorkSheet({ contract, n, payments, scope }) {
  const all = contract?.boq || [], labels = itemLabels(all), boq = scopeItems(all, scope);
  const now = cumulativeQty(contract?.measures, n), before = cumulativeQty(contract?.measures, n - 1);
  const s = statementSummary(contract, n, payments), sumOf = q => Math.round(boq.reduce((a, it) => a + (q[it.id] || 0) * num(it.price), 0));
  const g = scope === 'all' ? s.gross : sumOf(now), pg = scope === 'all' ? s.prevGross : sumOf(before);
  return <div className="lf-sv-scroll"><table className="lf-sv-table">
    <thead><tr><th>ردیف</th><th>شرح آیتم قرارداد</th><th>مقدار قرارداد</th><th>مقدار این صورت وضعیت</th><th>تا صورت وضعیت قبلی</th><th>کل تا کنون</th><th>واحد</th><th>فی (ریال)</th><th>مبلغ تجمعی (ریال)</th></tr></thead>
    <tbody>{boq.map(it => { const total = now[it.id] || 0, prev = before[it.id] || 0, over = !it.extra && num(it.qty) > 0 && total > num(it.qty) + 1e-9; return <tr key={it.id} className={`${over ? 'over' : ''} ${it.extra ? 'extra' : ''}`}>
      <td>{labels[it.id]}</td><td className="desc">{it.desc}{over ? <small> (بیش از مقدار قرارداد: {qtyFa(total - num(it.qty))})</small> : null}</td><td>{qtyFa(num(it.qty))}</td><td>{qtyFa(total - prev)}</td><td>{qtyFa(prev)}</td><td><b>{qtyFa(total)}</b></td><td>{it.unit}</td><td>{rial(num(it.price))}</td><td><b>{rial(total * num(it.price))}</b></td></tr>; })}</tbody>
    <tfoot><tr><td colSpan={8}>جمع کل صورت کارکرد ناخالص تجمعی تا کنون</td><td>{rial(g)}</td></tr><tr><td colSpan={8}>جمع کل صورت کارکرد ناخالص تا صورت وضعیت قبلی</td><td>{rial(pg)}</td></tr><tr><td colSpan={8}>جمع کل صورت کارکرد ناخالص فعلی</td><td><b>{rial(g - pg)}</b></td></tr>{scope === 'install' ? <tr><td colSpan={8}>مبنای بیمه (اقلام قرارداد پس از تخفیف + مازاد) × {fa(s.rates.insurance, 2)}٪</td><td><b>{rial(s.insurance)}</b></td></tr> : null}</tfoot>
  </table></div>;
}

function SummarySheet({ contract, onPatchContract, n, payments }) {
  const s = statementSummary(contract, n, payments), period = contract?.svPeriods?.[n] || {};
  const setRate = (k, v) => onPatchContract({ svRates: { ...s.rates, [k]: v } });
  const t = contractTotals(contract?.boq), contractTotal = t.base || num(contract?.amount);
  const row = (label, v, cls = '') => <tr className={cls}><td>{label}</td><td>{rial(v)}</td></tr>;
  const rate = k => <input aria-label={`درصد ${k}`} defaultValue={s.rates[k]} key={`${k}-${s.rates[k]}`} inputMode="decimal" onBlur={e => num(e.target.value) !== num(s.rates[k]) && setRate(k, num(e.target.value))} />;
  const isFinal = Number(contract?.svFinal) === n;
  return <div className="lf-sv-summary">
    <div className="lf-sv-rates">{SV_RATES.map(([k, l]) => <label key={k}><span>{l} (٪)</span>{rate(k)}</label>)}
      <label><span>بیمه</span><select value={s.rates.insuranceMode} onChange={e => setRate('insuranceMode', e.target.value)}><option value="deduct">از مبلغ کسر شود</option><option value="add">به مبلغ اضافه شود</option></select></label>
      <label className="check"><input type="checkbox" checked={isFinal} onChange={e => onPatchContract({ svFinal: e.target.checked ? n : null })} /><span>این صورت وضعیت «قطعی» است</span></label>
    </div>
    <p className="lf-sv-meta">مبلغ قرارداد: <b>{rial(contractTotal)} ریال</b>{t.extra ? <> · مازاد: {rial(t.extra)} ریال ({fa(t.extraPct, 1)}٪)</> : null}{period.from || period.to ? <> · دورهٔ کارکرد: {jl(period.from) || '—'} تا {jl(period.to) || '—'}</> : null}{num(contract?.advancePayment) ? <> · سقف استهلاک = پیش‌پرداخت {rial(num(contract.advancePayment))} ریال</> : null}</p>
    <table className="lf-sv-table narrow"><tbody>
      <tr className="group"><td colSpan={2}>کارکرد</td></tr>
      {row('کارکرد ناخالص تجمعی تا کنون', s.gross)}{row('کارکرد ناخالص این دوره', s.current)}{s.addInsurance ? row(`سپرده بیمه (${fa(s.rates.insurance, 2)}٪ مبنای ${rial(s.insuranceBase)})`, s.insuranceAdded) : null}
      <tr className="group"><td colSpan={2}>کسورات</td></tr>
      {row(`تخفیف (${fa(s.rates.discount, 3)}٪ اقلام قرارداد)`, s.discount)}{row(`سپرده حسن انجام کار (${fa(s.retentionRate)}٪${s.isFinal ? ' — آزادسازی در تحویل موقت' : ''})`, s.retention)}{s.addInsurance ? null : row(`سپرده بیمه (${fa(s.rates.insurance, 2)}٪ مبنای ${rial(s.insuranceBase)})`, s.insuranceDeducted)}{row(`استهلاک پیش‌پرداخت (${fa(s.rates.advance)}٪)`, s.advance)}{row(`مجموع پرداخت صورت وضعیت‌های قبلی ${s.paidFromRecords ? '(واریزی‌های ثبت‌شده)' : '(محاسبه‌شده)'}`, s.paidBefore)}
      {row('جمع کسورات', s.deductions, 'sum')}
      {row('مبلغ خالص قابل پرداخت (بدون مالیات بر ارزش افزوده)', s.payable, 'sum')}
      {row(`مالیات بر ارزش افزوده (${fa(s.rates.vat)}٪)`, s.vat)}
      {row('مبلغ خالص قابل پرداخت (با مالیات بر ارزش افزوده)', s.payableWithVat, 'final')}
    </tbody></table>
  </div>;
}

// logo → small PNG (keeps transparency) or, when that is still big, WebP; stored inline on the contract
async function logoDataUrl(file) {
  const img = await new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => rej(new Error('تصویر خوانده نشد.')); im.src = u; });
  const k = Math.min(1, 360 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let url = c.toDataURL('image/png'); if (url.length > 150000) url = c.toDataURL('image/webp', 0.85); if (url.length > 190000) url = c.toDataURL('image/jpeg', 0.8);
  return url;
}
function LogoField({ label, value, onChange }) {
  const ref = useRef(null), [err, setErr] = useState('');
  const pick = async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (!/^image\//.test(f.type)) { setErr('فقط فایل تصویر.'); return; } try { setErr(''); onChange(await logoDataUrl(f)); } catch (x) { setErr(x.message); } };
  return <div className="lf-sv-logo"><span>{label}</span><button type="button" className="box" onClick={() => ref.current?.click()}>{value ? <img src={value} alt={label} /> : <em>＋ انتخاب لوگو</em>}</button>{value ? <button type="button" className="lf-link del" onClick={() => onChange('')}>حذف لوگو</button> : null}<input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={pick} />{err ? <small className="lf-err">{err}</small> : null}</div>;
}
function CoverSheet({ contract, project, payments, scope, setScope, onPatchContract, n, onPrint, onExcel, busy }) {
  const b = contract?.svBrand || {}, doc = statementDoc(contract, project, n, payments, scope);
  const set = (k, v) => onPatchContract({ svBrand: { ...(contract?.svBrand || {}), [k]: v } });
  const text = (k, label, fallback) => <label className="lf-sheet-field"><span>{label}</span><input defaultValue={b[k] || ''} key={`${k}-${b[k] || ''}`} placeholder={fallback || label} onBlur={e => e.target.value.trim() !== (b[k] || '') && set(k, e.target.value.trim())} /></label>;
  const frame = useRef(null);
  useEffect(() => { let alive = true; import('./statementPrint').then(m => { if (!alive || !frame.current) return; const d = frame.current.contentDocument; d.open(); d.write(m.statementHtml(doc, { only: 'cover' })); d.close(); }); return () => { alive = false; }; }, [JSON.stringify(b), n, scope, doc.summary.payableWithVat, doc.from, doc.to, doc.prep, doc.contractAmount]);
  return <div className="lf-sv-cover">
    <div className="lf-sv-cover-form">
      <div className="lf-sv-logos"><LogoField label="لوگوی کارفرما" value={b.employerLogo} onChange={v => set('employerLogo', v)} /><LogoField label="لوگوی پیمانکار" value={b.contractorLogo} onChange={v => set('contractorLogo', v)} /></div>
      <div className="lf-sv-fields">{text('employerName', 'نام کارفرما', project?.client)}{text('contractorName', 'نام پیمانکار')}{text('projectName', 'نام پروژه', project?.name)}{text('subject', 'موضوع قرارداد', contract?.subject)}{text('contractNo', 'شماره قرارداد', contract?.contractNo)}<label className="lf-sheet-field"><span>تاریخ قرارداد</span><JalaliDateInput value={b.contractDate || contract?.contractStartDate || ''} onChange={v => set('contractDate', v)} /></label></div>
      <div className="lf-sv-out"><label className="lf-sv-scope"><span>اقلام چاپ</span><select value={scope} onChange={e => setScope(e.target.value)}>{SCOPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label><button type="button" className="lf-btn" disabled={busy} onClick={onPrint}>🖨 چاپ / PDF کامل</button><button type="button" className="lf-btn ghost" disabled={busy} onClick={onExcel}>📊 خروجی اکسل</button></div>
      <p className="lf-sv-hint">چاپ شامل روکش، خلاصهٔ مالی، صورت کارکرد و ریزمتره است. خالی‌ها از اطلاعات پروژه پر می‌شوند.</p>
    </div>
    <div className="lf-sv-preview"><iframe ref={frame} title="پیش‌نمایش روکش" /></div>
  </div>;
}

const SV_TABS = [['boq', 'آیتم‌های قرارداد'], ['measure', 'ریزمتره'], ['work', 'صورت کارکرد'], ['summary', 'صورت وضعیت'], ['cover', 'روکش و خروجی']];
export function StatementWorkbook({ contract, project, payments, onPatchContract }) {
  const [tab, setTab] = useState(() => (contract?.boq || []).length ? 'measure' : 'boq');
  const boqList = useContractList(contract, 'boq', onPatchContract, cleanNums('qty', 'price'));
  const measureList = useContractList(contract, 'measures', onPatchContract, cleanNums('qty'));
  const live = { ...(contract || {}), boq: boqList.rows, measures: measureList.rows };
  const nums = statementNumbers(live);
  const [n, setN] = useState(() => nums[nums.length - 1]);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [scope, setScope] = useState('all');
  const run = async kind => { setBusy(true); setErr(''); try { const m = await import('./statementPrint'); const doc = statementDoc(live, project, n, payments, scope); await (kind === 'excel' ? m.exportStatementExcel(doc) : m.printStatement(doc)); } catch (x) { setErr(x.message || 'خروجی ساخته نشد.'); } setBusy(false); };
  const pick = <label className="lf-sv-pick"><span>صورت وضعیت شماره</span><select value={n} onChange={e => setN(Number(e.target.value))}>{[...new Set([...nums, n])].sort((a, b) => a - b).map(k => <option key={k} value={k}>{Number(live.svFinal) === k ? 'قطعی' : fa(k)}</option>)}</select><button type="button" className="lf-link" onClick={() => setN(Math.max(...nums, n) + 1)}>＋ صورت وضعیت جدید</button></label>;
  return <section className="lf-boq lf-sv">
    <header className="lf-contract-financials-head"><h4>صورت وضعیت از روی ریزمتره</h4>{tab !== 'boq' ? pick : null}{boqList.rows.length ? <span className="lf-sv-head-ops"><button type="button" className="lf-btn ghost" disabled={busy} onClick={() => run('print')}>🖨 چاپ</button><button type="button" className="lf-btn ghost" disabled={busy} onClick={() => run('excel')}>📊 اکسل</button></span> : null}</header>
    {err ? <p className="lf-err">{err}</p> : null}
    <div className="lf-tabs lf-sv-tabs">{SV_TABS.map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === 'boq' ? <BoqSheet contract={live} list={boqList} measureList={measureList} />
      : tab === 'measure' ? <MeasureSheet contract={live} onPatchContract={onPatchContract} list={measureList} n={n} />
      : tab === 'work' ? <><label className="lf-sv-scope"><span>اقلام</span><select value={scope} onChange={e => setScope(e.target.value)}>{SCOPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label><WorkSheet contract={live} n={n} payments={payments} scope={scope} /></>
      : tab === 'summary' ? <SummarySheet contract={live} onPatchContract={onPatchContract} n={n} payments={payments} />
      : <CoverSheet contract={live} project={project} payments={payments} scope={scope} setScope={setScope} onPatchContract={onPatchContract} n={n} busy={busy} onPrint={() => run('print')} onExcel={() => run('excel')} />}
  </section>;
}
