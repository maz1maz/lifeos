// Remove Vite bundles that nothing references any more.
//
// The Today app builds straight into public/ (vite.today.config.mjs: outDir
// '../../public', emptyOutDir:false — it has to be false, public/ holds the
// rest of the site). That means every `npm run build:today` leaves the previous
// hashed public/assets/index-*.js|css behind: they get committed, uploaded to
// Cloudflare on every deploy, and nothing ever loads them (56 of them had piled
// up by 2026-09-24, 54 of which were dead).
//
// A bundle is "live" when public/index.html or public/today-manifest.json
// points at it. Everything else matching index-<hash>.js|css goes.
// Run automatically after the build (see package.json "build:today"), or by
// hand: node scripts/prune-stale-bundles.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const ASSETS = path.join(PUBLIC, 'assets');
const dryRun = process.argv.includes('--dry-run');

function referencedBundles() {
  const refs = new Set();
  const grab = (text) => { for (const m of String(text).matchAll(/index-[A-Za-z0-9_-]+\.(?:js|css)/g)) refs.add(m[0]); };
  const shell = path.join(PUBLIC, 'index.html');
  if (fs.existsSync(shell)) grab(fs.readFileSync(shell, 'utf8'));
  const manifest = path.join(PUBLIC, 'today-manifest.json');
  if (fs.existsSync(manifest)) grab(fs.readFileSync(manifest, 'utf8'));
  return refs;
}

function staleBundles() {
  if (!fs.existsSync(ASSETS)) return [];
  const live = referencedBundles();
  if (!live.size) throw new Error('prune-stale-bundles: public/index.html references no index-*.js bundle — refusing to delete anything');
  return fs.readdirSync(ASSETS)
    .filter((f) => /^index-[A-Za-z0-9_-]+\.(?:js|css)$/.test(f) && !live.has(f))
    .sort();
}

if (require.main === module) {
  const stale = staleBundles();
  if (!stale.length) { console.log('prune-stale-bundles: nothing to prune'); process.exit(0); }
  for (const f of stale) {
    if (!dryRun) fs.unlinkSync(path.join(ASSETS, f));
    console.log((dryRun ? 'would remove ' : 'removed ') + 'public/assets/' + f);
  }
  console.log('prune-stale-bundles: ' + stale.length + ' stale bundle(s)' + (dryRun ? ' (dry run)' : ' removed') + '; live: ' + [...referencedBundles()].join(', '));
}

module.exports = { referencedBundles, staleBundles };
