# P02 - IAM Security Hardening

Infrastructure-as-Code modules and automated policy validation tooling for
enforcing AWS IAM least-privilege best practices across an organisation.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Terraform Modules](#terraform-modules)
4. [Policy Validator Tool](#policy-validator-tool)
5. [Getting Started](#getting-started)
6. [Testing](#testing)
7. [Threat Model](#threat-model)
8. [Decision Records](#decision-records)
9. [Contributing](#contributing)
10. [License](#license)

---

## Overview

Misconfigured IAM policies are one of the most common root causes behind AWS
security incidents.  This project provides two complementary layers of defence:

| Layer | Purpose |
|-------|---------|
| **Terraform Modules** | Provision IAM policies and assumable roles that follow the principle of least privilege by default. |
| **Python Policy Validator** | Static analysis tool that scans IAM policy JSON documents and flags dangerous patterns before they reach production. |

Together they form a *shift-left* approach to IAM governance: policies are
created through hardened modules **and** validated in CI before deployment.

## Architecture

```
p02-iam-security-hardening/
|-- main.tf                        # Root Terraform module
|-- variables.tf                   # Root input variables
|-- outputs.tf                     # Root outputs
|
|-- modules/
|   |-- iam-policy/                # Least-privilege policy builder
|   |   |-- main.tf
|   |   |-- variables.tf
|   |   |-- outputs.tf
|   |   +-- README.md
|   |
|   +-- iam-assumable-role/        # Role + trust policy builder
|       |-- main.tf
|       |-- variables.tf
|       |-- outputs.tf
|       +-- README.md
|
|-- policy_validator/              # Python static analysis tool
|   |-- __init__.py
|   |-- validator.py               # Core validation engine
|   |-- main.py                    # CLI entry point
|   |-- requirements.txt
|   +-- tests/
|       |-- __init__.py
|       |-- test_unit_validator.py
|       |-- test_integration_validator.py
|       +-- test_policies/         # Sample policies for testing
|
+-- docs/
    |-- threat-model.md
    +-- adr/
        |-- 001-terraform-for-iam.md
        |-- 002-python-for-policy-validation.md
        +-- 003-separate-iam-policy-and-role-modules.md
```

## Terraform Modules

### `modules/iam-policy`

Creates a customer-managed IAM policy document with guardrails that prevent
common misconfigurations:

* Actions must be explicitly listed (no `*` wildcards by default).
* Resources must be scoped to specific ARNs.
* An optional `condition` block can enforce additional constraints such as
  source IP or MFA.

```hcl
module "s3_read_policy" {
  source = "./modules/iam-policy"

  policy_name        = "s3-read-only"
  description        = "Read-only access to the data-lake bucket"
  policy_statements  = [
    {
      sid       = "AllowS3Read"
      effect    = "Allow"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = [
        "arn:aws:s3:::data-lake-bucket",
        "arn:aws:s3:::data-lake-bucket/*"
      ]
      conditions = []
    }
  ]

  tags = { Environment = "production" }
}
```

### `modules/iam-assumable-role`

Creates an IAM role with a configurable trust policy, attaches managed
policies, and supports an optional permissions boundary:

```hcl
module "deployer_role" {
  source = "./modules/iam-assumable-role"

  role_name            = "ci-deployer"
  description          = "Role assumed by the CI pipeline for deployments"
  max_session_duration = 3600

  trusted_entities = [
    {
      type        = "AWS"
      identifiers = ["arn:aws:iam::123456789012:role/ci-runner"]
    }
  ]

  policy_arns          = [module.s3_read_policy.policy_arn]
  permissions_boundary = "arn:aws:iam::123456789012:policy/org-boundary"

  tags = { Environment = "production" }
}
```

## Policy Validator Tool

A pure-Python CLI that performs static analysis on IAM policy JSON files.

### Checks Performed

| ID | Check | Severity |
|----|-------|----------|
| `WILDCARD_ACTION` | `Action` or `NotAction` contains `*` | HIGH |
| `WILDCARD_RESOURCE` | `Resource` contains `*` | HIGH |
| `MISSING_CONDITION` | Sensitive actions lack a `Condition` block | MEDIUM |
| `OVERLY_PERMISSIVE_PRINCIPAL` | `Principal` is set to `*` or `{"AWS": "*"}` | HIGH |
| `NOT_ACTION_USAGE` | `NotAction` is used (inversion anti-pattern) | MEDIUM |
| `NOT_RESOURCE_USAGE` | `NotResource` is used (inversion anti-pattern) | MEDIUM |

### Usage

```bash
# Validate a single policy (human-readable output)
python -m policy_validator.main path/to/policy.json

# JSON output for CI integration
python -m policy_validator.main path/to/policy.json --format json

# Strict mode: exit 1 on any finding (useful in pipelines)
python -m policy_validator.main path/to/policy.json --strict
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No findings (or non-strict mode) |
| 1 | Findings detected in strict mode |
| 2 | Input error (file not found, invalid JSON) |

## Getting Started

### Prerequisites

* Terraform >= 1.3
* Python >= 3.8
* AWS credentials configured (for Terraform apply)

### Deploying IAM Resources

```bash
cd p02-iam-security-hardening
terraform init
terraform plan -var-file=environments/prod.tfvars
terraform apply -var-file=environments/prod.tfvars
```

### Running the Policy Validator

```bash
cd p02-iam-security-hardening
pip install -r policy_validator/requirements.txt   # no external deps needed
python -m policy_validator.main my_policy.json --format json --strict
```

## Testing

### Python Unit and Integration Tests

```bash
cd p02-iam-security-hardening
python -m pytest policy_validator/tests/ -v
# or with unittest
python -m unittest discover -s policy_validator/tests -v
```

### Terraform Validation

```bash
terraform fmt -check -recursive
terraform validate
```

## Threat Model

A full STRIDE-based threat model is documented in
[docs/threat-model.md](docs/threat-model.md).  Key threats addressed:

* **Privilege escalation** via wildcard actions or over-scoped resources.
* **Credential theft** through roles assumable by overly broad principals.
* **Lateral movement** using `NotAction`/`NotResource` inversions that
  accidentally grant unintended permissions.

## Decision Records

| ADR | Title |
|-----|-------|
| [001](docs/adr/001-terraform-for-iam.md) | Use Terraform for IAM Management |
| [002](docs/adr/002-python-for-policy-validation.md) | Use Python for Policy Validation |
| [003](docs/adr/003-separate-iam-policy-and-role-modules.md) | Separate IAM Policy and Role Modules |

## Contributing

1. Branch from `main`.
2. Add or modify Terraform modules under `modules/`.
3. Add or modify validation checks in `policy_validator/validator.py`.
4. Write tests for every new check.
5. Ensure `python -m pytest` and `terraform validate` pass.
6. Open a pull request.

## License

This project is provided under the MIT License.  See the repository root for
the full licence text.
