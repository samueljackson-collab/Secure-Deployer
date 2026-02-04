# Threat Model: Zero-Downtime Database Migration

## Overview

This document presents a STRIDE-based threat model for the CDC-driven database migration pipeline. The system involves sensitive data flowing from a source PostgreSQL database through Debezium, Kafka, and a Python consumer into a target PostgreSQL database.

## System Boundary

```
[Source DB] --> [Debezium Connect] --> [Kafka] --> [CDC Consumer] --> [Target DB]
```

All components run within a private network (Docker bridge or Kubernetes namespace). External access is limited to the Debezium Connect REST API and database client connections.

## Assets

| Asset                   | Sensitivity | Description                                      |
|-------------------------|-------------|--------------------------------------------------|
| User PII                | High        | Usernames, emails, personal data in `users` table|
| Order data              | High        | Financial transaction records in `orders` table  |
| Database credentials    | Critical    | Connection strings, passwords                    |
| Kafka messages          | High        | CDC events containing row-level data             |
| Debezium configuration  | Medium      | Connector configs with embedded credentials      |
| WAL stream              | High        | Raw database change stream                       |

## STRIDE Analysis

### 1. Spoofing

| Threat ID | Threat                                          | Likelihood | Impact   | Mitigation                                                              |
|-----------|------------------------------------------------|------------|----------|-------------------------------------------------------------------------|
| S-01      | Unauthorized Kafka producer injects fake CDC events | Medium     | Critical | Enable Kafka ACLs; use SASL/SCRAM authentication for producers/consumers |
| S-02      | Attacker impersonates Debezium Connect REST API  | Low        | High     | Restrict API access to localhost or internal network; enable mutual TLS  |
| S-03      | Rogue consumer reads CDC events                  | Medium     | High     | Enforce Kafka ACLs per consumer group; use TLS client certificates       |

### 2. Tampering

| Threat ID | Threat                                          | Likelihood | Impact   | Mitigation                                                              |
|-----------|------------------------------------------------|------------|----------|-------------------------------------------------------------------------|
| T-01      | Man-in-the-middle modifies CDC events in transit | Low        | Critical | Enable TLS encryption between all Kafka clients and brokers             |
| T-02      | Attacker modifies target DB directly during migration | Low    | Critical | Restrict target DB write access to the consumer service account only    |
| T-03      | Tampering with Debezium connector configuration  | Medium     | High     | Use read-only filesystem for connector configs; audit REST API calls     |
| T-04      | SQL injection via crafted source data            | Low        | Critical | Consumer uses parameterized queries exclusively; no string interpolation|

### 3. Repudiation

| Threat ID | Threat                                          | Likelihood | Impact   | Mitigation                                                              |
|-----------|------------------------------------------------|------------|----------|-------------------------------------------------------------------------|
| R-01      | Unauthorized schema changes to source DB go undetected | Medium | High   | Enable DDL audit logging on source PostgreSQL; alert on schema changes  |
| R-02      | Consumer silently drops events without logging   | Low        | High     | Structured logging for every event; dead-letter queue for failed events |
| R-03      | No audit trail of migration operations           | Medium     | Medium   | Log all connector registration, consumer start/stop, and cutover actions|

### 4. Information Disclosure

| Threat ID | Threat                                          | Likelihood | Impact   | Mitigation                                                              |
|-----------|------------------------------------------------|------------|----------|-------------------------------------------------------------------------|
| I-01      | PII exposed in Kafka topics without encryption   | High       | High     | Enable Kafka topic-level encryption; consider field-level encryption     |
| I-02      | Database credentials in plaintext config files   | High       | Critical | Use Docker secrets or a vault (e.g., HashiCorp Vault); never commit creds|
| I-03      | Kafka topic data accessible after migration completes | Medium  | Medium  | Set topic retention to minimum required; delete topics post-migration   |
| I-04      | Consumer logs contain sensitive row data         | Medium     | High     | Redact PII fields in log output; log only metadata and operation types  |

### 5. Denial of Service

| Threat ID | Threat                                          | Likelihood | Impact   | Mitigation                                                              |
|-----------|------------------------------------------------|------------|----------|-------------------------------------------------------------------------|
| D-01      | Kafka broker overwhelmed by high-volume CDC events | Medium   | High    | Configure Debezium throughput limits; scale Kafka partitions             |
| D-02      | Consumer falls behind, causing unbounded lag     | Medium     | Medium   | Monitor consumer lag; auto-scale consumer instances                     |
| D-03      | Source DB performance degraded by WAL reading    | Low        | High     | Use a dedicated replication slot; monitor source DB performance          |
| D-04      | Zookeeper failure causes Kafka unavailability    | Low        | Critical | Run Zookeeper in a 3-node ensemble; consider KRaft mode                 |

### 6. Elevation of Privilege

| Threat ID | Threat                                          | Likelihood | Impact   | Mitigation                                                              |
|-----------|------------------------------------------------|------------|----------|-------------------------------------------------------------------------|
| E-01      | Debezium Connect REST API used to deploy malicious connectors | Medium | Critical | Restrict Connect REST API access; allowlist connector classes           |
| E-02      | Consumer service account has excessive DB privileges | Medium  | High    | Grant only INSERT/UPDATE/DELETE on target tables; no DDL privileges      |
| E-03      | Container escape from consumer to host           | Low        | Critical | Run containers as non-root; use read-only filesystems; drop capabilities|

## Risk Matrix

| Impact \ Likelihood | Low        | Medium     | High       |
|---------------------|------------|------------|------------|
| **Critical**        | T-01, D-04 | S-01, E-01 | I-02       |
| **High**            | S-02, D-03 | T-03, R-01, D-02, E-02 | I-01, I-04 |
| **Medium**          |            | R-03, I-03 |            |

## Recommended Priority Actions

1. **Immediately**: Move all database credentials to Docker secrets or a vault solution (I-02).
2. **High Priority**: Enable Kafka SASL/SCRAM and TLS for all broker connections (S-01, T-01).
3. **High Priority**: Restrict Debezium Connect REST API to internal-only access (S-02, E-01).
4. **Medium Priority**: Implement PII redaction in consumer logging (I-04).
5. **Medium Priority**: Set up consumer lag monitoring and alerting (D-02).
6. **Ongoing**: Audit and minimize database privileges for all service accounts (E-02).

## Review Schedule

This threat model should be reviewed:

- Before every production migration.
- When any component is upgraded to a new major version.
- Quarterly, or after any security incident.
