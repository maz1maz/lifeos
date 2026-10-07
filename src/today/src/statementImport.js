// Reads a contractor's statement workbook (the «صورت وضعیت پروژه» + «ریزمتر» Excel forms) into the statement
// workbook's data: contract items (with extras «مازاد بر قرارداد (n)»), measurement rows, header info, discount rate,
// the current work period and which statement is the final one. Sheets and columns are found by their header texts,
// not fixed positions, so moved columns / extra rows still import.
import { jToIso } from './jdate';
import { itemKind } from './statement';

const norm = v => String(v ?? '').replace(/[‌\s]+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
const digits = v => String(v ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const numOf = v => { if (typeof v === 'number') return v; const n = Number(digits(v).replace(/[,٬\s]/g, '')); return Number.isFinite(n) ? n : NaN; };
export const jalaliIso = v => { const m = /(1[34]\d\d)\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})/.exec(digits(v)); return m ? jToIso(+m[1], +m[2], +m[3]) : ''; };
const jalaliRange = v => { const all = [...digits(v).matchAll(/1[34]\d\d\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}/g)].map(m => jalaliIso(m[0])).filter(Boolean).sort(); return all.length ? { from: all[0], to: all[all.length - 1] } : null; };
// «1» → '1' · «مازاد بر قرارداد (2)» → 'x2'
const codeKey = v => { const t = norm(digits(v)); if (!t) return ''; const ex = /مازاد[^()]*\((\d+)\)/.exec(t); if (ex) return 'x' + Number(ex[1]); const n = /^\d+(\.0+)?$/.test(t) ? String(Number(t)) : ''; return n; };

function grid(XLSX, ws) {
  const ref = ws?.['!ref']; if (!ref) return { rows: 0, cols: 0, at: () => null };
  const r = XLSX.utils.decode_range(ref);
  return { rows: r.e.r + 1, cols: r.e.c + 1, at: (row, col) => { const c = ws[XLSX.utils.encode_cell({ r: row, c: col })]; return c ? (c.v ?? null) : null; }, formula: (row, col) => ws[XLSX.utils.encode_cell({ r: row, c: col })]?.f || '' };
}
// first row containing all the given header texts → { row, col: {text: index} }
function findHeader(g, texts) {
  for (let r = 0; r < Math.min(g.rows, 80); r++) {
    const col = {};
    for (let c = 0; c < g.cols; c++) { const t = norm(g.at(r, c)); for (const want of texts) if (col[want] == null && t === want) col[want] = c; }
    if (texts.every(t => col[t] != null)) return { row: r, col };
  }
  return null;
}
// the value next to a label like «شماره قرارداد :» (first non-empty cell after it in the same row)
function labelValue(g, label) {
  for (let r = 0; r < Math.min(g.rows, 40); r++) for (let c = 0; c < g.cols; c++) {
    const t = norm(g.at(r, c)); if (!t.startsWith(label)) continue;
    const rest = norm(t.slice(label.length).replace(/^[:\s]+/, '')); if (rest) return rest;
    for (let k = c + 1; k < Math.min(g.cols, c + 6); k++) { const v = g.at(r, k); if (norm(v)) return typeof v === 'number' ? v : norm(v); }
  }
  return '';
}

