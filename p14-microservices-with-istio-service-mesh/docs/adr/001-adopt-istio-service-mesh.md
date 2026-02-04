# ADR-001: Adopt Istio Service Mesh

## Status

Accepted

## Date

2026-02-04

## Context

Our microservices architecture has grown to a point where cross-cutting concerns
such as mutual TLS, traffic management, observability, and resilience patterns
are being implemented inconsistently across services. Each team is rolling their
own retry logic, circuit breakers, and TLS configuration, leading to:

- **Inconsistent security posture**: Some services communicate over plaintext
  within the cluster, while others use application-level TLS with varying
  certificate management approaches.
- **Difficult canary deployments**: Traffic shifting requires custom load balancer
  configurations and is error-prone.
- **Limited observability**: No unified view of service-to-service communication
  patterns, latency, or error rates.
- **Code duplication**: Retry, timeout, and circuit breaker logic duplicated
  across services in different languages.

We evaluated the following options:

### Option A: Istio Service Mesh

- Most feature-rich service mesh with mature traffic management, security, and
  observability capabilities.
- Large community and extensive documentation.
- Envoy-based data plane with proven performance at scale.
- Supports STRICT mTLS, fine-grained AuthorizationPolicy, and declarative
  traffic routing.
- Higher resource overhead due to sidecar proxies.
- Steeper learning curve.

### Option B: Linkerd

- Lightweight service mesh with lower resource footprint.
- Simpler operational model.
- Rust-based micro-proxy (linkerd2-proxy) with excellent performance.
- Fewer traffic management features compared to Istio (limited traffic splitting,
  no request-level routing).
- Smaller ecosystem of integrations.

### Option C: Consul Connect

- Service mesh integrated with HashiCorp Consul for service discovery.
- Supports both Kubernetes and non-Kubernetes workloads.
- Good integration with HashiCorp ecosystem (Vault, Terraform, Nomad).
- Less mature traffic management compared to Istio.
- Requires Consul cluster management overhead.

### Option D: Plain Kubernetes NetworkPolicy + Application-Level TLS

- No additional infrastructure required.
- NetworkPolicy provides L3/L4 segmentation only.
- Requires each service team to implement TLS, retries, circuit breakers.
- No unified observability or traffic management.
- Does not scale operationally as the service count grows.

## Decision

We will adopt **Istio** as our service mesh platform.

## Rationale

1. **Security**: Istio's STRICT mTLS with automatic certificate rotation provides
   zero-trust networking without application code changes. PeerAuthentication and
   AuthorizationPolicy give us declarative, auditable security controls.

2. **Traffic management**: VirtualService and DestinationRule resources provide
   the fine-grained traffic routing needed for canary deployments, A/B testing,
   and fault injection -- all critical for our deployment strategy.

3. **Observability**: Envoy sidecars automatically generate metrics, traces, and
   access logs for every service-to-service call, providing a unified view
   without instrumenting each service.

4. **Ecosystem maturity**: Istio has the largest community, most integrations
   (Prometheus, Grafana, Jaeger, Kiali), and is a CNCF graduated project.

5. **Multi-version support**: Istio's subset-based routing is essential for our
   canary deployment strategy, allowing percentage-based traffic splitting
   between application versions.

The higher resource overhead is acceptable given our cluster capacity and the
operational benefits. The learning curve is mitigated by investing in team
training and maintaining comprehensive documentation.

## Consequences

### Positive
- Uniform mTLS across all services without application changes.
- Declarative canary deployments via VirtualService weight adjustments.
- Centralized observability for all service-to-service communication.
- Consistent resilience patterns (retries, timeouts, circuit breakers) across
  the fleet.

### Negative
- Increased resource consumption (~100-150 MB per sidecar proxy).
- Additional operational complexity managing the Istio control plane.
- Debugging becomes more complex with the additional network hop through sidecars.
- Team must learn Istio-specific configuration model and troubleshooting.

### Risks
- Istio version upgrades can introduce breaking changes; mitigated by following
  the canary upgrade strategy for the control plane itself.
- Envoy vulnerabilities require prompt patching of the entire mesh.

## References

- [Istio Documentation](https://istio.io/latest/docs/)
- [CNCF Service Mesh Comparison](https://www.cncf.io/blog/)
- [Envoy Proxy Architecture](https://www.envoyproxy.io/docs/envoy/latest/)
