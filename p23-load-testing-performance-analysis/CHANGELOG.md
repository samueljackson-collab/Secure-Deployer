# Changelog

All notable changes to the Load Testing & Performance Analysis project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-05-15

### Added

- Smoke test (`scripts/smoke-test.js`) -- single VU health check validation with 500 ms p95 threshold.
- Load test (`scripts/load-test.js`) -- 100-VU sustained traffic simulation covering `/api/users` and `/api/orders`.
- Stress test (`scripts/stress-test.js`) -- graduated ramp to 500 VUs for breaking-point discovery.
- Spike test (`scripts/spike-test.js`) -- burst traffic to 200 VUs with recovery verification.
- Shared helper utilities (`scripts/helpers/utils.js`) -- random data generators, auth token helper, custom metric factories.
- External thresholds configuration (`scripts/thresholds.json`) for environment-specific SLA overrides.
- GitHub Actions workflow (`.github/workflows/load-test.yml`) -- PR smoke tests, nightly load tests, manual dispatch.
- ADR-001 documenting the decision to use k6 over JMeter and Locust.
- STRIDE threat model covering accidental DoS, credential exposure, and result integrity risks.
- Comprehensive README with quick-start guide, CI integration docs, and results analysis guidance.

## [0.2.0] - 2025-04-20

### Added

- Spike test scenario for burst-traffic validation.
- Custom k6 metrics (`order_creation_duration`, `user_fetch_duration`) for per-endpoint analysis.
- Docker execution instructions in README.

### Changed

- Refactored load test to use `ramping-vus` executor instead of `constant-vus` for more realistic ramp patterns.
- Moved threshold definitions to external JSON file for portability.

### Fixed

- Auth token helper no longer logs the token value to stdout during test initialization.

## [0.1.0] - 2025-03-10

### Added

- Initial smoke test and load test scripts.
- Basic GitHub Actions workflow for smoke test on PRs.
- Project scaffolding and README draft.
