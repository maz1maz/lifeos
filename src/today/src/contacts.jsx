import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cake, CalendarClock, Mail, MessageCircle, Phone, PhoneCall,
  Plus, Search, Star, Trash2, Users, X, Loader2, Upload, Filter
} from 'lucide-react';
import './contacts.css';
import { jalaliShort } from './jalali';

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.');
  return body;
};

const REL = {
  family: { key: 'family', label: 'خانواده', hex: '#FB7185', wash: 'rgba(251,113,133,0.12)' },
  friend: { key: 'friend', label: 'دوست', hex: '#38BDF8', wash: 'rgba(56,189,248,0.12)' },
  work: { key: 'work', label: 'کاری', hex: '#A78BFA', wash: 'rgba(167,139,250,0.12)' },
  other: { key: 'other', label: 'سایر', hex: '#34D399', wash: 'rgba(52,211,153,0.12)' }
};
const REL_ALIAS = { colleague: 'work', client: 'work' };
const relOf = k => REL[REL_ALIAS[k] || k] || REL.friend;
const REL_KEYS = Object.keys(REL);

const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const faNum = n => { try { return Number(n || 0).toLocaleString('fa-IR'); } catch { return String(n); } };
const FA_LETTERS = 'آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی';
const letterOf = name => {
  const ch = String(name || '').trim().charAt(0);
  if (!ch) return '#';
  if (/[A-Za-z]/.test(ch)) return ch.toUpperCase();
  const i = FA_LETTERS.indexOf(ch);
  if (i >= 0) return FA_LETTERS[i];
  if (ch === 'ا' || ch === 'أ' || ch === 'إ' || ch === 'ء') return 'آ';
  return '#';
};
const hueOf = name => {
  let h = 0;
  for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 180 + (h % 80);
};
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
const LOG_TYPES = [
  { key: 'call', label: 'تماس' },
  { key: 'meeting', label: 'ملاقات' },
  { key: 'message', label: 'پیام' },
  { key: 'other', label: 'سایر' }
];
// Contacts may store several numbers in one string, separated by one of ·|,;/ —
// matches the backend dedupe split in server.js (`(c.phone||'').split(/[·|,;/]/)[0]`).
// New entries are joined with ' · ', the house-style bullet separator used across LifeOS.
const PHONE_SPLIT_RE = /[·|,;/]/;
const splitPhones = phone => String(phone || '').split(PHONE_SPLIT_RE).map(x => x.trim()).filter(Boolean);
const joinPhones = list => (list || []).map(x => String(x || '').trim()).filter(Boolean).join(' · ');
const telHref = phone => {
  const first = splitPhones(phone)[0] || '';
  const d = first.replace(/[^\d+]/g, '');
  return d ? `tel:${d}` : null;
};
const smsHref = phone => {
  const first = splitPhones(phone)[0] || '';
  const d = first.replace(/[^\d+]/g, '');
  return d ? `sms:${d}` : null;
};
const daysUntil = iso => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const today = isoToday();
  const mmdd = String(iso).slice(5, 10);
  let next = `${today.slice(0, 4)}-${mmdd}`;
  if (next < today) next = `${Number(today.slice(0, 4)) + 1}-${mmdd}`;
  const a = new Date(`${today}T12:00:00`), b = new Date(`${next}T12:00:00`);
  return Math.round((b - a) / 86400000);
};

function fromApi(c) {
  return {
    id: c.id,
    name: c.name || 'بدون نام',
    relationship: REL_ALIAS[c.relationship] || c.relationship || 'friend',
    phone: c.phone || '',
    email: c.email || '',
    birthday: c.birthday || '',
    followUpDate: c.followUpDate || '',
    notes: c.notes || '',
    company: c.company || '',
    jobTitle: c.jobTitle || '',
    favorite: !!c.favorite,
    tags: Array.isArray(c.tags) ? c.tags : [],
    lastContactDate: c.lastContactDate || '',
    createdAt: c.createdAt
  };
}

