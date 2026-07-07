import sys

sys.path.insert(0, "/work")

VALID = [
    ("seconds", "PT5S", 5.0),
    ("minutes", "PT15M", 900.0),
    ("hours", "PT1H", 3600.0),
    ("days", "P1D", 86400.0),
    ("weeks", "P1W", 604800.0),
    ("years", "P1Y", 31536000.0),
    ("months", "P2M", 5184000.0),
    ("combined", "P1DT2H3M4.5S", 93784.5),
    ("fractional-hours", "PT0.5H", 1800.0),
    ("minute-seconds", "PT1M30S", 90.0),
    ("zero", "PT0S", 0.0),
    ("full-date-part", "P1Y2M3W4D", 31536000.0 + 5184000.0 + 1814400.0 + 345600.0),
    ("months-and-minutes", "P1MT2M", 2592120.0),
]
INVALID = [
    ("empty", ""),
    ("bare-p", "P"),
    ("bare-pt", "PT"),
    ("no-p", "15M"),
    ("negative", "P-1D"),
    ("missing-unit", "PT1H30"),
    ("unknown-unit", "P1X"),
    ("fraction-not-last", "P0.5DT1H"),
    ("duplicate-unit", "PT1H1H"),
    ("wrong-order", "PT1S1M"),
]

try:
    from solution import parse_duration
except Exception:
    sys.exit(1)  # zero CASE lines => COMPILE_FAIL

for name, s, want in VALID:
    try:
        ok = abs(parse_duration(s) - want) < 1e-6
    except Exception:
        ok = False
    print(f"CASE {name} {'PASS' if ok else 'FAIL'}")

for name, s in INVALID:
    try:
        parse_duration(s)
        ok = False
    except ValueError:
        ok = True
    except Exception:
        ok = False
    print(f"CASE invalid-{name} {'PASS' if ok else 'FAIL'}")
