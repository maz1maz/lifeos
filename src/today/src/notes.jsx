import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp, Check, Download, FileText, ImagePlus, LayoutGrid, Loader2,
  Paperclip, Pin, PinOff, Plus, Rows3, Search, SlidersHorizontal, Trash2, X
} from 'lucide-react';
import './notes.css';

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.');
  return body;
};

export const COLORS = [
  { key: 'sky', label: 'آسمانی', hex: '#38BDF8', wash: 'rgba(56,189,248,0.10)' },
  { key: 'teal', label: 'فیروزه‌ای', hex: '#22D3EE', wash: 'rgba(34,211,238,0.10)' },
  { key: 'mint', label: 'نعناعی', hex: '#34D399', wash: 'rgba(52,211,153,0.10)' },
  { key: 'amber', label: 'کهربایی', hex: '#FBBF24', wash: 'rgba(251,191,36,0.10)' },
  { key: 'rose', label: 'گلی', hex: '#FB7185', wash: 'rgba(251,113,133,0.10)' },
  { key: 'violet', label: 'بنفش', hex: '#A78BFA', wash: 'rgba(167,139,250,0.10)' }
];
const COLOR_MAP = Object.fromEntries(COLORS.map(c => [c.key, c]));
const COLOR_ALIAS = { cyan: 'sky', green: 'mint' };
export function colorOf(key) { return COLOR_MAP[COLOR_ALIAS[key] || key] || COLOR_MAP.sky; }

export const MAX_FILE_BYTES = 400 * 1024;
export const MAX_FILES_PER_NOTE = 4;
const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const faNum = n => { try { return Number(n || 0).toLocaleString('fa-IR'); } catch { return String(n); } };
const toIso = value => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value);
  const n = Number(value);
  return Number.isFinite(n) && n > 1e11 ? new Date(n).toISOString() : new Date().toISOString();
};
const shortDate = iso => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try { return d.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { return '—'; }
};
const longDate = iso => {
  try { return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return shortDate(iso); }
};
const clockTime = iso => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = v => String(v).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};
const bytes = size => {
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
const isImage = mime => String(mime || '').startsWith('image/');
const readAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error(`خواندن ${file.name} ناموفق بود`));
  reader.onload = () => resolve({ name: file.name, mime: file.type || 'application/octet-stream', size: file.size, data: String(reader.result || '') });
  reader.readAsDataURL(file);
});

function fromInbox(item) {
  return {
    id: item.id,
    title: item.title || (item.text || '').split('\n')[0].slice(0, 120) || 'بدون عنوان',
    body: item.text || '',
    color: COLOR_ALIAS[item.color] || item.color || 'sky',
    tags: Array.isArray(item.tags) ? item.tags : [],
    pinned: !!item.pinned,
    archived: !!item.archived,
    createdAt: toIso(item.createdAt || item.noteDate),
    updatedAt: toIso(item.updatedAt || item.createdAt || item.noteDate),
    attachments: Array.isArray(item.attachments) ? item.attachments : []
  };
}

function Highlight({ text, query }) {
  const q = (query || '').trim();
  if (!q) return text;
  const hay = text.toLowerCase(), needle = q.toLowerCase();
  const out = [];
  let i = 0, key = 0;
  while (i < text.length) {
    const at = hay.indexOf(needle, i);
    if (at === -1) { out.push(text.slice(i)); break; }
    if (at > i) out.push(text.slice(i, at));
    out.push(<mark className="hit" key={key++}>{text.slice(at, at + needle.length)}</mark>);
    i = at + needle.length;
  }
  return out;
}

