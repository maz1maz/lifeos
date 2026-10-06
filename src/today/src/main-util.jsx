// Small helpers shared by main.jsx and the lazily loaded watch pages (series/movies): fetch wrapper, Tehran/Jalali
// dates and series progress. Pure functions only, so moving pages out of the main bundle doesn't duplicate them.
export const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.');
  return body;
};
export const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const fa = value => Number(value || 0).toLocaleString('fa-IR');
export const faDigits = value => String(value ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
export const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const fromIso = value => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); };
export const jdiv = (a, b) => Math.trunc(a / b);
export const jmod = (a, b) => a - Math.trunc(a / b) * b;
export function jalCal(jy) { const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178]; let leapJ = -14, jp = breaks[0], jump, jm, n; for (let i = 1; i < breaks.length; i += 1) { jm = breaks[i]; jump = jm - jp; if (jy < jm) break; leapJ += jdiv(jump, 33) * 8 + jdiv(jmod(jump, 33), 4); jp = jm; } n = jy - jp; leapJ += jdiv(n, 33) * 8 + jdiv(jmod(n, 33) + 3, 4); if (jmod(jump, 33) === 4 && jump - n === 4) leapJ += 1; const gy = jy + 621, leapG = jdiv(gy, 4) - jdiv((jdiv(gy, 100) + 1) * 3, 4) - 150; const march = 20 + leapJ - leapG; if (jump - n < 6) n = n - jump + jdiv(jump + 4, 33) * 33; let leap = jmod(jmod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4; return { leap, gy, march }; }
export function g2d(gy, gm, gd) { let d = jdiv((gy + jdiv(gm - 8, 6) + 100100) * 1461, 4) + jdiv(153 * jmod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - jdiv(jdiv(gy + 100100 + jdiv(gm - 8, 6), 100) * 3, 4) + 752; }
export function d2g(jdn) { let j = 4 * jdn + 139361631; j += jdiv(jdiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; const i = jdiv(jmod(j, 1461), 4) * 5 + 308; return { gd: jdiv(jmod(i, 153), 5) + 1, gm: jmod(jdiv(i, 153), 12) + 1, gy: jdiv(j, 1461) - 100100 + jdiv(8 - jmod(jdiv(i, 153), 12) - 1, 6) }; }
export const j2d = (jy, jm, jd) => { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jdiv(jm, 7) * (jm - 7) + jd - 1; };
export function d2j(jdn) { const gy = d2g(jdn).gy; let jy = gy - 621, r = jalCal(jy), k = jdn - g2d(gy, 3, r.march); if (k >= 0) { if (k <= 185) return { jy, jm: 1 + jdiv(k, 31), jd: jmod(k, 31) + 1 }; k -= 186; } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; } return { jy, jm: 7 + jdiv(k, 30), jd: jmod(k, 30) + 1 }; }
export const toJalali = date => d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
export const toGregorian = (jy, jm, jd) => { const g = d2g(j2d(jy, jm, jd)); return new Date(g.gy, g.gm - 1, g.gd); };
export const jalaliMonthLength = (year, month) => month <= 6 ? 31 : month < 12 ? 30 : jalCal(year).leap === 0 ? 30 : 29;
export const addDays = (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
export const sameDate = (a, b) => iso(a) === iso(b);
export const weekdayIndex = date => (date.getDay() + 1) % 7;
export const eventOnDate = (event, day) => { const dayIso = iso(day), start = String(event.startDate || event.date || '').slice(0, 10), end = String(event.endDate || start).slice(0, 10); if (!start) return false; if (event.allDay) return dayIso >= start && dayIso < end; if (event.source === 'lifeos') return dayIso === start; return dayIso >= start && dayIso <= end; };
export const eventLabel = event => `${event.time ? `${event.time} · ` : ''}${event.title || 'رویداد'}`;
export function seasonAiredCount(item, season) { const by = item.seasonEpisodes || {}; const s = by[season] || by[String(season)]; return s ? Number(s.aired) || 0 : 0; }
export function seasonTotalCount(item, season) { const by = item.seasonEpisodes || {}; const s = by[season] || by[String(season)]; return s ? Number(s.total) || 0 : 0; }
export function seriesHasFresh(item) {
  const cur = Number(item.currentSeason) || 1;
  if (seasonAiredCount(item, cur) > (Number(item.currentEpisode) || 0)) return true;
  const by = item.seasonEpisodes || {};
  return Object.keys(by).some(s => Number(s) > cur && (Number(by[s].aired) || 0) > 0);
}
// The episode the "دیدم" button will record (same rule as quickWatch): next in this season, or E1 of the next aired season.
export function nextToWatch(item) {
  if (item.status === 'watchlist') return { s: 1, e: 1 };
  const cur = Number(item.currentSeason) || 1, ep0 = Number(item.currentEpisode) || 0, aired = seasonAiredCount(item, cur) || Number(item.airedInSeason) || 0;
  const roll = aired && ep0 >= aired && (Number((item.seasonEpisodes || {})[cur + 1]?.aired) || 0) > 0;
  return roll ? { s: cur + 1, e: 1 } : { s: cur, e: ep0 + 1 };
}
export const watchLabel = item => { const n = nextToWatch(item); return `دیدم ف${fa(n.s)} ق${fa(n.e)}`; };
// Caught up on everything aired AND the current season has finished airing → waiting for a new season.
export function waitingNewSeason(item) {
  if (item.status !== 'watching' || seriesHasFresh(item)) return false;
  const cur = Number(item.currentSeason) || 1, aired = seasonAiredCount(item, cur), total = seasonTotalCount(item, cur) || aired;
  return aired > 0 && aired >= total;
}
export function episodesWatchedCount(item) {
  const by = item.seasonEpisodes || {}, cur = Number(item.currentSeason) || 1;
  let n = 0;
  Object.keys(by).forEach(s => { if (Number(s) < cur) n += Number(by[s].total) || 0; });
  return n + (Number(item.currentEpisode) || 0);
}
export function seriesAiredTotal(item) {
  const by = item.seasonEpisodes || {};
  return Object.values(by).reduce((n, s) => n + (Number(s.aired) || 0), 0);
}
export const SERIES_TABS = [['all', 'همه'], ['watching', 'در حال تماشا'], ['waiting', 'در انتظار فصل جدید'], ['watchlist', 'بعداً'], ['completed', 'تمام‌شده'], ['dropped', 'رها‌شده']];
export const seriesInTab = (x, tab) => tab === 'all' ? true : tab === 'waiting' ? waitingNewSeason(x) : tab === 'watching' ? x.status === 'watching' && !waitingNewSeason(x) : x.status === tab;
export const SHOW_STATUS_FA = { Running: 'در حال پخش', Ended: 'پایان‌یافته', 'To Be Determined': 'نامشخص', 'In Development': 'در دست تولید' };
export const readDataUrl = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('خواندن فایل لوگو ناموفق بود.')); reader.onload = () => resolve(String(reader.result || '')); reader.readAsDataURL(file); });
export const jalaliDayLabel = isoDate => { const j = toJalali(fromIso(isoDate)); return `${faDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`; };
