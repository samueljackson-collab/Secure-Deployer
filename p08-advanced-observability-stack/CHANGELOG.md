# Changelog

All notable changes to **P08: Advanced Observability Stack** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### Added

- Docker Compose stack with Prometheus, Loki, Grafana, Tempo, Node Exporter, and Promtail.
- Prometheus scrape configuration for node-exporter, self-monitoring, and alertmanager targets.
- Grafana datasource provisioning for Prometheus, Loki, and Tempo with auto-configured URLs.
- Prometheus alerting rules: HighCPU, HighMemory, InstanceDown, DiskSpaceLow.
- Loki configuration with local filesystem storage, 7-day retention, and ingestion limits.
- STRIDE threat model addressing log injection, metrics tampering, and unauthorized dashboard access.
- Architecture Decision Record (ADR-001) for adopting the unified PLGT observability stack.
- Comprehensive README with architecture diagram, quick-start guide, and configuration reference.

## [0.2.0] - 2026-01-22

### Added

- Tempo distributed tracing backend integration.
- Promtail log shipping agent with Docker log discovery.
- Health checks for all Docker Compose services.

### Changed

- Prometheus retention increased from 7 days to 15 days.
- Grafana updated from 10.2 to 10.3.

### Fixed

- Loki ingestion rate limit was too aggressive for multi-container environments.

## [0.1.0] - 2026-01-10

### Added

- Initial project scaffold with Prometheus and Grafana.
- Basic Node Exporter scrape configuration.
- Default Grafana admin credentials and datasource provisioning.
