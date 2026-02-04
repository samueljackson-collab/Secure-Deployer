# Threat Model: Dockerized Multi-Service App

## Overview

This document applies the STRIDE threat modeling framework to the containerized multi-service application. The architecture consists of five Docker services communicating over isolated networks, with Nginx as the sole entry point.

## System Boundaries

- **External boundary**: Nginx on port 80 is the only service exposed to the host network.
- **Frontend network**: Nginx and the Flask API communicate here.
- **Backend network** (internal): API, Celery worker, Redis, and PostgreSQL communicate here with no external access.

## STRIDE Analysis

### Spoofing

| Threat | Description | Severity | Mitigation |
|--------|-------------|----------|------------|
| S-01 | Container image spoofing via compromised registry | High | Pin image digests in production; use only official images from Docker Hub verified publishers. |
| S-02 | Inter-service impersonation on Docker networks | Medium | Use internal networks to limit service visibility; implement mutual TLS between services in production. |
| S-03 | Database credential theft from environment variables | High | Use Docker secrets or external secrets management (Vault) instead of plaintext environment variables in production. |

### Tampering

| Threat | Description | Severity | Mitigation |
|--------|-------------|----------|------------|
| T-01 | Modification of mounted nginx.conf via host filesystem | Medium | Mount configuration files as read-only (`:ro`); use file integrity monitoring. |
| T-02 | Tampering with application code inside running container | Medium | Use read-only root filesystem (`read_only: true`); limit writable paths with tmpfs. |
| T-03 | PostgreSQL data corruption through direct volume access | Medium | Restrict Docker socket access; use volume encryption at rest. |

### Repudiation

| Threat | Description | Severity | Mitigation |
|--------|-------------|----------|------------|
| R-01 | API actions performed without audit trail | Medium | Implement structured logging with request IDs; ship logs to centralized logging (ELK/EFK). |
| R-02 | Container lifecycle events not tracked | Low | Enable Docker daemon audit logging; monitor with container runtime security tools. |

### Information Disclosure

| Threat | Description | Severity | Mitigation |
|--------|-------------|----------|------------|
| I-01 | Network sniffing between containers on shared Docker networks | Medium | Use encrypted overlay networks or mutual TLS; backend network is already marked as internal. |
| I-02 | Sensitive data exposed in container logs | Medium | Sanitize logs; never log credentials, tokens, or PII; use structured logging. |
| I-03 | Database credentials visible via `docker inspect` | High | Use Docker secrets with file-based secret injection instead of environment variables. |
| I-04 | Stack traces or debug info leaked via API error responses | Medium | Disable Flask debug mode in production; return generic error messages. |

### Denial of Service

| Threat | Description | Severity | Mitigation |
|--------|-------------|----------|------------|
| D-01 | Resource exhaustion of host via unbounded container growth | High | Set memory and CPU limits on all containers via `deploy.resources.limits`. |
| D-02 | Redis memory exhaustion from unbounded cache growth | Medium | Configure `maxmemory` and `maxmemory-policy` (already set to `allkeys-lru` with 128MB limit). |
| D-03 | API overwhelmed by excessive requests | Medium | Nginx rate limiting (10r/s) is configured; add per-client rate limiting and connection limits. |
| D-04 | Disk exhaustion from PostgreSQL volume growth | Medium | Monitor disk usage; set `max_wal_size` and configure log rotation. |

### Elevation of Privilege

| Threat | Description | Severity | Mitigation |
|--------|-------------|----------|------------|
| E-01 | Container escape to host via kernel vulnerability | Critical | Keep Docker and host kernel updated; use non-root users inside containers; enable seccomp and AppArmor profiles. |
| E-02 | Privilege escalation via Docker socket exposure | Critical | Never mount `/var/run/docker.sock` into application containers; restrict Docker group membership. |
| E-03 | Escalation via writable `/proc` or `/sys` in container | High | Run containers with `--read-only`; drop all capabilities and add only required ones (`--cap-drop ALL --cap-add NET_BIND_SERVICE`). |
| E-04 | Exploiting SUID binaries inside container images | Medium | Use minimal base images (Alpine); remove unnecessary packages; scan images with Trivy or Grype. |

## Image Vulnerability Management

- Scan all images with `trivy image <image>` before deployment.
- Pin base images to specific digests rather than mutable tags.
- Rebuild images regularly to incorporate security patches.
- Use multi-stage builds to minimize the final image attack surface.

## Recommendations Summary

1. **Immediate**: Set resource limits on all services, not just Nginx.
2. **Short-term**: Replace environment variable credentials with Docker secrets or Vault.
3. **Medium-term**: Implement mutual TLS between services; enable read-only root filesystems.
4. **Long-term**: Deploy container runtime security (Falco) and integrate image scanning into CI/CD.
