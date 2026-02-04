# =============================================================================
# P01 AWS Infrastructure - Root Module
# =============================================================================
# This is the root Terraform module that orchestrates the deployment of a
# production-ready AWS environment. It composes the following child modules:
#
#   - VPC:             Network foundation with public/private subnets across 2 AZs
#   - Security Groups: Layered, least-privilege firewall rules
#   - ALB:             Internet-facing Application Load Balancer with HTTPS
#   - ASG:             Auto Scaling Group with launch templates and scaling policies
#   - RDS:             PostgreSQL database with Multi-AZ, encryption, and backups
#   - S3:              Encrypted storage bucket with versioning and lifecycle rules
#
# Security philosophy:
#   Every resource follows the principle of least privilege. Traffic flows are
#   tightly scoped: Internet -> ALB -> App (private) -> RDS (private). No
#   resource in a private subnet has a direct internet-routable address.
# =============================================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ---------------------------------------------------------------------------
  # Backend configuration placeholder.
  # In production, uncomment and configure remote state with S3 + DynamoDB
  # locking to prevent concurrent modifications and provide state auditability.
  # ---------------------------------------------------------------------------
  # backend "s3" {
  #   bucket         = "my-terraform-state-bucket"
  #   key            = "p01-aws-infrastructure/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-lock"
  # }
}

provider "aws" {
  region = var.region

  # ---------------------------------------------------------------------------
  # Default tags applied to every resource created by this configuration.
  # This ensures consistent tagging for cost allocation, ownership tracking,
  # and compliance auditing without requiring each module to manage tags.
  # ---------------------------------------------------------------------------
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "Secure-Deployer/p01-aws-infrastructure"
    }
  }
}

