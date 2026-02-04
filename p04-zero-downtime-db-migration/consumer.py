"""
CDC Consumer for Zero-Downtime Database Migration

Reads Debezium CDC events from Kafka and applies them to the target PostgreSQL
database. Implements idempotent writes, batch processing, error handling,
and structured logging.
"""

import json
import logging
import os
import re
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Any, Optional

import psycopg2
import psycopg2.extras
from kafka import KafkaConsumer
from kafka.errors import KafkaError, NoBrokersAvailable

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
KAFKA_GROUP_ID = os.getenv("KAFKA_GROUP_ID", "cdc-consumer-group")
KAFKA_TOPIC_PATTERN = os.getenv("KAFKA_TOPIC_PATTERN", r"^cdc\.public\..*")
CONSUMER_POLL_TIMEOUT = float(os.getenv("CONSUMER_POLL_TIMEOUT", "1.0"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))

TARGET_DB_HOST = os.getenv("TARGET_DB_HOST", "localhost")
TARGET_DB_PORT = int(os.getenv("TARGET_DB_PORT", "5433"))
TARGET_DB_NAME = os.getenv("TARGET_DB_NAME", "targetdb")
TARGET_DB_USER = os.getenv("TARGET_DB_USER", "migration")
TARGET_DB_PASSWORD = os.getenv("TARGET_DB_PASSWORD", "migration_secret")

MAX_RETRIES = int(os.getenv("MAX_RETRIES", "5"))
RETRY_BACKOFF_BASE = float(os.getenv("RETRY_BACKOFF_BASE", "2.0"))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
    stream=sys.stdout,
)
logger = logging.getLogger("cdc-consumer")

# ---------------------------------------------------------------------------
# Graceful Shutdown
# ---------------------------------------------------------------------------

shutdown_requested = False


def _signal_handler(signum: int, _frame: Any) -> None:
    global shutdown_requested
    logger.info("Received signal %s, initiating graceful shutdown...", signum)
    shutdown_requested = True


signal.signal(signal.SIGTERM, _signal_handler)
signal.signal(signal.SIGINT, _signal_handler)

# ---------------------------------------------------------------------------
# Database Helpers
# ---------------------------------------------------------------------------


def connect_target_db() -> psycopg2.extensions.connection:
    """Establish a connection to the target PostgreSQL database with retries."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            conn = psycopg2.connect(
                host=TARGET_DB_HOST,
                port=TARGET_DB_PORT,
                dbname=TARGET_DB_NAME,
                user=TARGET_DB_USER,
                password=TARGET_DB_PASSWORD,
                connect_timeout=10,
            )
            conn.autocommit = False
            logger.info(
                "Connected to target database %s:%s/%s",
                TARGET_DB_HOST,
                TARGET_DB_PORT,
                TARGET_DB_NAME,
            )
            return conn
        except psycopg2.OperationalError as exc:
            wait = RETRY_BACKOFF_BASE ** attempt
            logger.warning(
                "Database connection attempt %d/%d failed: %s. Retrying in %.1fs...",
                attempt,
                MAX_RETRIES,
                exc,
                wait,
            )
            time.sleep(wait)
    logger.critical("Failed to connect to target database after %d attempts.", MAX_RETRIES)
    sys.exit(1)


def ensure_connection(conn: Optional[psycopg2.extensions.connection]) -> psycopg2.extensions.connection:
    """Return an open connection, reconnecting if necessary."""
    if conn is None or conn.closed:
        return connect_target_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return conn
    except Exception:
        logger.warning("Stale database connection detected, reconnecting...")
        try:
            conn.close()
        except Exception:
            pass
        return connect_target_db()


# ---------------------------------------------------------------------------
# Kafka Helpers
# ---------------------------------------------------------------------------


def create_kafka_consumer() -> KafkaConsumer:
    """Create and return a Kafka consumer subscribed to CDC topics."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            consumer = KafkaConsumer(
                bootstrap_servers=KAFKA_BOOTSTRAP.split(","),
                group_id=KAFKA_GROUP_ID,
                auto_offset_reset="earliest",
                enable_auto_commit=False,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")) if m else None,
                key_deserializer=lambda m: json.loads(m.decode("utf-8")) if m else None,
                max_poll_records=BATCH_SIZE,
                session_timeout_ms=30000,
                heartbeat_interval_ms=10000,
            )
            consumer.subscribe(pattern=KAFKA_TOPIC_PATTERN)
            logger.info(
                "Kafka consumer created (group=%s, pattern=%s)",
                KAFKA_GROUP_ID,
                KAFKA_TOPIC_PATTERN,
            )
            return consumer
        except NoBrokersAvailable:
            wait = RETRY_BACKOFF_BASE ** attempt
            logger.warning(
                "Kafka connection attempt %d/%d failed. Retrying in %.1fs...",
                attempt,
                MAX_RETRIES,
                wait,
            )
            time.sleep(wait)
    logger.critical("Failed to connect to Kafka after %d attempts.", MAX_RETRIES)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Event Processing
