# P08: Advanced Observability Stack

Production-grade unified observability platform built on the **PLGT stack** — Prometheus, Loki, Grafana, and Tempo — providing metrics, logs, and traces in a single, correlated view.

## Architecture Overview

```
+-----------------+      +-----------------+      +-----------------+
|  Applications   |      |  Infrastructure |      |  Containers     |
|  (instrumented) |      |  (Node Exporter)|      |  (Docker/K8s)   |
+--------+--------+      +--------+--------+      +--------+--------+
         |                         |                         |
         v                         v                         v
+--------+-------------------------+-------------------------+--------+
|                                                                      |
|    +-------------+    +-----------+    +-----------+                  |
|    | Prometheus  |    |   Loki    |    |   Tempo   |                  |
|    | (Metrics)   |    |  (Logs)   |    |  (Traces) |                  |
|    +------+------+    +-----+-----+    +-----+-----+                  |
|           |                 |                |                        |
|           +--------+--------+--------+-------+                        |
|                    |                                                  |
|              +-----+------+                                          |
|              |  Grafana   |                                          |
|              | (Dashboards|                                          |
|              |  & Alerts) |                                          |
|              +------------+                                          |
|                                                                      |
+----------------------------------------------------------------------+
                       Observability Network
```

### Components

| Component      | Version | Purpose                                           | Port  |
|----------------|---------|---------------------------------------------------|-------|
| Prometheus     | 2.50    | Time-series metrics collection and alerting engine | 9090  |
| Loki           | 2.9     | Log aggregation with label-based indexing          | 3100  |
| Grafana        | 10.3    | Unified dashboarding, exploration, and alerting    | 3000  |
| Tempo          | 2.3     | Distributed tracing backend (OpenTelemetry native) | 3200  |
| Node Exporter  | 1.7     | Host-level hardware and OS metrics                 | 9100  |
| Promtail       | 2.9     | Log shipping agent (ships to Loki)                 | 9080  |

## Prerequisites

- Docker Engine >= 24.0
- Docker Compose >= 2.20
- 4 GB RAM minimum (8 GB recommended for production workloads)

## Quick Start

### 1. Launch the Stack

```bash
docker-compose up -d
```

### 2. Verify Services

```bash
docker-compose ps
```

All services should report `healthy` or `running`.

### 3. Access Grafana

Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Username**: `admin`
- **Password**: `admin` (you will be prompted to change this on first login)

Datasources (Prometheus, Loki, Tempo) are automatically provisioned via `grafana-datasources.yml`.

### 4. Explore Metrics

Navigate to **Explore** in Grafana, select the **Prometheus** datasource, and run:

```promql
up
```

This returns the health status of all scraped targets.

### 5. Explore Logs

Select the **Loki** datasource and run:

```logql
{job="varlogs"}
```

### 6. Explore Traces

Select the **Tempo** datasource. If your applications are instrumented with OpenTelemetry, traces will appear here automatically.

## Alerting

Prometheus alerting rules are defined in `alerting/alert-rules.yml`. The following alerts are preconfigured:

| Alert Name      | Condition                               | Severity | For    |
|-----------------|-----------------------------------------|----------|--------|
| HighCPU         | CPU usage > 80% for 5 minutes          | warning  | 5m     |
| HighMemory      | Memory usage > 85% for 5 minutes       | warning  | 5m     |
| InstanceDown    | Target unreachable for 2 minutes        | critical | 2m     |
| DiskSpaceLow    | Filesystem free < 15% for 10 minutes   | critical | 10m    |

To add custom alerts, edit `alerting/alert-rules.yml` and reload Prometheus:

```bash
curl -X POST http://localhost:9090/-/reload
```

## Configuration Files

| File                       | Purpose                                          |
|----------------------------|--------------------------------------------------|
| `docker-compose.yml`       | Service definitions and networking                |
| `prometheus.yml`           | Prometheus scrape configuration and global settings|
| `grafana-datasources.yml`  | Grafana datasource provisioning                   |
| `alerting/alert-rules.yml` | Prometheus alerting rules                         |
| `loki-config.yml`          | Loki storage, retention, and limits configuration |

## Retention and Storage

| Component  | Retention | Storage Backend   |
|------------|-----------|-------------------|
| Prometheus | 15 days   | Local TSDB        |
| Loki       | 7 days    | Local filesystem  |
| Tempo      | 3 days    | Local filesystem  |

Adjust retention periods in the respective configuration files for production requirements.

## Tear Down

```bash
docker-compose down -v
```

## Project Structure

```
p08-advanced-observability-stack/
├── README.md
├── CHANGELOG.md
├── docker-compose.yml
├── prometheus.yml
├── grafana-datasources.yml
├── loki-config.yml
├── alerting/
│   └── alert-rules.yml
└── docs/
    ├── threat-model.md
    └── adr/
        └── 001-adopt-unified-plgt-stack.md
```

## License

This project is provided under the MIT License. See the repository root for details.
