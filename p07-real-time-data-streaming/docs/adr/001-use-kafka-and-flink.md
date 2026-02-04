# ADR-001: Use Apache Kafka and Apache Flink for Real-Time Data Streaming

## Status

**Accepted** — 2026-01-08

## Context

The platform requires a real-time data streaming solution capable of:

- Ingesting high-throughput IoT sensor data (thousands of messages per second per device class).
- Providing durable, replayable event storage with configurable retention.
- Performing stateful stream processing with windowed aggregations (tumbling, sliding, session windows).
- Supporting exactly-once processing semantics end-to-end.
- Scaling horizontally to accommodate growth in device count and data volume.
- Integrating with schema evolution tooling to manage message format changes over time.

The team evaluated the following alternatives:

| Solution                     | Throughput | Stateful Processing | Exactly-Once | Ecosystem Maturity |
|------------------------------|------------|---------------------|--------------|---------------------|
| Apache Kafka + Apache Flink  | Very High  | Native, advanced    | End-to-end   | Excellent           |
| Apache Kafka + Kafka Streams | High       | Native, moderate    | End-to-end   | Good                |
| Apache Pulsar + Flink        | High       | Native, advanced    | End-to-end   | Growing             |
| AWS Kinesis + Lambda         | Moderate   | Limited             | At-least-once| Good (AWS-only)     |
| RabbitMQ + custom processors | Moderate   | Manual              | Complex      | Good                |
| Redis Streams + custom code  | High       | Manual              | At-least-once| Limited             |

## Decision

We will use **Apache Kafka** as the distributed event streaming platform and **Apache Flink** as the stream processing engine.

### Kafka Selection Rationale

1. **Proven at scale**: Kafka handles millions of messages per second in production at organizations of all sizes.
2. **Durable log abstraction**: Partitioned, replicated commit log with configurable retention enables event replay and late-arriving data handling.
3. **Rich ecosystem**: Schema Registry, Kafka Connect, MirrorMaker, and extensive client libraries in every major language.
4. **Operational maturity**: Well-understood operational model, extensive monitoring via JMX metrics, and broad community support.

### Flink Selection Rationale

1. **True stream processing**: Flink processes events as they arrive (not micro-batches), providing lower latency than Spark Structured Streaming.
2. **Advanced windowing**: Native support for tumbling, sliding, session, and custom windows with watermark-based event-time processing.
3. **Exactly-once with Kafka**: Flink's Kafka connector supports end-to-end exactly-once semantics via two-phase commit.
4. **Flink SQL**: Declarative SQL interface for stream processing reduces development complexity and lowers the barrier to entry for data analysts.
5. **Robust state management**: RocksDB state backend with incremental checkpointing supports large state sizes without excessive memory pressure.

### Why Not Kafka Streams

Kafka Streams was considered for its simplicity (embedded library, no separate cluster). However:
- It lacks Flink's advanced windowing and event-time processing capabilities.
- It does not provide a SQL interface for ad-hoc stream analytics.
- Scaling requires rebalancing application instances, which introduces operational complexity at our target scale.

### Why Not AWS Kinesis + Lambda

- Vendor lock-in to AWS; the platform must remain cloud-agnostic.
- Lambda's execution model (invocation-based) is poorly suited for continuous, stateful stream processing.
- At-least-once semantics only; achieving exactly-once requires complex application-level deduplication.

## Consequences

### Positive

- High throughput and low latency for IoT sensor data ingestion and processing.
- Exactly-once processing guarantees simplify application logic and data correctness.
- Flink SQL enables rapid development of new aggregation queries without Java/Scala code.
- Schema Registry enforces backward/forward compatibility, reducing breaking changes.
- Both Kafka and Flink have active open-source communities and commercial support options.

### Negative

- Operational complexity: Running Kafka, Zookeeper (or KRaft), and Flink clusters requires infrastructure expertise.
- Resource requirements: The full stack consumes significant CPU and memory, particularly for Flink state management.
- Learning curve: Flink's watermark and checkpoint semantics require investment in team training.
- Zookeeper dependency: Kafka still relies on Zookeeper in this version (KRaft migration planned for a future iteration).

### Risks

- **Zookeeper removal timeline**: Kafka's KRaft mode is production-ready but not yet adopted here; plan migration in Q3 2026.
- **Flink version upgrades**: State compatibility across Flink versions requires careful savepoint management during upgrades.
- **Schema evolution**: Breaking schema changes require coordinated producer/consumer rollouts; enforce FULL_TRANSITIVE compatibility mode.

## References

- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Apache Flink Documentation](https://nightlies.apache.org/flink/flink-docs-stable/)
- [Confluent Schema Registry](https://docs.confluent.io/platform/current/schema-registry/)
- [Flink Kafka Connector — Exactly-Once](https://nightlies.apache.org/flink/flink-docs-stable/docs/connectors/datastream/kafka/#fault-tolerance)
