"""HTTP routes. Thin handlers: rate limit, use cases, error mapping."""

from __future__ import annotations

import json
import logging
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from .. import __version__
from ..application import usecases
from ..application.tools import ToolContext, ToolExecutor
from ..domain import catalog, estimates
from ..domain.errors import (
    ConfirmationError,
    DomainError,
    NotConfiguredError,
    ValidationError,
)
from ..infrastructure.billing_revenuecat import BillingError
from ..infrastructure.model_meta import ModelError
from .schemas import (
    ChatIn,
    ChatOut,
    ConfirmIn,
    DraftIn,
    ErrorOut,
    EstimateIn,
    HealthOut,
    ScheduleIn,
)

log = logging.getLogger("rally")

router = APIRouter()


def _deps(request: Request):
    return request.app.state.deps


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("/health", response_model=HealthOut)
def health(request: Request):
    deps = _deps(request)
    return HealthOut(status="ok", version=__version__,
                     model_configured=deps.model.configured,
                     frontend="embedded" if request.app.state.frontend_dist else "api-only")


@router.post("/api/chat", response_model=ChatOut)
def chat(body: ChatIn, request: Request):
    deps = _deps(request)
    if not deps.limiter.allow(f"chat:{_client_ip(request)}"):
        return JSONResponse(status_code=429, content=ErrorOut(
            code="rate_limited", message="Too many chat requests. Try again shortly.").model_dump())
    ctx = usecases.ChatContext(
        interests=list(body.context.interests),
        session_minutes=body.context.session_minutes,
        low_impact=body.context.low_impact,
        vegetarian=body.context.vegetarian,
        weight_kg=body.context.weight_kg,
        calendar_events=list(body.context.calendar_events),
        image_data_url=body.context.image_data_url,
        timezone=body.context.timezone,
    )
    started = time.monotonic()
    try:
        result = usecases.handle_chat(
            deps.model, body.message,
            [t.model_dump() for t in body.history], ctx, deps.confirm_secret)
    except NotConfiguredError as exc:
        return JSONResponse(status_code=503, content=ErrorOut(
            code="model_not_configured", message=str(exc)).model_dump())
    except (ValidationError, DomainError) as exc:
        return JSONResponse(status_code=400, content=ErrorOut(
            code="invalid_request", message=str(exc)).model_dump())
    except ModelError as exc:
        log.warning("model_error latency_ms=%d", int((time.monotonic() - started) * 1000))
        return JSONResponse(status_code=502, content=ErrorOut(
            code="model_error", message=str(exc)).model_dump())
    latency_ms = int((time.monotonic() - started) * 1000)
    # Metadata only: never log message text or images.
    log.info("chat ok tools=%s latency_ms=%d",
             ",".join(result.tools_used) or "-", latency_ms)
    return ChatOut(reply=result.reply, cards=result.cards, tools_used=result.tools_used,
                   model_id=deps.model.model_id, latency_ms=latency_ms)


