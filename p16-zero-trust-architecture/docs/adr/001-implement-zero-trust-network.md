# ADR-001: Implement Zero Trust Network Architecture

## Status

Accepted

## Date

2025-01-10

## Context

Our current network architecture relies on a traditional perimeter-based security model. Once traffic enters the VPC, there are minimal controls preventing lateral movement between workloads. A single compromised instance in the web tier can potentially reach the database tier directly, access AWS API endpoints over the internet, and exfiltrate data without detection.

Recent security audits and industry trends (NIST SP 800-207, CISA Zero Trust Maturity Model) strongly recommend adopting a Zero Trust approach where no network traffic is implicitly trusted, regardless of origin.

Key forces at play:

- **Regulatory compliance** requires demonstrable network segmentation and least-privilege access controls.
- **Blast radius reduction** is critical -- a compromised component should not grant access to the entire network.
- **Operational overhead** must remain manageable; overly complex network rules are difficult to maintain and audit.
- **AWS service access** currently routes through NAT gateways to the public internet, creating unnecessary exposure.

## Decision

We will implement a Zero Trust network architecture with the following components:

1. **Four-tier VPC design** -- Public, private-app, private-data, and management subnets with separate route tables to eliminate cross-tier routing.

2. **Micro-segmented security groups** -- Each tier has a dedicated security group that only allows traffic from the immediately adjacent upstream tier on specific ports. Default deny is enforced.

3. **Network ACLs as defense in depth** -- Subnet-level NACLs provide a second enforcement layer independent of security groups, protecting against security group misconfiguration.

4. **VPC endpoints for AWS services** -- Gateway endpoints for S3 and DynamoDB, interface endpoints for SSM, CloudWatch, STS, and Secrets Manager. This eliminates internet traversal for AWS API calls.

5. **Terraform modules** -- All components are codified as reusable Terraform modules with strict variable validation and comprehensive outputs for integration.

## Consequences

### Positive

- Lateral movement between tiers is blocked at both the security group and NACL level.
- A compromised web-tier instance cannot reach the database directly.
- AWS API traffic stays on the AWS backbone network, eliminating internet-based data exfiltration vectors.
- Infrastructure is fully codified and auditable through Terraform.
- Compliance requirements for network segmentation are satisfied.

### Negative

- Increased complexity in network configuration requires careful documentation and testing.
- VPC interface endpoints incur additional hourly costs (approximately $7.20/month per endpoint per AZ).
- Debugging connectivity issues between tiers requires understanding the multi-layer security model.
- Changes to allowed traffic patterns require updates to both security groups and NACLs.

### Neutral

- Existing applications may require port and protocol documentation to define their security group rules.
- Team members need training on Zero Trust concepts and the multi-tier architecture.

## Alternatives Considered

### Alternative 1: Enhanced Perimeter Security Only

- **Pros:** Simpler to implement; lower operational overhead; familiar to the team.
- **Cons:** Does not prevent lateral movement; single point of failure at the perimeter; does not satisfy modern compliance frameworks.
- **Reason for rejection:** Fails to address the core requirement of limiting blast radius from a compromised instance.

### Alternative 2: Third-Party Service Mesh (e.g., Consul, Istio)

- **Pros:** Application-layer identity and encryption (mTLS); fine-grained traffic policies; observability.
- **Cons:** Significant operational complexity; requires sidecar proxies on every workload; adds latency; steep learning curve.
- **Reason for rejection:** Overkill for our current infrastructure scale. Network-level Zero Trust provides sufficient segmentation. Service mesh can be layered on later if application-layer controls are needed.

### Alternative 3: AWS Verified Access + PrivateLink Only

- **Pros:** AWS-managed Zero Trust for application access; no custom network rules.
- **Cons:** Only covers application access patterns, not infrastructure-level segmentation; limited to specific use cases; higher cost.
- **Reason for rejection:** Does not provide the comprehensive network segmentation required across all tiers.
