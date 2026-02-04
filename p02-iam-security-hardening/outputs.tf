###############################################################################
# Outputs -- Root Module
###############################################################################

# ---------------------------------------------------------------------------
# Policy outputs
# ---------------------------------------------------------------------------

output "app_read_policy_arn" {
  description = "ARN of the application read-only IAM policy."
  value       = module.app_read_policy.policy_arn
}

output "deploy_policy_arn" {
  description = "ARN of the CI/CD deployment IAM policy."
  value       = module.deploy_policy.policy_arn
}

# ---------------------------------------------------------------------------
# Role outputs
# ---------------------------------------------------------------------------

output "app_role_arn" {
  description = "ARN of the application workload IAM role."
  value       = module.app_role.role_arn
}

output "app_role_name" {
  description = "Name of the application workload IAM role."
  value       = module.app_role.role_name
}

output "deployer_role_arn" {
  description = "ARN of the CI/CD deployer IAM role."
  value       = module.deployer_role.role_arn
}

output "deployer_role_name" {
  description = "Name of the CI/CD deployer IAM role."
  value       = module.deployer_role.role_name
}
