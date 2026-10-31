"""Core entities. Plain dataclasses; no web, DB, or provider imports."""

from __future__ import annotations

from dataclasses import dataclass


ValueSource = str  # "measured" | "user_entered" | "sensor_derived" | "estimated"


@dataclass(frozen=True)
class EnergyValue:
    """A calorie figure with mandatory provenance."""

    active_kcal_low: float | None
    active_kcal_high: float | None
    gross_kcal: float | None
    source: ValueSource
    method: str
    inputs: dict
    uncertainty_note: str

    def display(self) -> str:
        if self.active_kcal_low is None or self.active_kcal_high is None:
            return "calorie estimate unavailable"
        low = int(round(self.active_kcal_low))
        high = int(round(self.active_kcal_high))
        if low == high:
            return f"about {low} active kcal (estimate)"
        return f"about {low}-{high} active kcal (estimate)"


@dataclass(frozen=True)
class ScheduleSession:
    day: str  # ISO date
    activity_id: str
    minutes: int
    note: str


@dataclass(frozen=True)
class ScheduleDraft:
    goal: str
    sessions: list
    assumptions: list
