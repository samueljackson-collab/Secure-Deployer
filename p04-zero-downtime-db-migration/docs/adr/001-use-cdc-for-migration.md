# ADR-001: Use Change Data Capture for Database Migration

## Status

Accepted

## Date

2026-01-10

## Context

We need to migrate our primary PostgreSQL database (v14) to a new PostgreSQL instance (v16) with schema modifications. The application serves production traffic 24/7 and any downtime directly impacts revenue and user experience. Historical approaches at this organization have relied on scheduled maintenance windows of 2-4 hours, which are no longer acceptable given our SLA commitments of 99.95% uptime.

We evaluated the following approaches:

1. **pg_dump / pg_restore**: Simple but requires application downtime proportional to database size (~200 GB, estimated 3-hour window).
2. **Logical Replication (native)**: Built into PostgreSQL but limited to same-schema replication; does not support schema transformations during migration.
3. **AWS DMS (Database Migration Service)**: Managed service but introduces vendor lock-in and lacks fine-grained control over transformation logic.
4. **Change Data Capture (CDC) with Debezium + Kafka**: Captures row-level changes in real time from the PostgreSQL WAL, publishes to Kafka, and a custom consumer applies them to the target. Fully open-source, highly customizable.

## Decision

We will use **Change Data Capture (CDC)** via Debezium and Apache Kafka to perform the database migration.

A custom Python consumer will subscribe to Debezium CDC topics and apply changes to the target database. The consumer will implement idempotent write logic to ensure safe restarts and at-least-once delivery semantics.

## Consequences

### Positive

- **Zero downtime**: The application continues reading and writing to the source database throughout the migration. Cutover is a connection-string swap.
- **Real-time sync**: Changes are replicated within seconds, minimizing the data-loss window during cutover.
- **Transformation support**: The custom consumer can apply schema transformations, data enrichment, or filtering as events are processed.
- **Auditability**: Kafka provides a durable, ordered log of all changes, useful for debugging and compliance.
- **Reusability**: The CDC infrastructure can be repurposed for future event-driven architectures.

### Negative

- **Operational complexity**: Requires managing Kafka, Zookeeper, and Debezium Connect in addition to the databases.
- **Eventual consistency**: There is a replication lag between source writes and target availability. Cutover must wait for lag to reach zero.
- **Resource overhead**: Kafka and Debezium require non-trivial compute and memory resources.
- **Learning curve**: Team members unfamiliar with CDC, Kafka, or Debezium will need onboarding.

### Risks

- **Consumer bugs** could result in data corruption on the target. Mitigated by comprehensive integration testing and checksum validation.
- **Kafka unavailability** would halt replication. Mitigated by running a multi-broker cluster with replication factor 3 in production.
- **WAL disk growth** on the source if the replication slot is not consumed. Mitigated by monitoring slot lag and alerting.

## Alternatives Considered

| Approach              | Downtime | Complexity | Flexibility | Vendor Lock-in |
|-----------------------|----------|------------|-------------|----------------|
| pg_dump / pg_restore  | Hours    | Low        | Low         | None           |
| Logical Replication   | Minutes  | Medium     | Low         | None           |
| AWS DMS               | Minutes  | Medium     | Medium      | High           |
| **CDC (Debezium)**    | **Zero** | **High**   | **High**    | **None**       |

## References

- [Debezium Documentation](https://debezium.io/documentation/)
- [PostgreSQL Logical Decoding](https://www.postgresql.org/docs/current/logicaldecoding.html)
- [Kafka Consumer Group Protocol](https://kafka.apache.org/documentation/#consumerconfigs)
