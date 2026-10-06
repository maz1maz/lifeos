// Imports the Worker (cloudflare/worker.js + cloudflare/lib/*.js) for the in-process test harnesses.
// The files are copied to a fresh temp folder under test/ so that
//  - a test can patch the source text first (verify-script-smoke builds a deliberately broken variant), and
//  - every load gets a clean module graph (no state shared between loads).
// The temp folder sits inside the repo, so the bare 'xlsx' import resolves from node_modules as usual.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const SRC = path.join(__dirname, '..', 'cloudflare');
const FILES = () => ['worker.js', ...fs.readdirSync(path.join(SRC, 'lib')).filter(f => f.endsWith('.js')).map(f => 'lib/' + f)];

// Source text of every Worker file, keyed by relative path ('worker.js', 'lib/api.js', …).
function workerSources() {
  return Object.fromEntries(FILES().map(f => [f, fs.readFileSync(path.join(SRC, f), 'utf8')]));
}

// patch(sources) may return modified sources; returns the imported module namespace ({ default, … }).
async function loadWorkerModule(patch) {
  const sources = patch ? patch(workerSources()) : workerSources();
  const dir = fs.mkdtempSync(path.join(__dirname, '.tmp-worker-'));
  try {
    fs.mkdirSync(path.join(dir, 'lib'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}\n');
    for (const [f, text] of Object.entries(sources)) fs.writeFileSync(path.join(dir, f), text);
    const mod = await import(pathToFileURL(path.join(dir, 'worker.js')).href);
    const helpers = await import(pathToFileURL(path.join(dir, 'lib', 'helpers.js')).href);
    return { ...mod, makeHelpers: helpers.makeHelpers };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { loadWorkerModule, workerSources };
