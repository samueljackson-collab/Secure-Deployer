###############################################################################
# P03 Hybrid Network - Root Module
#
# Composes a production-grade hybrid cloud networking environment on AWS with
# Site-to-Site VPN connectivity back to an on-premises data center.
#
# Architecture:
#   On-Prem DC  <--IPsec VPN-->  AWS VPC (public + private subnets)
#
# Modules:
#   - vpc              : VPC, subnets, route tables, NAT gateway, IGW
#   - vgw              : Virtual Private Gateway attached to VPC
#   - cgw              : Customer Gateway representing the on-prem device
#   - vpn-connection   : Site-to-Site VPN tunnel between VGW and CGW
#   - security-groups  : Restrictive security groups for VPN traffic
###############################################################################

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for remote state in production.
  # backend "s3" {
  #   bucket         = "my-terraform-state"
  #   key            = "p03-hybrid-network/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}

# -----------------------------------------------------------------------------
# Provider
# -----------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "p03-hybrid-network"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# VPC Module
# Creates VPC with public and private subnets, route tables, NAT gateway.
# -----------------------------------------------------------------------------
module "vpc" {
  source = "./modules/vpc"

  vpc_cidr            = var.vpc_cidr
  vpc_name            = var.vpc_name
  environment         = var.environment
  availability_zones  = var.availability_zones
  public_subnet_cidrs = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  enable_dns_support  = true
  enable_dns_hostnames = true

  tags = var.common_tags
}

# -----------------------------------------------------------------------------
# Virtual Private Gateway Module
# Attaches a VGW to the VPC and enables route propagation on private subnets.
# -----------------------------------------------------------------------------
module "vgw" {
  source = "./modules/vgw"

  vpc_id                    = module.vpc.vpc_id
  vgw_name                  = "${var.vpc_name}-vgw"
  amazon_side_asn           = var.amazon_side_asn
  private_route_table_ids   = module.vpc.private_route_table_ids
  environment               = var.environment

  tags = var.common_tags
}

# -----------------------------------------------------------------------------
# Customer Gateway Module
# Represents the on-premises VPN device (router/firewall).
# -----------------------------------------------------------------------------
module "cgw" {
  source = "./modules/cgw"

  cgw_ip_address = var.cgw_ip_address
  cgw_bgp_asn    = var.cgw_bgp_asn
  cgw_name       = "${var.vpc_name}-cgw"
  cgw_type       = "ipsec.1"
  environment    = var.environment

  tags = var.common_tags
}

# -----------------------------------------------------------------------------
# VPN Connection Module
# Establishes Site-to-Site VPN between VGW and CGW with IPsec tunnels.
# -----------------------------------------------------------------------------
module "vpn_connection" {
  source = "./modules/vpn-connection"

  vgw_id             = module.vgw.vgw_id
  cgw_id             = module.cgw.cgw_id
  vpn_name           = "${var.vpc_name}-vpn"
  static_routes_only = var.vpn_static_routes_only
  on_prem_cidrs      = var.on_prem_cidrs
  environment        = var.environment

  # Tunnel configuration
  tunnel1_preshared_key   = var.tunnel1_preshared_key
  tunnel2_preshared_key   = var.tunnel2_preshared_key
  tunnel1_inside_cidr     = var.tunnel1_inside_cidr
  tunnel2_inside_cidr     = var.tunnel2_inside_cidr

  tags = var.common_tags
}

# -----------------------------------------------------------------------------
# Security Groups Module
# Restrictive security groups allowing only required VPN traffic flows.
# -----------------------------------------------------------------------------
module "security_groups" {
  source = "./modules/security-groups"

  vpc_id            = module.vpc.vpc_id
  vpc_cidr          = var.vpc_cidr
  on_prem_cidrs     = var.on_prem_cidrs
  bastion_cidr      = var.bastion_cidr
  environment       = var.environment
  sg_name_prefix    = var.vpc_name
  allowed_vpn_ports = var.allowed_vpn_ports

  tags = var.common_tags
}
