# Threat Model: Terraform Multi-Cloud Infrastructure

## Overview

This document applies the **STRIDE** threat modeling framework to the multi-cloud Terraform deployment spanning AWS and Azure. The primary concern is maintaining a consistent security posture across two fundamentally different cloud providers while preventing cross-cloud attack paths.

## Assets

| Asset | Description | Sensitivity |
|---|---|---|
| Compute Instances | EC2 (AWS) and Linux VMs (Azure) running workloads | High |
| Terraform State | Contains resource IDs, IP addresses, and infrastructure topology | Critical |
| SSH Private Keys | Used for instance authentication | Critical |
| Cloud Provider Credentials | AWS IAM keys, Azure service principal secrets | Critical |
| Network Configuration | VPC/VNet CIDR ranges, security group rules, NSG rules | High |
| Encrypted Volumes | EBS volumes (AWS) and managed disks (Azure) | High |
| Cloud API Endpoints | Terraform communicates with AWS and Azure APIs | Medium |

## STRIDE Threat Analysis

### Spoofing

| # | Threat | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| S1 | Attacker spoofs Terraform provider to inject malicious resources | Critical | Low | Pin provider versions with exact hashes in `.terraform.lock.hcl`. Use `required_providers` with version constraints. |
| S2 | Compromised CI/CD runner impersonates legitimate deployer | High | Medium | Use OIDC federation (AWS IAM Identity Provider, Azure Workload Identity) instead of long-lived credentials. Require MFA for manual applies. |
| S3 | DNS spoofing redirects Terraform registry requests | High | Low | Use HTTPS for all registry communication (default). Verify provider checksums. |

### Tampering

| # | Threat | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| T1 | Attacker modifies Terraform state file to alter infrastructure | Critical | Medium | Store state in encrypted remote backends (S3 + DynamoDB for AWS, Azure Blob with encryption). Enable state locking. Restrict backend access with IAM/RBAC. |
| T2 | Malicious modification of Terraform modules in source control | Critical | Medium | Require signed commits. Enforce PR reviews with CODEOWNERS. Use branch protection rules. Pin module versions. |
| T3 | In-transit tampering of cloud API calls | High | Low | All provider communication uses TLS 1.2+. Enforce `aws:SecureTransport` condition in IAM policies. |

### Repudiation

| # | Threat | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | Infrastructure changes made without audit trail | High | Medium | Enable AWS CloudTrail and Azure Activity Log. Store Terraform plan outputs as artifacts in CI/CD. Log all `terraform apply` executions with timestamps and actor identity. |
| R2 | Developer denies making destructive changes | Medium | Medium | Require PR approval for all infrastructure changes. Tag all resources with `managed_by` and `last_modified_by` metadata. |

### Information Disclosure

| # | Threat | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| I1 | Terraform state file exposes sensitive outputs (IPs, resource IDs) | High | Medium | Mark sensitive outputs with `sensitive = true`. Encrypt state at rest. Restrict state access to infrastructure team only. |
| I2 | **Cross-cloud data exfiltration** via misconfigured network peering or egress rules | Critical | Medium | Enforce explicit deny-all egress rules. Do not peer AWS VPC with Azure VNet unless explicitly required. Monitor cross-cloud traffic with VPC Flow Logs and Azure NSG Flow Logs. |
| I3 | AWS EC2 instance metadata (IMDSv1) leaks IAM credentials via SSRF | Critical | High | Enforce IMDSv2 (`http_tokens = "required"`). This is already implemented in the AWS compute module. |
| I4 | SSH key material stored in Terraform state | High | Medium | Use `lifecycle { ignore_changes }` for key resources. Consider external key management (AWS KMS, Azure Key Vault). |

### Denial of Service

| # | Threat | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| D1 | Terraform state lock contention blocks deployments | Medium | Low | Use DynamoDB (AWS) or Azure Blob lease for state locking. Set appropriate lock timeouts. Have break-glass procedure for force-unlocking. |
| D2 | Cloud API rate limiting blocks Terraform operations | Medium | Medium | Use `-parallelism` flag to limit concurrent API calls. Implement retry logic in CI/CD pipelines. |
| D3 | Resource quota exhaustion in one cloud blocks deployment | High | Medium | Monitor quota usage proactively. Request quota increases before deployment. Implement pre-flight checks in CI/CD. |

### Elevation of Privilege

| # | Threat | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| E1 | **Inconsistent security posture** allows lateral movement from weaker cloud to stronger | Critical | Medium | Enforce equivalent security controls across both clouds: encryption, network segmentation, SSH-only access. Audit both clouds with identical compliance checks (e.g., CIS benchmarks). |
| E2 | Overly permissive Terraform execution role grants excessive cloud access | Critical | Medium | Apply least-privilege IAM policies for Terraform roles. Separate plan and apply permissions. Use short-lived credentials via OIDC. |
| E3 | Compromised instance in one cloud pivots to the other via shared secrets | High | Medium | Do not share credentials between clouds. Use cloud-native secret stores (AWS Secrets Manager, Azure Key Vault). Segment workloads by cloud boundary. |

## Cross-Cloud Specific Risks

### Inconsistent Security Posture

The most significant risk in multi-cloud deployments is **configuration drift** between providers. AWS and Azure have different default behaviors:

- AWS security groups are deny-all inbound by default; Azure NSGs may have different defaults depending on creation method.
- AWS EBS encryption is opt-in per volume; Azure managed disk encryption is enabled by default for new disks.
- AWS IMDSv1 is enabled by default (must be disabled); Azure IMDS has no equivalent vulnerability class.

**Mitigation**: This project enforces security parity through module-level controls that explicitly configure encryption, network rules, and access controls on both providers.

### Cross-Cloud Data Exfiltration

If workloads in both clouds process the same data, an attacker who compromises one environment could exfiltrate data through the other cloud's egress path, bypassing monitoring.

**Mitigation**: Deploy network monitoring in both clouds. Do not allow direct network connectivity between clouds unless required. Use data classification labels and DLP policies.

## Residual Risks

| Risk | Residual Level | Rationale |
|---|---|---|
| State file compromise | Low | Encrypted remote backend with restricted access, but state still contains topology. |
| Provider supply chain attack | Low | Mitigated by version pinning and checksum verification, but not eliminated. |
| Cross-cloud configuration drift | Medium | Modules enforce parity at deploy time, but runtime drift is possible without continuous compliance scanning. |
| Credential exposure in CI/CD | Low | OIDC federation recommended, but implementation depends on CI/CD platform configuration. |

## Review Schedule

This threat model should be reviewed:

- Quarterly, or
- When a new cloud provider is added, or
- When the network architecture changes (e.g., cross-cloud peering), or
- After any security incident involving the infrastructure.
