# ADR-001: Use Terraform for IAM Management

## Status

Accepted

## Date

2026-01-06

## Context

The organisation needs a repeatable, auditable, and version-controlled
mechanism for provisioning and managing AWS IAM policies and roles.  Manual
creation through the AWS Console introduces the following problems:

* **Drift** -- resources diverge from their intended configuration over time.
* **Lack of auditability** -- there is no reliable history of who changed what.
* **Error-prone** -- complex JSON policy documents are easy to misconfigure by
  hand.
* **No peer review** -- changes bypass the pull-request workflow.

We evaluated three options:

1. **AWS CloudFormation** -- native AWS IaC but limited multi-cloud support,
   verbose syntax, and slower iteration cycles.
2. **Terraform (HashiCorp)** -- mature, cloud-agnostic IaC tool with a large
   provider ecosystem, HCL syntax, and a strong module system.
3. **Pulumi** -- general-purpose languages for IaC; powerful but introduces a
   heavier SDK dependency and a steeper learning curve for the current team.

## Decision

We will use **Terraform** to manage all IAM resources.

## Rationale

* **Declarative HCL** is well-suited to expressing IAM policy structures and
  is easier to review in pull requests than raw JSON or YAML.
* **Module system** allows us to encapsulate IAM best practices (e.g.,
  least-privilege defaults, mandatory tagging) and reuse them across teams.
* **Plan-before-apply** workflow gives reviewers a clear picture of intended
  changes.
* **State management** (remote backend in S3 + DynamoDB locking) provides a
  single source of truth and prevents concurrent modification.
* **Ecosystem** -- extensive community modules, CI/CD integrations, and
  documentation.
* The team already has Terraform experience, reducing adoption friction.

## Consequences

### Positive

* IAM changes are version-controlled, peer-reviewed, and reproducible.
* Drift is detectable via `terraform plan` in CI.
* Modules enforce organisational guardrails by default.

### Negative

* Terraform state must be stored securely (encrypted S3 bucket with access
  controls).
* Team members unfamiliar with HCL will need onboarding.
* Importing existing manually-created IAM resources into Terraform state
  requires a one-time migration effort.

## References

* [Terraform AWS Provider -- IAM Resources](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
* [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
