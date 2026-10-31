"""Deterministic estimate formula: published math, no invented precision."""

import pytest

from rally.domain import estimates
from rally.domain.errors import ValidationError


def test_formula_known_weight():
    # MET 8, 60 min, 70 kg: active = 7*3.5*70/200*60 = 514.5
    value = estimates.estimate_energy(8.0, 60.0, 70.0)
    assert value.source == "estimated"
    assert value.gross_kcal == pytest.approx(8 * 3.5 * 70 / 200 * 60)
    assert value.active_kcal_low == pytest.approx(435.0)   # 514.5 * 0.85 -> 5
    assert value.active_kcal_high == pytest.approx(590.0)  # 514.5 * 1.15 -> 5
    assert "not a measurement" in value.uncertainty_note
    assert "180" not in value.display()  # display reflects computed band
    assert "estimate" in value.display()


def test_unknown_weight_uses_disclosed_range():
    value = estimates.estimate_energy(8.0, 60.0, None)
    assert value.inputs["weight_assumption_kg"] == [60.0, 90.0]
    assert "60-90" in value.uncertainty_note
    assert value.active_kcal_low < value.active_kcal_high


def test_invalid_inputs_rejected():
    with pytest.raises(ValidationError):
        estimates.estimate_energy(0, 30, 70)
    with pytest.raises(ValidationError):
        estimates.estimate_energy(8.0, 0, 70)
    with pytest.raises(ValidationError):
        estimates.estimate_energy(8.0, 30, 0)
    with pytest.raises(ValidationError):
        estimates.estimate_energy(8.0, 30, 500)


def test_non_exercise_and_lookup():
    assert "chess" in estimates.NON_EXERCISE_ACTIVITIES
    assert "esports" in estimates.NON_EXERCISE_ACTIVITIES
    entry = estimates.lookup_met(None, "tennis")
    assert entry is not None and entry.activity_id == "tennis"
    assert estimates.lookup_met("nope", "tennis") is None
