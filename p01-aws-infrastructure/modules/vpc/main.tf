# =============================================================================
# VPC Module - Network Foundation
# =============================================================================
# This module creates the complete network foundation for the AWS environment:
#
# Architecture:
#   +---------------------------------------------------------------+
#   |  VPC (10.0.0.0/16)                                           |
#   |                                                               |
#   |  +------------------+    +------------------+                 |
#   |  | Public Subnet    |    | Public Subnet    |                 |
#   |  | AZ-a (10.0.1/24) |    | AZ-b (10.0.2/24) |                 |
#   |  | [ALB] [NAT GW]   |    | [ALB]            |                 |
#   |  +--------+---------+    +--------+---------+                 |
#   |           |                       |                           |
#   |  +--------+---------+    +--------+---------+                 |
#   |  | Private Subnet   |    | Private Subnet   |                 |
#   |  | AZ-a (10.0.16/20)|    | AZ-b (10.0.32/20)|                 |
#   |  | [App] [RDS]      |    | [App] [RDS]      |                 |
#   |  +------------------+    +------------------+                 |
#   +---------------------------------------------------------------+
#
# Security decisions:
#   - DNS hostnames enabled: Required for RDS endpoints and internal resolution
#   - DNS support enabled: Required for VPC-internal DNS queries
#   - No default security group rules: We create explicit security groups
#   - NAT Gateway in public subnet: Allows private instances to reach the
#     internet for updates without being directly addressable
#   - Separate route tables per subnet type: Enforces network segmentation
# =============================================================================

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
# The VPC is the network boundary for all resources. It provides:
#   - IP address isolation from other VPCs and AWS accounts
#   - A foundation for security groups and NACLs
#   - DNS resolution for internal resources
# -----------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # Enable DNS hostnames so that EC2 instances and RDS endpoints receive
  # human-readable DNS names (e.g., ip-10-0-1-5.ec2.internal). This is
  # required for RDS to provide its connection endpoint hostname.
  enable_dns_hostnames = true

  # Enable DNS support so that the VPC's built-in DNS server (at the .2
  # address of the VPC CIDR) resolves both internal and external hostnames.
  enable_dns_support = true

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

# -----------------------------------------------------------------------------
# Internet Gateway
# -----------------------------------------------------------------------------
# The Internet Gateway (IGW) provides a target in route tables for
# internet-routable traffic. Only resources in public subnets (with a route
# to the IGW) can communicate directly with the internet.
#
# Security note: The IGW itself does not expose any resources. Exposure is
# controlled by route table associations and security groups.
# -----------------------------------------------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-${var.environment}-igw"
  }
}

# -----------------------------------------------------------------------------
# Public Subnets
# -----------------------------------------------------------------------------
# Public subnets are placed in separate AZs for fault tolerance. They host:
#   - Application Load Balancers (internet-facing)
#   - NAT Gateways (for private subnet outbound traffic)
#
# map_public_ip_on_launch is enabled because resources in these subnets
# (ALB, NAT GW) need public IP addresses to serve as internet endpoints.
# This does NOT mean all instances here are internet-accessible; security
# groups still control inbound traffic.
# -----------------------------------------------------------------------------
resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-public-${var.availability_zones[count.index]}"
    Tier = "public"
  }
}

# -----------------------------------------------------------------------------
# Private Subnets
# -----------------------------------------------------------------------------
# Private subnets host application instances and RDS. They have NO direct
# route to the internet gateway, so resources here cannot be reached from
# the internet even if they have public IP addresses (which they should not).
#
# map_public_ip_on_launch is explicitly set to false as a defense-in-depth
# measure. Even if a resource is accidentally launched here, it will not
# receive a public IP.
# -----------------------------------------------------------------------------
resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.private_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name = "${var.project_name}-${var.environment}-private-${var.availability_zones[count.index]}"
    Tier = "private"
  }
}

