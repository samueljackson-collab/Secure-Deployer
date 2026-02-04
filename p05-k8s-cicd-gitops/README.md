# P05 - Kubernetes CI/CD with GitOps (ArgoCD)

Production-grade GitOps pipeline for Kubernetes deployments using ArgoCD, Helm charts, and GitHub Actions CI/CD.

## Architecture

```
+------------------+       +------------------+       +------------------+
|   Developer      |       |   GitHub Actions  |       |   Container      |
|   Pushes Code    +------>+   CI/CD Pipeline   +------>+   Registry       |
|                  |       |   (lint/test/build)|       |   (ghcr.io)      |
+------------------+       +--------+---------+       +--------+---------+
                                    |                          |
                                    v                          |
                           +------------------+                |
                           |   Config Repo     |                |
                           |   (values.yaml    |                |
                           |    updated tag)   |                |
                           +--------+---------+                |
                                    |                          |
                                    v                          v
                           +------------------+       +------------------+
                           |   ArgoCD          +------>+   Kubernetes     |
                           |   (GitOps         |       |   Cluster        |
                           |    Controller)    |       |                  |
                           +------------------+       +------------------+
```

## GitOps Workflow

1. **Code Change**: Developer pushes application code to the `main` branch.
2. **CI Pipeline**: GitHub Actions runs linting (flake8), tests (pytest), and builds a Docker image.
3. **Image Push**: The tagged image (`sha-<commit>`) is pushed to GitHub Container Registry (ghcr.io).
4. **Manifest Update**: The CI pipeline updates `helm-chart/values.yaml` with the new image tag and commits to the config repository.
5. **ArgoCD Sync**: ArgoCD detects the manifest change and reconciles the desired state with the live cluster.
6. **Deployment**: Kubernetes rolls out the new version with zero downtime using rolling updates.

## Project Structure

```
p05-k8s-cicd-gitops/
+-- README.md
+-- CHANGELOG.md
+-- docs/
|   +-- threat-model.md
|   +-- adr/
|       +-- 001-use-gitops-with-argocd.md
+-- app/
|   +-- main.py
|   +-- requirements.txt
|   +-- Dockerfile
+-- helm-chart/
|   +-- Chart.yaml
|   +-- values.yaml
|   +-- templates/
|       +-- deployment.yaml
|       +-- service.yaml
|       +-- hpa.yaml
|       +-- serviceaccount.yaml
+-- .github/
    +-- workflows/
        +-- ci-cd.yml
```

## Prerequisites

- **Kubernetes cluster** (v1.27+) - EKS, GKE, AKS, or local (kind/minikube)
- **ArgoCD** (v2.9+) installed on the cluster
- **Helm** (v3.13+) for chart templating
- **kubectl** configured with cluster access
- **Docker** (v24+) for local image builds
- **Python 3.12+** for application development
- **GitHub account** with access to GitHub Container Registry

## Quick Start

### 1. Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd

# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### 2. Build and Push the Application Image

```bash
cd app/

# Build the Docker image
docker build -t ghcr.io/<your-org>/gitops-demo:latest .

# Push to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u <your-username> --password-stdin
docker push ghcr.io/<your-org>/gitops-demo:latest
```

### 3. Deploy with Helm (Manual)

```bash
cd helm-chart/

# Install or upgrade the release
helm upgrade --install gitops-demo . \
  --namespace gitops-demo \
  --create-namespace \
  --set image.repository=ghcr.io/<your-org>/gitops-demo \
  --set image.tag=latest
```

### 4. Configure ArgoCD Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: gitops-demo
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/<your-org>/Secure-Deployer.git
    targetRevision: main
    path: p05-k8s-cicd-gitops/helm-chart
    helm:
      valueFiles:
        - values.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: gitops-demo
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

```bash
kubectl apply -f argocd-application.yaml
```

### 5. Verify Deployment

