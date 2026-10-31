"""RevenueCat entitlement rules. Pure parsing; HTTP lives in the adapter."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class EntitlementStatus:
    active: bool
    expires_date: str | None
    product_identifier: str | None


def parse_entitlement(
    subscriber: dict,
    entitlement_id: str,
    now: datetime | None = None,
) -> EntitlementStatus:
    """Decide whether an entitlement is active from a RevenueCat subscriber object.

    Active when the entitlement exists and is unexpired; a missing expiry date
    means lifetime access. Anything unparseable counts as inactive.
    """
    now = now or datetime.now(timezone.utc)
    entitlements = subscriber.get("entitlements")
    entry = entitlements.get(entitlement_id) if isinstance(entitlements, dict) else None
    if not isinstance(entry, dict) or not entry:
        return EntitlementStatus(active=False, expires_date=None, product_identifier=None)
    expires_raw = entry.get("expires_date")
    product = entry.get("product_identifier")
    product_id = str(product) if product else None
    if expires_raw is None:
        return EntitlementStatus(active=True, expires_date=None, product_identifier=product_id)
    try:
        expires = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00"))
    except ValueError:
        return EntitlementStatus(active=False, expires_date=str(expires_raw),
                                 product_identifier=product_id)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return EntitlementStatus(active=expires > now, expires_date=str(expires_raw),
                             product_identifier=product_id)
