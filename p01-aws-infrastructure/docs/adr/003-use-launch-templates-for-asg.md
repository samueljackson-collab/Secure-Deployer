# ADR-003: Use Launch Templates for ASG

## Status

Accepted

## Date

2025-01-15

## Context

The Auto Scaling Group (ASG) requires a configuration template that defines how new EC2 instances are launched. AWS provides two mechanisms for this:

1. **Launch Configurations** (legacy): The original mechanism for specifying instance configuration. AWS has marked launch configurations as a legacy feature and recommends migration to launch templates.

2. **Launch Templates**: The current-generation mechanism that provides all the capabilities of launch configurations plus additional features.

Both mechanisms define the same core properties: AMI, instance type, key pair, security groups, block device mappings, and user data. The decision concerns which mechanism to adopt for this project.

## Decision

We will use **Launch Templates** instead of Launch Configurations for all ASG instance configurations.

### Feature Comparison

| Feature | Launch Configuration | Launch Template |
|---------|---------------------|-----------------|
| Versioning | Not supported | Supports multiple versions with default/latest tracking |
| Modification after creation | Immutable (must create new) | Create new versions without replacing the resource |
| Mixed instance types | Not supported | Supports mixed instance type policies for cost optimization |
| Spot instance configuration | Limited | Full Spot configuration with max price and allocation strategies |
| Network interface configuration | Basic | Advanced (multiple ENIs, specific subnet placement) |
| IMDSv2 enforcement | Not supported | `metadata_options` block to require IMDSv2 tokens |
| Elastic GPU / Inference | Not supported | Supported |
| Capacity reservations | Not supported | Supported |
| T2/T3 Unlimited | Not supported | Supported via `credit_specification` |
| AWS recommendation | Legacy (not recommended) | Recommended for all new deployments |

### Security-Critical Differentiator: IMDSv2

Launch templates support the `metadata_options` block, which allows us to **require IMDSv2** (Instance Metadata Service Version 2). This is a critical security control:

```hcl
metadata_options {
  http_endpoint               = "enabled"
  http_tokens                 = "required"  # Enforces IMDSv2
  http_put_response_hop_limit = 1
}
```

IMDSv2 requires a session token for all metadata requests, which mitigates:
- **SSRF attacks**: An attacker exploiting an SSRF vulnerability in the application cannot retrieve instance credentials from the metadata service without a valid session token.
- **Credential theft**: The hop limit of 1 prevents metadata requests from being forwarded through proxies or containers.

Launch configurations do not support `metadata_options` and default to IMDSv1, which is vulnerable to SSRF-based credential exfiltration.

## Consequences

### Positive

- **Versioning**: Launch template versions allow safe rollbacks. If a new AMI causes issues, revert the ASG to the previous launch template version without recreating any Terraform resources.
- **IMDSv2 enforcement**: Requiring IMDSv2 significantly reduces the risk of credential theft via SSRF attacks, which have been a common vector in real-world cloud breaches.
- **Mixed instance types**: The ASG can use multiple instance types (e.g., `t3.medium` and `t3a.medium`), improving availability during capacity constraints and enabling cost optimization with Spot instances.
- **Future-proof**: Launch templates receive all new EC2 features. Launch configurations are frozen and will not receive new capabilities.
- **Terraform compatibility**: Launch templates are fully supported by the `aws_launch_template` resource with clean lifecycle management.

### Negative

- **Slightly more complex configuration**: Launch templates have more configuration options, which increases the cognitive load when reviewing the configuration. Mitigation: clear inline comments explain each setting.
- **Version management**: Multiple versions can accumulate over time. Mitigation: use `latest` version tracking in the ASG and periodically clean up unused versions.

### Neutral

- **No cost difference**: Launch templates and launch configurations are both free. Costs are determined by the EC2 instances they launch.
- **Migration path**: AWS provides a straightforward migration path from launch configurations to launch templates, so this decision does not create irreversible lock-in.
