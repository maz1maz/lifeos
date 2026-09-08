# آپلود مدارک بدون R2

## خلاصه

روی **Node (`server.js`)** نیازی به Cloudflare R2 نیست.
فایل‌ها روی دیسک محلی ذخیره می‌شوند:

```text
public/uploads/<uuid>.<ext>
```

در `db.json` فقط متادیتا و مسیر می‌ماند، مثلاً:

```json
{
  "id": "…",
  "title": "بیمه",
  "fileUrl": "/uploads/….pdf",
  "fileMime": "application/pdf",
  "fileName": "bime.pdf"
}
```

`public/uploads/` در `.gitignore` است (فایل‌های شخصی commit نشوند).

## جریان API

### ۱) ساخت رکورد (بدون فایل)

```http
POST /api/documents
Content-Type: application/json

{ "title": "کارت ملی", "type": "id", "expiryDate": "2030-01-01", "notes": "" }
```

پاسخ: سند با `fileUrl: null`.

### ۲) پیوست فایل (base64)

```http
POST /api/documents/:id/attach
Content-Type: application/json

{
  "dataBase64": "<base64 بدون data: پیشوند یا با data:…;base64,…>",
  "mime": "application/pdf",
  "fileName": "card.pdf"
}
```

- سقف حدود **۱۲ مگابایت**
- سرور فایل را در `UPLOADS_DIR` می‌نویسد و `fileUrl` را ست می‌کند

### ۳) دانلود / مشاهده

```http
GET /api/documents/:id/file
```

با احراز هویت؛ فقط مالک. در صورت نیاز redirect به `/uploads/…`.

استاتیک `/uploads/*` هم برای کاربر لاگین‌شده و مالک فایل محدود شده است.

## رسید تراکنش

همان الگو: base64 → `public/uploads/` → فیلد `receipt` روی تراکنش.

## چه وقت R2 لازم است؟

| محیط | پیشنهاد |
|------|----------|
| لوکال / VPS با دیسک | **همین مدل؛ بدون R2** |
| Cloudflare Worker + فایل زیاد | R2 یا storage خارجی |
| Worker بدون R2 | فقط لینک خارجی، یا فایل خیلی کوچک داخل DB (توصیه نمی‌شود) |

## بکاپ

همراه `data/db.json` گاهی `public/uploads/` را هم آرشیو کن؛ بدون آن لینک‌های `fileUrl` می‌شکنند.

## گزینه بدون آپلود باینری

اگر نمی‌خواهی فایل روی سرور باشد، در `notes` یا یک فیلد لینک، URL گوگل‌درایو / تلگرام ذخیره کن و `fileUrl` را خالی بگذار.
