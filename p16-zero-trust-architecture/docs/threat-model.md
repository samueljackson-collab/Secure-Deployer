# Threat Model: Zero Trust Architecture

## Overview

This document analyzes the threats to our Zero Trust network architecture using the STRIDE methodology. The architecture enforces micro-segmentation, least-privilege access, and continuous verification across all network tiers.

## Assets

| Asset                  | Description                                      | Sensitivity |
|------------------------|--------------------------------------------------|-------------|
| VPC Network            | Core virtual network hosting all workloads       | Critical    |
| Security Groups        | Micro-segmented firewall rules                   | Critical    |
| Network ACLs           | Subnet-level access controls                     | High        |
| VPC Endpoints          | Private connectivity to AWS services             | High        |
| Application Data       | Data processed by app-tier instances             | Critical    |
| Database Layer         | RDS/data-tier instances and stored data          | Critical    |
| Management Plane       | Bastion hosts and administrative access          | Critical    |
| Terraform State        | Infrastructure state containing resource details | High        |

## STRIDE Threat Analysis

### 1. Spoofing -- Identity Spoofing

| ID      | Threat                                                        | Likelihood | Impact   | Risk     |
|---------|---------------------------------------------------------------|------------|----------|----------|
| S-01    | Attacker spoofs a trusted source IP to bypass security groups | Medium     | Critical | High     |
| S-02    | Compromised IAM credentials used to modify network rules      | Medium     | Critical | High     |
| S-03    | Forged request headers to impersonate internal services       | Low        | High     | Medium   |

**Mitigations:**
- Security groups validate traffic based on source security group IDs, not just IP addresses.
- VPC flow logs capture all traffic for forensic analysis.
- IAM policies enforce MFA for all administrative actions.
- AWS CloudTrail logs all API calls that modify security groups or NACLs.

### 2. Tampering -- Policy Bypass

| ID      | Threat                                                        | Likelihood | Impact   | Risk     |
|---------|---------------------------------------------------------------|------------|----------|----------|
| T-01    | Attacker modifies security group rules to open access         | Low        | Critical | High     |
| T-02    | NACL rules tampered with to allow unauthorized traffic        | Low        | Critical | High     |
| T-03    | Route table manipulation to redirect traffic                  | Low        | Critical | High     |

**Mitigations:**
- Terraform state is the source of truth; drift detection identifies unauthorized changes.
- AWS Config rules continuously evaluate security group and NACL compliance.
- SCPs (Service Control Policies) prevent modification of critical network resources outside of CI/CD.
- All infrastructure changes require pull request approval.

### 3. Repudiation

| ID      | Threat                                                        | Likelihood | Impact   | Risk     |
|---------|---------------------------------------------------------------|------------|----------|----------|
| R-01    | Administrator denies making unauthorized security group changes| Low       | Medium   | Low      |
| R-02    | Attacker clears VPC flow logs to hide lateral movement        | Low        | High     | Medium   |

**Mitigations:**
- CloudTrail logs are immutable and stored in a separate audit account.
- VPC flow logs are streamed to a centralized logging account.
- All Terraform applies are logged in CI/CD pipeline with author attribution.

### 4. Information Disclosure -- Lateral Movement

| ID      | Threat                                                        | Likelihood | Impact   | Risk     |
|---------|---------------------------------------------------------------|------------|----------|----------|
| I-01    | Compromised web-tier instance accesses data tier directly     | Medium     | Critical | Critical |
| I-02    | Data exfiltration via unrestricted outbound internet access   | Medium     | Critical | Critical |
| I-03    | DNS exfiltration through VPC DNS resolver                     | Low        | High     | Medium   |

**Mitigations:**
- Micro-segmented security groups prevent web-tier to data-tier communication; traffic must flow through the app tier.
- NACLs provide a second layer of enforcement at the subnet level.
- VPC endpoints eliminate the need for internet access to reach AWS services.
- NAT gateway is the only outbound path, enabling centralized egress monitoring.
- DNS query logging enabled for anomaly detection.

### 5. Denial of Service

| ID      | Threat                                                        | Likelihood | Impact   | Risk     |
|---------|---------------------------------------------------------------|------------|----------|----------|
| D-01    | Volumetric DDoS against public-facing ALB                    | Medium     | High     | High     |
| D-02    | Resource exhaustion of NAT gateway blocking outbound traffic  | Low        | Medium   | Low      |

**Mitigations:**
- AWS Shield Standard provides baseline DDoS protection.
- AWS WAF on ALB filters malicious requests.
- NAT gateway scales automatically; CloudWatch alarms alert on high utilization.

### 6. Elevation of Privilege -- Insider Threat

| ID      | Threat                                                        | Likelihood | Impact   | Risk     |
|---------|---------------------------------------------------------------|------------|----------|----------|
| E-01    | Insider with bastion access pivots to data tier               | Medium     | Critical | Critical |
| E-02    | Compromised CI/CD pipeline deploys permissive security rules  | Low        | Critical | High     |
| E-03    | Developer with Terraform access widens security groups        | Medium     | High     | High     |

**Mitigations:**
- Bastion SG allows SSH from management CIDR only; no path to data tier.
- Management subnet is isolated with its own route table and NACLs.
- CI/CD pipeline includes policy-as-code checks (e.g., OPA/Sentinel) to reject overly permissive rules.
- Terraform plan output is reviewed by a second engineer before apply.
- Principle of least privilege applied to all IAM roles and policies.

## Residual Risks

| Risk                                                    | Residual Level | Acceptance Rationale                              |
|---------------------------------------------------------|----------------|---------------------------------------------------|
| Zero-day exploit in AWS networking layer                | Low            | AWS shared responsibility; mitigated by AWS       |
| Sophisticated attacker with valid IAM credentials       | Medium         | MFA, session policies, and anomaly detection reduce but do not eliminate risk |
| Misconfiguration during Terraform module updates        | Medium         | Automated policy checks and peer review mitigate  |

## Review Schedule

This threat model should be reviewed:
- Quarterly as part of the security review cycle.
- After any significant architecture change.
- Following any security incident involving network access.
