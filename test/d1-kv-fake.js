// Shared in-memory fake of the Worker's D1 `kv` table (the only table worker.js uses).
// Used by test/worker-smoke.js and test/worker-host.js.
//
// Storage v2 reads a marker plus a key prefix and commits its migration through D1.batch(),
// so the fake models those surfaces as well as ordinary prepared statements. Any other SQL throws,
// so a new query in worker.js shows up here instead of silently passing.
function makeKvD1(store = new Map()) {
  const run = async (sql, params) => {
    if (sql.startsWith('INSERT INTO kv (key,value,updated_at) VALUES (?,?,?) ON CONFLICT')) {
      store.set(params[0], params[1]);
      return { success: true };
    }
    if (sql.startsWith('INSERT INTO kv (key,value,updated_at) VALUES (?,?,?)')) {
      if (store.has(params[0])) throw new Error('UNIQUE constraint failed: kv.key');
      store.set(params[0], params[1]);
      return { success: true };
    }
    // write guards: fail (UNIQUE on the existing meta key) when a shard changed since it was read
    if (sql.startsWith("INSERT INTO kv (key,value,updated_at) SELECT ?,'',0 WHERE NOT EXISTS")) {
      if (store.get(params[1]) !== params[2]) throw new Error('UNIQUE constraint failed: kv.key');
      return { success: true };
    }
    if (sql.startsWith("INSERT INTO kv (key,value,updated_at) SELECT ?,'',0 WHERE EXISTS")) {
      if (store.has(params[1])) throw new Error('UNIQUE constraint failed: kv.key');
      return { success: true };
    }
    if (sql.startsWith('DELETE FROM kv WHERE key=?')) {
      store.delete(params[0]);
      return { success: true };
    }
    throw new Error('unexpected SQL in harness: ' + sql);
  };
  return {
    _store: store,
    prepare(sql) {
      const st = {
        _params: [],
        bind(...p) { st._params = p; return st; },
        async first() {
          if (sql.startsWith('SELECT value FROM kv WHERE key=?')) { const v = store.get(st._params[0]); return v === undefined ? null : { value: v }; }
          throw new Error('unexpected SQL in harness: ' + sql);
        },
        async all() {
          if (sql.startsWith('SELECT key,value FROM kv WHERE key LIKE ?')) {
            const prefix = String(st._params[0] || '').replace(/%$/, '');
            return { results: [...store.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value })) };
          }
          throw new Error('unexpected SQL in harness: ' + sql);
        },
        async run() {
          return run(sql, st._params);
        },
      };
      return st;
    },
    // D1 batches are transactions: a failing statement rolls back the whole batch
    async batch(statements) {
      const snapshot = new Map(store);
      try { for (const statement of statements) await statement.run(); }
      catch (e) { store.clear(); for (const [k, v] of snapshot) store.set(k, v); throw e; }
      return statements.map(() => ({ success: true }));
    },
  };
}

module.exports = { makeKvD1 };
