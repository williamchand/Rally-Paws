"""Billing: entitlement parsing, status flow, adapter transport."""

from datetime import datetime, timedelta, timezone

import httpx
import pytest

from rally.application import usecases
from rally.domain.billing import parse_entitlement
from rally.domain.errors import NotConfiguredError, ValidationError
from rally.infrastructure.billing_revenuecat import BillingError, RevenueCatBilling


def _subscriber(entitlement):
    return {"entitlements": {"plus": entitlement}}


def test_parse_active_future_expiry():
    future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    status = parse_entitlement(_subscriber(
        {"expires_date": future, "product_identifier": "$rc_annual"}), "plus")
    assert status.active is True
    assert status.expires_date == future
    assert status.product_identifier == "$rc_annual"


def test_parse_expired_inactive():
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    status = parse_entitlement(_subscriber({"expires_date": past}), "plus")
    assert status.active is False


def test_parse_lifetime_and_missing():
    assert parse_entitlement(_subscriber(
        {"expires_date": None, "product_identifier": "lifetime"}), "plus").active is True
    assert parse_entitlement({"entitlements": {}}, "plus").active is False
    assert parse_entitlement({}, "plus").active is False
    assert parse_entitlement(_subscriber({"expires_date": "not-a-date"}), "plus").active is False


class FakeBilling:
    def __init__(self, subscriber=None, configured=True):
        self._subscriber = subscriber or {}
        self.configured = configured

    def get_subscriber(self, app_user_id):
        assert app_user_id
        return self._subscriber


def test_status_unconfigured_needs_no_key():
    out = usecases.billing_status(RevenueCatBilling(""), "anon-123", "plus")
    assert out == {"configured": False, "entitlement": "plus",
                   "active": False, "source": "none"}


def test_status_active_via_provider():
    future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    fake = FakeBilling(_subscriber({"expires_date": future, "product_identifier": "$rc_monthly"}))
    out = usecases.billing_status(fake, "anon-123", "plus")
    assert out["configured"] is True
    assert out["active"] is True
    assert out["source"] == "revenuecat"
    assert out["product_identifier"] == "$rc_monthly"


def test_status_rejects_bad_user_id():
    with pytest.raises(ValidationError):
        usecases.billing_status(FakeBilling(), "  ", "plus")
    with pytest.raises(ValidationError):
        usecases.billing_status(FakeBilling(), "x" * 129, "plus")


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {"subscriber": {}}

    def json(self):
        return self._payload


class FakeClient:
    response = FakeResponse()
    last_request = None

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get(self, url, headers=None):
        FakeClient.last_request = {"url": url, "headers": headers}
        return FakeClient.response


def test_adapter_request_shape(monkeypatch):
    monkeypatch.setattr(httpx, "Client", FakeClient)
    FakeClient.response = FakeResponse(payload={"subscriber": {"entitlements": {}}})
    out = RevenueCatBilling("sk-test").get_subscriber("user 1")
    assert out == {"entitlements": {}}
    assert FakeClient.last_request["url"] == "https://api.revenuecat.com/v1/subscribers/user%201"
    assert FakeClient.last_request["headers"]["Authorization"] == "Bearer sk-test"


def test_adapter_unconfigured_and_errors(monkeypatch):
    with pytest.raises(NotConfiguredError):
        RevenueCatBilling("").get_subscriber("u")
    monkeypatch.setattr(httpx, "Client", FakeClient)
    FakeClient.response = FakeResponse(status_code=401, payload={})
    with pytest.raises(BillingError, match="401"):
        RevenueCatBilling("sk-test").get_subscriber("u")
    FakeClient.response = FakeResponse(payload={"nope": True})
    with pytest.raises(BillingError, match="shape"):
        RevenueCatBilling("sk-test").get_subscriber("u")
