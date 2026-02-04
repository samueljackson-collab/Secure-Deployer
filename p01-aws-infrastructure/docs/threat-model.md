# Threat Model - P01 AWS Infrastructure

This document presents a STRIDE-based threat model for the P01 AWS Infrastructure project. Each component is analyzed against the six STRIDE threat categories to identify potential threats and corresponding mitigations.

## Overview

The system comprises a three-tier architecture deployed in AWS:

```
Internet --> ALB (public subnets) --> App Instances (private subnets) --> RDS PostgreSQL (private subnets)
                                                                          |
                                                              S3 Bucket (encrypted, versioned)
```

**STRIDE Categories:**
- **S**poofing - Impersonating something or someone else
- **T**ampering - Modifying data or code without authorization
- **R**epudiation - Performing actions that cannot be traced
- **I**nformation Disclosure - Exposing data to unauthorized parties
- **D**enial of Service - Making the system unavailable
- **E**levation of Privilege - Gaining unauthorized access levels

---

## VPC and Network Layer

| Threat | STRIDE Category | Impact | Likelihood | Mitigation |
|--------|----------------|--------|------------|------------|
| Unauthorized network access to private subnets from the internet | Spoofing | High | Low | Private subnets have no route to the Internet Gateway. NAT Gateway supports outbound-only connections. Security groups deny all inbound by default. |
| Man-in-the-middle attack on traffic between tiers | Tampering | High | Low | TLS termination at the ALB encrypts client-to-LB traffic. Inter-tier traffic stays within the VPC using private IP addresses. VPC traffic is isolated from other tenants. |
| Undetected lateral movement between subnets after instance compromise | Repudiation | High | Medium | VPC Flow Logs capture all traffic (accepted and rejected) with 60-second aggregation intervals. Logs are sent to CloudWatch for centralized alerting and retention. |
| VPC CIDR information leak through DNS or metadata | Information Disclosure | Medium | Low | DNS hostnames are enabled only for required services (RDS endpoints). Instance metadata service (IMDS) access is restricted to IMDSv2 on ASG instances. |
| Route table manipulation redirecting traffic | Tampering | Critical | Low | Route tables are managed exclusively by Terraform with state locking. IAM policies restrict who can modify route tables. Changes are auditable via CloudTrail. |
| NAT Gateway as single point of failure disrupting outbound connectivity | Denial of Service | Medium | Medium | Single NAT Gateway is a known trade-off for cost optimization. For mission-critical deployments, deploy one NAT Gateway per AZ. Health monitoring via CloudWatch. |

## Application Load Balancer (ALB)

| Threat | STRIDE Category | Impact | Likelihood | Mitigation |
|--------|----------------|--------|------------|------------|
| TLS certificate spoofing or expired certificate allowing MITM attacks | Spoofing | High | Low | ACM-managed certificates with automatic renewal. HTTPS listener configured with modern TLS policy. HTTP-to-HTTPS redirect prevents unencrypted connections. |
| ALB access log tampering to hide attack evidence | Tampering | Medium | Low | Access logs are written to an S3 bucket with versioning enabled. The S3 bucket policy enforces TLS-only access. Bucket-level logging can be enabled for additional audit trails. |
| Unlogged requests bypassing audit trail | Repudiation | Medium | Low | ALB access logging is enabled by default, capturing all request metadata (source IP, path, status code, latency). Logs are stored in S3 with lifecycle policies for retention. |
| TLS termination exposing plaintext traffic within the VPC | Information Disclosure | Medium | Low | Traffic between the ALB and application instances stays within the VPC on private subnets. Security groups restrict access to the application port from the ALB SG only. Consider end-to-end encryption for highly sensitive workloads. |
| Volumetric DDoS attack overwhelming the ALB | Denial of Service | High | Medium | AWS Shield Standard provides automatic protection against common DDoS attacks at no extra cost. Consider AWS Shield Advanced and AWS WAF for application-layer protection. Configure idle timeout and connection limits. |
| Misconfigured listener rules routing traffic to unintended targets | Elevation of Privilege | Medium | Low | Listener rules are defined in Terraform and version-controlled. Target group health checks ensure only healthy instances receive traffic. Infrastructure changes require plan review. |

## Auto Scaling Group (ASG)

| Threat | STRIDE Category | Impact | Likelihood | Mitigation |
|--------|----------------|--------|------------|------------|
| Compromised AMI or launch template deploying malicious instances | Spoofing | Critical | Low | AMI IDs are explicitly specified in variables (not dynamically resolved from untrusted sources). Launch templates are versioned and managed by Terraform. Use CIS-hardened AMIs. |
| User data script injection modifying instance configuration at boot | Tampering | High | Low | User data scripts are defined in Terraform and version-controlled. IMDSv2 is required, preventing SSRF attacks from extracting instance credentials via metadata. |
| Unauthorized scaling events creating excessive instances (cost attack) | Denial of Service | Medium | Low | ASG has a defined maximum size (default: 6). Target tracking scaling policies use conservative thresholds. CloudWatch alarms can alert on unexpected scaling events. Budget alerts recommended. |
| Instance metadata service (IMDS) exploitation for credential theft | Elevation of Privilege | Critical | Medium | IMDSv2 is required on all instances (http_tokens = "required"). This prevents SSRF-based metadata access by requiring session tokens for IMDS requests. |
| Unpatched instances running with known vulnerabilities | Elevation of Privilege | High | Medium | Instance refresh capability allows rolling updates with zero downtime. Configure AWS Systems Manager Patch Manager for automated patching. Regular AMI updates recommended. |
| Untracked actions on instances bypassing audit | Repudiation | Medium | Medium | AWS Systems Manager Session Manager is the recommended access method, providing IAM-based authentication and full CloudTrail audit logging. SSH access is disabled by default. |

