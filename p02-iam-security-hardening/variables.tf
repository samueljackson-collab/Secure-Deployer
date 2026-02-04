###############################################################################
# Input Variables -- Root Module
###############################################################################

variable "aws_region" {
  description = "AWS region for resource deployment."
  type        = string
  default     = "us-east-1"
}

variable "project_prefix" {
  description = "Prefix applied to all IAM resource names for namespacing."
  type        = string
  default     = "p02"
}

# ---------------------------------------------------------------------------
# Resource ARNs scoped by the IAM policies
# ---------------------------------------------------------------------------

variable "s3_bucket_arns" {
  description = "List of S3 bucket ARNs the application may read from."
  type        = list(string)

  validation {
    condition = alltrue([
      for arn in var.s3_bucket_arns :
      can(regex("^arn:aws:s3:::", arn))
    ])
    error_message = "Each entry must be a valid S3 bucket ARN (arn:aws:s3:::...)."
  }
}

variable "dynamodb_table_arns" {
  description = "List of DynamoDB table ARNs the application may read from."
  type        = list(string)
}

variable "ecr_repository_arns" {
  description = "List of ECR repository ARNs the CI/CD pipeline may push to."
  type        = list(string)
}

variable "ecs_service_arns" {
  description = "List of ECS service ARNs the CI/CD pipeline may update."
  type        = list(string)
}

# ---------------------------------------------------------------------------
# Trust and boundary configuration
# ---------------------------------------------------------------------------

variable "ci_trusted_entities" {
  description = "Trusted entities permitted to assume the CI deployer role."
  type = list(object({
    type        = string
    identifiers = list(string)
    conditions = optional(list(object({
      test     = string
      variable = string
      values   = list(string)
    })), [])
  }))
}

variable "ci_max_session_duration" {
  description = "Maximum session duration (seconds) for the CI deployer role."
  type        = number
  default     = 3600
}

variable "permissions_boundary_arn" {
  description = "ARN of the organisation permissions boundary policy (optional)."
  type        = string
  default     = null
}

# ---------------------------------------------------------------------------
# Tagging
# ---------------------------------------------------------------------------

variable "tags" {
  description = "Map of tags applied to all IAM resources."
  type        = map(string)
  default     = {}
}
