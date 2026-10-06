import { useEffect, useState } from 'react';
import { api, fa } from './life-core';

// Today-page card for «بینش» (the full page is a lazy chunk; this stays tiny).
export function InsightsHomeCard({ Card, Icon }) {
  const [notes, setNotes] = useState(null), [pri, setPri] = useState(null);
  useEffect(() => {
    api('/api/insights').then(d => setNotes(d.items || [])).catch(() => setNotes([]));
    api('/api/ai/tomorrow-priorities').then(setPri).catch(() => setPri(null));
  }, []);
  const late = pri?.overdueTasks?.length || 0, tmr = pri?.dueTomorrowTasks?.length || 0;
  return <Card className="ins-home" icon={Icon} title="بینش" action={<a href="/?page=insights">همه ←</a>}>
    <ul>
      {late ? <li>⚠️ <span>{fa(late)} کار از ددلاینش گذشته</span></li> : null}
      {tmr ? <li>📌 <span>{fa(tmr)} کار ددلاینش فرداست</span></li> : null}
      {(notes || []).slice(0, 3).map((x, i) => <li key={i}>{x.icon} <span>{x.text}</span></li>)}
      {notes && !notes.length && !late && !tmr ? <li className="muted">هنوز نکته‌ای نیست؛ با ثبت خرج، خواب و حال، اینجا پر می‌شود.</li> : null}
    </ul>
  </Card>;
}
