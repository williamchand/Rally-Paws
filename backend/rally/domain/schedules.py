"""Deterministic training-schedule templates. The model narrates; this builds."""

from __future__ import annotations

from datetime import date, timedelta

from . import catalog
from .entities import ScheduleDraft, ScheduleSession
from .errors import ValidationError

MAX_SESSIONS_PER_WEEK = 7


def build_schedule(
    goal: str,
    activity_ids: list[str],
    days_available: list[str],
    session_minutes: int,
    start: date,
    low_impact: bool = False,
) -> ScheduleDraft:
    """Build a one-week plan. Pure function; caller validates the goal text."""
    goal = goal.strip()
    if not goal:
        raise ValidationError("goal must not be empty")
    if not (10 <= session_minutes <= 300):
        raise ValidationError("session_minutes must be within [10, 300]")
    if not days_available:
        raise ValidationError("days_available must list at least one weekday")
    if len(days_available) > MAX_SESSIONS_PER_WEEK:
        raise ValidationError("days_available lists too many days")

    known = [a for a in activity_ids if catalog.get_template(a)]
    if not known:
        raise ValidationError("at least one known activity_id is required")
    if low_impact:
        gentle_first = [a for a in known if a in {"walking", "yoga", "swimming", "cycling"}]
        if gentle_first:
            known = gentle_first + [a for a in known if a not in gentle_first]

    weekday_index = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}
    days = []
    for token in days_available:
        key = token.strip().lower()[:3]
        if key not in weekday_index:
            raise ValidationError(f"unknown weekday: {token}")
        days.append(weekday_index[key])

    sessions: list[ScheduleSession] = []
    for i, weekday in enumerate(sorted(set(days))):
        delta = (weekday - start.weekday()) % 7
        day = start + timedelta(days=delta)
        activity = known[i % len(known)]
        note = "easy session" if i % 3 == 2 else "regular session"
        if i == 0:
            note = "starter session; keep it comfortable"
        sessions.append(ScheduleSession(day=day.isoformat(), activity_id=activity,
                                        minutes=session_minutes, note=note))

    assumptions = [
        f"{len(sessions)} sessions, about {session_minutes} minutes each.",
        "Includes an easy session; rest days are part of the plan.",
        "This is a general activity plan, not medical advice.",
    ]
    if low_impact:
        assumptions.append("Low-impact preference applied where possible.")
    return ScheduleDraft(goal=goal, sessions=sessions, assumptions=assumptions)
