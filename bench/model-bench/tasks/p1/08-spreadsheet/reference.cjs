'use strict';

const FUNCS = new Set(['SUM', 'AVG', 'MIN', 'MAX']);

function isNumberCell(raw) {
  const t = raw.trim();
  return t !== '' && Number.isFinite(Number(t));
}

function colToNum(s) {
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function numToCol(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellCoord(name) {
  const m = /^([A-Z]+)([0-9]+)$/.exec(name);
  return m ? { col: colToNum(m[1]), row: Number(m[2]) } : null;
}

function rangeCells(a, b) {
  const ca = cellCoord(a);
  const cb = cellCoord(b);
  const cells = [];
  for (let c = Math.min(ca.col, cb.col); c <= Math.max(ca.col, cb.col); c++) {
    for (let r = Math.min(ca.row, cb.row); r <= Math.max(ca.row, cb.row); r++) {
      cells.push(numToCol(c) + r);
    }
  }
  return cells;
}

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t') { i += 1; continue; }
    if ('+-*/(),:'.includes(ch)) { toks.push({ t: ch }); i += 1; continue; }
    let m = /^[0-9]+(?:\.[0-9]+)?/.exec(src.slice(i));
    if (m) { toks.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue; }
    m = /^[A-Za-z]+[0-9]*/.exec(src.slice(i));
    if (m) { toks.push({ t: 'ident', v: m[0].toUpperCase() }); i += m[0].length; continue; }
    throw new Error('bad char');
  }
  return toks;
}

function parseFormula(src) {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const eat = (t) => {
    if (!toks[pos] || toks[pos].t !== t) throw new Error(`expected ${t}`);
    return toks[pos++];
  };
  function expr() {
    let node = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = toks[pos++].t;
      node = { k: 'bin', op, l: node, r: term() };
    }
    return node;
  }
  function term() {
    let node = factor();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = toks[pos++].t;
      node = { k: 'bin', op, l: node, r: factor() };
    }
    return node;
  }
  function factor() {
    const tk = peek();
    if (!tk) throw new Error('eof');
    if (tk.t === '-') { pos += 1; return { k: 'neg', e: factor() }; }
    if (tk.t === 'num') { pos += 1; return { k: 'num', v: tk.v }; }
    if (tk.t === '(') { pos += 1; const e = expr(); eat(')'); return e; }
    if (tk.t === 'ident') {
      pos += 1;
      if (FUNCS.has(tk.v) && peek() && peek().t === '(') {
        pos += 1; // functions require >= 1 argument: arg() throws on ')'
        const args = [arg()];
        while (peek() && peek().t === ',') { pos += 1; args.push(arg()); }
        eat(')');
        return { k: 'call', fn: tk.v, args };
      }
      if (!cellCoord(tk.v)) throw new Error('bad ref');
      return { k: 'ref', name: tk.v };
    }
    throw new Error('unexpected token');
  }
  function arg() {
    const tk = peek();
    if (tk && tk.t === 'ident' && cellCoord(tk.v) && toks[pos + 1] && toks[pos + 1].t === ':') {
      pos += 2;
      const b = eat('ident');
      if (!cellCoord(b.v)) throw new Error('bad range corner');
      return { k: 'range', a: tk.v, b: b.v };
    }
    return expr();
  }
  const node = expr();
  if (pos !== toks.length) throw new Error('trailing tokens');
  return node;
}

function staticRefs(node, out) {
  if (node.k === 'ref') out.push(node.name);
  else if (node.k === 'range') out.push(...rangeCells(node.a, node.b));
  else if (node.k === 'neg') staticRefs(node.e, out);
  else if (node.k === 'bin') { staticRefs(node.l, out); staticRefs(node.r, out); }
  else if (node.k === 'call') node.args.forEach((a) => staticRefs(a, out));
  return out;
}

function evaluateSheet(cells) {
  const keys = Object.keys(cells);
  const canon = new Map(); // UPPERCASE name -> actual input key
  for (const k of keys) canon.set(k.toUpperCase(), k);

  const kind = new Map();
  for (const k of keys) {
    const raw = cells[k];
    if (isNumberCell(raw)) kind.set(k, { kind: 'num', v: Number(raw.trim()) });
    else if (raw.startsWith('=')) {
      let ast = null;
      try { ast = parseFormula(raw.slice(1)); } catch { ast = null; }
      kind.set(k, { kind: 'formula', ast });
    } else kind.set(k, { kind: 'text' });
  }

  // Static dependency graph over PRESENT cells (absent refs are the constant
  // 0 and can never be part of a cycle).
  const deps = new Map();
  for (const k of keys) {
    const info = kind.get(k);
    if (info.kind !== 'formula' || !info.ast) { deps.set(k, []); continue; }
    deps.set(k, staticRefs(info.ast, []).map((r) => canon.get(r)).filter((r) => r !== undefined));
  }

  // Tarjan SCC: members of any cycle (size > 1, or a self-loop) are #CIRC.
  const circ = new Set();
  const index = new Map();
  const low = new Map();
  const onstack = new Set();
  const stack = [];
  let counter = 0;
  function strongconnect(v) {
    index.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onstack.add(v);
    for (const w of deps.get(v)) {
      if (!index.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onstack.has(w)) {
        low.set(v, Math.min(low.get(v), index.get(w)));
      }
    }
    if (low.get(v) === index.get(v)) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        onstack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1 || deps.get(v).includes(v)) comp.forEach((c) => circ.add(c));
    }
  }
  for (const k of keys) if (!index.has(k)) strongconnect(k);

  const memo = new Map();
  const ERR = new Error('#ERR');

  function cellValue(key) {
    if (memo.has(key)) return memo.get(key);
    const info = kind.get(key);
    let out;
    if (info.kind === 'num') out = info.v;
    else if (info.kind === 'text') out = cells[key];
    else if (circ.has(key)) out = '#CIRC';
    else if (!info.ast) out = '#ERR';
    else {
      try {
        out = evalNode(info.ast);
      } catch {
        out = '#ERR';
      }
    }
    memo.set(key, out);
    return out;
  }

  function refNum(upperName) {
    const key = canon.get(upperName);
    if (key === undefined) return 0;
    const v = cellValue(key);
    if (typeof v !== 'number') throw ERR; // text cell, #ERR, or #CIRC
    return v;
  }

  function evalNode(n) {
    if (n.k === 'num') return n.v;
    if (n.k === 'neg') return -evalNode(n.e);
    if (n.k === 'ref') return refNum(n.name);
    if (n.k === 'bin') {
      const l = evalNode(n.l);
      const r = evalNode(n.r);
      if (n.op === '+') return l + r;
      if (n.op === '-') return l - r;
      if (n.op === '*') return l * r;
      if (r === 0) throw ERR;
      return l / r;
    }
    const values = [];
    for (const a of n.args) {
      if (a.k === 'range') for (const cell of rangeCells(a.a, a.b)) values.push(refNum(cell));
      else values.push(evalNode(a));
    }
    if (n.fn === 'SUM') return values.reduce((x, y) => x + y, 0);
    if (n.fn === 'AVG') return values.reduce((x, y) => x + y, 0) / values.length;
    if (n.fn === 'MIN') return Math.min(...values);
    return Math.max(...values); // MAX
  }

  const out = {};
  for (const k of keys) out[k] = cellValue(k);
  return out;
}

module.exports = { evaluateSheet };
