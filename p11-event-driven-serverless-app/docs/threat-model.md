# Threat Model: Event-Driven Serverless Application

## Overview

This document provides a STRIDE-based threat analysis for the event-driven serverless application composed of API Gateway, AWS Lambda, Amazon SQS, and Amazon DynamoDB.

## System Boundary

```
Internet --> API Gateway --> Ingestion Lambda --> SQS --> Processing Lambda --> DynamoDB
                                                  |
                                                  v
                                                 DLQ
```

### Trust Boundaries

1. **External to API Gateway**: Untrusted internet traffic enters here.
2. **API Gateway to Lambda**: AWS-managed boundary; requests are authenticated/throttled.
3. **Lambda to SQS**: Internal AWS service communication over AWS SDK.
4. **SQS to Lambda**: Event-source mapping managed by AWS.
5. **Lambda to DynamoDB**: Internal AWS service communication.

---

## STRIDE Analysis

### 1. Spoofing

| Threat | Description | Severity | Mitigation |
|---|---|---|---|
| S-1: API caller impersonation | An attacker sends requests pretending to be a legitimate client. | High | Implement API key authentication or IAM authorization on API Gateway. Use Cognito user pools for user-facing APIs. |
| S-2: Cross-account SQS access | A malicious actor from another AWS account sends messages to the SQS queue. | Medium | SQS resource policy restricts `sqs:SendMessage` to the Ingestion Lambda execution role only. |
| S-3: Lambda execution role hijacking | Compromised credentials allow unauthorized invocation. | High | Rotate credentials automatically via IAM roles. Enable CloudTrail for auditing API calls. |

### 2. Tampering

| Threat | Description | Severity | Mitigation |
|---|---|---|---|
| T-1: Event payload injection | Malicious or malformed payloads injected via API Gateway to exploit downstream processing. | Critical | Strict input validation in the Ingestion Lambda (schema validation, size limits, type checking). API Gateway request validation models. |
| T-2: SQS message modification | An attacker with queue access modifies messages in transit. | Medium | Enable SQS server-side encryption (SSE-SQS or SSE-KMS). Restrict queue access to authorized roles only. |
| T-3: DynamoDB record manipulation | Direct modification of stored records bypassing application logic. | High | IAM policies restrict DynamoDB access to the Processing Lambda role only. Enable DynamoDB Streams for audit trail. |

### 3. Repudiation

| Threat | Description | Severity | Mitigation |
|---|---|---|---|
| R-1: Untracked API invocations | An attacker performs actions that cannot be traced back. | Medium | Enable API Gateway access logging. Enable CloudTrail for all AWS API calls. Structured logging with correlation IDs. |
| R-2: DLQ message origin unknown | Messages in the DLQ cannot be attributed to their source. | Low | Include source metadata (request ID, timestamp, source IP) in SQS message attributes. |

### 4. Information Disclosure

| Threat | Description | Severity | Mitigation |
|---|---|---|---|
| I-1: Sensitive data in logs | Lambda functions log PII or secrets to CloudWatch. | High | Structured logging with explicit field selection. Never log raw request bodies containing sensitive data. Use log redaction patterns. |
| I-2: Error messages leak internals | Detailed stack traces returned to API callers. | Medium | Return generic error messages to clients. Log detailed errors server-side only. |
| I-3: DynamoDB data exposure | Unauthorized read access to stored event data. | High | Encrypt DynamoDB at rest (default). IAM policies restrict read access. Use VPC endpoints if applicable. |

### 5. Denial of Service

| Threat | Description | Severity | Mitigation |
|---|---|---|---|
| D-1: API Gateway flooding | High-volume requests overwhelm the API and downstream services. | High | API Gateway throttling (rate limiting and burst limits). Consider WAF integration for advanced protection. |
| D-2: Denial of Wallet (DoW) | Attacker triggers massive Lambda invocations causing unexpected AWS billing. | Critical | Set Lambda reserved concurrency limits. Configure SQS maxReceiveCount and visibility timeout. Set up billing alarms and account-level spending limits. |
| D-3: SQS queue saturation | Excessive messages overwhelm the processing pipeline. | Medium | Monitor `ApproximateNumberOfMessagesVisible` metric. Set CloudWatch alarms. Configure SQS message retention period. |
| D-4: DynamoDB throttling | Write-heavy workload exceeds provisioned/on-demand capacity. | Medium | Use on-demand capacity mode or configure auto-scaling. Monitor `ThrottledRequests` metric. |

### 6. Elevation of Privilege

| Threat | Description | Severity | Mitigation |
|---|---|---|---|
| E-1: Overly permissive Lambda role | Lambda execution role has broader permissions than necessary. | Critical | Apply least-privilege IAM policies. Each Lambda function has its own role scoped to required resources only. No `*` resource ARNs. |
| E-2: Code injection via event payload | Crafted payload causes code execution in the Lambda runtime. | High | Input validation and sanitization. Do not use `eval()` or dynamic code execution. Pin runtime dependencies. |
| E-3: Dependency supply chain attack | Compromised third-party library in Lambda layers. | Medium | Use `pip audit` to scan dependencies. Pin dependency versions. Use private artifact repositories in production. |

---

## Risk Summary

| Risk | Likelihood | Impact | Priority |
|---|---|---|---|
| Denial of Wallet | Medium | Critical | P1 |
| Event payload injection | High | High | P1 |
| Overly permissive IAM roles | Medium | Critical | P1 |
| Sensitive data in logs | Medium | High | P2 |
| API flooding / DoS | Medium | High | P2 |
| Dependency supply chain | Low | High | P3 |

## Review Schedule

This threat model must be reviewed:

- At least quarterly.
- When new AWS services are added to the architecture.
- When the data classification of processed events changes.
- After any security incident.
