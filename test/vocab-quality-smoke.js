const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'vocab', 'words.json'), 'utf8'));
const byWord = new Map(rows.map(row => [row[0], row]));
assert.equal(rows.length, 7167, 'the repair must not drop cards');

for (const word of ['gore', 'lin', 'lower', 'related', 'involved', 'limited', 'process', 'main', 'amount', 'various']) {
  const row = byWord.get(word);
  assert.ok(row, `missing ${word}`);
  assert.ok(row[1].length && row[5] && row[10], `incomplete ${word}`);
  assert.deepEqual(row[7], [], `stale synonym on ${word}`);
  if (row[6]) assert.match(row[6], new RegExp(`\\b${word}(?:s|d|ed|ing)?\\b`, 'i'), `irrelevant example on ${word}`);
}
assert.doesNotMatch(byWord.get('gore')[5], /Vice President|Clinton/i);
assert.doesNotMatch(byWord.get('lin')[5], /sculptor|architect/i);
assert.equal(byWord.get('gore')[11].length, 2, 'noun and verb senses should remain distinct');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'vocab', 'index.html'), 'utf8');
assert.match(html, /\.fc>\.face\{overflow:visible;max-height:none/, 'flashcard answer must not have a nested scroll');
console.log('Vocabulary quality smoke passed.');
