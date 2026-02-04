###############################################################################
# IAM Policy Module
#
# Creates a customer-managed IAM policy from a list of policy statements.
# Enforces least-privilege by requiring explicit actions and resources.
###############################################################################

terraform {
  required_version = ">= 1.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
  }
}

# ---------------------------------------------------------------------------
# Data: Build the IAM policy document from the provided statements
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "this" {
  dynamic "statement" {
    for_each = var.policy_statements
    content {
      sid       = lookup(statement.value, "sid", null)
      effect    = lookup(statement.value, "effect", "Allow")
      actions   = statement.value.actions
      resources = statement.value.resources

      dynamic "condition" {
        for_each = lookup(statement.value, "conditions", [])
        content {
          test     = condition.value.test
          variable = condition.value.variable
          values   = condition.value.values
        }
      }
    }
  }
}

# ---------------------------------------------------------------------------
# Resource: Customer-managed IAM policy
# ---------------------------------------------------------------------------

resource "aws_iam_policy" "this" {
  name        = var.policy_name
  path        = var.policy_path
  description = var.description
  policy      = data.aws_iam_policy_document.this.json

  tags = merge(
    var.tags,
    {
      ManagedBy = "terraform"
      Module    = "iam-policy"
    },
  )
}
