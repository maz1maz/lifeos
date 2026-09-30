// Collapsible side list (Linear/Slack style) used by Projects and Courses:
// open = 260px column with search + tabs; collapsed = 56px rail of coloured initials; phone = "▾" dropdown.
import { useEffect, useRef, useState } from 'react';
import './sidelist.css';

const faN = n => Number(n || 0).toLocaleString('fa-IR');
export function SideLayout({ storageKey, title, items, tabs, selected, onPick, renderArchived, onReorder, children }) {
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(storageKey + '-collapsed') === '1'; } catch { return false; } });
  const [tab, setTab] = useState(tabs[0][0]), [q, setQ] = useState(''), [menu, setMenu] = useState(false), [drag, setDrag] = useState(null), [over, setOver] = useState(null);
  useEffect(() => { try { localStorage.setItem(storageKey + '-collapsed', collapsed ? '1' : '0'); } catch {} }, [collapsed]);
  // keep the selected item's tab visible
  useEffect(() => { const it = items.find(x => x.id === selected); if (it && it.group !== tab && it.group !== 'archived') setTab(it.group); }, [selected]);
  const count = g => items.filter(x => x.group === g).length;
  const shown = items.filter(x => x.group === tab && (!q.trim() || x.name.includes(q.trim())));
  const cur = items.find(x => x.id === selected);
  const pick = id => { onPick(id); setMenu(false); };
  // drag-to-reorder with pointer events (mouse, pen and touch): press the ⋮⋮ handle and move over another row;
  // releasing places the dragged project before that row. Disabled while searching.
  const canDrag = !!onReorder && !q.trim();
  const listRef = useRef(null);
  const drop = (from, target) => {
    if (!from || !target || from === target) return;
    const ids = shown.map(x => x.id).filter(id => id !== from), at = ids.indexOf(target);
    ids.splice(at < 0 ? ids.length : at, 0, from);
    onReorder(ids);
  };
  const startDrag = (e, id) => {
    if (!canDrag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); e.stopPropagation();
    setDrag(id); setOver(null);
    let target = null;
    const move = ev => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-slid]');
      const t = el && listRef.current?.contains(el) ? el.dataset.slid : null;
      if (t !== target) { target = t; setOver(t); }
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      drop(id, target); setDrag(null); setOver(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const row = x => <button key={x.id} type="button" className={`sl-row ${x.id === selected ? 'on' : ''} ${x.dim ? 'dim' : ''} ${drag === x.id ? 'dragging' : ''} ${over === x.id && drag && drag !== x.id ? 'drop-before' : ''}`} style={{ '--c': x.color }} onClick={() => pick(x.id)} title={x.name} data-slid={x.id}>
    {canDrag ? <span className="sl-grip" role="button" aria-label={`جابه‌جا کردن ${x.name}`} title="برای جابه‌جایی بکش" onPointerDown={e => startDrag(e, x.id)} onClick={e => e.stopPropagation()}>⋮⋮</span> : null}
    <span className="sl-ini">{[...x.name.trim()][0] || '•'}</span>
    <span className="sl-name">{x.name}</span>
    {x.bar ? <span className="sl-bar">{x.bar.map((b, i) => b.flex ? <i key={i} style={{ flex: b.flex, background: b.color }} /> : null)}</span> : null}
    <small>{x.sub}</small>
  </button>;
  return <div className={`sl-layout ${collapsed ? 'collapsed' : ''}`}>
    <aside className="sl-side">
      <div className="sl-head">{collapsed ? null : <b>{title}</b>}<button type="button" className="sl-toggle" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'باز کردن ستون' : 'جمع کردن ستون'} aria-label={collapsed ? 'باز کردن ستون' : 'جمع کردن ستون'}>{collapsed ? '‹' : '›'}</button></div>
      {collapsed ? <div className="sl-rail">{items.filter(x => x.group !== 'archived').map(x => <button key={x.id} type="button" className={`sl-dot ${x.id === selected ? 'on' : ''} ${x.dim ? 'dim' : ''}`} style={{ '--c': x.color }} onClick={() => pick(x.id)} title={`${x.name} — ${x.sub}`}>{[...x.name.trim()][0] || '•'}</button>)}</div> : <>
        {items.length > 6 ? <input className="sl-search" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو…" /> : null}
        <div className="sl-tabs">{tabs.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}<em>{faN(count(k))}</em></button>)}</div>
        <div className="sl-list" ref={listRef}>{tab === 'archived' && renderArchived ? shown.map(renderArchived) : shown.map(row)}{!shown.length ? <p className="sl-empty">{q ? 'چیزی پیدا نشد.' : 'خالی است.'}</p> : null}</div>
      </>}
    </aside>
    <div className="sl-mobile"><button type="button" className="sl-mbtn" style={{ '--c': cur?.color }} onClick={() => setMenu(m => !m)}><i />{cur ? cur.name : title} <span>▾</span></button>
      {menu ? <div className="sl-mmenu">{items.filter(x => x.group !== 'archived').map(row)}</div> : null}</div>
    <div className="sl-main">{children}</div>
  </div>;
}
