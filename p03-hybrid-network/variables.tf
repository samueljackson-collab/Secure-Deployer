###############################################################################
# P03 Hybrid Network - Root Variables
#
# All configurable parameters for the hybrid networking stack.
# Sensitive values (e.g., pre-shared keys) should be injected via environment
# variables or a secrets manager -- never committed to version control.
###############################################################################

# -----------------------------------------------------------------------------
# General
# -----------------------------------------------------------------------------
variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, production)."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "common_tags" {
  description = "Common tags applied to all resources."
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
variable "vpc_name" {
  description = "Name prefix for VPC and related resources."
  type        = string
  default     = "hybrid-network"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "List of availability zones for subnet placement."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# -----------------------------------------------------------------------------
# Virtual Private Gateway
# -----------------------------------------------------------------------------
variable "amazon_side_asn" {
  description = "BGP ASN for the Amazon side of the VPN. Default is the AWS default ASN."
  type        = number
  default     = 64512

  validation {
    condition     = var.amazon_side_asn >= 64512 && var.amazon_side_asn <= 65534
    error_message = "amazon_side_asn must be a valid private ASN between 64512 and 65534."
  }
}

# -----------------------------------------------------------------------------
# Customer Gateway (on-premises)
# -----------------------------------------------------------------------------
variable "cgw_ip_address" {
  description = "Public IP address of the on-premises VPN device (Customer Gateway)."
  type        = string

  validation {
    condition     = can(regex("^(\\d{1,3}\\.){3}\\d{1,3}$", var.cgw_ip_address))
    error_message = "cgw_ip_address must be a valid IPv4 address."
  }
}

variable "cgw_bgp_asn" {
  description = "BGP ASN of the on-premises Customer Gateway device."
  type        = number
  default     = 65000

  validation {
    condition     = var.cgw_bgp_asn >= 1 && var.cgw_bgp_asn <= 4294967295
    error_message = "cgw_bgp_asn must be a valid BGP ASN."
  }
}

# -----------------------------------------------------------------------------
# VPN Connection
# -----------------------------------------------------------------------------
variable "vpn_static_routes_only" {
  description = "Whether the VPN connection uses static routes only (true) or BGP (false)."
  type        = bool
  default     = false
}

variable "on_prem_cidrs" {
  description = "List of on-premises CIDR blocks reachable through the VPN."
  type        = list(string)
  default     = ["192.168.0.0/16"]

  validation {
    condition     = alltrue([for cidr in var.on_prem_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All on_prem_cidrs must be valid IPv4 CIDR blocks."
  }
}

variable "tunnel1_preshared_key" {
  description = "Pre-shared key for VPN tunnel 1. Must be 8-64 chars, no leading zero. Inject via TF_VAR or secrets manager."
  type        = string
  default     = null
  sensitive   = true

  validation {
    condition     = var.tunnel1_preshared_key == null || (length(var.tunnel1_preshared_key) >= 8 && length(var.tunnel1_preshared_key) <= 64)
    error_message = "tunnel1_preshared_key must be between 8 and 64 characters."
  }
}

variable "tunnel2_preshared_key" {
  description = "Pre-shared key for VPN tunnel 2. Must be 8-64 chars, no leading zero. Inject via TF_VAR or secrets manager."
  type        = string
  default     = null
  sensitive   = true

  validation {
    condition     = var.tunnel2_preshared_key == null || (length(var.tunnel2_preshared_key) >= 8 && length(var.tunnel2_preshared_key) <= 64)
    error_message = "tunnel2_preshared_key must be between 8 and 64 characters."
  }
}

variable "tunnel1_inside_cidr" {
  description = "Inside tunnel CIDR for tunnel 1 (e.g., 169.254.10.0/30). Must be a /30 in 169.254.0.0/16."
  type        = string
  default     = null
}

variable "tunnel2_inside_cidr" {
  description = "Inside tunnel CIDR for tunnel 2 (e.g., 169.254.11.0/30). Must be a /30 in 169.254.0.0/16."
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Security Groups
# -----------------------------------------------------------------------------
variable "bastion_cidr" {
  description = "CIDR block allowed SSH access to bastion host (e.g., corporate office IP)."
  type        = string
  default     = "10.0.0.0/8"

  validation {
    condition     = can(cidrhost(var.bastion_cidr, 0))
    error_message = "bastion_cidr must be a valid IPv4 CIDR block."
  }
}

variable "allowed_vpn_ports" {
  description = "List of TCP ports allowed from on-prem CIDRs through VPN (e.g., 443, 8080)."
  type        = list(number)
  default     = [443, 8080, 8443]

  validation {
    condition     = alltrue([for p in var.allowed_vpn_ports : p >= 1 && p <= 65535])
    error_message = "All ports must be between 1 and 65535."
  }
}
