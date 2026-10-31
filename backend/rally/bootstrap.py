"""Composition root: read env, build adapters, wire dependencies.

Dependency direction: api / infrastructure -> application -> domain.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv() -> None:
    """Minimal .env loader (no extra dependency): KEY=VALUE lines only."""
    path = Path(".env")
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


@dataclass
class Dependencies:
    model: object
    limiter: object
    confirm_secret: str
    billing: object
    billing_entitlement: str


def build_dependencies() -> Dependencies:
    from .api.ratelimit import RateLimiter
    from .infrastructure.billing_revenuecat import RevenueCatBilling
    from .infrastructure.model_meta import MetaModelAdapter

    _load_dotenv()
    confirm_secret = os.environ.get("CONFIRM_SECRET", "").strip()
    if not confirm_secret or confirm_secret.startswith("change-me"):
        raise RuntimeError(
            "CONFIRM_SECRET is missing. Copy .env.example to .env and set a long random secret.")

    model = MetaModelAdapter(
        api_key=os.environ.get("MODEL_API_KEY", ""),
        base_url=os.environ.get("MODEL_BASE_URL", "https://api.meta.ai/v1"),
        model_id=os.environ.get("MODEL_ID", "muse-spark-1.3"),
    )
    try:
        chat_rate = max(1, int(os.environ.get("CHAT_RATE_PER_MIN", "20").strip() or "20"))
    except ValueError:
        chat_rate = 20
    billing = RevenueCatBilling(
        secret_key=os.environ.get("REVENUECAT_SECRET_KEY", ""),
        base_url=os.environ.get("REVENUECAT_BASE_URL", "https://api.revenuecat.com"),
    )
    entitlement = os.environ.get("REVENUECAT_ENTITLEMENT", "plus").strip() or "plus"
    return Dependencies(model=model, limiter=RateLimiter(max_calls=chat_rate),
                        confirm_secret=confirm_secret, billing=billing,
                        billing_entitlement=entitlement)
