"""Structured JSON logging configuration.

Usage::

    from automation_toolkit.logger import setup_logging

    setup_logging(level="DEBUG", fmt="json")
    logger = logging.getLogger(__name__)
    logger.info("ready", extra={"component": "aws"})

Environment variables
---------------------
``LOG_LEVEL``  - Overrides the default logging level.
``LOG_FORMAT`` - ``json`` (default) or ``text``.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class _JsonFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    # Keys that should never appear in log output.
    _REDACT_PATTERNS = (
        "aws_secret_access_key",
        "aws_session_token",
        "AKIA",
    )

    def format(self, record: logging.LogRecord) -> str:
        entry: Dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Merge any ``extra`` fields the caller supplied.
        for key, value in record.__dict__.items():
            if key not in logging.LogRecord(
                "", 0, "", 0, None, None, None
            ).__dict__ and key not in ("message", "msg", "args"):
                entry[key] = value

        raw = json.dumps(entry, default=str)

        # Scrub sensitive patterns before emitting.
        for pattern in self._REDACT_PATTERNS:
            if pattern in raw:
                raw = raw.replace(pattern, "***REDACTED***")

        return raw


class _TextFormatter(logging.Formatter):
    """Human-friendly single-line formatter for local development."""

    FORMAT = "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s"

    def __init__(self) -> None:
        super().__init__(fmt=self.FORMAT, datefmt="%Y-%m-%d %H:%M:%S")


def setup_logging(
    level: Optional[str] = None,
    fmt: Optional[str] = None,
) -> None:
    """Configure the root logger with the requested level and format.

    Parameters
    ----------
    level:
        Logging level name (``DEBUG``, ``INFO``, ``WARNING``, ``ERROR``).
        Defaults to the ``LOG_LEVEL`` environment variable or ``INFO``.
    fmt:
        Output format: ``json`` or ``text``.
        Defaults to the ``LOG_FORMAT`` environment variable or ``json``.
    """
    resolved_level = (level or os.environ.get("LOG_LEVEL", "INFO")).upper()
    resolved_fmt = (fmt or os.environ.get("LOG_FORMAT", "json")).lower()

    handler = logging.StreamHandler(sys.stdout)

    if resolved_fmt == "text":
        handler.setFormatter(_TextFormatter())
    else:
        handler.setFormatter(_JsonFormatter())

    root = logging.getLogger()
    root.setLevel(getattr(logging, resolved_level, logging.INFO))

    # Avoid duplicate handlers when setup_logging is called multiple times.
    root.handlers.clear()
    root.addHandler(handler)
