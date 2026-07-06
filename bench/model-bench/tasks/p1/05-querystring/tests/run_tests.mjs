function eq(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => eq(a[k], b[k]));
}

const CASES = [
  ['simple', 'a=1&b=2', { a: '1', b: '2' }],
  ['leading-question', '?a=1', { a: '1' }],
  ['empty', '', {}],
  ['no-equals', 'flag&x=1', { flag: '', x: '1' }],
  ['decoding', 'q=hello+world&amp=%26', { q: 'hello world', amp: '&' }],
  ['nested', 'a[b][c]=1', { a: { b: { c: '1' } } }],
  ['array', 'list[]=x&list[]=y', { list: ['x', 'y'] }],
  ['sibling-merge', 'a[b]=1&a[c]=2', { a: { b: '1', c: '2' } }],
  ['last-wins', 'x=1&x=2', { x: '2' }],
  ['deep', 'a[b][c][d]=z', { a: { b: { c: { d: 'z' } } } }],
  ['encoded-key', 'user%20name=jo', { 'user name': 'jo' }],
  ['array-of-objects-keys', 'p[x]=1&p[y]=2&q[]=a', { p: { x: '1', y: '2' }, q: ['a'] }],
];

let parseQuery;
try {
  ({ parseQuery } = await import('/work/solution.mjs'));
  if (typeof parseQuery !== 'function') process.exit(1);
} catch {
  process.exit(1); // zero CASE lines => COMPILE_FAIL
}

for (const [name, input, want] of CASES) {
  let ok;
  try {
    ok = eq(parseQuery(input), want);
  } catch {
    ok = false;
  }
  console.log(`CASE ${name} ${ok ? 'PASS' : 'FAIL'}`);
}
