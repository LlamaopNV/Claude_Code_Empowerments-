let createLoaderCache;
try {
  ({ createLoaderCache } = await import('/work/solution.mjs'));
  if (typeof createLoaderCache !== 'function') process.exit(1);
} catch {
  process.exit(1); // zero CASE lines => COMPILE_FAIL
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function check(name, fn) {
  let ok;
  try {
    ok = Boolean(await fn());
  } catch {
    ok = false;
  }
  console.log(`CASE ${name} ${ok ? 'PASS' : 'FAIL'}`);
}

await check('dedup-concurrent-gets', async () => {
  let calls = 0;
  const c = createLoaderCache(async (k) => {
    calls++;
    await tick();
    return k.toUpperCase();
  });
  const [a, b, d] = await Promise.all([c.get('x'), c.get('x'), c.get('x')]);
  return a === 'X' && b === 'X' && d === 'X' && calls === 1;
});

await check('cached-after-success', async () => {
  let calls = 0;
  const c = createLoaderCache(async (k) => {
    calls++;
    return `${k}!`;
  });
  await c.get('a');
  await c.get('a');
  return calls === 1;
});

await check('invalidate-during-flight-no-stale-write', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((r) => (release = r));
  const c = createLoaderCache(async () => {
    calls++;
    await gate;
    return `v${calls}`;
  });
  const inflight = c.get('k');
  c.invalidate('k');           // while load 1 is still pending
  release();
  const first = await inflight;
  const second = await c.get('k'); // must reload, not reuse v1
  return first === 'v1' && second === 'v2' && calls === 2;
});

await check('rejection-not-cached-and-propagates', async () => {
  let calls = 0;
  const c = createLoaderCache(async () => {
    calls++;
    if (calls === 1) throw new Error('boom');
    return 'ok';
  });
  let firstRejected = false;
  let secondRejected = false;
  const p1 = c.get('k').catch(() => (firstRejected = true));
  const p2 = c.get('k').catch(() => (secondRejected = true));
  await Promise.all([p1, p2]);
  const retry = await c.get('k');
  return firstRejected && secondRejected && calls === 2 && retry === 'ok';
});

await check('keys-independent', async () => {
  const order = [];
  let releaseA;
  const gateA = new Promise((r) => (releaseA = r));
  const c = createLoaderCache(async (k) => {
    if (k === 'a') await gateA;
    order.push(k);
    return k;
  });
  const pa = c.get('a');
  const vb = await c.get('b'); // must not be blocked behind a's load
  releaseA();
  const va = await pa;
  return va === 'a' && vb === 'b' && order.join(',') === 'b,a';
});

await check('invalidate-unknown-key-noop', async () => {
  const c = createLoaderCache(async (k) => k);
  c.invalidate('never-loaded');
  return (await c.get('z')) === 'z';
});
