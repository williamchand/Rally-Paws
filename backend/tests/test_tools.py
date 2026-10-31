"""Tool validation: untrusted model args fail safely; writes stay drafts."""

from datetime import datetime, timedelta, timezone

import pytest

from rally.application import confirm
from rally.application.tools import TOOL_SCHEMAS, ToolContext, ToolExecutor
from rally.domain.errors import ValidationError

SECRET = "test-secret-not-for-production"


def executor(**kwargs):
    ctx = ToolContext(confirm_secret=SECRET, **kwargs)
    return ToolExecutor(ctx)


def test_prepare_draft_returns_token_not_persistence():
    outcome = executor().execute("prepare_activity_log", {
        "activity": "tennis", "duration_minutes": 60,
        "score_fields": {"format": "singles", "injected": "drop-me"},
    })
    assert outcome.card["type"] == "activity_draft"
    assert "injected" not in outcome.card["fields"]  # unknown fields stripped
    confirm.verify_token(outcome.result["draft"], outcome.result["confirm_token"], SECRET)


def test_score_field_values_validated_by_kind():
    # Select values normalize case-insensitively to the canonical option.
    out = executor().execute("prepare_activity_log", {
        "activity": "tennis", "duration_minutes": 60,
        "score_fields": {"format": "Singles", "result": "Win", "score": "6-4 6-3"},
    })
    assert out.card["fields"] == {"format": "singles", "result": "win", "score": "6-4 6-3"}
    # Nulls drop out as unset; numeric strings coerce for number fields.
    out = executor().execute("prepare_activity_log", {
        "activity": "running", "duration_minutes": 30,
        "score_fields": {"distance_km": "5.2", "route": None},
    })
    assert out.card["fields"] == {"distance_km": 5.2}


def test_score_field_values_rejected():
    with pytest.raises(ValidationError, match="must be one of"):
        executor().execute("prepare_activity_log", {
            "activity": "tennis", "duration_minutes": 60,
            "score_fields": {"result": "won"}})
    with pytest.raises(ValidationError, match="must be a number"):
        executor().execute("prepare_activity_log", {
            "activity": "running", "duration_minutes": 30,
            "score_fields": {"distance_km": "far"}})
    with pytest.raises(ValidationError, match="must be text or a number"):
        executor().execute("prepare_activity_log", {
            "activity": "tennis", "duration_minutes": 60,
            "score_fields": {"opponent": {"name": "Sam"}}})
    with pytest.raises(ValidationError, match="score_fields must be an object"):
        executor().execute("prepare_activity_log", {
            "activity": "tennis", "duration_minutes": 60, "score_fields": ["singles"]})


def test_unknown_activity_and_tool_rejected():
    with pytest.raises(ValidationError, match="unknown activity"):
        executor().execute("prepare_activity_log", {"activity": "quidditch", "duration_minutes": 30})
    with pytest.raises(ValidationError, match="unregistered tool"):
        executor().execute("delete_everything", {})
    with pytest.raises(ValidationError, match="unregistered tool"):
        executor().execute("get_activity_summary", {})
    with pytest.raises(ValidationError, match="unregistered tool"):
        executor().execute("get_personal_records", {"activity": "tennis"})
    with pytest.raises(ValidationError):
        executor().execute("prepare_activity_log", {"activity": "tennis", "duration_minutes": -5})


def test_chess_has_no_exercise_estimate():
    outcome = executor().execute("estimate_activity_energy",
                                 {"activity": "chess", "duration_minutes": 45})
    assert outcome.result["available"] is False


def test_estimate_uses_default_weight():
    outcome = executor(default_weight_kg=70.0).execute(
        "estimate_activity_energy", {"activity": "running", "duration_minutes": 30})
    assert outcome.result["available"] is True
    assert outcome.result["inputs"]["weight_kg"] == 70.0


def test_find_venues_jakarta_padel_nearest_first():
    outcome = executor().execute("find_venues", {"sport": "padel", "city": "Jakarta"})
    ids = [v["venue_id"] for v in outcome.card["venues"]]
    assert ids == ["riverside-padel", "senayan-padel"]
    assert outcome.card["source"] == "demo"


def test_find_venues_query_and_alias():
    outcome = executor().execute("find_venues", {"query": "tennis jakarta"})
    ids = {v["venue_id"] for v in outcome.card["venues"]}
    assert ids == {"greenfield-tennis", "kemang-tennis"}
    outcome = executor().execute("find_venues", {"sport": "soccer"})
    assert [v["venue_id"] for v in outcome.card["venues"]] == ["city-sports-hall"]


def test_find_venues_no_match_and_unfiltered():
    outcome = executor().execute("find_venues", {"sport": "padel", "city": "Bandung"})
    assert outcome.card["venues"] == []
    assert "No demo venues" in outcome.card["note"]
    outcome = executor().execute("find_venues", {})
    ids = [v["venue_id"] for v in outcome.card["venues"]]
    assert ids == ["riverside-padel", "greenfield-tennis", "city-sports-hall",
                   "senayan-padel", "kemang-tennis"]
    outcome = executor().execute("find_venues", {"query": "near me"})
    assert len(outcome.card["venues"]) == 5


def test_schedule_validation():
    outcome = executor().execute("build_training_schedule", {
        "goal": "Run twice a week", "activities": ["running"],
        "days_available": ["mon", "thu"], "session_minutes": 30})
    assert len(outcome.result["sessions"]) == 2
    with pytest.raises(ValidationError):
        executor().execute("build_training_schedule", {
            "goal": "x", "activities": ["quidditch"],
            "days_available": ["mon"], "session_minutes": 30})


def test_started_at_passthrough():
    past = "2024-05-01T18:30:00+02:00"
    out = executor().execute("prepare_activity_log", {
        "activity": "tennis", "duration_minutes": 60, "started_at": past})
    assert out.card["started_at"] == past
    assert out.card["draft"]["started_at"] == past


def test_started_at_future_rejected():
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    with pytest.raises(ValidationError, match="future"):
        executor().execute("prepare_activity_log", {
            "activity": "tennis", "duration_minutes": 60, "started_at": future})


def test_started_at_naive_uses_timezone():
    out = executor(timezone="Europe/Paris").execute("prepare_activity_log", {
        "activity": "tennis", "duration_minutes": 60, "started_at": "2024-01-15T18:30:00"})
    assert out.card["started_at"] == "2024-01-15T18:30:00+01:00"
    fallback = executor(timezone="Not/AZone").execute("prepare_activity_log", {
        "activity": "tennis", "duration_minutes": 60, "started_at": "2024-01-15T18:30:00"})
    assert fallback.card["started_at"] == "2024-01-15T18:30:00+00:00"


def test_started_at_garbage_rejected():
    with pytest.raises(ValidationError, match="ISO-8601"):
        executor().execute("prepare_activity_log", {
            "activity": "tennis", "duration_minutes": 60, "started_at": "whenever"})


def test_schemas_are_function_tools():
    names = {t["function"]["name"] for t in TOOL_SCHEMAS}
    assert names == {"prepare_activity_log", "estimate_activity_energy",
                     "build_training_schedule", "find_venues"}
