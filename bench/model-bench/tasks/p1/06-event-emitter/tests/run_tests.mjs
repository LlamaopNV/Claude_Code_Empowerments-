let Emitter;
try {
  ({ Emitter } = await import('/work/solution.mjs'));
  if (typeof Emitter !== 'function') process.exit(1);
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

check('basic-emit-order', () => {
  const em = new Emitter();
  const got = [];
  em.on('job.done', (v) => got.push(`a${v}`));
  em.on('job.done', (v) => got.push(`b${v}`));
  const n = em.emit('job.done', 1);
  return n === 2 && got.join(',') === 'a1,b1';
});

check('emit-returns-zero-when-no-match', () => {
  const em = new Emitter();
  em.on('a.b', () => {});
  return em.emit('other') === 0;
});

check('once-removed-before-invocation', () => {
  const em = new Emitter();
  let calls = 0;
  em.once('tick', () => {
    calls++;
    em.emit('tick'); // re-entrant emit must not re-trigger the once
  });
  em.emit('tick');
  em.emit('tick');
  return calls === 1;
});

check('wildcard-one-segment', () => {
  const em = new Emitter();
  let n = 0;
  em.on('user.*', () => n++);
  em.emit('user.created');
  em.emit('user.deleted');
  em.emit('user');        // segment count differs
  em.emit('user.a.b');    // segment count differs
  return n === 2;
});

check('literal-metacharacters', () => {
  const em = new Emitter();
  let plus = 0;
  em.on('metrics.cpu+mem', () => plus++);
  em.emit('metrics.cpu+mem');
  em.emit('metrics.cpuumem');  // "+" must not behave like a regex quantifier
  em.emit('metrics.cpummem');
  let dotstar = 0;
  em.on('a.*', () => dotstar++);
  em.emit('aXb');              // "." must not behave like regex any-char
  return plus === 1 && dotstar === 0;
});

check('off-removes-exact-pair', () => {
  const em = new Emitter();
  let n = 0;
  const fn = () => n++;
  em.on('e.*', fn);
  em.on('e.x', fn);
  const removed = em.off('e.*', fn);
  em.emit('e.x');
  return removed === true && n === 1 && em.off('e.*', fn) === false;
});

check('removal-during-emit-snapshot', () => {
  const em = new Emitter();
  const got = [];
  let subB;
  em.on('s', () => {
    got.push('a');
    subB.unsubscribe();          // removes b mid-emit; b must still run for THIS emit
  });
  subB = em.on('s', () => got.push('b'));
  em.emit('s');                  // snapshot [a, b]: a removes b, b runs anyway
  em.emit('s');                  // only a remains (its re-unsubscribe of b is inert)
  return got.join(',') === 'a,b,a';
});

check('addition-during-emit-not-called', () => {
  const em = new Emitter();
  let lateCalls = 0;
  em.on('s', () => {
    em.on('s', () => lateCalls++);
  });
  const n = em.emit('s');
  return n === 1 && lateCalls === 0;
});

check('using-disposes-subscription', () => {
  const em = new Emitter();
  let n = 0;
  {
    using sub = em.on('cfg.reload', () => n++);
    em.emit('cfg.reload');
    if (typeof sub[Symbol.dispose] !== 'function') return false;
  }
  em.emit('cfg.reload'); // disposed at block exit
  return n === 1;
});

check('double-dispose-inert', () => {
  const em = new Emitter();
  let n = 0;
  const sub = em.on('x', () => n++);
  sub[Symbol.dispose]();
  sub[Symbol.dispose]();
  sub.unsubscribe();
  em.emit('x');
  return n === 0;
});
