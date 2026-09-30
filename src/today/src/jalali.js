// تبدیل تاریخ به شمسی برای نمایش — همه‌جا از این استفاده کن، نه Gregorian خام.
export const faNum = v => String(v ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

// ISO ('2026-09-24' یا با زمان) -> برچسب کامل شمسی، مثل «۲ مهر ۱۴۰۵»
export function jalaliLabel(iso, { weekday = false } = {}) {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      day: 'numeric', month: 'long', year: 'numeric',
      ...(weekday ? { weekday: 'long' } : {})
    }).format(d);
  } catch { return String(iso); }
}

// ISO -> برچسب عددیِ کوتاه شمسی، مثل «۱۴۰۵/۰۷/۰۲»
export function jalaliShort(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
  } catch { return String(iso); }
}

// فقط عدد روز ماه شمسی (برای برچسب‌های فشرده مثل نمودار میله‌ای)
export function jalaliDay(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return faNum(new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', day: 'numeric' }).format(d));
  } catch { return ''; }
}
