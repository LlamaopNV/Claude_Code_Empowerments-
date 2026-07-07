Write a JavaScript ES module (saved as `solution.mjs`, runs on Node 24)
exporting one class:

    export class Emitter

API and exact semantics:

- `on(pattern, fn)` — subscribe. Returns a subscription object with an
  `unsubscribe()` method AND a `[Symbol.dispose]()` method that does the same
  thing, so a subscription works with a `using` declaration.
- `once(pattern, fn)` — like `on`, but the listener is removed immediately
  BEFORE its first invocation (so an emit performed inside the callback can
  never re-trigger it). Same return shape.
- `off(pattern, fn)` — removes the first subscription registered with exactly
  this pattern string and this function reference; returns true if one was
  removed, false otherwise.
- `emit(event, ...args)` — calls every matching listener with `...args`,
  in registration order, and returns the number of listeners invoked.

Pattern matching:

- Event names and patterns are dot-separated segments, e.g. "user.created".
- In a pattern, a segment that is exactly `*` matches EXACTLY ONE segment of
  any content. `emit` always receives a concrete event name (no wildcards).
- Every other segment matches only by literal string equality — characters
  like `+ ( ) [ ] ?` have no special meaning ("metrics.cpu+mem" is just a
  name). A pattern matches only if segment counts are equal ("user.*" does
  NOT match "user.a.b").

Re-entrancy (pin these exactly):

- `emit` operates on a snapshot of the subscription list taken when it
  starts: listeners removed during that emit are still called for it, and
  listeners added during that emit are NOT called for it.
- A disposed/unsubscribed subscription is inert: double-dispose is a no-op,
  and `unsubscribe` after `off` is a no-op.

No dependencies; do not use Node's events module.
