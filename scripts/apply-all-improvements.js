/**
 * One-shot local improvements for lifeos.
 * Run from repo root:
 *   git pull origin master
 *   node scripts/apply-all-improvements.js
 *   git add -A && git status
 *   git commit -m "Apply improvements: DB, Bingers, slim pages"
 *   git push origin master
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(rel) {
  const p = path.join(__dirname, rel);
  if (!fs.existsSync(p)) {
    console.warn('skip missing', rel);
    return;
  }
  console.log('\n>>', rel);
  execSync('node "' + p + '"', { stdio: 'inherit' });
}

run('apply-db-patch.js');
run('fix-db-write-sync.js');
run('apply-bingers-fix.js');
run('slim-series-page.js');
run('slim-movies-page.js');

console.log('\nDone. Review diffs, then commit & push:');
console.log('  git add -A');
console.log('  git commit -m "Apply lifeos improvements: DB sync write, Bingers, slim pages"');
console.log('  git push origin master');
