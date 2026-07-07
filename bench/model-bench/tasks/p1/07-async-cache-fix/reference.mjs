export function createLoaderCache(loader) {
  const cache = new Map();    // key -> settled value
  const inflight = new Map(); // key -> { promise } token; invalidate() swaps the token
  return {
    async get(key) {
      if (cache.has(key)) return cache.get(key);
      let token = inflight.get(key);
      if (!token) {
        token = {};
        token.promise = (async () => {
          try {
            const value = await loader(key);
            // Only the token that is still current may populate the cache;
            // invalidate() during the flight replaces/clears it.
            if (inflight.get(key) === token) {
              cache.set(key, value);
              inflight.delete(key);
            }
            return value;
          } catch (err) {
            if (inflight.get(key) === token) inflight.delete(key);
            throw err;
          }
        })();
        inflight.set(key, token);
      }
      return token.promise;
    },
    invalidate(key) {
      cache.delete(key);
      inflight.delete(key); // in-flight waiters still resolve; result is not retained
    },
  };
}