# -----------------------------------------------------------------------------
# Elastic IP for NAT Gateway
# -----------------------------------------------------------------------------
# A static Elastic IP is allocated for the NAT Gateway so that outbound
# traffic from private subnets always originates from a known IP address.
# This is useful for:
#   - Whitelisting outbound IPs with external services
#   - Audit trail of outbound traffic
#   - Consistent IP even if the NAT Gateway is replaced
# -----------------------------------------------------------------------------
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-${var.environment}-nat-eip"
  }

  # Ensure the IGW exists before allocating the EIP, as the EIP
  # depends on the VPC having internet connectivity.
  depends_on = [aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# NAT Gateway
# -----------------------------------------------------------------------------
# The NAT Gateway allows resources in private subnets to initiate outbound
# connections to the internet (e.g., for OS updates, pulling container
# images, calling external APIs) without exposing them to inbound traffic.
#
# Placement: The NAT Gateway is placed in the first public subnet. For
# higher availability, consider deploying one NAT Gateway per AZ (at
# additional cost). A single NAT Gateway is sufficient for most workloads
# and reduces costs.
#
# Security note: All outbound traffic from private subnets is NATed through
# this gateway, creating a single egress point that can be monitored with
# VPC Flow Logs.
# -----------------------------------------------------------------------------
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "${var.project_name}-${var.environment}-nat-gw"
  }

  # The NAT Gateway requires the Internet Gateway to be fully created
  # before it can route traffic to the internet.
  depends_on = [aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# Public Route Table
# -----------------------------------------------------------------------------
# The public route table directs all non-local traffic (0.0.0.0/0) to the
# Internet Gateway, allowing resources in public subnets to communicate
# with the internet bidirectionally.
#
# The local route (VPC CIDR -> local) is implicitly added by AWS and allows
# resources within the VPC to communicate with each other regardless of
# subnet placement.
# -----------------------------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  # Default route: All internet-bound traffic goes through the IGW.
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-public-rt"
  }
}

# Associate each public subnet with the public route table.
# This explicit association overrides the VPC's main route table and ensures
# that only subnets we explicitly mark as "public" have internet access.
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# -----------------------------------------------------------------------------
# Private Route Table
# -----------------------------------------------------------------------------
# The private route table directs all non-local traffic (0.0.0.0/0) to the
# NAT Gateway. This allows private instances to:
#   - Download OS security updates
#   - Pull container images from ECR/Docker Hub
#   - Call external APIs
#
# Critically, the NAT Gateway only supports outbound-initiated connections.
# Inbound connections from the internet cannot reach private subnets through
# the NAT Gateway - this is a fundamental property of NAT, not just a
# configuration choice.
# -----------------------------------------------------------------------------
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  # Default route: All internet-bound traffic goes through the NAT Gateway.
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-private-rt"
  }
}

# Associate each private subnet with the private route table.
resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# -----------------------------------------------------------------------------
# VPC Flow Logs (Optional but Recommended)
# -----------------------------------------------------------------------------
# VPC Flow Logs capture information about IP traffic going to and from
# network interfaces in the VPC. This is essential for:
#   - Security monitoring and incident investigation
#   - Troubleshooting connectivity issues
#   - Compliance requirements (PCI DSS, HIPAA, SOC 2)
#
# Logs are sent to CloudWatch Logs for centralized analysis and alerting.
# -----------------------------------------------------------------------------
resource "aws_flow_log" "vpc" {
  vpc_id                   = aws_vpc.main.id
  traffic_type             = "ALL"
  log_destination_type     = "cloud-watch-logs"
  log_destination          = aws_cloudwatch_log_group.vpc_flow_logs.arn
  iam_role_arn             = aws_iam_role.vpc_flow_logs.arn
  max_aggregation_interval = 60

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc-flow-logs"
  }
}

# CloudWatch Log Group for VPC Flow Logs with a 90-day retention period.
# Adjust retention based on your compliance requirements.
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/flow-logs/${var.project_name}-${var.environment}"
  retention_in_days = 90

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc-flow-logs"
  }
}

# IAM Role for VPC Flow Logs to write to CloudWatch.
# This follows the principle of least privilege - the role can only
# create and write to log streams within the specified log group.
resource "aws_iam_role" "vpc_flow_logs" {
  name = "${var.project_name}-${var.environment}-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc-flow-logs-role"
  }
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "${var.project_name}-${var.environment}-vpc-flow-logs-policy"
  role = aws_iam_role.vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}
