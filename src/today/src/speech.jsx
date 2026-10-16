import React from 'react';

// «استودیوی گفتار» روی سیستم کاربر اجرا می‌شود (speech-studio/run.bat)؛ مدل و صدا از آن بیرون نمی‌رود.
// این صفحه فقط لینک می‌دهد و هیچ fetch به localhost نمی‌زند (CSP سایت اجازه نمی‌دهد و لازم هم نیست).
const URL_LOCAL = 'http://127.0.0.1:8765';

export function SpeechPage({ Nav }) {
  return <>
    {Nav && <Nav />}
    <main dir="rtl" className="page-main">
      <section className="card">
        <header><h2>استودیوی گفتار</h2></header>
        <p>پیاده‌سازی فایل، دیکته و تفکیک گوینده — همه محلی روی همین سیستم؛ صدا بیرون نمی‌رود.</p>
        <p><a className="btn" href={URL_LOCAL} target="_blank" rel="noopener noreferrer">باز کردن استودیو</a></p>
        <p className="muted">اگر باز نشد، اول <code dir="ltr">F:\lifeos\speech-studio\run.bat</code> را اجرا کنید. این لینک فقط روی کامپیوتری کار می‌کند که سرویس روی آن روشن است.</p>
      </section>
    </main>
  </>;
}
