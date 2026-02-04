# VPC Module

## Overview

This module creates a production-ready Virtual Private Cloud (VPC) with a multi-AZ network topology. It establishes the network foundation for all other infrastructure modules.

## Architecture

```
                        Internet
                           |
                    +------+------+
                    | Internet GW |
                    +------+------+
                           |
          +----------------+----------------+
          |                                 |
  +-------+--------+             +---------+------+
  | Public Subnet  |             | Public Subnet  |
  | AZ-a           |             | AZ-b           |
  | - ALB nodes    |             | - ALB nodes    |
  | - NAT Gateway  |             |                |
  +-------+--------+             +--------+-------+
          |                                |
     +----+----+                           |
     | NAT GW  |                           |
     +----+----+                           |
          |                                |
  +-------+--------+             +---------+------+
  | Private Subnet |             | Private Subnet |
  | AZ-a           |             | AZ-b           |
  | - App instances|             | - App instances|
  | - RDS primary  |             | - RDS standby  |
  +----------------+             +----------------+
```

## Resources Created

| Resource | Description |
|----------|-------------|
| `aws_vpc` | VPC with DNS support enabled |
| `aws_internet_gateway` | Internet gateway for public subnet routing |
| `aws_subnet` (public) | Public subnets across 2 AZs |
| `aws_subnet` (private) | Private subnets across 2 AZs |
| `aws_eip` | Elastic IP for NAT Gateway |
| `aws_nat_gateway` | NAT gateway for private subnet outbound access |
| `aws_route_table` (public) | Route table with IGW route |
| `aws_route_table` (private) | Route table with NAT GW route |
| `aws_flow_log` | VPC Flow Logs for traffic monitoring |
| `aws_cloudwatch_log_group` | Log group for flow logs |
| `aws_iam_role` | IAM role for flow log delivery |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `project_name` | Project name for resource naming | `string` | n/a | yes |
| `environment` | Environment name | `string` | n/a | yes |
| `vpc_cidr` | VPC CIDR block | `string` | n/a | yes |
| `availability_zones` | List of AZs (minimum 2) | `list(string)` | n/a | yes |
| `public_subnet_cidrs` | Public subnet CIDR blocks | `list(string)` | n/a | yes |
| `private_subnet_cidrs` | Private subnet CIDR blocks | `list(string)` | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| `vpc_id` | ID of the VPC |
| `vpc_cidr` | CIDR block of the VPC |
| `public_subnet_ids` | List of public subnet IDs |
| `private_subnet_ids` | List of private subnet IDs |
| `internet_gateway_id` | ID of the Internet Gateway |
| `nat_gateway_id` | ID of the NAT Gateway |
| `nat_gateway_public_ip` | Public IP of the NAT Gateway |
| `public_route_table_id` | ID of the public route table |
| `private_route_table_id` | ID of the private route table |

## Security Considerations

- **No public IPs on private subnets**: `map_public_ip_on_launch` is explicitly `false` for private subnets as a defense-in-depth measure.
- **VPC Flow Logs enabled**: All traffic (accepted and rejected) is logged to CloudWatch for audit and incident investigation.
- **Single NAT Gateway**: Cost-optimized for most workloads. For mission-critical production environments, deploy one NAT Gateway per AZ to eliminate the NAT GW as a single point of failure.
- **DNS support**: Both `enable_dns_support` and `enable_dns_hostnames` are enabled, which is required for RDS endpoints and internal service discovery.
