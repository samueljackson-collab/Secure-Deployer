# iam-policy Module

Creates a customer-managed AWS IAM policy from a list of explicit policy
statements.  The module enforces least-privilege by rejecting wildcard (`*`)
actions and resources at the variable-validation level.

## Usage

```hcl
module "s3_read_policy" {
  source = "./modules/iam-policy"

  policy_name = "s3-read-only"
  description = "Read-only access to the data-lake bucket"

  policy_statements = [
    {
      sid       = "AllowS3Read"
      effect    = "Allow"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = [
        "arn:aws:s3:::data-lake-bucket",
        "arn:aws:s3:::data-lake-bucket/*"
      ]
      conditions = [
        {
          test     = "StringEquals"
          variable = "aws:RequestedRegion"
          values   = ["us-east-1"]
        }
      ]
    }
  ]

  tags = {
    Environment = "production"
    Team        = "data-engineering"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `policy_name` | Name of the IAM policy | `string` | -- | yes |
| `description` | Description of the policy | `string` | `""` | no |
| `policy_path` | IAM path for the policy | `string` | `"/"` | no |
| `policy_statements` | List of statement objects (see variables.tf) | `list(object)` | -- | yes |
| `tags` | Tags to apply | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `policy_arn` | ARN of the created policy |
| `policy_id` | Unique identifier of the policy |
| `policy_name` | Name of the created policy |
| `policy_json` | Rendered JSON policy document |

## Validation Rules

* At least one statement is required.
* Wildcard (`*`) actions are rejected.
* Wildcard (`*`) resources are rejected.
* Policy name must match `^[a-zA-Z0-9+=,.@_-]+$`.
