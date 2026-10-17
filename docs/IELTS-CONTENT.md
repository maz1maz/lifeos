# آماده‌کردن آزمون‌های آیلتس (کتاب‌های کمبریج) برای LifeOS

این راهنما برای کسی است که کتاب‌ها را به فایل آزمون تبدیل می‌کند. مدیر سایت فایل‌ها را وارد می‌کند:
تب آیلتس ← «افزودن آزمون (فایل JSON)» ← تیک «برای همهٔ کاربران».

**محتوای کتاب هرگز داخل ریپو نمی‌رود** (کپی‌رایت؛ ریپو عمومی است). فایل‌ها جدا تحویل داده می‌شوند.

## روال کار
1. برای هر تست، یک فایل JSON بساز. ریدینگ، لیسنینگ، رایتینگ و اسپیکینگ فایل جدا دارند.
2. نام و `id`: فقط حروف کوچک انگلیسی، عدد و خط تیره. مثال‌ها:
   - `cam5-test2-reading`، `cam5-test2-reading-gt`
   - `cam5-test2-listening`
   - `cam5-writing-2`، `cam5-writing-gt`
   - `cam5-speaking`
3. بررسی کن:
   ```bash
   node scripts/ielts-check.mjs <پوشهٔ فایل‌ها>
   ```
   باید همه ✓ باشند.
4. پوشه را زیپ کن و تحویل بده. صوت لیسنینگ (mp3) را هم کنارش بگذار.
   مدیر صوت را بعد از ورود آزمون، با دکمهٔ «آپلود صوت» اضافه می‌کند.

کمک‌ابزار تصویر (نمودار، نقشه یا تصویر سؤال):
```bash
node scripts/ielts-check.mjs --img chart.webp
```
خروجی یک `data:image/...` است؛ آن را در فیلد `image` بگذار. تصویر را حدود ۱۰۰۰px عرض و webp کن.
حجم هر فایل حداکثر ۱٫۵ مگابایت است.

## فیلدهای مشترک
| فیلد | توضیح |
|---|---|
| `id` | شناسهٔ یکتا (بالا) |
| `skill` | `reading` / `listening` / `writing` / `speaking` |
| `module` | `academic` یا `general` (ریدینگ و رایتینگ) |
| `book`، `test` | شمارهٔ کتاب و تست (عدد) |
| `title` | مثل `Cambridge IELTS 5 — Test 2 Reading` |
| `source` | نام کتاب |
| `minutes` | اختیاری (ریدینگ پیش‌فرض ۶۰) |

## ریدینگ و لیسنینگ
```json
{
  "id": "cam5-test2-reading", "skill": "reading", "module": "academic", "book": 5, "test": 2,
  "title": "Cambridge IELTS 5 — Test 2 Reading", "source": "Cambridge IELTS 5",
  "sections": [
    { "n": 1, "title": "Passage 1", "range": "1–13",
      "passage": { "title": "…", "subtitle": "اختیاری", "paragraphs": [ { "label": "A", "text": "…" }, { "text": "…" } ], "author": "اختیاری" },
      "groups": [ … ] }
  ],
  "key": { "1": ["TRUE"], "2": ["water", "the water"], "3": ["C"] },
  "explain": { "1": "اختیاری: توضیح یا جملهٔ شاهد" }
}
```
- لیسنینگ `passage` ندارد. چهار `section` دارد و `skill` آن `listening` است.
- لیسنینگ این‌ها را هم دارد:
  - `"tape": [{ "section": 1, "lines": ["R: Good evening…", …] }]`: متن صوت.
  - `"evidence": { "1": "جملهٔ شاهد" }`: در بازبینی نشان داده می‌شود.
- کلید (`key`): برای هر سؤال، آرایه‌ای از جواب‌های قبول.
  - حروف بزرگ/کوچک و نقطه‌گذاری مهم نیست.
  - عدد و واژهٔ عددی یکی حساب می‌شوند.
  - جواب حرفی (A، B…) دقیق مقایسه می‌شود.
