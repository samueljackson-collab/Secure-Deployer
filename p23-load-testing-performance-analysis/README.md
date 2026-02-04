# P23: Load Testing & Performance Analysis

Production-grade load testing framework using [k6](https://k6.io/) to validate system reliability, identify bottlenecks, and enforce performance SLAs across all portfolio services.

---

## Table of Contents

- [Overview](#overview)
- [Why k6](#why-k6)
- [Test Scenarios](#test-scenarios)
- [Thresholds & SLAs](#thresholds--slas)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Running Tests](#running-tests)
- [CI Integration](#ci-integration)
- [Results Analysis](#results-analysis)
- [Directory Structure](#directory-structure)
- [Security Considerations](#security-considerations)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

This project provides a comprehensive load testing suite that covers four key test types:

| Test Type | Purpose | VUs | Duration |
|-----------|---------|-----|----------|
| **Smoke** | Verify baseline functionality | 1 | 30 s |
| **Load** | Validate expected traffic | 100 | ~9 min |
| **Stress** | Find breaking point | 500 | ~15 min |
| **Spike** | Verify recovery from burst | 200 | ~6 min |

Each scenario targets realistic API endpoints, includes parameterized data, authentication helpers, and custom metric collection.

## Why k6

k6 was selected after evaluating JMeter, Locust, and Artillery. Key differentiators:

- **JavaScript ES6 scripting** -- low barrier, version-controllable, reviewable in PRs.
- **Single binary** -- no JVM, no Python runtime, trivial CI setup.
- **Built-in metrics pipeline** -- native Prometheus, Datadog, and InfluxDB export.
- **Threshold-based pass/fail** -- automated quality gates without custom scripting.
- **Deterministic load generation** -- constant-arrival-rate executors for accurate saturation testing.

Full rationale in [ADR-001](docs/adr/001-use-k6-for-load-testing.md).

## Test Scenarios

### Smoke Test (`scripts/smoke-test.js`)

Minimal validation that the system is alive and responding within acceptable latency.

- 1 virtual user, 30-second duration.
- Hits `GET /healthz`.
- Threshold: 95th-percentile response time < 500 ms, zero errors.

### Load Test (`scripts/load-test.js`)

Simulates expected production traffic to validate sustained throughput.

- Ramp: 0 -> 100 VUs over 2 minutes, sustain 100 VUs for 5 minutes, ramp down over 2 minutes.
- Exercises `GET /api/users`, `POST /api/orders`, `GET /api/orders/{id}`.
- Custom metrics: `order_creation_duration`, `user_fetch_duration`.
- Thresholds: p95 < 800 ms, error rate < 1%, req_duration median < 400 ms.

### Stress Test (`scripts/stress-test.js`)

Pushes beyond expected capacity to discover the breaking point and observe degradation.

- Staged ramp: 0 -> 100 -> 200 -> 350 -> 500 VUs with plateau periods.
- Monitors error-rate inflection and latency spikes.
- Thresholds relaxed intentionally -- the goal is observational.

### Spike Test (`scripts/spike-test.js`)

Validates that the system recovers gracefully from a sudden traffic burst.

- Baseline 10 VUs -> spike to 200 VUs -> return to 10 VUs.
- Checks that p95 latency returns to pre-spike levels within 60 seconds of ramp-down.

## Thresholds & SLAs

Default thresholds are defined in `scripts/thresholds.json` and can be overridden per environment:

```json
{
  "http_req_duration": ["p(95)<800", "p(99)<1500", "med<400"],
  "http_req_failed": ["rate<0.01"],
  "checks": ["rate>0.99"]
}
```

Mapping to SLA tiers:

| Metric | Target | Critical |
|--------|--------|----------|
| p95 latency | < 800 ms | > 1500 ms |
| Error rate | < 1 % | > 5 % |
| Availability | > 99.9 % | < 99 % |

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [k6](https://k6.io/docs/getting-started/installation/) | >= 0.47 | Load test execution |
| Node.js | >= 18 | Helper scripts (optional) |
| Docker | >= 24 | Containerized runs (optional) |

Install k6:

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Quick Start

```bash
# Clone the repository
git clone https://github.com/<org>/Secure-Deployer.git
cd Secure-Deployer/p23-load-testing-performance-analysis

# Set the target base URL (defaults to http://localhost:3000)
export BASE_URL="https://staging.example.com"
export API_TOKEN="<your-staging-token>"

# Run the smoke test
k6 run scripts/smoke-test.js

# Run the full load test with JSON output
k6 run --out json=results/load-test.json scripts/load-test.js
```

## Running Tests

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Target system base URL |
| `API_TOKEN` | _(none)_ | Bearer token for authenticated endpoints |
| `K6_PROMETHEUS_RW_SERVER_URL` | _(none)_ | Prometheus remote-write URL for metrics export |
| `RESULTS_DIR` | `./results` | Directory for result artifacts |

### Individual Execution

```bash
# Smoke
k6 run scripts/smoke-test.js

# Load
k6 run scripts/load-test.js

# Stress
k6 run scripts/stress-test.js

# Spike
k6 run scripts/spike-test.js
```

### Docker Execution

```bash
docker run --rm -i \
  -e BASE_URL="https://staging.example.com" \
  -e API_TOKEN="${API_TOKEN}" \
  -v "$(pwd)/scripts:/scripts" \
  grafana/k6 run /scripts/load-test.js
```

### Prometheus + Grafana Stack

```bash
# Start the observability stack
docker compose -f docker-compose.observability.yml up -d

# Run with Prometheus remote-write output
k6 run \
  --out experimental-prometheus-rw \
  -e K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  scripts/load-test.js
```

## CI Integration

The GitHub Actions workflow (`.github/workflows/load-test.yml`) provides:

- **PR smoke test** -- every pull request runs the smoke test to catch regressions.
- **Scheduled load test** -- nightly full load test against staging.
- **Manual trigger** -- `workflow_dispatch` with selectable test type and target URL.
- **Artifact upload** -- JSON results and summary are uploaded as workflow artifacts.
- **Threshold enforcement** -- non-zero exit code fails the pipeline when thresholds breach.

## Results Analysis

### k6 Summary Output

k6 provides a built-in end-of-test summary:

```
     data_received..................: 14 MB  26 kB/s
     data_sent......................: 1.2 MB 2.2 kB/s
     http_req_blocked...............: avg=1.2ms  p(95)=3.1ms
     http_req_duration..............: avg=245ms  med=210ms  p(95)=620ms  p(99)=980ms
     http_req_failed................: 0.42%  ✓ 42  ✗ 9958
     http_reqs......................: 10000  18.5/s
     iteration_duration.............: avg=260ms  med=225ms  p(95)=650ms
     vus............................: 100    min=1  max=100
     vus_max........................: 100    min=100 max=100
```

### JSON + Grafana

Export results to JSON and import into Grafana for historical trend analysis:

```bash
k6 run --out json=results/load-test-$(date +%Y%m%d).json scripts/load-test.js
```

### Key Metrics to Monitor

1. **http_req_duration (p95, p99)** -- primary latency indicator.
2. **http_req_failed** -- error rate; any sustained increase signals degradation.
3. **iteration_duration** -- end-to-end scenario time including think time.
4. **vus** -- confirms the executor achieved the desired concurrency.
5. **Custom metrics** -- `order_creation_duration`, `user_fetch_duration` for per-endpoint insight.

## Directory Structure

```
p23-load-testing-performance-analysis/
├── README.md
├── CHANGELOG.md
├── docs/
│   ├── threat-model.md
│   └── adr/
│       └── 001-use-k6-for-load-testing.md
├── scripts/
│   ├── smoke-test.js
│   ├── load-test.js
│   ├── stress-test.js
│   ├── spike-test.js
│   ├── thresholds.json
│   └── helpers/
│       └── utils.js
└── .github/
    └── workflows/
        └── load-test.yml
```

## Security Considerations

- **Never commit API tokens or credentials** -- all secrets are injected via environment variables or CI secrets.
- **Rate-limit awareness** -- tests must only target environments you own or have explicit authorization to test.
- **Accidental DoS risk** -- stress/spike tests can overwhelm staging; always coordinate with the platform team.
- Full threat model in [docs/threat-model.md](docs/threat-model.md).

## Contributing

1. Create a feature branch from `main`.
2. Add or modify test scripts following the existing pattern.
3. Update thresholds in `scripts/thresholds.json` if SLAs change.
4. Ensure the smoke test passes locally before pushing.
5. Open a pull request -- CI will validate automatically.

## License

MIT License. See the repository root [LICENSE](../LICENSE) for details.
