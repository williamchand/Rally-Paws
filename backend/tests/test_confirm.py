"""Confirmation tokens bind exact draft bytes to an expiry."""

import pytest

from rally.application import confirm
from rally.domain.errors import ConfirmationError

SECRET = "test-secret-not-for-production"
DRAFT = {"activity_id": "tennis", "duration_minutes": 60.0,
         "fields": {"format": "singles"}, "weight_kg": None}


def test_roundtrip_ok():
    token = confirm.mint_token(DRAFT, SECRET, now=1000.0)
    confirm.verify_token(DRAFT, token, SECRET, now=1000.0 + 10)


def test_changed_draft_rejected():
    token = confirm.mint_token(DRAFT, SECRET, now=1000.0)
    edited = {**DRAFT, "duration_minutes": 90.0}
    with pytest.raises(ConfirmationError, match="changed after review"):
        confirm.verify_token(edited, token, SECRET, now=1010.0)


def test_js_number_roundtrip_ok():
    """JS has only doubles: 60.0 minted comes back as 60 — must verify."""
    token = confirm.mint_token(DRAFT, SECRET, now=1000.0)
    as_js_sends_it = {"activity_id": "tennis", "duration_minutes": 60,
                      "fields": {"format": "singles"}, "weight_kg": None}
    confirm.verify_token(as_js_sends_it, token, SECRET, now=1010.0)


def test_fractional_change_still_rejected():
    token = confirm.mint_token(DRAFT, SECRET, now=1000.0)
    edited = {**DRAFT, "duration_minutes": 60.5}
    with pytest.raises(ConfirmationError, match="changed after review"):
        confirm.verify_token(edited, token, SECRET, now=1010.0)


def test_expired_rejected():
    token = confirm.mint_token(DRAFT, SECRET, now=1000.0)
    with pytest.raises(ConfirmationError, match="expired"):
        confirm.verify_token(DRAFT, token, SECRET, now=1000.0 + confirm.EXPIRY_SECONDS + 1)


def test_wrong_secret_and_garbage_rejected():
    token = confirm.mint_token(DRAFT, SECRET, now=1000.0)
    with pytest.raises(ConfirmationError):
        confirm.verify_token(DRAFT, token, "other-secret", now=1010.0)
    with pytest.raises(ConfirmationError):
        confirm.verify_token(DRAFT, "garbage", SECRET, now=1010.0)