- «سه حرف را انتخاب کن» (هر ترتیبی قبول است): همهٔ شماره‌ها کلید یکسان دارند.
  ```json
  "26": {"anyOf": ["A","C","F"], "group": [26,27,28]}
  ```
  `27` و `28` هم همین کلید را می‌گیرند.

### انواع گروه سؤال (`groups`)
همه `title` (مثل `Questions 1–5`) و `instr` (دستور سؤال) دارند. این دو اختیاری‌اند:
- `box`: عنوان کادر
- `example`: نمونهٔ سؤال

| نوع | شکل |
|---|---|
| چندگزینه‌ای | `"questions": [{ "n": 23, "q": "…", "options": [{ "k": "A", "t": "…" }, …] }]` |
| TRUE/FALSE/NOT GIVEN و YES/NO | `"choices": ["TRUE","FALSE","NOT GIVEN"], "questions": [{ "n": 1, "q": "…" }]` |
| تطبیق (پاراگراف، شخص، عنوان…) | `"listTitle": "List of People", "options": [{ "k": "A", "t": "…" }], "questions": [{ "n": 9, "q": "…" }]` |
| جاخالی (خلاصه، یادداشت، فرم، جمله) | `"lines": ["Name: Mary [6]", "Address: [7] Road"]` (هر `[n]` یک جاخالی) |
| جاخالی با فهرست کلمه | همان `lines` + `"bank": ["word1", …]` یا `"bankItems": [{ "k": "A", "t": "…" }]` |
| جدول | `"table": { "head": ["…"], "rows": [["…", "[29]"], …] }` |
| انتخاب چند حرف | `"pick": [26,27,28], "options": [{ "k": "A", "t": "…" }, …]` |
| تصویر | `"image": "data:image/webp;base64,…"` روی گروه، یا روی یک سؤال |

برای پاراگراف‌های برچسب‌دار (A–H)، `label` پاراگراف را پر کن. تطبیق پاراگراف `choices: ["A",…,"H"]` می‌گیرد.

## رایتینگ
```json
{
  "id": "cam5-writing-2", "skill": "writing", "module": "academic", "book": 5, "test": 2,
  "title": "Cambridge IELTS 5 — Writing, Test 2", "source": "Cambridge IELTS 5",
  "tasks": [
    { "task": "task1", "prompt": "The chart below shows …\n\nSummarise the information …\n\nWrite at least 150 words.",
      "image": "data:image/webp;base64,…",
      "data": "نمودار به متن انگلیسی: اعداد و روندها",
      "model": "نمونه‌پاسخ کتاب (اختیاری)" },
    { "task": "task2", "prompt": "…\n\nWrite at least 250 words." }
  ]
}
```
- `data` مهم است: مصحح هوش مصنوعی تصویر را نمی‌بیند. اعداد اصلی، روندها و مراحل را در ۲ تا ۵ جمله بنویس.
- جنرال: `module: "general"` و Task 1 نامه است (بدون تصویر).

## اسپیکینگ
```json
{
  "id": "cam5-speaking", "skill": "speaking", "book": 5, "title": "Cambridge IELTS 5 — Speaking",
  "cards": [
    { "title": "Describe a place you like to visit", "part": "Test 1",
      "text": "متن کارت (برای Part 1 یا Part 3: سؤال‌ها)",
      "ask": ["where it is", "what you do there", "…"],
      "notes": "اختیاری: Part 3 یا یادداشت ممتحن" }
  ]
}
```

## چک‌لیست تحویل
- [ ] `node scripts/ielts-check.mjs` همه ✓
- [ ] متن‌ها از کتاب کپی شده‌اند، نه تایپ دستی. غلط OCR را تصحیح کن (`he`→`be`، `hank`→`bank`).
- [ ] هر Task 1 آکادمیک `image` و `data` دارد.
- [ ] صوت‌های لیسنینگ کنار فایل‌ها هستند، با نام `cam5-test2-listening.mp3`.

