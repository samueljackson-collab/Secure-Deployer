# Getting Started

This guide walks you through setting up your environment and running your first playbook.

## Prerequisites

### Software Requirements

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| Python | 3.9+ | Ansible runtime |
| Ansible | 2.15+ | Configuration management |
| Docker | 24.0+ | Molecule test driver |
| Molecule | 5.0+ | Role testing framework |
| ansible-lint | 6.0+ | Playbook linting |

### System Requirements

- Linux or macOS control node (Windows requires WSL2)
- SSH access to all managed nodes
- sudo privileges on managed nodes for the Ansible user

## Installation

### Step 1: Install Python Dependencies

```bash
# Create a virtual environment (recommended)
python3 -m venv ~/.ansible-venv
source ~/.ansible-venv/bin/activate

# Install Ansible and testing tools
pip install ansible molecule molecule-docker ansible-lint yamllint
```

### Step 2: Verify Installation

```bash
ansible --version
molecule --version
ansible-lint --version
```

### Step 3: Configure SSH Access

Ensure your SSH key is deployed to all managed nodes:

```bash
# Generate an SSH key if you do not have one
ssh-keygen -t ed25519 -C "ansible@control-node"

# Copy your key to each managed node
ssh-copy-id user@webserver01.example.com
ssh-copy-id user@appserver01.example.com
ssh-copy-id user@dbserver01.example.com
```

### Step 4: Set Up Inventory

Create an inventory file for your environment:

```bash
mkdir -p inventory
```

Create `inventory/production` with your host details:

```ini
[webservers]
web01.example.com
web02.example.com

[appservers]
app01.example.com
app02.example.com

[databases]
db01.example.com
db02.example.com

[monitoring]
monitor01.example.com

[all:vars]
ansible_user=deploy
ansible_python_interpreter=/usr/bin/python3
```

### Step 5: Configure Vault

Set up Ansible Vault for secrets management:

```bash
# Create a vault password file (do NOT commit this to version control)
echo 'your-vault-password' > ~/.vault_pass
chmod 600 ~/.vault_pass

# Create encrypted variables file
ansible-vault create group_vars/all/vault.yml --vault-password-file ~/.vault_pass
```

## Running Your First Playbook

### Test Connectivity

Verify Ansible can reach all hosts:

```bash
ansible all -i inventory/production -m ping
```

### Dry Run (Check Mode)

Always perform a dry run before applying changes to production:

```bash
ansible-playbook playbooks/security-hardening.yml \
  -i inventory/production \
  --check --diff \
  --vault-password-file ~/.vault_pass
```

### Apply Security Baseline

Start with the security hardening playbook:

```bash
ansible-playbook playbooks/security-hardening.yml \
  -i inventory/production \
  --vault-password-file ~/.vault_pass
```

### Deploy the Full Stack

Run the master playbook to configure all tiers:

```bash
ansible-playbook playbooks/site.yml \
  -i inventory/production \
  --vault-password-file ~/.vault_pass
```

### Target Specific Hosts

Use the `--limit` flag to target specific hosts or groups:

```bash
# Only web servers
ansible-playbook playbooks/site.yml -i inventory/production --limit webservers

# A single host
ansible-playbook playbooks/site.yml -i inventory/production --limit web01.example.com
```

## Running Tests

### Test a Single Role

```bash
cd roles/security-base
molecule test
```

### Test All Roles

```bash
for role in roles/*/; do
  echo "Testing ${role}..."
  (cd "${role}" && molecule test)
done
```

### Lint All Playbooks and Roles

```bash
ansible-lint playbooks/ roles/
```

## Common First-Run Issues

| Issue | Solution |
|-------|----------|
| `Permission denied (publickey)` | Ensure your SSH key is deployed to the target host |
| `ansible_python_interpreter not found` | Set `ansible_python_interpreter=/usr/bin/python3` in inventory |
| `Vault password not provided` | Add `--vault-password-file` or `--ask-vault-pass` to your command |
| `Host key verification failed` | Run `ssh-keyscan hostname >> ~/.ssh/known_hosts` or set `host_key_checking = False` for initial setup |

## Next Steps

- Read the [Security Practices](SECURITY.md) guide before managing production infrastructure
- Review the [Troubleshooting](TROUBLESHOOTING.md) guide for common issues
- Explore individual role README files for configuration options
