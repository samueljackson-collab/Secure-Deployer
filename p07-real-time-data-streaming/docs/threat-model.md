# Threat Model: Real-Time Data Streaming Platform

## Overview

This document applies the **STRIDE** threat modeling framework to the real-time data streaming platform composed of Apache Kafka, Apache Flink, Schema Registry, and IoT sensor producers. The scope covers data in transit between components, data at rest in Kafka topics, and administrative access to the streaming infrastructure.

## System Boundaries

```
[IoT Producers] ---> [Kafka Broker] ---> [Flink SQL Engine] ---> [Kafka Sink Topic]
                          |
                   [Schema Registry]
                          |
                   [Zookeeper]
```

### Assets

| Asset                        | Classification | Description                                      |
|------------------------------|----------------|--------------------------------------------------|
| Sensor telemetry data        | Internal       | Temperature, humidity readings from IoT devices  |
| Aggregated analytics         | Internal       | Windowed metrics derived from raw sensor data    |
| Kafka topic configurations   | Confidential   | Topic ACLs, partition assignments, offsets        |
| Schema Registry schemas      | Internal       | Avro/JSON schemas governing message formats      |
| Flink checkpoints            | Internal       | Stateful snapshots for exactly-once processing   |
| Zookeeper metadata           | Confidential   | Cluster coordination state, leader election data |

## STRIDE Analysis

### 1. Spoofing

| Threat ID | Threat                                             | Impact | Likelihood | Mitigation                                                                                   |
|-----------|-----------------------------------------------------|--------|------------|-----------------------------------------------------------------------------------------------|
| S-01      | Unauthorized producer impersonates a legitimate IoT device | High   | Medium     | Enable Kafka SASL/SCRAM or mTLS authentication for all producers. Issue per-device credentials. |
| S-02      | Rogue consumer subscribes to sensitive topics       | Medium | Medium     | Configure Kafka ACLs to restrict topic read access to authorized consumer groups only.         |
| S-03      | Attacker spoofs Schema Registry responses           | High   | Low        | Pin Schema Registry TLS certificate; validate schema IDs on the producer side.                |

### 2. Tampering

| Threat ID | Threat                                               | Impact | Likelihood | Mitigation                                                                                    |
|-----------|-------------------------------------------------------|--------|------------|-----------------------------------------------------------------------------------------------|
| T-01      | Injected or modified sensor data in transit to Kafka  | High   | Medium     | Enable TLS encryption between producers and Kafka. Validate message schemas at ingestion.     |
| T-02      | Tampered Kafka log segments on disk                   | High   | Low        | Enable Kafka log segment checksums. Use encrypted volumes for broker storage.                 |
| T-03      | Modified Flink checkpoint data leading to incorrect state | High | Low      | Store checkpoints on encrypted, access-controlled storage (e.g., S3 with SSE-KMS).           |
| T-04      | Schema Registry schema alteration                     | High   | Low        | Enable Schema Registry authentication. Set compatibility mode to FULL_TRANSITIVE.             |

### 3. Repudiation

| Threat ID | Threat                                              | Impact | Likelihood | Mitigation                                                                                    |
|-----------|------------------------------------------------------|--------|------------|-----------------------------------------------------------------------------------------------|
| R-01      | Producer denies sending malformed or malicious data  | Medium | Medium     | Log all producer connections with client ID, IP, and timestamp. Enable Kafka audit logging.   |
| R-02      | Administrator denies modifying topic configuration   | Medium | Low        | Enable Kafka AdminClient audit trail. Integrate with centralized SIEM.                        |

### 4. Information Disclosure

| Threat ID | Threat                                                | Impact | Likelihood | Mitigation                                                                                   |
|-----------|--------------------------------------------------------|--------|------------|-----------------------------------------------------------------------------------------------|
| I-01      | Plaintext sensor data intercepted on the network       | Medium | Medium     | Enforce TLS for all inter-broker and client-broker communication.                             |
| I-02      | Unauthorized access to Kafka topic data via JMX ports  | Medium | Low        | Bind JMX to localhost only. Require JMX authentication in production.                         |
| I-03      | Flink Web UI exposes job topology and configuration    | Low    | Medium     | Restrict Flink Web UI access via network policy or reverse proxy with authentication.         |
| I-04      | Zookeeper data leakage via unauthenticated four-letter commands | Medium | Medium | Disable four-letter commands or restrict to `srvr` only. Enable Zookeeper SASL.          |

### 5. Denial of Service

| Threat ID | Threat                                                 | Impact | Likelihood | Mitigation                                                                                  |
|-----------|--------------------------------------------------------|--------|------------|----------------------------------------------------------------------------------------------|
| D-01      | Producer flood overwhelms Kafka broker                 | High   | Medium     | Configure Kafka quotas (`producer_byte_rate`). Rate-limit producers at the application layer.|
| D-02      | Unbounded Flink state growth causes OOM                | High   | Medium     | Configure state TTL and idle state retention in Flink. Set memory limits in TaskManager.     |
| D-03      | Topic partition exhaustion by rogue topic creation      | Medium | Low        | Disable auto-topic creation. Restrict `CreateTopics` ACL to admin principals only.           |
| D-04      | Zookeeper session storm from excessive client connections | High | Low       | Limit `maxClientCnxns` in Zookeeper. Use connection pooling in Kafka brokers.                |

### 6. Elevation of Privilege

| Threat ID | Threat                                                  | Impact | Likelihood | Mitigation                                                                                 |
|-----------|---------------------------------------------------------|--------|------------|--------------------------------------------------------------------------------------------|
| E-01      | Compromised producer gains admin access to Kafka         | Critical | Low     | Apply principle of least privilege via Kafka ACLs. Separate admin and producer credentials. |
| E-02      | Container escape from Flink TaskManager                  | Critical | Low     | Run containers as non-root. Apply seccomp and AppArmor profiles. Use read-only root FS.    |
| E-03      | Zookeeper admin access via exposed client port           | High   | Low        | Network-isolate Zookeeper. Only allow Kafka broker IPs in firewall rules.                  |

## Risk Summary Matrix

| Risk Level | Count | Action Required                        |
|------------|-------|----------------------------------------|
| Critical   | 2     | Immediate remediation before production |
| High       | 8     | Remediate within current sprint         |
| Medium     | 8     | Schedule for next sprint                |
| Low        | 2     | Accept with monitoring                  |

## Recommendations

1. **Enable TLS everywhere**: All Kafka listeners, inter-broker communication, and Zookeeper connections must use TLS with valid certificates.
2. **Implement SASL authentication**: Use SCRAM-SHA-512 or mTLS for producer and consumer authentication.
3. **Apply Kafka ACLs**: Define explicit allow-list ACLs for each principal (producer, consumer, Flink connector, admin).
4. **Harden container runtime**: Non-root users, read-only filesystems, dropped capabilities, resource limits.
5. **Centralized audit logging**: Ship Kafka audit logs and Zookeeper access logs to a SIEM platform.
6. **Schema validation enforcement**: Set Schema Registry to FULL_TRANSITIVE compatibility and reject unregistered schemas.

## Review Schedule

This threat model must be reviewed:
- Quarterly, or
- When new components are added to the streaming pipeline, or
- After any security incident involving the streaming infrastructure.