## تبدیل PDF کتاب به این فایل‌ها (روش کار)
ابزار: `scripts/ielts-pdf.py` (نیاز به poppler؛ برای `crop` به Pillow). دستورها:
```bash
python3 scripts/ielts-pdf.py map  book.pdf                      # هر صفحه چه چیزی دارد (پیدا کردن تست‌ها)
python3 scripts/ielts-pdf.py png  book.pdf 16                   # عکس صفحه؛ کلید، جدول و نمودار را از عکس بخوان
python3 scripts/ielts-pdf.py cols book.pdf 16 "90:332,334:556,590:818,826:1060"   # متن ستون‌ها
python3 scripts/ielts-pdf.py crop book.pdf 6 "423:283,772:421" diagB.webp           # بریدن نمودار
node    scripts/ielts-check.mjs --img diagB.webp                # data URL برای فیلد image
```
قواعد:
- کتاب‌ها دو تا چهار ستونه‌اند؛ `pdftotext` ساده ستون‌ها را قاطی می‌کند. با `cols` هر ستون را جدا بگیر.
- کلید جواب‌ها (چند صفحهٔ آخر) دو ستونه و پر از «in any order» است. **حتماً از عکس صفحه بخوان**، نه متن استخراج‌شده.
- غلط‌های OCR را درست کن (`l50m` ← `150m`، `qoods` ← `goods`، `he` ← `be`). متنی را که در اسکن نیست اختراع نکن؛ در گزارش بنویس کجا ناقص بود.
- هر فایل را با `ielts-check` بررسی کن (هر سؤال با کلید خودش باید نمرهٔ کامل بگیرد).

### صوت لیسنینگ
- سایت برای هر آزمون **یک** فایل mp3 می‌خواهد. اگر کتاب هر بخش را جدا داده (۴ فایل)، با ffmpeg به هم بچسبان:
  ```bash
  printf "file '001.mp3'\nfile '002.mp3'\nfile '003.mp3'\nfile '004.mp3'\n" > list.txt
  ffmpeg -f concat -safe 0 -i list.txt -c copy cam2-test1-listening.mp3
  ```
- فایل JSON آزمون لیسنینگ (بدون صوت) را اول وارد کن، بعد در همان آزمون «آپلود صوت» را بزن. صوت در چت تلگرام مدیر ذخیره می‌شود (بات تلگرام باید وصل باشد).
- `tape` از صفحه‌های tapescript کتاب ساخته می‌شود: `[{ "section": 1, "lines": ["R: …", "W: …"] }]`. `evidence` اختیاری است.

### پرامپت آمادهٔ تحویل به یک هوش مصنوعی یا آدم
```
می‌خواهم از PDF کتاب «Cambridge IELTS N» فایل‌های آزمون برای LifeOS بسازی.
قالب را از docs/IELTS-CONTENT.md بخوان و برای هر تست این فایل‌ها را بساز:
cam<N>-test<T>-reading (آکادمیک)، cam<N>-test<T>-listening، cam<N>-writing-<T>، cam<N>-speaking (یک فایل برای کل کتاب)
و برای تست‌های جنرال: cam<N>-gt-<A|B>-reading و cam<N>-writing-gt.
ابزار کمکی: scripts/ielts-pdf.py. کلیدها را از عکس صفحه بخوان. متن را بازسازی کن ولی چیزی اختراع نکن.
بعد از ساخت: node scripts/ielts-check.mjs <پوشه> باید همه را ✓ نشان بدهد.
تحویل: پوشهٔ JSONها، یک فهرست از جاهایی که متن ناقص یا مشکوک بود، و mp3 هر لیسنینگ (یک فایل برای هر تست).
```
