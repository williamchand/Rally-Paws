"""HTTP layer: health, estimate, draft->confirm, removed account paths, chat 503."""

import pytest
from fastapi.testclient import TestClient

from rally.api.app import _frontend_dist, create_app

client = TestClient(create_app())
DIST = _frontend_dist()


def test_health_reports_config():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["model_configured"] is False  # no MODEL_API_KEY in tests
    assert body["frontend"] == ("embedded" if DIST is not None else "api-only")


def test_spa_shell_served_uncached_when_built():
    if DIST is None:
        pytest.skip("no frontend build present")
    for path in ("/", "/today"):
        resp = client.get(path)
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert resp.headers.get("cache-control") == "no-store"


def test_missing_asset_is_json_404_not_html():
    # A stale hashed URL must never come back as index.html (wrong MIME).
    resp = client.get("/assets/definitely-missing-12345.js")
    assert resp.status_code == 404
    assert resp.headers["content-type"].startswith("application/json")


def test_unknown_api_path_is_json_404():
    resp = client.get("/api/nope")
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"


def test_estimate_needs_no_key():
    resp = client.post("/api/estimate", json={"activity": "running", "duration_minutes": 30})
    assert resp.status_code == 200
    assert resp.json()["available"] is True


def test_catalog_lists_templates():
    resp = client.get("/api/catalog")
    assert resp.status_code == 200
    ids = {a["id"] for a in resp.json()["activities"]}
    assert {"running", "tennis", "chess", "esports", "other"} <= ids


def test_draft_confirm_roundtrip():
    draft_resp = client.post("/api/activities/draft", json={
        "activity": "I played tennis", "duration_minutes": 60,
    })
    # Natural text is not an id; API expects catalog ids/aliases.
    assert draft_resp.status_code == 400

    draft_resp = client.post("/api/activities/draft", json={
        "activity": "tennis", "duration_minutes": 60,
        "score_fields": {"format": "singles"},
    })
    assert draft_resp.status_code == 200
    card = draft_resp.json()
    assert card["type"] == "activity_draft"

    confirm_resp = client.post("/api/activities/confirm", json={
        "draft": card["draft"],
        "confirm_token": card["confirm_token"],
    })
    assert confirm_resp.status_code == 200
    receipt = confirm_resp.json()
    assert receipt["xp"]["total"] > 0


def test_confirm_rejects_tampered_draft():
    draft_resp = client.post("/api/activities/draft", json={
        "activity": "running", "duration_minutes": 30})
    card = draft_resp.json()
    tampered = {"activity_id": card["activity_id"], "duration_minutes": 300,
                "fields": {}, "weight_kg": None}
    resp = client.post("/api/activities/confirm",
                       json={"draft": tampered, "confirm_token": card["confirm_token"]})
    assert resp.status_code == 409


def _draft_card():
    resp = client.post("/api/activities/draft", json={
        "activity": "running", "duration_minutes": 30})
    assert resp.status_code == 200
    return resp.json()


def test_confirm_applies_claimed_streak_bonus():
    card = _draft_card()
    resp = client.post("/api/activities/confirm", json={
        "draft": card["draft"], "confirm_token": card["confirm_token"],
        "claimed_streak_days": 3,
    })
    assert resp.status_code == 200
    xp = resp.json()["xp"]
    assert xp["total"] == 14  # 10 session + 4 consistency
    assert xp["capped"] is False


def test_confirm_enforces_daily_cap_from_claimed_today():
    card = _draft_card()
    resp = client.post("/api/activities/confirm", json={
        "draft": card["draft"], "confirm_token": card["confirm_token"],
        "claimed_xp_today": 95,
    })
    assert resp.status_code == 200
    xp = resp.json()["xp"]
    assert xp["total"] == 5
    assert xp["capped"] is True


def test_confirm_rejects_absurd_claims():
    card = _draft_card()
    for extra in ({"claimed_streak_days": 0}, {"claimed_xp_today": -5}):
        resp = client.post("/api/activities/confirm", json={
            "draft": card["draft"], "confirm_token": card["confirm_token"], **extra})
        assert resp.status_code == 422


def test_account_endpoints_are_gone():
    # No sign-in provider: server history, records, and export do not exist.
    assert client.get("/api/activities").status_code == 404
    assert client.get("/api/records").status_code == 404
    assert client.get("/api/me/export").status_code == 404


def test_billing_status_unconfigured():
    resp = client.get("/api/billing/status", params={"app_user_id": "anon-123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["configured"] is False
    assert body["active"] is False
    assert body["entitlement"] == "plus"
    assert body["source"] == "none"


def test_billing_status_rejects_blank_user():
    assert client.get("/api/billing/status").status_code == 400


def test_chat_without_key_is_503():
    resp = client.post("/api/chat", json={"message": "hello"})
    assert resp.status_code == 503
    assert resp.json()["code"] == "model_not_configured"
