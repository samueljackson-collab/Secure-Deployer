# =============================================================================
# Security Groups Module - Variables
# =============================================================================

variable "project_name" {
  description = "Project name used for resource naming and tagging."
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., development, staging, production)."
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where security groups will be created. All security groups are scoped to this VPC."
  type        = string
}

variable "app_port" {
  description = "Port on which the application listens. Used for ALB-to-App and App ingress rules."
  type        = number
  default     = 8080

  validation {
    condition     = var.app_port > 0 && var.app_port <= 65535
    error_message = "Application port must be between 1 and 65535."
  }
}

variable "db_port" {
  description = "Port for PostgreSQL database connections. Used for App-to-RDS and RDS ingress rules."
  type        = number
  default     = 5432

  validation {
    condition     = var.db_port > 0 && var.db_port <= 65535
    error_message = "Database port must be between 1 and 65535."
  }
}
