"""XP economy and pet growth. Pure rules; persistence lives in adapters."""

from __future__ import annotations

from dataclasses import dataclass

BASE_SESSION_XP = 10
PERSONAL_BEST_BONUS_XP = 5
CONSISTENCY_BONUS_XP = 2
MAX_CONSISTENCY_BONUS_XP = 6
DAILY_XP_CAP = 100


@dataclass(frozen=True)
class XpAward:
    total: int
    parts: tuple[tuple[str, int], ...]
    capped: bool


def award_for_session(
    personal_best: bool,
    consecutive_active_days: int,
    xp_already_today: int,
) -> XpAward:
    """XP for one confirmed session. Rewards showing up, not volume."""
    parts: list[tuple[str, int]] = [("session", BASE_SESSION_XP)]
    if personal_best:
        parts.append(("personal_best", PERSONAL_BEST_BONUS_XP))
    if consecutive_active_days >= 2:
        bonus = min(MAX_CONSISTENCY_BONUS_XP, (consecutive_active_days - 1) * CONSISTENCY_BONUS_XP)
        parts.append(("consistency", bonus))
    total = sum(amount for _, amount in parts)
    room = max(0, DAILY_XP_CAP - max(0, xp_already_today))
    if total > room:
        return XpAward(total=room, parts=tuple(parts), capped=True)
    return XpAward(total=total, parts=tuple(parts), capped=False)
