# =============================================================================
# VPC Module - Variables
# =============================================================================

variable "project_name" {
  description = "Project name used for resource naming and tagging."
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., development, staging, production)."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Must be a valid IPv4 CIDR block with enough address space for all subnets."
  type        = string

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "List of AWS Availability Zones to deploy subnets into. At least 2 AZs are required for high availability."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones are required for multi-AZ deployment."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets. Must be within the VPC CIDR range. One per availability zone."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_cidrs) >= 2
    error_message = "At least 2 public subnet CIDRs are required."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets. Must be within the VPC CIDR range. One per availability zone."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_cidrs) >= 2
    error_message = "At least 2 private subnet CIDRs are required."
  }
}
