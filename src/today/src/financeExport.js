// Excel (.xlsx) export of the transactions currently shown on the finance page (month + type/account/search filters).
// Amounts are stored in rial; the sheet shows toman (÷10) and keeps the rial value in its own column.
// xlsx is loaded on demand so it never weighs on the finance page itself.
import { jalaliShort } from './jalali';

const KIND = t => t.kind === 'transfer' || t.category === 'انتقال' ? 'انتقال' : t.kind === 'income' ? 'درآمد' : 'هزینه';

export function transactionRows(items) {
  return [...items].sort((a, b) => String(a.date).localeCompare(String(b.date))).map(t => {
    const rial = Number(t.amount) || 0;
    return [jalaliShort(t.date), String(t.date || '').slice(0, 10), t.title || '', t.category || '', KIND(t), t.account || '', Math.round(rial / 10), rial, (t.tags || []).join('، ')];
  });
}

export function transactionSummary(items) {
  let income = 0, expense = 0; const cats = {};
  for (const t of items) {
    const k = KIND(t), toman = Math.round((Number(t.amount) || 0) / 10);
    if (k === 'درآمد') income += toman;
    else if (k === 'هزینه') { expense += toman; cats[t.category || 'بدون دسته'] = (cats[t.category || 'بدون دسته'] || 0) + toman; }
  }
  return { income, expense, cats: Object.entries(cats).sort((a, b) => b[1] - a[1]) };
}

// label = sheet title (e.g. «آبان ۱۴۰۵»); fileKey = Latin part of the file name (e.g. 1405-08) — some browsers drop non-Latin names
export async function exportTransactionsExcel(items, label, fileKey = 'export') {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const sheet = (rows, cols) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = cols.map(w => ({ wch: w })); return ws; };
  XLSX.utils.book_append_sheet(wb, sheet([
    ['تاریخ', 'تاریخ میلادی', 'شرح', 'دسته', 'نوع', 'حساب', 'مبلغ (تومان)', 'مبلغ (ریال)', 'برچسب‌ها'],
    ...transactionRows(items),
  ], [12, 12, 40, 16, 8, 16, 16, 18, 20]), 'تراکنش‌ها');
  const s = transactionSummary(items);
  XLSX.utils.book_append_sheet(wb, sheet([
    [label], [],
    ['جمع درآمد (تومان)', s.income], ['جمع هزینه (تومان)', s.expense], ['خالص (تومان)', s.income - s.expense], ['تعداد تراکنش', items.length], [],
    ['هزینه به تفکیک دسته', 'تومان'], ...s.cats,
  ], [28, 18]), 'خلاصه');
  wb.Workbook = { Views: [{ RTL: true }, { RTL: true }] };
  const blob = new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `lifeos-transactions-${String(fileKey).replace(/[^\w.-]/g, '-')}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
