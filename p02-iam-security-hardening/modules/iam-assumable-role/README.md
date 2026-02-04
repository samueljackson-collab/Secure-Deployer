# iam-assumable-role Module

Creates an AWS IAM role with a configurable trust policy, attaches zero or more
managed policies, and optionally sets a permissions boundary.  Wildcard (`*`)
principals are rejected at the variable-validation level.

## Usage

```hcl
module "deployer_role" {
  source = "./modules/iam-assumable-role"

  role_name            = "ci-deployer"
  description          = "Role assumed by the CI pipeline"
  max_session_duration = 3600

  trusted_entities = [
    {
      type        = "AWS"
      identifiers = ["arn:aws:iam::123456789012:role/ci-runner"]
      conditions = [
        {
          test     = "StringEquals"
          variable = "sts:ExternalId"
          values   = ["unique-external-id"]
        }
      ]
    }
  ]

  policy_arns          = ["arn:aws:iam::123456789012:policy/s3-read-only"]
  permissions_boundary = "arn:aws:iam::123456789012:policy/org-boundary"

  tags = {
    Environment = "production"
    Team        = "platform"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `role_name` | Name of the IAM role | `string` | -- | yes |
| `description` | Description of the role | `string` | `""` | no |
| `role_path` | IAM path for the role | `string` | `"/"` | no |
| `max_session_duration` | Max session in seconds (3600-43200) | `number` | `3600` | no |
| `trusted_entities` | List of trusted entity objects | `list(object)` | -- | yes |
| `policy_arns` | Managed policy ARNs to attach | `list(string)` | `[]` | no |
| `permissions_boundary` | Permissions boundary ARN | `string` | `null` | no |
| `tags` | Tags to apply | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `role_arn` | ARN of the created role |
| `role_name` | Name of the created role |
| `role_id` | Unique identifier of the role |
| `trust_policy_json` | Rendered JSON trust policy document |

## Validation Rules

* At least one trusted entity is required.
* Trusted entity type must be `AWS`, `Service`, or `Federated`.
* Wildcard (`*`) identifiers are rejected.
* Max session duration must be between 3600 and 43200 seconds.
