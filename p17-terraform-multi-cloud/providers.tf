# =============================================================================
# Provider Configurations
# =============================================================================
# Configures the AWS and AzureRM Terraform providers with version constraints.
# Authentication is expected via environment variables or CLI profiles:
#   - AWS: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, or `aws configure`
#   - Azure: ARM_SUBSCRIPTION_ID / ARM_TENANT_ID / etc., or `az login`
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
  }

  # ---------------------------------------------------------------------------
  # Remote Backend Configuration (uncomment and configure for production)
  # ---------------------------------------------------------------------------
  # backend "s3" {
  #   bucket         = "my-terraform-state"
  #   key            = "multi-cloud/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-lock"
  # }
}

# -----------------------------------------------------------------------------
# AWS Provider
# -----------------------------------------------------------------------------
# Authenticates using the default credential chain:
#   1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
#   2. Shared credentials file (~/.aws/credentials)
#   3. IAM instance profile (when running on EC2)
#   4. OIDC web identity (when running in CI/CD with federation)
# -----------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      ManagedBy   = "terraform"
      Project     = var.project_name
      Environment = var.environment
    }
  }
}

# -----------------------------------------------------------------------------
# Azure Provider
# -----------------------------------------------------------------------------
# Authenticates using the default credential chain:
#   1. Environment variables (ARM_CLIENT_ID, ARM_CLIENT_SECRET, etc.)
#   2. Azure CLI (`az login`)
#   3. Managed identity (when running on Azure)
#   4. OIDC federation (when running in CI/CD)
#
# The `features {}` block is required by the AzureRM provider even if empty.
# -----------------------------------------------------------------------------
provider "azurerm" {
  features {
    virtual_machine {
      # Gracefully shut down the VM before deletion instead of force-killing
      graceful_shutdown = true

      # Do not delete OS disk and data disks when the VM is deleted
      # (safety measure for production; set to true for dev/staging)
      delete_os_disk_on_deletion    = false
      delete_data_disks_on_deletion = false
    }

    resource_group {
      # Prevent deletion of resource groups that still contain resources
      prevent_deletion_if_contains_resources = true
    }
  }
}
