# =============================================================================
# VPC Module - Outputs
# =============================================================================
# These outputs are consumed by other modules (security-groups, alb, asg, rds)
# to place resources in the correct network segments.
# =============================================================================

output "vpc_id" {
  description = "ID of the created VPC. Used by security groups, ALB, and other resources that must reference the VPC."
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC. Useful for creating security group rules that reference the entire VPC address space."
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "List of public subnet IDs. Used by the ALB module to place load balancer nodes in public subnets across AZs."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs. Used by the ASG and RDS modules to place compute and database resources in isolated subnets."
  value       = aws_subnet.private[*].id
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway. Exposed for reference but typically not needed by other modules."
  value       = aws_internet_gateway.main.id
}

output "nat_gateway_id" {
  description = "ID of the NAT Gateway. Exposed for reference and monitoring."
  value       = aws_nat_gateway.main.id
}

output "nat_gateway_public_ip" {
  description = "Public IP address of the NAT Gateway. Use this to whitelist outbound traffic from private subnets with external services."
  value       = aws_eip.nat.public_ip
}

output "public_route_table_id" {
  description = "ID of the public route table. Use to add additional routes for public subnets."
  value       = aws_route_table.public.id
}

output "private_route_table_id" {
  description = "ID of the private route table. Use to add additional routes for private subnets (e.g., VPN, Transit Gateway)."
  value       = aws_route_table.private.id
}
