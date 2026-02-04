# P01 AWS Infrastructure

Production-ready AWS infrastructure deployed with modular Terraform. This project provisions a highly available, secure, and scalable environment following AWS Well-Architected Framework principles.

## Architecture

```
                         Internet
                            |
                     +------+------+
                     | Route 53    |
                     +------+------+
                            |
                     +------+------+
                     | ACM (TLS)   |
                     +------+------+
                            |
+-----------------------------------------------------------+
|  VPC (10.0.0.0/16)                                        |
|                                                           |
|  +-------------------+       +-------------------+        |
|  | Public Subnet AZ-a|       | Public Subnet AZ-b|        |
|  | 10.0.1.0/24       |       | 10.0.2.0/24       |        |
|  |                   |       |                   |        |
|  |  +-------------+  |       |  +-------------+  |        |
|  |  |     ALB     |<-+-------+->|     ALB     |  |        |
|  |  +------+------+  |       |  +------+------+  |        |
|  |  | NAT Gateway |  |       |                   |        |
|  +--+------+------+--+       +-------------------+        |
|            |                          |                    |
|  +---------+--------+       +--------+---------+          |
|  | Private Subnet    |       | Private Subnet    |         |
|  | AZ-a 10.0.16.0/20|       | AZ-b 10.0.32.0/20|         |
|  |                   |       |                   |         |
|  | +------+ +-----+ |       | +------+ +-----+ |         |
|  | | ASG  | | RDS | |       | | ASG  | | RDS | |         |
|  | |(App) | |(Pri) | |       | |(App) | |(Stb) | |         |
|  | +------+ +-----+ |       | +------+ +-----+ |         |
|  +-------------------+       +-------------------+         |
|                                                           |
|  +-----------------------------------------------------+  |
|  |                    S3 Bucket                         |  |
|  |  (ALB access logs, application assets, encrypted)   |  |
|  +-----------------------------------------------------+  |
+-----------------------------------------------------------+
```

### Traffic Flow

1. Clients connect via HTTPS (port 443) to the Application Load Balancer.
2. HTTP requests (port 80) are automatically redirected to HTTPS.
3. The ALB terminates TLS and forwards traffic to application instances in private subnets on the configured application port.
4. Application instances connect to the RDS PostgreSQL database on port 5432.
5. All outbound traffic from private subnets routes through the NAT Gateway.

## Modules

| Module | Description |
|--------|-------------|
| [`vpc`](./modules/vpc/) | VPC with multi-AZ public/private subnets, Internet Gateway, NAT Gateway, route tables, and VPC Flow Logs |
| [`security-groups`](./modules/security-groups/) | Three-tier security group architecture (ALB, App, RDS) enforcing least-privilege network access |
| [`alb`](./modules/alb/) | Internet-facing Application Load Balancer with HTTPS listener, HTTP-to-HTTPS redirect, target group, and access logging |
| [`asg`](./modules/asg/) | Auto Scaling Group with launch templates, target tracking scaling policies, instance refresh, and CloudWatch alarms |
| [`rds`](./modules/rds/) | Multi-AZ PostgreSQL RDS instance with encryption at rest, automated backups, Performance Insights, and storage autoscaling |
| [`s3`](./modules/s3/) | Encrypted S3 bucket with versioning, public access block, lifecycle rules, and TLS-only bucket policy |

## Prerequisites

