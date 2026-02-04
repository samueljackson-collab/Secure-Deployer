#!/usr/bin/env python3
"""
IoT Sensor Data Producer for Apache Kafka.

Generates simulated IoT sensor telemetry (temperature, humidity, device_id,
timestamp) and publishes it to a configurable Kafka topic at a configurable
rate. Designed for use with the real-time data streaming platform.

Usage:
    python producer.py --rate 10 --devices 50 --bootstrap localhost:9092
"""

import argparse
import json
import logging
import random
import signal
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from kafka import KafkaProducer
from kafka.errors import KafkaError, NoBrokersAvailable

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DEFAULT_BOOTSTRAP_SERVERS = "localhost:9092"
DEFAULT_TOPIC = "sensors"
DEFAULT_RATE = 5          # messages per second
DEFAULT_DEVICES = 10
DEFAULT_TEMP_MIN = 15.0   # Celsius
DEFAULT_TEMP_MAX = 45.0
DEFAULT_HUMIDITY_MIN = 20.0  # percent
DEFAULT_HUMIDITY_MAX = 90.0
MAX_RETRIES = 5
RETRY_BACKOFF_S = 2.0

logger = logging.getLogger("iot-producer")

# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------
_shutdown_requested = False


def _signal_handler(signum: int, _frame: Any) -> None:
    """Handle SIGINT / SIGTERM for graceful shutdown."""
    global _shutdown_requested
    sig_name = signal.Signals(signum).name
    logger.info("Received %s — initiating graceful shutdown", sig_name)
    _shutdown_requested = True


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)

# ---------------------------------------------------------------------------
# Device simulation
# ---------------------------------------------------------------------------


def generate_device_ids(count: int) -> List[str]:
    """Generate a fixed pool of deterministic device IDs."""
    return [f"device-{i:04d}" for i in range(count)]


def generate_sensor_reading(
    device_id: str,
    temp_min: float,
    temp_max: float,
    humidity_min: float,
    humidity_max: float,
) -> Dict[str, Any]:
    """
    Generate a single simulated sensor reading.

    Returns a dictionary with keys: device_id, temperature, humidity,
    timestamp, and reading_id.
    """
    return {
        "reading_id": str(uuid.uuid4()),
        "device_id": device_id,
        "temperature": round(random.uniform(temp_min, temp_max), 2),
        "humidity": round(random.uniform(humidity_min, humidity_max), 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

# ---------------------------------------------------------------------------
# Kafka helpers
# ---------------------------------------------------------------------------


def create_producer(bootstrap_servers: str) -> KafkaProducer:
    """
    Create a KafkaProducer with retry logic.

    Retries up to MAX_RETRIES times with exponential back-off if the broker
    is not yet available (common during Docker Compose startup).
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            producer = KafkaProducer(
                bootstrap_servers=bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                retries=3,
                max_in_flight_requests_per_connection=1,
                linger_ms=10,
                batch_size=16384,
                compression_type="gzip",
                request_timeout_ms=30000,
            )
            logger.info(
                "Connected to Kafka at %s (attempt %d/%d)",
                bootstrap_servers,
                attempt,
                MAX_RETRIES,
            )
            return producer
        except NoBrokersAvailable:
            if attempt == MAX_RETRIES:
                logger.error(
                    "Failed to connect to Kafka after %d attempts", MAX_RETRIES
                )
                raise
            wait = RETRY_BACKOFF_S * (2 ** (attempt - 1))
            logger.warning(
                "Kafka broker not available (attempt %d/%d). Retrying in %.1fs...",
                attempt,
                MAX_RETRIES,
                wait,
            )
            time.sleep(wait)

    # Unreachable, but keeps mypy happy.
    raise NoBrokersAvailable()


def on_send_success(record_metadata: Any) -> None:
    """Callback invoked on successful message delivery."""
    logger.debug(
        "Delivered to %s [partition=%d offset=%d]",
        record_metadata.topic,
        record_metadata.partition,
        record_metadata.offset,
    )


def on_send_error(exc: KafkaError) -> None:
    """Callback invoked on message delivery failure."""
    logger.error("Delivery failed: %s", exc)

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


def run(args: argparse.Namespace) -> None:
    """Main producer loop."""
    device_ids = generate_device_ids(args.devices)
    producer = create_producer(args.bootstrap)

    interval = 1.0 / args.rate if args.rate > 0 else 1.0
    messages_sent = 0

    logger.info(
        "Starting production — topic=%s rate=%d msg/s devices=%d",
        args.topic,
        args.rate,
        args.devices,
    )

    try:
        while not _shutdown_requested:
            device_id = random.choice(device_ids)
            reading = generate_sensor_reading(
                device_id=device_id,
                temp_min=args.temp_min,
                temp_max=args.temp_max,
                humidity_min=args.humidity_min,
                humidity_max=args.humidity_max,
            )

            future = producer.send(
                args.topic,
                key=device_id,
                value=reading,
            )
            future.add_callback(on_send_success)
            future.add_errback(on_send_error)

            messages_sent += 1
            if messages_sent % 100 == 0:
                logger.info("Messages sent: %d", messages_sent)

            time.sleep(interval)
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    finally:
        logger.info("Flushing buffered messages...")
        producer.flush(timeout=10)
        producer.close(timeout=10)
        logger.info(
            "Producer shut down cleanly. Total messages sent: %d", messages_sent
        )

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="IoT Sensor Data Producer for Apache Kafka",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--bootstrap",
        type=str,
        default=DEFAULT_BOOTSTRAP_SERVERS,
        help="Kafka bootstrap server(s)",
    )
    parser.add_argument(
        "--topic",
        type=str,
        default=DEFAULT_TOPIC,
        help="Target Kafka topic",
    )
    parser.add_argument(
        "--rate",
        type=int,
        default=DEFAULT_RATE,
        help="Messages per second",
    )
    parser.add_argument(
        "--devices",
        type=int,
        default=DEFAULT_DEVICES,
        help="Number of simulated IoT devices",
    )
    parser.add_argument(
        "--temp-min",
        type=float,
        default=DEFAULT_TEMP_MIN,
        help="Minimum temperature in Celsius",
    )
    parser.add_argument(
        "--temp-max",
        type=float,
        default=DEFAULT_TEMP_MAX,
        help="Maximum temperature in Celsius",
    )
    parser.add_argument(
        "--humidity-min",
        type=float,
        default=DEFAULT_HUMIDITY_MIN,
        help="Minimum humidity percentage",
    )
    parser.add_argument(
        "--humidity-max",
        type=float,
        default=DEFAULT_HUMIDITY_MAX,
        help="Maximum humidity percentage",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Logging verbosity",
    )
    return parser.parse_args()


def main() -> None:
    """Entry point."""
    args = parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )
    run(args)


if __name__ == "__main__":
    main()
