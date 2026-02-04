# P14: Microservices with Istio Service Mesh

## Overview

Production-grade Istio service mesh deployment implementing mutual TLS (mTLS),
fine-grained traffic management, observability, and declarative canary
deployments for a microservices architecture running on Kubernetes.

## Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │              Istio Control Plane            │
                        │  ┌─────────┐ ┌──────────┐ ┌─────────────┐ │
                        │  │  Pilot  │ │  Citadel │ │   Galley    │ │
                        │  │ (istiod)│ │  (certs) │ │  (config)   │ │
                        │  └────┬────┘ └─────┬────┘ └──────┬──────┘ │
                        └───────┼─────────────┼────────────┼─────────┘
                                │             │            │
  ┌──────────────┐    ┌────────┼─────────────┼────────────┼──────────┐
  │   Internet   │    │        │  Data Plane │            │          │
  │              │    │  ┌─────▼─────────────▼────────────▼───────┐  │
  │  ┌────────┐  │    │  │           Istio Gateway               │  │
  │  │ Client │──┼────┼──►  (envoy-based ingress controller)     │  │
  │  └────────┘  │    │  └──────────────────┬────────────────────┘  │
  └──────────────┘    │                     │                       │
                      │         ┌───────────┴────────────┐          │
                      │         │   VirtualService        │          │
                      │         │   (90/10 traffic split) │          │
                      │         └───┬─────────────────┬──┘          │
                      │             │                 │              │
                      │    ┌────────▼──────┐  ┌──────▼────────┐    │
                      │    │  Pod (v1)     │  │  Pod (v2)     │    │
                      │    │ ┌───────────┐ │  │ ┌───────────┐ │    │
                      │    │ │  App v1   │ │  │ │  App v2   │ │    │
                      │    │ │ (stable)  │ │  │ │ (canary)  │ │    │
                      │    │ └───────────┘ │  │ └───────────┘ │    │
                      │    │ ┌───────────┐ │  │ ┌───────────┐ │    │
                      │    │ │  Envoy    │ │  │ │  Envoy    │ │    │
                      │    │ │  Sidecar  │ │  │ │  Sidecar  │ │    │
                      │    │ └───────────┘ │  │ └───────────┘ │    │
                      │    └───────────────┘  └───────────────┘    │
                      │         Namespace: microservices-prod       │
                      │         (istio-injection: enabled)          │
                      └─────────────────────────────────────────────┘
```

## Key Features

### Mutual TLS (mTLS)
- **STRICT mode** PeerAuthentication enforced across the namespace
- All service-to-service communication encrypted with auto-rotated certificates
- Citadel manages certificate issuance and lifecycle
- Zero-trust posture: no plaintext traffic permitted within the mesh

### Traffic Management
- **Weighted routing**: VirtualService with configurable traffic split (default 90/10)
- **Canary deployments**: Gradual rollout of v2 with real-time traffic shifting
- **Destination rules**: Subset definitions with connection pool and outlier detection
- **Gateway**: TLS-terminated ingress with host-based routing

### Observability
- Envoy sidecars emit metrics for all service-to-service calls
- Distributed tracing headers propagated automatically
- Access logging configured at mesh level

### Canary Deployment Strategy
1. Deploy v2 alongside v1 with zero traffic
2. Shift 10% of traffic to v2 via VirtualService update
3. Monitor error rates, latency p99, and success rates
4. Progressively increase to 25%, 50%, 100% or rollback
5. Remove v1 deployment after full promotion

## Repository Structure

```
p14-microservices-with-istio-service-mesh/
├── README.md
├── CHANGELOG.md
├── canary-deployment.yaml
├── docs/
│   ├── threat-model.md
│   └── adr/
│       ├── 001-adopt-istio-service-mesh.md
│       └── 002-declarative-canary-deployments-with-istio.md
├── k8s/
│   ├── namespace.yaml
│   ├── deployment-v1.yaml
│   ├── deployment-v2.yaml
│   └── service.yaml
├── istio/
│   ├── gateway.yaml
│   ├── virtual-service.yaml
│   ├── destination-rule.yaml
│   └── peer-authentication.yaml
└── tests/
    ├── test_traffic_split.py
    └── requirements.txt
```

## Prerequisites

- Kubernetes cluster >= 1.25
- Istio >= 1.20 installed with `istioctl install --set profile=demo`
- `kubectl` configured with cluster access
- Python >= 3.10 for traffic-split tests

## Deployment

### 1. Install Istio

```bash
istioctl install --set profile=production \
  --set meshConfig.accessLogFile=/dev/stdout \
  --set meshConfig.enableAutoMtls=true
```

### 2. Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

### 3. Deploy Application

```bash
kubectl apply -f k8s/deployment-v1.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f istio/destination-rule.yaml
kubectl apply -f istio/peer-authentication.yaml
kubectl apply -f istio/gateway.yaml
kubectl apply -f istio/virtual-service.yaml
```

### 4. Begin Canary Rollout

```bash
kubectl apply -f k8s/deployment-v2.yaml
# Traffic is now split 90/10 based on the VirtualService
```

### 5. Validate Traffic Split

```bash
cd tests
pip install -r requirements.txt
pytest test_traffic_split.py -v
```

### 6. Full Canary Promotion

Edit `istio/virtual-service.yaml` to shift weight to 100% for v2, then:

```bash
kubectl apply -f istio/virtual-service.yaml
kubectl delete -f k8s/deployment-v1.yaml
```

## Rollback

```bash
# Immediate rollback: shift all traffic back to v1
kubectl patch virtualservice microservices-vs -n microservices-prod \
  --type merge -p '{"spec":{"http":[{"route":[{"destination":{"host":"microservices-app","subset":"v1"},"weight":100}]}]}}'

# Remove canary
kubectl delete -f k8s/deployment-v2.yaml
```

## Security Considerations

- mTLS is enforced at the namespace level; plaintext connections are rejected
- Gateway terminates external TLS and re-encrypts to backends via mTLS
- Service-to-service authorization policies should be added for production
- Sidecar resource limits prevent noisy-neighbor issues
- See `docs/threat-model.md` for full STRIDE analysis

## License

MIT
