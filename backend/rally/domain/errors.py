"""Framework-independent domain errors."""

from __future__ import annotations


class DomainError(Exception):
    """Base class for rule violations the API maps to 4xx responses."""


class ValidationError(DomainError):
    """User- or model-supplied data failed domain validation."""


class ConfirmationError(DomainError):
    """Confirmation token missing, stale, expired, or mismatched."""


class NotConfiguredError(DomainError):
    """A required integration (model API) is not configured."""
