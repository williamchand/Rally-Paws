"""Use cases: chat orchestration, drafts, confirmation, estimates, schedules.

The backend is stateless: history, XP totals, and records live in the
browser. The only external service called here is the Muse Spark model API.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..domain import catalog, estimates, xp
from ..domain.billing import parse_entitlement
from ..domain.errors import ConfirmationError, ValidationError
from . import confirm
from .ports import BillingPort, ChatMessage, ModelPort
from .tools import TOOL_SCHEMAS, ToolContext, ToolExecutor

SYSTEM_PROMPT = """You are Rally, a friendly activity coach inside the Rally app.
Rules you must follow:
- Use the registered tools for drafts, estimates, and schedules. Never invent calorie numbers, records, or venues.
- prepare_activity_log only prepares an editable draft. Nothing is saved until the user taps Confirm in the app. Say so.
- When the user hints at when the session happened (yesterday, this morning, after lunch, last night), resolve it against today's date below and pass started_at with the timezone offset. Omit started_at only when there is no hint. Never ask for a date/time the user already implied.
- Calorie figures are estimates, never measurements. Always keep the estimate label and uncertainty note.
- Never claim a workout, GPS session, save, share, or purchase happened unless a tool result or the user confirms it did.
- Chess and esports track sessions and results, not exercise calories.
- For venue, court, or place-to-play questions, call find_venues (a small Jakarta demo dataset) and always say results are sample data. Pass along any city or sport hints from the user.
- Keep replies short and conversational. Ask one follow-up at most when details are missing.
- Do not give medical advice, diagnoses, or prescriptions.
""".strip()

MAX_TOOL_ROUNDS = 4


@dataclass
class ChatContext:
    interests: list[str] = field(default_factory=list)
    session_minutes: int | None = None
    low_impact: bool = False
    vegetarian: bool = False
    weight_kg: float | None = None
    calendar_events: list[dict] = field(default_factory=list)  # user-attached only
    image_data_url: str | None = None
    timezone: str | None = None  # IANA name from the client; UTC fallback


@dataclass
class ChatResult:
    reply: str
    cards: list[dict]
    tools_used: list[str]


def _now_line(tz_name: str | None) -> str:
    zone_label = tz_name or "UTC"
    try:
        now = datetime.now(ZoneInfo(tz_name)) if tz_name else datetime.now(timezone.utc)
    except (ZoneInfoNotFoundError, ValueError):
        now = datetime.now(timezone.utc)
        zone_label = "UTC"
    return (f"Today is {now.strftime('%A')}, {now.day} {now.strftime('%B %Y')} "
            f"and the user's local time is {now.strftime('%H:%M')} ({zone_label}). "
            "Resolve relative dates (yesterday, this morning, last night) against this.")


def _context_block(ctx: ChatContext) -> str:
    parts = [_now_line(ctx.timezone)]
    if ctx.interests:
        parts.append("Interests: " + ", ".join(ctx.interests[:8]))
    if ctx.session_minutes:
        parts.append(f"Preferred session length: {ctx.session_minutes} min")
    if ctx.low_impact:
        parts.append("Prefers low-impact activities.")
    if ctx.vegetarian:
        parts.append("Vegetarian meal preference.")
    if ctx.weight_kg:
        parts.append(f"Profile weight: {ctx.weight_kg} kg (for estimate scaling).")
    if ctx.calendar_events:
        lines = [f"- {e.get('title', 'event')} ({e.get('start', '?')})" for e in ctx.calendar_events[:10]]
        parts.append("User-shared calendar events (clues only, not proof of activity):\n" + "\n".join(lines))
    parts.append("Activity catalog:\n" + catalog.describe_for_model())
    return "\n".join(parts)


def _build_messages(message: str, history: list[dict], ctx: ChatContext) -> list[ChatMessage]:
    message = (message or "").strip()
    if not message:
        raise ValidationError("message must not be empty")
    if len(message) > 4000:
        raise ValidationError("message is too long")

    messages: list[ChatMessage] = [
        ChatMessage(role="system", content=[{"type": "text", "text": SYSTEM_PROMPT}]),
        ChatMessage(role="system", content=[{"type": "text", "text": _context_block(ctx)}]),
    ]
    for turn in history[-10:]:
        if turn.get("role") in ("user", "assistant") and isinstance(turn.get("text"), str):
            messages.append(ChatMessage(role=turn["role"],
                                        content=[{"type": "text", "text": turn["text"][:2000]}]))
    user_parts: list[dict] = [{"type": "text", "text": message}]
    if ctx.image_data_url:
        if len(ctx.image_data_url) > 6_000_000:
            raise ValidationError("image is too large")
        user_parts.append({"type": "image_url", "image_url": {"url": ctx.image_data_url}})
    messages.append(ChatMessage(role="user", content=user_parts))
    return messages


def _run_tool_round(executor: ToolExecutor, messages: list[ChatMessage],
                    assistant_text: str, calls: list,
                    cards: list[dict], tools_used: list[str]) -> None:
    messages.append(ChatMessage(
        role="assistant", content=[{"type": "text", "text": assistant_text}],
        tool_calls=[{"id": c.call_id, "type": "function",
                     "function": {"name": c.name, "arguments": json.dumps(c.arguments)}} for c in calls],
    ))
    for call in calls:
        tools_used.append(call.name)
        try:
            tool_outcome = executor.execute(call.name, call.arguments)
            payload: dict = {"ok": True, **tool_outcome.result}
            if tool_outcome.card is not None:
                cards.append(tool_outcome.card)
        except ValidationError as exc:
            payload = {"ok": False, "error": str(exc)}
        messages.append(ChatMessage(role="tool", content=[{"type": "text", "text": _json(payload)}],
                                    tool_call_id=call.call_id, name=call.name))


def _executor(ctx: ChatContext, confirm_secret: str) -> ToolExecutor:
    return ToolExecutor(ToolContext(
        confirm_secret=confirm_secret,
        default_weight_kg=ctx.weight_kg,
        timezone=ctx.timezone,
    ))


def handle_chat(
    model: ModelPort,
    message: str,
    history: list[dict],
    ctx: ChatContext,
    confirm_secret: str,
) -> ChatResult:
    """Run the tool loop: model -> validated tools -> model narrates."""
    messages = _build_messages(message, history, ctx)
    executor = _executor(ctx, confirm_secret)
    cards: list[dict] = []
    tools_used: list[str] = []
    assistant_text = ""
    for _ in range(MAX_TOOL_ROUNDS):
        outcome = model.complete(messages, TOOL_SCHEMAS)
        assistant_text = outcome.message.text or ""
        calls = outcome.message.tool_calls
        if not calls:
            break
        _run_tool_round(executor, messages, assistant_text, list(calls), cards, tools_used)
    else:
        # Loop exhausted with pending tool intent; narrate what we have.
        pass
    if not assistant_text.strip():
        assistant_text = _fallback_reply(cards)
    return ChatResult(reply=assistant_text.strip(), cards=cards, tools_used=tools_used)


def handle_chat_stream(
    model: ModelPort,
    message: str,
    history: list[dict],
    ctx: ChatContext,
    confirm_secret: str,
):
    """Yield {"type": "delta", "text": ...} during the tool loop, then one
    {"type": "done", "reply": ..., "cards": ..., "tools_used": ...}.

    Text streams live from every model round, so the reply is the rounds'
    concatenated text (the unary path keeps the last round only; tool rounds
    are normally text-free, so both agree in practice).
    """
    messages = _build_messages(message, history, ctx)
    executor = _executor(ctx, confirm_secret)
    cards: list[dict] = []
    tools_used: list[str] = []
    reply_parts: list[str] = []
    for _ in range(MAX_TOOL_ROUNDS):
        round_text = ""
        calls: list = []
        for event in model.complete_stream(messages, TOOL_SCHEMAS):
            if "delta" in event:
                reply_parts.append(event["delta"])
                yield {"type": "delta", "text": event["delta"]}
            else:
                round_text = event["assembled"]["text"]
                calls = event["assembled"]["tool_calls"]
        if not calls:
            break
        _run_tool_round(executor, messages, round_text, list(calls), cards, tools_used)
    reply = "".join(reply_parts).strip()
    if not reply:
        reply = _fallback_reply(cards)
    yield {"type": "done", "reply": reply, "cards": cards, "tools_used": tools_used}


def _json(payload: dict) -> str:
    return json.dumps(payload, default=str)


def _fallback_reply(cards: list[dict]) -> str:
    if any(c.get("type") == "activity_draft" for c in cards):
        return "I've prepared a draft below. Review it and tap Confirm to save — nothing is saved yet."
    if any(c.get("type") == "estimate" for c in cards):
        return "Here's the estimate with its assumptions. Remember it's an estimate, not a measurement."
    if any(c.get("type") == "schedule" for c in cards):
        return "Here's a draft week based on what you told me. Tell me what to change."
    return "I couldn't form a reply. Could you rephrase that?"


# --- Billing ---------------------------------------------------------------

def billing_status(billing: BillingPort, app_user_id: str, entitlement_id: str) -> dict:
    """Check the paid entitlement for one app user id via the billing provider."""
    app_user_id = (app_user_id or "").strip()
    if not app_user_id or len(app_user_id) > 128:
        raise ValidationError("app_user_id must be 1-128 characters")
    if not billing.configured:
        return {"configured": False, "entitlement": entitlement_id,
                "active": False, "source": "none"}
    status = parse_entitlement(billing.get_subscriber(app_user_id), entitlement_id)
    return {"configured": True, "entitlement": entitlement_id, "active": status.active,
            "source": "revenuecat", "expires_date": status.expires_date,
            "product_identifier": status.product_identifier}


# --- Draft / confirm flow ----------------------------------------------------

def prepare_draft(fields: dict, confirm_secret: str) -> dict:
    """Direct (non-chat) draft creation with the same validation as the tool."""
    executor = ToolExecutor(ToolContext(confirm_secret=confirm_secret))
    outcome = executor.execute("prepare_activity_log", fields)
    assert outcome.card is not None
    return outcome.card


def confirm_draft(
    draft: dict,
    token: str,
    confirm_secret: str,
    claimed_personal_best: bool = False,
    claimed_streak_days: int = 1,
    claimed_xp_today: int = 0,
) -> dict:
    """Validate token + draft, compute estimate and XP, return a receipt.

    Nothing is persisted: the app stores the receipt on-device. Streak and
    daily-XP context come from the client for the same reason.
    """
    if not isinstance(draft, dict):
        raise ValidationError("draft must be an object")
    confirm.verify_token(draft, token, confirm_secret)

    activity_id = draft.get("activity_id")
    template = catalog.get_template(activity_id) if isinstance(activity_id, str) else None
    if template is None:
        raise ValidationError("draft has an unknown activity_id")
    try:
        duration = float(draft.get("duration_minutes"))
    except (TypeError, ValueError) as exc:
        raise ValidationError("draft has an invalid duration_minutes") from exc
    if not (0 < duration <= estimates.MAX_DURATION_MIN):
        raise ValidationError("draft duration out of range")
    fields = draft.get("fields") or {}
    if not isinstance(fields, dict):
        raise ValidationError("draft fields must be an object")
    weight = draft.get("weight_kg")
    if weight is not None:
        try:
            weight = float(weight)
        except (TypeError, ValueError) as exc:
            raise ValidationError("draft weight_kg invalid") from exc

    started_raw = draft.get("started_at")
    try:
        started_at = datetime.fromisoformat(started_raw) if started_raw else datetime.now(timezone.utc)
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError) as exc:
        raise ValidationError("draft started_at invalid") from exc

    energy_dict = None
    if template.id not in estimates.NON_EXERCISE_ACTIVITIES:
        entry = estimates.lookup_met(draft.get("intensity"), template.id)
        if entry is not None:
            energy = estimates.estimate_energy(entry.met, duration, weight)
            energy_dict = {
                "display": energy.display(),
                "active_kcal_low": energy.active_kcal_low,
                "active_kcal_high": energy.active_kcal_high,
                "gross_kcal": energy.gross_kcal,
                "source": energy.source,
                "method": energy.method,
                "inputs": energy.inputs,
                "uncertainty_note": energy.uncertainty_note,
            }

    personal_best = "client_reported" if claimed_personal_best else None
    if not (1 <= claimed_streak_days <= 366):
        raise ValidationError("claimed_streak_days out of range")
    if not (0 <= claimed_xp_today <= 1000000):
        raise ValidationError("claimed_xp_today out of range")
    award = xp.award_for_session(personal_best is not None, claimed_streak_days, claimed_xp_today)

    return {
        "activity_id": str(uuid.uuid4()),
        "sport": template.id,
        "sport_name": template.name,
        "duration_minutes": duration,
        "started_at": started_at.isoformat(),
        "fields": {k: v for k, v in fields.items()},
        "energy": energy_dict,
        "xp": {"total": award.total, "parts": [{"reason": r, "amount": a} for r, a in award.parts],
               "capped": award.capped},
        "personal_best": personal_best,
    }
