###############################################################################
# VPC Module
#
# Creates a production-grade VPC with:
#   - Public subnets (with Internet Gateway route)
#   - Private subnets (with NAT Gateway route for outbound internet)
#   - Separate route tables for public and private subnets
#   - NAT Gateway with Elastic IP for private subnet egress
#   - DNS support and hostnames enabled
#
# Design Decisions:
#   - One NAT Gateway in the first AZ for cost efficiency. For HA production,
#     deploy one NAT GW per AZ (modify the nat_gateway resource to use count).
#   - VPC Flow Logs are enabled for security monitoring and compliance.
#   - All subnets are tagged with Kubernetes-compatible labels for future EKS.
###############################################################################

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = var.enable_dns_support
  enable_dns_hostnames = var.enable_dns_hostnames

  tags = merge(var.tags, {
    Name = "${var.vpc_name}-vpc"
  })
}

# -----------------------------------------------------------------------------
# Internet Gateway
# Required for public subnets to reach the internet.
# -----------------------------------------------------------------------------
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.vpc_name}-igw"
  })
}

# -----------------------------------------------------------------------------
# Public Subnets
# These subnets have a route to the Internet Gateway. Instances launched here
# can receive a public IP and be directly reachable from the internet.
# -----------------------------------------------------------------------------
resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.vpc_name}-public-${var.availability_zones[count.index]}"
    Tier = "public"
  })
}

# -----------------------------------------------------------------------------
# Private Subnets
# These subnets route through a NAT Gateway for outbound internet access.
# VPN traffic from on-premises arrives in these subnets via the VGW.
# -----------------------------------------------------------------------------
resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.private_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = merge(var.tags, {
    Name = "${var.vpc_name}-private-${var.availability_zones[count.index]}"
    Tier = "private"
  })
}

# -----------------------------------------------------------------------------
# Elastic IP for NAT Gateway
# A static public IP that persists across NAT Gateway replacements.
# -----------------------------------------------------------------------------
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.vpc_name}-nat-eip"
  })

  # Ensure the IGW exists before allocating the EIP.
  depends_on = [aws_internet_gateway.this]
}

# -----------------------------------------------------------------------------
# NAT Gateway
# Allows private subnet instances to initiate outbound internet connections
# without exposing them to inbound traffic from the internet.
# Placed in the first public subnet for cost optimization.
# -----------------------------------------------------------------------------
resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = merge(var.tags, {
    Name = "${var.vpc_name}-nat-gw"
  })

  depends_on = [aws_internet_gateway.this]
}

# -----------------------------------------------------------------------------
# Public Route Table
# Routes all non-local traffic to the Internet Gateway.
# -----------------------------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.vpc_name}-public-rt"
  })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# -----------------------------------------------------------------------------
# Private Route Tables (one per AZ for future HA NAT Gateway support)
# Routes outbound internet traffic through the NAT Gateway.
# VGW route propagation will be enabled by the vgw module.
# -----------------------------------------------------------------------------
resource "aws_route_table" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.vpc_name}-private-rt-${var.availability_zones[count.index]}"
  })
}

resource "aws_route" "private_nat" {
  count = length(var.private_subnet_cidrs)

  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# -----------------------------------------------------------------------------
# VPC Flow Logs
# Captures all traffic metadata for security analysis and compliance.
# Logs are stored in CloudWatch with a 30-day retention.
# -----------------------------------------------------------------------------
resource "aws_flow_log" "this" {
  vpc_id          = aws_vpc.this.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn

  tags = merge(var.tags, {
    Name = "${var.vpc_name}-flow-log"
  })
}

resource "aws_cloudwatch_log_group" "flow_log" {
  name              = "/aws/vpc/flow-log/${var.vpc_name}"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name = "${var.vpc_name}-flow-log-group"
  })
}

resource "aws_iam_role" "flow_log" {
  name = "${var.vpc_name}-flow-log-role"

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

  tags = var.tags
}

resource "aws_iam_role_policy" "flow_log" {
  name = "${var.vpc_name}-flow-log-policy"
  role = aws_iam_role.flow_log.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}
