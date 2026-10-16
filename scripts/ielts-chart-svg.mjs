// Draws the chart_spec of a BandReady academic Task 1 prompt as SVG (bar, grouped/stacked bar, line, pie, table,
// mixed panels, process flow, map snapshots). Used by scripts/ielts-convert-bandready.mjs, which rasterises the SVG to WebP.
// Kept deliberately plain: no values on the bars, so the student reads them off the axis, as in the exam.

const PAL = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6', '#64748b'];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const W = 1000;

function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return v;
}

// greedy word wrap to at most `max` characters per line
function wrapLines(text, max) {
  const words = String(text == null ? '' : text).split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// one <text> element with a tspan per line, vertically centred on cy
function multiText(cx, cy, lines, { size = 14, lineH = size + 4, anchor = 'middle', weight = 400, fill = '#0f172a' } = {}) {
  const top = cy - ((lines.length - 1) * lineH) / 2 + size * 0.35;
  return `<text x="${cx}" y="${top}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">` +
    lines.map((l, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : lineH}">${esc(l)}</tspan>`).join('') + '</text>';
}

const header = (title, unit) =>
  `<text x="${W / 2}" y="34" font-size="22" font-weight="700" text-anchor="middle">${esc(title)}</text>` +
  (unit ? `<text x="${W / 2}" y="60" font-size="15" text-anchor="middle" fill="#475569">${esc(unit)}</text>` : '');

const legend = (names, x, y) => names.map((n, i) =>
  `<rect x="${x + i * 200}" y="${y}" width="14" height="14" fill="${PAL[i % PAL.length]}"/>` +
  `<text x="${x + i * 200 + 20}" y="${y + 12}" font-size="14">${esc(n)}</text>`).join('');

// bar, grouped_bar, stacked_bar, line — shared axes
function cartesian(spec, height) {
  const cats = spec.x_axis.categories, series = spec.series || [];
  const X0 = 110, Y0 = 90, PW = W - X0 - 40, PH = height - Y0 - 150;
  const total = spec.kind === 'stacked_bar'
    ? Math.max(...cats.map((_, i) => series.reduce((s, se) => s + se.values[i], 0)))
    : Math.max(...series.flatMap(s => s.values));
  const max = spec.y_axis && spec.y_axis.max != null ? spec.y_axis.max : niceMax(total);
  const yOf = v => Y0 + PH - (v / max) * PH;
  let out = header(spec.title, spec.unit);
  for (let k = 0; k <= 5; k++) {
    const v = (max * k) / 5, y = yOf(v);
    out += `<line x1="${X0}" y1="${y}" x2="${X0 + PW}" y2="${y}" stroke="#e2e8f0"/>`;
    out += `<text x="${X0 - 8}" y="${y + 5}" font-size="13" text-anchor="end">${+v.toFixed(2)}</text>`;
  }
  out += `<line x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y0 + PH}" stroke="#334155"/>`;
  out += `<line x1="${X0}" y1="${Y0 + PH}" x2="${X0 + PW}" y2="${Y0 + PH}" stroke="#334155"/>`;
  out += `<text transform="rotate(-90 40 ${Y0 + PH / 2})" x="40" y="${Y0 + PH / 2}" font-size="14" text-anchor="middle" fill="#475569">${esc(spec.y_axis && spec.y_axis.label || '')}</text>`;
  const slot = PW / cats.length;
  cats.forEach((c, i) => {
    out += multiText(X0 + slot * i + slot / 2, Y0 + PH + 22, wrapLines(c, Math.max(8, Math.floor(slot / 8))), { size: 13, lineH: 16 });
  });
  out += `<text x="${X0 + PW / 2}" y="${Y0 + PH + 66}" font-size="14" text-anchor="middle" fill="#475569">${esc(spec.x_axis.label || '')}</text>`;
  if (spec.kind === 'line') {
    series.forEach((se, j) => {
      const pts = se.values.map((v, i) => `${X0 + slot * i + slot / 2},${yOf(v)}`).join(' ');
      out += `<polyline points="${pts}" fill="none" stroke="${PAL[j % PAL.length]}" stroke-width="3"/>`;
      se.values.forEach((v, i) => { out += `<circle cx="${X0 + slot * i + slot / 2}" cy="${yOf(v)}" r="4" fill="${PAL[j % PAL.length]}"/>`; });
    });
  } else if (spec.kind === 'stacked_bar') {
    cats.forEach((_, i) => {
      let base = 0;
      series.forEach((se, j) => {
        const v = se.values[i], top = yOf(base + v), h = yOf(base) - top, bw = slot * 0.6;
        out += `<rect x="${X0 + slot * i + (slot - bw) / 2}" y="${top}" width="${bw}" height="${h}" fill="${PAL[j % PAL.length]}"/>`;
        base += v;
      });
    });
  } else {
    const groupW = slot * 0.72, bw = groupW / series.length;
    cats.forEach((_, i) => series.forEach((se, j) => {
      const v = se.values[i], x = X0 + slot * i + (slot - groupW) / 2 + j * bw;
      out += `<rect x="${x + 2}" y="${yOf(v)}" width="${bw - 4}" height="${Y0 + PH - yOf(v)}" fill="${PAL[j % PAL.length]}"/>`;
    }));
  }
  if (series.length > 1) out += legend(series.map(s => s.name), X0, height - 52);
  return out;
}

function pie(spec, height) {
  const cats = spec.x_axis.categories, vals = spec.series[0].values, sum = vals.reduce((a, b) => a + b, 0);
  const cx = 300, cy = 80 + (height - 80) / 2 - 20, R = Math.min(200, (height - 200) / 2);
  let out = header(spec.title, spec.unit), a0 = -Math.PI / 2;
  vals.forEach((v, i) => {
    const a1 = a0 + (v / sum) * 2 * Math.PI, large = a1 - a0 > Math.PI ? 1 : 0;
    const p = a => `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`;
    out += `<path d="M${cx},${cy} L${p(a0)} A${R},${R} 0 ${large} 1 ${p(a1)} Z" fill="${PAL[i % PAL.length]}" stroke="#fff" stroke-width="2"/>`;
    const am = (a0 + a1) / 2;
    out += `<text x="${cx + (R * 0.62) * Math.cos(am)}" y="${cy + (R * 0.62) * Math.sin(am) + 5}" font-size="15" font-weight="700" text-anchor="middle" fill="#fff">${+(v / sum * 100).toFixed(0)}%</text>`;
    a0 = a1;
  });
  cats.forEach((c, i) => {
    const y = cy - R + 30 + i * 46;
    out += `<rect x="580" y="${y}" width="16" height="16" fill="${PAL[i % PAL.length]}"/><text x="606" y="${y + 13}" font-size="16">${esc(c)}</text>`;
  });
  return out;
}

function table(spec) {
  const rows = spec.rows, cols = rows[0].length, X0 = 40, PW = W - 80, Y0 = 90;
  const firstW = PW * 0.26, otherW = (PW - firstW) / (cols - 1);
  const widthOf = ci => (ci === 0 ? firstW : otherW);
  let out = header(spec.title, spec.unit), y = Y0;
  rows.forEach((r, ri) => {
    const isHead = ri === 0;
    // each cell wraps to its own width; the row is as tall as its tallest cell
    const cells = r.map((c, ci) => wrapLines(c, Math.max(6, Math.floor((widthOf(ci) - 16) / (isHead ? 8.5 : 9)))));
    const rowH = Math.max(56, Math.max(...cells.map(l => l.length)) * 20 + 16);
    if (isHead) out += `<rect x="${X0}" y="${y}" width="${PW}" height="${rowH}" fill="#e2e8f0"/>`;
    let x = X0;
    r.forEach((c, ci) => {
      const w = widthOf(ci);
      out += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="none" stroke="#94a3b8"/>`;
      const cx = ci === 0 ? x + 10 : x + w / 2;
      out += multiText(cx, y + rowH / 2, cells[ci], { size: isHead ? 15 : 16, weight: isHead ? 700 : 400, anchor: ci === 0 ? 'start' : 'middle' });
      x += w;
    });
    y += rowH;
  });
  return { body: out, height: y + 30 };
}

function process(spec) {
  const steps = spec.steps, bw = 760, bh = 58, gap = 34, X = (W - bw) / 2;
  let out = header(spec.title, spec.unit);
  steps.forEach((s, i) => {
    const y = 90 + i * (bh + gap);
    out += `<rect x="${X}" y="${y}" width="${bw}" height="${bh}" rx="8" fill="#f8fafc" stroke="#334155"/>`;
    out += multiText(W / 2, y + bh / 2, wrapLines(s.label, 80), { size: 16 });
    if (i < steps.length - 1) out += `<line x1="${W / 2}" y1="${y + bh}" x2="${W / 2}" y2="${y + bh + gap}" stroke="#334155" stroke-width="2"/>`;
  });
  return out;
}

function mapPanel(snap, x0, width, height) {
  let out = `<text x="${x0 + width / 2}" y="95" font-size="18" font-weight="700" text-anchor="middle">${esc(snap.label)}</text>`;
  out += `<rect x="${x0}" y="110" width="${width}" height="${height}" fill="#fefce8" stroke="#334155"/>`;
  for (const f of snap.features) {
    const x = x0 + (f.x / 100) * width, y = 110 + (f.y / 100) * height, w = (f.w / 100) * width, h = (f.h / 100) * height;
    if (f.shape === 'river') out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#bae6fd"/>`;
    else if (f.shape === 'road') out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e2e8f0" stroke="#64748b"/>`;
    else if (f.shape === 'tree') out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#bbf7d0" stroke="#15803d" stroke-dasharray="4 3"/>`;
    else out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#334155"/>`;
    // label wraps inside its feature; a long label on a small feature overflows only as far as its own box
    out += multiText(x + w / 2, y + h / 2, wrapLines(f.label, Math.max(8, Math.floor(w / 7.5))), { size: 12, lineH: 14 });
  }
  return out;
}

function map(spec, height) {
  const [a, b] = spec.snapshots;
  let out = header(spec.title, spec.unit);
  const pw = 430;
  out += mapPanel(a, 40, pw, height - 170) + mapPanel(b, W - 40 - pw, pw, height - 170);
  return out;
}

function wrap(body, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">` +
    `<rect width="${W}" height="${height}" fill="#ffffff"/>` +
    `<g font-family="Arial, Helvetica, sans-serif" fill="#0f172a">${body}</g></svg>`;
}

// Returns { svg, height, inner } for one chart_spec. `inner` is the body without the outer <svg>, used for mixed panels.
export function chartSvg(spec) {
  let height = 620, body;
  switch (spec.kind) {
    case 'bar': case 'grouped_bar': case 'stacked_bar': case 'line': body = cartesian(spec, height); break;
    case 'pie': body = pie(spec, height); break;
    case 'table': { const t = table(spec); height = t.height; body = t.body; break; }
    case 'process': height = 110 + spec.steps.length * 92; body = process(spec); break;
    case 'map': height = 720; body = map(spec, height); break;
    case 'mixed': {
      // each panel as its own chart, stacked; the panels' notes go under the title
      const parts = spec.panels.map(p => chartSvg(p));
      height = parts.reduce((s, p) => s + p.height, 0) + 40;
      let y = 0; body = '';
      for (const p of parts) { body += `<svg x="0" y="${y}" width="${W}" height="${p.height}" viewBox="0 0 ${W} ${p.height}">${p.inner}</svg>`; y += p.height; }
      return { svg: wrap(body, height), height, inner: body };
    }
    default: throw new Error(`unsupported chart kind: ${spec.kind}`);
  }
  return { svg: wrap(body, height), height, inner: body };
}
