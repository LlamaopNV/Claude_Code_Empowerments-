let createMachine;
try {
  ({ createMachine } = await import('file:///tmp/out/solution.js'));
  if (typeof createMachine !== 'function') process.exit(1);
} catch {
  process.exit(1); // zero CASE lines => COMPILE_FAIL
}

function check(name, fn) {
  let ok;
  try {
    ok = Boolean(fn());
  } catch {
    ok = false;
  }
  console.log(`CASE ${name} ${ok ? 'PASS' : 'FAIL'}`);
}

const make = () =>
  createMachine({
    initial: 'idle',
    states: {
      idle: { START: 'running' },
      running: { STOP: 'idle', PAUSE: { target: 'paused', guard: (p) => p === true } },
      paused: { STOP: 'idle' },
    },
  });

check('initial-state', () => make().current() === 'idle');

check('string-transition', () => {
  const m = make();
  return m.send('START') === 'running' && m.current() === 'running';
});

check('event-not-defined-for-state-stays', () => {
  const m = make();
  m.send('START');
  return m.send('START') === 'running' && m.current() === 'running';
});

check('guard-blocks-until-true', () => {
  const m = make();
  m.send('START');
  const stayed = m.send('PAUSE', false) === 'running';
  const moved = m.send('PAUSE', true) === 'paused';
  return stayed && moved;
});

check('can-checks-without-evaluating-guard', () => {
  const m = make();
  const idleCan = m.can('START') === true && m.can('STOP') === false;
  m.send('START');
  return idleCan && m.can('PAUSE') === true; // true even though guard(undefined) is false
});

check('history-tracks-successful-transitions-only', () => {
  const m = make();
  m.send('STOP');          // no-op in idle
  m.send('START');
  m.send('PAUSE', false);  // guard blocks — not in history
  m.send('PAUSE', true);
  return m.history().join(',') === 'idle,running,paused';
});

check('history-returns-a-copy', () => {
  const m = make();
  m.history().push('bogus');
  return m.history().join(',') === 'idle';
});

check('machines-independent', () => {
  const a = make();
  const b = make();
  a.send('START');
  return a.current() === 'running' && b.current() === 'idle';
});
