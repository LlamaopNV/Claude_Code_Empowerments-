function matches(pattern, event) {
  const p = pattern.split('.');
  const e = event.split('.');
  if (p.length !== e.length) return false;
  return p.every((seg, i) => seg === '*' || seg === e[i]);
}

export class Emitter {
  #subs = [];

  #add(pattern, fn, once) {
    const entry = { pattern, fn, once, active: true };
    this.#subs.push(entry);
    const unsubscribe = () => {
      entry.active = false;
      const i = this.#subs.indexOf(entry);
      if (i !== -1) this.#subs.splice(i, 1);
    };
    return { unsubscribe, [Symbol.dispose]: unsubscribe };
  }

  on(pattern, fn) {
    return this.#add(pattern, fn, false);
  }

  once(pattern, fn) {
    return this.#add(pattern, fn, true);
  }

  off(pattern, fn) {
    const i = this.#subs.findIndex((s) => s.pattern === pattern && s.fn === fn);
    if (i === -1) return false;
    this.#subs[i].active = false;
    this.#subs.splice(i, 1);
    return true;
  }

  emit(event, ...args) {
    const snapshot = this.#subs.filter((s) => matches(s.pattern, event));
    let called = 0;
    for (const s of snapshot) {
      if (s.once) {
        if (!s.active) continue;      // a once consumed earlier in this emit
        s.active = false;
        const i = this.#subs.indexOf(s);
        if (i !== -1) this.#subs.splice(i, 1);
      }
      called++;
      s.fn(...args);
    }
    return called;
  }
}
