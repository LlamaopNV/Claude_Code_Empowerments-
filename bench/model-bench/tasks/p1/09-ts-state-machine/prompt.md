Write a TypeScript module (saved as `solution.ts`) exporting one function:

    export function createMachine(config)

It builds a typed finite state machine. Config shape:

    {
      initial: <state name>,
      states: {
        <state name>: {
          <event name>: <target state name>
                        | { target: <target state name>,
                            guard?: (payload: unknown) => boolean },
          ...
        },
        ...
      }
    }

The returned machine:

- `current()` — the current state name.
- `send(event, payload?)` — if the CURRENT state defines `event`: when the
  transition has a guard, call it with `payload` and stay put unless it
  returns true; otherwise move to the target. If the current state does not
  define `event`, stay put. Returns the (possibly unchanged) current state.
- `can(event)` — true iff the current state defines `event`. Guards are NOT
  evaluated by `can`.
- `history()` — array of visited state names: the initial state plus one
  entry per successful transition, in order. Must return a copy (mutating it
  must not affect the machine).

Typing requirements (graded by compilation under `tsc --strict` with
TypeScript 5.9 — any type error scores zero):

- The state-name and event-name unions must be INFERRED from the config
  object literal (e.g. via a `const` type parameter). Do not require the
  caller to pass explicit type arguments.
- `current()` and `history()` entries are typed as the union of state names
  in `config.states`.
- `send` and `can` accept ONLY the union of event names that appear in any
  state of the config; passing any other string literal must be a compile
  error. Our hidden type-assertion file checks this with @ts-expect-error.
- The module itself must compile cleanly under --strict (no implicit any).

Runtime rule: two machines created from separate configs are fully
independent. No dependencies.
