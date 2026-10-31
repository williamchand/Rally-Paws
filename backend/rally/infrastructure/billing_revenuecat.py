"""RevenueCat billing adapter behind the BillingPort interface.

Server-side verification only: the secret key never leaves the backend.
Without REVENUECAT_SECRET_KEY the adapter reports unconfigured and the app
runs its demo billing flow (clearly labelled as planned in the UI).
"""

from __future__ import annotations

from urllib.parse import quote

import httpx

from ..domain.errors import DomainError, NotConfiguredError


class BillingError(DomainError):
    """The billing provider call failed (transport, status, or shape)."""


class RevenueCatBilling:
    def __init__(self, secret_key: str | None,
                 base_url: str = "https://api.revenuecat.com",
                 timeout_s: float = 10.0):
        self._secret_key = (secret_key or "").strip()
        self._base_url = (base_url or "").strip().rstrip("/") or "https://api.revenuecat.com"
        self._timeout_s = timeout_s

    @property
    def configured(self) -> bool:
        return bool(self._secret_key)

    def get_subscriber(self, app_user_id: str) -> dict:
        """Fetch the RevenueCat subscriber object for one app user id."""
        if not self.configured:
            raise NotConfiguredError(
                "Billing is not configured: set REVENUECAT_SECRET_KEY on the server.")
        uid = (app_user_id or "").strip()
        if not uid or len(uid) > 128:
            raise BillingError("invalid app user id")
        try:
            with httpx.Client(timeout=self._timeout_s) as client:
                resp = client.get(
                    f"{self._base_url}/v1/subscribers/{quote(uid, safe='')}",
                    headers={"Authorization": f"Bearer {self._secret_key}"},
                )
        except httpx.HTTPError as exc:
            raise BillingError(f"billing request failed: {exc}") from exc
        if resp.status_code >= 400:
            raise BillingError(f"billing API error {resp.status_code}")
        try:
            subscriber = resp.json()["subscriber"]
        except (ValueError, KeyError, TypeError) as exc:
            raise BillingError("unexpected billing response shape") from exc
        if not isinstance(subscriber, dict):
            raise BillingError("unexpected billing response shape")
        return subscriber
