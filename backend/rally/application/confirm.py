"""Signed confirmation tokens: draft -> user review -> explicit confirm -> save.

The token binds the exact draft bytes to an expiry via HMAC. The server
re-validates the draft on confirm; the token only proves the user reviewed
these bytes. stdlib only so use cases stay dependency-light.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from ..domain.errors import ConfirmationError

EXPIRY_SECONDS = 30 * 60


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text.encode("ascii"))


def canonical_draft(draft: dict) -> str:
    return json.dumps(draft, sort_keys=True, separators=(",", ":"), default=str)


def mint_token(draft: dict, secret: str, now: float | None = None) -> str:
    if not secret:
        raise ConfirmationError("confirmation is not configured")
    now = time.time() if now is None else now
    payload = {"draft": canonical_draft(draft), "exp": int(now + EXPIRY_SECONDS)}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def verify_token(draft: dict, token: str, secret: str, now: float | None = None) -> None:
    if not secret:
        raise ConfirmationError("confirmation is not configured")
    now = time.time() if now is None else now
    try:
        body, sig = token.rsplit(".", 1)
        expected = hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise ConfirmationError("confirmation token mismatch")
        payload = json.loads(_unb64(body))
        if int(payload["exp"]) < int(now):
            raise ConfirmationError("confirmation token expired")
        if payload["draft"] != canonical_draft(draft):
            raise ConfirmationError("draft changed after review; please review again")
    except ConfirmationError:
        raise
    except Exception as exc:  # malformed token of any shape
        raise ConfirmationError("invalid confirmation token") from exc
