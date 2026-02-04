"""
Ingestion Lambda Function

Validates incoming event payloads from API Gateway and publishes
them to an SQS queue for asynchronous processing. Returns HTTP 202
(Accepted) on success.
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")
SERVICE_NAME = os.environ.get("POWERTOOLS_SERVICE_NAME", "ingestion")

MAX_PAYLOAD_SIZE = 256 * 1024  # 256 KB
REQUIRED_FIELDS = {"source", "type", "payload"}
ALLOWED_TYPES = {
    "temperature",
    "humidity",
    "pressure",
    "motion",
    "alert",
    "heartbeat",
}
MAX_SOURCE_LENGTH = 128
MAX_TYPE_LENGTH = 64

# ---------------------------------------------------------------------------
# Logger
# ---------------------------------------------------------------------------

logger = logging.getLogger(SERVICE_NAME)
logger.setLevel(LOG_LEVEL)

# Structured JSON formatter
_handler = logging.StreamHandler()
_handler.setFormatter(logging.Formatter(json.dumps({
    "timestamp": "%(asctime)s",
    "level": "%(levelname)s",
    "service": SERVICE_NAME,
    "message": "%(message)s",
})))
logger.handlers = [_handler]

# ---------------------------------------------------------------------------
# AWS clients (re-used across invocations)
# ---------------------------------------------------------------------------

sqs_client = boto3.client("sqs")


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


class ValidationError(Exception):
    """Raised when input validation fails."""

    def __init__(self, message: str, field: str | None = None):
        self.message = message
        self.field = field
        super().__init__(self.message)


def validate_payload(body: dict) -> dict:
    """Validate the incoming event payload.

    Returns the validated and normalised payload dict.
    Raises ``ValidationError`` on any validation failure.
    """
    # --- Required fields ---
    missing = REQUIRED_FIELDS - set(body.keys())
    if missing:
        raise ValidationError(
            f"Missing required fields: {', '.join(sorted(missing))}",
            field="body",
        )

    # --- source ---
    source = body["source"]
    if not isinstance(source, str) or not source.strip():
        raise ValidationError("Field 'source' must be a non-empty string.", field="source")
    if len(source) > MAX_SOURCE_LENGTH:
        raise ValidationError(
            f"Field 'source' exceeds maximum length of {MAX_SOURCE_LENGTH}.",
            field="source",
        )

    # --- type ---
    event_type = body["type"]
    if not isinstance(event_type, str) or not event_type.strip():
        raise ValidationError("Field 'type' must be a non-empty string.", field="type")
    if len(event_type) > MAX_TYPE_LENGTH:
        raise ValidationError(
            f"Field 'type' exceeds maximum length of {MAX_TYPE_LENGTH}.",
            field="type",
        )
    if event_type not in ALLOWED_TYPES:
        raise ValidationError(
            f"Field 'type' must be one of: {', '.join(sorted(ALLOWED_TYPES))}.",
            field="type",
        )

    # --- payload ---
    payload = body["payload"]
    if not isinstance(payload, dict):
        raise ValidationError("Field 'payload' must be a JSON object.", field="payload")

    return {
        "source": source.strip(),
        "type": event_type.strip(),
        "payload": payload,
    }


# ---------------------------------------------------------------------------
# SQS publishing
# ---------------------------------------------------------------------------


def publish_to_sqs(event_id: str, validated_body: dict) -> str:
    """Publish a validated event to the SQS queue.

    Returns the SQS MessageId.
    """
    message_body = {
        "event_id": event_id,
        "source": validated_body["source"],
        "type": validated_body["type"],
        "payload": validated_body["payload"],
        "ingested_at": datetime.now(timezone.utc).isoformat(),
    }

    response = sqs_client.send_message(
        QueueUrl=SQS_QUEUE_URL,
        MessageBody=json.dumps(message_body),
        MessageAttributes={
            "EventType": {
                "DataType": "String",
                "StringValue": validated_body["type"],
            },
            "Source": {
                "DataType": "String",
                "StringValue": validated_body["source"],
            },
        },
    )
    return response["MessageId"]


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------


def lambda_handler(event, context):
    """AWS Lambda entry-point for API Gateway proxy integration."""

    request_id = (context.aws_request_id if context else str(uuid.uuid4()))
    logger.info("Received request request_id=%s", request_id)

    # --- Parse body ---
    raw_body = event.get("body", "")
    if not raw_body:
        logger.warning("Empty request body request_id=%s", request_id)
        return _response(400, {"error": "Request body is required."})

    # --- Size check (before parsing) ---
    if isinstance(raw_body, str) and len(raw_body.encode("utf-8")) > MAX_PAYLOAD_SIZE:
        logger.warning("Payload too large request_id=%s", request_id)
        return _response(413, {"error": f"Payload exceeds {MAX_PAYLOAD_SIZE} bytes."})

    try:
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("Invalid JSON request_id=%s error=%s", request_id, str(exc))
        return _response(400, {"error": "Request body must be valid JSON."})

    if not isinstance(body, dict):
        return _response(400, {"error": "Request body must be a JSON object."})

    # --- Validate ---
    try:
        validated = validate_payload(body)
    except ValidationError as exc:
        logger.warning(
            "Validation failed request_id=%s field=%s error=%s",
            request_id,
            exc.field,
            exc.message,
        )
        return _response(422, {"error": exc.message, "field": exc.field})

    # --- Publish to SQS ---
    event_id = str(uuid.uuid4())
    try:
        message_id = publish_to_sqs(event_id, validated)
    except ClientError as exc:
        logger.error(
            "SQS publish failed request_id=%s event_id=%s error=%s",
            request_id,
            event_id,
            str(exc),
        )
        return _response(502, {"error": "Failed to enqueue event. Please retry."})

    logger.info(
        "Event enqueued request_id=%s event_id=%s sqs_message_id=%s",
        request_id,
        event_id,
        message_id,
    )

    return _response(202, {
        "message": "Event accepted for processing.",
        "event_id": event_id,
        "sqs_message_id": message_id,
    })


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _response(status_code: int, body: dict) -> dict:
    """Build an API Gateway proxy-integration response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
        "body": json.dumps(body),
    }
