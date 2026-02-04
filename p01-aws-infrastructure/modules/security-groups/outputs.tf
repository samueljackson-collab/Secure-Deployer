# =============================================================================
# Security Groups Module - Outputs
# =============================================================================
# These outputs provide the security group IDs needed by other modules
# to attach the correct security groups to their resources.
# =============================================================================

output "alb_sg_id" {
  description = "ID of the ALB security group. Attach to the Application Load Balancer."
  value       = aws_security_group.alb.id
}

output "app_sg_id" {
  description = "ID of the application security group. Attach to EC2 instances in the Auto Scaling Group."
  value       = aws_security_group.app.id
}

output "rds_sg_id" {
  description = "ID of the RDS security group. Attach to the RDS PostgreSQL instance."
  value       = aws_security_group.rds.id
}

output "alb_sg_arn" {
  description = "ARN of the ALB security group. Use in IAM policies or cross-account references."
  value       = aws_security_group.alb.arn
}

output "app_sg_arn" {
  description = "ARN of the application security group."
  value       = aws_security_group.app.arn
}

output "rds_sg_arn" {
  description = "ARN of the RDS security group."
  value       = aws_security_group.rds.arn
}
