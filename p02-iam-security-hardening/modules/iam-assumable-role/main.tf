###############################################################################
# IAM Assumable Role Module
#
# Creates an IAM role with a configurable trust policy, attaches managed
# policies, and optionally sets a permissions boundary.
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
# Data: Build the trust (assume-role) policy document
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "trust" {
  dynamic "statement" {
    for_each = var.trusted_entities
    content {
      sid     = "TrustEntity${statement.key}"
      effect  = "Allow"
      actions = ["sts:AssumeRole"]

      principals {
        type        = statement.value.type
        identifiers = statement.value.identifiers
      }

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
# Resource: IAM Role
# ---------------------------------------------------------------------------

resource "aws_iam_role" "this" {
  name                 = var.role_name
  path                 = var.role_path
  description          = var.description
  assume_role_policy   = data.aws_iam_policy_document.trust.json
  max_session_duration = var.max_session_duration
  permissions_boundary = var.permissions_boundary

  tags = merge(
    var.tags,
    {
      ManagedBy = "terraform"
      Module    = "iam-assumable-role"
    },
  )
}

# ---------------------------------------------------------------------------
# Resource: Attach managed policies to the role
# ---------------------------------------------------------------------------

resource "aws_iam_role_policy_attachment" "this" {
  for_each = toset(var.policy_arns)

  role       = aws_iam_role.this.name
  policy_arn = each.value
}
