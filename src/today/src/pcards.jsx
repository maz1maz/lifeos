// Project cards (kanban) that are due today or overdue — shown on Today, Planner and Calendar without copying data.
import { useEffect, useState } from 'react';
import { api } from './life.jsx';
import './pcards.css';

export const cardHref = c => `/?page=projects&pid=${encodeURIComponent(c.projectId)}&card=${encodeURIComponent(c.id)}`;
export const cardDone = id => api(`/api/col/cards/${id}`, { method: 'PATCH', body: JSON.stringify({ col: 'done', doneAt: Date.now() }) });
export function useProjectDue(on = true) {
  const [items, setItems] = useState([]);
  const load = () => on ? api('/api/projects/due').then(d => setItems(d.items || [])).catch(() => {}) : null;
  useEffect(() => { load(); }, [on]);
  const done = async c => { if (c._done) return; setItems(xs => xs.map(x => x.id === c.id ? { ...x, _done: true } : x)); try { await cardDone(c.id); } catch { load(); } };
  return { items, done, reload: load };
}
export const PChip = ({ c }) => <span className="pc-chip" style={{ '--c': c.color }}>🗂 {c.project}</span>;
