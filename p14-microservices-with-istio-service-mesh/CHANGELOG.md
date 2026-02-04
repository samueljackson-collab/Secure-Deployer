# Changelog

All notable changes to P14: Microservices with Istio Service Mesh are documented
in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### Added
- Kubernetes namespace with automatic Istio sidecar injection enabled.
- Deployment manifests for application v1 (stable) and v2 (canary) with resource
  limits, liveness probes, readiness probes, and startup probes.
- Kubernetes Service selecting the application pods across both versions.
- Istio Gateway for external ingress with TLS termination.
- VirtualService with weighted routing (90% v1, 10% v2) for canary deployments.
- DestinationRule with subset definitions for v1 and v2, connection pool settings,
  outlier detection, and mTLS transport policy.
- PeerAuthentication resource enforcing STRICT mTLS across the namespace.
- Combined canary deployment manifest for single-apply rollouts.
- STRIDE threat model covering man-in-the-middle, unauthorized service access,
  and sidecar compromise attack vectors.
- Architecture Decision Record for Istio adoption over alternatives (Linkerd,
  Consul Connect, plain Kubernetes NetworkPolicy).
- Architecture Decision Record for declarative canary deployment strategy.
- Python-based traffic split verification test suite sending 100 requests and
  validating distribution within tolerance.
- Comprehensive README with architecture diagram, deployment instructions, and
  rollback procedures.

## [Unreleased]

### Planned
- Istio AuthorizationPolicy for service-to-service RBAC.
- Rate limiting via EnvoyFilter.
- Integration with external certificate authority.
- Prometheus and Grafana dashboards for canary monitoring.
- Automated canary promotion with Flagger.
