The ES module below (saved as `solution.mjs` after your fix) is an async
loader cache. It has race-condition bugs; the failing test underneath shows
one of them. Fix the module so its intended semantics (listed below) all
hold. Reply with the complete fixed module; keep the export name.

Current module:

```js
export function createLoaderCache(loader) {
  const cache = new Map();
  return {
    async get(key) {
      if (cache.has(key)) return cache.get(key);
      const value = await loader(key);
      cache.set(key, value);
      return value;
    },
    invalidate(key) {
      cache.delete(key);
    },
  };
}
```

A failing test (loader must be deduplicated for concurrent gets):

```js
let calls = 0;
const c = createLoaderCache(async (k) => { calls++; return k.toUpperCase(); });
const [a, b] = await Promise.all([c.get('x'), c.get('x')]);
// EXPECTED: a === 'X', b === 'X', calls === 1   — ACTUAL: calls === 2
```

Intended semantics (the hidden tests check all of these):

1. Concurrent `get(key)` calls for the same key while a load is in flight
   share ONE loader call and all resolve to its value.
2. `invalidate(key)` during an in-flight load: the in-flight `get` calls
   still resolve with the value that load produces, but the cache must NOT
   retain it — the next `get(key)` after the load settles calls the loader
   again.
3. A rejected load is never cached (neither as a value nor as an in-flight
   entry): the next `get(key)` retries the loader; the rejection propagates
   to every waiter of that load.
4. Different keys load independently and concurrently.
5. After a successful, uninvalidated load, subsequent `get(key)` returns the
   cached value without calling the loader.
