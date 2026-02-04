# P20: Python Tooling & Automation

A modular Python toolkit providing CLI scripts, AWS utilities, health-check probes, and resource-cleanup automation for infrastructure operations teams.

## Overview

This project delivers a set of composable command-line tools that streamline day-to-day cloud operations work. Every module is independently importable, fully typed, and covered by unit tests so that teams can adopt individual components without pulling in the entire toolkit.

## Features

| Module | Purpose |
|---|---|
| `automation_toolkit.aws` | List EC2 instances, check status, tag resources, find untagged assets |
| `automation_toolkit.health` | HTTP endpoint checks, DNS resolution, SSL certificate expiry |
| `automation_toolkit.cli` | Click-based CLI unifying all modules under a single entry point |
| `automation_toolkit.logger` | Structured JSON logging with configurable levels |
| `scripts/aws_resource_cleaner.py` | Standalone script for cleaning stale AMIs, snapshots, and untagged resources |

## Quick Start

### Installation

```bash
# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install in editable mode with dev dependencies
pip install -e ".[dev]"
```

### CLI Usage

```bash
# List all EC2 instances across regions
automation-toolkit aws-inventory --region us-east-1

# Run health checks against a list of endpoints
automation-toolkit health-check --target https://example.com --timeout 10

# Identify resources that can be cleaned up (dry-run by default)
automation-toolkit cleanup-resources --older-than 90 --dry-run
```

### Standalone Scripts

```bash
# Preview resources eligible for cleanup
python scripts/aws_resource_cleaner.py --days 90 --dry-run

# Execute cleanup (requires explicit --execute flag)
python scripts/aws_resource_cleaner.py --days 90 --execute
```

## Project Structure

```
p20-python-tooling-automation/
├── docs/
│   ├── threat-model.md
│   └── adr/
│       ├── 001-use-python-for-custom-tooling.md
│       └── 002-adopt-modular-toolkit-structure.md
├── scripts/
│   └── aws_resource_cleaner.py
├── src/
│   └── automation_toolkit/
│       ├── __init__.py
│       ├── aws.py
│       ├── cli.py
│       ├── health.py
│       └── logger.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_aws.py
│   └── test_health.py
├── requirements.txt
├── setup.py
├── CHANGELOG.md
└── README.md
```

## Testing

```bash
# Run the full test suite
pytest -v

# Run with coverage reporting
pytest --cov=automation_toolkit --cov-report=term-missing

# Run a specific test module
pytest tests/test_aws.py -v
```

## Packaging

The toolkit is packaged with `setup.py` and exposes the `automation-toolkit` console script:

```bash
pip install .
automation-toolkit --help
```

## Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `AWS_DEFAULT_REGION` | Default AWS region for API calls | `us-east-1` |
| `LOG_LEVEL` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) | `INFO` |
| `LOG_FORMAT` | Output format (`json`, `text`) | `json` |
| `HEALTH_CHECK_TIMEOUT` | Default timeout in seconds for HTTP probes | `10` |

## Security Considerations

- AWS credentials are never stored in configuration files; the toolkit relies on the standard boto3 credential chain (environment variables, instance profiles, SSO).
- The resource cleaner operates in **dry-run mode by default** and requires an explicit `--execute` flag before making destructive changes.
- All external inputs are validated before use to prevent command-injection vulnerabilities.
- See `docs/threat-model.md` for a full STRIDE analysis.

## License

MIT
