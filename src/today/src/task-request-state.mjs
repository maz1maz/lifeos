// Per-view request ordering. Delayed older reads cannot replace a newer snapshot,
// and a second click on an item cannot submit a second mutation while refreshing.
export function createTaskRequestState() {
  let revision = 0;
  const pending = new Map();
  return {
    beginRead: () => ++revision,
    isCurrent: token => token === revision,
    run(key, action) {
      if (pending.has(key)) return pending.get(key);
      ++revision;
      const request = Promise.resolve().then(action).finally(() => pending.delete(key));
      pending.set(key, request);
      return request;
    },
  };
}
