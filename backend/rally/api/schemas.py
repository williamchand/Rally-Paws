"""HTTP request/response schemas (pydantic v2)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    text: str = Field(max_length=2000)


class ChatContextIn(BaseModel):
    interests: list[str] = Field(default_factory=list, max_length=8)
    session_minutes: int | None = Field(default=None, ge=5, le=600)
    low_impact: bool = False
    vegetarian: bool = False
    weight_kg: float | None = Field(default=None, gt=0, le=400)
    calendar_events: list[dict[str, Any]] = Field(default_factory=list, max_length=10)
    image_data_url: str | None = Field(default=None, max_length=6_000_000)
    timezone: str | None = Field(default=None, max_length=64)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=10)
    context: ChatContextIn = Field(default_factory=ChatContextIn)


class ChatOut(BaseModel):
    reply: str
    cards: list[dict[str, Any]]
    tools_used: list[str]
    model_id: str
    latency_ms: int


class EstimateIn(BaseModel):
    activity: str
    duration_minutes: float = Field(gt=0, le=1440)
    weight_kg: float | None = Field(default=None, gt=0, le=400)
    intensity: str | None = None


class DraftIn(BaseModel):
    activity: str
    duration_minutes: float = Field(gt=0, le=1440)
    score_fields: dict[str, Any] = Field(default_factory=dict)
    weight_kg: float | None = Field(default=None, gt=0, le=400)
    intensity: str | None = None
    started_at: str | None = None


class ConfirmIn(BaseModel):
    draft: dict[str, Any]
    confirm_token: str
    claimed_personal_best: bool = False
    # Client-computed from on-device history (the server keeps none).
    # Trusted like claimed_personal_best; XP here is cosmetic, not currency.
    claimed_streak_days: int = Field(default=1, ge=1, le=366)
    claimed_xp_today: int = Field(default=0, ge=0, le=1000000)


class ScheduleIn(BaseModel):
    goal: str = Field(min_length=1, max_length=300)
    activities: list[str] = Field(min_length=1, max_length=7)
    days_available: list[str] = Field(min_length=1, max_length=7)
    session_minutes: int = Field(ge=10, le=300)
    low_impact: bool = False


class ErrorOut(BaseModel):
    code: str
    message: str


class HealthOut(BaseModel):
    status: str
    version: str
    model_configured: bool
    frontend: str  # "embedded" when the web build is served, else "api-only"
