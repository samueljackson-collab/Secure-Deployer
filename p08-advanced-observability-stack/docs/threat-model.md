# Threat Model: Advanced Observability Stack

## Overview

This document applies the **STRIDE** threat modeling framework to the PLGT observability stack (Prometheus, Loki, Grafana, Tempo). The scope covers metrics ingestion, log aggregation, trace collection, dashboard access, and alerting infrastructure.

## System Boundaries

```
[Applications] --metrics--> [Prometheus] --query--> [Grafana]
[Applications] --logs-----> [Promtail] --> [Loki] --query--> [Grafana]
[Applications] --traces---> [Tempo] --query--> [Grafana]
[Infrastructure] --metrics--> [Node Exporter] --> [Prometheus]
[Prometheus] --alerts--> [Alertmanager] --notify--> [PagerDuty/Slack]
```

### Assets

| Asset                         | Classification | Description                                      |
|-------------------------------|----------------|--------------------------------------------------|
| Application metrics           | Internal       | Prometheus time-series data from instrumented apps|
| Application logs              | Confidential   | Structured and unstructured log entries           |
| Distributed traces            | Internal       | Request-scoped trace spans across services        |
| Grafana dashboards            | Internal       | Visualization configurations and queries          |
| Alert rules and routing       | Confidential   | Alerting thresholds and notification channels     |
| Grafana user credentials      | Confidential   | Authentication tokens and passwords               |
| Prometheus TSDB data          | Internal       | On-disk time-series database files                |

## STRIDE Analysis

### 1. Spoofing

| Threat ID | Threat                                              | Impact | Likelihood | Mitigation                                                                                   |
|-----------|------------------------------------------------------|--------|------------|-----------------------------------------------------------------------------------------------|
| S-01      | Unauthorized user accesses Grafana dashboards        | High   | Medium     | Enable Grafana authentication (OAuth2/LDAP). Enforce MFA for admin accounts.                  |
| S-02      | Rogue service pushes fake metrics to Prometheus      | Medium | Low        | Use service discovery with allow-lists. Implement mTLS for scrape targets.                    |
| S-03      | Attacker impersonates Promtail to inject logs        | High   | Low        | Require mTLS between Promtail and Loki. Validate tenant IDs in multi-tenant mode.             |

### 2. Tampering

| Threat ID | Threat                                                | Impact | Likelihood | Mitigation                                                                                   |
|-----------|--------------------------------------------------------|--------|------------|-----------------------------------------------------------------------------------------------|
| T-01      | Log injection — crafted log entries with fake fields  | High   | Medium     | Validate and sanitize log labels at the Promtail level. Enforce structured logging formats.   |
| T-02      | Metrics tampering via exposed Prometheus push gateway | High   | Medium     | Disable pushgateway in production or restrict access via network policy and authentication.   |
| T-03      | Modified alert rules to suppress critical alerts      | Critical | Low      | Store alert rules in version control. Enable file integrity monitoring on rule files.          |
| T-04      | Grafana dashboard modifications by unauthorized users | Medium | Medium     | Use Grafana RBAC — restrict edit permissions to authorized roles only.                        |

### 3. Repudiation

| Threat ID | Threat                                              | Impact | Likelihood | Mitigation                                                                                   |
|-----------|------------------------------------------------------|--------|------------|-----------------------------------------------------------------------------------------------|
| R-01      | User denies modifying alert rules or dashboards      | Medium | Medium     | Enable Grafana audit logging. Track all configuration changes in version control.              |
| R-02      | Administrator denies silencing critical alerts         | High   | Low        | Integrate Alertmanager with audit trail. Log all silence creation/deletion events.            |

### 4. Information Disclosure

| Threat ID | Threat                                                 | Impact | Likelihood | Mitigation                                                                                  |
|-----------|--------------------------------------------------------|--------|------------|----------------------------------------------------------------------------------------------|
| I-01      | Sensitive data in logs (passwords, tokens, PII)         | Critical | High   | Implement log scrubbing pipelines in Promtail. Define drop rules for sensitive patterns.     |
| I-02      | Prometheus metrics expose internal architecture details | Medium | Medium     | Restrict Prometheus UI access. Use reverse proxy with authentication.                        |
| I-03      | Tempo traces contain request payloads with PII          | High   | Medium     | Configure trace sampling. Implement span attribute scrubbing for sensitive fields.           |
| I-04      | Grafana anonymous access exposes dashboards             | Medium | Medium     | Disable anonymous access (`auth.anonymous.enabled = false`). Require login for all views.    |

### 5. Denial of Service

| Threat ID | Threat                                                  | Impact | Likelihood | Mitigation                                                                                  |
|-----------|---------------------------------------------------------|--------|------------|----------------------------------------------------------------------------------------------|
| D-01      | Log flood overwhelms Loki ingestion                     | High   | Medium     | Configure Loki ingestion rate limits and per-tenant quotas. Implement back-pressure.         |
| D-02      | High-cardinality metrics exhaust Prometheus TSDB         | High   | Medium     | Set `sample_limit` per scrape config. Monitor cardinality with `prometheus_tsdb_*` metrics.  |
| D-03      | Expensive Grafana queries degrade performance            | Medium | Medium     | Set query timeouts in Grafana datasource configuration. Enable query caching.                |
| D-04      | Trace flood exhausts Tempo storage                       | Medium | Low        | Configure head-based sampling. Set Tempo ingestion rate limits.                              |

### 6. Elevation of Privilege

| Threat ID | Threat                                                  | Impact | Likelihood | Mitigation                                                                                 |
|-----------|---------------------------------------------------------|--------|------------|--------------------------------------------------------------------------------------------|
| E-01      | Grafana viewer escalates to admin role                   | Critical | Low     | Enforce Grafana RBAC. Audit role assignments regularly. Disable org role auto-assignment.   |
| E-02      | Container escape from observability services             | Critical | Low     | Run containers as non-root. Apply read-only root filesystems. Use seccomp profiles.        |
| E-03      | Prometheus config reload endpoint used to load malicious config | High | Low | Restrict `/-/reload` endpoint via reverse proxy. Bind admin endpoints to localhost only.    |

## Risk Summary Matrix

| Risk Level | Count | Action Required                        |
|------------|-------|----------------------------------------|
| Critical   | 4     | Immediate remediation before production |
| High       | 7     | Remediate within current sprint         |
| Medium     | 8     | Schedule for next sprint                |
| Low        | 0     | Accept with monitoring                  |

## Recommendations

1. **Enforce authentication everywhere**: Grafana (OAuth2 + MFA), Prometheus (reverse proxy auth), Loki (tenant auth), Tempo (gateway auth).
2. **Implement log scrubbing**: Configure Promtail pipeline stages to drop or redact sensitive data before ingestion.
3. **Version-control all configurations**: Alert rules, dashboard JSON, datasource provisioning files — all in Git with PR-based review.
4. **Network isolation**: Place observability services on a dedicated network. Restrict ingress to only authorized sources.
5. **Rate limiting**: Configure ingestion limits for Loki, Prometheus, and Tempo to prevent resource exhaustion.
6. **Regular audits**: Review Grafana user roles, alert rule changes, and dashboard modifications quarterly.

## Review Schedule

This threat model must be reviewed:
- Quarterly, or
- When new observability components are added, or
- After any incident involving the observability infrastructure.
