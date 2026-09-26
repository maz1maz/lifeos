import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell, CalendarDays, Check, ChevronDown, CircleAlert, CircleDot, ClipboardList,
  Clock, Hash, Inbox, ListChecks, Pencil, Plus, Repeat, Search, Sun, Trash2, X
} from 'lucide-react';
import './planner.css';
import { JalaliDateInput } from './jdate';

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.');
  return body;
};

const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fa = n => Number(n || 0).toLocaleString('fa-IR');
const faDigits = v => String(v ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const jalaliToday = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tehran' }).formatToParts(new Date()).map(x => [x.type, x.value])); return `${p.weekday} ${p.day} ${p.month} ${p.year}`; };

const PRIORITY_LABELS = { urgent: 'فوری', high: 'زیاد', medium: 'متوسط', low: 'کم' };
const PRIORITY_TONE = { urgent: 'rose', high: 'rose', medium: 'amber', low: 'sky' };
const REPEAT_LABELS = { daily: 'روزانه', weekly: 'هفتگی', monthly: 'ماهانه' };
const FILTERS = [['open', 'باز'], ['today', 'امروز'], ['upcoming', 'پیشِ رو'], ['reminders', 'یادآوری‌ها'], ['done', 'انجام‌شده'], ['all', 'همه']];

function dueLabel(dateStr) {
  if (!dateStr) return '';
  const t = isoToday(), tmr = iso(addDays(new Date(`${t}T12:00:00`), 1));
  if (dateStr === t) return 'امروز';
  if (dateStr === tmr) return 'فردا';
  try { return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short' }).format(new Date(`${dateStr}T12:00:00`)); }
  catch { return dateStr; }
}

function Chip({ tone = 'neutral', icon: Icon, children }) {
  return <span className={`plnr-chip plnr-chip-${tone}`}>{Icon && <Icon size={13} strokeWidth={1.8} />}{children}</span>;
}

function TaskCard({ task, index, reminder, onToggle, onEdit, onDelete }) {
  const t = isoToday(), overdue = !task.done && task.date && task.date < t, todayish = !task.done && task.date === t;
  const tags = task.tags || [];
  return (
    <li className="plnr-card" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <button type="button" role="checkbox" aria-checked={task.done} className={`plnr-check ${task.done ? 'on' : ''}`} onClick={() => onToggle(task)} aria-label={task.done ? 'بازگرداندن کار به حالت باز' : 'انجام شد'}>
        {task.done && <Check size={14} strokeWidth={3} />}
      </button>
      <div className="plnr-card-body">
        <div className="plnr-card-head">
          <b className={task.done ? 'done' : ''}>{task.title}</b>
          <div className="plnr-card-actions">
            <button type="button" onClick={() => onEdit(task)} aria-label="ویرایش کار"><Pencil size={15} /></button>
            <button type="button" onClick={() => onDelete(task)} aria-label="حذف کار"><Trash2 size={15} /></button>
          </div>
        </div>
        {task.notes && <p className={task.done ? 'done' : ''}>{task.notes}</p>}
        <div className="plnr-chips">
          {task.date && <Chip tone={overdue ? 'rose' : todayish ? 'teal' : 'neutral'} icon={overdue ? CircleAlert : CalendarDays}>{overdue ? `عقب‌افتاده · ${dueLabel(task.date)}` : dueLabel(task.date)}</Chip>}
          {!task.date && <Chip>یادداشتِ بی‌تاریخ</Chip>}
          {task.startTime && <Chip icon={Clock}>{faDigits(task.startTime)}</Chip>}
          <Chip tone={PRIORITY_TONE[task.priority] || 'neutral'}><span className="plnr-chip-dot" />اولویت {PRIORITY_LABELS[task.priority] || task.priority}</Chip>
          {task.recurrence && <Chip tone="sky" icon={Repeat}>{REPEAT_LABELS[task.recurrence] || task.recurrence}</Chip>}
          {reminder && <Chip tone="amber" icon={Bell}>یادآوری {reminder.time ? faDigits(reminder.time) : dueLabel(reminder.date)}</Chip>}
          {tags.map(tag => <Chip key={tag} icon={Hash}>{tag}</Chip>)}
        </div>
      </div>
    </li>
  );
}

export function TaskDrawer({ open, initial, kind, onClose, onSubmit }) {
  const today = isoToday();
  const empty = { title: '', notes: '', date: today, startTime: kind === 'reminder' ? '08:30' : '09:00', priority: 'medium', recurrence: '', tags: '', reminderOn: kind === 'reminder', reminderDate: today, reminderTime: kind === 'reminder' ? '08:30' : '', loose: false };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        title: initial.task.title, notes: initial.task.notes || '', date: initial.task.date || today,
        startTime: initial.task.startTime || '', priority: initial.task.priority || 'medium',
        recurrence: initial.task.recurrence || '', tags: (initial.task.tags || []).join('، '),
        reminderOn: !!initial.reminder, reminderDate: initial.reminder?.date || initial.task.date || today,
        reminderTime: initial.reminder?.time || '', loose: !initial.task.date
      });
    } else setForm(empty);
    setErr('');
  }, [open, initial, kind]);
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, busy]);
  if (!open) return null;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async e => {
    e.preventDefault();
    if (!form.title.trim()) { setErr('عنوان کار را بنویس.'); return; }
    if (form.reminderOn && !form.reminderDate) { setErr('تاریخ یادآوری را بنویس.'); return; }
    setBusy(true);
    try {
      await onSubmit({
        title: form.title.trim(), notes: form.notes, date: form.loose ? '' : form.date,
        startTime: form.loose ? null : (form.startTime || null), priority: form.priority,
        recurrence: form.recurrence || null, tags: form.tags, reminderOn: form.reminderOn,
        reminderDate: form.reminderDate, reminderTime: form.reminderTime, loose: form.loose, kind
      });
    } finally { setBusy(false); }
  };
  return (
    <div className="plnr-drawer-backdrop" onClick={() => !busy && onClose()}>
      <form className="plnr-drawer" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <header>
          <div>
            <h2>{initial ? 'ویرایش' : kind === 'reminder' ? 'یادآوری تازه' : 'کار تازه'}</h2>
            <p>{initial ? 'تغییرها را ذخیره کن' : 'جزئیات، سررسید و یادآوری'}</p>
          </div>
          <button type="button" onClick={() => !busy && onClose()} aria-label="بستن"><X size={18} /></button>
        </header>
        <div className="plnr-drawer-body">
          <div><label>عنوان <span className="req">*</span></label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="مثلاً ارسال گزارش هفتگی" autoFocus maxLength={220} />{err && <small className="plnr-err">{err}</small>}</div>
          <div><label>توضیحات</label><textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="جزئیات بیشتر (اختیاری)" /></div>
          <label className="plnr-chip" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={form.loose} onChange={e => set('loose', e.target.checked)} /> یادداشتِ بی‌تاریخ
          </label>
          {!form.loose && (
            <div className="plnr-2col">
              <div><label>سررسید</label><JalaliDateInput value={form.date} onChange={v => set('date', v)} /></div>
              <div><label>ساعت</label><input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} /></div>
            </div>
          )}
          <div className="plnr-2col">
            <div><label>اولویت</label><div className="plnr-select-wrap"><select value={form.priority} onChange={e => set('priority', e.target.value)}>{Object.keys(PRIORITY_LABELS).map(k => <option key={k} value={k}>{PRIORITY_LABELS[k]}</option>)}</select><ChevronDown size={15} /></div></div>
            <div><label>تکرار</label><div className="plnr-select-wrap"><select value={form.recurrence} onChange={e => set('recurrence', e.target.value)}><option value="">بدون تکرار</option>{Object.keys(REPEAT_LABELS).map(k => <option key={k} value={k}>{REPEAT_LABELS[k]}</option>)}</select><ChevronDown size={15} /></div></div>
          </div>
          <div><label>برچسب‌ها <span>(با ویرگول جدا کن)</span></label><input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="گزارش، فوری" /></div>
          <div className="plnr-reminder-box">
            <div className="plnr-reminder-head">
              <div><b>یادآوری</b><small>یک یادآوری جدا روی تقویم می‌سازد</small></div>
              <button type="button" className={`plnr-switch ${form.reminderOn ? 'on' : ''}`} onClick={() => set('reminderOn', !form.reminderOn)} role="switch" aria-checked={form.reminderOn}><i /></button>
            </div>
            {form.reminderOn && <div className="plnr-2col"><div><label>تاریخ یادآوری</label><JalaliDateInput value={form.reminderDate} onChange={v => set('reminderDate', v)} /></div><div><label>ساعت</label><input type="time" value={form.reminderTime} onChange={e => set('reminderTime', e.target.value)} /></div></div>}
          </div>
        </div>
        <footer>
          <button type="submit" className="plnr-submit" disabled={busy}>{busy && <span className="plnr-spinner" />}{initial ? 'ثبت تغییرات' : kind === 'reminder' ? 'ذخیرهٔ یادآوری' : 'ذخیرهٔ کار'}</button>
          <button type="button" className="cancel" onClick={() => !busy && onClose()} disabled={busy}>انصراف</button>
        </footer>
      </form>
    </div>
  );
}