# ---------------------------------------------------------------------------


def extract_table_name(topic: str) -> str:
    """Extract the table name from a Debezium topic (e.g., cdc.public.users -> users)."""
    parts = topic.split(".")
    if len(parts) >= 3:
        return parts[-1]
    return topic


def is_offset_processed(
    cur: psycopg2.extensions.cursor,
    topic: str,
    partition: int,
    offset: int,
) -> bool:
    """Check if the given offset has already been committed (idempotency guard)."""
    cur.execute(
        """
        SELECT committed_offset FROM _cdc_offsets
        WHERE topic = %s AND partition_id = %s
        """,
        (topic, partition),
    )
    row = cur.fetchone()
    if row is None:
        return False
    return offset <= row[0]


def update_committed_offset(
    cur: psycopg2.extensions.cursor,
    topic: str,
    partition: int,
    offset: int,
) -> None:
    """Upsert the committed offset for a topic-partition."""
    cur.execute(
        """
        INSERT INTO _cdc_offsets (topic, partition_id, committed_offset, updated_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (topic, partition_id)
        DO UPDATE SET committed_offset = EXCLUDED.committed_offset,
                      updated_at = EXCLUDED.updated_at
        """,
        (topic, partition, offset, datetime.now(timezone.utc)),
    )


def apply_create_or_update(
    cur: psycopg2.extensions.cursor,
    table: str,
    after: dict,
) -> None:
    """Apply an INSERT or UPDATE (upsert) to the target table using the 'after' image."""
    if not after:
        logger.warning("Received create/update event with empty 'after' payload, skipping.")
        return

    columns = list(after.keys())
    values = [after[c] for c in columns]
    placeholders = ", ".join(["%s"] * len(columns))
    col_names = ", ".join(columns)

    # Use UPSERT (INSERT ... ON CONFLICT) for idempotency.
    # Assumes 'id' is the primary key column.
    update_clause = ", ".join(
        f"{col} = EXCLUDED.{col}" for col in columns if col != "id"
    )

    sql = f"""
        INSERT INTO {table} ({col_names})
        VALUES ({placeholders})
        ON CONFLICT (id)
        DO UPDATE SET {update_clause}
    """
    cur.execute(sql, values)


def apply_delete(
    cur: psycopg2.extensions.cursor,
    table: str,
    before: dict,
) -> None:
    """Apply a DELETE to the target table using the 'before' image."""
    if not before:
        logger.warning("Received delete event with empty 'before' payload, skipping.")
        return

    row_id = before.get("id")
    if row_id is None:
        logger.error("Delete event missing 'id' field in 'before' payload: %s", before)
        return

    cur.execute(f"DELETE FROM {table} WHERE id = %s", (row_id,))


