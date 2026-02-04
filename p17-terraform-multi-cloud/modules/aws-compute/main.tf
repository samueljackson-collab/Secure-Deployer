# =============================================================================
# AWS Compute Module
# =============================================================================
#
# Provisions a single EC2 instance inside a dedicated VPC with the following
# security controls:
#
#   - Dedicated VPC with a public subnet (no default VPC usage)
#   - Internet gateway for outbound connectivity
#   - Security group: inbound SSH only from specified CIDR, all outbound allowed
#   - EBS root volume encryption enabled (uses default AWS-managed KMS key)
#   - IMDSv2 required (prevents SSRF-based credential theft via instance metadata)
#   - SSH key pair for authentication (password auth is not configured)
#
# This module does NOT create:
#   - NAT gateways (single public subnet design for simplicity)
#   - Load balancers (single instance; add ALB at the root module level if needed)
#   - Auto Scaling groups (out of scope for compute parity demo)
#
# =============================================================================

# -----------------------------------------------------------------------------
# Data Source: Latest Amazon Linux 2023 AMI
# -----------------------------------------------------------------------------
# If no AMI ID is provided, automatically discover the latest Amazon Linux 2023
# AMI owned by Amazon. This ensures the instance always runs a patched base image.
# -----------------------------------------------------------------------------
data "aws_ami" "amazon_linux" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

# Resolve the AMI ID: use the provided value or the discovered one
locals {
  resolved_ami_id = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux[0].id
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
# Create a dedicated VPC for this workload. Using a dedicated VPC instead of
# the default VPC ensures network isolation and prevents accidental exposure
# through shared security group rules.
# -----------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

# -----------------------------------------------------------------------------
# Internet Gateway
# -----------------------------------------------------------------------------
# Required for instances in the public subnet to reach the internet.
# In production, consider using a NAT gateway + private subnet instead.
# -----------------------------------------------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-igw"
  })
}

# -----------------------------------------------------------------------------
# Public Subnet
# -----------------------------------------------------------------------------
# A single public subnet in the first availability zone. For production
# high-availability, deploy across multiple AZs.
# -----------------------------------------------------------------------------
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "${var.aws_region}a"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-subnet"
  })
}

# -----------------------------------------------------------------------------
# Route Table
# -----------------------------------------------------------------------------
# Route all traffic (0.0.0.0/0) through the internet gateway.
# Associate the route table with the public subnet.
# -----------------------------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# -----------------------------------------------------------------------------
# Security Group
# -----------------------------------------------------------------------------
# Inbound rules:
#   - SSH (port 22) from the specified CIDR block only
#
# Outbound rules:
#   - All traffic allowed (required for package updates, etc.)
#
# SECURITY NOTE: In production, restrict allowed_ssh_cidr to your office IP
# or VPN CIDR. The default 0.0.0.0/0 is intentionally permissive for
# development but should NEVER be used in production.
# -----------------------------------------------------------------------------
resource "aws_security_group" "instance" {
  name        = "${var.name_prefix}-sg"
  description = "Security group for ${var.name_prefix} EC2 instance"
  vpc_id      = aws_vpc.main.id

  # Inbound: SSH only
  ingress {
    description = "SSH from allowed CIDR"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # Outbound: all traffic
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-sg"
  })
}

# -----------------------------------------------------------------------------
# SSH Key Pair
# -----------------------------------------------------------------------------
# Upload the provided SSH public key to AWS. The corresponding private key
# is never transmitted to AWS; it remains on the operator's machine.
# -----------------------------------------------------------------------------
resource "aws_key_pair" "deployer" {
  key_name   = "${var.name_prefix}-key"
  public_key = var.ssh_public_key

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-key"
  })
}

# -----------------------------------------------------------------------------
# EC2 Instance
# -----------------------------------------------------------------------------
# The instance is deployed with:
#   - Encrypted root EBS volume (AES-256 via AWS-managed KMS key)
#   - IMDSv2 required (http_tokens = "required"): mitigates SSRF attacks
#     that attempt to steal IAM credentials from the instance metadata
#     service. IMDSv1 (no token) requests are rejected.
#   - Monitoring enabled for CloudWatch detailed metrics (1-minute intervals)
#   - User data script for initial bootstrapping (updates + logging agent)
# -----------------------------------------------------------------------------
resource "aws_instance" "main" {
  ami                    = local.resolved_ami_id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.deployer.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.instance.id]
  monitoring             = true

  # EBS root volume with encryption enabled
  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true

    tags = merge(var.tags, {
      Name = "${var.name_prefix}-root-vol"
    })
  }

  # IMDSv2 enforcement
  # http_tokens = "required" disables IMDSv1 (unauthenticated metadata access).
  # http_put_response_hop_limit = 1 prevents containers from accessing IMDS
  # through the host network (relevant if running Docker on the instance).
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  # Bootstrap script: update packages and install CloudWatch agent
  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail

    # Update system packages
    dnf update -y

    # Install and start the CloudWatch agent for log/metric collection
    dnf install -y amazon-cloudwatch-agent
    systemctl enable amazon-cloudwatch-agent
    systemctl start amazon-cloudwatch-agent

    # Log bootstrap completion
    echo "Bootstrap completed at $(date -u)" >> /var/log/bootstrap.log
  EOF

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-ec2"
  })

  # Prevent accidental destruction in production
  lifecycle {
    prevent_destroy = false  # Set to true for production
  }
}
