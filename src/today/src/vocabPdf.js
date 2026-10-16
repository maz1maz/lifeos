import { jsPDF } from 'jspdf';

// Render text with the browser's fonts first, then embed each page as an image.
// jsPDF's built-in fonts cannot shape Persian, whereas Canvas can.
export async function buildTutorConversationPdf(history) {
  const messages = (Array.isArray(history) ? history : [])
    .filter(item => item && (item.r === 'u' || item.r === 'a') && String(item.t || '').trim())
    .map(item => ({ role: item.r, text: String(item.t) }));
  if (!messages.length) throw new Error('هنوز پیامی برای خروجی وجود ندارد.');
  await document.fonts.ready;

  const W = 1240, H = 1754, left = 86, right = W - 86, bottom = H - 112;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ساخت PDF در این مرورگر پشتیبانی نمی‌شود.');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const stamp = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  const font = 'Vazirmatn, Tahoma, Arial, sans-serif';
  let page = 0, y = 0;

  function startPage() {
    if (page) pdf.addPage();
    page++;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'top';
    ctx.direction = 'rtl'; ctx.textAlign = 'right';
    ctx.fillStyle = '#1a2432'; ctx.font = `bold 38px ${font}`;
    ctx.fillText('مکالمه با معلم زبان · LifeOS', right, 67);
    ctx.fillStyle = '#5d6876'; ctx.font = `24px ${font}`;
    ctx.fillText(stamp, right, 119);
    ctx.strokeStyle = '#d9e0e7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(left, 174); ctx.lineTo(right, 174); ctx.stroke();
    y = 208;
  }

  function savePage() {
    ctx.strokeStyle = '#d9e0e7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(left, H - 83); ctx.lineTo(right, H - 83); ctx.stroke();
    ctx.direction = 'rtl'; ctx.textAlign = 'right';
    ctx.fillStyle = '#6b7581'; ctx.font = `21px ${font}`;
    ctx.fillText(`صفحهٔ ${page}`, right, H - 65);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, 210, 297);
  }

  function wrap(text, maxWidth) {
    ctx.font = `27px ${font}`;
    const lines = [];
    for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
      if (!paragraph.trim()) { lines.push(''); continue; }
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width <= maxWidth) { line = next; continue; }
        if (line) { lines.push(line); line = ''; }
        if (ctx.measureText(word).width <= maxWidth) { line = word; continue; }
        // A long URL or unspaced word can still wrap without overflowing the page.
        for (const char of word) {
          if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); line = ''; }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  startPage();
  for (const message of messages) {
    const lines = wrap(message.text, right - left - 60);
    const isTutor = message.role === 'a';
    let index = 0, part = 0;
    while (index < lines.length) {
      if (y + 125 > bottom) { savePage(); startPage(); }
      const available = Math.max(1, Math.floor((bottom - y - 79) / 40));
      const segment = lines.slice(index, index + available);
      const height = 69 + segment.length * 40;
      ctx.fillStyle = isTutor ? '#f7f5f0' : '#eef5fb';
      ctx.beginPath(); ctx.roundRect(left, y, right - left, height, 18); ctx.fill();
      ctx.direction = 'rtl'; ctx.textAlign = 'right';
      ctx.fillStyle = isTutor ? '#9b6917' : '#176391';
      ctx.font = `bold 25px ${font}`;
      ctx.fillText(`${isTutor ? 'معلم' : 'شما'}${part ? ' (ادامه)' : ''}`, right - 28, y + 18);
      ctx.font = `27px ${font}`; ctx.fillStyle = '#202833';
      for (let i = 0; i < segment.length; i++) {
        const line = segment[i];
        const rtl = /[\u0590-\u08ff]/.test(line);
        ctx.direction = rtl ? 'rtl' : 'ltr';
        ctx.textAlign = rtl ? 'right' : 'left';
        ctx.fillText(line, rtl ? right - 28 : left + 28, y + 58 + i * 40);
      }
      y += height + 18;
      index += segment.length; part++;
    }
  }
  savePage();
  return pdf.output('blob');
}

// Vite uses preserveEntrySignatures:false for standalone non-HTML inputs.
// Keep the entry callable from the classic /vocab app even after tree-shaking.
globalThis.lifeosBuildTutorConversationPdf = buildTutorConversationPdf;
