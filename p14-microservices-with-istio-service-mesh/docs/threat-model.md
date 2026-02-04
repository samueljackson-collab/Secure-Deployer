# Threat Model: Microservices with Istio Service Mesh

## System Description

This threat model covers a microservices architecture deployed on Kubernetes with
Istio service mesh providing traffic management, mutual TLS, and observability.
The system includes an Istio ingress gateway, Envoy sidecar proxies, the Istio
control plane (istiod), and application workloads in multiple versions.

## Assets

| Asset | Sensitivity | Description |
|-------|-------------|-------------|
| Service-to-service traffic | High | Business data and API payloads between microservices |
| Istio control plane (istiod) | Critical | Manages certificates, configuration, and service discovery |
| mTLS certificates | Critical | Workload identity certificates issued by Citadel |
| VirtualService / DestinationRule configs | High | Traffic routing rules that control request flow |
| Envoy sidecar proxies | High | Data plane components intercepting all traffic |
| Application secrets | Critical | Credentials, API keys used by application containers |
| Istio Gateway TLS certificates | High | External-facing TLS certificates for ingress |

## STRIDE Analysis

### 1. Spoofing

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| S-01: Service identity spoofing | An attacker deploys a rogue pod that impersonates a legitimate service to intercept or inject traffic. | Medium | Critical | STRICT mTLS via PeerAuthentication ensures every workload must present a valid SPIFFE identity certificate issued by Citadel. Unauthorized pods cannot obtain valid certificates. |
| S-02: Gateway certificate spoofing | Attacker presents a fraudulent TLS certificate at the ingress to intercept external traffic. | Low | High | Gateway references a Kubernetes TLS secret; certificate provisioning is controlled via RBAC. Use cert-manager with ACME for automated, verified certificate issuance. |
| S-03: Control plane impersonation | Attacker impersonates istiod to push malicious configuration to sidecars. | Low | Critical | istiod communicates with sidecars over mTLS. The control plane identity is bootstrapped during installation and verified by each sidecar. Restrict access to the istio-system namespace with RBAC. |

### 2. Tampering

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| T-01: Man-in-the-middle on service traffic | Attacker intercepts and modifies traffic between services if mTLS is not enforced. | Medium | Critical | STRICT PeerAuthentication rejects any plaintext connection. All traffic is encrypted and integrity-protected via mTLS. PERMISSIVE mode must never be used in production. |
| T-02: VirtualService / DestinationRule tampering | Attacker with cluster access modifies routing rules to redirect traffic to a malicious endpoint. | Medium | High | Apply Kubernetes RBAC to restrict who can modify Istio custom resources. Enable Istio config validation webhooks. Use GitOps (ArgoCD, Flux) for auditable, declarative config management. |
| T-03: Sidecar configuration injection | Attacker modifies the Envoy sidecar configuration to bypass security controls or exfiltrate data. | Low | Critical | Sidecar configs are pushed by istiod, not stored locally. Restrict access to EnvoyFilter resources. Monitor for unexpected EnvoyFilter creation. |

### 3. Repudiation

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| R-01: Unattributed service calls | A compromised service makes unauthorized calls that cannot be traced to the source. | Medium | Medium | Envoy access logs record source and destination SPIFFE identities, timestamps, response codes. Enable mesh-wide access logging. Forward logs to a centralized, tamper-evident SIEM. |
| R-02: Configuration change without audit | An operator modifies Istio resources without an audit trail. | Medium | Medium | Enable Kubernetes audit logging for all Istio CRD modifications. Use GitOps so every change has a commit record. Require PR reviews for configuration changes. |

### 4. Information Disclosure

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| I-01: Plaintext traffic interception | If mTLS is misconfigured or in PERMISSIVE mode, traffic can be sniffed. | Medium | High | Enforce STRICT mTLS. Run periodic compliance checks to verify PeerAuthentication mode. Alert on any PERMISSIVE policy creation. |
| I-02: Envoy admin interface exposure | The Envoy admin port (15000) exposes configuration, stats, and can trigger config dumps. | Medium | Medium | Istio disables admin interface binding to external interfaces by default. Verify no port-forwards or services expose port 15000. Add NetworkPolicy to block external access. |
| I-03: Certificate private key extraction | Attacker with pod access extracts the workload certificate private key from the sidecar. | Low | High | Istio stores certificates in-memory via SDS (Secret Discovery Service), not on disk. Enable Kubernetes Pod Security Standards to restrict container capabilities. Use read-only root filesystems. |

### 5. Denial of Service

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| D-01: Sidecar resource exhaustion | A flood of requests overwhelms the Envoy sidecar, causing the application to become unreachable. | Medium | High | Set resource limits on sidecar containers via Istio sidecar resource annotations. Configure connection pool limits in DestinationRule. Implement rate limiting via EnvoyFilter or Istio WasmPlugin. |
| D-02: Control plane overload | Excessive configuration changes or a large number of services overwhelm istiod. | Low | Critical | Scale istiod horizontally. Set resource requests and limits for the control plane. Use Sidecar resources to limit the scope of configuration pushed to each proxy. |
| D-03: Gateway saturation | External traffic flood overwhelms the Istio ingress gateway. | Medium | High | Place a cloud load balancer or WAF in front of the gateway. Configure HPA for gateway pods. Set connection limits and rate limits on the Gateway resource. |

### 6. Elevation of Privilege

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| E-01: Sidecar container escape | Attacker exploits a vulnerability in the Envoy proxy to escape the sidecar container and access the node. | Low | Critical | Run sidecar containers with minimal capabilities (drop ALL, add NET_ADMIN only as needed). Apply Pod Security Standards (restricted profile). Keep Istio and Envoy updated. Enable seccomp profiles. |
| E-02: Unauthorized service access via missing AuthorizationPolicy | Without explicit authorization policies, any authenticated service can call any other service. | High | High | Deploy deny-by-default AuthorizationPolicy per namespace. Explicitly allow only required service-to-service communication paths. Audit policies regularly. |
| E-03: Namespace breakout via sidecar injection manipulation | Attacker modifies the MutatingWebhookConfiguration to inject a compromised sidecar. | Low | Critical | Protect the istio-system namespace with strict RBAC. Monitor for changes to webhook configurations. Use admission controllers to validate sidecar images. |

## Risk Summary

| Risk Level | Count | Threats |
|------------|-------|---------|
| Critical | 5 | S-01, T-01, T-03, D-02, E-01 |
| High | 6 | S-02, T-02, I-01, D-01, D-03, E-02 |
| Medium | 4 | R-01, R-02, I-02, I-03 |

## Recommended Controls (Priority Order)

1. **Enforce STRICT mTLS** across all namespaces with PeerAuthentication.
2. **Deploy deny-by-default AuthorizationPolicy** for every namespace.
3. **Restrict RBAC** on Istio CRDs and the istio-system namespace.
4. **Enable comprehensive access logging** and forward to centralized SIEM.
5. **Set resource limits** on both sidecar and application containers.
6. **Use GitOps** for all Istio configuration changes.
7. **Monitor** for PERMISSIVE mTLS policies and unexpected EnvoyFilter creation.
8. **Keep Istio updated** to patch Envoy and control plane vulnerabilities.
9. **Enable Pod Security Standards** (restricted profile) for workload namespaces.
10. **Implement rate limiting** at the gateway and per-service level.
