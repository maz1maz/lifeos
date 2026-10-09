# Shortcut آیفون: پیامک بانک → LifeOS

endpoint: `POST https://pdmaz.hamidreza-mazlaghani.workers.dev/api/ext/bank-sms`
هدر: `X-LifeOS-Token: lfs_…` (توکن با دسترسی «پیامک بانک» از تنظیمات → اتصال سایت شخصی).
بدنه (JSON): `{"text": "<متن پیامک>"}` — چند پیامک را می‌شود با خط `###` جدا کرد.
پاسخ موفق: `ok: true` (تکراری هم `ok: true` می‌گیرد، پس ارسال دوباره بی‌خطر است).

چون `workers.dev` بدون VPN در دسترس نیست، پیامک‌ها اول در یک فایل صف ذخیره و بعد فرستاده می‌شوند.

## ۱) Automation «ذخیره در صف» (اجرا با رسیدن پیامک)
Shortcuts → Automation → + → **Message**
- Sender: شمارهٔ/نام بانک (مثلاً «Blu Bank»). **Run Immediately** روشن، Notify خاموش.
- اکشن‌ها:
  1. **Text**: `Shortcut Input` (Content) + خط تازه + `###` + خط تازه
  2. **Append to Text File**: فایل `Shortcuts/lifeos-sms.txt` (Make New Line روشن)
  3. **Run Shortcut**: «ارسال پیامک‌ها» (اگر اینترنت/VPN وصل نیست، بی‌صدا شکست می‌خورد؛ صف می‌ماند)

## ۲) Shortcut «ارسال پیامک‌ها»
1. **Get File** `Shortcuts/lifeos-sms.txt` (Error If Not Found خاموش)
2. **If** File **has any value**
3. **Get Contents of URL** — URL بالا، Method `POST`، Headers: `X-LifeOS-Token` = توکن، Request Body: JSON، کلید `text` = File
4. **Get Dictionary Value** `ok` از نتیجه
5. **If** Dictionary Value **is** `1` (true) → **Delete Files** همان فایل (Confirm Before Deleting خاموش)

## ۳) ارسال دوره‌ای
Automation دوم: **Time of Day** (مثلاً هر ساعت/صبح و شب) یا **App → VPN باز شد** → Run Shortcut «ارسال پیامک‌ها».

## عیب‌یابی
- در LifeOS: تنظیمات → اتصال سایت شخصی → «آخرین استفاده» توکن.
- پاسخ `401` = توکن اشتباه؛ `403` = توکن دسترسی پیامک ندارد؛ `422` = پیامک ناخوانا (به Inbox می‌رود).
