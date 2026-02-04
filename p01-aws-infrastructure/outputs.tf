# =============================================================================
# P01 AWS Infrastructure - Root Outputs
# =============================================================================
# These outputs expose key resource identifiers and endpoints from the
# deployed infrastructure. They serve multiple purposes:
#
#   1. Cross-stack references: Other Terraform configurations can use
#      terraform_remote_state to read these values.
#   2. CI/CD integration: Deployment pipelines can parse these outputs
#      for automated configuration of downstream services.
#   3. Operational visibility: Quick access to important endpoints
#      after terraform apply completes.
#
# Security note: Sensitive values (e.g., RDS endpoint) are marked as
# sensitive to prevent accidental exposure in CI/CD logs.
# =============================================================================

# -----------------------------------------------------------------------------
# Network Outputs
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC. Use this to reference the VPC in other Terraform configurations or for manual resource creation."
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets. Use for resources that need internet-facing connectivity (e.g., additional load balancers)."
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets. Use for resources that should not be directly accessible from the internet."
  value       = module.vpc.private_subnet_ids
}

# -----------------------------------------------------------------------------
# Load Balancer Outputs
# -----------------------------------------------------------------------------

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer. Create a CNAME or Route 53 alias record pointing your domain to this value."
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB. Required when creating Route 53 alias records."
  value       = module.alb.alb_zone_id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer. Use for IAM policies, CloudWatch metrics, or WAF association."
  value       = module.alb.alb_arn
}

# -----------------------------------------------------------------------------
# Database Outputs
# -----------------------------------------------------------------------------

output "rds_endpoint" {
  description = "Connection endpoint for the RDS PostgreSQL instance (hostname:port). Configure your application's DATABASE_URL with this value."
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_instance_id" {
  description = "Identifier of the RDS instance. Use for CloudWatch alarms, maintenance windows, and operational tasks."
  value       = module.rds.instance_id
}

# -----------------------------------------------------------------------------
# Storage Outputs
# -----------------------------------------------------------------------------

output "s3_bucket_name" {
  description = "Name of the S3 bucket. Configure your application to use this bucket for asset storage and log retrieval."
  value       = module.s3.bucket_id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket. Use in IAM policies to grant application instances read/write permissions."
  value       = module.s3.bucket_arn
}

# -----------------------------------------------------------------------------
# Security Group Outputs
# -----------------------------------------------------------------------------

output "alb_security_group_id" {
  description = "ID of the ALB security group. Use to add additional ingress/egress rules if needed."
  value       = module.security_groups.alb_sg_id
}

output "app_security_group_id" {
  description = "ID of the application security group. Use for additional services that need the same network access as the app tier."
  value       = module.security_groups.app_sg_id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group. Use to grant database access to additional services (e.g., a migration runner)."
  value       = module.security_groups.rds_sg_id
}
