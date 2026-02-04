###############################################################################
# Outputs -- iam-assumable-role module
###############################################################################

output "role_arn" {
  description = "ARN of the created IAM role."
  value       = aws_iam_role.this.arn
}

output "role_name" {
  description = "Name of the created IAM role."
  value       = aws_iam_role.this.name
}

output "role_id" {
  description = "Unique identifier of the created IAM role."
  value       = aws_iam_role.this.unique_id
}

output "trust_policy_json" {
  description = "The rendered JSON trust policy document."
  value       = data.aws_iam_policy_document.trust.json
}
