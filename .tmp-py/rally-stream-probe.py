import sys
sys.path.insert(0, r"C:\Programming\Rally-Paws\backend")
from rally.application import usecases
from rally.application.ports import AssistantMessage, ModelResult, ToolCall

class FakeStream:
    model_id = "fake"
    configured = True
    def __init__(self, rounds):
        self._rounds = list(rounds)
    def complete_stream(self, messages, tools):
        chunks, calls = self._rounds.pop(0)
        for c in chunks:
            yield {"delta": c}
        yield {"assembled": {"text": "".join(chunks), "tool_calls": list(calls)}}

events = list(usecases.handle_chat_stream(
    FakeStream([(["Hel", "lo"], [])]), "hi", [], usecases.ChatContext(), "secret"))
assert [e for e in events if e["type"] == "delta"] == [
    {"type": "delta", "text": "Hel"}, {"type": "delta", "text": "lo"}], events
done = [e for e in events if e["type"] == "done"][0]
assert done["reply"] == "Hello" and done["cards"] == [], done

calls = [ToolCall(name="estimate_activity_energy",
                  arguments={"activity": "running", "duration_minutes": 30},
                  call_id="c1")]
events = list(usecases.handle_chat_stream(
    FakeStream([([], calls), (["Done."], [])]), "cal?", [],
    usecases.ChatContext(), "secret"))
done = [e for e in events if e["type"] == "done"][0]
assert done["reply"] == "Done.", done
assert any(c.get("type") == "estimate" for c in done["cards"]), done["cards"]
assert done["tools_used"] == ["estimate_activity_energy"], done

class Uni:
    model_id = "u"
    configured = True
    def complete(self, messages, tools):
        return ModelResult(AssistantMessage(text="hi back"), "u", 1)

r = usecases.handle_chat(Uni(), "hi", [], usecases.ChatContext(), "secret")
assert r.reply == "hi back" and r.cards == [], r
print("stream probe OK")
