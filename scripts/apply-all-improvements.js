/**
 * One-shot local improvements for lifeos.
 * Run from repo root: node scripts/apply-all-improvements.js
 * Then: git add -A && git commit && git push
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
run('apply-bingers-fix.js');
run('slim-series-page.js');
run('slim-movies-page.js');

console.log('\nDone. Review diffs, then:');
console.log('  git add -A');
console.log('  git commit -m "Apply lifeos improvements: DB, Bingers, slim pages"');
console.log('  git push origin master');