- **Terraform** >= 1.5 ([installation guide](https://developer.hashicorp.com/terraform/install))
- **AWS CLI** v2 configured with appropriate credentials ([installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- **AWS Account** with permissions to create VPC, EC2, RDS, S3, ELB, IAM, and CloudWatch resources
- **ACM Certificate** (optional but recommended) for HTTPS on the ALB
- **EC2 Key Pair** (optional) if SSH access is required; SSM Session Manager is preferred

## Usage

### 1. Clone and configure

```bash
cd p01-aws-infrastructure
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your environment-specific values. For sensitive values, use environment variables:

```bash
export TF_VAR_db_username="admin"
export TF_VAR_certificate_arn="arn:aws:acm:us-east-1:123456789012:certificate/abc-123"
```

### 2. Initialize Terraform

```bash
terraform init
```

This downloads the AWS provider and initializes all modules.

### 3. Review the execution plan

```bash
terraform plan -out=tfplan
```

Carefully review the plan output to verify the resources that will be created.

### 4. Apply the configuration

```bash
terraform apply tfplan
```

### 5. Verify outputs

```bash
terraform output
```

Key outputs include the ALB DNS name, RDS endpoint, and S3 bucket name.

### Remote State (recommended for teams)

Uncomment the backend configuration in `main.tf` and configure an S3 bucket with DynamoDB locking:

```hcl
backend "s3" {
  bucket         = "my-terraform-state-bucket"
  key            = "p01-aws-infrastructure/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "terraform-lock"
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `region` | AWS region for resource deployment | `string` | `"us-east-1"` | no |
| `environment` | Deployment environment (development, staging, production) | `string` | `"production"` | no |
| `project_name` | Project identifier used as resource name prefix | `string` | `"p01-infra"` | no |
| `vpc_cidr` | CIDR block for the VPC | `string` | `"10.0.0.0/16"` | no |
| `public_subnet_cidrs` | CIDR blocks for public subnets (one per AZ) | `list(string)` | `["10.0.1.0/24", "10.0.2.0/24"]` | no |
| `private_subnet_cidrs` | CIDR blocks for private subnets (one per AZ) | `list(string)` | `["10.0.16.0/20", "10.0.32.0/20"]` | no |
| `ami_id` | AMI ID for EC2 instances in the ASG | `string` | n/a | **yes** |
| `instance_type` | EC2 instance type for application servers | `string` | `"t3.medium"` | no |
| `key_name` | EC2 key pair name for SSH access (empty to disable) | `string` | `""` | no |
| `app_port` | Application listener port | `number` | `8080` | no |
| `health_check_path` | HTTP path for ALB health checks | `string` | `"/health"` | no |
| `asg_min_size` | Minimum number of instances in the ASG | `number` | `2` | no |
| `asg_max_size` | Maximum number of instances the ASG can scale to | `number` | `6` | no |
| `asg_desired_capacity` | Initial desired instance count | `number` | `2` | no |
| `cpu_target_value` | Target CPU utilization for scaling policy (%) | `number` | `70.0` | no |
| `db_engine_version` | PostgreSQL engine version | `string` | `"15.4"` | no |
| `db_instance_class` | RDS instance class | `string` | `"db.t3.medium"` | no |
| `db_allocated_storage` | RDS allocated storage in GiB | `number` | `50` | no |
| `db_name` | Default database name | `string` | `"appdb"` | no |
| `db_username` | RDS master username (sensitive) | `string` | n/a | **yes** |
| `db_port` | PostgreSQL port | `number` | `5432` | no |
| `db_multi_az` | Enable Multi-AZ for RDS | `bool` | `true` | no |
| `db_backup_retention_period` | Backup retention in days (1-35) | `number` | `7` | no |
| `s3_bucket_name` | Globally unique S3 bucket name | `string` | n/a | **yes** |
| `certificate_arn` | ACM certificate ARN for HTTPS | `string` | `""` | no |
| `enable_alb_access_logs` | Enable ALB access logging to S3 | `bool` | `true` | no |

## Outputs

| Name | Description |
|------|-------------|
| `vpc_id` | ID of the VPC |
| `public_subnet_ids` | List of public subnet IDs |
| `private_subnet_ids` | List of private subnet IDs |
| `alb_dns_name` | DNS name of the Application Load Balancer |
| `alb_zone_id` | Canonical hosted zone ID of the ALB |
| `alb_arn` | ARN of the Application Load Balancer |
| `rds_endpoint` | Connection endpoint for the RDS instance (sensitive) |
| `rds_instance_id` | Identifier of the RDS instance |
| `s3_bucket_name` | Name of the S3 bucket |
| `s3_bucket_arn` | ARN of the S3 bucket |
| `alb_security_group_id` | ID of the ALB security group |
| `app_security_group_id` | ID of the application security group |
| `rds_security_group_id` | ID of the RDS security group |

## Security Considerations

### Network Isolation

- Application instances and RDS are deployed in **private subnets** with no direct internet access.
- The ALB is the **sole internet-facing entry point**, placed in public subnets.
- All inter-tier communication uses **security group references** (not CIDRs), ensuring rules adapt to IP changes automatically.

### Encryption

- **In transit**: TLS termination at the ALB with ACM-managed certificates. The S3 bucket policy denies non-SSL requests.
- **At rest**: RDS storage encryption using AWS KMS. S3 server-side encryption with AES-256.
- **EBS volumes**: Encrypted by default on ASG launch templates.

### Access Control

- **No SSH access by default**: Use AWS Systems Manager Session Manager for interactive access, providing IAM-based authentication and full CloudTrail audit trails.
- **Least privilege security groups**: Each tier allows only the minimum required ports from specific source security groups.
- **S3 public access block**: All four public access block settings are enabled, preventing accidental public exposure.

### Monitoring and Audit

- **VPC Flow Logs**: All network traffic (accepted and rejected) is logged to CloudWatch.
- **ALB Access Logs**: HTTP request logs stored in S3 for forensic analysis.
- **RDS Performance Insights**: Database performance monitoring enabled.
- **Default resource tags**: All resources are tagged with project, environment, and management metadata.

### Backup and Recovery

- **RDS automated backups**: 7-day retention with point-in-time recovery capability.
- **RDS Multi-AZ**: Automatic failover to a standby instance in a different AZ (RPO ~0, RTO <2 minutes).
- **S3 versioning**: Object versioning protects against accidental deletion or overwriting.

## Cost Estimation

The following provides a rough monthly cost estimate for this infrastructure running in `us-east-1` with default settings. Actual costs depend on usage, data transfer, and reserved instance commitments.

| Resource | Configuration | Estimated Monthly Cost |
|----------|--------------|----------------------|
| NAT Gateway | 1 gateway + data processing | ~$32 + data charges |
| ALB | 1 load balancer + LCU charges | ~$16 + usage |
| EC2 (ASG) | 2x t3.medium (on-demand) | ~$60 |
| RDS | db.t3.medium, Multi-AZ, 50 GiB | ~$70 |
| S3 | Standard storage + requests | ~$1-5 |
| CloudWatch | VPC Flow Logs, metrics | ~$5-10 |
| Elastic IP | 1 EIP (attached to NAT GW) | $0 (attached) |
| **Total (estimate)** | | **~$185-195/month** |

**Cost optimization tips:**
- Use Reserved Instances or Savings Plans for predictable EC2 and RDS workloads (up to 72% savings).
- Consider a single-AZ RDS deployment for non-production environments.
- Review NAT Gateway data processing charges and consider VPC endpoints for AWS service traffic.
- Use Spot Instances in the ASG for fault-tolerant workloads.

## Architecture Decision Records

- [ADR-001: Modular Terraform Structure](./docs/adr/001-modular-terraform-structure.md)
- [ADR-002: Use PostgreSQL for RDS](./docs/adr/002-use-postgresql-for-rds.md)
- [ADR-003: Use Launch Templates for ASG](./docs/adr/003-use-launch-templates-for-asg.md)

## Additional Documentation

- [Threat Model (STRIDE)](./docs/threat-model.md)
- [Changelog](./CHANGELOG.md)

## License

This project is part of the Secure-Deployer portfolio. See the repository root for license details.
