// Course session dates from start date + class weekdays; mirrors courseSessions() in the worker.
// course.days: JS weekdays (0=Sun … 6=Sat); skip: cancelled dates (the session moves to the next class day); moves: {origIso: {date, time}}.
export const WEEKDAYS = [[6, 'شنبه'], [0, 'یکشنبه'], [1, 'دوشنبه'], [2, 'سه‌شنبه'], [3, 'چهارشنبه'], [4, 'پنجشنبه'], [5, 'جمعه']];
const addDay = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export function courseSessions(c, withCancelled = false) {
  const N = Math.max(0, Math.min(60, Number(c?.sessions) || 0)), days = (Array.isArray(c?.days) ? c.days : []).map(Number);
  if (!c?.startDate || !days.length || !N) return [];
  const skip = new Set(c.skip || []), mv = c.moves || {}, out = []; let d = c.startDate, g = 800, k = 0;
  while (k < N && g-- > 0) {
    const wd = new Date(d + 'T12:00:00Z').getUTCDay();
    if (days.includes(wd)) {
      if (skip.has(d)) { if (withCancelled) out.push({ n: null, orig: d, date: d, time: c.time || '', cancelled: true }); }
      else { k++; const m = mv[d] || {}; out.push({ n: k, orig: d, date: m.date || d, time: m.time || c.time || '', moved: !!mv[d] }); }
    }
    d = addDay(d, 1);
  }
  return out;
}
export const daysLabel = days => WEEKDAYS.filter(([k]) => (days || []).map(Number).includes(k)).map(([, l]) => l).join(' و ');
