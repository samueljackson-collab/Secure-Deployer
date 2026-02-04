##############################################################################
# Zero Trust Architecture - Root Module
#
# This root module composes all sub-modules to create a complete Zero Trust
# network architecture. Each module enforces a specific layer of defense:
#
#   1. VPC          - Network isolation with four subnet tiers
#   2. Security Groups - Micro-segmented firewall rules (deny-all default)
#   3. NACLs        - Subnet-level access controls (defense in depth)
#   4. VPC Endpoints - Private AWS service access (no internet traversal)
#
# Principle: Never Trust, Always Verify
##############################################################################

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Architecture = "zero-trust"
    }
  }
}

# ------------------------------------------------------------------------------
# VPC Module
# Creates the foundational network with four isolated subnet tiers:
# public, private-app, private-data, and management.
# Each tier has its own route table to prevent cross-tier routing.
# ------------------------------------------------------------------------------
module "vpc" {
  source = "./modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  private_app_cidrs  = var.private_app_cidrs
  private_data_cidrs = var.private_data_cidrs
  management_cidrs   = var.management_cidrs
}

# ------------------------------------------------------------------------------
# Security Groups Module
# Implements micro-segmentation with deny-all defaults. Traffic is only
# permitted between adjacent tiers on specific ports:
#   ALB -> web_sg (443) -> app_sg (8080) -> data_sg (5432)
#   Management CIDR -> bastion_sg (22)
# ------------------------------------------------------------------------------
module "security_groups" {
  source = "./modules/security-groups"

  project_name     = var.project_name
  environment      = var.environment
  vpc_id           = module.vpc.vpc_id
  vpc_cidr         = var.vpc_cidr
  management_cidrs = var.management_cidrs
}

# ------------------------------------------------------------------------------
# Network ACLs Module
# Provides a second layer of defense at the subnet level, independent of
# security groups. This protects against security group misconfiguration
# and enforces network-level policies.
# ------------------------------------------------------------------------------
module "nacls" {
  source = "./modules/nacls"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  private_app_subnet_ids  = module.vpc.private_app_subnet_ids
  private_data_subnet_ids = module.vpc.private_data_subnet_ids
  management_subnet_ids   = module.vpc.management_subnet_ids
  vpc_cidr              = var.vpc_cidr
  private_app_cidrs     = var.private_app_cidrs
  private_data_cidrs    = var.private_data_cidrs
  management_cidrs      = var.management_cidrs
}

# ------------------------------------------------------------------------------
# VPC Endpoints Module
# Eliminates internet traversal for AWS API calls by providing private
# connectivity to AWS services. Gateway endpoints for S3/DynamoDB and
# interface endpoints for SSM, CloudWatch, STS, and Secrets Manager.
# ------------------------------------------------------------------------------
module "vpc_endpoints" {
  source = "./modules/vpc-endpoints"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  vpc_cidr              = var.vpc_cidr
  region                = var.region
  private_app_subnet_ids  = module.vpc.private_app_subnet_ids
  private_data_subnet_ids = module.vpc.private_data_subnet_ids
  private_app_route_table_ids  = module.vpc.private_app_route_table_ids
  private_data_route_table_ids = module.vpc.private_data_route_table_ids
}
