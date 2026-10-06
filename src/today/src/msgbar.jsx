// Admin messages bar (shown once on any page) — kept apart from admin.jsx so the admin page can load on demand.
import { useEffect, useState } from 'react';
import { api, fa, jShort } from './life-core';

export const isoOf = ms => ms ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(ms)) : '';

export function ago(ms) {
  if (!ms) return 'هرگز';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 2) return 'همین الان'; if (m < 60) return `${fa(m)} دقیقه پیش`;
  const h = Math.round(m / 60); if (h < 24) return `${fa(h)} ساعت پیش`;
  const d = Math.round(h / 24); if (d < 31) return `${fa(d)} روز پیش`;
  return jShort(isoOf(ms));
}

// Messages the site admin sent to this user — shown once on any page until dismissed.
export function MsgBar({ load }) {
  const [msgs, setMsgs] = useState([]);
  useEffect(() => { load().then(u => setMsgs(u?.msgs || [])); }, []);
  if (!msgs.length) return null;
  const m = msgs[0];
  const close = () => { setMsgs(x => x.slice(1)); api(`/api/messages/${m.id}/read`, { method: 'POST', body: '{}' }).catch(() => {}); };
  return <div className="adm-inbox" role="status" dir="rtl"><b>📣 پیام از مدیر</b><p>{m.text}</p><div><small>{ago(m.at)}{msgs.length > 1 ? ` · ${fa(msgs.length - 1)} پیام دیگر` : ''}</small><button type="button" onClick={close}>{msgs.length > 1 ? 'بعدی' : 'باشه'}</button></div></div>;
}
