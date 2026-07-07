'use strict';

let evaluateSheet;
try {
  ({ evaluateSheet } = require('/work/solution.cjs'));
  if (typeof evaluateSheet !== 'function') process.exit(1);
} catch {
  process.exit(1); // zero CASE lines => COMPILE_FAIL
}

function near(a, b) {
  return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9;
}

function check(name, cells, expected) {
  let ok;
  try {
    const out = evaluateSheet(cells);
    const keys = Object.keys(expected).sort();
    ok =
      Object.keys(out).sort().join(',') === keys.join(',') &&
      keys.every((k) => out[k] === expected[k] || near(out[k], expected[k]));
  } catch {
    ok = false;
  }
  console.log(`CASE ${name} ${ok ? 'PASS' : 'FAIL'}`);
}

check('number-cells', { A1: '42', A2: ' 7 ', A3: '-3.5', A4: '1e3' }, { A1: 42, A2: 7, A3: -3.5, A4: 1000 });
check('text-cells', { A1: 'hello', A2: '12abc' }, { A1: 'hello', A2: '12abc' });
check('precedence', { A1: '=1+2*3' }, { A1: 7 });
check('parens', { A1: '=(1+2)*3' }, { A1: 9 });
check('left-assoc-and-division', { A1: '=8-3-2', B1: '=10/4' }, { A1: 3, B1: 2.5 });
check('stacked-unary-minus', { A1: '=--5', B1: '=1--2', C1: '2', D1: '=-(-C1)' }, { A1: 5, B1: 3, C1: 2, D1: 2 });
check('exponent-invalid-in-formula', { A1: '=1e3' }, { A1: '#ERR' });
check('simple-ref', { A1: '2', B1: '=A1*3' }, { A1: 2, B1: 6 });
check('case-insensitive', { A1: '2', B1: '=a1+A1', C1: '=sum(a1:a1)' }, { A1: 2, B1: 4, C1: 2 });
check('absent-ref-is-zero', { A1: '=B7+5' }, { A1: 5 });
check('sum-range', { A1: '1', A2: '2', B1: '3', B2: '4', C1: '=SUM(A1:B2)' }, { A1: 1, A2: 2, B1: 3, B2: 4, C1: 10 });
check('range-whitespace', { A1: '1', B2: '4', C1: '=SUM(A1 : B2)' }, { A1: 1, B2: 4, C1: 5 });
check('range-reversed-corners', { A1: '1', B2: '4', C1: '=SUM(B2:A1)' }, { A1: 1, B2: 4, C1: 5 });
check('avg-counts-absent-cells', { A1: '3', C1: '=AVG(A1:B3)' }, { A1: 3, C1: 0.5 });
check('min-max', { A1: '5', A2: '-2', B1: '=MIN(A1:A2)', B2: '=MAX(A1:A2)' }, { A1: 5, A2: -2, B1: -2, B2: 5 });
check('expr-args', { A1: '2', B1: '=SUM(A1,5,3*2)' }, { A1: 2, B1: 13 });
check('avg-mixed-args', { A1: '1', A2: '3', B1: '=AVG(A1:A2, 8)' }, { A1: 1, A2: 3, B1: 4 });
check('empty-arg-list-invalid', { A1: '=SUM()' }, { A1: '#ERR' });
check('division-by-zero', { A1: '=1/0', B1: '=1/(2-2)' }, { A1: '#ERR', B1: '#ERR' });
check('text-ref-is-err', { A1: 'abc', B1: '=A1+1' }, { A1: 'abc', B1: '#ERR' });
check('text-in-range-is-err', { A1: 'abc', A2: '1', B1: '=SUM(A1:A2)' }, { A1: 'abc', A2: 1, B1: '#ERR' });
check('err-propagates', { A1: '=1/0', B1: '=A1+1' }, { A1: '#ERR', B1: '#ERR' });
check('self-cycle', { A1: '=A1' }, { A1: '#CIRC' });
check('pair-cycle', { A1: '=B1', B1: '=A1' }, { A1: '#CIRC', B1: '#CIRC' });
check('cycle-observer-is-err', { A1: '=B1', B1: '=A1', C1: '=A1+1' }, { A1: '#CIRC', B1: '#CIRC', C1: '#ERR' });
check('wide-columns', { AA1: '5', A1: '=AA1*2' }, { AA1: 5, A1: 10 });
check('syntax-errors', { A1: '=1+', B1: '=2 3', C1: '=A1:B2' }, { A1: '#ERR', B1: '#ERR', C1: '#ERR' });
check('whitespace-in-formula', { A1: '= 1 + 2 ' }, { A1: 3 });
