type Transition = string | { target: string; guard?: (payload: unknown) => boolean };

type Config = {
  initial: string;
  states: Record<string, Record<string, Transition>>;
};

type StateOf<C extends Config> = keyof C['states'] & string;
type EventOf<C extends Config> = {
  [K in StateOf<C>]: keyof C['states'][K] & string;
}[StateOf<C>];

export function createMachine<const C extends Config>(config: C) {
  type S = StateOf<C>;
  type E = EventOf<C>;
  let state = config.initial as S;
  const visited: S[] = [state];
  const table = config.states as Record<string, Record<string, Transition> | undefined>;

  return {
    current(): S {
      return state;
    },
    can(event: E): boolean {
      const row = table[state];
      return row !== undefined && Object.prototype.hasOwnProperty.call(row, event);
    },
    send(event: E, payload?: unknown): S {
      const def = table[state]?.[event];
      if (def === undefined) return state;
      const target = typeof def === 'string' ? def : def.target;
      const guard = typeof def === 'string' ? undefined : def.guard;
      if (guard && !guard(payload)) return state;
      state = target as S;
      visited.push(state);
      return state;
    },
    history(): readonly S[] {
      return [...visited];
    },
  };
}
