# Changelog

All notable changes to the Terraform Multi-Cloud project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### Added

- Root Terraform module orchestrating AWS and Azure compute deployments.
- AWS compute module: EC2 instance with VPC, subnet, security group, EBS encryption, and IMDSv2 enforcement.
- Azure compute module: Linux VM with VNet, subnet, NSG, NIC, managed disk encryption, and SSH key authentication.
- Shared variables for environment, project name, regions, and instance specifications.
- Aggregated outputs exposing instance IDs, public IPs, and private IPs from both clouds.
- Provider configurations for AWS and AzureRM with version constraints.
- STRIDE threat model covering multi-cloud security risks.
- Architecture Decision Record (ADR-001) documenting the choice of Terraform for multi-cloud.
- Comprehensive README with deployment instructions and parity matrix.

## [0.2.0] - 2026-01-20

### Added

- Azure compute module with VNet, subnet, NSG, and Linux VM.
- Azure-specific variables and outputs.

### Changed

- Refactored root module to conditionally deploy to one or both clouds.

## [0.1.0] - 2026-01-10

### Added

- Initial AWS compute module with EC2, VPC, and security group.
- Root module scaffolding and variable definitions.
- Project directory structure and documentation templates.
