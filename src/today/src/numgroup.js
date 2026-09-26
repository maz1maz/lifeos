// Thousands separators while typing, for every uncontrolled numeric text input
// (inputMode="numeric" | "decimal"). Commas are stripped in the capture phase of
// submit, so every existing FormData → Number(...) reader keeps working unchanged.
const SEL = 'input[inputmode="numeric"]:not([type="password"]):not(.amount):not([data-raw]),input[inputmode="decimal"]:not([type="password"]):not(.amount):not([data-raw])';
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
const latin = s => String(s).replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d)).replace(/[٫/]/g, '.');
export const ungroup = s => latin(s).replace(/,/g, '');
function group(raw, decimal) {
  let s = ungroup(raw).replace(decimal ? /[^\d.\-]/g : /[^\d\-]/g, '');
  const neg = s.startsWith('-'); s = s.replace(/-/g, '');
  let [int, ...rest] = s.split('.'); const frac = rest.join('');
  int = int.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + int + (decimal && s.includes('.') ? '.' + frac : '');
}
function apply(el) {
  const before = el.value; if (!before) return;
  const decimal = el.getAttribute('inputmode') === 'decimal';
  const caret = el.selectionStart ?? before.length;
  const digitsLeft = ungroup(before.slice(0, caret)).replace(/[^\d.]/g, '').length;
  const after = group(before, decimal);
  if (after === before) return;
  el.value = after;
  let pos = 0, seen = 0;
  while (pos < after.length && seen < digitsLeft) { if (/[\d.]/.test(after[pos])) seen++; pos++; }
  try { if (document.activeElement === el) el.setSelectionRange(pos, pos); } catch {}
}
function sweep(root) { (root.querySelectorAll ? root : document).querySelectorAll(SEL).forEach(el => { if (el !== document.activeElement || !el.value.includes(',')) apply(el); }); }
if (typeof document !== 'undefined' && !window.__numgroup) {
  window.__numgroup = true;
  document.addEventListener('input', e => { const el = e.target; if (el instanceof HTMLInputElement && el.matches(SEL)) apply(el); }, true);
  document.addEventListener('submit', e => {
    const f = e.target; if (!(f instanceof HTMLFormElement)) return;
    const els = [...f.querySelectorAll(SEL)];
    els.forEach(el => { el.value = ungroup(el.value); });
    setTimeout(() => els.forEach(el => el.isConnected && apply(el)), 0);
  }, true);
  const start = () => { sweep(document); new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) sweep(n.matches?.(SEL) ? n.parentNode || n : n); }).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
}
