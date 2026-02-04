# Threat Model: GitOps CI/CD Pipeline

## Overview

This document presents a STRIDE threat analysis of the GitOps CI/CD pipeline used in this project. The pipeline spans from developer code commits through GitHub Actions CI, container image builds, and ArgoCD-driven Kubernetes deployments.

## System Boundaries

```
+-----------+     +-----------+     +-----------+     +-----------+     +-----------+
|           |     |           |     |           |     |           |     |           |
| Developer +---->+ GitHub    +---->+ GitHub    +---->+ ArgoCD    +---->+ Kubernetes|
| Workstation|    | Repository|     | Actions CI|     | Controller|     | Cluster   |
|           |     |           |     |           |     |           |     |           |
+-----------+     +-----------+     +-----+-----+     +-----------+     +-----------+
                                         |
                                         v
                                   +-----------+
                                   | Container |
                                   | Registry  |
                                   | (ghcr.io) |
                                   +-----------+
```

## STRIDE Analysis

### 1. Spoofing

| Threat ID | Threat | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|--------|---------------|--------|------------|------------|
| S-1 | Compromised developer credentials | Attacker uses stolen GitHub credentials to push malicious code | Critical | Medium | Enforce MFA on all GitHub accounts; use SSH keys with passphrases; require signed commits (GPG/SSH) |
| S-2 | CI runner impersonation | Attacker deploys a rogue CI runner that intercepts pipeline jobs | High | Low | Use GitHub-hosted runners or self-hosted runners with attestation; pin runner images to digests |
| S-3 | Registry authentication bypass | Attacker pushes a malicious image to the container registry | Critical | Low | Use GITHUB_TOKEN scoped to repository; enable registry access controls; require image signing |

### 2. Tampering

| Threat ID | Threat | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|--------|---------------|--------|------------|------------|
| T-1 | Supply chain attack via dependencies | Malicious package injected into pip dependencies (typosquatting, dependency confusion) | Critical | Medium | Pin all dependency versions in requirements.txt; use hash verification (`--require-hashes`); scan dependencies with tools like Safety or Snyk |
| T-2 | Image tampering in transit or at rest | Attacker modifies container image after build but before deployment | Critical | Low | Sign images with cosign/Sigstore; verify signatures in admission controller (Kyverno/OPA); use image digests instead of mutable tags |
| T-3 | Git history rewrite | Attacker force-pushes to main branch, rewriting deployment manifests | High | Low | Enable branch protection rules; require PR reviews; disable force-push on main; enable commit signing requirements |
| T-4 | Helm values manipulation | Attacker modifies values.yaml to point to a malicious image | Critical | Medium | Require PR approval for manifest changes; use OPA/Kyverno policies to restrict allowed image registries; ArgoCD RBAC to limit who can sync |

### 3. Repudiation

| Threat ID | Threat | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|--------|---------------|--------|------------|------------|
| R-1 | Unsigned commits | Developer denies authoring a malicious commit | Medium | Medium | Require GPG/SSH signed commits via branch protection rules; enable GitHub audit logs |
| R-2 | Missing deployment audit trail | No record of who triggered a deployment or sync | Medium | Medium | Enable ArgoCD audit logging; ship logs to centralized SIEM; use ArgoCD RBAC with SSO integration |
| R-3 | CI pipeline log tampering | Attacker deletes or modifies CI logs to cover tracks | Medium | Low | Ship CI logs to immutable storage (S3 with Object Lock); enable GitHub audit log streaming |

### 4. Information Disclosure

