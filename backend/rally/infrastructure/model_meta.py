"""Meta Model API adapter (Muse Spark) behind the ModelPort interface.

Uses the OpenAI-compatible chat-completions shape: POST {base}/chat/completions
with model, messages, and tools. No fallback: without MODEL_API_KEY the adapter
raises ModelNotConfigured and chat endpoints answer 503.
"""

from __future__ import annotations

import json
import time
from collections.abc import Iterator

import httpx

from ..application.ports import AssistantMessage, ChatMessage, ModelResult, ToolCall
from ..domain.errors import DomainError, NotConfiguredError


class ModelError(DomainError):
    """The model provider call failed (transport, status, or shape)."""


class MetaModelAdapter:
    def __init__(self, api_key: str | None, base_url: str, model_id: str,
                 timeout_s: float = 60.0):
        self._api_key = (api_key or "").strip()
        self._base_url = (base_url or "").strip().rstrip("/")
        self._model_id = model_id
        self._timeout_s = timeout_s

    @property
    def model_id(self) -> str:
        return self._model_id

    @property
    def configured(self) -> bool:
        return bool(self._api_key and self._base_url)

    def complete(self, messages: list[ChatMessage], tools: list[dict]) -> ModelResult:
        if not self.configured:
            raise NotConfiguredError(
                "Coach is not configured: set MODEL_API_KEY on the server.")
        payload = {
            "model": self._model_id,
            "messages": [self._serialize(m) for m in messages],
            "tools": tools,
            "tool_choice": "auto",
        }
        started = time.monotonic()
        try:
            with httpx.Client(timeout=self._timeout_s) as client:
                resp = client.post(
                    f"{self._base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                )
        except httpx.HTTPError as exc:
            raise ModelError(f"model request failed: {exc}") from exc
        latency_ms = int((time.monotonic() - started) * 1000)
        if resp.status_code >= 400:
            raise ModelError(f"model API error {resp.status_code}")
        try:
            msg = resp.json()["choices"][0]["message"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise ModelError("unexpected model response shape") from exc
        calls: list[ToolCall] = []
        for raw in msg.get("tool_calls") or []:
            try:
                fn = raw.get("function", {})
                args = fn.get("arguments", {})
                calls.append(ToolCall(
                    name=str(fn.get("name", "")),
                    arguments=json.loads(args) if isinstance(args, str) else dict(args or {}),
                    call_id=str(raw.get("id", "")),
                ))
            except (ValueError, TypeError, AttributeError):
                continue  # skip malformed tool calls; loop continues with text
        text = msg.get("content") or ""
        if not isinstance(text, str):
            text = ""
        return ModelResult(AssistantMessage(text=text, tool_calls=tuple(calls)),
                           model_id=self._model_id, latency_ms=latency_ms)

    def complete_stream(
        self, messages: list[ChatMessage], tools: list[dict]
    ) -> Iterator[dict]:
        if not self.configured:
            raise NotConfiguredError(
                "Coach is not configured: set MODEL_API_KEY on the server.")
        payload = {
            "model": self._model_id,
            "messages": [self._serialize(m) for m in messages],
            "tools": tools,
            "tool_choice": "auto",
            "stream": True,
        }
        try:
            with httpx.Client(timeout=self._timeout_s) as client:
                with client.stream(
                    "POST",
                    f"{self._base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                ) as resp:
                    if resp.status_code >= 400:
                        raise ModelError(f"model API error {resp.status_code}")
                    yield from self._parse_sse(resp)
        except httpx.HTTPError as exc:
            raise ModelError(f"model request failed: {exc}") from exc

    @staticmethod
    def _parse_sse(resp: httpx.Response) -> Iterator[dict]:
        """Turn OpenAI-style SSE chunks into delta events + one assembled tail."""
        text_parts: list[str] = []
        calls: dict[int, dict] = {}
        for line in resp.iter_lines():
            if not line or not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                delta = json.loads(data)["choices"][0].get("delta") or {}
            except (ValueError, KeyError, IndexError, TypeError):
                continue
            piece = delta.get("content")
            if isinstance(piece, str) and piece:
                text_parts.append(piece)
                yield {"delta": piece}
            for raw in delta.get("tool_calls") or []:
                try:
                    idx = int(raw.get("index", 0))
                except (TypeError, ValueError):
                    continue
                slot = calls.setdefault(idx, {"id": "", "name": "", "arguments": []})
                if raw.get("id"):
                    slot["id"] = str(raw["id"])
                fn = raw.get("function") or {}
                if fn.get("name"):
                    slot["name"] = str(fn["name"])
                args = fn.get("arguments")
                if isinstance(args, str) and args:
                    slot["arguments"].append(args)
        assembled: list[ToolCall] = []
        for idx in sorted(calls):
            slot = calls[idx]
            try:
                raw_args = "".join(slot["arguments"])
                args = json.loads(raw_args) if raw_args else {}
                if not isinstance(args, dict) or not slot["name"]:
                    continue
            except ValueError:
                continue
            assembled.append(ToolCall(name=slot["name"], arguments=args,
                                      call_id=slot["id"]))
        yield {"assembled": {"text": "".join(text_parts), "tool_calls": assembled}}

    @staticmethod
    def _serialize(m: ChatMessage) -> dict:
        if m.role == "tool":
            text = " ".join(p.get("text", "") for p in m.content if isinstance(p, dict))
            out: dict = {"role": "tool", "content": text}
            if m.tool_call_id:
                out["tool_call_id"] = m.tool_call_id
            return out
        if m.role == "assistant" and not any(isinstance(p, dict) and p.get("type") == "image_url"
                                             for p in m.content):
            text = " ".join(p.get("text", "") for p in m.content if isinstance(p, dict))
            out = {"role": "assistant", "content": text or None}
            if m.tool_calls:
                out["tool_calls"] = m.tool_calls
            return out
        return {"role": m.role, "content": m.content}
