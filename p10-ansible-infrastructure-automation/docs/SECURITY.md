# Security Practices for Ansible Usage

This document outlines the security practices that must be followed when using this Ansible project to manage production infrastructure.

## Secrets Management

### Ansible Vault

- **All secrets must be encrypted** with Ansible Vault before committing to version control
- Use a strong vault password (minimum 32 characters, generated randomly)
- Store the vault password file outside the repository with permissions `0600`
- Never pass vault passwords via command-line arguments (they appear in process listings)
- Rotate the vault password quarterly or immediately after team member departure

### no_log Directive

- All tasks that handle sensitive data must include `no_log: true`
- This prevents credentials from appearing in Ansible output or logs

```yaml
- name: Set database password
  ansible.builtin.user:
    name: "{{ db_user }}"
    password: "{{ db_password | password_hash('sha512') }}"
  no_log: true
```

### Environment Variables

- Never store secrets in environment variables on the control node
- Use Ansible Vault or an external secrets manager (HashiCorp Vault, AWS Secrets Manager)

## SSH Security

### Key Management

- Use Ed25519 SSH keys (minimum RSA 4096-bit if Ed25519 is not available)
- Protect private keys with passphrases; use ssh-agent to avoid repeated prompts
- Rotate SSH keys annually or immediately upon suspected compromise
- Store SSH keys for service accounts in a hardware security module where possible

### SSH Configuration

- Enable `host_key_checking` in production (set to `True` in `ansible.cfg`)
- Maintain a verified `known_hosts` file for all managed nodes
- Use SSH multiplexing (ControlPersist) for performance without sacrificing security
- Disable SSH agent forwarding unless explicitly required

## Privilege Escalation

### Principle of Least Privilege

- The Ansible user should have minimal privileges by default
- Use `become: true` only on tasks that require elevated privileges, not at the play level
- Configure sudoers to restrict the Ansible user to specific commands where possible

```yaml
# Preferred: become on specific tasks
- name: Install package
  ansible.builtin.apt:
    name: nginx
    state: present
  become: true

# Avoid: become at play level grants root for all tasks
```

### Sudoers Configuration

```
# /etc/sudoers.d/ansible
deploy ALL=(ALL) NOPASSWD: /usr/bin/apt-get, /usr/bin/systemctl, /usr/sbin/ufw
```

## Code Review and Version Control

### Branch Protection

- Require pull request reviews for all changes to playbooks and roles
- Enforce signed commits for audit trail integrity
- Use branch protection rules to prevent force pushes to main

### Pre-commit Hooks

- Run `ansible-lint` on all modified playbooks and roles
- Scan for accidentally committed secrets using tools like `detect-secrets` or `gitleaks`
- Validate YAML syntax before allowing commits

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/ansible/ansible-lint
    hooks:
      - id: ansible-lint
  - repo: https://github.com/Yelp/detect-secrets
    hooks:
      - id: detect-secrets
```

## Network Security

### Control Node Hardening

- The control node should be a dedicated, hardened machine or CI/CD runner
- Restrict network access to the control node (VPN or bastion host)
- Enable full disk encryption on the control node
- Keep Ansible and all Python dependencies updated

### Managed Node Access

- Firewall rules should allow SSH (port 22) only from the control node IP(s)
- Use a dedicated management network for Ansible traffic where possible
- Enable SSH rate limiting to prevent brute-force attacks

## Logging and Auditing

### Ansible Logging

- Enable `log_path` in `ansible.cfg` for all playbook runs
- Forward Ansible logs to a centralized logging system (ELK, Splunk)
- Use callback plugins (e.g., `ara`) for detailed execution history

### Audit Trail

- All playbook executions should be triggered through the CI/CD pipeline
- Manual playbook runs must be documented with a reason and ticket number
- Review audit logs weekly for unauthorized or unexpected executions

## Role and Playbook Security

### Third-Party Roles

- Never use third-party Ansible Galaxy roles without thorough review
- Pin role versions in `requirements.yml` with checksums
- Prefer internal roles over community roles for security-sensitive tasks
- Audit third-party role updates before upgrading

### Task Security

- Always use fully qualified collection names (FQCN) to prevent module name collisions
- Validate all user-supplied variables before use in templates
- Use `ansible.builtin.assert` to enforce variable constraints
- Set appropriate file permissions in all `copy`, `template`, and `file` tasks

```yaml
- name: Deploy configuration file
  ansible.builtin.template:
    src: app.conf.j2
    dest: /etc/app/app.conf
    owner: root
    group: app
    mode: "0640"
```

## Incident Response

### Compromised Credentials

1. Immediately rotate all affected credentials
2. Re-encrypt Vault files with a new vault password
3. Rotate SSH keys on all managed nodes
4. Review audit logs to assess the scope of compromise
5. Run security hardening playbook to re-baseline all hosts

### Unauthorized Playbook Execution

1. Identify the source of the execution from audit logs
2. Revoke access for the compromised account
3. Review changes made by the unauthorized execution
4. Roll back any malicious configuration changes
5. Run drift detection to verify all hosts match desired state
