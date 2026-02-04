# ADR-001: Adopt Unified PLGT Observability Stack

## Status

**Accepted** — 2026-01-10

## Context

The organization requires a comprehensive observability solution that provides the three pillars of observability — **metrics**, **logs**, and **traces** — in a unified, correlated platform. The current state involves fragmented tooling:

- Metrics collected by a legacy Nagios installation with limited retention.
- Logs scattered across individual host files with no centralized aggregation.
- No distributed tracing capability.

Requirements:

1. Unified query interface for metrics, logs, and traces.
2. Correlation between signals (e.g., jump from a metric spike to related logs and traces).
3. Self-hosted deployment to retain data sovereignty and control costs at scale.
4. Open-source and vendor-neutral to avoid lock-in.
5. Horizontal scalability for growing infrastructure.
6. Mature alerting capabilities with flexible routing and silencing.

### Alternatives Evaluated

| Solution                              | Metrics | Logs | Traces | Unified UI | Cost      | Lock-in |
|---------------------------------------|---------|------|--------|------------|-----------|---------|
| **PLGT** (Prometheus+Loki+Grafana+Tempo) | Yes  | Yes  | Yes    | Grafana    | OSS/Free  | None    |
| ELK Stack (Elastic+Logstash+Kibana)   | Partial | Yes  | Partial| Kibana     | OSS/Paid  | Medium  |
| Datadog                               | Yes     | Yes  | Yes    | Datadog    | $$$$      | High    |
| New Relic                             | Yes     | Yes  | Yes    | New Relic  | $$$       | High    |
| Splunk + SignalFx                     | Yes     | Yes  | Yes    | Splunk     | $$$$      | High    |
| InfluxDB + Telegraf + Chronograf      | Yes     | Limited| No   | Chronograf | OSS/Paid  | Medium  |

## Decision

We will adopt the **PLGT stack** — **Prometheus**, **Loki**, **Grafana**, and **Tempo** — as the unified observability platform.

### Component Rationale

**Prometheus** (Metrics):
- Industry-standard for cloud-native metrics collection.
- Pull-based model integrates naturally with Kubernetes service discovery.
- PromQL provides a powerful, expressive query language.
- Mature alerting engine with Alertmanager for routing, grouping, and silencing.
- CNCF graduated project with massive community and ecosystem support.

**Loki** (Logs):
- Designed as "Prometheus, but for logs" — label-based indexing without full-text indexing.
- Dramatically lower storage and operational cost compared to Elasticsearch.
- LogQL query language is syntactically similar to PromQL, reducing learning curve.
- Native Grafana integration for log-to-metric and log-to-trace correlation.
- Promtail agent discovers containers and attaches Kubernetes metadata automatically.

**Grafana** (Visualization):
- Best-in-class dashboarding with native support for Prometheus, Loki, and Tempo datasources.
- Unified Explore view enables seamless correlation between metrics, logs, and traces.
- Robust RBAC, OAuth2/SAML SSO, and provisioning-as-code capabilities.
- Alerting engine can evaluate rules across all datasources from a single pane.

**Tempo** (Traces):
- Purpose-built for high-volume trace storage with minimal indexing overhead.
- Natively supports OpenTelemetry, Jaeger, and Zipkin wire formats.
- Integrates with Grafana for trace-to-log and trace-to-metric navigation.
- Scales horizontally with object storage backends (S3, GCS, Azure Blob).

### Why Not ELK Stack

- Elasticsearch requires significant memory and disk for full-text log indexing, leading to higher operational costs.
- The ELK stack does not provide native metrics collection (requires Metricbeat, which is less capable than Prometheus).
- Elastic's licensing changes introduced uncertainty around open-source usage.
- No native distributed tracing backend (Elastic APM is a separate product).

### Why Not SaaS Solutions (Datadog, New Relic, Splunk)

- Per-host and per-GB pricing models become prohibitively expensive at our scale.
- Data sovereignty requirements mandate on-premises or self-hosted deployment.
- Vendor lock-in makes future migration costly and complex.

## Consequences

### Positive

- **Unified correlation**: Grafana provides seamless navigation between metrics, logs, and traces.
- **Cost-effective**: All components are open-source; storage costs are significantly lower than ELK or SaaS alternatives.
- **Cloud-native**: All components are CNCF ecosystem projects, well-suited for Kubernetes deployments.
- **Consistent query experience**: PromQL and LogQL share similar syntax, reducing the learning curve.
- **Vendor-neutral**: OpenTelemetry compatibility ensures portability of instrumentation.

### Negative

- **Operational overhead**: Four distinct services to operate, upgrade, and monitor (plus supporting agents).
- **Loki limitations**: Loki does not support full-text search; complex log queries may be less efficient than Elasticsearch.
- **Tempo maturity**: Tempo is the youngest component in the stack; some advanced features are still evolving.
- **Training investment**: Team must learn PromQL, LogQL, and TraceQL query languages.

### Risks

- **Grafana licensing**: Grafana Labs' AGPL licensing for Grafana requires careful evaluation for embedded or SaaS use cases.
- **Scaling complexity**: While each component scales independently, coordinating scaling across all four requires robust automation.
- **Single pane of glass dependency**: Grafana becomes a critical path for all observability; its availability must be ensured.

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Loki Documentation](https://grafana.com/docs/loki/)
- [Grafana Documentation](https://grafana.com/docs/grafana/)
- [Grafana Tempo Documentation](https://grafana.com/docs/tempo/)
- [OpenTelemetry Specification](https://opentelemetry.io/docs/)
- [CNCF Landscape — Observability](https://landscape.cncf.io/card-mode?category=observability-and-analysis)
