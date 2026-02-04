# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-15

### Added

- MLflow experiment tracking integration for scikit-learn training pipelines
- FastAPI model serving endpoint with `/health` and `/predict` routes
- Pydantic request/response schemas with input validation
- Iris classification training script with hyperparameter logging
- Playwright E2E test suite for API health and prediction endpoints
- Playwright configuration with Chromium project, retries, and HTML reporter
- GitHub Actions workflow for automated E2E testing
- STRIDE threat model covering model poisoning, data exfiltration, and unauthorized deployment
- Architecture Decision Records for MLflow and Playwright adoption
- Project documentation and README with architecture diagram
