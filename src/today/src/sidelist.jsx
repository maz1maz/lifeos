// Collapsible side list (Linear/Slack style) used by Projects and Courses:
// open = 260px column with search + tabs; collapsed = 56px rail of coloured initials; phone = "▾" dropdown.
import { useEffect, useState } from 'react';
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
  // drag-to-reorder (desktop list only, disabled while searching): drop onto a row = place before it
  const canDrag = !!onReorder && !q.trim();
  const drop = target => {
    if (!drag || drag === target) return;
    const ids = shown.map(x => x.id).filter(id => id !== drag), at = ids.indexOf(target);
    ids.splice(at < 0 ? ids.length : at, 0, drag);
    onReorder(ids);
  };
  const dnd = x => canDrag ? {
    draggable: true,
    onDragStart: e => { setDrag(x.id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', x.id); } catch {} },
    onDragOver: e => { if (!drag) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== x.id) setOver(x.id); },
    onDrop: e => { e.preventDefault(); drop(x.id); setDrag(null); setOver(null); },
    onDragEnd: () => { setDrag(null); setOver(null); }
  } : {};
  const row = x => <button key={x.id} type="button" className={`sl-row ${x.id === selected ? 'on' : ''} ${x.dim ? 'dim' : ''} ${drag === x.id ? 'dragging' : ''} ${over === x.id && drag && drag !== x.id ? 'drop-before' : ''}`} style={{ '--c': x.color }} onClick={() => pick(x.id)} title={canDrag ? `${x.name} — برای جابه‌جایی بکش` : x.name} {...dnd(x)}>
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
        <div className="sl-list">{tab === 'archived' && renderArchived ? shown.map(renderArchived) : shown.map(row)}{!shown.length ? <p className="sl-empty">{q ? 'چیزی پیدا نشد.' : 'خالی است.'}</p> : null}</div>
      </>}
    </aside>
    <div className="sl-mobile"><button type="button" className="sl-mbtn" style={{ '--c': cur?.color }} onClick={() => setMenu(m => !m)}><i />{cur ? cur.name : title} <span>▾</span></button>
      {menu ? <div className="sl-mmenu">{items.filter(x => x.group !== 'archived').map(row)}</div> : null}</div>
    <div className="sl-main">{children}</div>
  </div>;
}
