"""First-party activity taxonomy: stable IDs, aliases, scoring schemas, MET links."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ScoreField:
    name: str
    label: str
    kind: str  # "number" | "text" | "select" | "duration"
    unit: str | None = None
    options: tuple[str, ...] = ()
    required: bool = False


@dataclass(frozen=True)
class ActivityTemplate:
    id: str
    name: str
    category: str  # sport | exercise | recreation | mind | esport | movement
    aliases: tuple[str, ...] = ()
    score_fields: tuple[ScoreField, ...] = ()
    met_codes: tuple[str, ...] = ()
    record_metrics: tuple[str, ...] = ()
    flexible: bool = False


def _n(name: str, label: str, unit: str | None = None, required: bool = False) -> ScoreField:
    return ScoreField(name=name, label=label, kind="number", unit=unit, required=required)


def _t(name: str, label: str) -> ScoreField:
    return ScoreField(name=name, label=label, kind="text")


def _s(name: str, label: str, *options: str) -> ScoreField:
    return ScoreField(name=name, label=label, kind="select", options=options)


TEMPLATES: tuple[ActivityTemplate, ...] = (
    ActivityTemplate("running", "Running", "sport", ("run", "jog"),
        (_n("distance_km", "Distance", "km"), _n("avg_pace_min_per_km", "Avg pace", "min/km"),
         _s("effort", "Effort", "easy", "moderate", "hard"), _t("route", "Route (optional)")),
        ("run-8kph", "run-10kph"), ("distance_km_max", "best_pace_min_per_km")),
    ActivityTemplate("walking", "Walking", "movement", ("walk",),
        (_n("distance_km", "Distance", "km"), _n("steps", "Steps"), _s("effort", "Effort", "easy", "moderate", "brisk")),
        ("walk-moderate", "walk-brisk"), ("distance_km_max",)),
    ActivityTemplate("cycling", "Cycling", "sport", ("bike", "ride"),
        (_n("distance_km", "Distance", "km"), _n("avg_speed_kph", "Avg speed", "km/h"), _s("effort", "Effort", "easy", "moderate", "hard")),
        ("cycle-moderate", "cycle-vigorous"), ("distance_km_max",)),
    ActivityTemplate("swimming", "Swimming", "sport", ("swim",),
        (_n("distance_m", "Distance", "m"), _n("pool_length_m", "Pool length", "m"), _s("stroke", "Stroke", "freestyle", "breaststroke", "backstroke", "butterfly", "mixed")),
        ("swim-moderate", "swim-vigorous"), ("distance_m_max",)),
    ActivityTemplate("strength", "Gym / strength", "exercise", ("gym", "weights", "lifting"),
        (_t("exercises", "Exercises (e.g. squat 3x5 @ 80kg)"), _n("top_set_kg", "Top set", "kg"), _n("total_sets", "Total sets")),
        ("strength-general", "strength-vigorous"), ("top_set_kg_max",)),
    ActivityTemplate("football", "Football / soccer", "sport", ("soccer",),
        (_s("session", "Session", "match", "practice"), _n("goals", "Goals"), _n("assists", "Assists"),
         _s("result", "Result", "win", "draw", "loss", "n/a"), _t("team", "Team (optional)")),
        ("football-casual", "football-competitive"), ()),
    ActivityTemplate("tennis", "Tennis", "sport", (),
        (_s("format", "Format", "singles", "doubles", "practice"), _t("score", "Score (e.g. 6-4 6-3)"),
         _s("result", "Result", "win", "loss", "n/a"), _t("opponent", "Opponent (optional)")),
        ("tennis-singles", "tennis-doubles"), ()),
    ActivityTemplate("golf", "Golf", "sport", (),
        (_t("course", "Course"), _n("holes", "Holes"), _n("strokes", "Strokes"), _n("putts", "Putts"), _n("handicap", "Handicap")),
        ("golf-walking", "golf-cart"), ("strokes_18_min",)),
    ActivityTemplate("volleyball", "Volleyball", "sport", (),
        (_s("session", "Session", "match", "practice"), _t("score", "Score (sets)"),
         _s("result", "Result", "win", "loss", "n/a"), _t("position", "Position (optional)")),
        ("volleyball-casual", "volleyball-competitive"), ()),
    ActivityTemplate("yoga", "Yoga / mobility", "exercise", ("mobility", "stretching"),
        (_s("style", "Style", "gentle", "vinyasa", "power", "mobility"), _s("effort", "Effort", "easy", "moderate", "hard")),
        ("yoga-general",), ()),
    ActivityTemplate("hiking", "Hiking", "recreation", ("hike", "trek"),
        (_n("distance_km", "Distance", "km"), _n("elevation_m", "Elevation gain", "m")),
        ("hiking-general",), ("distance_km_max",)),
    ActivityTemplate("chess", "Chess", "mind", (),
        (_s("time_control", "Time control", "bullet", "blitz", "rapid", "classical", "puzzle", "study"),
         _s("result", "Result", "win", "draw", "loss", "n/a"), _n("rating", "Rating"), _n("puzzles", "Puzzles solved")),
        (), ("rating_max",)),
    ActivityTemplate("esports", "Esports", "esport", ("gaming",),
        (_t("title", "Game title"), _t("mode", "Mode"), _s("result", "Result", "win", "loss", "draw", "n/a"),
         _t("rank", "Rank (optional)"), _t("practice_goal", "Practice goal (optional)")),
        (), ()),
    ActivityTemplate("other", "Other activity", "recreation", ("custom",),
        (_t("name", "Activity name"), _s("effort", "Effort", "light", "moderate", "hard"), _t("notes", "Notes")),
        (), (), flexible=True),
)

_BY_ID = {t.id: t for t in TEMPLATES}
_BY_ALIAS = {alias: t.id for t in TEMPLATES for alias in (t.id, t.name.lower(), *t.aliases)}


def get_template(activity_id: str) -> ActivityTemplate | None:
    return _BY_ID.get(activity_id)


def resolve_activity_id(text: str) -> str | None:
    return _BY_ALIAS.get(text.strip().lower())


def describe_for_model() -> str:
    """Compact catalog summary for the model prompt."""
    lines = []
    for t in TEMPLATES:
        fields = ", ".join(f.name for f in t.score_fields) or "none"
        lines.append(f"- {t.id} ({t.name}, {t.category}): {fields}")
    return "\n".join(lines)
