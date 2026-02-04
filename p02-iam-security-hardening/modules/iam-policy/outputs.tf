###############################################################################
# Outputs -- iam-policy module
###############################################################################

output "policy_arn" {
  description = "ARN of the created IAM policy."
  value       = aws_iam_policy.this.arn
}

output "policy_id" {
  description = "Unique identifier of the created IAM policy."
  value       = aws_iam_policy.this.policy_id
}

output "policy_name" {
  description = "Name of the created IAM policy."
  value       = aws_iam_policy.this.name
}

output "policy_json" {
  description = "The rendered JSON policy document."
  value       = data.aws_iam_policy_document.this.json
}
