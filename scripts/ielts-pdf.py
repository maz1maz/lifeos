#!/usr/bin/env python3
"""Helpers for turning a Cambridge IELTS book PDF into LifeOS test JSON (format: docs/IELTS-CONTENT.md).
Needs poppler (pdftotext, pdftoppm); `crop` also needs Pillow. Nothing here touches the repo or the network.

  python3 scripts/ielts-pdf.py map  book.pdf                       # one line per page: what is on it (find tests/sections)
  python3 scripts/ielts-pdf.py png  book.pdf 16 [dpi]              # render a page to <book>-p16.png (LOOK at it: keys, tables, diagrams)
  python3 scripts/ielts-pdf.py cols book.pdf 16 "90:332,334:556,590:818,826:1060" [y0:y1]
                                                                    # text of the given columns (x ranges are in pixels of a
                                                                    # 1159-px-wide rendering of the page; use `png` at dpi 100 to read them off)
  python3 scripts/ielts-pdf.py crop book.pdf 6 "423:283,772:421" out.webp
                                                                    # crop a region (page points) to webp; then
                                                                    # node scripts/ielts-check.mjs --img out.webp → data URL for the JSON
Why columns: books are 2-4 column layouts, so plain pdftotext interleaves them. Always read the result against the page
image; fix OCR slips (l50m → 150m, he → be, qoods → goods) but never invent text that is missing in the scan.
"""
import html, os, re, subprocess, sys, tempfile

def run(*a):
    return subprocess.run(a, check=True, capture_output=True, text=True).stdout

def cmd_map(pdf):
    n = int(re.search(r'Pages:\s+(\d+)', run('pdfinfo', pdf)).group(1))
    for p in range(1, n + 1):
        t = ' '.join(run('pdftotext', '-f', str(p), '-l', str(p), '-layout', pdf, '-').split())
        t = t.replace('languagedownload.ir', '').strip()
        print(f'{p:3}: {t[:110]}')

def cmd_png(pdf, page, dpi='100'):
    out = f"{os.path.splitext(os.path.basename(pdf))[0]}-p{page}"
    run('pdftoppm', '-f', page, '-l', page, '-r', dpi, '-png', '-singlefile', pdf, out)
    print(out + '.png')

def cmd_cols(pdf, page, ranges, ys=None):
    with tempfile.NamedTemporaryFile(suffix='.html', delete=False) as f: tmp = f.name
    run('pdftotext', '-f', page, '-l', page, '-bbox-layout', pdf, tmp)
    src = open(tmp, encoding='utf8').read(); os.unlink(tmp)
    width = float(re.search(r'<page width="([\d.]+)"', src).group(1)); k = width / 1159.0
    words = [(float(a), float(b), html.unescape(t)) for a, b, c, d, t in re.findall(
        r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', src)]
    y0, y1 = (map(float, ys.split(':')) if ys else (0, 99999))
    for i, r in enumerate(ranges.split(',')):
        a, b = map(float, r.split(':'))
        sel = sorted((w for w in words if a * k <= w[0] < b * k and y0 * k <= w[1] < y1 * k), key=lambda w: (round(w[1] / 4), w[0]))
        lines, cy = [], None
        for w in sel:
            if cy is None or abs(w[1] - cy) > 3: lines.append([]); cy = w[1]
            lines[-1].append(w[2])
        print(f'--- col {i}'); print('\n'.join(' '.join(l) for l in lines))

def cmd_crop(pdf, page, box, out, dpi=200):
    from PIL import Image
    (x0, y0), (x1, y1) = [tuple(map(float, p.split(':'))) for p in box.split(',')]
    base = os.path.splitext(out)[0] + '-tmp'
    run('pdftoppm', '-f', page, '-l', page, '-r', str(dpi), '-png', '-singlefile', pdf, base)
    k = dpi / 72.0
    im = Image.open(base + '.png').convert('L').crop(tuple(int(v * k) for v in (x0, y0, x1, y1)))
    im.save(out, 'WEBP', quality=75); os.unlink(base + '.png')
    print(out, im.size, os.path.getsize(out), 'bytes')

if __name__ == '__main__':
    a = sys.argv[1:]
    fn = {'map': cmd_map, 'png': cmd_png, 'cols': cmd_cols, 'crop': cmd_crop}.get(a[0] if a else '')
    if not fn: sys.exit(__doc__)
    fn(*a[1:])
