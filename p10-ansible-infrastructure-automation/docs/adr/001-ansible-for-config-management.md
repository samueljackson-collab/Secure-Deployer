# ADR-001: Ansible for Configuration Management

## Status

Accepted

## Date

2026-02-04

## Context

We need a configuration management and infrastructure automation tool to manage our multi-tier production environment consisting of web servers, application servers, database servers, and monitoring infrastructure. The solution must support:

- Idempotent configuration across all server tiers
- Secret management for credentials and certificates
- Rolling deployments with zero-downtime capability
- Testing of infrastructure code before production application
- Integration with our existing CI/CD pipeline
- Security hardening automation

We evaluated the following tools:

1. **Ansible** - Agentless, Python-based, YAML playbooks, SSH transport
2. **Puppet** - Agent-based, Ruby DSL, requires Puppet server infrastructure
3. **Chef** - Agent-based, Ruby DSL, requires Chef server
4. **SaltStack** - Agent or agentless, Python-based, YAML states, ZeroMQ transport
5. **Terraform** - Declarative IaC, HCL, focused on provisioning rather than configuration

## Decision

We will use **Ansible** as our primary configuration management and automation tool.

## Rationale

### Agentless Architecture

Ansible operates over SSH without requiring agents on managed nodes. This reduces the attack surface on production servers (no additional listening services), eliminates agent maintenance overhead, and simplifies onboarding of new servers. The only requirement on managed nodes is Python, which is present on virtually all Linux distributions.

### Low Barrier to Entry

Ansible playbooks use YAML, which is human-readable and does not require learning a domain-specific programming language. This allows operations engineers, developers, and security teams to collaborate on infrastructure code without specialized training.

### Built-in Vault

Ansible Vault provides native AES-256 encryption for secrets, eliminating the need for a separate secrets management integration for basic use cases. Vault-encrypted files integrate seamlessly with Git workflows and can be decrypted at runtime with a password or password file.

### Testing Ecosystem

Molecule provides a mature testing framework for Ansible roles with support for Docker-based testing, idempotence checks, and verification. Combined with ansible-lint, this gives us confidence in configuration correctness before applying changes to production.

### Rolling Deployment Support

Ansible natively supports serial execution, delegate_to, and health checks, enabling zero-downtime rolling deployments without additional tooling. The `serial` keyword and `max_fail_percentage` provide fine-grained control over deployment batches.

### Community and Ecosystem

Ansible Galaxy provides a large collection of community roles. Ansible has extensive documentation and a large user community, reducing the risk of knowledge silos.

### Trade-offs Accepted

- **Performance at scale**: Ansible is slower than agent-based tools for very large fleets (1000+ nodes) because it pushes configuration over SSH. We accept this because our infrastructure is under 200 nodes.
- **State management**: Ansible does not maintain state between runs (unlike Terraform). We accept this because we use Terraform for provisioning and Ansible for configuration, keeping concerns separated.
- **No continuous enforcement**: Unlike Puppet, Ansible does not continuously enforce desired state. We mitigate this with scheduled playbook runs and drift detection.

## Alternatives Considered

### Puppet

Rejected because the agent-based model increases attack surface on managed nodes, Ruby DSL has a steeper learning curve for our team, and the Puppet server infrastructure adds operational overhead.

### Chef

Rejected for similar reasons as Puppet: agent requirement, Ruby-based recipes, and the need for a Chef server. Additionally, the Chef ecosystem has seen reduced community activity.

### SaltStack

SaltStack was the closest alternative. It supports both agent and agentless modes, uses YAML, and is Python-based. However, the ZeroMQ transport in agent mode adds complexity, the agentless (salt-ssh) mode is less mature than Ansible's SSH execution, and Ansible has broader community adoption and tooling support.

### Terraform

Terraform excels at infrastructure provisioning but is not designed for ongoing configuration management. We use Terraform for provisioning cloud resources and Ansible for configuring them, following the separation of concerns principle.

## Consequences

- All infrastructure configuration will be codified in Ansible playbooks and roles
- The team must maintain Ansible and Python version compatibility across the control node
- Molecule tests are required for all roles before merging to the main branch
- Ansible Vault will be the primary mechanism for secret management in playbooks
- Scheduled playbook runs will be configured to detect and correct configuration drift
- AWX or Ansible Automation Platform may be adopted later for RBAC and centralized management
