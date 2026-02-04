# VPC Module

## Purpose

Creates a production-grade AWS VPC with public and private subnets, an Internet Gateway, a NAT Gateway, separate route tables, and VPC Flow Logs. This module provides the foundational networking layer for the hybrid cloud architecture.

Private subnets are designed to receive on-premises traffic via a Virtual Private Gateway (VGW), while the NAT Gateway enables outbound internet access without exposing private resources.

## Architecture

```
                     Internet
                        |
                 [ Internet GW ]
                   /         \
          [ Public-1a ]  [ Public-1b ]     <- Public Subnets
                |
           [ NAT GW ]
              / \
    [ Private-1a ]  [ Private-1b ]         <- Private Subnets
          |              |
    [ Private RT-1a ] [ Private RT-1b ]    <- Route Tables (VGW propagation)
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `vpc_cidr` | CIDR block for the VPC | `string` | n/a | yes |
| `vpc_name` | Name prefix for VPC and related resources | `string` | n/a | yes |
| `environment` | Deployment environment | `string` | n/a | yes |
| `availability_zones` | List of AZs for subnet placement | `list(string)` | n/a | yes |
| `public_subnet_cidrs` | CIDR blocks for public subnets | `list(string)` | n/a | yes |
| `private_subnet_cidrs` | CIDR blocks for private subnets | `list(string)` | n/a | yes |
| `enable_dns_support` | Enable DNS support in VPC | `bool` | `true` | no |
| `enable_dns_hostnames` | Enable DNS hostnames in VPC | `bool` | `true` | no |
| `tags` | Tags to apply to all resources | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `vpc_id` | ID of the VPC |
| `vpc_cidr` | CIDR block of the VPC |
| `public_subnet_ids` | List of public subnet IDs |
| `private_subnet_ids` | List of private subnet IDs |
| `public_route_table_id` | ID of the public route table |
| `private_route_table_ids` | List of private route table IDs |
| `nat_gateway_id` | ID of the NAT Gateway |
| `nat_gateway_public_ip` | Public IP of the NAT Gateway |
| `internet_gateway_id` | ID of the Internet Gateway |

## Usage Example

```hcl
module "vpc" {
  source = "./modules/vpc"

  vpc_cidr             = "10.0.0.0/16"
  vpc_name             = "hybrid-network"
  environment          = "production"
  availability_zones   = ["us-east-1a", "us-east-1b"]
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]

  tags = {
    Owner = "platform-team"
  }
}
```

## Security Considerations

- **VPC Flow Logs** are enabled by default and sent to CloudWatch with 30-day retention. These capture all traffic metadata for security analysis, incident response, and compliance auditing.
- **Private subnets** do not assign public IPs. Outbound internet access is routed through the NAT Gateway, preventing direct inbound connections.
- **DNS hostnames** are enabled to support internal service discovery and VPC endpoint resolution.
- The NAT Gateway EIP provides a stable egress IP that can be allow-listed in on-premises firewalls.
- Consider deploying one NAT Gateway per AZ for high availability in production workloads.