| Threat ID | Threat | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|--------|---------------|--------|------------|------------|
| I-1 | Secrets committed to Git | Database credentials, API keys, or TLS certificates stored in repository | Critical | High | Use external secret managers (AWS Secrets Manager, HashiCorp Vault); use Sealed Secrets or External Secrets Operator; run pre-commit hooks (detect-secrets, gitleaks) |
| I-2 | Secrets exposed in CI logs | Pipeline steps inadvertently print secrets to stdout | High | Medium | Use GitHub Actions secret masking; avoid `echo` of secret variables; review workflow logs regularly |
| I-3 | Container image leaks sensitive data | Build-time secrets (API keys, tokens) baked into image layers | High | Medium | Use multi-stage builds; use Docker BuildKit `--mount=type=secret`; scan images with Trivy for embedded secrets |
| I-4 | ArgoCD dashboard exposed publicly | Unauthenticated access to ArgoCD reveals cluster state and manifests | High | Medium | Restrict ArgoCD ingress to VPN/internal network; enforce SSO authentication; disable anonymous access |

### 5. Denial of Service

| Threat ID | Threat | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|--------|---------------|--------|------------|------------|
| D-1 | Resource exhaustion via deployment | Malicious manifest removes resource limits, consuming all cluster resources | High | Medium | Enforce ResourceQuotas and LimitRanges per namespace; use OPA/Kyverno to require resource limits on all pods |
| D-2 | ArgoCD sync loop | Misconfigured application causes continuous sync attempts, overloading the API server | Medium | Medium | Configure ArgoCD sync retry backoff; set sync windows; monitor ArgoCD metrics for sync anomalies |
| D-3 | CI pipeline abuse | Attacker opens many PRs to consume CI runner minutes and resources | Medium | Medium | Require PR approval before CI runs on forks; set concurrency limits on workflows; use GitHub rate limiting |

### 6. Elevation of Privilege

| Threat ID | Threat | Attack Vector | Impact | Likelihood | Mitigation |
|-----------|--------|---------------|--------|------------|------------|
| E-1 | Container breakout | Application escapes container sandbox to access host or other pods | Critical | Low | Run containers as non-root; drop all Linux capabilities; use read-only root filesystem; enforce Pod Security Standards (restricted) |
| E-2 | Overly permissive RBAC | ServiceAccount has cluster-admin or excessive permissions | Critical | Medium | Apply least-privilege RBAC; use namespace-scoped roles; audit RBAC with tools like rbac-police or KubiScan |
| E-3 | ArgoCD privilege escalation | Attacker compromises ArgoCD to deploy privileged workloads across namespaces | Critical | Low | Restrict ArgoCD project scopes to specific namespaces and resource types; enable ArgoCD RBAC; use AppProject resource whitelists |
| E-4 | CI pipeline token abuse | GITHUB_TOKEN or other CI secrets used to access resources beyond intended scope | High | Medium | Use least-privilege token permissions (`permissions:` block in workflow); prefer short-lived OIDC tokens over long-lived secrets |

## Risk Summary Matrix

| Category               | Critical | High | Medium | Low |
|------------------------|----------|------|--------|-----|
| Spoofing               | 2        | 0    | 0      | 1   |
| Tampering              | 3        | 1    | 0      | 0   |
| Repudiation            | 0        | 0    | 3      | 0   |
| Information Disclosure | 1        | 2    | 0      | 0   |
| Denial of Service      | 0        | 1    | 2      | 0   |
| Elevation of Privilege | 2        | 1    | 0      | 0   |

## Top Priority Mitigations

1. **Pin all dependency versions and verify hashes** -- Addresses T-1 (supply chain attacks).
2. **Never store secrets in Git** -- Addresses I-1; use External Secrets Operator or Sealed Secrets.
3. **Sign and verify container images** -- Addresses T-2; use cosign with Sigstore for keyless signing.
4. **Enforce branch protection with required reviews** -- Addresses T-3, T-4, and R-1.
5. **Run containers as non-root with dropped capabilities** -- Addresses E-1; enforced via Pod Security Standards.
6. **Apply least-privilege RBAC everywhere** -- Addresses E-2, E-3, and E-4.
7. **Require MFA and signed commits for all developers** -- Addresses S-1 and R-1.

## Review Schedule

This threat model should be reviewed:

- Quarterly as part of regular security reviews.
- When new components are added to the pipeline (e.g., new registries, admission controllers).
- After any security incident involving the CI/CD or deployment pipeline.
- When upgrading ArgoCD, Kubernetes, or GitHub Actions runner versions.
