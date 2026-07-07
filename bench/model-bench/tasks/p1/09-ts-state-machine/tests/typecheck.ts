import { createMachine } from './solution';

const m = createMachine({
  initial: 'idle',
  states: {
    idle: { START: 'running' },
    running: { STOP: 'idle', PAUSE: { target: 'paused', guard: (p: unknown) => p === true } },
    paused: { STOP: 'idle' },
  },
});

// state union must be inferred from the literal
const s: 'idle' | 'running' | 'paused' = m.current();
void s;
const h: readonly ('idle' | 'running' | 'paused')[] = m.history();
void h;

m.send('START');
m.can('PAUSE');

// @ts-expect-error unknown event names must be rejected at compile time
m.send('NOPE');

// @ts-expect-error unknown event names must be rejected by can() too
m.can('NOPE');
