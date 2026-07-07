def _ver(s):
    parts = s.strip().split(".")
    nums = [int(p) for p in parts]
    while len(nums) < 3:
        nums.append(0)
    return tuple(nums)


_OPS = ["==", "!=", ">=", "<=", ">", "<"]  # two-char ops first


def _clauses(constraint):
    out = []
    for raw in constraint.split(","):
        raw = raw.strip()
        for op in _OPS:
            if raw.startswith(op):
                out.append((op, _ver(raw[len(op):])))
                break
        else:
            raise ValueError(f"bad constraint clause: {raw}")
    return out


def _satisfies(version, clauses):
    v = _ver(version)
    for op, w in clauses:
        if op == "==" and not v == w:
            return False
        if op == "!=" and not v != w:
            return False
        if op == ">=" and not v >= w:
            return False
        if op == "<=" and not v <= w:
            return False
        if op == ">" and not v > w:
            return False
        if op == "<" and not v < w:
            return False
    return True


def resolve(requirements, index):
    last_dead_end = [None]

    def meets(version, clause_lists):
        return all(_satisfies(version, cl) for cl in clause_lists)

    # queue entries are (pkg, constraint, expansion_stack). A package's deps
    # are prepended to the SAME queue (with the extended stack) so that a
    # failure anywhere later in the queue backtracks into every earlier
    # version loop — a nested sub-solve would lose that continuation.
    def solve(queue, chosen, constraints):
        if not queue:
            return chosen
        pkg, constraint, stack = queue[0]
        rest = queue[1:]
        clauses = _clauses(constraint)
        if pkg in stack:
            cycle = stack[stack.index(pkg):] + [pkg]
            raise ValueError("cycle: " + "->".join(cycle))
        merged = {**constraints, pkg: constraints.get(pkg, []) + [clauses]}
        if pkg in chosen:
            if meets(chosen[pkg], merged[pkg]):
                return solve(rest, chosen, merged)
            last_dead_end[0] = pkg
            return None  # conflict with an earlier choice: force backtracking
        if pkg not in index:
            last_dead_end[0] = pkg
            return None
        cands = [v for v in sorted(index[pkg], key=_ver, reverse=True) if meets(v, merged[pkg])]
        if not cands:
            last_dead_end[0] = pkg
            return None
        for v in cands:
            deps = [(d, c, stack + [pkg]) for d, c in index[pkg][v].items()]
            result = solve(deps + rest, {**chosen, pkg: v}, merged)
            if result is not None:
                return result
        return None

    root_queue = [(p, c, []) for p, c in requirements.items()]
    result = solve(root_queue, {}, {})
    if result is None:
        raise ValueError(f"unsatisfiable: {last_dead_end[0]}")
    return result
