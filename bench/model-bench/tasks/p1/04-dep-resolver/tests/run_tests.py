import sys

sys.path.insert(0, "/work")

try:
    from solution import resolve
except Exception:
    sys.exit(1)  # zero CASE lines => COMPILE_FAIL


def check(name, fn):
    try:
        ok = bool(fn())
    except Exception:
        ok = False
    print(f"CASE {name} {'PASS' if ok else 'FAIL'}")


def expect_error(fn, prefix):
    try:
        fn()
        return False
    except ValueError as e:
        return str(e).startswith(prefix)
    except Exception:
        return False


IDX_SIMPLE = {
    "a": {"1.0.0": {"b": ">=1.0.0"}},
    "b": {"1.0.0": {}, "2.0.0": {}},
}

check("simple-transitive", lambda: resolve({"a": "==1.0.0"}, IDX_SIMPLE) == {"a": "1.0.0", "b": "2.0.0"})

check("prefers-highest", lambda: resolve({"b": ">=1.0.0"}, IDX_SIMPLE) == {"b": "2.0.0"})

check("upper-bound", lambda: resolve({"b": ">=1.0.0,<2.0.0"}, IDX_SIMPLE) == {"b": "1.0.0"})


IDX_BACKTRACK = {
    "a": {"1.0.0": {"b": ">=1.0.0", "c": "==1.0.0"}},
    "b": {"2.0.0": {"d": "==2.0.0"}, "1.0.0": {"d": "==1.0.0"}},
    "c": {"1.0.0": {"d": "==1.0.0"}},
    "d": {"2.0.0": {}, "1.0.0": {}},
}

check(
    "backtracks",
    lambda: resolve({"a": "==1.0.0"}, IDX_BACKTRACK)
    == {"a": "1.0.0", "b": "1.0.0", "c": "1.0.0", "d": "1.0.0"},
)


IDX_DIAMOND = {
    "root": {"1.0.0": {"left": "==1.0.0", "right": "==1.0.0"}},
    "left": {"1.0.0": {"shared": ">=1.0.0"}},
    "right": {"1.0.0": {"shared": "<3.0.0"}},
    "shared": {"3.0.0": {}, "2.5.0": {}, "1.0.0": {}},
}

check(
    "diamond-merges-constraints",
    lambda: resolve({"root": "==1.0.0"}, IDX_DIAMOND)["shared"] == "2.5.0",
)


check(
    "numeric-not-lexicographic",
    lambda: resolve({"p": ">=1.9.0"}, {"p": {"1.9.0": {}, "1.10.0": {}}}) == {"p": "1.10.0"},
)

check(
    "short-version-equality",
    lambda: resolve({"p": "==1.4.0"}, {"p": {"1.4": {}}}) == {"p": "1.4"},
)

check(
    "not-equal-clause",
    lambda: resolve({"p": ">=1.0.0,!=2.0.0"}, {"p": {"2.0.0": {}, "1.5.0": {}}}) == {"p": "1.5.0"},
)

check(
    "whitespace-in-constraints",
    lambda: resolve({"p": " >=1.0.0 , <2.0.0 "}, {"p": {"1.5.0": {}, "2.0.0": {}}}) == {"p": "1.5.0"},
)

IDX_CYCLE = {
    "a": {"1.0.0": {"b": "==1.0.0"}},
    "b": {"1.0.0": {"a": "==1.0.0"}},
}

check("cycle-detected", lambda: expect_error(lambda: resolve({"a": "==1.0.0"}, IDX_CYCLE), "cycle: "))

check(
    "self-cycle",
    lambda: expect_error(
        lambda: resolve({"a": "==1.0.0"}, {"a": {"1.0.0": {"a": "==1.0.0"}}}), "cycle: a->a"
    ),
)

check(
    "unsatisfiable-conflict",
    lambda: expect_error(
        lambda: resolve(
            {"x": "==1.0.0", "y": "==1.0.0"},
            {
                "x": {"1.0.0": {"z": "==1.0.0"}},
                "y": {"1.0.0": {"z": "==2.0.0"}},
                "z": {"1.0.0": {}, "2.0.0": {}},
            },
        ),
        "unsatisfiable: ",
    ),
)

check(
    "unknown-package",
    lambda: expect_error(lambda: resolve({"ghost": ">=1.0.0"}, {}), "unsatisfiable: ghost"),
)
