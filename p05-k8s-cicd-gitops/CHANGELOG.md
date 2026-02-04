# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### Added

- Flask application with health, readiness, and info endpoints.
- Multi-stage Dockerfile with non-root user and HEALTHCHECK instruction.
- Helm chart (v1.0.0) with Deployment, Service, HPA, and ServiceAccount templates.
- Pod security context enforcing `runAsNonRoot` and read-only root filesystem.
- HorizontalPodAutoscaler with CPU and memory scaling metrics.
- ServiceAccount with IRSA annotation support.
- GitHub Actions CI/CD workflow with lint, test, build-and-push, and manifest update jobs.
- Docker layer caching and pip dependency caching in CI pipeline.
- GitOps workflow using ArgoCD for declarative Kubernetes deployments.
- STRIDE threat model documenting supply chain and deployment risks.
- Architecture Decision Record (ADR-001) for ArgoCD GitOps adoption.
- Comprehensive README with architecture diagrams and deployment instructions.
