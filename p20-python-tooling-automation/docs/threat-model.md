# Threat Model: Python Tooling & Automation

## Document Information

| Field | Value |
|---|---|
| Project | P20 - Python Tooling & Automation |
| Methodology | STRIDE |
| Last Updated | 2025-06-15 |
| Status | Active |

## System Description

The automation toolkit is a CLI-based Python application that interacts with AWS APIs, performs network health checks, and executes resource-cleanup operations. It runs on developer workstations and CI/CD runners with access to cloud credentials and internal networks.

## Data Flow Diagram

```
┌──────────────┐      ┌─────────────────────┐      ┌───────────────┐
│   Operator   │─────>│  automation-toolkit  │─────>│   AWS APIs    │
│  (CLI user)  │      │   CLI / Scripts      │      │  (EC2, IAM)   │
└──────────────┘      └──────┬──────┬────────┘      └───────────────┘
                             │      │
                    ┌────────┘      └────────┐
                    v                        v
          ┌─────────────────┐     ┌─────────────────┐
          │  Target HTTP    │     │  Structured Log  │
          │  Endpoints      │     │  Output (JSON)   │
          └─────────────────┘     └─────────────────┘
```

## STRIDE Analysis

### 1. Spoofing

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| S-1 | An attacker spoofs AWS credentials to execute privileged operations through the toolkit. | High | Rely exclusively on the boto3 credential chain (environment variables, instance profiles, SSO). Never accept credentials as CLI arguments or store them in config files. |
| S-2 | A malicious actor impersonates a health-check target by poisoning DNS. | Medium | Validate TLS certificates during health checks. Log the resolved IP alongside the hostname for forensic comparison. |

### 2. Tampering

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| T-1 | An attacker modifies the toolkit source on a shared CI runner to introduce a backdoor. | High | Pin the package version in `requirements.txt` with hashes. Use signed commits and verify integrity in CI before execution. |
| T-2 | Log output is tampered with to hide evidence of destructive operations. | Medium | Write logs to an append-only destination (e.g., CloudWatch Logs with a resource policy preventing deletion). Include HMAC signatures in structured log entries when operating in audit mode. |

### 3. Repudiation

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| R-1 | An operator runs destructive cleanup and later denies responsibility. | Medium | Every CLI invocation logs the caller identity (`sts:GetCallerIdentity`), timestamp, arguments, and a unique invocation ID. Emit these fields in every structured log line. |
| R-2 | Changes made by `tag_resources()` cannot be attributed to a specific run. | Low | Apply an `automation:run-id` tag to every resource modified, linking changes back to the structured log. |

### 4. Information Disclosure

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| I-1 | AWS credentials appear in log output or error tracebacks. | Critical | Scrub environment variables and boto3 session tokens from all log formatters. Override the default exception handler to redact sensitive patterns (`AKIA*`, `aws_secret_access_key`). |
| I-2 | Health-check responses leak internal service details through verbose error messages. | Medium | Truncate and sanitise HTTP response bodies before logging. Never log headers that may contain `Authorization` or `Cookie` values. |

### 5. Denial of Service

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| D-1 | The resource cleaner deletes production resources due to an overly broad filter. | Critical | Operate in dry-run mode by default. Require an explicit `--execute` flag. Enforce a configurable maximum number of resources per run and abort if the threshold is exceeded. |
| D-2 | Excessive API calls from the toolkit trigger AWS throttling, degrading other services sharing the same account. | Medium | Implement exponential backoff with jitter. Respect `Retry-After` headers. Allow the operator to set a maximum request rate via `--rate-limit`. |

### 6. Elevation of Privilege

| ID | Threat | Severity | Mitigation |
|---|---|---|---|
| E-1 | Command-injection through unsanitised user input passed to `subprocess` or shell commands. | Critical | Never invoke shell commands with user-supplied strings. Use the `subprocess` module with `shell=False` and explicit argument lists. Validate all CLI inputs with Click parameter types. |
| E-2 | The toolkit IAM role has broader permissions than required, allowing lateral movement if compromised. | High | Follow least-privilege principles. Document the minimum IAM policy required for each CLI command. Provide a sample IAM policy in the repository. |

## Residual Risks

| ID | Description | Acceptance Rationale |
|---|---|---|
| RR-1 | A zero-day in a transitive dependency (e.g., `urllib3`) could expose the toolkit to remote code execution. | Mitigated by Dependabot alerts, pinned versions, and hash verification. Accepted as industry-standard residual risk. |
| RR-2 | An operator with legitimate credentials could intentionally misuse the cleanup script. | Addressed through logging and audit trails. Insider-threat mitigation is an organisational control beyond the toolkit's scope. |
