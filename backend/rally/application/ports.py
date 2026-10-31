"""Application ports: interfaces the infrastructure adapters implement."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ToolCall:
    name: str
    arguments: dict
    call_id: str


@dataclass(frozen=True)
class AssistantMessage:
    text: str
    tool_calls: tuple[ToolCall, ...] = ()


@dataclass(frozen=True)
class ChatMessage:
    role: str  # "system" | "user" | "assistant" | "tool"
    content: list  # text/image parts; adapter serializes
    name: str | None = None
    tool_call_id: str | None = None
    tool_calls: list | None = None  # assistant -> model round-trip of requested calls


@dataclass
class ModelResult:
    message: AssistantMessage
    model_id: str
    latency_ms: int


class ModelPort(Protocol):
    model_id: str

    def complete(self, messages: list[ChatMessage], tools: list[dict]) -> ModelResult:
        """One model round. Raises ModelNotConfigured / ModelError."""

    def complete_stream(
        self, messages: list[ChatMessage], tools: list[dict]
    ) -> Iterator[dict]:
        """One model round as events. Yields {"delta": str} text chunks, then a
        final {"assembled": {"text": str, "tool_calls": [ToolCall, ...]}}.
        Raises ModelNotConfigured / ModelError."""


class BillingPort(Protocol):
    @property
    def configured(self) -> bool:
        """Whether server-side billing verification is available."""

    def get_subscriber(self, app_user_id: str) -> dict:
        """Fetch the billing subscriber object. Raises BillingError."""