function Composer({ editing, onCloseEdit, onSaved }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [color, setColor] = useState('sky');
  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState('');
  const [pinned, setPinned] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const titleRef = useRef(null);
  const fileRef = useRef(null);

  const clearForm = () => { setTitle(''); setBody(''); setColor('sky'); setTags([]); setTagDraft(''); setPinned(false); setFiles([]); setError(null); };
  useEffect(() => {
    if (!editing) { clearForm(); return; }
    setTitle(editing.title);
    setBody(editing.body);
    setColor(colorOf(editing.color).key);
    setTags(editing.tags);
    setPinned(editing.pinned);
    setFiles(editing.attachments.map(({ name, mime, size, data }) => ({ name, mime, size, data })));
    setError(null);
  }, [editing?.id]);
  const reset = () => { clearForm(); };

  const addTag = raw => {
    const value = raw.trim().replace(/^#/, '');
    if (!value) return;
    setTags(prev => prev.includes(value) || prev.length >= 8 ? prev : [...prev, value]);
    setTagDraft('');
  };

  const ingest = async list => {
    if (!list) return;
    const incoming = Array.from(list);
    if (!incoming.length) return;
    const room = MAX_FILES_PER_NOTE - files.length;
    if (room <= 0) { setError(`حداکثر ${MAX_FILES_PER_NOTE} پیوست برای هر یادداشت.`); return; }
    const tooBig = incoming.find(f => f.size > MAX_FILE_BYTES);
    if (tooBig) { setError(`حجم «${tooBig.name}» بیشتر از ۴۰۰ کیلوبایت است.`); return; }
    try {
      const read = await Promise.all(incoming.slice(0, room).map(readAsDataUrl));
      setError(null);
      setFiles(prev => [...prev, ...read]);
    } catch { setError('خواندن فایل(ها) ناموفق بود.'); }
  };

  const submit = async e => {
    e.preventDefault();
    if (!title.trim()) { setError('عنوان یادداشت را بنویسید.'); titleRef.current?.focus(); return; }
    setBusy(true); setError(null);
    try {
      const payload = { title, text: body, color, tags, pinned, attachments: files };
      if (editing) await api(`/api/inbox/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/api/inbox', { method: 'POST', body: JSON.stringify(payload) });
      const fresh = await api('/api/inbox');
      onSaved((fresh.items || []).map(fromInbox));
      reset();
    } catch (err) { setError(err.message || 'ذخیره‌سازی ناموفق بود.'); }
    finally { setBusy(false); }
  };

  const active = colorOf(color);
  return (
    <form onSubmit={submit} className="nd-composer">
      <div className="nd-composer-line" style={{ background: `linear-gradient(90deg, transparent, ${active.hex}, transparent)` }} />
      <div className="nd-composer-head">
        <div>
          <div className="nd-mono nd-cyan">{editing ? 'EDIT / ویرایش' : 'NEW / یادداشت تازه'}</div>
          <h2>{editing ? 'ویرایش' : 'افزودن'}</h2>
        </div>
        <span className="nd-swatch" style={{ background: active.hex, boxShadow: `0 0 22px -6px ${active.hex}` }} aria-hidden />
      </div>
      <div className="nd-composer-body">
        <label className="nd-mono nd-mute">TITLE / عنوان</label>
        <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان…" maxLength={140} />
        <label className="nd-mono nd-mute">TAGS / برچسب‌ها</label>
        <div className="nd-tag-input">
          {tags.map(tag => (
            <span key={tag} className="nd-tag-chip">#{tag}<button type="button" aria-label={`حذف برچسب ${tag}`} onClick={() => setTags(p => p.filter(t => t !== tag))}><X size={12} /></button></span>
          ))}
          <input value={tagDraft} onChange={e => setTagDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagDraft); } if (e.key === 'Backspace' && !tagDraft) setTags(p => p.slice(0, -1)); }}
            onBlur={() => addTag(tagDraft)} placeholder={tags.length ? '' : 'کلید Enter برای برچسب'} />
        </div>
        <span className="nd-mono nd-mute">COLOR / رنگ</span>
        <div className="nd-color-row">
          {COLORS.map(c => {
            const on = c.key === color;
            return <button key={c.key} type="button" onClick={() => setColor(c.key)} aria-pressed={on} title={c.label} className={on ? 'on' : ''}>
              <i style={{ background: c.hex, boxShadow: on ? `0 0 12px -2px ${c.hex}` : undefined }} />{c.label}{on && <Check size={12} />}
            </button>;
          })}
        </div>
        <button type="button" className={`nd-pin-toggle ${pinned ? 'on' : ''}`} onClick={() => setPinned(p => !p)} aria-pressed={pinned}>
          <span><Pin size={15} /> سنجاق شود بالای فهرست</span>
          <span className={`nd-switch ${pinned ? 'on' : ''}`}><i /></span>
        </button>
        <label className="nd-mono nd-mute">BODY / متن</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="متن یادداشت…" rows={6} />
        <span className="nd-mono nd-mute">FILES / پیوست ({files.length}/{MAX_FILES_PER_NOTE})</span>
        <div className={`nd-drop ${dragging ? 'on' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); void ingest(e.dataTransfer.files); }}>
          <button type="button" onClick={() => fileRef.current?.click()}><Paperclip size={13} /> انتخاب فایل یا عکس <ImagePlus size={13} /></button>
          <p>یا فایل را اینجا رها کنید — تا ۴۰۰ کیلوبایت برای هر فایل</p>
          <input ref={fileRef} type="file" multiple hidden onChange={e => { void ingest(e.target.files); e.target.value = ''; }} />
        </div>
        {files.length > 0 && <ul className="nd-file-list">{files.map((f, idx) => (
          <li key={`${f.name}-${idx}`}>
            {isImage(f.mime) ? <img src={f.data} alt="" /> : <span className="nd-ext">{(f.name.split('.').pop() || '').slice(0, 4).toUpperCase()}</span>}
            <span className="nd-fname">{f.name}</span>
            <span className="nd-fsize">{bytes(f.size)}</span>
            <button type="button" aria-label={`حذف ${f.name}`} onClick={() => setFiles(p => p.filter((_, i) => i !== idx))}><X size={14} /></button>
          </li>
        ))}</ul>}
        {error && <p className="nd-error">{error}</p>}
        <div className="nd-composer-actions">
          <button type="submit" disabled={busy} className="nd-save" style={{ boxShadow: `0 14px 34px -18px ${active.hex}` }}>
            {busy && <Loader2 size={16} className="spin" />}{busy ? 'در حال ذخیره…' : editing ? 'به‌روزرسانی' : 'ذخیره'}
          </button>
          {editing && <button type="button" className="nd-cancel" onClick={() => { reset(); onCloseEdit(); }}>انصراف</button>}
        </div>
      </div>
    </form>
  );
}

function NoteCard({ note, query, selected, busy, view, onSelect, onEdit, onTogglePin, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const c = colorOf(note.color);
  const images = note.attachments.filter(a => isImage(a.mime));
  const others = note.attachments.filter(a => !isImage(a.mime));
  const thumbN = view === 'grid' ? 3 : 4;
  return (
    <article className={`nd-card ${selected ? 'selected' : ''} ${busy ? 'busy' : ''}`} onClick={() => onSelect(note.id)} onKeyDown={e => { if (e.key === 'Enter') onSelect(note.id); }} tabIndex={0} role="button" aria-pressed={selected}>
      <span className="nd-spine" style={{ background: c.hex, boxShadow: `0 0 26px -4px ${c.hex}` }} aria-hidden />
      <span className="nd-wash" style={{ background: `radial-gradient(120% 70% at 100% 0%, ${c.wash}, transparent 60%)` }} aria-hidden />
      <div className="nd-card-inner">
        <header>
          <div>
            <div className="nd-card-meta">
              <span className="nd-dot" style={{ background: c.hex }} aria-hidden />
              <span className="nd-mono nd-mute">#{String(note.id).slice(0, 4)} · {shortDate(note.updatedAt)}</span>
              {note.pinned && <span className="nd-pin-badge"><Pin size={10} /> سنجاق</span>}
            </div>
            <h3><Highlight text={note.title} query={query} /></h3>
          </div>
          <div className="nd-card-ops" onClick={e => e.stopPropagation()}>
            <button type="button" title={note.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'} onClick={() => onTogglePin(note)} className={note.pinned ? 'amber' : ''}>{note.pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
            <button type="button" title="ویرایش" onClick={() => onEdit(note)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </button>
            {confirm ? <div className="nd-confirm"><button type="button" onClick={() => { onDelete(note.id); setConfirm(false); }}>حذف</button><button type="button" onClick={() => setConfirm(false)}>خیر</button></div>
              : <button type="button" title="حذف" onClick={() => setConfirm(true)}><Trash2 size={14} /></button>}
          </div>
        </header>
        {note.tags.length > 0 && <div className="nd-tags">{note.tags.map(t => <span key={t} style={{ color: c.hex, borderColor: `${c.hex}44`, background: c.wash }}>#{t}</span>)}</div>}
        {note.body && <p className="nd-clamp"><Highlight text={note.body} query={query} /></p>}
        {note.attachments.length > 0 && (
          <footer onClick={e => e.stopPropagation()}>
            {images.slice(0, thumbN).map((img, i) => <img key={img.id || i} src={img.data} alt={img.name} />)}
            {images.length > thumbN && <span className="nd-more">+{images.length - thumbN}</span>}
            {others.slice(0, 2).map((f, i) => <span key={f.id || i} className="nd-filechip"><FileText size={12} /><span>{f.name}</span><em>{bytes(f.size)}</em></span>)}
            <span className="nd-mono nd-mute nd-attach-count"><Paperclip size={11} /> {note.attachments.length}</span>
          </footer>
        )}
      </div>
    </article>
  );
}

function Inspector({ note, allNotes, query, onClose, onEdit, onTogglePin, onDelete, onFocusTag, onConvert }) {
  if (!note) {
    const total = allNotes.length;
    const pinnedCount = allNotes.filter(n => n.pinned).length;
    const files = allNotes.reduce((s, n) => s + n.attachments.length, 0);
    const tagCounts = new Map();
    for (const n of allNotes) for (const t of n.tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const perColor = COLORS.map(c => ({ ...c, count: allNotes.filter(n => colorOf(n.color).key === c.key).length }));
    const max = Math.max(1, ...perColor.map(p => p.count));
    return (
      <div className="nd-inspector idle">
        <div className="nd-mono nd-cyan">ANALYTICS / نمای کلی</div>
        <div className="nd-stat-grid">
          {[{ k: 'یادداشت', v: total }, { k: 'سنجاق‌شده', v: pinnedCount }, { k: 'پیوست', v: files }].map(s => (
            <div key={s.k}><b>{faNum(s.v)}</b><small>{s.k}</small></div>
          ))}
        </div>
        <div className="nd-mono nd-mute">COLORS / توزیع رنگ</div>
        <ul className="nd-color-bars">{perColor.map(c => (
          <li key={c.key}><span>{c.label}</span><span className="nd-bar"><i style={{ width: `${Math.round((c.count / max) * 100)}%`, background: c.hex, boxShadow: `0 0 12px -2px ${c.hex}` }} /></span><em>{c.count}</em></li>
        ))}</ul>
        {topTags.length > 0 && <>
          <div className="nd-mono nd-mute">TAGS / برچسب‌ها</div>
          <div className="nd-tag-cloud">{topTags.map(([t, n]) => <button key={t} type="button" onClick={() => onFocusTag(t)}>#{t}<em>{n}</em></button>)}</div>
        </>}
        <p className="nd-hint">یک یادداشت را از فهرست انتخاب کنید تا متن کامل و پیوست‌هایش اینجا باز شود.<br /><span>Ctrl</span> + <span>K</span> برای جست‌وجو، <span>Esc</span> برای بستن.</p>
      </div>
    );
  }
  const c = colorOf(note.color);
  return (
    <article className="nd-inspector open">
      <div className="nd-insp-head" style={{ background: `linear-gradient(160deg, ${c.hex}26, transparent 65%)`, borderBottom: `1px solid ${c.hex}33` }}>
        <div className="nd-insp-top">
          <span className="nd-mono" style={{ color: c.hex }}>NOTE / #{String(note.id).slice(0, 8)}</span>
          <button type="button" onClick={onClose} aria-label="بستن"><X size={14} /></button>
        </div>
        <h2>{note.title}</h2>
        <div className="nd-insp-meta">
          <span>{shortDate(note.createdAt)}</span><span>{longDate(note.createdAt)}</span><span>{clockTime(note.createdAt)}</span>
          {note.pinned && <span className="nd-pin-badge">سنجاق‌شده</span>}
        </div>
        {note.tags.length > 0 && <div className="nd-tags">{note.tags.map(t => <button key={t} type="button" onClick={() => onFocusTag(t)} style={{ color: c.hex, borderColor: `${c.hex}55`, background: c.wash }}>#{t}</button>)}</div>}
      </div>
      <div className="nd-insp-body">
        <p className="nd-full"><Highlight text={note.body || 'بدون متن.'} query={query} /></p>
        {note.attachments.length > 0 && <>
          <div className="nd-mono nd-mute">ATTACHMENTS / پیوست‌ها ({note.attachments.length})</div>
          <div className="nd-thumbs">{note.attachments.filter(a => isImage(a.mime)).map((a, i) => (
            <a key={a.id || i} href={a.data} download={a.name} title={`${a.name} — ${bytes(a.size)}`}>
              <img src={a.data} alt={a.name} /><span>{a.name}</span>
            </a>
          ))}</div>
          <ul className="nd-file-list">{note.attachments.filter(a => !isImage(a.mime)).map((a, i) => (
            <li key={a.id || i}><FileText size={13} /><span className="nd-fname">{a.name}</span><span className="nd-fsize">{bytes(a.size)}</span>
              <a href={a.data} download={a.name} aria-label={`دانلود ${a.name}`}><Download size={14} /></a></li>
          ))}</ul>
        </>}
        <div className="nd-insp-actions">
          <button type="button" className="nd-save" onClick={() => onEdit(note)}>ویرایش</button>
          <button type="button" className={note.pinned ? 'amber' : ''} onClick={() => onTogglePin(note)} aria-label="سنجاق">{note.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
          <button type="button" onClick={() => onDelete(note.id)} aria-label="حذف"><Trash2 size={15} /></button>
        </div>
        {onConvert && <div className="nd-convert">
          <button type="button" onClick={() => onConvert(note, 'task')}>تبدیل به کار</button>
          <button type="button" onClick={() => onConvert(note, 'reminder')}>تبدیل به یادآور</button>
        </div>}
      </div>
    </article>
  );
}

export function NotesReact({ Nav }) {
  const [notes, setNotes] = useState([]);
  const [query, setQuery] = useState('');
  const [colorFilter, setColorFilter] = useState(null);
  const [tagFilter, setTagFilter] = useState(null);
  const [sort, setSort] = useState('updated');
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const searchRef = useRef(null);

  const load = async () => {
    try { const data = await api('/api/inbox'); setNotes((data.items || []).map(fromInbox)); }
    catch (error) { setNotice(error.message); }
  };
  useEffect(() => { load(); }, []);

  const allTags = useMemo(() => {
    const set = new Map();
    for (const n of notes) for (const t of n.tags) set.set(t, (set.get(t) || 0) + 1);
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = notes.filter(n => {
      if (colorFilter && colorOf(n.color).key !== colorFilter) return false;
      if (tagFilter && !n.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q));
    });
    list = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === 'title') return a.title.localeCompare(b.title, 'fa');
      if (sort === 'created') return +new Date(b.createdAt) - +new Date(a.createdAt);
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    });
    return list;
  }, [notes, query, colorFilter, tagFilter, sort]);

  const selected = notes.find(n => n.id === selectedId) || null;

  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
      if (e.key === 'Escape') {
        if (composerOpen) setComposerOpen(false);
        else if (editing) setEditing(null);
        else if (selectedId) setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [composerOpen, editing, selectedId]);

  const handleTogglePin = async note => {
    setBusyId(note.id);
    try { await api(`/api/inbox/${note.id}`, { method: 'PATCH', body: JSON.stringify({ pinned: !note.pinned }) }); await load(); }
    catch (error) { setNotice(error.message); }
    setBusyId(null);
  };
  const handleDelete = async id => {
    if (!window.confirm('این یادداشت حذف شود؟')) return;
    setBusyId(id);
    try {
      await api(`/api/inbox/${id}`, { method: 'DELETE' });
      if (selectedId === id) setSelectedId(null);
      if (editing?.id === id) setEditing(null);
      await load();
    } catch (error) { setNotice(error.message); }
    setBusyId(null);
  };
  const handleEdit = note => {
    setEditing(note); setComposerOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleConvert = async (note, type) => {
    try { await api(`/api/inbox/${note.id}/convert`, { method: 'POST', body: JSON.stringify({ type, date: isoToday() }) }); setNotice('یادداشت تبدیل و بایگانی شد.'); setSelectedId(null); load(); }
    catch (error) { setNotice(error.message); }
  };

  const filtersOn = Boolean(colorFilter || tagFilter || query.trim());
  const sortLabel = sort === 'updated' ? 'آخرین ویرایش' : sort === 'created' ? 'تاریخ ایجاد' : 'عنوان';

  return (
    <main className="nd" dir="rtl">
      {Nav && <Nav active="notes" />}
      <header className="nd-mast">
        <div className="nd-mast-fade" />
        <div className="nd-mast-inner">
          <div>
            <div className="nd-mono nd-cyan nd-kicker"><span /> LifeOS — دفترچهٔ یادداشت</div>
            <h1>یادداشت‌ها</h1>
            <p>هر فکر رنگ خودش را دارد. یادداشت بنویس، برچسب بزن، سنجاق کن، فایل و عکس پیوست کن و در یک چشم‌به‌هم‌زدن پیداش کن.</p>
          </div>
          <div className="nd-mast-stats">
            {[{ k: 'کل یادداشت‌ها', v: notes.length }, { k: 'سنجاق‌شده', v: notes.filter(n => n.pinned).length }, { k: 'پیوست', v: notes.reduce((s, n) => s + n.attachments.length, 0) }].map(s => (
              <div key={s.k}><b>{faNum(s.v)}</b><span className="nd-mono nd-mute">{s.k}</span></div>
            ))}
            <button type="button" className="nd-save nd-mast-add" onClick={() => { setEditing(null); setComposerOpen(true); }}><Plus size={16} /> یادداشت تازه</button>
          </div>
        </div>
      </header>

      <div className="nd-workspace">
        {notice && <div className="notice">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}
        <div className="nd-grid">
          <div className={`nd-rail ${composerOpen ? 'open' : ''}`}>
            <div className="nd-rail-mobile">
              <span className="nd-mono nd-mute">COMPOSER</span>
              <button type="button" aria-label="بستن" onClick={() => setComposerOpen(false)}><X size={15} /></button>
            </div>
            <Composer editing={editing} onCloseEdit={() => setEditing(null)} onSaved={fresh => { setNotes(fresh); setEditing(null); setComposerOpen(false); }} />
          </div>

          <section className="nd-ledger">
            <div className="nd-toolbar">
              <div className="nd-tools">
                <div className="nd-search">
                  <Search size={16} />
                  <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} aria-label="جست‌وجو در یادداشت‌ها" placeholder="جست‌وجو در عنوان، متن و برچسب…  (Ctrl+K)" />
                  {query && <button type="button" aria-label="پاک کردن جست‌وجو" onClick={() => setQuery('')}><X size={14} /></button>}
                </div>
                <div className="nd-color-filter">
                  <button type="button" onClick={() => setColorFilter(null)} title="همهٔ رنگ‌ها" aria-pressed={colorFilter === null} className={colorFilter === null ? 'all on' : 'all'}>✓</button>
                  {COLORS.map(c => (
                    <button key={c.key} type="button" onClick={() => setColorFilter(colorFilter === c.key ? null : c.key)} title={c.label} aria-pressed={colorFilter === c.key}
                      style={{ background: c.hex, boxShadow: colorFilter === c.key ? `0 0 0 2px #071522, 0 0 0 3.5px ${c.hex}` : undefined, opacity: colorFilter && colorFilter !== c.key ? 0.35 : 1 }} />
                  ))}
                </div>
                <div className="nd-sort">
                  <button type="button" onClick={() => setSort('updated')} className={sort === 'updated' ? 'on' : ''}><ArrowDownUp size={12} /> {sortLabel}</button>
                  <button type="button" aria-label="تغییر مرتب‌سازی" onClick={() => setSort(sort === 'updated' ? 'created' : sort === 'created' ? 'title' : 'updated')}><SlidersHorizontal size={13} /></button>
                </div>
                <div className="nd-view">
                  <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} title="نمای فهرستی" className={view === 'list' ? 'on' : ''}><Rows3 size={14} /></button>
                  <button type="button" onClick={() => setView('grid')} aria-pressed={view === 'grid'} title="نمای شبکه‌ای" className={view === 'grid' ? 'on' : ''}><LayoutGrid size={14} /></button>
                </div>
              </div>
              <div className="nd-filter-row">
                <span className="nd-mono nd-mute">{faNum(visible.length)} / {faNum(notes.length)} RESULT</span>
                {tagFilter && <button type="button" className="nd-chip" onClick={() => setTagFilter(null)}>#{tagFilter}<X size={11} /></button>}
                {colorFilter && <button type="button" className="nd-chip" onClick={() => setColorFilter(null)} style={{ color: colorOf(colorFilter).hex }}>{colorOf(colorFilter).label}<X size={11} /></button>}
                {filtersOn && <button type="button" className="nd-clear" onClick={() => { setQuery(''); setColorFilter(null); setTagFilter(null); }}>پاک کردن همه</button>}
              </div>
              {allTags.length > 0 && <div className="nd-tag-bar">{allTags.slice(0, 14).map(([t, n]) => (
                <button key={t} type="button" className={tagFilter === t ? 'on' : ''} onClick={() => setTagFilter(tagFilter === t ? null : t)}>#{t}<em>{n}</em></button>
              ))}</div>}
            </div>

            {visible.length === 0 ? (
              <div className="nd-empty">
                <h3>{notes.length === 0 ? 'هنوز یادداشتی نداری' : 'چیزی پیدا نشد'}</h3>
                <p>{notes.length === 0 ? 'از ستون کناری اولین یادداشت را بنویس؛ رنگش را انتخاب کن و عکس پیوست کن.' : 'عبارت دیگری امتحان کن، یا فیلتر رنگ و برچسب را بردار.'}</p>
                {notes.length > 0 && <button type="button" className="nd-save ghost" onClick={() => { setQuery(''); setColorFilter(null); setTagFilter(null); }}>نمایش همهٔ یادداشت‌ها</button>}
              </div>
            ) : (
              <div className={view === 'grid' ? 'nd-cards grid' : 'nd-cards list'}>
                {visible.map(note => (
                  <NoteCard key={note.id} note={note} query={query} view={view} busy={busyId === note.id} selected={note.id === selectedId}
                    onSelect={id => setSelectedId(id === selectedId ? null : id)} onEdit={handleEdit} onTogglePin={handleTogglePin} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </section>

          <aside className="nd-aside">
            <Inspector note={selected} allNotes={notes} query={query} onClose={() => setSelectedId(null)} onEdit={handleEdit} onTogglePin={handleTogglePin} onDelete={handleDelete} onFocusTag={t => setTagFilter(t)} onConvert={handleConvert} />
          </aside>
        </div>
      </div>

      {selected && (
        <div className="nd-drawer" onClick={() => setSelectedId(null)}>
          <div onClick={e => e.stopPropagation()}>
            <Inspector note={selected} allNotes={notes} query={query} onClose={() => setSelectedId(null)} onEdit={handleEdit} onTogglePin={handleTogglePin} onDelete={handleDelete}
              onFocusTag={t => { setTagFilter(t); setSelectedId(null); }} onConvert={handleConvert} />
          </div>
        </div>
      )}

      <button type="button" className={`nd-fab ${composerOpen || selectedId ? 'hide' : ''}`} onClick={() => { setEditing(null); setComposerOpen(true); }} aria-label="یادداشت تازه"><Plus size={24} /></button>
    </main>
  );
}
