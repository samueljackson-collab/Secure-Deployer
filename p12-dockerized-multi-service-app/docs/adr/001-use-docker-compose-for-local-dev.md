# ADR-001: Use Docker Compose for Local Development

## Status

Accepted

## Date

2025-01-15

## Context

Our application consists of five interconnected services: Nginx (reverse proxy), Flask API, Celery worker, Redis (message broker), and PostgreSQL (database). Developers need a consistent, reproducible way to run the entire stack locally that mirrors the production topology as closely as possible.

We evaluated the following options for local development orchestration:

1. **Docker Compose** -- declarative multi-container orchestration designed for local and CI workflows.
2. **Kubernetes with Minikube/Kind** -- production-grade orchestration run locally via lightweight clusters.
3. **Manual processes (install each dependency natively)** -- each developer installs PostgreSQL, Redis, and Python dependencies directly on their host.
4. **Podman Compose** -- rootless alternative compatible with Docker Compose file format.

## Decision

We will use **Docker Compose** (v2, integrated into Docker CLI) as the primary tool for local development and CI environments.

## Rationale

- **Low barrier to entry**: Docker Compose requires only Docker Desktop or Docker Engine. A single `docker compose up` command starts the entire stack.
- **Declarative configuration**: The `docker-compose.yml` file serves as living documentation of the service topology, networking, health checks, and resource constraints.
- **Network isolation**: Compose networks allow us to replicate the production network segmentation (frontend / internal backend) locally.
- **Health check support**: Dependent services only start after their upstream dependencies are healthy, preventing startup race conditions.
- **Industry standard**: Docker Compose is the most widely adopted tool for local multi-service development, ensuring broad community support and documentation.
- **CI compatibility**: The same `docker-compose.yml` can run in CI pipelines (GitHub Actions, GitLab CI) without modification.

### Why not Kubernetes locally?

Kubernetes provides more production fidelity but introduces significant complexity for day-to-day development. The overhead of maintaining Kubernetes manifests, managing Minikube resource allocation, and debugging networking issues outweighs the benefits at our current scale.

### Why not native installation?

Running services natively leads to "works on my machine" problems. Version drift across developer machines, OS-specific configuration differences, and the complexity of managing multiple background services make this approach unreliable.

## Consequences

### Positive

- Developers can spin up the full stack in under 60 seconds with a single command.
- Environment parity between developers is guaranteed by the Compose file.
- Onboarding new team members requires only Docker installation.
- Service dependencies and health checks are explicitly defined and enforced.

### Negative

- Docker Compose does not support advanced orchestration features (rolling updates, auto-scaling, service mesh) available in Kubernetes.
- Developers must have Docker installed, which may conflict with corporate IT policies in some organizations.
- There is a slight divergence from production if production uses Kubernetes, which must be mitigated by integration testing in a staging environment.

### Mitigations

- Production Kubernetes manifests are maintained separately and tested in CI against a Kind cluster.
- A `docker-compose.prod.yml` override file is available for production-like local testing with TLS and stricter resource limits.
