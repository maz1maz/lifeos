// Downloads the 48 seasonal photos into public/assets/img/seasons.
// Usage (from the project folder):  node scripts/get-season-photos.mjs
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { SEASON_PHOTOS, unsplashUrl } from '../src/today/src/season-photos.mjs';

const dir = new URL('../public/assets/img/seasons/', import.meta.url);
await mkdir(dir, { recursive: true });
let ok = 0, fail = 0;
for (const [season, ids] of Object.entries(SEASON_PHOTOS)) {
  for (let i = 0; i < ids.length; i++) {
    const file = new URL(`${season}-${String(i + 1).padStart(2, '0')}.jpg`, dir);
    try { if ((await stat(file)).size > 10000) { ok++; continue; } } catch {}
    try {
      const res = await fetch(unsplashUrl(ids[i]));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(file, buf);
      ok++; console.log(`✓ ${season}-${i + 1}  ${Math.round(buf.length / 1024)} KB`);
    } catch (e) { fail++; console.log(`✗ ${season}-${i + 1}  ${e.message}`); }
  }
}
console.log(`\nDone: ${ok} ok, ${fail} failed`);
