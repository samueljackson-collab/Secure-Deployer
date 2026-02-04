# ADR-002: Declarative Canary Deployments with Istio

## Status

Accepted

## Date

2026-02-04

## Context

We need a reliable, auditable strategy for rolling out new versions of our
microservices with minimal risk. Traditional Kubernetes rolling updates replace
pods incrementally but do not provide fine-grained traffic control, making it
difficult to:

- Route a specific percentage of traffic to the new version.
- Monitor the canary independently before full promotion.
- Perform instant rollback without waiting for pod scheduling.
- Test with real production traffic while limiting blast radius.

We evaluated the following approaches:

### Option A: Istio VirtualService Weighted Routing

- Use separate Kubernetes Deployments for each version (v1, v2).
- Define subsets in a DestinationRule based on version labels.
- Control traffic distribution via VirtualService weight fields.
- Progressive rollout by adjusting weights: 0% -> 10% -> 25% -> 50% -> 100%.
- All configuration is declarative YAML, compatible with GitOps workflows.

### Option B: Flagger Automated Canary

- Flagger automates the canary process using Istio as a traffic provider.
- Defines success criteria (error rate, latency) and auto-promotes or rolls back.
- Reduces manual intervention but adds another component to manage.
- May be adopted later on top of the manual approach.

### Option C: Kubernetes Native Rolling Update

- Built-in to Kubernetes Deployments.
- No traffic percentage control; pods are replaced gradually.
- No ability to route specific percentages of traffic to the new version.
- Rollback requires a new rollout, which is not instantaneous.

### Option D: Blue-Green Deployment

- Run two full environments and switch DNS or load balancer.
- Requires double the resources during deployment.
- Instant switchover but no gradual traffic shifting.
- Less suitable for microservices where individual services are updated frequently.

## Decision

We will use **Istio VirtualService weighted routing** (Option A) for declarative
canary deployments, with the intent to adopt **Flagger** (Option B) in a future
iteration for automation.

## Rationale

1. **Fine-grained traffic control**: VirtualService weights allow precise
   percentage-based traffic splitting (e.g., 90/10), enabling controlled exposure
   of new versions to production traffic.

2. **Instant rollback**: Changing the VirtualService weight back to 100% for v1
   takes effect in seconds, without waiting for pods to terminate or schedule.

3. **GitOps compatibility**: All routing configuration is declarative YAML that
   lives in version control, providing full audit trails and PR-based review for
   every traffic shift.

4. **Independent scaling**: v1 and v2 Deployments scale independently. The canary
   can run with fewer replicas since it only receives a fraction of traffic.

5. **Observable**: Each subset can be monitored independently via Istio telemetry,
   allowing comparison of error rates and latency between v1 and v2.

6. **Foundation for automation**: The manual VirtualService approach establishes
   the patterns and configuration that Flagger will automate later.

## Deployment Procedure

```
Phase 1: Preparation
  - Deploy v2 Deployment with 0 traffic weight
  - Verify v2 pods are healthy (readiness probes pass)

Phase 2: Initial Canary (10%)
  - Update VirtualService: v1=90%, v2=10%
  - Monitor for 15 minutes: error rate < 1%, p99 latency < 500ms

Phase 3: Expanded Canary (50%)
  - Update VirtualService: v1=50%, v2=50%
  - Monitor for 30 minutes with same thresholds

Phase 4: Full Promotion (100%)
  - Update VirtualService: v1=0%, v2=100%
  - Monitor for 15 minutes
  - Remove v1 Deployment

Rollback (any phase):
  - Update VirtualService: v1=100%, v2=0%
  - Delete v2 Deployment
```

## Consequences

### Positive
- Controlled, measurable risk during deployments.
- Full audit trail of every traffic shift in version control.
- Instant rollback capability measured in seconds.
- Team gains experience with Istio traffic management primitives.
- Foundation for future automated canary tooling.

### Negative
- Manual process requires operator intervention for each phase.
- Two Deployments running simultaneously increases resource usage.
- Requires discipline to follow the procedure and monitoring windows.
- Stateful services need additional consideration for version compatibility.

### Risks
- Operators may skip monitoring windows under time pressure; mitigated by
  requiring CI/CD gates that enforce minimum soak time.
- VirtualService misconfiguration could route all traffic to the canary;
  mitigated by PR reviews and automated config validation.

## References

- [Istio Traffic Management](https://istio.io/latest/docs/concepts/traffic-management/)
- [Flagger Documentation](https://docs.flagger.app/)
- [Canary Deployment Best Practices](https://martinfowler.com/bliki/CanaryRelease.html)