// Create a new task or reminder from TaskDrawer's body (used by the Today page too).
export async function createPlannerItem(kind, body) {
  const today = isoToday();
  if (kind === 'reminder') {
    return api('/api/reminders', { method: 'POST', body: JSON.stringify({ title: body.title, date: body.date || today, time: body.startTime || body.reminderTime || null, whenLabel: body.date || today, recurrence: body.recurrence }) });
  }
  const payload = { title: body.title, notes: body.notes, date: body.loose ? '' : body.date, startTime: body.startTime, priority: body.priority, recurrence: body.recurrence, tags: body.tags, loose: body.loose };
  const saved = await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
  if (body.reminderOn && body.reminderDate) await api('/api/reminders', { method: 'POST', body: JSON.stringify({ title: saved.title, date: body.reminderDate, time: body.reminderTime || null, whenLabel: body.reminderDate, recurrence: body.recurrence, taskId: saved.id }) });
  return saved;
}

export function PlannerReact({ Nav }) {
  const [kind, setKind] = useState('task');
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [filter, setFilter] = useState('open');
  const [sort, setSort] = useState('due');
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  const flash = msg => { setToast(msg); setTimeout(() => setToast(''), 2600); };
  const load = () => Promise.all([api('/api/tasks'), api('/api/reminders?from=0000-01-01&to=9999-12-31')])
    .then(([taskData, reminderData]) => { setTasks(taskData.items || []); setReminders(reminderData.items || []); })
    .catch(error => setNotice(error.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const reminderByTask = useMemo(() => Object.fromEntries(reminders.filter(r => r.taskId).map(r => [r.taskId, r])), [reminders]);
  const today = isoToday(), weekAhead = iso(addDays(new Date(`${today}T12:00:00`), 7));
  const standaloneReminders = useMemo(() => reminders.filter(r => !r.taskId).map(r => ({
    id: r.id, title: r.title, notes: '', date: r.date, startTime: r.time || '', priority: 'medium',
    recurrence: r.recurrence || null, tags: [], done: !!r.done, createdAt: r.createdAt, _reminder: true
  })), [reminders]);

  const source = kind === 'reminder' ? standaloneReminders : tasks;

  const counts = useMemo(() => ({
    open: source.filter(x => !x.done).length,
    today: source.filter(x => !x.done && x.date === today).length,
    upcoming: source.filter(x => !x.done && x.date > today && x.date <= weekAhead).length,
    reminders: kind === 'reminder' ? source.filter(x => !x.done).length : tasks.filter(x => !x.done && reminderByTask[x.id]).length,
    done: source.filter(x => x.done).length,
    all: source.length
  }), [source, reminderByTask, kind]);

  const visible = useMemo(() => {
    let list = source;
    if (filter === 'open') list = list.filter(x => !x.done);
    else if (filter === 'today') list = list.filter(x => !x.done && (x.date === today || (x.date && x.date < today)));
    else if (filter === 'upcoming') list = list.filter(x => !x.done && x.date > today && x.date <= weekAhead);
    else if (filter === 'reminders') list = kind === 'reminder' ? list.filter(x => !x.done) : list.filter(x => !x.done && reminderByTask[x.id]);
    else if (filter === 'done') list = list.filter(x => x.done);
    const q = query.trim();
    if (q) list = list.filter(x => x.title.includes(q) || (x.notes || '').includes(q) || (x.tags || []).some(tag => tag.includes(q)));
    const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
    const dueVal = x => x.date ? new Date(`${x.date}T${x.startTime || '23:59'}`).getTime() : Infinity;
    const sorted = [...list];
    if (sort === 'created') sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    else if (sort === 'priority') sorted.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || (dueVal(a) - dueVal(b)));
    else sorted.sort((a, b) => (Number(a.done) - Number(b.done)) || (dueVal(a) - dueVal(b)));
    return sorted;
  }, [source, filter, sort, query, reminderByTask, kind]);

  const submit = async body => {
    try {
      if (kind === 'reminder' && !editing) {
        await api('/api/reminders', { method: 'POST', body: JSON.stringify({ title: body.title, date: body.date || today, time: body.startTime || body.reminderTime || null, whenLabel: body.date || today, recurrence: body.recurrence }) });
      } else if (kind === 'reminder' && editing?.task?._reminder) {
        await api(`/api/reminders/${editing.task.id}`, { method: 'PATCH', body: JSON.stringify({ title: body.title, date: body.date || today, time: body.startTime || null, recurrence: body.recurrence }) });
      } else {
        const payload = { title: body.title, notes: body.notes, date: body.loose ? '' : body.date, startTime: body.startTime, priority: body.priority, recurrence: body.recurrence, tags: body.tags, loose: body.loose };
        let saved;
        if (editing) saved = await api(`/api/tasks/${editing.task.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        else saved = await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
        const existingReminder = editing?.reminder;
        if (body.reminderOn && body.reminderDate) {
          const rBody = { title: saved.title, date: body.reminderDate, time: body.reminderTime || null, whenLabel: body.reminderDate, recurrence: body.recurrence, taskId: saved.id };
          if (existingReminder) await api(`/api/reminders/${existingReminder.id}`, { method: 'PATCH', body: JSON.stringify(rBody) });
          else await api('/api/reminders', { method: 'POST', body: JSON.stringify(rBody) });
        } else if (existingReminder) await api(`/api/reminders/${existingReminder.id}`, { method: 'DELETE' });
      }
      setDrawerOpen(false); setEditing(null); flash(editing ? 'تغییرات ذخیره شد ✓' : 'ثبت شد ✓'); load();
    } catch (error) { flash(error.message); }
  };

  const toggle = async task => {
    try {
      if (task._reminder) await api(`/api/reminders/${task.id}`, { method: 'PATCH', body: JSON.stringify({ done: !task.done }) });
      else {
        await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ done: !task.done }) });
        const r = reminderByTask[task.id]; if (r) await api(`/api/reminders/${r.id}`, { method: 'PATCH', body: JSON.stringify({ done: !task.done }) });
      }
      flash(!task.done && task.recurrence ? 'انجام شد؛ نمونهٔ بعدی ساخته شد ✓' : !task.done ? 'انجام شد ✓' : 'دوباره باز شد');
      load();
    } catch (error) { flash(error.message); }
  };

  const remove = async task => {
    try {
      if (task._reminder) await api(`/api/reminders/${task.id}`, { method: 'DELETE' });
      else {
        await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
        const r = reminderByTask[task.id]; if (r) await api(`/api/reminders/${r.id}`, { method: 'DELETE' });
      }
      setDeleting(null); flash('حذف شد.'); load();
    } catch (error) { flash(error.message); }
  };

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = task => { setEditing({ task, reminder: reminderByTask[task.id] || null }); setDrawerOpen(true); };

  const emptyMessage = query.trim() ? `چیزی برای «${query.trim()}» پیدا نشد.`
    : filter === 'done' ? 'هنوز کاری را تمام نکرده‌ای.'
    : filter === 'today' ? 'برای امروز کاری ثبت نشده — روزِ سبکی است.'
    : filter === 'upcoming' ? 'پیشِ رو چیزی نیست؛ تا یک هفتهٔ آینده خالی است.'
    : filter === 'reminders' ? 'یادآوری فعالی نیست.'
    : kind === 'reminder' ? 'یادآوری‌ای ثبت نشده است.'
    : 'دفتر خالی است — اولین کار را بساز.';

  const stats = [
    { t: 'کار باز', v: counts.open, Icon: CircleDot, tone: 'teal' },
    { t: 'سررسید امروز', v: counts.today, Icon: Sun, tone: 'amber' },
    { t: 'یادآوری فعال', v: counts.reminders, Icon: Bell, tone: 'sky' },
    { t: 'انجام‌شده', v: counts.done, Icon: Check, tone: 'fog' }
  ];

  return (
    <main className="plnr" dir="rtl">
      {Nav && <Nav active="planner" />}
      <div className="plnr-page">
        <header className="plnr-hero">
          <div className="plnr-hero-title">
            <div className="plnr-mark"><ClipboardList size={24} strokeWidth={2} /></div>
            <div>
              <h1>برنامه‌ریز</h1>
              <p className="kicker">کارها و یادآوری‌ها، با ذخیره‌سازی واقعی در LifeOS</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div className="plnr-kinds">
              <button type="button" className={kind === 'task' ? 'active' : ''} onClick={() => { setKind('task'); setFilter('open'); }}><ListChecks size={14} /> کارها</button>
              <button type="button" className={kind === 'reminder' ? 'active' : ''} onClick={() => { setKind('reminder'); setFilter('open'); }}><Bell size={14} /> یادآوری‌ها</button>
            </div>
            <div className="plnr-datechip"><CalendarDays size={16} color="#5eead4" /> {jalaliToday()}</div>
          </div>
        </header>

        <section className="plnr-stats" aria-label="آمار">
          {stats.map(s => (
            <div className={`plnr-stat ${s.tone}`} key={s.t}>
              <i><s.Icon size={20} /></i>
              <div><b>{fa(s.v)}</b><small>{s.t}</small></div>
            </div>
          ))}
        </section>

        <section className="plnr-toolbar">
          <div className="plnr-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="جستجو در عنوان، توضیحات یا برچسب‌ها…" aria-label="جستجو" /></div>
          <div className="plnr-sort-wrap">
            <select className="plnr-sort" value={sort} onChange={e => setSort(e.target.value)} aria-label="مرتب‌سازی">
              <option value="due">مرتب‌سازی: سررسید</option>
              <option value="priority">مرتب‌سازی: اولویت</option>
              <option value="created">مرتب‌سازی: تازه‌ترین</option>
            </select>
            <ChevronDown size={16} />
          </div>
          <button type="button" className="plnr-add-btn" onClick={openCreate}><Plus size={16} strokeWidth={2.4} /> {kind === 'reminder' ? 'یادآوری تازه' : 'کار تازه'}</button>
        </section>

        {notice && (
          <div className="notice">
            <div className="plnr-confirm-ico"><CircleAlert size={22} /></div>
            <div><h3 style={{ margin: 0 }}>دریافت داده‌ها ناموفق بود</h3><p>{notice}</p></div>
            <button type="button" onClick={() => { setNotice(''); load(); }}>تلاش دوباره</button>
          </div>
        )}

        <nav className="plnr-tabs" aria-label="فیلترها">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
              {label}
              <span>{fa(counts[key])}</span>
            </button>
          ))}
        </nav>

        {loading && source.length === 0 ? (
          <div aria-label="در حال بارگذاری">{[0, 1, 2].map(i => <div key={i} className="plnr-skel" />)}</div>
        ) : visible.length === 0 ? (
          <div className="plnr-empty">
            <div className="icon"><Inbox size={28} /></div>
            <div>
              <h3>{emptyMessage}</h3>
              <p>{query.trim() ? 'عبارت دیگری امتحان کنید.' : 'نخستین مورد را بسازید تا برنامه‌ریزی آغاز شود.'}</p>
            </div>
            {(filter === 'open' || filter === 'all') && !query.trim() && <button type="button" className="plnr-add-btn" onClick={openCreate}><Plus size={15} strokeWidth={2.4} /> افزودن کار تازه</button>}
          </div>
        ) : (
          <>
            <p className="plnr-count">{fa(visible.length)} کار نمایش داده می‌شود</p>
            <ul className="plnr-list">
              {visible.map((task, i) => <TaskCard key={task.id} task={task} index={i} reminder={reminderByTask[task.id]} onToggle={toggle} onEdit={openEdit} onDelete={setDeleting} />)}
            </ul>
          </>
        )}

        <footer className="plnr-foot">داده‌ها به‌صورت ماندگار در LifeOS ذخیره می‌شوند · تاریخ‌ها به تقویم شمسی</footer>
      </div>
      <TaskDrawer open={drawerOpen} initial={editing} kind={kind} onClose={() => { setDrawerOpen(false); setEditing(null); }} onSubmit={submit} />
      {deleting && (
        <div className="plnr-confirm" onClick={() => setDeleting(null)}>
          <div className="plnr-confirm-box" onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <div className="plnr-confirm-head">
              <div className="plnr-confirm-ico"><CircleAlert size={20} /></div>
              <div>
                <h3>حذف کار</h3>
                <p>«{deleting.title}» برای همیشه حذف می‌شود. ادامه می‌دهید؟</p>
              </div>
            </div>
            <div className="plnr-confirm-actions">
              <button type="button" className="cancel" onClick={() => setDeleting(null)}>انصراف</button>
              <button type="button" className="plnr-del" onClick={() => remove(deleting)}>حذف کن</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`plnr-toast ${/ناموفق|خطا|نشد/.test(toast) ? 'bad' : ''}`}>{toast}</div>}
      <button type="button" className="plnr-fab" onClick={openCreate} aria-label="تازه"><Plus size={22} /></button>
    </main>
  );
}
