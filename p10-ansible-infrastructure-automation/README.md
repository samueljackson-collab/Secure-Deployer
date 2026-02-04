# P10 - Ansible Infrastructure Automation

Comprehensive Ansible project for infrastructure provisioning, configuration management, security hardening, and application deployment across multi-tier environments.

## Architecture Overview

This project manages the full lifecycle of a production infrastructure stack:

```
+------------------+     +------------------+     +------------------+
|   Web Servers    |     |   App Servers    |     |   DB Servers     |
|   (nginx)        |---->|   (application)  |---->|   (PostgreSQL)   |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        +------------------------+------------------------+
                                 |
                    +---------------------------+
                    |   Monitoring & Security   |
                    |   (monitoring-agent,      |
                    |    security-base)         |
                    +---------------------------+
```

## Roles

| Role | Description | Key Features |
|------|-------------|--------------|
| `security-base` | OS-level security hardening | SSH hardening, UFW firewall, fail2ban, audit logging, sysctl tuning |
| `nginx` | Web server / reverse proxy | TLS termination, security headers, virtual hosts, worker tuning |
| `database` | PostgreSQL database server | Replication, backup scheduling, pg_hba configuration, user management |
| `application` | Application deployment | Systemd service, health checks, dependency management, code deployment |
| `monitoring-agent` | Prometheus node_exporter | Metrics collection, scrape configuration, log forwarding |

## Playbooks

| Playbook | Description |
|----------|-------------|
| `site.yml` | Master playbook that imports all others |
| `webservers.yml` | Web server tier configuration with nginx |
| `databases.yml` | Database tier setup with PostgreSQL |
| `security-hardening.yml` | Security baseline applied to all hosts |
| `monitoring.yml` | Monitoring agent deployment across all hosts |
| `deploy-application.yml` | Application deployment with rolling strategy |
| `rolling_update.yml` | Zero-downtime rolling update with health checks |
| `disaster_recovery.yml` | Backup restoration and failover procedures |

## Vault Integration

Sensitive variables are encrypted with Ansible Vault. The following files contain encrypted data:

- Database credentials
- TLS certificates and private keys
- Application secrets and API keys
- SSH keys for service accounts

### Encrypting secrets

```bash
# Encrypt a file
ansible-vault encrypt group_vars/all/vault.yml

# Edit an encrypted file
ansible-vault edit group_vars/all/vault.yml

# Encrypt a string for inline use
ansible-vault encrypt_string 'supersecret' --name 'db_password'
```

### Using Vault at runtime

```bash
# Prompt for vault password
ansible-playbook playbooks/site.yml --ask-vault-pass

# Use a vault password file
ansible-playbook playbooks/site.yml --vault-password-file ~/.vault_pass
```

## Testing Approach

Each role includes Molecule tests using the Docker driver:

```bash
# Run tests for a specific role
cd roles/security-base
molecule test

# Run only the converge step (useful during development)
molecule converge

# Run verification tests without full destroy/create cycle
molecule verify

# Lint all roles
ansible-lint playbooks/ roles/
```

### Test Matrix

| Role | Driver | Platforms | Idempotence | Verify |
|------|--------|-----------|-------------|--------|
| security-base | Docker | Ubuntu 22.04, Debian 12 | Yes | SSH config, firewall rules |
| nginx | Docker | Ubuntu 22.04, Debian 12 | Yes | HTTP response, config syntax |
| database | Docker | Ubuntu 22.04, Debian 12 | Yes | PostgreSQL connectivity, users |
| application | Docker | Ubuntu 22.04 | Yes | Service status, health endpoint |
| monitoring-agent | Docker | Ubuntu 22.04, Debian 12 | Yes | Exporter metrics endpoint |

## Getting Started

### Prerequisites

- Python 3.9+
- Ansible 2.15+
- Docker (for Molecule tests)
- Molecule 5.0+ with molecule-docker plugin

### Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd p10-ansible-infrastructure-automation

# 2. Install Python dependencies
pip install ansible molecule molecule-docker ansible-lint

# 3. Configure your inventory
cp inventory/example inventory/production
# Edit inventory/production with your host details

# 4. Run the security baseline first
ansible-playbook playbooks/security-hardening.yml -i inventory/production

# 5. Deploy the full stack
ansible-playbook playbooks/site.yml -i inventory/production --ask-vault-pass
```

### Project Structure

```
p10-ansible-infrastructure-automation/
├── ansible.cfg
├── playbooks/
│   ├── site.yml
│   ├── webservers.yml
│   ├── databases.yml
│   ├── security-hardening.yml
│   ├── monitoring.yml
│   ├── deploy-application.yml
│   ├── rolling_update.yml
│   └── disaster_recovery.yml
├── roles/
│   ├── security-base/
│   ├── nginx/
│   ├── database/
│   ├── application/
│   └── monitoring-agent/
└── docs/
    ├── threat-model.md
    ├── GETTING-STARTED.md
    ├── SECURITY.md
    ├── TROUBLESHOOTING.md
    └── adr/
        └── 001-ansible-for-config-management.md
```

## Security Considerations

- All secrets managed through Ansible Vault with AES-256 encryption
- SSH key-based authentication enforced; password authentication disabled
- Principle of least privilege applied to all service accounts
- TLS enforced for all network communication between tiers
- Firewall rules restrict traffic to necessary ports only
- Audit logging enabled on all managed hosts

## License

MIT License - see LICENSE for details.
