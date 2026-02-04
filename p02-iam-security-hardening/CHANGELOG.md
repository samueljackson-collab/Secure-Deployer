# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-02-04

### Added

- Terraform `iam-policy` module for creating least-privilege customer-managed
  IAM policies with support for condition blocks, resource scoping, and tagging.
- Terraform `iam-assumable-role` module for provisioning IAM roles with
  configurable trust policies, managed policy attachment, and optional
  permissions boundaries.
- Root Terraform module composing both IAM sub-modules with sensible defaults
  for a production deployment.
- Python `policy_validator` package providing static analysis of IAM policy
  JSON documents.
- Validation checks for wildcard actions, wildcard resources, missing
  conditions on sensitive actions, overly permissive principals, and
  `NotAction`/`NotResource` anti-patterns.
- CLI entry point (`policy_validator.main`) supporting text and JSON output
  formats and a `--strict` flag for CI pipelines.
- Comprehensive unit test suite (`test_unit_validator.py`) covering all
  validation rules, edge cases, and error handling.
- Integration test suite (`test_integration_validator.py`) covering CLI exit
  codes, output formats, and error scenarios.
- Sample test policy files (good, wildcard resource, multi-finding, invalid
  JSON) used by the test suites.
- STRIDE-based threat model document (`docs/threat-model.md`).
- Architecture Decision Records for Terraform adoption, Python validation
  tooling, and modular IAM design.
- Project README with usage instructions, architecture overview, and
  contribution guidelines.

## [0.2.0] - 2026-01-20

### Added

- Draft `iam-policy` Terraform module with basic statement support.
- Initial `policy_validator` prototype with wildcard action detection.

### Changed

- Refined module variable naming to align with HashiCorp conventions.

## [0.1.0] - 2026-01-06

### Added

- Repository scaffolding and initial directory layout.
- ADR-001: Decision to use Terraform for IAM management.
- Placeholder README.

[Unreleased]: https://github.com/example/p02-iam-security-hardening/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/example/p02-iam-security-hardening/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/example/p02-iam-security-hardening/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/example/p02-iam-security-hardening/releases/tag/v0.1.0
