# =============================================================================
# Root Module Variables
# =============================================================================
# These variables provide a unified interface for configuring multi-cloud
# compute deployments. Cloud-specific defaults are set here; override them
# via terraform.tfvars, environment variables (TF_VAR_*), or CLI flags.
# =============================================================================

# -----------------------------------------------------------------------------
# General / Shared Variables
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, production)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "multicloud"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.project_name))
    error_message = "Project name must be lowercase alphanumeric with hyphens, 2-21 characters, starting with a letter."
  }
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key file for instance authentication"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into instances (restrict to your IP in production)"
  type        = string
  default     = "0.0.0.0/0"

  validation {
    condition     = can(cidrhost(var.allowed_ssh_cidr, 0))
    error_message = "allowed_ssh_cidr must be a valid CIDR block (e.g., 203.0.113.0/24)."
  }
}

# -----------------------------------------------------------------------------
# AWS-Specific Variables
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region for compute deployment"
  type        = string
  default     = "us-east-1"
}

variable "aws_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "aws_ami_id" {
  description = "AMI ID for the EC2 instance. Leave empty to use the latest Amazon Linux 2023 AMI."
  type        = string
  default     = ""
}

variable "aws_root_volume_size" {
  description = "Size of the root EBS volume in GB"
  type        = number
  default     = 20

  validation {
    condition     = var.aws_root_volume_size >= 8 && var.aws_root_volume_size <= 500
    error_message = "Root volume size must be between 8 and 500 GB."
  }
}

# -----------------------------------------------------------------------------
# Azure-Specific Variables
# -----------------------------------------------------------------------------

variable "azure_location" {
  description = "Azure region for compute deployment"
  type        = string
  default     = "eastus"
}

variable "azure_vm_size" {
  description = "Azure VM size"
  type        = string
  default     = "Standard_B1s"
}

variable "azure_os_disk_size_gb" {
  description = "Size of the OS managed disk in GB"
  type        = number
  default     = 30

  validation {
    condition     = var.azure_os_disk_size_gb >= 30 && var.azure_os_disk_size_gb <= 500
    error_message = "OS disk size must be between 30 and 500 GB."
  }
}

variable "azure_admin_username" {
  description = "Admin username for the Azure Linux VM"
  type        = string
  default     = "azureadmin"

  validation {
    condition     = !contains(["admin", "administrator", "root"], lower(var.azure_admin_username))
    error_message = "Admin username cannot be 'admin', 'administrator', or 'root'."
  }
}
