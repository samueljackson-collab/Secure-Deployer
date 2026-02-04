# ADR-001: Use GitOps with ArgoCD for Kubernetes Deployments

## Status

Accepted

## Date

2026-02-04

## Context

Our team deploys containerized applications to Kubernetes clusters across multiple environments (development, staging, production). The current deployment process relies on imperative `kubectl apply` and `helm upgrade` commands run manually or through CI pipeline steps. This approach has introduced several challenges:

- **Drift between desired and actual state**: Manual changes made directly to the cluster (via `kubectl edit` or ad-hoc patches) are not tracked in version control, causing configuration drift that is difficult to detect and reconcile.
- **Lack of audit trail**: There is no single source of truth for what is deployed. Determining who deployed what and when requires correlating CI logs, Slack messages, and cluster inspection.
- **Inconsistent rollback procedures**: Rolling back a failed deployment requires identifying the previous image tag, re-running the CI pipeline, or manually reverting Helm releases -- each method is error-prone under incident pressure.
- **No self-healing**: If a resource is accidentally deleted or modified in the cluster, there is no automated mechanism to restore the desired state.
- **Environment parity**: Promoting changes from staging to production involves manual steps that risk introducing environment-specific misconfigurations.

We evaluated several GitOps tools and approaches to address these challenges.

## Options Considered

### Option A: Continue with Imperative CI-Driven Deployments

Keep the current model where CI pipelines run `helm upgrade` against the cluster.

- **Pros**: Familiar to the team; no new tooling required.
- **Cons**: Does not solve drift, audit trail, or self-healing concerns; tightly couples CI to the cluster.

### Option B: Flux CD

Use Flux v2 as the GitOps operator.

- **Pros**: Lightweight; integrates well with Helm and Kustomize; namespace-scoped multi-tenancy.
- **Cons**: No built-in web UI for visualizing sync state; less mature RBAC and SSO compared to ArgoCD; smaller community ecosystem for plugins.

### Option C: ArgoCD

Use ArgoCD as the GitOps controller.

- **Pros**: Rich web UI and CLI for visualizing application state and sync status; mature RBAC with SSO/OIDC integration; ApplicationSet for multi-cluster and multi-tenant patterns; large community and extensive plugin ecosystem; supports Helm, Kustomize, Jsonnet, and plain YAML.
- **Cons**: Heavier resource footprint than Flux; requires running additional components in the cluster (server, repo-server, application-controller, Redis).

## Decision

We will adopt **ArgoCD** as our GitOps controller for Kubernetes deployments.

Git repositories will serve as the single source of truth for the desired state of all Kubernetes resources. ArgoCD will continuously monitor the Git repository and automatically reconcile the cluster state to match the declared manifests.

Specifically:

1. **Application manifests** (Helm charts) are stored in the same repository under `helm-chart/`.
2. **ArgoCD Application resources** define the mapping between Git source and cluster destination.
3. **Automated sync** with self-heal and prune enabled ensures the cluster converges to the Git-declared state.
4. **CI pipelines** are responsible only for building, testing, and pushing container images, then updating the image tag in the manifest repository. They never interact with the Kubernetes API directly.
5. **Rollbacks** are performed by reverting a Git commit, which ArgoCD automatically detects and syncs.

## Consequences

### Positive

- **Single source of truth**: All deployment state is version-controlled in Git, providing a complete audit trail of every change.
- **Automated drift detection and correction**: ArgoCD continuously reconciles the cluster, eliminating manual drift and unauthorized changes.
- **Simplified rollbacks**: Reverting a deployment is as simple as reverting a Git commit. ArgoCD syncs the previous state automatically.
- **Separation of concerns**: CI pipelines focus on build and test; deployment is handled declaratively by ArgoCD, reducing the blast radius of CI credential compromise.
- **Visibility**: The ArgoCD web UI provides real-time visibility into application health, sync status, and resource topology.
- **Reproducibility**: Any cluster can be rebuilt from Git state, supporting disaster recovery and environment cloning.

### Negative

- **Operational overhead**: ArgoCD introduces additional components that must be monitored, upgraded, and secured (server, repo-server, application-controller, Redis, Dex).
- **Learning curve**: Team members must learn ArgoCD concepts (Applications, Projects, Sync Policies, Hooks) and the GitOps workflow.
- **Secret management complexity**: Secrets cannot be stored in plain text in Git; an external secret management solution (External Secrets Operator, Sealed Secrets, or Vault) must be integrated.
- **Two-repository pattern**: Separating application code from deployment manifests (or using a config branch) adds complexity to the developer workflow.

### Risks

- If ArgoCD becomes unavailable, automated deployments and self-healing stop until the controller is restored. Manual `kubectl` access remains as an escape hatch but breaks the GitOps model.
- Misconfigured sync policies (e.g., auto-prune without proper safeguards) could delete critical resources if manifests are accidentally removed from Git.

## References

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [OpenGitOps Principles](https://opengitops.dev/)
- [CNCF GitOps Working Group](https://github.com/cncf/tag-app-delivery/tree/main/gitops-wg)
- [Flux vs ArgoCD Comparison](https://www.cncf.io/blog/2023/07/27/flux-vs-argo-cd/)
