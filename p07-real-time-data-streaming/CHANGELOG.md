# Changelog

All notable changes to **P07: Real-Time Data Streaming** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### Added

- Docker Compose stack with Zookeeper, Kafka, Flink JobManager/TaskManager, and Schema Registry.
- Python-based Kafka producer generating simulated IoT sensor data (temperature, humidity, device ID, timestamp).
- Configurable producer rate, device count, and value ranges via CLI arguments.
- Flink SQL job with tumbling window aggregation (1-minute windows, per-device average/min/max metrics).
- Source table definition reading JSON-encoded messages from the `sensors` Kafka topic.
- Sink table definition writing aggregated results to the `aggregated` Kafka topic.
- STRIDE threat model covering data tampering, unauthorized topic access, and replay attacks.
- Architecture Decision Record (ADR-001) documenting Kafka + Flink selection rationale.
- Comprehensive README with architecture diagram, quick-start guide, and configuration reference.

## [0.2.0] - 2026-01-20

### Added

- Schema Registry integration for JSON schema validation.
- Health check configurations for all Docker Compose services.
- Producer graceful shutdown on SIGINT/SIGTERM.

### Changed

- Kafka broker configuration updated for improved durability (`min.insync.replicas=1`).
- Flink checkpointing interval reduced from 60s to 30s for faster recovery.

## [0.1.0] - 2026-01-08

### Added

- Initial project scaffold with Docker Compose for Kafka and Zookeeper.
- Basic Python producer with fixed message rate.
- Prototype Flink SQL job with simple passthrough query.