```bash
# Check pods
kubectl get pods -n gitops-demo

# Check service
kubectl get svc -n gitops-demo

# Port-forward to test locally
kubectl port-forward svc/gitops-demo 8080:80 -n gitops-demo

# Test endpoints
curl http://localhost:8080/
curl http://localhost:8080/health
curl http://localhost:8080/ready
```

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) automates the full delivery pipeline:

| Job              | Trigger          | Description                                          |
|------------------|------------------|------------------------------------------------------|
| `lint`           | Push & PR        | Runs flake8 for Python code quality checks           |
| `test`           | Push & PR        | Runs pytest for unit and integration tests           |
| `build-and-push` | Push to main     | Builds Docker image and pushes to ghcr.io            |
| `update-manifests`| Push to main    | Updates Helm values with new image tag, commits back |

### Pipeline Flow

```
push to main
    |
    +---> lint (flake8) ---+
    |                      |
    +---> test (pytest) ---+---> build-and-push ---> update-manifests
                                (docker build)       (update values.yaml)
                                (push to ghcr.io)    (git commit)
```

## Helm Chart Configuration

Key configuration values in `helm-chart/values.yaml`:

| Parameter                     | Default                          | Description                     |
|-------------------------------|----------------------------------|---------------------------------|
| `replicaCount`                | `2`                              | Number of pod replicas          |
| `image.repository`            | `ghcr.io/secure-deployer/gitops-demo` | Container image repository |
| `image.tag`                   | `1.0.0`                          | Container image tag             |
| `service.type`                | `ClusterIP`                      | Kubernetes service type         |
| `service.port`                | `80`                             | Service port                    |
| `autoscaling.enabled`         | `true`                           | Enable HPA                      |
| `autoscaling.minReplicas`     | `2`                              | Minimum replica count           |
| `autoscaling.maxReplicas`     | `10`                             | Maximum replica count           |
| `autoscaling.targetCPUUtilizationPercentage` | `70`            | CPU target for scaling          |

## Security Features

- **Non-root container**: Application runs as `appuser` (UID 1001)
- **Read-only root filesystem**: Prevents runtime file modifications
- **Dropped capabilities**: All Linux capabilities are dropped
- **Pod Security Context**: `runAsNonRoot: true` enforced at pod level
- **Image signing**: Container images tagged with commit SHA for traceability
- **HEALTHCHECK**: Docker HEALTHCHECK instruction for container runtime monitoring
- **Resource limits**: CPU and memory limits enforced to prevent resource exhaustion
- **IRSA-ready ServiceAccount**: Annotations support for IAM Roles for Service Accounts

## Monitoring and Health Checks

The application exposes the following endpoints:

| Endpoint   | Purpose             | Used By                        |
|------------|---------------------|--------------------------------|
| `/health`  | Liveness probe      | Kubernetes liveness check      |
| `/ready`   | Readiness probe     | Kubernetes readiness check     |
| `/`        | Application info    | General application endpoint   |

## Troubleshooting

### ArgoCD Sync Issues

```bash
# Check ArgoCD application status
argocd app get gitops-demo

# Force sync
argocd app sync gitops-demo

# Check sync diff
argocd app diff gitops-demo
```

### Pod Issues

```bash
# Check pod events
kubectl describe pod -l app.kubernetes.io/name=gitops-demo -n gitops-demo

# Check pod logs
kubectl logs -l app.kubernetes.io/name=gitops-demo -n gitops-demo --tail=100
```

### Image Pull Failures

```bash
# Verify image exists
docker pull ghcr.io/<your-org>/gitops-demo:<tag>

# Check imagePullSecrets
kubectl get secrets -n gitops-demo
```

## Related Documentation

- [Threat Model](docs/threat-model.md) - STRIDE analysis of the GitOps pipeline
- [ADR-001: Use GitOps with ArgoCD](docs/adr/001-use-gitops-with-argocd.md) - Architecture decision record

## References

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Helm Documentation](https://helm.sh/docs/)
- [GitOps Principles](https://opengitops.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
