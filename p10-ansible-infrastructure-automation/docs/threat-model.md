# Threat Model - Configuration Management Infrastructure

## Overview

This threat model applies the STRIDE framework to the Ansible-based configuration management system. It identifies threats related to unauthorized access, configuration tampering, and other risks inherent in managing infrastructure through automation.

## System Context

The configuration management system consists of:

- **Control Node**: The machine running Ansible playbooks (CI/CD server or operator workstation)
- **Managed Nodes**: Target servers receiving configuration (web, app, database, monitoring)
- **Vault Store**: Encrypted secrets used during playbook execution
- **Source Repository**: Git repository containing playbooks, roles, and inventory
- **SSH Transport**: Communication channel between control and managed nodes

## STRIDE Analysis

### 1. Spoofing (Identity)

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| T-S1 | Attacker impersonates the Ansible control node to push malicious configuration | Medium | Critical | SSH key-based authentication with strict host key checking; control node IP allowlisting |
| T-S2 | Compromised SSH keys allow unauthorized access to managed nodes | Medium | Critical | SSH key rotation policy; hardware security modules for key storage; passphrase-protected keys |
| T-S3 | Unauthorized user executes playbooks from an uncontrolled workstation | Low | High | Restrict playbook execution to CI/CD pipeline; require MFA for operator access |

### 2. Tampering (Integrity)

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| T-T1 | Attacker modifies playbooks or roles in the source repository | Medium | Critical | Branch protection rules; mandatory code review; signed commits; repository audit logging |
| T-T2 | Configuration files altered on managed nodes outside of Ansible | Medium | High | Idempotent playbook runs detect and correct drift; file integrity monitoring (AIDE/OSSEC) |
| T-T3 | Man-in-the-middle attack modifies configuration during SSH transport | Low | Critical | SSH strict host key checking enabled; known_hosts verification; encrypted transport |
| T-T4 | Vault-encrypted secrets tampered with in the repository | Low | High | Git commit signing; vault file integrity checks; access controls on vault password |

### 3. Repudiation (Accountability)

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| T-R1 | Operator denies executing a destructive playbook | Medium | Medium | Centralized audit logging; CI/CD pipeline execution logs; Ansible callback plugins for logging |
| T-R2 | Changes to managed nodes cannot be traced to a specific playbook run | Medium | Medium | Enable ansible.log; use ARA (Ansible Run Analysis) for execution history; syslog forwarding |

### 4. Information Disclosure (Confidentiality)

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| T-I1 | Vault password exposed in CI/CD logs or environment variables | Medium | Critical | Use vault password file with strict permissions; never log vault password; use CI/CD secret management |
| T-I2 | Secrets leaked in Ansible output (stdout/stderr) | High | High | Use no_log: true for tasks handling secrets; configure ansible.cfg to limit output verbosity |
| T-I3 | Unencrypted secrets committed to the source repository | Medium | Critical | Pre-commit hooks scanning for secrets; .gitignore for sensitive files; repository scanning tools |
| T-I4 | Inventory file exposes internal network topology | Low | Medium | Encrypt inventory with Vault; restrict repository access; use dynamic inventory |

### 5. Denial of Service (Availability)

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| T-D1 | Malicious playbook run disrupts production services | Medium | Critical | Rolling deployment strategy with serial execution; health checks between batches; canary deployments |
| T-D2 | Fork bomb or resource exhaustion through Ansible task | Low | High | Limit Ansible forks; resource controls on managed nodes; timeout configuration on tasks |
| T-D3 | Loss of the Ansible control node prevents emergency configuration changes | Low | High | Multiple authorized control nodes; documented manual procedures; infrastructure-as-code backup |

### 6. Elevation of Privilege (Authorization)

| Threat | Description | Likelihood | Impact | Mitigation |
|--------|-------------|------------|--------|------------|
| T-E1 | Ansible service account has excessive privileges on managed nodes | High | Critical | Principle of least privilege; use become only when necessary; restrict sudo commands in sudoers |
| T-E2 | Operator with limited access escalates via Ansible to root on all hosts | Medium | Critical | Role-based access control for playbook execution; limit inventory access by team; AWX/Tower RBAC |
| T-E3 | Compromised role from Ansible Galaxy introduces privilege escalation | Medium | High | Pin role versions; review third-party roles before use; prefer internal roles; use requirements.yml with checksums |

## Risk Matrix

```
Impact
Critical  |  T-S2  T-T1  |  T-S1  T-D1  T-E1  |
          |  T-I1  T-T3  |  T-E2  T-E3        |
High      |  T-D3        |  T-T2  T-I2  T-D2  |
          |              |  T-I3               |
Medium    |              |  T-R1  T-R2        |
          |              |                     |
Low       |              |  T-I4              |
          +--------------+---------------------+
           Low            Medium          High
                    Likelihood
```

## Recommended Controls Priority

1. **Immediate**: Enable no_log for secret-handling tasks; enforce SSH key authentication; enable Vault for all secrets
2. **Short-term**: Implement CI/CD pipeline for playbook execution; add pre-commit secret scanning; configure audit logging
3. **Medium-term**: Deploy AWX/Tower for RBAC and audit trails; implement drift detection; add file integrity monitoring
4. **Long-term**: Hardware security modules for SSH keys; automated compliance scanning; chaos engineering for DR validation
