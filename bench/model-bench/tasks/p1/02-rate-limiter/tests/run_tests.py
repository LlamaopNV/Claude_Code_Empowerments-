import sys

sys.path.insert(0, "/work")

try:
    from solution import SlidingWindowRateLimiter
except Exception:
    sys.exit(1)  # zero CASE lines => COMPILE_FAIL


class Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


def check(name, fn):
    try:
        ok = bool(fn())
    except Exception:
        ok = False
    print(f"CASE {name} {'PASS' if ok else 'FAIL'}")


def case_under_limit():
    c = Clock()
    rl = SlidingWindowRateLimiter(3, 10.0, c)
    return rl.allow("k") and rl.allow("k") and rl.allow("k")


def case_at_limit_denied():
    c = Clock()
    rl = SlidingWindowRateLimiter(2, 10.0, c)
    rl.allow("k"); rl.allow("k")
    return rl.allow("k") is False


def case_expiry_exact_boundary():
    c = Clock()
    rl = SlidingWindowRateLimiter(1, 10.0, c)
    rl.allow("k")
    c.t = 10.0  # exactly window old => expired
    return rl.allow("k") is True


def case_window_slides():
    c = Clock()
    rl = SlidingWindowRateLimiter(2, 10.0, c)
    c.t = 0.0; rl.allow("k")
    c.t = 6.0; rl.allow("k")
    c.t = 9.0
    if rl.allow("k"):
        return False          # still 2 in window
    c.t = 11.0                 # call at t=0 expired, t=6 remains
    return rl.allow("k") is True


def case_denied_calls_do_not_count():
    c = Clock()
    rl = SlidingWindowRateLimiter(1, 10.0, c)
    rl.allow("k")
    c.t = 5.0
    rl.allow("k")              # denied — must not extend the window
    c.t = 10.0                 # original call expired
    return rl.allow("k") is True


def case_keys_independent():
    c = Clock()
    rl = SlidingWindowRateLimiter(1, 10.0, c)
    return rl.allow("a") and rl.allow("b") and (rl.allow("a") is False)


def case_count_reports_without_recording():
    c = Clock()
    rl = SlidingWindowRateLimiter(3, 10.0, c)
    rl.allow("k"); rl.allow("k")
    n1 = rl.count("k")
    n2 = rl.count("k")         # count() must not record
    c.t = 10.0
    return n1 == 2 and n2 == 2 and rl.count("k") == 0 and rl.count("nope") == 0


def case_fractional_times():
    c = Clock()
    rl = SlidingWindowRateLimiter(1, 0.5, c)
    c.t = 0.25; rl.allow("k")
    c.t = 0.5
    if rl.allow("k"):
        return False           # only 0.25 s elapsed
    c.t = 0.75                 # exactly 0.5 s elapsed => expired
    return rl.allow("k") is True


def case_invalid_ctor():
    for args in ((0, 10.0), (-1, 10.0), (1, 0.0), (1, -2.0)):
        try:
            SlidingWindowRateLimiter(args[0], args[1], Clock())
            return False
        except ValueError:
            pass
        except Exception:
            return False
    return True


def case_memory_pruned():
    c = Clock()
    rl = SlidingWindowRateLimiter(1000, 1.0, c)
    for i in range(1000):
        c.t = float(i)
        rl.allow("k")
    # after 1000 spaced calls only the last one is in-window; internal storage
    # must have been pruned to something near that (allow 8x slack for impls
    # that prune lazily on the next touch)
    c.t = 1000.0
    rl.count("k")
    total = 0
    for v in vars(rl).values():
        try:
            total += sum(len(inner) for inner in v.values())
        except Exception:
            pass
    return total <= 8


check("under-limit", case_under_limit)
check("at-limit-denied", case_at_limit_denied)
check("expiry-exact-boundary", case_expiry_exact_boundary)
check("window-slides", case_window_slides)
check("denied-not-counted", case_denied_calls_do_not_count)
check("keys-independent", case_keys_independent)
check("count-no-record", case_count_reports_without_recording)
check("fractional-times", case_fractional_times)
check("invalid-ctor", case_invalid_ctor)
check("memory-pruned", case_memory_pruned)
