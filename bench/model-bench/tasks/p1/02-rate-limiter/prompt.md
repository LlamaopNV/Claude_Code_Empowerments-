Write a Python module (it will be saved as `solution.py`) defining one class:

    class SlidingWindowRateLimiter:
        def __init__(self, limit: int, window_seconds: float, clock): ...
        def allow(self, key: str) -> bool: ...
        def count(self, key: str) -> int: ...

A sliding-window-log rate limiter. `clock` is a zero-argument callable
returning the current time as a float in seconds (it is injected so tests can
simulate time; never call time.time() yourself).

Rules (follow exactly):

- `allow(key)` returns True and records the call if fewer than `limit`
  *allowed* calls for that key happened strictly inside the sliding window;
  otherwise it returns False and records nothing. Denied calls never count
  toward any window.
- An allowed call made at time s stops counting as soon as now - s >=
  window_seconds (a call exactly window_seconds old has expired).
- `count(key)` returns how many previously allowed calls for `key` are still
  inside the window at the current clock time, without recording anything.
- Keys are independent; an unknown key starts empty.
- Fractional times must work (the clock may return e.g. 0.25).
- `__init__` raises ValueError if limit < 1 or window_seconds <= 0.
- Memory must not grow unboundedly per key: expired timestamps must be
  discarded during allow()/count() calls.
- Use only the Python standard library.
