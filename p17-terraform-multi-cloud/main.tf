# =============================================================================
# Root Module: Multi-Cloud Compute Deployment
# =============================================================================
#
# This root module orchestrates compute infrastructure across AWS and Azure.
# It calls provider-specific child modules and aggregates their outputs into
# a unified interface.
#
# Usage:
#   terraform init
#   terraform plan -var="environment=staging" -var="project_name=myapp"
#   terraform apply -var="environment=staging" -var="project_name=myapp"
# =============================================================================

# -----------------------------------------------------------------------------
# Common local values shared across both cloud modules
# -----------------------------------------------------------------------------
locals {
  # Standard tags applied to all resources in both clouds
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Repository  = "p17-terraform-multi-cloud"
  }

  # Resource name prefix for consistent naming across clouds
  name_prefix = "${var.project_name}-${var.environment}"
}

# -----------------------------------------------------------------------------
# AWS Compute Module
# -----------------------------------------------------------------------------
# Deploys an EC2 instance inside a dedicated VPC with:
# - Public subnet with internet gateway
# - Security group restricting inbound to SSH only
# - EBS encryption enabled
# - IMDSv2 enforced to prevent SSRF-based credential theft
# -----------------------------------------------------------------------------
module "aws_compute" {
  source = "./modules/aws-compute"

  name_prefix       = local.name_prefix
  environment       = var.environment
  aws_region        = var.aws_region
  instance_type     = var.aws_instance_type
  ami_id            = var.aws_ami_id
  ssh_public_key    = file(var.ssh_public_key_path)
  allowed_ssh_cidr  = var.allowed_ssh_cidr
  root_volume_size  = var.aws_root_volume_size
  tags              = local.common_tags
}

# -----------------------------------------------------------------------------
# Azure Compute Module
# -----------------------------------------------------------------------------
# Deploys a Linux VM inside a dedicated resource group with:
# - Virtual network and subnet
# - Network security group restricting inbound to SSH only
# - Network interface with public IP
# - Managed disk encryption enabled
# - SSH public key authentication (password auth disabled)
# -----------------------------------------------------------------------------
module "azure_compute" {
  source = "./modules/azure-compute"

  name_prefix       = local.name_prefix
  environment       = var.environment
  azure_location    = var.azure_location
  vm_size           = var.azure_vm_size
  ssh_public_key    = file(var.ssh_public_key_path)
  allowed_ssh_cidr  = var.allowed_ssh_cidr
  os_disk_size_gb   = var.azure_os_disk_size_gb
  admin_username    = var.azure_admin_username
  tags              = local.common_tags
}