# =============================================================================
# Data Sources
# =============================================================================
# Retrieve the list of available AZs in the target region so that we can
# distribute subnets across them for high availability. Using a data source
# rather than hard-coding AZ names keeps the configuration portable across
# regions.
# =============================================================================
data "aws_availability_zones" "available" {
  state = "available"

  # Exclude Local Zones and Wavelength Zones which have limited service support
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

# =============================================================================
# Module: VPC
# =============================================================================
# Creates the foundational network layer including:
#   - A VPC with DNS support enabled (required for RDS and internal resolution)
#   - Public subnets for the ALB and NAT Gateways
#   - Private subnets for application instances and RDS
#   - An Internet Gateway for public subnet egress
#   - A NAT Gateway so private instances can pull updates without exposure
#   - Route tables with explicit associations
# =============================================================================
module "vpc" {
  source = "./modules/vpc"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr

  # Select the first two availability zones for a balanced, multi-AZ deployment.
  # Two AZs provide fault tolerance while keeping costs manageable.
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)

  # Subnet CIDR blocks are carved from the VPC CIDR.
  # Public subnets use smaller /24 blocks (256 IPs) since they only host ALBs
  # and NAT Gateways. Private subnets use /20 blocks (4096 IPs) to accommodate
  # auto-scaled application instances and RDS.
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# =============================================================================
# Module: Security Groups
# =============================================================================
# Implements a layered security model:
#   - ALB SG: Allows inbound HTTP (80) and HTTPS (443) from the internet.
#             This is the ONLY entry point from the public internet.
#   - App SG: Allows inbound traffic ONLY from the ALB security group on the
#             application port. No direct internet access.
#   - RDS SG: Allows inbound traffic ONLY from the App security group on the
#             PostgreSQL port (5432). Database is fully isolated.
#
# This layered approach ensures that even if one tier is compromised, lateral
# movement is constrained by security group boundaries.
# =============================================================================
module "security_groups" {
  source = "./modules/security-groups"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
  app_port     = var.app_port
  db_port      = var.db_port
}

# =============================================================================
# Module: Application Load Balancer
# =============================================================================
# Deploys an internet-facing ALB in the public subnets with:
#   - An HTTPS listener (port 443) that terminates TLS at the load balancer
#   - An HTTP listener (port 80) that redirects to HTTPS
#   - A target group with health checks for the application instances
#   - Access logging to the S3 bucket for audit and debugging
#
# TLS termination at the ALB simplifies certificate management and offloads
# encryption overhead from application instances.
# =============================================================================
module "alb" {
  source = "./modules/alb"

  project_name    = var.project_name
  environment     = var.environment
  vpc_id          = module.vpc.vpc_id
  public_subnets  = module.vpc.public_subnet_ids
  security_groups = [module.security_groups.alb_sg_id]
  app_port        = var.app_port
  health_check_path = var.health_check_path
  certificate_arn   = var.certificate_arn

  # Enable access logging for compliance and forensic analysis
  enable_access_logs    = var.enable_alb_access_logs
  access_logs_bucket    = module.s3.bucket_id
  access_logs_prefix    = "alb-logs"
}

# =============================================================================
# Module: Auto Scaling Group
# =============================================================================
# Deploys compute capacity with automatic scaling:
#   - Launch template with hardened instance configuration
#   - ASG spanning private subnets in multiple AZs for fault tolerance
#   - Target tracking scaling policies based on CPU utilization
#   - CloudWatch alarms for operational visibility
#
# Using launch templates (not launch configurations) provides:
#   - Versioning support for safe rollbacks
#   - Mixed instance type support for cost optimization
#   - Network interface configuration for enhanced networking
# =============================================================================
module "asg" {
  source = "./modules/asg"

  project_name    = var.project_name
  environment     = var.environment
  ami_id          = var.ami_id
  instance_type   = var.instance_type
  key_name        = var.key_name
  security_groups = [module.security_groups.app_sg_id]
  subnets         = module.vpc.private_subnet_ids
  target_group_arns = [module.alb.target_group_arn]

  min_size         = var.asg_min_size
  max_size         = var.asg_max_size
  desired_capacity = var.asg_desired_capacity

  # Scaling thresholds tuned for production workloads.
  # Scale out aggressively (70% CPU) to maintain responsiveness.
  # Scale in conservatively (30% CPU) to avoid flapping.
  cpu_target_value = var.cpu_target_value
}

# =============================================================================
# Module: RDS (PostgreSQL)
# =============================================================================
# Deploys a managed PostgreSQL database with enterprise features:
#   - Multi-AZ deployment for automatic failover (RPO ~ 0, RTO < 2 min)
#   - Storage encryption at rest using AWS KMS
#   - Automated backups with configurable retention (default: 7 days)
#   - Deployed in private subnets with no public accessibility
#   - Deletion protection enabled to prevent accidental data loss
#
# PostgreSQL was chosen for its mature ecosystem, strong ACID compliance,
# and excellent support for JSON data types. See ADR-002 for details.
# =============================================================================
module "rds" {
  source = "./modules/rds"

  project_name = var.project_name
  environment  = var.environment

  # Network isolation: RDS is placed in private subnets and its security group
  # only allows connections from the application security group.
  subnet_ids      = module.vpc.private_subnet_ids
  security_groups = [module.security_groups.rds_sg_id]
  vpc_id          = module.vpc.vpc_id

  # Database configuration
  engine_version    = var.db_engine_version
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  db_name           = var.db_name
  db_username       = var.db_username
  db_port           = var.db_port

  # High availability and durability settings
  multi_az              = var.db_multi_az
  backup_retention_period = var.db_backup_retention_period

  # Security: encryption at rest is non-negotiable for production data
  storage_encrypted = true
}

# =============================================================================
# Module: S3
# =============================================================================
# Creates an encrypted S3 bucket with defense-in-depth:
#   - Server-side encryption with AES-256 (SSE-S3) by default
#   - Versioning enabled to protect against accidental deletion or overwrites
#   - Public access block on all four dimensions (ACLs, policies, etc.)
#   - Lifecycle rules to transition old objects to cheaper storage classes
#   - Bucket policy enforcing TLS-only access
#
# This bucket serves dual purposes:
#   1. ALB access log storage (for audit/compliance)
#   2. Application asset storage
# =============================================================================
module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
  bucket_name  = var.s3_bucket_name

  # Lifecycle configuration to manage storage costs over time.
  # Objects transition to Infrequent Access after 30 days and to Glacier
  # after 90 days. Objects are expired after 365 days.
  enable_lifecycle_rules = true
  transition_ia_days     = 30
  transition_glacier_days = 90
  expiration_days        = 365

  # Force-destroy is disabled in production to prevent accidental data loss.
  # Enable only in development/testing environments.
  force_destroy = var.environment != "production"
}
