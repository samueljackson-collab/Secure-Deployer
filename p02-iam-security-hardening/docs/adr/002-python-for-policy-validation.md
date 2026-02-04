# ADR-002: Use Python for Policy Validation

## Status

Accepted

## Date

2026-01-06

## Context

We need a static analysis tool that can inspect IAM policy JSON documents and
flag dangerous patterns (wildcard actions, wildcard resources, missing
conditions, etc.) **before** they are applied to the AWS account.

The tool must:

1. Run in CI pipelines (GitHub Actions, GitLab CI, Jenkins).
2. Produce machine-readable output (JSON) for downstream processing.
3. Produce human-readable output for developer feedback.
4. Be easy to extend with new checks.
5. Have minimal external dependencies to reduce supply-chain risk.

We considered the following options:

| Option | Pros | Cons |
|--------|------|------|
| **Python** | Stdlib `json` module handles policy parsing; `argparse` for CLI; broad team familiarity; runs everywhere. | Slower than compiled languages for very large workloads (not a concern here). |
| **Go** | Fast, single binary distribution. | Smaller team familiarity; heavier build toolchain for a focused validation tool. |
| **OPA/Rego** | Purpose-built policy language. | Requires learning Rego; harder to produce rich structured output; additional runtime dependency. |
| **Bash + jq** | Zero dependencies on most CI images. | Fragile for complex logic; poor error handling; difficult to test. |

## Decision

We will implement the policy validator in **Python** (>= 3.8) using only the
standard library.

## Rationale

* **Zero external dependencies** -- the validator uses only `json`, `argparse`,
  `pathlib`, `sys`, and `typing` from the standard library.  This eliminates
  supply-chain concerns and simplifies installation.
* **Testability** -- Python's `unittest` (and optionally `pytest`) makes it
  straightforward to achieve comprehensive test coverage.
* **Extensibility** -- new checks are added by writing a small function in
  `validator.py` and registering it in the check list.
* **CI portability** -- Python 3.8+ is pre-installed on virtually every CI
  runner image.
* **Team fluency** -- all team members are proficient in Python.

## Consequences

### Positive

* Fast iteration cycle for adding new checks.
* Tests run in seconds without compilation.
* No binary distribution or cross-compilation needed.

### Negative

* Not suitable for extremely latency-sensitive or high-throughput scanning
  workloads (not an expected use-case).
* Must pin the minimum Python version (3.8) and test across supported
  versions.

## References

* [Python `json` module](https://docs.python.org/3/library/json.html)
* [AWS IAM Policy Grammar](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_grammar.html)
