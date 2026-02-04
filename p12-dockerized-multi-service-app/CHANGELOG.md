# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-15

### Added

- Multi-service Docker Compose setup with Nginx, Flask API, Celery worker, Redis, and PostgreSQL.
- Nginx reverse proxy with security headers (X-Frame-Options, X-Content-Type-Options, CSP, HSTS).
- Rate limiting at the Nginx layer (10 requests per second).
- Flask REST API with health check, task creation, listing, and status endpoints.
- Celery background worker for asynchronous task processing.
- Redis as Celery message broker with memory limits and LRU eviction policy.
- PostgreSQL 16 with persistent volume for data storage.
- Multi-stage Docker build for the API with non-root user and health check.
- Network isolation: frontend network for proxy-to-API, internal backend network for data services.
- Resource limits on Nginx container (128M memory, 0.25 CPU).
- Health checks on API, PostgreSQL, and Redis services.
- STRIDE threat model documentation for containerized environments.
- Architecture Decision Record for Docker Compose local development.
