"""In-memory per-IP rate limiting for abuse-prone endpoints (chat)."""

from __future__ import annotations

import time
from collections import deque


class RateLimiter:
    def __init__(self, max_calls: int = 20, window_s: float = 60.0):
        self.max_calls = max_calls
        self.window_s = window_s
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        queue = self._hits.setdefault(key, deque())
        while queue and now - queue[0] > self.window_s:
            queue.popleft()
        if len(queue) >= self.max_calls:
            return False
        queue.append(now)
        return True
