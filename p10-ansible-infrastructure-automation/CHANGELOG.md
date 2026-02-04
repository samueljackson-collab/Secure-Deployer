# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### Added

- Initial release of the Ansible Infrastructure Automation project.
- **security-base role**: SSH hardening, UFW firewall management, fail2ban installation and configuration, sysctl kernel hardening, audit logging with auditd, root login disabling, and password policy enforcement.
- **nginx role**: Nginx installation and configuration, SSL/TLS support, virtual host deployment, security headers, worker process tuning.
- **database role**: PostgreSQL installation and configuration, pg_hba.conf management, streaming replication setup, database and user creation, automated backup scheduling.
- **application role**: Application user creation, code deployment, dependency installation, systemd service management, health check verification.
- **monitoring-agent role**: Prometheus node_exporter installation, scrape configuration, log forwarding setup.
- **Playbooks**: site.yml master playbook, webservers.yml, databases.yml, security-hardening.yml, monitoring.yml, deploy-application.yml, rolling_update.yml, disaster_recovery.yml.
- **Molecule tests**: Docker-based test suites for all roles with converge and verify steps.
- **Documentation**: Comprehensive README, threat model, ADR for Ansible selection, getting started guide, security practices, troubleshooting guide.
- **Ansible Vault integration**: Encrypted secrets management for credentials and certificates.
- **Rolling update support**: Zero-downtime deployments with serial execution and health checks.
- **Disaster recovery playbook**: Automated backup restoration and failover procedures.