@router.post("/api/chat/stream")
def chat_stream(body: ChatIn, request: Request):
    """Same tool loop as /api/chat, as server-sent events.

    Pre-stream failures (rate limit, unconfigured model) keep their HTTP
    statuses; anything failing mid-stream arrives as an error event.
    """
    deps = _deps(request)
    if not deps.limiter.allow(f"chat:{_client_ip(request)}"):
        return JSONResponse(status_code=429, content=ErrorOut(
            code="rate_limited", message="Too many chat requests. Try again shortly.").model_dump())
    if not deps.model.configured:
        return JSONResponse(status_code=503, content=ErrorOut(
            code="model_not_configured",
            message="Coach is not configured: set MODEL_API_KEY on the server.").model_dump())
    ctx = usecases.ChatContext(
        interests=list(body.context.interests),
        session_minutes=body.context.session_minutes,
        low_impact=body.context.low_impact,
        vegetarian=body.context.vegetarian,
        weight_kg=body.context.weight_kg,
        calendar_events=list(body.context.calendar_events),
        image_data_url=body.context.image_data_url,
        timezone=body.context.timezone,
    )
    history = [t.model_dump() for t in body.history]
    message = body.message
    started = time.monotonic()

    def gen():
        tools = "-"
        try:
            for event in usecases.handle_chat_stream(
                    deps.model, message, history, ctx, deps.confirm_secret):
                if event.get("type") == "done":
                    event["model_id"] = deps.model.model_id
                    event["latency_ms"] = int((time.monotonic() - started) * 1000)
                    tools = ",".join(event.get("tools_used") or []) or "-"
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except NotConfiguredError as exc:
            yield f"data: {json.dumps({'type': 'error', 'code': 'model_not_configured', 'message': str(exc)})}\n\n"
        except ModelError as exc:
            log.warning("model_error latency_ms=%d", int((time.monotonic() - started) * 1000))
            yield f"data: {json.dumps({'type': 'error', 'code': 'model_error', 'message': str(exc)})}\n\n"
        except (ValidationError, DomainError) as exc:
            yield f"data: {json.dumps({'type': 'error', 'code': 'invalid_request', 'message': str(exc)})}\n\n"
        # Metadata only: never log message text or images.
        log.info("chat_stream ok tools=%s latency_ms=%d",
                 tools, int((time.monotonic() - started) * 1000))

    return StreamingResponse(gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/api/estimate")
def estimate(body: EstimateIn):
    try:
        executor = ToolExecutor(ToolContext(confirm_secret="unused"))
        outcome = executor.execute("estimate_activity_energy", body.model_dump())
    except ValidationError as exc:
        return JSONResponse(status_code=400, content=ErrorOut(
            code="invalid_request", message=str(exc)).model_dump())
    return outcome.result


@router.get("/api/catalog")
def get_catalog():
    out = []
    for t in catalog.TEMPLATES:
        mets = [e for e in estimates.MET_TABLE if e.code in t.met_codes]
        out.append({
            "id": t.id, "name": t.name, "category": t.category, "aliases": list(t.aliases),
            "score_fields": [{"name": f.name, "label": f.label, "kind": f.kind,
                              "unit": f.unit, "options": list(f.options),
                              "required": f.required} for f in t.score_fields],
            "intensities": [{"code": e.code, "label": e.label, "met": e.met} for e in mets],
            "record_metrics": list(t.record_metrics), "flexible": t.flexible,
        })
    return {"activities": out, "estimate_source": estimates.SOURCE,
            "non_exercise_default": sorted(estimates.NON_EXERCISE_ACTIVITIES)}


@router.post("/api/activities/draft")
def draft_activity(body: DraftIn, request: Request):
    try:
        card = usecases.prepare_draft(body.model_dump(), _deps(request).confirm_secret)
    except ValidationError as exc:
        return JSONResponse(status_code=400, content=ErrorOut(
            code="invalid_request", message=str(exc)).model_dump())
    return card


@router.post("/api/activities/confirm")
def confirm_activity(body: ConfirmIn, request: Request):
    try:
        receipt = usecases.confirm_draft(
            body.draft, body.confirm_token, _deps(request).confirm_secret,
            claimed_personal_best=body.claimed_personal_best,
            claimed_streak_days=body.claimed_streak_days,
            claimed_xp_today=body.claimed_xp_today)
    except ConfirmationError as exc:
        return JSONResponse(status_code=409, content=ErrorOut(
            code="confirmation_failed", message=str(exc)).model_dump())
    except ValidationError as exc:
        return JSONResponse(status_code=400, content=ErrorOut(
            code="invalid_request", message=str(exc)).model_dump())
    return receipt


@router.get("/api/billing/status")
def get_billing_status(request: Request, app_user_id: str = ""):
    deps = _deps(request)
    if not deps.limiter.allow(f"billing:{_client_ip(request)}"):
        return JSONResponse(status_code=429, content=ErrorOut(
            code="rate_limited", message="Too many billing checks. Try again shortly.").model_dump())
    try:
        return usecases.billing_status(deps.billing, app_user_id, deps.billing_entitlement)
    except BillingError as exc:
        log.warning("billing_error")
        return JSONResponse(status_code=502, content=ErrorOut(
            code="billing_error", message=str(exc)).model_dump())
    except (ValidationError, DomainError) as exc:
        return JSONResponse(status_code=400, content=ErrorOut(
            code="invalid_request", message=str(exc)).model_dump())


@router.post("/api/schedules/draft")
def draft_schedule(body: ScheduleIn):
    try:
        executor = ToolExecutor(ToolContext(confirm_secret="unused"))
        outcome = executor.execute("build_training_schedule", body.model_dump())
    except ValidationError as exc:
        return JSONResponse(status_code=400, content=ErrorOut(
            code="invalid_request", message=str(exc)).model_dump())
    return outcome.result
