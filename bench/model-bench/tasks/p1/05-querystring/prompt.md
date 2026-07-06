Write a JavaScript ES module (it will be saved as `solution.mjs`) exporting one
function:

    export function parseQuery(qs)

It parses a URL query string into a plain object, supporting nested bracket
keys. Rules (follow exactly):

- A leading `?` is stripped if present. The empty string returns `{}`.
- Pairs are separated by `&`. A pair without `=` gets the value `''`.
- Keys and values are percent-decoded; `+` decodes to a space (in both).
- Bracket syntax nests objects: `a[b][c]=1` → `{ a: { b: { c: '1' } } }`.
- Empty brackets append to an array: `list[]=x&list[]=y` → `{ list: ['x', 'y'] }`.
- Sibling bracket keys merge: `a[b]=1&a[c]=2` → `{ a: { b: '1', c: '2' } }`.
- A repeated plain key keeps the LAST value: `x=1&x=2` → `{ x: '2' }`.
- All leaf values are strings. Do not use Node's `querystring` module; the URL/
  URLSearchParams API may be used only for percent-decoding if you wish.
