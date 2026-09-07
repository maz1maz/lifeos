# سریال‌ها (Series) — مشخصات و هدف

> این ماژول از **UI حذف شده** است (صفحه، لینک ناوبری، کارت خانه).  
> این سند ثبت می‌کند **قرار بود چه باشد و چه کار کند** تا اگر بعداً از نو ساخته شد، قرارداد روشن باشد.  
> API بک‌اند (`/api/movies` برای `type=series`) ممکن است هنوز باشد؛ فقط فرانت سریال برداشته شده.

---

## ۱. هدف کلی

یک **ردیاب تماشای سریال** شخصی داخل LifeOS:

- چه سریالی را می‌بینم / می‌خواهم ببینم / تمام کرده‌ام
- در **کدام فصل و کدام قسمت** هستم
- قسمت‌های **واقعاً پخش‌شده** را از منبع خارجی (TVMaze) بگیرد تا نشود قسمتِ نیامده را «دیده‌شده» زد
- پوستر، ژانر، وضعیت پخش (running/ended)، اعلان قسمت تازه

مخاطب: خودِ کاربر — نه کاتالوگ عمومی.

---

## ۲. صفحهٔ اصلی (حذف‌شده: `/design/series-page.html`)

### ۲.۱ چیدمان UI (طراحی sx-*)

| بخش | نقش |
|------|-----|
| هدر | عنوان «سریال‌ها» + جستجو + افزودن + ایمپورت Bingers |
| تب‌ها | **در حال دیدن** · **در انتظار** · **تمام‌شده** · **واچ‌لیست** |
| گرید کارت | پوستر + عنوان + فصل + `cur / tot` + نوار پیشرفت + `−` / `+` |
| دراور جزئیات | خلاصه، وضعیت، `+۱ قسمت`، پایان سریال، شروع از واچ‌لیست |
| دراور افزودن | جستجوی TVMaze → افزودن به واچ‌لیست |
| دراور ایمپورت | CSV Bingers: **preview → commit** (تک‌مرحله‌ای نیست) |

### ۲.۲ تب‌ها

1. **در حال دیدن (`watching`)** — `status=watching` و هنوز به انتهای قابل‌مشاهدهٔ فصل نرسیده.
2. **در انتظار (`waiting`)** فقط وقتی:
   - فصل جاری کامل دیده شده و فصل بعد نیست / تاریخ next در آینده است، **یا**
   - با قسمت‌های **پخش‌شده** catch-up شده‌ای ولی فصل هنوز قسمت نیامده دارد.  
   نباید با watching قاطی شود.
3. **تمام‌شده (`completed`)** — بدون دکمهٔ `+قسمت`.
4. **واچ‌لیست (`watchlist`)** — اضافه‌شده، شروع‌نشده.

### ۲.۳ پیشرفت قسمت (قرارداد درست)

| فیلد | معنی |
|------|------|
| `currentSeason` | فصل **جاری** (۱-based) |
| `currentEpisode` | چند قسمت از **همین فصل** دیده شده |
| `totalEpisodes` | **طول همین فصل** — نه جمع همهٔ فصل‌ها |
| `airedInSeason` | چند قسمت از همین فصل تا امروز پخش شده (`airdate ≤ today`) |
| `seasonEpisodes` | `{ [season]: { total, aired } }` |

قوانین سخت:

- **`+` فقط تا `airedInSeason`** (مثال: Lanterns S1 = ۸ قسمت، ۴ پخش → سقف کلیک = ۴).
- **هرگز `totalEpisodes` را hardcode نکن (مثل ۱۰)**.
- **هرگز total کل شوی را جای فصل نگذار** (اشتباه Lioness ≈ ۲۴ به‌جای ۸ هر فصل).
- فصل بعد فقط اگر در `seasonEpisodes` وجود دارد → دکمهٔ «شروع فصل بعد»، نه پرش به S5 الکی.
- بعد از load: refresh اجباری TVMaze برای هر watching.
- PATCH سرور هم `currentEpisode` را به aired همان فصل clamp کند.

### ۲.۴ افزودن سریال

1. `GET /api/movies/tvmaze/search?q=`
2. `POST /api/movies/from-tvmaze` `{ tvmazeId, status:'watchlist' }`  
   — `seasonEpisodes` از embed episodes؛ total = فصل ۱ نه `eps.length` کل.
3. «شروع»: `watching`, S1, ep 0، بعد sync.

### ۲.۵ ایمپورت Bingers

- `POST /api/movies/import-bingers/preview`
- `POST /api/movies/import-bingers/commit`  
بدون دمو/نمونهٔ کاربر داخل صفحه.

### ۲.۶ خانه (حذف‌شده)

کارت `epcard` زیر tasks: لیست کوتاه watching + لینک به صفحهٔ سریال از `dash.watchingSeries`.

---

## ۳. APIهای مرتبط (بک‌اند)

| متد | مسیر | کار |
|-----|------|-----|
| GET | `/api/movies` | لیست |
| PATCH/DELETE | `/api/movies/:id` | پیشرفت / حذف + clamp |
| GET | `/api/movies/tvmaze/search` | جستجو |
| GET | `/api/movies/tvmaze/seasons` | bySeason / aired / total |
| POST | `/api/movies/:id/refresh-episodes` | همگام اجباری |
| POST | `/api/movies/from-tvmaze` | افزودن |
| POST | `/api/movies/import-bingers/preview` | پیش‌نمایش |
| POST | `/api/movies/import-bingers/commit` | ثبت |
| GET | `/api/movies/next-episode-alerts` | قسمت تازه |

منبع حقیقت اپیزود: **TVMaze**.

---

## ۴. status

| مقدار | UI |
|--------|-----|
| `watchlist` | واچ‌لیست |
| `watching` | دیدن / انتظار (بر اساس progress) |
| `completed` | تمام |
| `dropped` | رها |

---

## ۵. باگ‌های درس‌گرفته

1. `tot=10` هاردکد در start/rewatch  
2. `totalEpisodes = همهٔ episodes شوی`  
3. نبودن `aired` → `+` تا tot آزاد  
4. refresh اختیاری → عدد کهنه روی دیسک  
5. waiting قاطی watching و `+` روی تمام‌شده  

بازسازی باید از روز اول: **per-season + aired-lock + refresh on load + clamp server**.

---

## ۶. خارج از اسکوپ

پلیر/استریم، سوشال، ریتینگ عمومی — فقط کتابخانهٔ شخصی + پیشرفت واقعی پخش.

---

## ۷. حذف‌شده در این تغییر

- `public/design/series-page.html`
- لینک ناو «🎬 سریال‌ها» از همهٔ صفحات
- کارت `epcard` و JS خانه (`EPS` / `renderEps` / epList / epGoAll)

بک‌اند movies/series عمداً نگه داشته شد مگر جداگانه پاک شود.

---

## ۸. چک‌لیست پذیرش (اگر دوباره ساخته شد)

- [ ] Lanterns S1: tot=۸؛ با ۴ پخش‌شده `+` بعد از ۴ قفل  
- [ ] Lioness: فصل‌به‌فصل نه ۲۴ یکجا  
- [ ] بدون فصل ساختگی  
- [ ] waiting ≠ watching؛ completed بدون +  
- [ ] لیست خالی تا کاربر اضافه کند  
- [ ] Bingers فقط preview→commit  
- [ ] بعد از deploy اعداد از TVMaze نه tot کهنه  

---

*ثبت هنگام حذف UI سریال از LifeOS — مرجع بازطراحی.*
