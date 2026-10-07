// Contract statement workbook (صورت وضعیت): the user fills the contract items and the measurement sheet (ریزمتره);
// the work sheet (صورت کارکرد) and the statement summary (صورت وضعیت) are computed from them.
// Everything lives on the project's contract record: boq (items), measures (ریزمتره rows), svRates, svPeriods.
// Amounts are cumulative per statement N: gross(N) = Σ measures up to N; each deduction is a % of gross(N);
// payable(N) = gross(N) − deductions(N) − payable of the statements before N (so each one pays only its share).
import { useEffect, useState } from 'react';
import { JalaliDateInput } from './jdate';
import { fa, jl, num } from './life-core';

export const BOQ_UNITS = ['مترمربع', 'مترطول', 'مترمکعب', 'عدد', 'کیلوگرم', 'تن', 'دستگاه', 'سرویس', 'کنترات'];
export const boqAmount = row => Math.round(num(row?.qty) * num(row?.price));
export const boqTotal = rows => (rows || []).reduce((a, r) => a + boqAmount(r), 0);
export const SV_RATES = [['discount', 'تخفیف', 0], ['retention', 'سپرده حسن انجام کار', 10], ['insurance', 'سپرده بیمه', 0], ['advance', 'استهلاک پیش‌پرداخت', 0], ['vat', 'مالیات بر ارزش افزوده', 10]];
const rid = p => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const rial = n => fa(Math.round(n || 0), 0);
const qtyFa = n => fa(n || 0, 2);
const grouped = v => v === '' || v == null ? '' : num(v).toLocaleString('en-US');
const decimalOnly = v => v.replace(/[^0-9۰-۹.٫]/g, '').replace('٫', '.');

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
// the statement summary for statement n (recurses over the earlier ones for «payments before»)
export function statementSummary(contract, n) {
  const boq = contract?.boq || [], measures = contract?.measures || [], rates = { ...Object.fromEntries(SV_RATES.map(([k, , d]) => [k, d])), ...(contract?.svRates || {}) };
  const advanceCap = num(contract?.advancePayment);
  let paidBefore = 0, last = null;
  for (let k = 1; k <= n; k++) {
    const gross = grossUpTo(boq, measures, k), prevGross = k > 1 ? grossUpTo(boq, measures, k - 1) : 0;
    const discount = Math.round(gross * num(rates.discount) / 100), retention = Math.round(gross * num(rates.retention) / 100), insurance = Math.round(gross * num(rates.insurance) / 100);
    let advance = Math.round(gross * num(rates.advance) / 100); if (advanceCap > 0) advance = Math.min(advance, advanceCap);
    const deductions = discount + retention + insurance + advance + paidBefore;
    const payable = gross - deductions, vat = Math.round(Math.max(0, payable) * num(rates.vat) / 100);
    last = { n: k, gross, prevGross, current: gross - prevGross, discount, retention, insurance, advance, paidBefore, deductions, payable, vat, payableWithVat: payable + vat, rates };
    paidBefore += payable;
  }
  return last;
}
export const statementNumbers = contract => { const max = Math.max(0, ...(contract?.measures || []).map(m => Number(m.statementNo) || 0)); return Array.from({ length: Math.max(1, max) }, (_, i) => i + 1); };

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
  const add = () => commit([...rows, { id: rid('b'), desc: '', qty: '', unit: BOQ_UNITS[0], price: '' }]);
  const used = new Set((contract?.measures || []).map(m => m.itemId));
  return <>
    <div className="lf-sv-bar"><span>آیتم‌ها را یک بار تعریف کنید؛ ریزمتره از همین فهرست پر می‌شود.</span><button type="button" className="lf-btn ghost" onClick={add}>＋ آیتم</button></div>
    {rows.length ? <div className="lf-boq-table" role="table"><div className="lf-boq-row head" role="row"><span>ردیف</span><span>شرح آیتم قرارداد</span><span>مقدار</span><span>واحد</span><span>فی (ریال)</span><span>مبلغ (ریال)</span><span /></div>
      {rows.map((r, i) => <div className="lf-boq-row" role="row" key={r.id}>
        <span className="no">{fa(i + 1)}</span>
        <input aria-label="شرح آیتم" value={r.desc || ''} placeholder="شرح آیتم قرارداد" onChange={e => edit(r.id, 'desc', e.target.value)} onBlur={save} />
        <input aria-label="مقدار" value={r.qty ?? ''} inputMode="decimal" data-raw="" placeholder="مقدار" onChange={e => edit(r.id, 'qty', decimalOnly(e.target.value))} onBlur={save} />
        <select aria-label="واحد" value={r.unit || BOQ_UNITS[0]} onChange={e => commit(rows.map(x => x.id === r.id ? { ...x, unit: e.target.value } : x))}>{[...new Set([...BOQ_UNITS, r.unit || BOQ_UNITS[0]])].map(u => <option key={u}>{u}</option>)}</select>
        <input aria-label="فی (ریال)" value={grouped(r.price)} inputMode="numeric" placeholder="فی (ریال)" onChange={e => edit(r.id, 'price', String(num(e.target.value.replace(/[^0-9۰-۹,٬]/g, '')) || ''))} onBlur={save} />
        <output className="amount">{rial(boqAmount(r))}</output>
        <button type="button" className="lf-x" aria-label="حذف آیتم" onClick={() => window.confirm(used.has(r.id) ? 'این آیتم در ریزمتره استفاده شده؛ ردیف‌های ریزمتره‌اش هم حذف می‌شود. ادامه؟' : 'این آیتم حذف شود؟') && (commit(rows.filter(x => x.id !== r.id)), used.has(r.id) && measureList.commit(measureList.rows.filter(m => m.itemId !== r.id)))}>×</button>
      </div>)}
      <div className="lf-boq-row total" role="row"><span /><b>جمع کل قرارداد</b><span /><span /><span /><output className="amount">{rial(boqTotal(rows))}</output><span /></div>
    </div> : <p className="lf-empty">هنوز آیتمی ثبت نشده — با «＋ آیتم» اضافه کنید.</p>}
  </>;
}