function Composer({ editing, onCloseEdit, onSaved }) {
  const empty = { name: '', relationship: 'friend', phones: [''], email: '', birthday: '', followUpDate: '', notes: '', company: '', jobTitle: '', favorite: false, tags: [] };
  const [form, setForm] = useState(empty);
  const [tagDraft, setTagDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setPhoneAt = (i, v) => setForm(f => { const phones = [...f.phones]; phones[i] = v; return { ...f, phones }; });
  const addPhoneRow = () => setForm(f => (f.phones.length >= 5 ? f : { ...f, phones: [...f.phones, ''] }));
  const removePhoneRow = i => setForm(f => {
    if (f.phones.length <= 1) return { ...f, phones: [''] };
    return { ...f, phones: f.phones.filter((_, idx) => idx !== i) };
  });

  useEffect(() => {
    if (!editing) { setForm(empty); setTagDraft(''); setError(''); return; }
    const phones = splitPhones(editing.phone);
    setForm({
      name: editing.name, relationship: editing.relationship, phones: phones.length ? phones : [''], email: editing.email,
      birthday: editing.birthday || '', followUpDate: editing.followUpDate || '', notes: editing.notes,
      company: editing.company, jobTitle: editing.jobTitle, favorite: editing.favorite, tags: editing.tags
    });
    setError('');
  }, [editing?.id]);

  const addTag = raw => {
    const value = raw.trim().replace(/^#/, '');
    if (!value) return;
    setForm(f => f.tags.includes(value) || f.tags.length >= 8 ? f : { ...f, tags: [...f.tags, value] });
    setTagDraft('');
  };

  const submit = async e => {
    e.preventDefault();
    if (!form.name.trim()) { setError('نام مخاطب را بنویسید.'); nameRef.current?.focus(); return; }
    setBusy(true); setError('');
    try {
      const payload = {
        name: form.name.trim(), relationship: form.relationship, phone: joinPhones(form.phones), email: form.email.trim(),
        birthday: form.birthday || null, followUpDate: form.followUpDate || null, notes: form.notes,
        company: form.company.trim().slice(0, 80), jobTitle: form.jobTitle.trim().slice(0, 80),
        favorite: !!form.favorite, tags: form.tags
      };
      if (editing) await api(`/api/contacts/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/api/contacts', { method: 'POST', body: JSON.stringify(payload) });
      const fresh = await api('/api/contacts');
      onSaved((fresh.items || []).map(fromApi));
      setForm(empty);
    } catch (err) { setError(err.message || 'ذخیره‌سازی ناموفق بود.'); }
    finally { setBusy(false); }
  };

  const rel = relOf(form.relationship);
  return (
    <form onSubmit={submit} className="pb-composer">
      <div className="pb-composer-line" style={{ background: `linear-gradient(90deg, transparent, ${rel.hex}, transparent)` }} />
      <div className="pb-composer-head">
        <div>
          <div className="pb-mono pb-cyan">{editing ? 'EDIT / ویرایش' : 'NEW / مخاطب تازه'}</div>
          <h2>{editing ? 'ویرایش کارت' : 'افزودن مخاطب'}</h2>
        </div>
        <span className="pb-avatar sm" style={{ background: `hsl(${hueOf(form.name || 'ن')} 45% 28%)` }}>{(form.name || '؟').trim().charAt(0)}</span>
      </div>
      <div className="pb-composer-body">
        <label className="pb-mono pb-mute">NAME / نام</label>
        <input ref={nameRef} value={form.name} onChange={e => set('name', e.target.value)} placeholder="نام و نام خانوادگی" maxLength={60} />
        <label className="pb-mono pb-mute">GROUP / نسبت</label>
        <div className="pb-rel-row">
          {REL_KEYS.map(k => {
            const r = REL[k];
            return <button key={k} type="button" className={form.relationship === k ? 'on' : ''} onClick={() => set('relationship', k)} style={form.relationship === k ? { borderColor: r.hex, color: r.hex } : undefined}>{r.label}</button>;
          })}
        </div>
        <label className="pb-mono pb-mute">PHONE / تلفن</label>
        <div className="pb-phone-rows">
          {form.phones.map((p, i) => (
            <div className="pb-phone-row" key={i}>
              <input value={p} onChange={e => setPhoneAt(i, e.target.value)} placeholder="۰۹۱۲…" dir="ltr" />
              <button type="button" className="pb-phone-del" onClick={() => removePhoneRow(i)} aria-label="حذف این شماره">×</button>
            </div>
          ))}
        </div>
        {form.phones.length < 5 && <button type="button" className="pb-ghost pb-phone-add" onClick={addPhoneRow}>+ شماره جدید</button>}
        <label className="pb-mono pb-mute">EMAIL / ایمیل</label>
        <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@mail.com" dir="ltr" />
        <div className="pb-2col">
          <div><label className="pb-mono pb-mute">COMPANY / شرکت</label><input value={form.company} onChange={e => set('company', e.target.value)} placeholder="سازمان" /></div>
          <div><label className="pb-mono pb-mute">TITLE / سمت</label><input value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="عنوان شغلی" /></div>
        </div>
        <div className="pb-2col">
          <div><label className="pb-mono pb-mute">BIRTHDAY / تولد</label><input type="date" value={form.birthday} onChange={e => set('birthday', e.target.value)} /></div>
          <div><label className="pb-mono pb-mute">FOLLOW-UP / پیگیری</label><input type="date" value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} /></div>
        </div>
        <label className="pb-mono pb-mute">TAGS / برچسب</label>
        <div className="pb-tag-input">
          {form.tags.map(t => <span key={t} className="pb-tag-chip">#{t}<button type="button" aria-label={`حذف ${t}`} onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}><X size={12} /></button></span>)}
          <input value={tagDraft} onChange={e => setTagDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagDraft); } }} onBlur={() => addTag(tagDraft)} placeholder={form.tags.length ? '' : 'Enter برای برچسب'} />
        </div>
        <button type="button" className={`pb-pin-toggle ${form.favorite ? 'on' : ''}`} onClick={() => set('favorite', !form.favorite)} aria-pressed={form.favorite}>
          <span><Star size={15} /> علاقه‌مندی — دسترسی سریع</span>
          <span className={`pb-switch ${form.favorite ? 'on' : ''}`}><i /></span>
        </button>
        <label className="pb-mono pb-mute">NOTES / یادداشت</label>
        <textarea rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="نکتهٔ شخصی…" />
        {error && <p className="pb-error">{error}</p>}
        <div className="pb-composer-actions">
          <button type="submit" disabled={busy} className="pb-save">{busy && <Loader2 size={16} className="spin" />}{busy ? 'در حال ذخیره…' : editing ? 'به‌روزرسانی' : 'ذخیره کارت'}</button>
          {editing && <button type="button" className="pb-cancel" onClick={onCloseEdit}>انصراف</button>}
        </div>
      </div>
    </form>
  );
}

function Inspector({ contact, all, query, logs, onClose, onEdit, onFav, onDelete, onLog, onFocusRel }) {
  if (!contact) {
    const byRel = REL_KEYS.map(k => ({ ...REL[k], count: all.filter(c => c.relationship === k).length }));
    const due = all.filter(c => c.followUpDate && c.followUpDate <= isoToday()).length;
    const bdays = all.filter(c => { const d = daysUntil(c.birthday); return d != null && d <= 14; }).length;
    const max = Math.max(1, ...byRel.map(r => r.count));
    return (
      <div className="pb-inspector idle">
        <div className="pb-mono pb-cyan">DIRECTORY / نمای کلی</div>
        <div className="pb-stat-grid">
          {[{ k: 'مخاطب', v: all.length }, { k: 'علاقه', v: all.filter(c => c.favorite).length }, { k: 'پیگیری', v: due }].map(s => (
            <div key={s.k}><b>{faNum(s.v)}</b><small>{s.k}</small></div>
          ))}
        </div>
        <div className="pb-mono pb-mute">GROUPS / نسبت‌ها</div>
        <ul className="pb-bars">{byRel.map(r => (
          <li key={r.key}><button type="button" onClick={() => onFocusRel(r.key)}>{r.label}</button><span className="pb-bar"><i style={{ width: `${Math.round((r.count / max) * 100)}%`, background: r.hex }} /></span><em>{r.count}</em></li>
        ))}</ul>
        {bdays > 0 && <p className="pb-hint">🎂 {faNum(bdays)} تولد در دو هفتهٔ آینده.</p>}
        <p className="pb-hint">یک کارت را از فهرست انتخاب کن تا تماس بگیری، پیگیری ثبت کنی یا لاگ بگذاری.<br /><span>Ctrl</span> + <span>K</span> جست‌وجو · <span>Esc</span> بستن</p>
      </div>
    );
  }
  const r = relOf(contact.relationship);
  const bday = daysUntil(contact.birthday);
  const followDue = contact.followUpDate && contact.followUpDate <= isoToday();
  const call = telHref(contact.phone);
  const sms = smsHref(contact.phone);
  return (
    <article className="pb-inspector open">
      <div className="pb-insp-head" style={{ background: `linear-gradient(160deg, ${r.hex}26, transparent 65%)` }}>
        <div className="pb-insp-top">
          <span className="pb-mono" style={{ color: r.hex }}>CARD / {r.label}</span>
          <button type="button" onClick={onClose} aria-label="بستن"><X size={14} /></button>
        </div>
        <div className="pb-insp-id">
          <span className="pb-avatar lg" style={{ background: `hsl(${hueOf(contact.name)} 45% 28%)`, boxShadow: `0 0 28px -8px ${r.hex}` }}>{contact.name.charAt(0)}</span>
          <div>
            <h2><Highlight text={contact.name} query={query} /></h2>
            <p>{[contact.jobTitle, contact.company].filter(Boolean).join(' · ') || r.label}</p>
          </div>
        </div>
        <div className="pb-quick">
          {call && <a href={call} title="تماس"><Phone size={16} /></a>}
          {sms && <a href={sms} title="پیامک"><MessageCircle size={16} /></a>}
          {contact.email && <a href={`mailto:${contact.email}`} title="ایمیل"><Mail size={16} /></a>}
          <button type="button" className={contact.favorite ? 'amber' : ''} onClick={() => onFav(contact)} title="علاقه"><Star size={16} fill={contact.favorite ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
      <div className="pb-insp-body">
        {contact.phone && (
          <p className="pb-field" dir="ltr">
            <Phone size={13} />
            {splitPhones(contact.phone).map((p, i, arr) => (
              <React.Fragment key={i}>
                <a className="pb-phone-link" href={telHref(p)}>{p}</a>
                {i < arr.length - 1 && <span className="pb-mute"> · </span>}
              </React.Fragment>
            ))}
          </p>
        )}
        {contact.email && <p className="pb-field" dir="ltr"><Mail size={13} /> {contact.email}</p>}
        {contact.birthday && <p className="pb-field"><Cake size={13} /> تولد {jalaliShort(contact.birthday)}{bday != null ? (bday === 0 ? ' · امروز!' : ` · ${faNum(bday)} روز دیگر`) : ''}</p>}
        {contact.followUpDate && <p className={`pb-field ${followDue ? 'due' : ''}`}><CalendarClock size={13} /> پیگیری {jalaliShort(contact.followUpDate)}{followDue ? ' · سررسید گذشته' : ''}</p>}
        {contact.lastContactDate && <p className="pb-field"><PhoneCall size={13} /> آخرین تماس {jalaliShort(contact.lastContactDate)}</p>}
        {contact.tags.length > 0 && <div className="pb-tags">{contact.tags.map(t => <span key={t} style={{ color: r.hex, borderColor: `${r.hex}55`, background: r.wash }}>#{t}</span>)}</div>}
        {contact.notes && <p className="pb-notes">{contact.notes}</p>}

        <div className="pb-mono pb-mute">LOG / ثبت تعامل</div>
        <LogForm onSubmit={body => onLog(contact, body)} />
        <ul className="pb-logs">
          {(logs || []).length === 0 && <li className="pb-mute">هنوز تعاملی ثبت نشده.</li>}
          {(logs || []).map(l => <li key={l.id}><b>{LOG_TYPES.find(t => t.key === l.type)?.label || l.type}</b><span>{jalaliShort(l.date)}</span>{l.note && <p>{l.note}</p>}</li>)}
        </ul>
        <div className="pb-insp-actions">
          <button type="button" className="pb-save" onClick={() => onEdit(contact)}>ویرایش</button>
          <button type="button" onClick={() => onDelete(contact)} aria-label="حذف"><Trash2 size={15} /></button>
        </div>
      </div>
    </article>
  );
}

function LogForm({ onSubmit }) {
  const [type, setType] = useState('call');
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ type, note, date: isoToday(), nextFollowUp: next || undefined });
      setNote(''); setNext('');
    } finally { setBusy(false); }
  };
  return (
    <form className="pb-log-form" onSubmit={send}>
      <select value={type} onChange={e => setType(e.target.value)}>{LOG_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="یادداشت کوتاه" />
      <input type="date" value={next} onChange={e => setNext(e.target.value)} title="پیگیری بعدی" />
      <button type="submit" disabled={busy}>{busy ? '…' : 'ثبت'}</button>
    </form>
  );
}

export function ContactsReact({ Nav }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [relFilter, setRelFilter] = useState(null);
  const [onlyFav, setOnlyFav] = useState(false);
  const [letter, setLetter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [notice, setNotice] = useState('');
  const [okNotice, setOkNotice] = useState('');
  const searchRef = useRef(null);
  const fileRef = useRef(null);

  const load = async () => {
    try { const data = await api('/api/contacts'); setItems((data.items || []).map(fromApi)); }
    catch (e) { setNotice(e.message); }
  };
  useEffect(() => { load(); }, []);

  const selected = items.find(c => c.id === selectedId) || null;
  useEffect(() => {
    if (!selectedId) { setLogs([]); return; }
    api(`/api/contacts/${selectedId}/log`).then(d => setLogs(d.items || [])).catch(() => setLogs([]));
  }, [selectedId]);

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter(c => {
      if (relFilter && c.relationship !== relFilter) return false;
      if (onlyFav && !c.favorite) return false;
      if (letter && letterOf(c.name) !== letter) return false;
      if (!q) return true;
      return [c.name, c.phone, c.email, c.company, c.jobTitle, c.notes, ...(c.tags || [])].join(' ').toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || a.name.localeCompare(b.name, 'fa'));
    return list;
  }, [items, query, relFilter, onlyFav, letter]);

  const letters = useMemo(() => {
    const set = new Set(items.map(c => letterOf(c.name)));
    return [...set].sort((a, b) => a.localeCompare(b, 'fa'));
  }, [items]);

  const handleFav = async c => {
    try { await api(`/api/contacts/${c.id}`, { method: 'PATCH', body: JSON.stringify({ favorite: !c.favorite }) }); load(); }
    catch (e) { setNotice(e.message); }
  };
  const handleDelete = async c => {
    if (!window.confirm(`«${c.name}» حذف شود؟`)) return;
    try {
      await api(`/api/contacts/${c.id}`, { method: 'DELETE' });
      if (selectedId === c.id) setSelectedId(null);
      if (editing?.id === c.id) setEditing(null);
      load();
    } catch (e) { setNotice(e.message); }
  };
  const handleLog = async (c, body) => {
    await api(`/api/contacts/${c.id}/log`, { method: 'POST', body: JSON.stringify(body) });
    const [fresh, lg] = await Promise.all([api('/api/contacts'), api(`/api/contacts/${c.id}/log`)]);
    setItems((fresh.items || []).map(fromApi));
    setLogs(lg.items || []);
  };
  const handleEdit = c => {
    setEditing(c); setComposerOpen(true);
    if (window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const importCsv = async file => {
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return;
    const split = row => {
      const out = []; let cur = '', q = false;
      for (const ch of row) {
        if (ch === '"') { q = !q; continue; }
        if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
        cur += ch;
      }
      out.push(cur);
      return out.map(x => x.trim());
    };
    const header = split(lines[0]).map(h => h.toLowerCase());
    const idx = name => header.findIndex(h => h.includes(name));
    const ni = idx('name') >= 0 ? idx('name') : (idx('نام') >= 0 ? idx('نام') : 0);
    const pi = idx('phone') >= 0 ? idx('phone') : (idx('tel') >= 0 ? idx('tel') : 1);
    const ei = idx('email') >= 0 ? idx('email') : 2;
    const rows = lines.slice(1).map(line => {
      const cols = split(line);
      return { name: cols[ni] || '', phone: cols[pi] || '', email: cols[ei] || '', relationship: 'friend' };
    }).filter(r => r.name);
    try {
      const res = await api('/api/contacts/import', { method: 'POST', body: JSON.stringify({ items: rows, mode: 'skip' }) });
      setOkNotice(`${faNum(res.ok || res.count || 0)} مخاطب وارد شد${res.skipped ? ` · ${faNum(res.skipped)} تکراری رد شد` : ''}.`);
      load();
    } catch (e) { setNotice(e.message); }
  };
  const dedupe = async () => {
    if (!window.confirm('مخاطب‌های تکراری ادغام/حذف شوند؟')) return;
    try {
      const res = await api('/api/contacts/dedupe', { method: 'POST', body: JSON.stringify({}) });
      setOkNotice(`${faNum(res.removed || 0)} مورد تکراری پاک شد.`);
      load();
    } catch (e) { setNotice(e.message); }
  };
  const junk = async () => {
    if (!window.confirm('مخاطب‌هایی که شبیه نام واقعی نیستند (ایمپورت خراب) پاک شوند؟')) return;
    try {
      const res = await api('/api/contacts/dedupe', { method: 'POST', body: JSON.stringify({ junk: true }) });
      setOkNotice(`${faNum(res.removed || 0)} مورد نامعتبر پاک شد.`);
      load();
    } catch (e) { setNotice(e.message); }
  };

  const dueFollow = items.filter(c => c.followUpDate && c.followUpDate <= isoToday());
  const filtersOn = Boolean(relFilter || onlyFav || letter || query.trim());

  return (
    <main className="pb" dir="rtl">
      {Nav && <Nav active="contacts" />}
      <header className="pb-mast">
        <div className="pb-mast-inner">
          <div>
            <div className="pb-mono pb-cyan pb-kicker"><span /> LifeOS — دفترچهٔ مخاطبین</div>
            <h1>مخاطبین</h1>
            <p>کارت حرفه‌ای برای هر نفر: تماس سریع، نسبت، تولد، پیگیری و تاریخچهٔ تعامل — همه روی دادهٔ واقعی LifeOS.</p>
          </div>
          <div className="pb-mast-stats">
            {[{ k: 'کل کارت‌ها', v: items.length }, { k: 'علاقه', v: items.filter(c => c.favorite).length }, { k: 'پیگیری باز', v: dueFollow.length }].map(s => (
              <div key={s.k}><b>{faNum(s.v)}</b><span className="pb-mono pb-mute">{s.k}</span></div>
            ))}
            <button type="button" className="pb-save pb-mast-add" onClick={() => { setEditing(null); setComposerOpen(true); }}><Plus size={16} /> مخاطب تازه</button>
          </div>
        </div>
      </header>

      <div className="pb-workspace">
        {notice && <div className="notice">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}
        {okNotice && <div className="notice ok">{okNotice}<button type="button" onClick={() => setOkNotice('')}>×</button></div>}
        <div className="pb-grid">
          <div className={`pb-rail ${composerOpen ? 'open' : ''}`}>
            <div className="pb-rail-mobile">
              <span className="pb-mono pb-mute">COMPOSER</span>
              <button type="button" aria-label="بستن" onClick={() => setComposerOpen(false)}><X size={15} /></button>
            </div>
            <Composer editing={editing} onCloseEdit={() => setEditing(null)} onSaved={fresh => { setItems(fresh); setEditing(null); setComposerOpen(false); }} />
          </div>

          <section className="pb-ledger">
            <div className="pb-toolbar">
              <div className="pb-tools">
                <div className="pb-search">
                  <Search size={16} />
                  <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="جست‌وجو در نام، تلفن، شرکت، برچسب…  (Ctrl+K)" aria-label="جست‌وجو" />
                  {query && <button type="button" onClick={() => setQuery('')} aria-label="پاک کردن"><X size={14} /></button>}
                </div>
                <button type="button" className={`pb-fav-btn ${onlyFav ? 'on' : ''}`} onClick={() => setOnlyFav(v => !v)}><Star size={14} /> علاقه</button>
                <button type="button" className="pb-ghost" onClick={() => fileRef.current?.click()}><Upload size={14} /> CSV</button>
                <button type="button" className="pb-ghost" onClick={dedupe}><Filter size={14} /> تکراری‌ها</button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={e => { void importCsv(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <div className="pb-rel-filter">
                <button type="button" className={!relFilter ? 'on' : ''} onClick={() => setRelFilter(null)}>همه</button>
                {REL_KEYS.map(k => <button key={k} type="button" className={relFilter === k ? 'on' : ''} onClick={() => setRelFilter(relFilter === k ? null : k)} style={relFilter === k ? { color: REL[k].hex } : undefined}>{REL[k].label}</button>)}
              </div>
              {letters.length > 1 && (
                <div className="pb-az" aria-label="فهرست الفبایی">
                  {letters.map(L => <button key={L} type="button" className={letter === L ? 'on' : ''} onClick={() => setLetter(letter === L ? null : L)}>{L}</button>)}
                </div>
              )}
              <div className="pb-filter-row">
                <span className="pb-mono pb-mute">{faNum(visible.length)} / {faNum(items.length)} CARD</span>
                {filtersOn && <button type="button" className="pb-clear" onClick={() => { setQuery(''); setRelFilter(null); setOnlyFav(false); setLetter(null); }}>پاک کردن فیلتر</button>}
              </div>
            </div>

            {items.filter(c => c.favorite).length > 0 && !onlyFav && !query && (
              <div className="pb-fav-strip">
                {items.filter(c => c.favorite).slice(0, 12).map(c => (
                  <button type="button" key={c.id} onClick={() => setSelectedId(c.id)} title={c.name}>
                    <span className="pb-avatar" style={{ background: `hsl(${hueOf(c.name)} 45% 28%)` }}>{c.name.charAt(0)}</span>
                    <small>{c.name.split(' ')[0]}</small>
                  </button>
                ))}
              </div>
            )}

            {visible.length === 0 ? (
              <div className="pb-empty">
                <Users size={28} />
                <h3>{items.length === 0 ? 'دفترچه خالی است' : 'چیزی پیدا نشد'}</h3>
                <p>{items.length === 0 ? 'اولین مخاطب را از ستون کناری بساز، یا یک CSV وارد کن.' : 'عبارت یا فیلتر را عوض کن.'}</p>
              </div>
            ) : (
              <ul className="pb-list">
                {visible.map(c => {
                  const r = relOf(c.relationship);
                  const due = c.followUpDate && c.followUpDate <= isoToday();
                  return (
                    <li key={c.id}>
                      <article className={`pb-card ${selectedId === c.id ? 'selected' : ''}`} onClick={() => setSelectedId(c.id === selectedId ? null : c.id)} tabIndex={0} role="button" onKeyDown={e => { if (e.key === 'Enter') setSelectedId(c.id); }}>
                        <span className="pb-spine" style={{ background: r.hex }} />
                        <span className="pb-avatar" style={{ background: `hsl(${hueOf(c.name)} 45% 28%)` }}>{c.name.charAt(0)}</span>
                        <div className="pb-card-body">
                          <header>
                            <h3><Highlight text={c.name} query={query} />{c.favorite && <Star size={12} className="amber" fill="currentColor" />}</h3>
                            <span className="pb-rel" style={{ color: r.hex, background: r.wash }}>{r.label}</span>
                          </header>
                          <p>{[c.jobTitle, c.company, c.phone].filter(Boolean).join(' · ') || '—'}</p>
                          {due && <small className="due">پیگیری سررسید شده</small>}
                        </div>
                        <div className="pb-card-ops" onClick={e => e.stopPropagation()}>
                          {telHref(c.phone) && <a href={telHref(c.phone)} title="تماس"><Phone size={14} /></a>}
                          <button type="button" title="علاقه" className={c.favorite ? 'amber' : ''} onClick={() => handleFav(c)}><Star size={14} fill={c.favorite ? 'currentColor' : 'none'} /></button>
                          <button type="button" title="ویرایش" onClick={() => handleEdit(c)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></button>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="pb-aside">
            <Inspector contact={selected} all={items} query={query} logs={logs} onClose={() => setSelectedId(null)} onEdit={handleEdit} onFav={handleFav} onDelete={handleDelete} onLog={handleLog} onFocusRel={k => setRelFilter(k)} />
          </aside>
        </div>
      </div>

      {selected && (
        <div className="pb-drawer" onClick={() => setSelectedId(null)}>
          <div onClick={e => e.stopPropagation()}>
            <Inspector contact={selected} all={items} query={query} logs={logs} onClose={() => setSelectedId(null)} onEdit={handleEdit} onFav={handleFav} onDelete={handleDelete} onLog={handleLog} onFocusRel={k => { setRelFilter(k); setSelectedId(null); }} />
          </div>
        </div>
      )}
      <button type="button" className={`pb-fab ${composerOpen || selectedId ? 'hide' : ''}`} onClick={() => { setEditing(null); setComposerOpen(true); }} aria-label="مخاطب تازه"><Plus size={24} /></button>
    </main>
  );
}
