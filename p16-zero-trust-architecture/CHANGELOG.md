# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-15

### Added

- VPC module with four subnet tiers: public, private-app, private-data, and management.
- Separate route tables per subnet tier with isolated routing.
- NAT gateway for controlled outbound internet access from private subnets.
- Micro-segmented security groups enforcing least-privilege traffic flows.
- Network ACLs providing subnet-level defense in depth.
- VPC gateway endpoints for S3 and DynamoDB.
- VPC interface endpoints for SSM, SSM Messages, EC2 Messages, CloudWatch Logs, STS, and Secrets Manager.
- Private DNS enabled on all interface endpoints.
- Comprehensive documentation including threat model and ADR.
- STRIDE-based threat model covering lateral movement, identity spoofing, policy bypass, and insider threats.
