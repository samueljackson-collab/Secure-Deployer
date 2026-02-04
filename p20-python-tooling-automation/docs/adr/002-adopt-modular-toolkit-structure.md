# ADR-002: Adopt Modular Toolkit Structure

## Status

Accepted

## Date

2025-06-05

## Context

The team's existing automation scripts are standalone files scattered across multiple repositories. Each script duplicates common logic such as AWS session creation, logging configuration, and argument parsing. This duplication leads to:

- Inconsistent error handling across scripts.
- Divergent logging formats that complicate centralised log analysis.
- No shared test infrastructure, resulting in low test coverage.
- Difficulty onboarding new team members who must learn each script individually.

Two structural approaches were considered:

1. **Monolithic CLI application** - A single large module containing all commands and helpers.
2. **Modular toolkit with composable packages** - Separate modules for AWS utilities, health checks, logging, and CLI entry points, assembled through a shared package namespace.

## Decision

We will adopt a **modular toolkit structure** organised under the `automation_toolkit` Python package. Each functional domain (AWS operations, health checks, logging) will be an independent module that can be imported and tested in isolation. The Click CLI layer will compose these modules into user-facing commands.

### Package Layout

```
src/
  automation_toolkit/
    __init__.py       # Package metadata and version
    aws.py            # AWS utility functions
    health.py         # Health-check probes
    logger.py         # Structured logging configuration
    cli.py            # Click command group (entry point)
```

### Design Principles

1. **Single Responsibility** - Each module owns one functional domain.
2. **Dependency Inversion** - Modules accept boto3 sessions and configuration as parameters rather than constructing them internally, enabling straightforward testing with mocks.
3. **Fail-Safe Defaults** - Destructive operations default to dry-run mode. Explicit opt-in is required.
4. **Structured Output** - All modules emit structured (JSON) log entries through the shared logger.

## Consequences

### Positive

- Modules can be imported independently in Jupyter notebooks, Lambda functions, or other tools without pulling in the entire CLI.
- Test files mirror the source layout (`test_aws.py`, `test_health.py`), making it obvious which tests cover which module.
- New functional domains (e.g., Kubernetes utilities) can be added as new modules without modifying existing code.
- The shared logger ensures consistent log formatting across all commands and scripts.

### Negative

- The package structure introduces a small amount of boilerplate (`setup.py`, `__init__.py`, entry points).
- Developers must understand Python packaging conventions to add new modules correctly.

### Neutral

- Standalone scripts (e.g., `aws_resource_cleaner.py`) remain in the `scripts/` directory for backward compatibility but import shared logic from the package rather than duplicating it.
