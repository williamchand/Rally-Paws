"""Registered model tools: JSON schemas plus validated, user-scoped execution.

The model may only request tools listed in TOOL_SCHEMAS. Every call is
validated as untrusted input; write tools return drafts, never persistence.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..domain import catalog, estimates, schedules, venues
from ..domain.errors import ValidationError
from . import confirm

TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "prepare_activity_log",
            "description": "Turn a described activity into an editable draft form. Draft only; never saves.",
            "parameters": {
                "type": "object",
                "properties": {
                    "activity": {"type": "string", "description": "Activity name, alias, or id, e.g. 'tennis'"},
                    "duration_minutes": {"type": "number"},
                    "score_fields": {"type": "object", "description": "Sport-specific fields from the catalog, e.g. {score: '6-4 6-3', result: 'win'}. Field names must match the catalog exactly."},
                    "weight_kg": {"type": "number"},
                    "intensity": {"type": "string", "description": "Optional MET code from the catalog"},
                    "started_at": {"type": "string", "description": "ISO-8601 start with timezone offset, e.g. '2026-10-30T18:30:00+01:00'. Infer from the user's words (yesterday, this morning, after lunch) against today's date; omit when unclear."},
                },
                "required": ["activity", "duration_minutes"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "estimate_activity_energy",
            "description": "Deterministic calorie estimate from catalog MET data. Returns assumptions and uncertainty.",
            "parameters": {
                "type": "object",
                "properties": {
                    "activity": {"type": "string"},
                    "duration_minutes": {"type": "number"},
                    "weight_kg": {"type": "number"},
                    "intensity": {"type": "string", "description": "Optional MET code from the catalog"},
                },
                "required": ["activity", "duration_minutes"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "build_training_schedule",
            "description": "Draft a one-week session plan. General activity plan, not medical advice.",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal": {"type": "string"},
                    "activities": {"type": "array", "items": {"type": "string"}},
                    "days_available": {"type": "array", "items": {"type": "string"}},
                    "session_minutes": {"type": "number"},
                    "low_impact": {"type": "boolean"},
                },
                "required": ["goal", "activities", "days_available", "session_minutes"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_venues",
            "description": "Search the demo venue dataset (Jakarta sample data) by sport, city, or keywords. Always tell the user results are sample data.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sport": {"type": "string", "description": "Sport hint, e.g. 'padel'. Omit when the user names none."},
                    "city": {"type": "string", "description": "City hint, e.g. 'Jakarta'. Omit when the user names none."},
                    "query": {"type": "string", "description": "Free keywords, e.g. 'outdoor tennis'. Omit when sport/city suffice."},
                },
                "required": [],
                "additionalProperties": False,
            },
        },
    },
]


@dataclass
class ToolContext:
    confirm_secret: str
    default_weight_kg: float | None = None
    timezone: str | None = None  # IANA name for naive started_at; UTC fallback


@dataclass
class ToolOutcome:
    result: dict
    card: dict | None = None


def _resolve_activity(raw: Any) -> str:
    if not isinstance(raw, str):
        raise ValidationError("activity must be a string")
    resolved = catalog.resolve_activity_id(raw)
    if not resolved:
        known = ", ".join(t.id for t in catalog.TEMPLATES)
        raise ValidationError(f"unknown activity '{raw}'. Known: {known}")
    return resolved


def _duration(raw: Any) -> float:
    try:
        value = float(raw)
    except (TypeError, ValueError) as exc:
        raise ValidationError("duration_minutes must be a number") from exc
    if not (0 < value <= estimates.MAX_DURATION_MIN):
        raise ValidationError("duration_minutes must be within (0, 1440]")
    return value


def _weight(raw: Any, default: float | None) -> float | None:
    if raw is None:
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError) as exc:
        raise ValidationError("weight_kg must be a number") from exc
    if not (0 < value <= estimates.MAX_WEIGHT_KG):
        raise ValidationError("weight_kg must be within (0, 400]")
    return value


def _parse_started_at(raw: Any, tz_name: str | None) -> str | None:
    """Validate a model- or user-supplied start time; None when omitted."""
    if raw is None or raw == "":
        return None
    if not isinstance(raw, str):
        raise ValidationError("started_at must be ISO-8601")
    try:
        value = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise ValidationError("started_at must be ISO-8601") from exc
    if value.tzinfo is None:
        try:
            zone = ZoneInfo(tz_name) if tz_name else timezone.utc
        except (ZoneInfoNotFoundError, ValueError):
            zone = timezone.utc
        value = value.replace(tzinfo=zone)
    if value > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise ValidationError("started_at can't be in the future")
    return value.isoformat()


def _score_fields(template, raw_fields: Any) -> dict:
    """Keep known score fields with kind-correct values.

    Unknown names are stripped; nulls are dropped as unset. Select values
    match case-insensitively and normalize to the canonical option so a
    result of "Win" still saves as "win". Anything else raises so the
    model gets error feedback and can retry.
    """
    if not isinstance(raw_fields, dict):
        raise ValidationError("score_fields must be an object")
    defs = {f.name: f for f in template.score_fields}
    fields: dict = {}
    for name, value in raw_fields.items():
        spec = defs.get(name)
        if spec is None:
            continue  # unknown field: strip it
        if value is None:
            continue  # unset: drop it
        if spec.kind == "select":
            if not isinstance(value, str):
                raise ValidationError(f"score field '{name}' must be one of {list(spec.options)}")
            hit = next((o for o in spec.options if o.lower() == value.strip().lower()), None)
            if hit is None:
                raise ValidationError(f"score field '{name}' must be one of {list(spec.options)}")
            fields[name] = hit
        elif spec.kind == "number":
            if isinstance(value, bool):
                raise ValidationError(f"score field '{name}' must be a number")
            if isinstance(value, (int, float)):
                fields[name] = value
            elif isinstance(value, str):
                try:
                    fields[name] = float(value.strip())
                except ValueError as exc:
                    raise ValidationError(f"score field '{name}' must be a number") from exc
            else:
                raise ValidationError(f"score field '{name}' must be a number")
        else:  # text, duration, future free-form kinds
            if not isinstance(value, (str, int, float)) or isinstance(value, bool):
                raise ValidationError(f"score field '{name}' must be text or a number")
            fields[name] = value
    return fields


def _estimate_for(activity_id: str, duration: float, weight: float | None,
                  intensity: Any) -> dict | None:
    if activity_id in estimates.NON_EXERCISE_ACTIVITIES:
        return None
    code = intensity if isinstance(intensity, str) else None
    entry = estimates.lookup_met(code, activity_id)
    if entry is None:
        if code:
            raise ValidationError(f"unknown intensity code '{code}'")
        return None
    value = estimates.estimate_energy(entry.met, duration, weight)
    return {
        "display": value.display(),
        "met_code": entry.code,
        "met": entry.met,
        "active_kcal_low": value.active_kcal_low,
        "active_kcal_high": value.active_kcal_high,
        "gross_kcal": value.gross_kcal,
        "method": value.method,
        "inputs": value.inputs,
        "uncertainty_note": value.uncertainty_note,
    }


class ToolExecutor:
    def __init__(self, ctx: ToolContext):
        self.ctx = ctx

    def execute(self, name: str, arguments: dict) -> ToolOutcome:
        if not isinstance(arguments, dict):
            raise ValidationError("tool arguments must be an object")
        handler = {
            "prepare_activity_log": self._prepare_activity_log,
            "estimate_activity_energy": self._estimate_activity_energy,
            "build_training_schedule": self._build_training_schedule,
            "find_venues": self._find_venues,
        }.get(name)
        if handler is None:
            raise ValidationError(f"unregistered tool '{name}'")
        return handler(arguments)

    def _prepare_activity_log(self, args: dict) -> ToolOutcome:
        activity_id = _resolve_activity(args.get("activity"))
        duration = _duration(args.get("duration_minutes"))
        weight = _weight(args.get("weight_kg"), self.ctx.default_weight_kg)
        raw_fields = args.get("score_fields") or {}
        template = catalog.get_template(activity_id)
        assert template is not None
        fields = _score_fields(template, raw_fields)
        started_iso = _parse_started_at(args.get("started_at"), self.ctx.timezone)
        code = args.get("intensity") if isinstance(args.get("intensity"), str) else None
        entry = estimates.lookup_met(code, activity_id)
        if code and entry is None:
            raise ValidationError(f"unknown intensity code '{code}'")
        estimate = None
        if activity_id not in estimates.NON_EXERCISE_ACTIVITIES and entry is not None:
            value = estimates.estimate_energy(entry.met, duration, weight)
            estimate = {
                "display": value.display(),
                "met_code": entry.code,
                "met": entry.met,
                "active_kcal_low": value.active_kcal_low,
                "active_kcal_high": value.active_kcal_high,
                "gross_kcal": value.gross_kcal,
                "method": value.method,
                "inputs": value.inputs,
                "uncertainty_note": value.uncertainty_note,
            }
        draft = {
            "activity_id": activity_id,
            "duration_minutes": duration,
            "fields": fields,
            "weight_kg": weight,
            "started_at": started_iso,
            "intensity": entry.code if entry else None,
        }
        token = confirm.mint_token(draft, self.ctx.confirm_secret)
        card = {
            "type": "activity_draft",
            "activity_id": activity_id,
            "activity_name": template.name,
            "duration_minutes": duration,
            "fields": fields,
            "started_at": started_iso,
            "estimate": estimate,
            "draft": draft,
            "confirm_token": token,
            "confirm_hint": "Review the draft and tap Confirm to save. Nothing is saved yet.",
        }
        return ToolOutcome(result={"draft": draft, "confirm_token": token, "estimate": estimate}, card=card)

    def _estimate_activity_energy(self, args: dict) -> ToolOutcome:
        activity_id = _resolve_activity(args.get("activity"))
        duration = _duration(args.get("duration_minutes"))
        weight = _weight(args.get("weight_kg"), self.ctx.default_weight_kg)
        estimate = _estimate_for(activity_id, duration, weight, args.get("intensity"))
        if estimate is None:
            result = {
                "available": False,
                "reason": "This activity tracks sessions and results, not exercise calories.",
            }
            return ToolOutcome(result=result, card={"type": "estimate", "activity_id": activity_id, **result})
        return ToolOutcome(result={"available": True, **estimate},
                           card={"type": "estimate", "activity_id": activity_id, "available": True, **estimate})

    def _build_training_schedule(self, args: dict) -> ToolOutcome:
        goal = args.get("goal")
        if not isinstance(goal, str) or not goal.strip():
            raise ValidationError("goal must be a non-empty string")
        raw_activities = args.get("activities")
        if not isinstance(raw_activities, list) or not raw_activities:
            raise ValidationError("activities must be a non-empty list")
        activity_ids = [_resolve_activity(a) for a in raw_activities]
        days = args.get("days_available")
        if not isinstance(days, list) or not all(isinstance(d, str) for d in days):
            raise ValidationError("days_available must be a list of weekday names")
        try:
            minutes = int(args.get("session_minutes"))
        except (TypeError, ValueError) as exc:
            raise ValidationError("session_minutes must be a number") from exc
        low_impact = bool(args.get("low_impact", False))
        draft = schedules.build_schedule(goal, activity_ids, days, minutes, date.today(), low_impact)
        result = {
            "goal": draft.goal,
            "sessions": [{"day": s.day, "activity_id": s.activity_id, "minutes": s.minutes, "note": s.note}
                         for s in draft.sessions],
            "assumptions": draft.assumptions,
        }
        return ToolOutcome(result=result, card={"type": "schedule", **result})

    def _find_venues(self, args: dict) -> ToolOutcome:
        sport = args.get("sport") if isinstance(args.get("sport"), str) else None
        city = args.get("city") if isinstance(args.get("city"), str) else None
        query = args.get("query") if isinstance(args.get("query"), str) else None
        hits = venues.search_venues(sport=sport, city=city, query=query)
        items = [{
            "venue_id": v["id"],
            "name": v["name"],
            "city": v["city"],
            "distance_km": v["distance_km"],
            "rating": v["rating"],
            "reviews": v["reviews"],
            "tags": v["tags"],
        } for v in hits]
        if items:
            note = f"Demo data: {len(items)} sample venue(s). Real availability search is planned."
        else:
            note = "No demo venues match. Try another sport, city, or 'near me'."
        result = {"venues": items, "count": len(items), "source": "demo", "note": note}
        return ToolOutcome(result=result, card={"type": "venues", **result})
