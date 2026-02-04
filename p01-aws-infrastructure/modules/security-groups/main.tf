# =============================================================================
# Security Groups Module - Layered Network Access Control
# =============================================================================
# This module implements a three-tier security group architecture that enforces
# the principle of least privilege at the network level:
#
#   Internet --> [ALB SG: 80,443] --> [App SG: app_port] --> [RDS SG: 5432]
#
# Each tier can only communicate with its adjacent tiers. This prevents:
#   - Direct internet access to application instances
#   - Direct internet access to the database
#   - Application-to-application lateral movement (within the same SG)
#   - Unauthorized database access from non-application sources
#
# Security design principles:
#   1. Deny all by default (AWS SG default behavior)
#   2. Allow only specific ports from specific sources
#   3. Use security group references (not CIDR blocks) for inter-tier rules
#      to ensure rules remain valid even if IP addresses change
#   4. Separate ingress and egress rules for auditability
# =============================================================================

# -----------------------------------------------------------------------------
# ALB Security Group
# -----------------------------------------------------------------------------
# Purpose: Controls inbound traffic to the Application Load Balancer.
#
# Ingress rules:
#   - Port 80 (HTTP) from anywhere: Allows initial HTTP connections that will
#     be redirected to HTTPS by the ALB listener rules.
#   - Port 443 (HTTPS) from anywhere: Allows encrypted traffic from clients.
#
# Egress rules:
#   - All traffic to the VPC CIDR: Allows the ALB to forward requests to
#     targets in private subnets and perform health checks.
#
# Why we allow port 80: The ALB redirects HTTP to HTTPS. Blocking port 80
# would prevent users who type the URL without "https://" from reaching
# the site. The redirect happens at the ALB before any traffic reaches
# the application.
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Security group for the Application Load Balancer. Allows HTTP/HTTPS from the internet."
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
    Tier = "public"
  }

  # Prevent Terraform from destroying and recreating the SG (which would
  # break references from the ALB). Instead, Terraform will update in-place.
  lifecycle {
    create_before_destroy = true
  }
}

# Ingress: Allow HTTP (port 80) from anywhere.
# This traffic will be redirected to HTTPS by the ALB listener.
resource "aws_security_group_rule" "alb_ingress_http" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  ipv6_cidr_blocks  = ["::/0"]
  security_group_id = aws_security_group.alb.id
  description       = "Allow HTTP from internet (redirected to HTTPS)"
}

# Ingress: Allow HTTPS (port 443) from anywhere.
# This is the primary entry point for all client traffic.
resource "aws_security_group_rule" "alb_ingress_https" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  ipv6_cidr_blocks  = ["::/0"]
  security_group_id = aws_security_group.alb.id
  description       = "Allow HTTPS from internet"
}

# Egress: Allow outbound traffic to the application port.
# Restricted to the App security group to prevent the ALB from initiating
# connections to arbitrary destinations.
resource "aws_security_group_rule" "alb_egress_to_app" {
  type                     = "egress"
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
  security_group_id        = aws_security_group.alb.id
  description              = "Allow outbound to application instances on app port"
}

# -----------------------------------------------------------------------------
# Application Security Group
# -----------------------------------------------------------------------------
# Purpose: Controls traffic to/from application instances in the ASG.
#
# Ingress rules:
#   - Application port from ALB SG only: Ensures ONLY the load balancer can
#     reach the application. No direct internet access is possible.
#
# Egress rules:
#   - Port 443 to 0.0.0.0/0: Allows instances to call external HTTPS APIs,
#     pull container images, download updates via NAT Gateway.
#   - Database port to RDS SG: Allows application to connect to PostgreSQL.
#
# Why no SSH ingress: SSH access is intentionally omitted. Use AWS Systems
# Manager Session Manager for interactive access, which provides:
#   - IAM-based authentication (no SSH keys to manage)
#   - Full audit trail in CloudTrail
#   - No need to open port 22 in any security group
# -----------------------------------------------------------------------------
resource "aws_security_group" "app" {
  name        = "${var.project_name}-${var.environment}-app-sg"
  description = "Security group for application instances. Allows traffic only from the ALB."
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-${var.environment}-app-sg"
    Tier = "application"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Ingress: Allow traffic from ALB on the application port only.
# Using source_security_group_id (not CIDR) ensures this rule automatically
# applies to any ALB node regardless of its IP address.
resource "aws_security_group_rule" "app_ingress_from_alb" {
  type                     = "ingress"
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = aws_security_group.app.id
  description              = "Allow inbound from ALB on application port"
}

# Egress: Allow HTTPS outbound for external API calls and package downloads.
# This traffic exits through the NAT Gateway in the public subnet.
resource "aws_security_group_rule" "app_egress_https" {
  type              = "egress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.app.id
  description       = "Allow HTTPS outbound for external API calls and updates"
}

# Egress: Allow HTTP outbound for package repository access.
# Some package managers use HTTP for initial metadata retrieval.
resource "aws_security_group_rule" "app_egress_http" {
  type              = "egress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.app.id
  description       = "Allow HTTP outbound for package repository access"
}

# Egress: Allow connections to the database on the PostgreSQL port.
# Restricted to the RDS security group to prevent the application from
# connecting to any other database or service on this port.
resource "aws_security_group_rule" "app_egress_to_rds" {
  type                     = "egress"
  from_port                = var.db_port
  to_port                  = var.db_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
  security_group_id        = aws_security_group.app.id
  description              = "Allow outbound to RDS on PostgreSQL port"
}

# -----------------------------------------------------------------------------
# RDS Security Group
# -----------------------------------------------------------------------------
# Purpose: Controls access to the PostgreSQL database.
#
# Ingress rules:
#   - PostgreSQL port from App SG only: Only application instances can
#     connect to the database. This is the most restrictive tier.
#
# Egress rules:
#   - None explicitly defined. RDS does not need to initiate outbound
#     connections. AWS handles replication traffic internally for Multi-AZ.
#
# This security group, combined with private subnet placement and the
# publicly_accessible=false setting on the RDS instance, creates multiple
# layers of protection for the database.
# -----------------------------------------------------------------------------
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL. Allows connections only from application instances."
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
    Tier = "database"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Ingress: Allow PostgreSQL connections from application instances only.
# This is the single most important rule in the entire security group
# configuration. It ensures that only the application tier can query
# the database.
resource "aws_security_group_rule" "rds_ingress_from_app" {
  type                     = "ingress"
  from_port                = var.db_port
  to_port                  = var.db_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
  security_group_id        = aws_security_group.rds.id
  description              = "Allow PostgreSQL connections from application instances only"
}
