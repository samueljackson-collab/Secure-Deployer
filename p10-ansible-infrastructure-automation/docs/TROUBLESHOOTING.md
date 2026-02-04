# Troubleshooting Guide

Common issues and their solutions when working with this Ansible project.

## Connection Issues

### SSH Connection Refused

**Symptom**: `fatal: [host]: UNREACHABLE! => {"msg": "Failed to connect to the host via ssh"}`

**Solutions**:

1. Verify the host is reachable: `ping <hostname>`
2. Confirm SSH is running on the target: `ssh -v user@hostname`
3. Check the correct SSH key is being used: `ssh -i ~/.ssh/ansible_key user@hostname`
4. Verify the inventory has the correct hostname/IP and SSH port
5. Ensure the firewall allows SSH from the control node

### Host Key Verification Failed

**Symptom**: `fatal: [host]: UNREACHABLE! => {"msg": "Host key verification failed"}`

**Solutions**:

1. Add the host key to known_hosts: `ssh-keyscan hostname >> ~/.ssh/known_hosts`
2. For initial setup only, temporarily set `host_key_checking = False` in ansible.cfg
3. If the host was rebuilt, remove the old key: `ssh-keygen -R hostname`

### Permission Denied

**Symptom**: `fatal: [host]: UNREACHABLE! => {"msg": "Permission denied (publickey)"}`

**Solutions**:

1. Deploy your SSH key: `ssh-copy-id user@hostname`
2. Verify the correct user is configured in inventory (`ansible_user`)
3. Check file permissions on the target: `~/.ssh` should be `0700`, `authorized_keys` should be `0600`

## Vault Issues

### Vault Password Not Provided

**Symptom**: `ERROR! Attempting to decrypt but no vault secrets found`

**Solutions**:

1. Add `--ask-vault-pass` to your command
2. Add `--vault-password-file ~/.vault_pass` to your command
3. Set `vault_password_file` in `ansible.cfg`

### Vault Decryption Failed

**Symptom**: `ERROR! Decryption failed on vault data`

**Solutions**:

1. Verify you are using the correct vault password
2. Ensure the vault password file does not have a trailing newline: `cat -A ~/.vault_pass`
3. Check that the encrypted file is not corrupted: `ansible-vault view <file>`

## Playbook Execution Issues

### Task Timeout

**Symptom**: Task hangs or times out during execution.

**Solutions**:

1. Increase the timeout for the specific task:
   ```yaml
   - name: Long-running task
     ansible.builtin.command: /opt/scripts/migration.sh
     async: 3600
     poll: 30
   ```
2. Check network connectivity to the managed node
3. Verify the command or service is not waiting for interactive input
4. Check system resources on the managed node (CPU, memory, disk)

### Idempotence Failures

**Symptom**: Tasks report `changed` on every run when they should be idempotent.

**Solutions**:

1. Use Ansible modules instead of `command`/`shell` where possible
2. Add `creates` or `removes` parameters to command tasks
3. Use `changed_when` to control when a task reports changes:
   ```yaml
   - name: Check application version
     ansible.builtin.command: /opt/app/bin/version
     register: app_version
     changed_when: false
   ```

### Variable Precedence Issues

**Symptom**: Variables have unexpected values during playbook execution.

**Solutions**:

Ansible variable precedence (highest to lowest):

1. Extra vars (`-e "var=value"`) - always win
2. Task vars (in a task block)
3. Block vars
4. Role vars (`roles/x/vars/main.yml`)
5. Play vars
6. Host facts
7. Inventory host_vars
8. Inventory group_vars
9. Role defaults (`roles/x/defaults/main.yml`)

Debug variable values:

```yaml
- name: Debug variable value
  ansible.builtin.debug:
    msg: "Variable value is: {{ my_variable }}"
```

### Handler Not Executing

**Symptom**: A handler is notified but does not run.

**Solutions**:

1. Handlers run at the end of a play, not immediately. Use `meta: flush_handlers` if you need immediate execution
2. Verify the handler name matches exactly (case-sensitive)
3. If the notifying task did not report `changed`, the handler will not trigger
4. Handlers only run once per play, even if notified multiple times

## Role Issues

### Role Not Found

**Symptom**: `ERROR! the role 'rolename' was not found`

**Solutions**:

1. Verify `roles_path` in `ansible.cfg` includes the correct directory
2. Check that the role directory name matches the reference in the playbook
3. If using Galaxy roles, run `ansible-galaxy install -r requirements.yml`

### Molecule Test Failures

**Symptom**: Molecule tests fail during create, converge, or verify.

**Solutions**:

1. **Docker not running**: Ensure Docker daemon is active: `systemctl status docker`
2. **Image pull failure**: Check internet connectivity and Docker Hub access
3. **Converge failure**: Run `molecule converge` to see detailed error output
4. **Verify failure**: Run `molecule login` to inspect the container state manually
5. **Stale containers**: Destroy and recreate: `molecule destroy && molecule test`

## Performance Issues

### Slow Playbook Execution

**Solutions**:

1. Enable SSH pipelining in `ansible.cfg`: `pipelining = True`
2. Increase forks for parallel execution: `forks = 20`
3. Use `free` strategy for independent tasks: `strategy: free`
4. Enable fact caching:
   ```ini
   [defaults]
   gathering = smart
   fact_caching = jsonfile
   fact_caching_connection = /tmp/ansible_facts
   fact_caching_timeout = 3600
   ```
5. Disable fact gathering for plays that do not need facts: `gather_facts: false`

### High Memory Usage on Control Node

**Solutions**:

1. Reduce the number of forks: `forks = 10`
2. Disable fact caching if the cache grows too large
3. Use `--limit` to target fewer hosts per run
4. Split large playbooks into smaller, focused runs

## Database Role Issues

### PostgreSQL Service Fails to Start

**Solutions**:

1. Check PostgreSQL logs: `journalctl -u postgresql`
2. Verify disk space: `df -h /var/lib/postgresql`
3. Ensure pg_hba.conf has valid entries
4. Check for port conflicts: `ss -tlnp | grep 5432`

### Replication Not Working

**Solutions**:

1. Verify replication user exists on primary: `psql -c "SELECT * FROM pg_replication_slots;"`
2. Check pg_hba.conf allows replication connections from standby IP
3. Verify network connectivity between primary and standby on port 5432
4. Check standby recovery configuration

## Nginx Role Issues

### Nginx Configuration Test Fails

**Solutions**:

1. Test configuration syntax: `nginx -t`
2. Check for missing SSL certificates referenced in configuration
3. Verify all upstream servers are defined
4. Look for duplicate `server_name` directives across virtual hosts

## Getting Help

If you cannot resolve an issue with this guide:

1. Check the Ansible documentation: https://docs.ansible.com/
2. Search the role README files for configuration options
3. Review the Molecule test output for detailed error messages
4. Open an issue in the project repository with:
   - Ansible version (`ansible --version`)
   - The full error message
   - The relevant playbook or role task
   - The target OS and version
