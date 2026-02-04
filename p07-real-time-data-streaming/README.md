# P07: Real-Time Data Streaming

Production-grade real-time data streaming platform built on **Apache Kafka** and **Apache Flink**, designed for high-throughput IoT sensor ingestion, windowed aggregation, and downstream analytics.

## Architecture Overview

```
IoT Devices
    |
    v
+-------------------+       +--------------------+       +-------------------+
|  Kafka Producer   | ----> |   Kafka Broker     | ----> |   Flink SQL Job   |
| (Python, async)   |       |  (topic: sensors)  |       | (tumbling window) |
+-------------------+       +--------------------+       +-------------------+
                                    |                             |
                            +-------+-------+             +-------+-------+
                            | Schema        |             | Kafka Sink    |
                            | Registry      |             | (topic:       |
                            | (Avro/JSON)   |             |  aggregated)  |
                            +---------------+             +---------------+
```

### Components

| Component        | Technology           | Purpose                                      |
|------------------|----------------------|----------------------------------------------|
| Message Broker   | Apache Kafka 3.6     | Durable, partitioned event log               |
| Coordination     | Apache Zookeeper 3.9 | Kafka cluster metadata and leader election    |
| Stream Processor | Apache Flink 1.18    | Stateful stream processing with SQL interface |
| Schema Registry  | Confluent SR 7.5     | Schema evolution and compatibility enforcement|
| Producer         | Python + kafka-python | Simulated IoT sensor data generation         |

## Prerequisites

- Docker Engine >= 24.0
- Docker Compose >= 2.20
- Python >= 3.10 (for local producer development)
- 8 GB RAM minimum (recommended 16 GB for full stack)

## Quick Start

### 1. Launch the Infrastructure

```bash
docker-compose up -d
```

Verify all services are healthy:

```bash
docker-compose ps
```

Expected services:
- `zookeeper` on port **2181**
- `kafka` on port **9092** (external), **29092** (internal)
- `schema-registry` on port **8081**
- `flink-jobmanager` on port **8082** (Web UI)
- `flink-taskmanager` (no exposed port, communicates internally)

### 2. Create Kafka Topics

```bash
docker exec -it kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --topic sensors \
  --partitions 6 \
  --replication-factor 1

docker exec -it kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --topic aggregated \
  --partitions 3 \
  --replication-factor 1
```

### 3. Submit the Flink SQL Job

Open the Flink SQL Client:

```bash
docker exec -it flink-jobmanager ./bin/sql-client.sh
```

Paste the contents of `flink-job/job.sql` into the SQL client to register source and sink tables and start the continuous aggregation query.

### 4. Start the Producer

```bash
cd producer
pip install -r requirements.txt
python producer.py --rate 10 --devices 50
```

This generates 10 messages per second across 50 simulated IoT devices.

### 5. Verify Output

Consume from the aggregated topic:

```bash
docker exec -it kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic aggregated \
  --from-beginning
```

## Producer Configuration

| Argument         | Default       | Description                              |
|------------------|---------------|------------------------------------------|
| `--bootstrap`    | `localhost:9092` | Kafka bootstrap server address        |
| `--topic`        | `sensors`     | Target Kafka topic                       |
| `--rate`         | `5`           | Messages per second                      |
| `--devices`      | `10`          | Number of simulated IoT devices          |
| `--temp-min`     | `15.0`        | Minimum temperature (Celsius)            |
| `--temp-max`     | `45.0`        | Maximum temperature (Celsius)            |
| `--humidity-min` | `20.0`        | Minimum humidity (%)                     |
| `--humidity-max` | `90.0`        | Maximum humidity (%)                     |
| `--log-level`    | `INFO`        | Logging verbosity                        |

## Flink SQL Aggregation

The Flink job performs a **1-minute tumbling window** aggregation:

- Groups events by `device_id`
- Computes average temperature, average humidity, min/max temperature
- Emits one aggregated record per device per window to the `aggregated` topic

## Monitoring

- **Flink Web UI**: [http://localhost:8082](http://localhost:8082) — job status, checkpoints, backpressure
- **Kafka topics**: Use `kafka-topics.sh --describe` to inspect partition health
- **Consumer lag**: `kafka-consumer-groups.sh --describe --group <group-id>`

## Tear Down

```bash
docker-compose down -v
```

The `-v` flag removes named volumes (Kafka data, Zookeeper data, Flink checkpoints).

## Project Structure

```
p07-real-time-data-streaming/
├── README.md
├── CHANGELOG.md
├── docker-compose.yml
├── docs/
│   ├── threat-model.md
│   └── adr/
│       └── 001-use-kafka-and-flink.md
├── producer/
│   ├── producer.py
│   └── requirements.txt
└── flink-job/
    └── job.sql
```

## License

This project is provided under the MIT License. See the repository root for details.
