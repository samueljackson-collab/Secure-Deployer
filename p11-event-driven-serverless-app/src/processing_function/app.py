"""
Processing Lambda Function

Consumes messages from the SQS event queue, processes each record,
and persists the result to DynamoDB. Supports batch failure reporting
so that only failed messages are retried (via ``ReportBatchItemFailures``).
Includes an idempotency check to safely handle at-least-once delivery.
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
DYNAMODB_TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME", "")
SERVICE_NAME = os.environ.get("POWERTOOLS_SERVICE_NAME", "processing")

# ---------------------------------------------------------------------------
# Logger
# ---------------------------------------------------------------------------

logger = logging.getLogger(SERVICE_NAME)
logger.setLevel(LOG_LEVEL)

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

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DYNAMODB_TABLE_NAME) if DYNAMODB_TABLE_NAME else None


# ---------------------------------------------------------------------------
# Processing logic
# ---------------------------------------------------------------------------


def process_record(record_body: dict) -> dict:
    """Apply business logic to an individual event record.

    This function transforms and enriches the raw event data before
    persistence.  Extend this function with domain-specific processing
    as requirements evolve.

    Returns a DynamoDB item dict ready for ``put_item``.
    """
    event_id = record_body["event_id"]
    source = record_body["source"]
    event_type = record_body["type"]
    payload = record_body.get("payload", {})
    ingested_at = record_body.get("ingested_at", datetime.now(timezone.utc).isoformat())

    # --- Enrichment (example: add processing metadata) ---
    processed_payload = {
        **payload,
        "processed": True,
    }

    item = {
        "event_id": event_id,
        "source": source,
        "event_type": event_type,
        "payload": _convert_floats(processed_payload),
        "ingested_at": ingested_at,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "processed",
    }
    return item


def _convert_floats(obj):
    """Recursively convert float values to strings for DynamoDB compatibility.

    DynamoDB does not natively support Python floats via ``boto3.resource``;
    they must be converted to ``Decimal`` or stored as strings.  For
    simplicity, we convert to string representation here.
    """
    if isinstance(obj, float):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _convert_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_floats(i) for i in obj]
    return obj


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------


def is_duplicate(event_id: str) -> bool:
    """Check whether an event has already been processed (idempotency guard).

    Performs a lightweight ``GetItem`` against DynamoDB.  Returns ``True``
    if a record with the given ``event_id`` already exists and has status
    ``processed``.
    """
    if table is None:
        return False

    try:
        response = table.get_item(
            Key={"event_id": event_id},
            ProjectionExpression="event_id, #s",
            ExpressionAttributeNames={"#s": "status"},
        )
        existing = response.get("Item")
        if existing and existing.get("status") == "processed":
            logger.info("Duplicate detected event_id=%s, skipping", event_id)
            return True
    except ClientError as exc:
        # If we cannot verify, proceed with processing (at-least-once is safe).
        logger.warning(
            "Idempotency check failed event_id=%s error=%s",
            event_id,
            str(exc),
        )
    return False


# ---------------------------------------------------------------------------
# DynamoDB persistence
# ---------------------------------------------------------------------------


def write_to_dynamodb(item: dict) -> None:
    """Persist a processed item to DynamoDB with a conditional write.

    Uses a condition expression to prevent overwriting an already-processed
    record, providing an additional idempotency safeguard.
    """
    if table is None:
        raise RuntimeError("DYNAMODB_TABLE_NAME is not configured.")

    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(event_id) OR #s <> :processed",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":processed": "processed"},
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            logger.info(
                "Conditional write skipped (already processed) event_id=%s",
                item["event_id"],
            )
            return
        raise


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------


def lambda_handler(event, context):
    """AWS Lambda entry-point for SQS event-source mapping.

    Processes a batch of SQS records and returns partial batch failure
    information so that only failed messages are retried.
    """
    request_id = context.aws_request_id if context else str(uuid.uuid4())
    records = event.get("Records", [])
    logger.info(
        "Processing batch request_id=%s record_count=%d",
        request_id,
        len(records),
    )

    batch_item_failures = []

    for record in records:
        message_id = record.get("messageId", "unknown")
        try:
            body = json.loads(record["body"])

            # --- Validate required keys ---
            if "event_id" not in body:
                raise ValueError("Message body missing 'event_id'.")

            event_id = body["event_id"]

            # --- Idempotency check ---
            if is_duplicate(event_id):
                logger.info(
                    "Skipping duplicate event_id=%s message_id=%s",
                    event_id,
                    message_id,
                )
                continue

            # --- Process ---
            item = process_record(body)

            # --- Persist ---
            write_to_dynamodb(item)

            logger.info(
                "Record processed event_id=%s message_id=%s",
                event_id,
                message_id,
            )

        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            logger.error(
                "Invalid record message_id=%s error=%s",
                message_id,
                str(exc),
            )
            batch_item_failures.append({"itemIdentifier": message_id})

        except ClientError as exc:
            logger.error(
                "AWS error processing message_id=%s error=%s",
                message_id,
                str(exc),
            )
            batch_item_failures.append({"itemIdentifier": message_id})

        except Exception as exc:
            logger.error(
                "Unexpected error message_id=%s error=%s",
                message_id,
                str(exc),
                exc_info=True,
            )
            batch_item_failures.append({"itemIdentifier": message_id})

    if batch_item_failures:
        logger.warning(
            "Batch completed with failures request_id=%s failed=%d total=%d",
            request_id,
            len(batch_item_failures),
            len(records),
        )
    else:
        logger.info(
            "Batch completed successfully request_id=%s total=%d",
            request_id,
            len(records),
        )

    return {"batchItemFailures": batch_item_failures}
