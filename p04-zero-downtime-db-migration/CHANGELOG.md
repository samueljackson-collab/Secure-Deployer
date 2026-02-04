# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### Added

- Initial release of the Zero-Downtime DB Migration toolkit.
- Docker Compose orchestration with PostgreSQL source/target, Kafka, Zookeeper, and Debezium Connect.
- Python CDC consumer with idempotent write logic.
- Source database initialization script with `users` and `orders` tables and sample data.
- Target database initialization script with matching schema.
- Comprehensive README with architecture diagram, quick start, safety procedures, and cutover guide.
- STRIDE threat model documentation for database migration scenarios.
- ADR for Change Data Capture approach selection.

## [0.2.0] - 2026-01-20

### Added

- Batch processing support in the CDC consumer for improved throughput.
- Dead-letter topic routing for malformed events.
- Configurable poll timeout and batch size via environment variables.

### Fixed

- Consumer crash on malformed JSON payloads from Debezium.
- Connection pool exhaustion under high-throughput replication.

## [0.1.0] - 2026-01-10

### Added

- Proof-of-concept CDC consumer with single-event processing.
- Basic Docker Compose setup with source PostgreSQL and Kafka.
- Initial Debezium connector configuration.

### Known Issues

- No idempotency guarantees on consumer restarts.
- Missing error handling for network partitions.
