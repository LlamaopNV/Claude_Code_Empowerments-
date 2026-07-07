from collections import deque


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: float, clock):
        if not isinstance(limit, int) or limit < 1:
            raise ValueError("limit must be >= 1")
        if window_seconds <= 0:
            raise ValueError("window_seconds must be > 0")
        self._limit = limit
        self._window = float(window_seconds)
        self._clock = clock
        self._calls = {}  # key -> deque[timestamps]

    def _prune(self, key, now):
        q = self._calls.get(key)
        if q is None:
            q = deque()
            self._calls[key] = q
        while q and now - q[0] >= self._window:
            q.popleft()
        return q

    def allow(self, key: str) -> bool:
        now = self._clock()
        q = self._prune(key, now)
        if len(q) >= self._limit:
            return False
        q.append(now)
        return True

    def count(self, key: str) -> int:
        return len(self._prune(key, self._clock()))
