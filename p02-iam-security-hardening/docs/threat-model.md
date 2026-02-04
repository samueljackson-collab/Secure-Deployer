# Threat Model -- IAM Security Hardening

This document applies the **STRIDE** methodology to the IAM resources
provisioned and validated by this project.  The goal is to enumerate threats
against the IAM control plane and to map each threat to the mitigations
provided by our Terraform modules and policy validator.

---

## 1. Scope

| Element | Description |
|---------|-------------|
| **Assets** | AWS IAM policies, IAM roles, trust relationships, and the credentials that exercise them. |
| **Trust Boundary** | The boundary between the CI/CD pipeline (where policies are authored and validated) and the AWS control plane (where they are enforced). |
| **Actors** | Developers, CI systems, AWS services, and potential adversaries with access to the AWS account. |

---

## 2. STRIDE Analysis

### 2.1 Spoofing

| ID | Threat | Likelihood | Impact | Mitigation |
|----|--------|-----------|--------|------------|
| S-1 | An attacker assumes an IAM role by exploiting an overly permissive trust policy (`Principal: "*"`). | Medium | Critical | The `iam-assumable-role` module requires explicit trusted entity ARNs.  The policy validator flags `Principal: "*"` as `OVERLY_PERMISSIVE_PRINCIPAL` (HIGH). |
| S-2 | A compromised CI runner uses stolen temporary credentials to assume production roles. | Medium | High | Roles are scoped with specific trust conditions (e.g., `aws:SourceArn`, `sts:ExternalId`).  Maximum session duration is configurable and defaults to 1 hour. |

### 2.2 Tampering

| ID | Threat | Likelihood | Impact | Mitigation |
|----|--------|-----------|--------|------------|
| T-1 | An insider modifies an IAM policy to grant themselves broader access. | Medium | High | All IAM changes flow through version-controlled Terraform.  Pull requests require review and the policy validator runs as a CI gate. |
| T-2 | An attacker modifies the trust policy of a role to add their own account. | Low | Critical | Trust policies are managed exclusively through the `iam-assumable-role` module; manual console changes are detected by drift detection in CI. |

### 2.3 Repudiation

| ID | Threat | Likelihood | Impact | Mitigation |
|----|--------|-----------|--------|------------|
| R-1 | IAM changes are made without an audit trail, preventing attribution. | Low | Medium | Terraform state and plan output are stored in a versioned S3 backend.  AWS CloudTrail records all IAM API calls independently. |

### 2.4 Information Disclosure

| ID | Threat | Likelihood | Impact | Mitigation |
|----|--------|-----------|--------|------------|
| I-1 | Overly broad `s3:GetObject` or `secretsmanager:GetSecretValue` actions expose confidential data. | Medium | High | The `iam-policy` module requires resource ARNs to be explicitly listed.  The policy validator flags `Resource: "*"` as `WILDCARD_RESOURCE` (HIGH). |
| I-2 | Credential leakage through environment variables or logs. | Medium | Critical | Roles use short-lived STS credentials.  No long-lived access keys are created by these modules. |

### 2.5 Denial of Service

| ID | Threat | Likelihood | Impact | Mitigation |
|----|--------|-----------|--------|------------|
| D-1 | An attacker with `iam:DeleteRole` or `iam:DeletePolicy` permissions removes critical roles, blocking production services. | Low | High | Destructive IAM actions (`iam:Delete*`, `iam:Put*`) are not granted by any module unless explicitly requested.  The policy validator flags wildcard actions as `WILDCARD_ACTION` (HIGH). |

### 2.6 Elevation of Privilege

| ID | Threat | Likelihood | Impact | Mitigation |
|----|--------|-----------|--------|------------|
| E-1 | A user crafts a policy with `Action: "*"` to gain administrator access. | High | Critical | The policy validator rejects wildcard actions (`WILDCARD_ACTION`).  The `iam-policy` module variable `policy_statements` enforces explicit action lists. |
| E-2 | Use of `NotAction` inadvertently grants access to all services except the listed ones, effectively granting near-admin permissions. | Medium | High | The policy validator flags `NotAction` usage as `NOT_ACTION_USAGE` (MEDIUM) and `NotResource` as `NOT_RESOURCE_USAGE` (MEDIUM). |
| E-3 | A role without a permissions boundary is used to create new roles with escalated privileges (`iam:CreateRole`, `iam:AttachRolePolicy`). | Medium | Critical | The `iam-assumable-role` module supports an optional `permissions_boundary` variable.  Organisational SCPs should be layered as an additional guardrail. |
| E-4 | Missing `Condition` blocks on sensitive actions (e.g., `sts:AssumeRole`) allow any caller to invoke them. | Medium | High | The policy validator flags missing conditions on sensitive actions as `MISSING_CONDITION` (MEDIUM).  The module encourages conditions via the `conditions` field. |

---

## 3. Residual Risks

| Risk | Description | Recommended Additional Control |
|------|-------------|-------------------------------|
| Shadow admin paths | Complex permission chains that are not visible in a single policy. | Integrate with AWS IAM Access Analyzer for transitive access analysis. |
| Service-linked roles | AWS-managed roles that fall outside Terraform management. | Monitor with AWS Config rules for unexpected service-linked role creation. |
| Cross-account trust | Trust policies referencing external AWS accounts. | Enforce an allowlist of trusted account IDs at the SCP level. |

---

## 4. Review Cadence

This threat model should be reviewed:

* At least **quarterly**.
* Whenever a new IAM module or validation check is added.
* After any security incident involving IAM.
