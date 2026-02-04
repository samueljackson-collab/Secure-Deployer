# =============================================================================
# P01 AWS Infrastructure - Root Variables
# =============================================================================
# This file defines all input variables for the root module. Variables are
# organized by functional area (general, network, compute, database, storage)
# to improve readability and maintenance.
#
# Security note: Sensitive variables (db_username, etc.) should NEVER be
# committed to version control. Use terraform.tfvars (gitignored), environment
# variables (TF_VAR_*), or a secrets manager like HashiCorp Vault.
# =============================================================================

# -----------------------------------------------------------------------------
# General / Project-wide Settings
# -----------------------------------------------------------------------------

variable "region" {
  description = "AWS region where all resources will be deployed. Choose a region close to your users for lower latency."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.region))
    error_message = "Region must be a valid AWS region identifier (e.g., us-east-1, eu-west-2)."
  }
}

variable "environment" {
  description = "Deployment environment name. Used in resource naming, tagging, and conditional logic (e.g., multi-AZ only in production)."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "project_name" {
  description = "Project identifier used as a prefix for all resource names. Keeps resources organized in shared AWS accounts."
  type        = string
  default     = "p01-infra"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

# -----------------------------------------------------------------------------
# Network / VPC Settings
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Use a /16 block for production to allow room for growth. RFC 1918 private ranges recommended."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ). These host ALBs and NAT Gateways. Use smaller blocks since these contain fewer resources."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) >= 2
    error_message = "At least 2 public subnet CIDRs are required for multi-AZ deployment."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ). These host application instances and RDS. Use larger blocks to accommodate auto-scaling."
  type        = list(string)
  default     = ["10.0.16.0/20", "10.0.32.0/20"]

  validation {
    condition     = length(var.private_subnet_cidrs) >= 2
    error_message = "At least 2 private subnet CIDRs are required for multi-AZ deployment."
  }
}

# -----------------------------------------------------------------------------
# Compute / ASG Settings
# -----------------------------------------------------------------------------

variable "ami_id" {
  description = "AMI ID for EC2 instances in the Auto Scaling Group. Use a hardened, CIS-benchmarked AMI for production."
  type        = string

  validation {
    condition     = can(regex("^ami-[a-f0-9]{8,17}$", var.ami_id))
    error_message = "AMI ID must be a valid AWS AMI identifier (e.g., ami-0abcdef1234567890)."
  }
}

variable "instance_type" {
  description = "EC2 instance type for application servers. Size based on load testing results."
  type        = string
  default     = "t3.medium"
}

variable "key_name" {
  description = "Name of an existing EC2 key pair for SSH access. Leave empty to disable SSH (recommended for production; use SSM Session Manager instead)."
  type        = string
  default     = ""
}

variable "app_port" {
  description = "Port on which the application listens. The ALB forwards traffic to this port on the target group."
  type        = number
  default     = 8080

  validation {
    condition     = var.app_port > 0 && var.app_port <= 65535
    error_message = "Application port must be between 1 and 65535."
  }
}

variable "health_check_path" {
  description = "HTTP path for ALB health checks. The application must return 200 OK on this path when healthy."
  type        = string
  default     = "/health"
}

variable "asg_min_size" {
  description = "Minimum number of instances in the ASG. Set to at least 2 in production for high availability."
  type        = number
  default     = 2

  validation {
    condition     = var.asg_min_size >= 1
    error_message = "Minimum ASG size must be at least 1."
  }
}

variable "asg_max_size" {
  description = "Maximum number of instances the ASG can scale to. Set based on capacity planning and cost constraints."
  type        = number
  default     = 6

  validation {
    condition     = var.asg_max_size >= 1
    error_message = "Maximum ASG size must be at least 1."
  }
}

variable "asg_desired_capacity" {
  description = "Initial desired number of instances in the ASG. Auto-scaling will adjust this based on demand."
  type        = number
  default     = 2
}

variable "cpu_target_value" {
  description = "Target CPU utilization percentage for the ASG target tracking policy. Lower values provide more headroom but increase cost."
  type        = number
  default     = 70.0

  validation {
    condition     = var.cpu_target_value > 0 && var.cpu_target_value <= 100
    error_message = "CPU target value must be between 1 and 100."
  }
}

# -----------------------------------------------------------------------------
# Database / RDS Settings
# -----------------------------------------------------------------------------

variable "db_engine_version" {
  description = "PostgreSQL engine version. Use the latest stable major version for security patches and features."
  type        = string
  default     = "15.4"
}

variable "db_instance_class" {
  description = "RDS instance class. Size based on expected query load and connection count. Use memory-optimized (r6g) for read-heavy workloads."
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GiB for the RDS instance. RDS supports storage auto-scaling, but set an appropriate baseline."
  type        = number
  default     = 50

  validation {
    condition     = var.db_allocated_storage >= 20
    error_message = "Minimum allocated storage for RDS is 20 GiB."
  }
}

variable "db_name" {
  description = "Name of the default database to create on the RDS instance."
  type        = string
  default     = "appdb"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores."
  }
}

variable "db_username" {
  description = "Master username for the RDS instance. NEVER commit this value to version control. Use TF_VAR_db_username environment variable or a secrets manager."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_username) >= 1 && length(var.db_username) <= 63
    error_message = "Database username must be between 1 and 63 characters."
  }
}

variable "db_port" {
  description = "Port for PostgreSQL connections. Using the default port (5432) is acceptable when combined with security group restrictions."
  type        = number
  default     = 5432
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment for RDS. Provides automatic failover to a standby in a different AZ. Always enable for production."
  type        = bool
  default     = true
}

variable "db_backup_retention_period" {
  description = "Number of days to retain automated RDS backups. Minimum 7 days recommended for production. Maximum is 35 days."
  type        = number
  default     = 7

  validation {
    condition     = var.db_backup_retention_period >= 1 && var.db_backup_retention_period <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

# -----------------------------------------------------------------------------
# Storage / S3 Settings
# -----------------------------------------------------------------------------

variable "s3_bucket_name" {
  description = "Globally unique name for the S3 bucket. Must comply with S3 naming rules. Include account ID or random suffix for uniqueness."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.s3_bucket_name))
    error_message = "S3 bucket name must be 3-63 characters, lowercase, and comply with S3 naming rules."
  }
}

# -----------------------------------------------------------------------------
# TLS / Certificate Settings
# -----------------------------------------------------------------------------

variable "certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS on the ALB. Must be a validated certificate in the same region as the ALB."
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Observability Settings
# -----------------------------------------------------------------------------

variable "enable_alb_access_logs" {
  description = "Enable ALB access logging to S3. Recommended for production for audit, debugging, and compliance."
  type        = bool
  default     = true
}
