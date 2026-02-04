# Security Groups Module

## Overview

This module implements a three-tier security group architecture that enforces the principle of least privilege at the network layer. Each tier can only communicate with its adjacent tiers.

## Architecture

```
  Internet
     |
     v
+----+-----+     +----------+     +---------+
| ALB SG   | --> | App SG   | --> | RDS SG  |
| 80, 443  |     | app_port |     | 5432    |
+----------+     +----------+     +---------+
```

## Security Model

### ALB Security Group
- **Ingress**: HTTP (80) and HTTPS (443) from `0.0.0.0/0` and `::/0`
- **Egress**: Application port to App SG only
- **Rationale**: The ALB is the sole internet entry point. HTTP is allowed for redirect to HTTPS.

### Application Security Group
- **Ingress**: Application port from ALB SG only
- **Egress**: HTTPS (443) to internet (via NAT), PostgreSQL port to RDS SG
- **Rationale**: No direct internet access. No SSH (use SSM Session Manager instead).

### RDS Security Group
- **Ingress**: PostgreSQL port from App SG only
- **Egress**: None (RDS does not initiate outbound connections)
- **Rationale**: Maximum isolation for the data tier.

## Resources Created

| Resource | Description |
|----------|-------------|
| `aws_security_group.alb` | ALB security group |
| `aws_security_group.app` | Application security group |
| `aws_security_group.rds` | RDS security group |
| `aws_security_group_rule` (x7) | Individual ingress/egress rules |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `project_name` | Project name for resource naming | `string` | n/a | yes |
| `environment` | Environment name | `string` | n/a | yes |
| `vpc_id` | VPC ID for security group creation | `string` | n/a | yes |
| `app_port` | Application listener port | `number` | `8080` | no |
| `db_port` | PostgreSQL port | `number` | `5432` | no |

## Outputs

| Name | Description |
|------|-------------|
| `alb_sg_id` | ALB security group ID |
| `app_sg_id` | Application security group ID |
| `rds_sg_id` | RDS security group ID |
| `alb_sg_arn` | ALB security group ARN |
| `app_sg_arn` | Application security group ARN |
| `rds_sg_arn` | RDS security group ARN |

## Security Considerations

- **No CIDR-based inter-tier rules**: All inter-tier rules use security group references, which automatically adapt to IP changes.
- **No SSH access**: Use AWS Systems Manager Session Manager for interactive access, providing IAM-based auth and full audit trails.
- **Minimal egress**: Application egress is limited to HTTPS (external APIs) and PostgreSQL (database). RDS has no egress rules.
- **IPv6 support**: ALB ingress rules include IPv6 CIDR blocks for clients connecting over IPv6.
