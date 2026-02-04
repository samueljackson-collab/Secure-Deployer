# Changelog

All notable changes to the Python Tooling & Automation project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-06-15

### Added

- Initial release of the automation toolkit.
- `automation_toolkit.aws` module with `list_instances()`, `get_instance_status()`, `tag_resources()`, and `find_untagged_resources()`.
- `automation_toolkit.health` module with `check_endpoint()`, `check_dns()`, and `check_ssl_cert_expiry()`.
- `automation_toolkit.cli` Click-based CLI with `aws-inventory`, `cleanup-resources`, and `health-check` commands.
- `automation_toolkit.logger` structured JSON logging with configurable levels.
- Standalone `scripts/aws_resource_cleaner.py` with dry-run-by-default behaviour.
- Comprehensive unit tests using `moto` for AWS mocking and `unittest.mock` for health checks.
- Pytest fixtures in `conftest.py` for reusable AWS mock sessions.
- STRIDE threat model covering credential handling and command-injection risks.
- ADR-001: Use Python for custom tooling.
- ADR-002: Adopt modular toolkit structure.
