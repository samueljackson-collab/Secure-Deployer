# ADR-001: Use Python for Custom Tooling

## Status

Accepted

## Date

2025-06-01

## Context

The infrastructure team needs a language for building internal CLI tools that interact with AWS APIs, run health checks, and automate resource lifecycle management. The candidates evaluated were:

- **Python** - Widely used in DevOps, mature AWS SDK (boto3), rich CLI frameworks (Click), extensive testing ecosystem.
- **Go** - Excellent for compiled CLI binaries with zero runtime dependencies. Stronger concurrency primitives.
- **Bash** - Already in use for ad-hoc scripts. No additional runtime required.
- **TypeScript / Node.js** - Strong typing when desired, good for teams already using JavaScript tooling.

Key decision drivers:

1. **Team familiarity** - All operations engineers are proficient in Python; only two have Go experience.
2. **Ecosystem maturity** - boto3 is the canonical AWS SDK, maintained by AWS. `moto` provides the most comprehensive AWS mock library available in any language.
3. **Iteration speed** - Interpreted execution allows rapid prototyping and debugging without a compile step.
4. **Testability** - pytest, unittest.mock, and moto make it straightforward to achieve high test coverage for cloud-interacting code.
5. **Maintainability** - Type hints (PEP 484) combined with mypy provide optional static analysis without sacrificing Python's flexibility.

## Decision

We will use **Python 3.10+** as the primary language for all custom infrastructure tooling.

## Consequences

### Positive

- Engineers can contribute immediately without learning a new language.
- Direct access to boto3 removes the need for wrapper libraries or REST-level API calls.
- The Click framework provides auto-generated help text, argument validation, and composable command groups.
- moto enables unit tests that exercise real AWS SDK call paths without incurring cloud costs or requiring network access.
- Rich ecosystem of linting (ruff), formatting (black), and type-checking (mypy) tools integrates cleanly with CI.

### Negative

- Python scripts require a runtime environment on every execution host. Mitigated by containerising the toolkit and providing a Docker image.
- Performance-critical paths (e.g., processing thousands of resources) may be slower than compiled alternatives. Mitigated by using generators and lazy evaluation where appropriate.
- Dependency management adds overhead (virtual environments, version pinning). Mitigated by adopting a single `requirements.txt` with hash verification and Dependabot monitoring.

### Neutral

- The team will adopt Python packaging conventions (`setup.py`, entry points) which require initial learning but are well-documented.
