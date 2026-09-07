# سریال‌ها (Series) — مشخصات + محل کد

> **توجه:** این سند مشخصات و مرجع است.  
> کد زندهٔ UI اینجاست: `public/design/series-page.html`  
> (قبلاً به‌اشتباه حذف شد و دوباره restore شده.)

---

## محل فایل‌ها

| فایل | نقش |
|------|-----|
| `public/design/series-page.html` | صفحهٔ کامل سریال‌ها (HTML + CSS + JS) |
| `public/index.html` | کارت کوتاه سریال روی خانه (`epcard` / `EPS`) |
| `server.js` / `cloudflare/worker.js` | API: TVMaze، progress، Bingers، refresh-episodes |

---

## ۱. هدف کلی

ردیاب شخصی تماشای سریال داخل LifeOS:

- چه سریالی را می‌بینم / می‌خواهم ببینم / تمام کرده‌ام
- در **کدام فصل و کدام قسمت** هستم
- قسمت‌های **واقعاً پخش‌شده** از TVMaze (نشود قسمت نیامده را «دیده‌شده» زد)
- پوستر، ژانر، وضعیت پخش، اعلان قسمت تازه

---

## ۲. UI صفحه (`series-page.html`)

### تب‌ها

1. **در حال دیدن (`watching`)**
2. **در انتظار (`waiting`)** — فصل کامل / catch-up تا aired ولی فصل/فصل بعد هنوز کامل نیست
3. **تمام‌شده (`completed`)** — بدون `+قسمت`
4. **واچ‌لیست (`watchlist`)** — شروع‌نشده

### کارت

پوستر + عنوان + فصل + `cur / tot` + نوار پیشرفت + `−` / `+`  
دراور: جزئیات، افزودن (TVMaze)، ایمپورت Bingers (preview → commit)

---

## ۳. قرارداد پیشرفت قسمت

| فیلد | معنی |
|------|------|
| `currentSeason` | فصل جاری |
| `currentEpisode` | قسمت دیده‌شده **در همین فصل** |
| `totalEpisodes` | **طول همین فصل** (نه جمع همهٔ فصل‌ها) |
| `airedInSeason` | چند قسمت تا امروز پخش شده |
| `seasonEpisodes` | `{ [season]: { total, aired } }` |

قوانین:

- `+` فقط تا **aired** (مثلاً Lanterns S1: ۸ قسمت، ۴ پخش → سقف ۴)
- نه hardcode مثل `tot=10`
- نه total کل شوی به‌جای فصل (اشتباه Lioness ≈ ۲۴)
- فصل بعد فقط اگر در TVMaze وجود دارد
- load → refresh اجباری season از TVMaze
- PATCH سرور هم episode را به aired clamp می‌کند

---

## ۴. API

| متد | مسیر |
|-----|------|
| GET | `/api/movies` |
| PATCH/DELETE | `/api/movies/:id` |
| GET | `/api/movies/tvmaze/search` |
| GET | `/api/movies/tvmaze/seasons` |
| POST | `/api/movies/:id/refresh-episodes` |
| POST | `/api/movies/from-tvmaze` |
| POST | `/api/movies/import-bingers/preview` |
| POST | `/api/movies/import-bingers/commit` |
| GET | `/api/movies/next-episode-alerts` |

---

## ۵. خانه

کارت `epcard` زیر tasks: لیست کوتاه watching + لینک به `/design/series-page.html`.

---

## ۶. باگ‌های درس‌گرفته

1. `tot=10` هاردکد  
2. total = همهٔ episodes شوی  
3. نبود aired → `+` آزاد  
4. refresh اختیاری → عدد کهنه  
5. waiting قاطی watching  

---

*مرجع مشخصات سریال LifeOS.*
