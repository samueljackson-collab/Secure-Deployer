# P04: Zero-Downtime Database Migration

A production-grade, CDC-based database migration toolkit that leverages **Debezium**, **Apache Kafka**, and a custom Python consumer to replicate data from a source PostgreSQL database to a target PostgreSQL database with zero application downtime.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Components](#components)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Safety Procedures](#safety-procedures)
- [Monitoring](#monitoring)
- [Cutover Procedure](#cutover-procedure)
- [Rollback Plan](#rollback-plan)
- [Contributing](#contributing)
- [License](#license)

## Overview

Traditional database migrations require scheduled maintenance windows that result in application downtime. This project implements a **Change Data Capture (CDC)** approach using Debezium to stream row-level changes from a source PostgreSQL database to a target database in real time, enabling migrations with zero downtime.

### Key Features

- **Real-time replication** via Debezium CDC connectors
- **Idempotent consumer** that safely handles duplicate and out-of-order events
- **Schema-aware migration** with automatic DDL propagation
- **Comprehensive error handling** with dead-letter queue support
- **Lag monitoring** to track replication delay before cutover
- **Docker Compose orchestration** for local development and testing

## Architecture

```
+------------------+       +------------+       +-----------+
|  Source PostgreSQL| ----> |  Debezium  | ----> |   Kafka   |
|  (Port 5432)     |  WAL  |  Connect   |  CDC  |  Broker   |
+------------------+       +------------+       +-----------+
                                                      |
                                                      | CDC Events
                                                      v
                                                +-----------+
                                                |  Python   |
                                                |  Consumer |
                                                +-----------+
                                                      |
                                                      | SQL Writes
                                                      v
                                                +------------------+
                                                | Target PostgreSQL|
                                                | (Port 5433)      |
                                                +------------------+
```

1. **Source PostgreSQL** emits WAL (Write-Ahead Log) changes.
2. **Debezium Connect** captures WAL events and publishes them to Kafka topics.
3. **Kafka** acts as a durable, ordered event stream.
4. **Python CDC Consumer** reads events, transforms them, and applies writes to the target database idempotently.

## Components

| Component            | Image / Tool                        | Purpose                          |
|----------------------|-------------------------------------|----------------------------------|
| Source PostgreSQL     | `postgres:16-alpine`                | Origin database                  |
| Target PostgreSQL     | `postgres:16-alpine`                | Destination database             |
| Apache Zookeeper      | `confluentinc/cp-zookeeper:7.6.0`  | Kafka coordination               |
| Apache Kafka          | `confluentinc/cp-kafka:7.6.0`      | Event streaming                  |
| Debezium Connect      | `debezium/connect:2.5`             | CDC connector                    |
| Python CDC Consumer   | Custom (see `consumer.py`)          | Event consumer and writer        |

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Python 3.11+ (for local consumer development)
- `psql` client (optional, for manual verification)

## Quick Start

### 1. Start the Infrastructure

```bash
docker compose up -d
```

This brings up Zookeeper, Kafka, both PostgreSQL instances, and Debezium Connect.

### 2. Initialize the Source Database

The source database is automatically initialized with `init-source.sql` on first boot. To verify:

```bash
docker compose exec source-db psql -U migration -d sourcedb -c "SELECT count(*) FROM users;"
```

### 3. Register the Debezium Connector

```bash
curl -X POST http://localhost:8083/connectors -H "Content-Type: application/json" -d '{
  "name": "source-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "source-db",
    "database.port": "5432",
    "database.user": "migration",
    "database.password": "migration_secret",
    "database.dbname": "sourcedb",
    "topic.prefix": "cdc",
    "schema.include.list": "public",
    "plugin.name": "pgoutput",
    "slot.name": "debezium_slot",
    "publication.name": "dbz_publication",
    "snapshot.mode": "initial"
  }
}'
```

### 4. Start the CDC Consumer

```bash
pip install -r requirements.txt
python consumer.py
```

Or run it via Docker Compose (the consumer service is included).

### 5. Verify Replication

Insert a row in the source and confirm it appears in the target:

```bash
docker compose exec source-db psql -U migration -d sourcedb \
  -c "INSERT INTO users (username, email) VALUES ('testuser', 'test@example.com');"

docker compose exec target-db psql -U migration -d targetdb \
  -c "SELECT * FROM users WHERE username = 'testuser';"
```

## Configuration

The consumer is configured via environment variables:

| Variable                | Default                  | Description                        |
|-------------------------|--------------------------|------------------------------------|
| `KAFKA_BOOTSTRAP`       | `localhost:9092`         | Kafka broker address               |
| `KAFKA_GROUP_ID`        | `cdc-consumer-group`     | Consumer group ID                  |
| `KAFKA_TOPIC_PATTERN`   | `^cdc\\.public\\..*`    | Regex for topics to subscribe to   |
| `TARGET_DB_HOST`        | `localhost`              | Target PostgreSQL host             |
| `TARGET_DB_PORT`        | `5433`                   | Target PostgreSQL port             |
| `TARGET_DB_NAME`        | `targetdb`               | Target database name               |
| `TARGET_DB_USER`        | `migration`              | Target database user               |
| `TARGET_DB_PASSWORD`    | `migration_secret`       | Target database password           |
| `BATCH_SIZE`            | `100`                    | Max events per batch commit        |
| `CONSUMER_POLL_TIMEOUT` | `1.0`                    | Kafka poll timeout in seconds      |

## Safety Procedures

### Pre-Migration Checklist

1. **Backup both databases** before starting any migration.
2. **Validate schema compatibility** between source and target.
3. **Test the migration** in a staging environment first.
4. **Verify Debezium connector health** via the Connect REST API.
5. **Confirm Kafka topic retention** is sufficient for the migration window.

### During Migration

- Monitor consumer lag via Kafka consumer group metrics.
- Watch for errors in the consumer log output.
- Do **not** modify the source schema during initial snapshot.

### Emergency Stop

```bash
# Pause the Debezium connector
curl -X PUT http://localhost:8083/connectors/source-connector/pause

# Stop the consumer gracefully (sends SIGTERM)
docker compose stop cdc-consumer
```

## Monitoring

- **Debezium Connect REST API**: `http://localhost:8083/connectors/source-connector/status`
- **Kafka consumer lag**: Use `kafka-consumer-groups.sh --describe --group cdc-consumer-group`
- **Consumer metrics**: The consumer logs throughput, error counts, and batch statistics to stdout.

## Cutover Procedure

1. Stop all writes to the source database (put application in read-only mode).
2. Wait for consumer lag to reach **zero**.
3. Run a final row-count and checksum comparison between source and target.
4. Update application connection strings to point to the target database.
5. Resume normal operations.
6. Keep the Debezium connector running for 24 hours as a safety net.
7. Decommission the source database after the observation period.

## Rollback Plan

If issues are detected after cutover:

1. Revert application connection strings to the source database.
2. Assess data written to the target during the cutover window.
3. If necessary, replay missed writes from Kafka to the source.

## Contributing

1. Fork the repository.
2. Create a feature branch from `main`.
3. Write tests for any new functionality.
4. Submit a pull request with a clear description of changes.

## License

This project is licensed under the MIT License.