def process_event(
    cur: psycopg2.extensions.cursor,
    topic: str,
    event: dict,
) -> None:
    """Process a single Debezium CDC event."""
    if event is None:
        return

    payload = event.get("payload", event)
    operation = payload.get("op")
    table = extract_table_name(topic)

    if operation in ("c", "r"):
        # 'c' = create, 'r' = read (snapshot)
        apply_create_or_update(cur, table, payload.get("after", {}))
    elif operation == "u":
        apply_create_or_update(cur, table, payload.get("after", {}))
    elif operation == "d":
        apply_delete(cur, table, payload.get("before", {}))
    elif operation is None:
        # Tombstone or schema-change event; skip silently.
        logger.debug("Skipping event with no operation field on topic %s.", topic)
    else:
        logger.warning("Unknown operation '%s' on topic %s, skipping.", operation, topic)


# ---------------------------------------------------------------------------
# Main Consumer Loop
# ---------------------------------------------------------------------------


def run() -> None:
    """Main entry point: consume CDC events and apply to target DB."""
    logger.info("Starting CDC consumer...")
    logger.info(
        "Config: kafka=%s group=%s pattern=%s target=%s:%s/%s batch=%d",
        KAFKA_BOOTSTRAP,
        KAFKA_GROUP_ID,
        KAFKA_TOPIC_PATTERN,
        TARGET_DB_HOST,
        TARGET_DB_PORT,
        TARGET_DB_NAME,
        BATCH_SIZE,
    )

    consumer = create_kafka_consumer()
    conn = connect_target_db()

    total_processed = 0
    total_errors = 0
    batch_start = time.monotonic()

    try:
        while not shutdown_requested:
            records = consumer.poll(timeout_ms=int(CONSUMER_POLL_TIMEOUT * 1000))

            if not records:
                continue

            conn = ensure_connection(conn)
            batch_count = 0

            try:
                with conn.cursor() as cur:
                    for topic_partition, messages in records.items():
                        topic = topic_partition.topic
                        partition = topic_partition.partition

                        for message in messages:
                            # Idempotency check
                            if is_offset_processed(cur, topic, partition, message.offset):
                                logger.debug(
                                    "Skipping already-processed offset %d on %s[%d].",
                                    message.offset,
                                    topic,
                                    partition,
                                )
                                continue

                            try:
                                process_event(cur, topic, message.value)
                                update_committed_offset(cur, topic, partition, message.offset)
                                batch_count += 1
                            except Exception as exc:
                                total_errors += 1
                                logger.error(
                                    "Error processing offset %d on %s[%d]: %s",
                                    message.offset,
                                    topic,
                                    partition,
                                    exc,
                                    exc_info=True,
                                )
                                # Roll back the current transaction and skip this event.
                                conn.rollback()
                                # Re-open a cursor after rollback for remaining events.
                                raise

                    # Commit the database transaction and Kafka offsets atomically.
                    conn.commit()
                    consumer.commit()

                    total_processed += batch_count
                    elapsed = time.monotonic() - batch_start

                    if batch_count > 0:
                        logger.info(
                            "Batch committed: %d events (total=%d, errors=%d, elapsed=%.2fs)",
                            batch_count,
                            total_processed,
                            total_errors,
                            elapsed,
                        )
                    batch_start = time.monotonic()

            except Exception as exc:
                logger.error("Batch processing failed: %s. Rolling back...", exc)
                try:
                    conn.rollback()
                except Exception:
                    pass
                # Reconnect on next iteration.
                conn = None
                time.sleep(1)

    except KeyboardInterrupt:
        logger.info("Interrupted by user.")
    finally:
        logger.info(
            "Shutting down. Total processed: %d, Total errors: %d",
            total_processed,
            total_errors,
        )
        try:
            consumer.close()
        except Exception:
            pass
        try:
            if conn and not conn.closed:
                conn.close()
        except Exception:
            pass

    logger.info("CDC consumer stopped.")


if __name__ == "__main__":
    run()
