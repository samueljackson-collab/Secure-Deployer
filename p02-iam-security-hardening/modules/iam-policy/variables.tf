###############################################################################
# Input Variables -- iam-policy module
###############################################################################

variable "policy_name" {
  description = "Name of the IAM policy."
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9+=,.@_-]+$", var.policy_name))
    error_message = "policy_name must contain only alphanumeric characters and +=,.@_- characters."
  }
}

variable "description" {
  description = "Human-readable description of the policy purpose."
  type        = string
  default     = ""
}

variable "policy_path" {
  description = "IAM path for the policy (e.g., /engineering/)."
  type        = string
  default     = "/"
}

variable "policy_statements" {
  description = <<-EOT
    List of policy statement objects.  Each object must contain:
      - sid       (optional) : Statement identifier.
      - effect    (optional) : "Allow" or "Deny".  Defaults to "Allow".
      - actions   (required) : List of IAM actions (e.g., ["s3:GetObject"]).
      - resources (required) : List of resource ARNs.
      - conditions (optional): List of condition objects with test, variable, and values.
  EOT

  type = list(object({
    sid       = optional(string, null)
    effect    = optional(string, "Allow")
    actions   = list(string)
    resources = list(string)
    conditions = optional(list(object({
      test     = string
      variable = string
      values   = list(string)
    })), [])
  }))

  validation {
    condition     = length(var.policy_statements) > 0
    error_message = "At least one policy statement is required."
  }

  validation {
    condition = alltrue([
      for stmt in var.policy_statements :
      !contains(stmt.actions, "*")
    ])
    error_message = "Wildcard (*) actions are not permitted.  Specify explicit actions."
  }

  validation {
    condition = alltrue([
      for stmt in var.policy_statements :
      !contains(stmt.resources, "*")
    ])
    error_message = "Wildcard (*) resources are not permitted.  Specify explicit resource ARNs."
  }
}

variable "tags" {
  description = "Map of tags to apply to the IAM policy."
  type        = map(string)
  default     = {}
}