export async function parseStatementWorkbook(buffer) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', cellFormula: true });
  const warnings = [];
  let items = null, info = {}, measuresRaw = null, prep = '', period = null, isFinalDoc = false;
  for (const name of wb.SheetNames) {
    const g = grid(XLSX, wb.Sheets[name]);
    const h = findHeader(g, ['شماره آیتم قرارداد', 'شرح آیتم قرارداد', 'مقدار', 'واحد', 'فی']);
    if (h && !items) {
      items = []; let total = 0, discount = 0; // total: first «جمع کل» row (fallback only)
      const C = h.col;
      for (let r = h.row + 1; r < g.rows; r++) {
        const code = g.at(r, C['شماره آیتم قرارداد']), label = norm(code);
        if (label.startsWith('جمع کل') && !total) total = numOf(g.at(r, C['فی'])) || numOf(g.at(r, C['فی'] + 1)) || 0;
        if (label === 'تخفیف' && !discount) { discount = numOf(g.at(r, C['فی'])) || 0; continue; }
        if (label.startsWith('جمع') || label.startsWith('تخفیف') || label.startsWith('سپرده') || label.startsWith('مبلغ')) continue;
        const desc = norm(g.at(r, C['شرح آیتم قرارداد'])), key = codeKey(code), price = numOf(g.at(r, C['فی'])), qty = numOf(g.at(r, C['مقدار']));
        if (!desc || !key || !Number.isFinite(price)) continue;
        if (items.some(x => x.key === key)) { warnings.push(`ردیف «${label}» دو بار در فهرست آیتم‌ها آمده؛ اولی نگه داشته شد.`); continue; }
        items.push({ key, desc, qty: Number.isFinite(qty) ? qty : '', unit: norm(g.at(r, C['واحد'])) || 'مترمربع', price, extra: key.startsWith('x') });
      }
      // discount rate = contract discount ÷ the contract (non-extra) items — the «جمع کل» rows below also hold VAT totals
      const base = items.filter(x => !x.extra).reduce((t, x) => t + (Number(x.qty) || 0) * x.price, 0) || total;
      if (base && discount) info.discountPct = discount / base * 100;
      if (discount) info.discountAmount = discount;
      // the exact rate the forms use sits in their formulas: «…*0.950009417…» (1 − rate) in the insurance row or «…*4.999…%» in the discount row
      for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
        const f = g.formula(r, c); if (!f) continue;
        const m = /\*\s*0\.(9[0-9]{4,})/.exec(f), p = /\*\s*([0-9]{1,2}\.[0-9]{4,})%/.exec(f);
        if (m && /بیمه/.test(norm(g.at(r, c - 1)) + norm(g.at(r, c - 4)) + norm(g.at(r, c - 5)))) { info.discountPct = (1 - Number('0.' + m[1])) * 100; r = g.rows; break; }
        if (p && /تخفیف/.test(norm(g.at(r, c - 4)) + norm(g.at(r, c - 1)) + norm(g.at(r, c - 5)))) info.discountPct = Number(p[1]);
      }
      info.projectName = norm(labelValue(g, 'نام پروژه'));
      info.subject = norm(labelValue(g, 'موضوع قرارداد'));
      info.contractNo = norm(labelValue(g, 'شماره قرارداد'));
      info.contractDate = jalaliIso(labelValue(g, 'تاریخ قرارداد'));
      info.employerName = norm(labelValue(g, 'کارفرما'));
      const co = findHeader(g, ['نام پیمانکار', 'شرکت']); if (co) info.contractorName = norm(g.at(co.row + 1, co.col['شرکت']));
      for (let r = 0; r < Math.min(g.rows, 12); r++) for (let c = 0; c < g.cols; c++) if (/صورت وضعیت\s*قطعی/.test(norm(g.at(r, c)) + ' ' + norm(g.at(r, c + 1)))) isFinalDoc = true;
    }
    const m = findHeader(g, ['آیتم قرارداد', 'شماره صورت وضعیت', 'تاریخ انجام']);
    if (m && !measuresRaw) {
      const qCol = (() => { for (let c = 0; c < g.cols; c++) if (/^مقدار\s*انجام\s*شده$/.test(norm(g.at(m.row, c)))) return c; return -1; })();
      const noteCol = (() => { for (let c = 0; c < g.cols; c++) if (norm(g.at(m.row, c)) === 'توضیحات') return c; return -1; })();
      measuresRaw = [];
      for (let r = m.row + 1; r < g.rows; r++) {
        const code = g.at(r, m.col['آیتم قرارداد']), key = codeKey(code); if (!key) continue;
        const qty = numOf(g.at(r, qCol)); if (!Number.isFinite(qty)) continue;
        measuresRaw.push({ key, st: g.at(r, m.col['شماره صورت وضعیت']), date: jalaliIso(g.at(r, m.col['تاریخ انجام'])), qty, note: noteCol >= 0 ? norm(g.at(r, noteCol)) : '', row: r + 1 });
      }
      period = jalaliRange(labelValue(g, 'دوره کارکرد'));
    }
    if (!prep) prep = jalaliIso(labelValue(g, 'تاریخ تهیه صورت وضعیت'));
  }
  if (!items?.length) throw new Error('فهرست آیتم‌های قرارداد در این فایل پیدا نشد (ستون‌های «شماره آیتم قرارداد»، «شرح آیتم قرارداد»، «مقدار»، «واحد»، «فی»).');
  const ids = Object.fromEntries(items.map((x, i) => [x.key, `b${Date.now().toString(36)}${i}`]));
  const boq = items.map(x => { const row = { id: ids[x.key], desc: x.desc, qty: x.qty, unit: x.unit, price: x.price, ...(x.extra ? { extra: true } : {}) }; return { ...row, kind: itemKind(row) }; });
  // statement numbers: numeric ones as they are; a text one («ماقبل قطعی», «قطعی») becomes the next number
  const numeric = (measuresRaw || []).map(x => numOf(x.st)).filter(Number.isFinite), maxNo = numeric.length ? Math.max(...numeric) : 0;
  const textNo = (measuresRaw || []).some(x => !Number.isFinite(numOf(x.st)) && norm(x.st)) ? maxNo + 1 : 0;
  const measures = [];
  for (const x of measuresRaw || []) {
    if (!ids[x.key]) { warnings.push(`ریزمتره، ردیف ${x.row}: آیتم «${x.key.startsWith('x') ? `مازاد (${x.key.slice(1)})` : x.key}» در فهرست آیتم‌ها نیست — وارد نشد.`); continue; }
    const st = Number.isFinite(numOf(x.st)) ? numOf(x.st) : textNo || 1;
    measures.push({ id: `m${Date.now().toString(36)}${measures.length}`, statementNo: st, itemId: ids[x.key], date: x.date, qty: x.qty, note: x.note });
  }
  const last = Math.max(1, ...measures.map(x => x.statementNo));
  const periods = period || prep ? { [last]: { ...(period || {}), ...(prep ? { prep } : {}) } } : {};
  return { boq, measures, info, periods, finalNo: isFinalDoc ? last : null, lastNo: last, warnings };
}
