"""Deterministic energy estimates (2024 Adult Compendium method).

Formulas (published, explainable; never LLM-invented)::

    gross kcal  = MET * 3.5 * weight_kg / 200 * duration_min
    active kcal = (MET - 1) * 3.5 * weight_kg / 200 * duration_min

Active subtracts resting energy approximately. Results are population-level
estimates; callers must surface the method and uncertainty, never false precision.
"""

from __future__ import annotations

from dataclasses import dataclass

from .entities import EnergyValue
from .errors import ValidationError

SOURCE = "compendium-2024"
DEFAULT_WEIGHT_RANGE_KG = (60.0, 90.0)
UNCERTAINTY_BAND = 0.15  # +/-15% Met/individual-variation band
MAX_DURATION_MIN = 24 * 60
MAX_WEIGHT_KG = 400.0


@dataclass(frozen=True)
class MetEntry:
    code: str
    activity_id: str
    label: str
    met: float


# Curated starter mappings. MET values follow the 2024 Adult Compendium of
# Physical Activities; codes below are Rally's stable mapping keys with the
# Compendium description in `label`. Review against the Compendium before launch.
MET_TABLE: tuple[MetEntry, ...] = (
    MetEntry("run-10kph", "running", "running, 6 mph (10 min/mile)", 9.8),
    MetEntry("run-8kph", "running", "running, 5 mph (12 min/mile)", 8.3),
    MetEntry("walk-brisk", "walking", "walking, 3.5 mph, brisk", 4.3),
    MetEntry("walk-moderate", "walking", "walking, 3.0 mph, moderate", 3.5),
    MetEntry("cycle-moderate", "cycling", "cycling, moderate effort", 6.8),
    MetEntry("cycle-vigorous", "cycling", "cycling, vigorous effort", 10.0),
    MetEntry("swim-moderate", "swimming", "swimming, moderate effort", 5.8),
    MetEntry("swim-vigorous", "swimming", "swimming, vigorous effort", 9.8),
    MetEntry("strength-general", "strength", "resistance training, general", 3.5),
    MetEntry("strength-vigorous", "strength", "resistance training, vigorous", 6.0),
    MetEntry("football-casual", "football", "soccer, casual, general", 7.0),
    MetEntry("football-competitive", "football", "soccer, competitive", 10.0),
    MetEntry("tennis-singles", "tennis", "tennis, singles", 8.0),
    MetEntry("tennis-doubles", "tennis", "tennis, doubles", 6.0),
    MetEntry("golf-walking", "golf", "golf, walking, carrying clubs", 4.3),
    MetEntry("golf-cart", "golf", "golf, using cart", 3.5),
    MetEntry("volleyball-casual", "volleyball", "volleyball, casual", 4.0),
    MetEntry("volleyball-competitive", "volleyball", "volleyball, competitive", 6.0),
    MetEntry("yoga-general", "yoga", "yoga, general", 2.5),
    MetEntry("hiking-general", "hiking", "hiking, general", 5.3),
)

# Activities that never get exercise-calorie estimates by default.
NON_EXERCISE_ACTIVITIES = frozenset({"chess", "esports", "other"})


def lookup_met(code: str | None, activity_id: str) -> MetEntry | None:
    if code:
        for entry in MET_TABLE:
            if entry.code == code:
                return entry
        return None
    for entry in MET_TABLE:
        if entry.activity_id == activity_id:
            return entry
    return None


def _round5(value: float) -> float:
    return round(value / 5.0) * 5.0


def estimate_energy(
    met: float,
    duration_minutes: float,
    weight_kg: float | None,
) -> EnergyValue:
    """Estimate energy for an exercise activity.

    Returns a banded active-kcal range (rounded to 5 to avoid false precision)
    plus gross kcal. Raises ValidationError on bad inputs.
    """
    if not (met > 0):
        raise ValidationError("MET must be positive")
    if not (0 < duration_minutes <= MAX_DURATION_MIN):
        raise ValidationError("duration_minutes must be within (0, 1440]")
    if weight_kg is not None and not (0 < weight_kg <= MAX_WEIGHT_KG):
        raise ValidationError("weight_kg must be within (0, 400]")

    weights = (weight_kg,) if weight_kg else DEFAULT_WEIGHT_RANGE_KG
    actives = [
        max(0.0, (met - 1.0) * 3.5 * w / 200.0 * duration_minutes) for w in weights
    ]
    gross_w = weight_kg if weight_kg else sum(weights) / len(weights)
    gross = met * 3.5 * gross_w / 200.0 * duration_minutes

    low = _round5(min(actives) * (1.0 - UNCERTAINTY_BAND))
    high = _round5(max(actives) * (1.0 + UNCERTAINTY_BAND))
    inputs: dict = {
        "met": met,
        "duration_minutes": duration_minutes,
        "weight_kg": weight_kg,
        "source": SOURCE,
    }
    if weight_kg is None:
        inputs["weight_assumption_kg"] = list(DEFAULT_WEIGHT_RANGE_KG)
        assumption = (
            "No body weight supplied; range uses a default 60-90 kg population "
            "range. Add your weight for a tighter estimate."
        )
    else:
        assumption = "Uses your supplied body weight."
    note = (
        "Population-level estimate from activity intensity and duration; not a "
        "measurement. " + assumption
    )
    return EnergyValue(
        active_kcal_low=low,
        active_kcal_high=high,
        gross_kcal=round(gross),
        source="estimated",
        method=f"MET formula ({SOURCE})",
        inputs=inputs,
        uncertainty_note=note,
    )
