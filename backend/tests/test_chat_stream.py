"""Chat streaming: SSE deltas + done, tool rounds, mid-stream errors, 503."""

import json

from fastapi.testclient import TestClient

from rally.api.app import create_app
from rally.application.ports import ToolCall
from rally.infrastructure.model_meta import ModelError


def _events(resp):
    out = []
    for line in resp.text.splitlines():
        if line.startswith("data:"):
            out.append(json.loads(line[5:].strip()))
    return out


class FakeStreamModel:
    """Scripted model: rounds of (text chunks, tool calls) or an error."""

    model_id = "fake-stream"
    configured = True

    def __init__(self, rounds):
        self._rounds = list(rounds)

    def complete_stream(self, messages, tools):
        item = self._rounds.pop(0)
        if isinstance(item, Exception):
            raise item
        chunks, calls = item
        for chunk in chunks:
            yield {"delta": chunk}
        yield {"assembled": {"text": "".join(chunks), "tool_calls": list(calls)}}


def _client_with(model):
    app = create_app()
    app.state.deps.model = model
    return TestClient(app)


def _post(client, message="hello"):
    return client.post("/api/chat/stream", json={"message": message})


def test_stream_without_key_is_503():
    resp = _post(TestClient(create_app()))
    assert resp.status_code == 503
    assert resp.json()["code"] == "model_not_configured"


def test_stream_text_round():
    model = FakeStreamModel([(["Hello", " there"], [])])
    resp = _post(_client_with(model))
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    events = _events(resp)
    assert [e for e in events if e["type"] == "delta"] == [
        {"type": "delta", "text": "Hello"},
        {"type": "delta", "text": " there"},
    ]
    done = [e for e in events if e["type"] == "done"]
    assert len(done) == 1
    assert done[0]["reply"] == "Hello there"
    assert done[0]["cards"] == []
    assert done[0]["tools_used"] == []
    assert done[0]["model_id"] == "fake-stream"
    assert isinstance(done[0]["latency_ms"], int)


def test_stream_tool_round_emits_card():
    calls = [ToolCall(name="estimate_activity_energy",
                      arguments={"activity": "running", "duration_minutes": 30},
                      call_id="call-1")]
    model = FakeStreamModel([([], calls), (["Here you go."], [])])
    resp = _post(_client_with(model), "calories in a run?")
    events = _events(resp)
    done = [e for e in events if e["type"] == "done"][0]
    assert done["reply"] == "Here you go."
    assert any(c.get("type") == "estimate" for c in done["cards"])
    assert done["tools_used"] == ["estimate_activity_energy"]


def test_stream_model_error_is_error_event():
    model = FakeStreamModel([ModelError("boom")])
    resp = _post(_client_with(model))
    assert resp.status_code == 200
    events = _events(resp)
    assert events == [{"type": "error", "code": "model_error", "message": "boom"}]
