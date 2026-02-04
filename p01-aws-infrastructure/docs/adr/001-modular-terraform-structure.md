# ADR-001: Modular Terraform Structure

## Status

Accepted

## Date

2025-01-15

## Context

The P01 AWS Infrastructure project provisions a complete production environment including networking (VPC, subnets, NAT Gateway), compute (ALB, ASG), database (RDS PostgreSQL), and storage (S3). Managing all of these resources in a single flat Terraform configuration would create several problems:

- **Readability**: A single `main.tf` file with hundreds of resources becomes difficult to navigate and understand.
- **Reusability**: Infrastructure patterns (e.g., VPC with public/private subnets) cannot be reused across projects without copy-pasting.
- **Blast radius**: A change to any resource requires Terraform to evaluate the entire configuration, increasing the risk of unintended changes.
- **Team collaboration**: Multiple engineers working on different layers (networking, compute, database) would face frequent merge conflicts.
- **Testing**: It is impractical to test individual components in isolation when everything is defined in a monolithic configuration.

## Decision

We will organize the infrastructure into a **modular Terraform structure** with the following hierarchy:

```
p01-aws-infrastructure/
  main.tf              # Root module: composes child modules
  variables.tf         # Root variables passed to child modules
  outputs.tf           # Root outputs aggregated from child modules
  terraform.tfvars.example
  modules/
    vpc/               # Network foundation
    security-groups/   # Layered firewall rules
    alb/               # Application Load Balancer
    asg/               # Auto Scaling Group with launch templates
    rds/               # PostgreSQL database
    s3/                # Encrypted storage bucket
```

Each module:
- Has its own `main.tf`, `variables.tf`, `outputs.tf`, and `README.md`.
- Encapsulates a single functional domain (networking, compute, database, storage).
- Communicates with other modules exclusively through input variables and outputs.
- Can be versioned, tested, and documented independently.

The root module (`main.tf`) acts as the orchestrator, wiring module outputs to inputs and providing a single entry point for `terraform plan` and `terraform apply`.

## Consequences

### Positive

- **Separation of concerns**: Each module has a clear, well-defined responsibility. Changes to the database tier do not require understanding the networking configuration.
- **Reusability**: Modules can be extracted and reused in other projects or environments with different variable values.
- **Reduced blast radius**: Targeted `terraform plan` with `-target` can scope changes to a specific module during incident response.
- **Parallel development**: Team members can work on different modules with minimal merge conflicts.
- **Self-documenting**: Module boundaries serve as natural documentation for the architecture.
- **Testability**: Individual modules can be validated with `terraform validate` and integration-tested independently.

### Negative

- **Increased file count**: More files and directories to manage compared to a monolithic configuration.
- **Cross-module dependencies**: Changes that span multiple modules (e.g., adding a new security group rule for a new service) require coordinated updates.
- **Learning curve**: New team members must understand the module structure before making changes.

### Neutral

- **No impact on Terraform state**: All modules share a single state file at the root level, so there is no additional state management complexity.
- **Provider configuration**: The provider is configured at the root level and inherited by all child modules automatically.
