###############################################################################
# Input Variables -- iam-assumable-role module
###############################################################################

variable "role_name" {
  description = "Name of the IAM role."
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9+=,.@_-]+$", var.role_name))
    error_message = "role_name must contain only alphanumeric characters and +=,.@_- characters."
  }
}

variable "description" {
  description = "Human-readable description of the role purpose."
  type        = string
  default     = ""
}

variable "role_path" {
  description = "IAM path for the role (e.g., /engineering/)."
  type        = string
  default     = "/"
}

variable "max_session_duration" {
  description = "Maximum session duration in seconds (between 3600 and 43200)."
  type        = number
  default     = 3600

  validation {
    condition     = var.max_session_duration >= 3600 && var.max_session_duration <= 43200
    error_message = "max_session_duration must be between 3600 (1 hour) and 43200 (12 hours)."
  }
}

variable "trusted_entities" {
  description = <<-EOT
    List of trusted entity objects that may assume this role.  Each object contains:
      - type        (required): Principal type ("AWS", "Service", "Federated").
      - identifiers (required): List of principal ARNs or service names.
      - conditions  (optional): List of condition objects for the trust statement.
  EOT

  type = list(object({
    type        = string
    identifiers = list(string)
    conditions = optional(list(object({
      test     = string
      variable = string
      values   = list(string)
    })), [])
  }))

  validation {
    condition     = length(var.trusted_entities) > 0
    error_message = "At least one trusted entity is required."
  }

  validation {
    condition = alltrue([
      for entity in var.trusted_entities :
      contains(["AWS", "Service", "Federated"], entity.type)
    ])
    error_message = "trusted_entities type must be one of: AWS, Service, Federated."
  }

  validation {
    condition = alltrue([
      for entity in var.trusted_entities :
      !contains(entity.identifiers, "*")
    ])
    error_message = "Wildcard (*) is not permitted in trusted entity identifiers.  Specify explicit ARNs."
  }
}

variable "policy_arns" {
  description = "List of managed IAM policy ARNs to attach to the role."
  type        = list(string)
  default     = []
}

variable "permissions_boundary" {
  description = "ARN of the permissions boundary policy to attach to the role (optional)."
  type        = string
  default     = null
}

variable "tags" {
  description = "Map of tags to apply to the IAM role."
  type        = map(string)
  default     = {}
}
