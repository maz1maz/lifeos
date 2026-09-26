import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, Eye, FolderOpen, LayoutGrid, List,
  Loader2, Pencil, Plus, Search, Star, Trash2, Upload, X
} from 'lucide-react';
import './documents.css';
import { JalaliDateInput } from './jdate';

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.');
  return body;
};

const DOC_TYPES = [
  'شناسنامه', 'کارت ملی', 'پاسپورت', 'گواهینامه رانندگی', 'سند ملک', 'سند خودرو',
  'مدرک تحصیلی', 'کارت پایان خدمت', 'بیمه', 'قرارداد', 'فیش حقوقی', 'گواهی اشتغال',
  'پرونده پزشکی', 'گذرنامه تحصیلی', 'سایر'
];
const CATEGORIES = ['عمومی', 'هویتی', 'مالی', 'ملکی', 'خودرو', 'تحصیلی', 'درمانی', 'شغلی', 'حقوقی', 'خانوادگی'];
const SORTS = [
  { v: 'newest', l: 'جدیدترین' },
  { v: 'oldest', l: 'قدیمی‌ترین' },
  { v: 'title', l: 'عنوان (الفبا)' },
  { v: 'expiry', l: 'نزدیک‌ترین انقضا' },
  { v: 'size', l: 'حجم فایل' }
];
const MAX_ATTACH = 12 * 1024 * 1024;
const faNum = n => { try { return Number(n || 0).toLocaleString('fa-IR'); } catch { return String(n); } };
const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function formatBytes(n) {
  if (!n || n <= 0) return 'بدون فایل';
  if (n < 1024) return `${faNum(n)} بایت`;
  if (n < 1024 * 1024) return `${faNum(Math.round(n / 102.4) / 10)} KB`;
  return `${faNum(Math.round(n / 10485.76) / 100)} MB`;
}
function fileKind(mime, name) {
  const m = (mime || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg|heic)$/.test(n)) return 'image';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  return 'other';
}
function expiryStatus(expiry) {
  if (!expiry) return null;
  const d = new Date(`${expiry}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const now = new Date(`${isoToday()}T00:00:00`);
  const days = Math.round((d - now) / 86400000);
  if (days < 0) return { tone: 'expired', text: `منقضی شده (${faNum(Math.abs(days))} روز پیش)`, days };
  if (days === 0) return { tone: 'warn', text: 'امروز منقضی می‌شود', days };
  if (days <= 90) return { tone: 'warn', text: `${faNum(days)} روز تا انقضا`, days };
  return { tone: 'ok', text: 'معتبر', days };
}
function toFaDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
  } catch { return iso; }
}
function parseTags(value) {
  if (Array.isArray(value)) return value.map(x => String(x).trim()).filter(Boolean);
  return String(value || '').split(/[،,#]+/).map(x => x.trim().replace(/^#/, '')).filter(Boolean);
}
function fromApi(c) {
  return {
    id: c.id,
    title: c.title || 'بدون عنوان',
    type: c.type || c.docType || 'سایر',
    category: c.category || 'عمومی',
    docNumber: c.docNumber || '',
    issueDate: c.issueDate || '',
    expiryDate: c.expiryDate || '',
    notes: c.notes || c.description || '',
    tags: parseTags(c.tags),
    favorite: !!c.favorite,
    fileUrl: c.fileUrl || '',
    fileName: c.fileName || '',
    fileMime: c.fileMime || '',
    fileSize: Number(c.fileSize || 0),
    createdAt: c.createdAt || 0
  };
}
const emptyForm = {
  title: '', type: 'کارت ملی', customType: '', category: 'هویتی', docNumber: '',
  issueDate: '', expiryDate: '', notes: '', tags: '', favorite: false
};
function payloadOf(form) {
  const type = form.type === 'سایر' && form.customType.trim() ? form.customType.trim() : form.type;
  return {
    title: form.title.trim(),
    type,
    category: form.category,
    docNumber: form.docNumber.trim(),
    issueDate: form.issueDate || null,
    expiryDate: form.expiryDate || null,
    notes: form.notes,
    tags: parseTags(form.tags),
    favorite: !!form.favorite
  };
}
function canAttach(file) {
  if (!file) return false;
  const kind = fileKind(file.type, file.name);
  return (kind === 'image' || kind === 'pdf') && file.size <= MAX_ATTACH;
}
function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
const Highlight = ({ text, query }) => {
  const q = (query || '').trim();
  if (!q) return text;
  const hay = String(text || '').toLowerCase(), needle = q.toLowerCase();
  const out = [];
  let i = 0, key = 0;
  const src = String(text || '');
  while (i < src.length) {
    const at = hay.indexOf(needle, i);
    if (at === -1) { out.push(src.slice(i)); break; }
    if (at > i) out.push(src.slice(i, at));
    out.push(<mark className="hit" key={key++}>{src.slice(at, at + needle.length)}</mark>);
    i = at + needle.length;
  }
  return out;
};

function Composer({ editing, onCloseEdit, onSaved, toast }) {
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [dragOn, setDragOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const titleRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!editing) { setForm(emptyForm); setFile(null); setError(''); return; }
    setForm({
      title: editing.title, type: DOC_TYPES.includes(editing.type) ? editing.type : 'سایر',
      customType: DOC_TYPES.includes(editing.type) ? '' : editing.type,
      category: CATEGORIES.includes(editing.category) ? editing.category : 'عمومی',
      docNumber: editing.docNumber, issueDate: editing.issueDate || '', expiryDate: editing.expiryDate || '',
      notes: editing.notes, tags: (editing.tags || []).join('، '), favorite: editing.favorite
    });
    setFile(null); setError('');
  }, [editing?.id]);

  const pick = f => {
    if (!f) return;
    if (f.size > MAX_ATTACH) { toast('حجم فایل حداکثر ۱۲ مگابایت است.', false); return; }
    setFile(f);
  };
  const submit = async e => {
    e.preventDefault();
    if (!form.title.trim()) { setError('عنوان مدرک الزامی است.'); titleRef.current?.focus(); return; }
    setBusy(true); setError('');
    try {
      const body = payloadOf(form);
      let saved;
      if (editing) saved = await api(`/api/documents/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else saved = await api('/api/documents', { method: 'POST', body: JSON.stringify(body) });
      if (file) {
        if (!canAttach(file)) toast('پیوست فعلی فقط تصویر یا PDF تا ۱۲ مگابایت است؛ مدرک بدون فایل ذخیره شد.', false);
        else {
          try {
            const dataUrl = await readDataUrl(file);
            await api(`/api/documents/${saved.id}/attach`, { method: 'POST', body: JSON.stringify({ file: dataUrl, fileName: file.name }) });
          } catch (err) { toast(err.message || 'پیوست ذخیره نشد؛ مدرک ثبت شد.', false); }
        }
      }
      const fresh = await api('/api/documents');
      onSaved((fresh.items || []).map(fromApi));
      setForm(emptyForm); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      toast(editing ? 'تغییرات ذخیره شد.' : `«${body.title}» ثبت شد.`);
    } catch (err) { setError(err.message || 'ذخیره‌سازی ناموفق بود.'); }
    finally { setBusy(false); }
  };

  return (
    <form className="dm-composer dm-glass" onSubmit={submit}>
      <div className="dm-composer-head">
        <h2>{editing ? 'ویرایش' : 'افزودن'}</h2>
        <span className="dm-badge">{editing ? 'به‌روزرسانی' : 'فرم جدید'}</span>
      </div>
      <div className="dm-form">
        <input ref={titleRef} value={form.title} onChange={e => set('title', e.target.value)} placeholder="عنوان *" maxLength={160} />
        <div className="dm-2col">
          <select value={form.type} onChange={e => set('type', e.target.value)}>{DOC_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <select value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(t => <option key={t}>{t}</option>)}</select>
        </div>
        {form.type === 'سایر' && <input value={form.customType} onChange={e => set('customType', e.target.value)} placeholder="نوع سفارشی سند…" />}
        <input value={form.docNumber} onChange={e => set('docNumber', e.target.value)} placeholder="شماره / شناسه سند" dir="ltr" />
        <div className="dm-2col">
          <label><span>تاریخ صدور</span><JalaliDateInput value={form.issueDate} onChange={v => set('issueDate', v)} /></label>
          <label><span>تاریخ انقضا</span><JalaliDateInput value={form.expiryDate} onChange={v => set('expiryDate', v)} /></label>
        </div>
        <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="برچسب‌ها (با ویرگول جدا کنید)" />
        <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="توضیحات" />
        <div
          className={`dm-drop ${dragOn ? 'on' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOn(true); }}
          onDragLeave={() => setDragOn(false)}
          onDrop={e => { e.preventDefault(); setDragOn(false); pick(e.dataTransfer.files?.[0]); }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={e => pick(e.target.files?.[0])} />
          {!file ? (
            <>
              <Upload size={22} />
              <b>انتخاب یا رها کردن فایل</b>
              <small>تصویر یا PDF · حداکثر ۱۲ مگابایت<br />روی Worker پیوست از طریق تلگرام ذخیره می‌شود</small>
            </>
          ) : (
            <div className="dm-file-picked" onClick={e => e.stopPropagation()}>
              <div>
                <p dir="ltr">{file.name}</p>
                <small>{formatBytes(file.size)} · {file.type || 'نامشخص'}</small>
              </div>
              <button type="button" className="dm-ghost" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>✕</button>
            </div>
          )}
        </div>
        <button type="button" className="dm-pin" onClick={() => set('favorite', !form.favorite)}>
          <span>★ افزودن به علاقه‌مندی‌ها</span>
          <input type="checkbox" checked={form.favorite} readOnly />
        </button>
        {error && <p className="dm-error">{error}</p>}
        <button type="submit" className="dm-save" disabled={busy}>{busy && <Loader2 size={16} className="spin" />}{busy ? 'در حال ذخیره…' : editing ? 'ذخیرهٔ تغییرات' : 'ذخیره'}</button>
        {editing ? <button type="button" className="dm-ghost" onClick={onCloseEdit}>انصراف</button> : <button type="button" className="dm-ghost" onClick={() => { setForm(emptyForm); setFile(null); }}>پاک کردن فرم</button>}
      </div>
    </form>
  );
}

function Detail({ doc, query, onClose, onEdit, onFav, onDelete }) {
  if (!doc) return null;
  const kind = fileKind(doc.fileMime, doc.fileName || doc.fileUrl);
  const exp = expiryStatus(doc.expiryDate);
  const src = doc.fileUrl ? `/api/documents/${doc.id}/file` : '';
  return (
    <div className="dm-modal" onClick={onClose}>
      <article className="dm-dialog dm-glass" onClick={e => e.stopPropagation()}>
        <div className="dm-dialog-head">
          <div>
            <div className="dm-mono dm-cyan">{doc.type}</div>
            <h2><Highlight text={doc.title} query={query} />{doc.favorite && <Star size={16} className="amber" fill="currentColor" />}</h2>
          </div>
          <button type="button" className="dm-ghost" onClick={onClose} aria-label="بستن"><X size={16} /></button>
        </div>
        {src && kind === 'image' && <div className="dm-preview"><img src={src} alt="" /></div>}
        {src && kind === 'pdf' && <div className="dm-preview"><iframe title="پیش‌نمایش PDF" src={src} /></div>}
        <div className="dm-fields">
          <div><b>نوع</b>{doc.type}</div>
          <div><b>دسته</b>{doc.category}</div>
          <div><b>شماره سند</b>{doc.docNumber ? <bdi dir="ltr">{doc.docNumber}</bdi> : '—'}</div>
          <div><b>صدور</b>{toFaDate(doc.issueDate)}</div>
          <div><b>انقضا</b>{exp ? <span className={`dm-exp ${exp.tone}`}>{exp.text}</span> : '—'}</div>
          <div><b>فایل</b>{doc.fileName || (doc.fileUrl ? 'پیوست' : 'بدون فایل')}{doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ''}</div>
        </div>
        {doc.tags.length > 0 && <div className="dm-meta" style={{ padding: '0 20px 12px' }}>{doc.tags.map(t => <span key={t}>#{t}</span>)}</div>}
        {doc.notes && <p className="dm-mute" style={{ padding: '0 20px 12px', whiteSpace: 'pre-wrap' }}>{doc.notes}</p>}
        <div className="dm-dialog-actions">
          {src && <a className="dm-save" href={src} target="_blank" rel="noreferrer"><Eye size={14} /> مشاهده</a>}
          {src && <a className="dm-ghost" href={src} download={doc.fileName || 'document'}><Download size={14} /></a>}
          <button type="button" className="dm-ghost" onClick={() => onFav(doc)}><Star size={14} fill={doc.favorite ? 'currentColor' : 'none'} /> علاقه</button>
          <button type="button" className="dm-save" onClick={() => onEdit(doc)}><Pencil size={14} /> ویرایش</button>
          <button type="button" className="dm-del" onClick={() => onDelete(doc)}><Trash2 size={14} /> حذف</button>
        </div>
      </article>
    </div>
  );
}

export function DocumentsReact({ Nav }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('همه');
  const [filterCat, setFilterCat] = useState('همه');
  const [favOnly, setFavOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [view, setView] = useState('list');
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState(null);
  const searchRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };
  const load = async () => {
    try { const data = await api('/api/documents'); setItems((data.items || []).map(fromApi)); }
    catch (e) { setNotice(e.message); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
      if (e.key === 'Escape') { setDetail(null); setEditing(null); setComposerOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter(d => {
      if (favOnly && !d.favorite) return false;
      if (filterType !== 'همه' && d.type !== filterType) return false;
      if (filterCat !== 'همه' && d.category !== filterCat) return false;
      if (!q) return true;
      return [d.title, d.type, d.category, d.docNumber, d.notes, d.fileName, ...(d.tags || [])].join(' ').toLowerCase().includes(q);
    });
    list = [...list];
    if (sortBy === 'oldest') list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    else if (sortBy === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'fa'));
    else if (sortBy === 'size') list.sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0));
    else if (sortBy === 'expiry') list.sort((a, b) => (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999'));
    else list.sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }, [items, query, filterType, filterCat, favOnly, sortBy]);

  const stats = useMemo(() => {
    let expiring = 0, expired = 0, size = 0, withFile = 0, fav = 0;
    items.forEach(d => {
      const st = expiryStatus(d.expiryDate);
      if (st?.tone === 'warn') expiring += 1;
      if (st?.tone === 'expired') expired += 1;
      size += d.fileSize || 0;
      if (d.fileUrl) withFile += 1;
      if (d.favorite) fav += 1;
    });
    return { total: items.length, fav, size, expiring, expired, withFile };
  }, [items]);

  const countBy = (key, cur) => {
    const m = new Map();
    items.forEach(d => { if (d[key]) m.set(d[key], (m.get(d[key]) || 0) + 1); });
    if (cur !== 'همه' && !m.has(cur)) m.set(cur, 0);
    return [['همه', items.length], ...[...m.entries()].sort((a, b) => b[1] - a[1])];
  };
  const usedTypes = useMemo(() => countBy('type', filterType), [items, filterType]);
  const usedCats = useMemo(() => countBy('category', filterCat), [items, filterCat]);
  const types = useMemo(() => {
    const s = new Set(DOC_TYPES);
    items.forEach(d => { if (d.type) s.add(d.type); });
    return ['همه', ...s];
  }, [items]);

  const handleFav = async d => {
    try {
      await api(`/api/documents/${d.id}`, { method: 'PATCH', body: JSON.stringify({ favorite: !d.favorite }) });
      setItems(list => list.map(x => x.id === d.id ? { ...x, favorite: !d.favorite } : x));
      setDetail(cur => cur?.id === d.id ? { ...cur, favorite: !d.favorite } : cur);
    } catch (e) { showToast(e.message, false); }
  };
  const handleDelete = async d => {
    if (!window.confirm(`«${d.title}» حذف شود؟`)) return;
    try {
      await api(`/api/documents/${d.id}`, { method: 'DELETE' });
      setItems(list => list.filter(x => x.id !== d.id));
      if (detail?.id === d.id) setDetail(null);
      if (editing?.id === d.id) setEditing(null);
      showToast('مدرک حذف شد.');
    } catch (e) { showToast(e.message, false); }
  };
  const handleEdit = d => {
    setEditing(d); setDetail(null); setComposerOpen(true);
    if (window.innerWidth < 980) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const KindMark = ({ doc }) => {
    const k = fileKind(doc.fileMime, doc.fileName || doc.fileUrl);
    return <span className={`dm-kind ${k}`}>{k === 'pdf' ? 'PDF' : k === 'image' ? 'IMG' : 'DOC'}</span>;
  };
  const RowMeta = ({ doc }) => {
    const exp = expiryStatus(doc.expiryDate);
    return (
      <>
        <p>{[doc.type, doc.category].filter(Boolean).join(' · ')}{doc.docNumber ? <>{doc.type || doc.category ? ' · ' : ''}<bdi dir="ltr">{doc.docNumber}</bdi></> : null}{!doc.type && !doc.category && !doc.docNumber ? '—' : null}</p>
        <div className="dm-meta">
          {doc.fileUrl && <span>پیوست</span>}
          {exp && <span className={`dm-exp ${exp.tone}`}>{exp.text}</span>}
          {doc.tags.slice(0, 3).map(t => <span key={t}>#{t}</span>)}
        </div>
      </>
    );
  };

  return (
    <main className="dm" dir="rtl">
      {Nav && <Nav active="documents" />}
      <div className="dm-page">
        <header className="dm-hero dm-glass">
          <div className="dm-hero-inner">
            <div>
              <div className="dm-mono dm-cyan">LifeOS — آرشیو مدارک</div>
              <h1>مدارک</h1>
              <p>آرشیو حرفه‌ای مدارک شخصی با نوع و دسته، شماره سند، تاریخ صدور و انقضا، برچسب، علاقه‌مندی، جستجو، پیش‌نمایش تصویر/PDF و یادآور تمدید.</p>
              <div className="dm-hero-chips">
                <span className="dm-chip">📦 {faNum(stats.total)} مدرک</span>
                <span className="dm-chip">★ {faNum(stats.fav)} علاقه‌مندی</span>
                <span className="dm-chip">💾 {formatBytes(stats.size)}</span>
                {stats.expired > 0 && <span className="dm-chip bad">⚠ {faNum(stats.expired)} منقضی‌شده</span>}
                {stats.expiring > 0 && <span className="dm-chip warn">⏳ {faNum(stats.expiring)} رو به انقضا</span>}
                <button type="button" className="dm-ghost" onClick={load}>↻ به‌روزرسانی</button>
              </div>
            </div>
            <div className="dm-hero-kpis">
              <div className="dm-kpi dm-glass"><b>{faNum(stats.total)}</b><small>کل مدارک</small></div>
              <div className="dm-kpi dm-glass"><b className="dm-cyan">{faNum(stats.withFile)}</b><small>دارای فایل پیوست</small></div>
            </div>
          </div>
        </header>

        <div className="dm-stats">
          {[
            { t: 'علاقه‌مندی‌ها', v: faNum(stats.fav), s: 'ستاره‌دارها', i: '★' },
            { t: 'حجم آرشیو', v: formatBytes(stats.size), s: 'مجموع پیوست‌ها', i: '◍' },
            { t: 'رو به انقضا', v: faNum(stats.expiring), s: 'کمتر از ۹۰ روز', i: '◷' },
            { t: 'منقضی‌شده', v: faNum(stats.expired), s: 'نیاز به تمدید', i: '⚠' }
          ].map(k => (
            <div key={k.t} className="dm-stat dm-glass">
              <span className="dm-stat-ic">{k.i}</span>
              <div><small>{k.t}</small><b>{k.v}</b><small>{k.s}</small></div>
            </div>
          ))}
        </div>

        {notice && <div className="notice">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}

        <div className="dm-layout">
          <div className={`dm-rail ${composerOpen ? 'open' : ''}`}>
            <Composer
              editing={editing}
              onCloseEdit={() => setEditing(null)}
              onSaved={fresh => { setItems(fresh); setEditing(null); setComposerOpen(false); }}
              toast={showToast}
            />
          </div>

          <section className="dm-list dm-glass">
            <div className="dm-list-head">
              <h2>فهرست</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="dm-badge">{faNum(visible.length)} مورد</span>
                <div className="dm-view">
                  <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List size={13} /> لیست</button>
                  <button type="button" className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}><LayoutGrid size={13} /> گرید</button>
                </div>
              </div>
            </div>
            <div className="dm-tools">
              <div className="dm-search">
                <Search size={15} />
                <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="جستجو در عنوان، نوع، شماره، برچسب…  (Ctrl+K)" />
                {query && <button type="button" onClick={() => setQuery('')} aria-label="پاک کردن"><X size={14} /></button>}
              </div>
              <select className={filterType !== 'همه' ? 'on' : ''} value={filterType} onChange={e => setFilterType(e.target.value)} aria-label="نوع">{usedTypes.map(([t, n]) => <option key={t} value={t}>{t === 'همه' ? 'همهٔ انواع' : `${t} (${faNum(n)})`}</option>)}</select>
              <select className={filterCat !== 'همه' ? 'on' : ''} value={filterCat} onChange={e => setFilterCat(e.target.value)} aria-label="دسته">{usedCats.map(([t, n]) => <option key={t} value={t}>{t === 'همه' ? 'همهٔ دسته‌ها' : `${t} (${faNum(n)})`}</option>)}</select>
              {(filterType !== 'همه' || filterCat !== 'همه') && <button type="button" className="dm-fav-btn" onClick={() => { setFilterType('همه'); setFilterCat('همه'); }}><X size={14} /> حذف فیلتر</button>}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}>{SORTS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}</select>
              <button type="button" className={`dm-fav-btn ${favOnly ? 'on' : ''}`} onClick={() => setFavOnly(v => !v)}><Star size={14} /> علاقه</button>
            </div>

            {visible.length === 0 ? (
              <div className="dm-empty">
                <FolderOpen size={28} />
                <h3>{items.length === 0 ? 'آرشیو خالی است' : 'چیزی پیدا نشد'}</h3>
                <p>{items.length === 0 ? 'اولین مدرک را از فرم کناری ثبت کن.' : 'عبارت یا فیلتر را عوض کن.'}</p>
              </div>
            ) : view === 'grid' ? (
              <div className="dm-grid">
                {visible.map(doc => {
                  const kind = fileKind(doc.fileMime, doc.fileName || doc.fileUrl);
                  return (
                    <article key={doc.id} className="dm-card" onClick={() => setDetail(doc)}>
                      <div className="dm-card-top">
                        <KindMark doc={doc} />
                        <button type="button" className={`dm-ghost ${doc.favorite ? 'amber' : ''}`} onClick={e => { e.stopPropagation(); handleFav(doc); }}><Star size={14} fill={doc.favorite ? 'currentColor' : 'none'} /></button>
                      </div>
                      {kind === 'image' && doc.fileUrl ? <img className="dm-thumb" src={`/api/documents/${doc.id}/file`} alt="" /> : <div className="dm-thumb" />}
                      <h3><Highlight text={doc.title} query={query} /></h3>
                      <RowMeta doc={doc} />
                    </article>
                  );
                })}
              </div>
            ) : (
              <ul className="dm-rows">
                {visible.map(doc => (
                  <li key={doc.id}>
                    <article className="dm-row" onClick={() => setDetail(doc)}>
                      <KindMark doc={doc} />
                      <div>
                        <h3><Highlight text={doc.title} query={query} />{doc.favorite && <Star size={12} fill="currentColor" />}</h3>
                        <RowMeta doc={doc} />
                      </div>
                      <div className="dm-ops" onClick={e => e.stopPropagation()}>
                        {doc.fileUrl && <button type="button" title="پیش‌نمایش" onClick={() => setDetail(doc)}><Eye size={14} /></button>}
                        <button type="button" className={doc.favorite ? 'amber' : ''} title="علاقه" onClick={() => handleFav(doc)}><Star size={14} fill={doc.favorite ? 'currentColor' : 'none'} /></button>
                        <button type="button" title="ویرایش" onClick={() => handleEdit(doc)}><Pencil size={14} /></button>
                        <button type="button" title="حذف" onClick={() => handleDelete(doc)}><Trash2 size={14} /></button>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <Detail doc={detail} query={query} onClose={() => setDetail(null)} onEdit={handleEdit} onFav={handleFav} onDelete={handleDelete} />
      {toast && <div className={`dm-toast ${toast.ok ? '' : 'bad'}`}>{toast.msg}</div>}
      <button type="button" className="dm-fab" onClick={() => { setEditing(null); setComposerOpen(true); }} aria-label="مدرک تازه"><Plus size={24} /></button>
    </main>
  );
}
