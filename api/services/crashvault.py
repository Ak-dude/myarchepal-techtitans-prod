"""
CrashVault — lightweight error/event logging stub.

Wraps Python's standard logging so existing call sites work unchanged.
Swap out the internals here later to send to Sentry, Datadog, etc.
"""

import logging
from typing import Any

logger = logging.getLogger("archepal.crashvault")


def capture_exception(
    exc: Exception,
    *,
    tags: list[str] | None = None,
    context: dict[str, Any] | None = None,
    source: str = "",
) -> None:
    """Log an exception. Drop-in for Sentry's capture_exception."""
    logger.error(
        "[crashvault] exception captured — source=%s tags=%s context=%s: %s",
        source,
        tags,
        context,
        exc,
        exc_info=exc,
    )


def log_info(
    message: str,
    *,
    tags: list[str] | None = None,
    context: dict[str, Any] | None = None,
    source: str = "",
) -> None:
    """Log an informational event."""
    logger.info(
        "[crashvault] %s — source=%s tags=%s context=%s",
        message,
        source,
        tags,
        context,
    )


def log_warning(
    message: str,
    *,
    tags: list[str] | None = None,
    context: dict[str, Any] | None = None,
    source: str = "",
) -> None:
    """Log a warning event."""
    logger.warning(
        "[crashvault] %s — source=%s tags=%s context=%s",
        message,
        source,
        tags,
        context,
    )