## RDS PostgreSQL

| Threat | STRIDE Category | Impact | Likelihood | Mitigation |
|--------|----------------|--------|------------|------------|
| Unauthorized database access using stolen credentials | Spoofing | Critical | Medium | Database credentials are marked as sensitive in Terraform. Security group restricts access to only the application security group on port 5432. RDS is not publicly accessible. Consider AWS Secrets Manager for credential rotation. |
| Data modification or corruption by unauthorized parties | Tampering | Critical | Low | Multi-layered access control: private subnet placement, security group restriction, database-level authentication. Automated backups with 7-day retention enable point-in-time recovery. |
| Database operations performed without audit trail | Repudiation | High | Medium | Enable PostgreSQL logging parameters in the custom parameter group (log_statement, log_connections, log_disconnections). Performance Insights provides query-level visibility. CloudTrail logs RDS API calls. |
| Unencrypted data at rest exposed through storage compromise | Information Disclosure | Critical | Low | Storage encryption is enforced using AWS KMS (storage_encrypted = true). Automated backups and snapshots inherit encryption. Parameter group can enforce SSL connections. |
| Database instance exhaustion through connection flooding | Denial of Service | High | Medium | Security group limits connections to the application tier only. RDS instance class and max_connections parameter should be sized appropriately. Consider RDS Proxy for connection pooling. |
| Exploitation of PostgreSQL vulnerabilities for OS-level access | Elevation of Privilege | Critical | Low | AWS manages the underlying OS and applies security patches. Use a supported PostgreSQL version (15.4) with regular minor version updates. Custom parameter group restricts dangerous extensions. |

## S3 Bucket

| Threat | STRIDE Category | Impact | Likelihood | Mitigation |
|--------|----------------|--------|------------|------------|
| Public access to bucket contents through misconfigured ACLs or policies | Information Disclosure | Critical | Low | All four public access block settings are enabled (block_public_acls, block_public_policy, ignore_public_acls, restrict_public_buckets). Bucket policy enforces TLS-only access. |
| Unauthorized modification or deletion of stored objects | Tampering | High | Low | Versioning is enabled, preserving all object versions. Deletion protection through MFA Delete can be enabled for additional security. Lifecycle rules manage object transitions rather than deletion. |
| ALB log tampering to conceal evidence of attacks | Repudiation | High | Low | S3 versioning preserves all versions of log files. Bucket policy restricts write access. Consider S3 Object Lock in governance or compliance mode for immutable log storage. |
| Data exfiltration through unencrypted object retrieval | Information Disclosure | High | Low | Server-side encryption (AES-256) is applied to all objects by default. Bucket policy denies requests that do not use TLS (aws:SecureTransport condition). |
| Bucket namespace squatting or account-level bucket limit exhaustion | Denial of Service | Low | Low | Bucket names are deterministic and defined in Terraform variables. AWS account-level S3 quotas provide a natural upper bound. |
| IAM policy misconfiguration granting excessive S3 permissions | Elevation of Privilege | High | Medium | Follow the principle of least privilege for IAM policies referencing the bucket ARN. Use resource-based policies in addition to identity-based policies. Regularly audit IAM permissions with Access Analyzer. |

---

## Cross-Cutting Concerns

| Threat | STRIDE Category | Impact | Likelihood | Mitigation |
|--------|----------------|--------|------------|------------|
| Terraform state file exposure revealing secrets and infrastructure details | Information Disclosure | Critical | Medium | Use remote state with S3 backend and encryption enabled. Enable DynamoDB state locking. Restrict access to the state bucket with IAM policies. Never commit state files to version control. |
| Terraform provider compromise injecting malicious resources | Tampering | Critical | Low | Pin provider versions with version constraints (~> 5.0). Use the official HashiCorp provider registry. Verify provider checksums with terraform init. |
| Insufficient tagging preventing cost attribution and ownership tracking | Repudiation | Medium | Medium | Default tags are applied to all resources via the AWS provider configuration (Project, Environment, ManagedBy, Repository). Tags enable cost allocation and compliance reporting. |
| Credential exposure in CI/CD pipelines or version control | Information Disclosure | Critical | Medium | Sensitive variables (db_username) are marked as sensitive in Terraform. terraform.tfvars is gitignored. Use environment variables (TF_VAR_*) or a secrets manager for credentials. |

## Risk Summary

| Risk Level | Count | Action |
|-----------|-------|--------|
| Critical impact, Low likelihood | 7 | Mitigations in place; monitor for changes in threat landscape |
| Critical impact, Medium likelihood | 3 | Priority items; implement additional controls (Secrets Manager, IAM auditing, state encryption) |
| High impact, Medium likelihood | 5 | Active monitoring recommended; review quarterly |
| Medium impact, Medium likelihood | 3 | Acceptable risk with current mitigations |
| Low impact, Low likelihood | 1 | Acceptable risk |

## Review Schedule

This threat model should be reviewed:

- **Quarterly**: As part of regular security review cycles.
- **On architecture changes**: When new modules are added or existing modules are significantly modified.
- **After security incidents**: To incorporate lessons learned and update mitigations.
- **When new AWS services are adopted**: To assess the security implications of service integrations.
