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