function MeasureSheet({ contract, onPatchContract, list, n }) {
  const { rows, commit, edit, save } = list;
  const boq = contract?.boq || [], byId = Object.fromEntries(boq.map((b, i) => [b.id, { ...b, no: i + 1 }]));
  const period = contract?.svPeriods?.[n] || {};
  const setPeriod = (k, v) => onPatchContract({ svPeriods: { ...(contract?.svPeriods || {}), [n]: { ...period, [k]: v } } });
  const mine = rows.filter(m => (Number(m.statementNo) || 0) === n);
  const outside = m => m.date && ((period.from && m.date < period.from) || (period.to && m.date > period.to));
  const add = () => commit([...rows, { id: rid('m'), statementNo: n, itemId: boq[0]?.id || '', date: '', qty: '', note: '' }]);
  const total = mine.reduce((a, m) => a + num(m.qty) * num(byId[m.itemId]?.price), 0);
  if (!boq.length) return <p className="lf-empty">اول در «آیتم‌های قرارداد» آیتم تعریف کنید.</p>;
  return <>
    <div className="lf-sv-period"><label><span>دورهٔ کارکرد از</span><JalaliDateInput value={period.from || ''} onChange={v => setPeriod('from', v)} /></label><label><span>تا</span><JalaliDateInput value={period.to || ''} onChange={v => setPeriod('to', v)} /></label><button type="button" className="lf-btn ghost" onClick={add}>＋ ردیف ریزمتره</button></div>
    {mine.length ? <div className="lf-boq-table lf-measure-table" role="table"><div className="lf-measure-row head" role="row"><span>آیتم قرارداد</span><span>تاریخ انجام</span><span>مقدار انجام‌شده</span><span>فی (ریال)</span><span>مبلغ (ریال)</span><span>توضیحات</span><span /></div>
      {mine.map(m => { const it = byId[m.itemId]; return <div className={`lf-measure-row ${outside(m) ? 'warn' : ''}`} role="row" key={m.id}>
        <select aria-label="آیتم قرارداد" value={m.itemId || ''} onChange={e => commit(rows.map(x => x.id === m.id ? { ...x, itemId: e.target.value } : x))}>{boq.map((b, i) => <option key={b.id} value={b.id}>{fa(i + 1)} — {b.desc || 'بی‌نام'}</option>)}</select>
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

function WorkSheet({ contract, n }) {
  const boq = contract?.boq || [], measures = contract?.measures || [];
  const now = cumulativeQty(measures, n), before = cumulativeQty(measures, n - 1);
  const s = statementSummary(contract, n);
  return <div className="lf-sv-scroll"><table className="lf-sv-table">
    <thead><tr><th>ردیف</th><th>شرح آیتم قرارداد</th><th>مقدار قرارداد</th><th>مقدار این صورت وضعیت</th><th>تا صورت وضعیت قبلی</th><th>کل تا کنون</th><th>واحد</th><th>فی (ریال)</th><th>مبلغ تجمعی (ریال)</th></tr></thead>
    <tbody>{boq.map((it, i) => { const total = now[it.id] || 0, prev = before[it.id] || 0, over = num(it.qty) > 0 && total > num(it.qty) + 1e-9; return <tr key={it.id} className={over ? 'over' : ''}>
      <td>{fa(i + 1)}</td><td className="desc">{it.desc}{over ? <small> (بیش از مقدار قرارداد: {qtyFa(total - num(it.qty))})</small> : null}</td><td>{qtyFa(num(it.qty))}</td><td>{qtyFa(total - prev)}</td><td>{qtyFa(prev)}</td><td><b>{qtyFa(total)}</b></td><td>{it.unit}</td><td>{rial(num(it.price))}</td><td><b>{rial(total * num(it.price))}</b></td></tr>; })}</tbody>
    <tfoot><tr><td colSpan={8}>جمع کل صورت کارکرد ناخالص تجمعی تا کنون</td><td>{rial(s.gross)}</td></tr><tr><td colSpan={8}>جمع کل صورت کارکرد ناخالص تا صورت وضعیت قبلی</td><td>{rial(s.prevGross)}</td></tr><tr><td colSpan={8}>جمع کل صورت کارکرد ناخالص فعلی</td><td><b>{rial(s.current)}</b></td></tr></tfoot>
  </table></div>;
}

function SummarySheet({ contract, onPatchContract, n }) {
  const s = statementSummary(contract, n), period = contract?.svPeriods?.[n] || {};
  const setRate = (k, v) => onPatchContract({ svRates: { ...(s.rates || {}), [k]: num(v) } });
  const contractTotal = boqTotal(contract?.boq) || num(contract?.amount);
  const row = (label, v, cls = '') => <tr className={cls}><td>{label}</td><td>{rial(v)}</td></tr>;
  const rate = k => <input aria-label={`درصد ${k}`} defaultValue={s.rates[k]} key={`${k}-${s.rates[k]}`} inputMode="decimal" onBlur={e => num(e.target.value) !== num(s.rates[k]) && setRate(k, e.target.value)} />;
  return <div className="lf-sv-summary">
    <div className="lf-sv-rates">{SV_RATES.map(([k, l]) => <label key={k}><span>{l} (٪)</span>{rate(k)}</label>)}</div>
    <p className="lf-sv-meta">مبلغ قرارداد: <b>{rial(contractTotal)} ریال</b>{period.from || period.to ? <> · دورهٔ کارکرد: {jl(period.from) || '—'} تا {jl(period.to) || '—'}</> : null}{num(contract?.advancePayment) ? <> · سقف استهلاک = پیش‌پرداخت {rial(num(contract.advancePayment))} ریال</> : null}</p>
    <table className="lf-sv-table narrow"><tbody>
      <tr className="group"><td colSpan={2}>کارکرد</td></tr>
      {row('کارکرد ناخالص تجمعی تا کنون', s.gross)}{row('کارکرد ناخالص این دوره', s.current)}
      <tr className="group"><td colSpan={2}>کسورات</td></tr>
      {row(`تخفیف (${fa(s.rates.discount)}٪)`, s.discount)}{row(`سپرده حسن انجام کار (${fa(s.rates.retention)}٪)`, s.retention)}{row(`سپرده بیمه (${fa(s.rates.insurance)}٪)`, s.insurance)}{row(`استهلاک پیش‌پرداخت (${fa(s.rates.advance)}٪)`, s.advance)}{row('مجموع پرداخت صورت وضعیت‌های قبلی', s.paidBefore)}
      {row('جمع کسورات', s.deductions, 'sum')}
      {row('مبلغ خالص قابل پرداخت (بدون مالیات بر ارزش افزوده)', s.payable, 'sum')}
      {row(`مالیات بر ارزش افزوده (${fa(s.rates.vat)}٪)`, s.vat)}
      {row('مبلغ خالص قابل پرداخت (با مالیات بر ارزش افزوده)', s.payableWithVat, 'final')}
    </tbody></table>
  </div>;
}

const SV_TABS = [['boq', 'آیتم‌های قرارداد'], ['measure', 'ریزمتره'], ['work', 'صورت کارکرد'], ['summary', 'صورت وضعیت']];
export function StatementWorkbook({ contract, onPatchContract }) {
  const [tab, setTab] = useState(() => (contract?.boq || []).length ? 'measure' : 'boq');
  const boqList = useContractList(contract, 'boq', onPatchContract, cleanNums('qty', 'price'));
  const measureList = useContractList(contract, 'measures', onPatchContract, cleanNums('qty'));
  const live = { ...(contract || {}), boq: boqList.rows, measures: measureList.rows };
  const nums = statementNumbers(live);
  const [n, setN] = useState(() => nums[nums.length - 1]);
  const pick = <label className="lf-sv-pick"><span>صورت وضعیت شماره</span><select value={n} onChange={e => setN(Number(e.target.value))}>{[...new Set([...nums, n])].sort((a, b) => a - b).map(k => <option key={k} value={k}>{fa(k)}</option>)}</select><button type="button" className="lf-link" onClick={() => setN(Math.max(...nums, n) + 1)}>＋ صورت وضعیت جدید</button></label>;
  return <section className="lf-boq lf-sv">
    <header className="lf-contract-financials-head"><h4>صورت وضعیت از روی ریزمتره</h4>{tab !== 'boq' ? pick : null}</header>
    <div className="lf-tabs lf-sv-tabs">{SV_TABS.map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === 'boq' ? <BoqSheet contract={live} list={boqList} measureList={measureList} />
      : tab === 'measure' ? <MeasureSheet contract={live} onPatchContract={onPatchContract} list={measureList} n={n} />
      : tab === 'work' ? <WorkSheet contract={live} n={n} />
      : <SummarySheet contract={live} onPatchContract={onPatchContract} n={n} />}
  </section>;
}
