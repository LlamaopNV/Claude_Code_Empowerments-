const decode = (s) => decodeURIComponent(s.replace(/\+/g, ' '));

export function parseQuery(qs) {
  let s = qs.startsWith('?') ? qs.slice(1) : qs;
  const out = {};
  if (!s) return out;
  for (const pair of s.split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const rawKey = i === -1 ? pair : pair.slice(0, i);
    const value = i === -1 ? '' : decode(pair.slice(i + 1));
    const m = rawKey.match(/^([^[]+)((?:\[[^\]]*\])*)$/);
    if (!m) continue;
    const path = [decode(m[1]), ...[...m[2].matchAll(/\[([^\]]*)\]/g)].map((b) => decode(b[1]))];
    let node = out;
    for (let d = 0; d < path.length - 1; d++) {
      const key = path[d];
      const nextIsArray = path[d + 1] === '';
      if (typeof node[key] !== 'object' || node[key] === null) node[key] = nextIsArray ? [] : {};
      node = node[key];
    }
    const leaf = path[path.length - 1];
    if (leaf === '') node.push(value);
    else node[leaf] = value;
  }
  return out;
}
