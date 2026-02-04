# P16: Zero Trust Architecture

## Overview

This project implements a **Zero Trust Network Architecture** on AWS using Terraform. The core principle is **"Never Trust, Always Verify"** -- every network request is treated as potentially hostile regardless of its origin, even if it originates from within the corporate perimeter.

Traditional perimeter-based security assumes that anything inside the network is trusted. Zero Trust eliminates this assumption by enforcing strict identity verification and least-privilege access at every layer.

## Zero Trust Principles

1. **Never Trust, Always Verify** -- Authenticate and authorize every request regardless of source location.
2. **Least Privilege Access** -- Grant only the minimum permissions required for each workload.
3. **Assume Breach** -- Design the architecture so that a compromise of one component does not grant access to others.
4. **Micro-Segmentation** -- Isolate workloads into fine-grained network segments with explicit allow rules.
5. **Continuous Monitoring** -- Log and inspect all traffic for anomalies and policy violations.

## Architecture Diagram

```
                        Internet
                            |
                     [ ALB (Public) ]
                            |
               +------------+------------+
               |    Public Subnet Tier   |
               |  (NACL: 443/80 only)   |
               +------------+------------+
                            |
                   Security Group: web_sg
                   (443 from ALB only)
                            |
               +------------+------------+
               |  Private-App Subnet Tier|
               |  (NACL: from public     |
               |   CIDR only)            |
               +------------+------------+
                            |
                   Security Group: app_sg
                   (8080 from web_sg only)
                            |
               +------------+------------+
               | Private-Data Subnet Tier|
               | (NACL: 5432/3306 from   |
               |  app CIDR only)         |
               +------------+------------+
                            |
                   Security Group: data_sg
                   (5432 from app_sg only)

               +------------+------------+
               |  Management Subnet Tier |
               |  (NACL: SSH from corp   |
               |   CIDR only)            |
               +------------+------------+
                            |
                   Security Group: bastion_sg
                   (22 from mgmt CIDR only)

        [ VPC Endpoints ]
        S3, DynamoDB (Gateway)
        SSM, CloudWatch, STS, Secrets Manager (Interface)
        -- No internet traversal for AWS API calls --
```

## Network Micro-Segmentation

Traffic flows are explicitly allowed only between adjacent tiers:

| Source Tier    | Destination Tier | Allowed Ports | Enforcement        |
|----------------|-----------------|---------------|--------------------|
| ALB            | Web             | 443           | Security Group     |
| Web            | App             | 8080          | Security Group     |
| App            | Data            | 5432          | Security Group     |
| Management     | Bastion         | 22            | Security Group     |

All other traffic is **denied by default**. Network ACLs provide a secondary layer of defense at the subnet level.

## VPC Endpoints

VPC endpoints ensure that traffic to AWS services (S3, DynamoDB, SSM, CloudWatch Logs, STS, Secrets Manager) remains on the AWS backbone network and never traverses the public internet. This eliminates an entire class of data exfiltration vectors.

## Modules

| Module             | Purpose                                          |
|--------------------|--------------------------------------------------|
| `modules/vpc`      | VPC with four subnet tiers and isolated routing  |
| `modules/security-groups` | Micro-segmented security groups            |
| `modules/nacls`    | Network ACLs per subnet tier                     |
| `modules/vpc-endpoints` | Gateway and Interface VPC endpoints          |

## Deployment

### Prerequisites

- Terraform >= 1.5
- AWS CLI configured with appropriate credentials
- AWS provider ~> 5.0

### Steps

```bash
# Initialize Terraform
terraform init

# Review the execution plan
terraform plan -var-file="environments/production.tfvars"

# Apply the configuration
terraform apply -var-file="environments/production.tfvars"
```

### Example Variables

```hcl
region             = "us-east-1"
environment        = "production"
project_name       = "zero-trust"
vpc_cidr           = "10.0.0.0/16"
private_app_cidrs  = ["10.0.10.0/24", "10.0.11.0/24"]
private_data_cidrs = ["10.0.20.0/24", "10.0.21.0/24"]
management_cidrs   = ["10.0.30.0/24"]
```

## References

- [NIST SP 800-207: Zero Trust Architecture](https://csrc.nist.gov/publications/detail/sp/800-207/final)
- [AWS Well-Architected Framework -- Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/)
- [CISA Zero Trust Maturity Model](https://www.cisa.gov/zero-trust-maturity-model)
