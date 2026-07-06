Write a Python module (saved as `solution.py`) defining one function:

    resolve(requirements: dict[str, str], index: dict) -> dict[str, str]

A package-version resolver with backtracking and cycle detection.

Inputs:

- `index` maps package name -> {version_string: {dep_name: constraint, ...}}.
  Example: {"a": {"1.0.0": {"b": ">=1.0.0"}, "2.0.0": {}}, "b": {"1.0.0": {}}}
- `requirements` maps package name -> constraint for the root set.
- A version string is 1-3 dot-separated non-negative integers ("2", "1.4",
  "1.4.2"). Compare numerically per component; missing components are 0
  ("1.4" == "1.4.0" for ordering and equality).
- A constraint is one or more comma-separated clauses; each clause is an
  operator (==, !=, >=, <=, >, <) immediately followed by a version, e.g.
  ">=1.2,<2.0". A version satisfies the constraint iff it satisfies every
  clause. Whitespace around clauses must be tolerated.

Required behavior (follow exactly):

- Return a dict mapping every package needed (transitively) to the single
  chosen version string exactly as it appears in the index.
- Deterministic choice: always prefer the HIGHEST satisfying version, and
  backtrack to lower ones only when the search dead-ends. Resolve packages
  depth-first in the order they are first encountered, iterating each
  package's requirements in dict insertion order.
- If a package or any satisfying version cannot be found under the current
  constraints anywhere in the search, raise
  ValueError("unsatisfiable: <package>") for the package that dead-ended
  last at the top of the failed search.
- Cycle detection: while expanding dependencies depth-first, if a dependency
  edge points at a package currently on the expansion stack, raise
  ValueError starting with "cycle: " followed by the stack members from the
  repeated package to the edge source joined by "->", then "->" and the
  repeated package again (e.g. "cycle: a->b->a").
- A package may be required by several parents (diamonds are fine); the
  chosen version must satisfy ALL constraints that referenced it. If a later
  constraint conflicts with an already-chosen version, backtracking must
  reconsider earlier choices.
- Unknown package in requirements or deps => the "unsatisfiable" ValueError.
- Use only the Python standard library.
