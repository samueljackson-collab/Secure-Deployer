# ADR-001: Use Terraform for Multi-Cloud Infrastructure

## Status

Accepted

## Date

2026-01-10

## Context

Our organization requires compute infrastructure deployed across both AWS and Azure to satisfy geographic redundancy requirements and reduce vendor lock-in risk. We need an Infrastructure-as-Code (IaC) tool that can manage resources across both cloud providers from a single codebase with a unified workflow.

The team evaluated several approaches:

1. **Cloud-native IaC tools** (AWS CloudFormation + Azure Bicep/ARM): Each cloud has mature native tooling, but using two separate tools doubles the cognitive load, requires two CI/CD pipelines, and makes parity enforcement difficult.

2. **Pulumi**: Supports multi-cloud with general-purpose programming languages (Python, TypeScript). Offers strong typing and testing capabilities but introduces a runtime dependency and requires a Pulumi service backend (or self-hosted alternative).

3. **Terraform (HashiCorp)**: Supports multi-cloud through a provider plugin model. Uses HCL, a domain-specific language designed for infrastructure. Has the largest provider ecosystem, extensive community modules, and mature state management.

4. **Crossplane**: Kubernetes-native infrastructure management using CRDs. Powerful for organizations already running Kubernetes, but adds a hard dependency on a running cluster for infrastructure provisioning.

## Decision

We will use **Terraform** (with the BSL-licensed OpenTofu as a fallback option) as the single IaC tool for managing infrastructure across AWS and Azure.

Specifically:

- Use **separate modules** per cloud provider (`modules/aws-compute/`, `modules/azure-compute/`) to encapsulate provider-specific logic.
- Use a **root module** that composes both cloud modules and exposes a unified variable interface.
- Use **remote state backends** (S3 + DynamoDB for AWS, Azure Blob Storage for Azure) with encryption and locking.
- Pin **provider versions** and validate checksums via `.terraform.lock.hcl`.
- Enforce **security parity** at the module level: both modules must implement encryption, network segmentation, and SSH-key-only authentication.

## Consequences

### Positive

- **Single workflow**: One `terraform plan` and `terraform apply` cycle manages both clouds.
- **Shared variable interface**: Environment, project name, and tagging conventions are defined once and propagated to both modules.
- **Large ecosystem**: Both the AWS and AzureRM Terraform providers are actively maintained with comprehensive resource coverage.
- **State management**: Terraform's remote state with locking prevents concurrent modification issues.
- **Team familiarity**: HCL is widely known in the infrastructure engineering community, reducing onboarding time.

### Negative

- **HCL limitations**: HCL is less expressive than a general-purpose language. Complex conditional logic and loops can be verbose.
- **State file sensitivity**: Terraform state contains all resource attributes in plaintext (even when marked sensitive). Requires strict access control on state backends.
- **Provider version drift**: AWS and AzureRM providers release independently. Breaking changes in one provider can block deployments until resolved.
- **BSL licensing concern**: HashiCorp relicensed Terraform under the Business Source License (BSL) in 2023. OpenTofu (MPL-2.0 fork) exists as a mitigation, but ecosystem fragmentation is a risk.
- **No built-in drift detection**: Terraform detects drift only during `plan`. Continuous compliance requires external tooling (e.g., Terraform Cloud, driftctl).

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| CloudFormation + Bicep | Two separate tools, no unified workflow, double CI/CD complexity. |
| Pulumi | Requires Pulumi service backend or self-hosted state; smaller provider ecosystem than Terraform; team unfamiliar with Pulumi SDK. |
| Crossplane | Hard dependency on Kubernetes cluster for provisioning; not appropriate when K8s is not already in the stack. |
| Ansible | Better suited for configuration management than infrastructure provisioning; state management is weaker than Terraform. |
