###############################################################################
# Virtual Private Gateway (VGW) Module
#
# Creates and attaches a Virtual Private Gateway to the VPC. The VGW is the
# AWS-side endpoint for the Site-to-Site VPN connection.
#
# Key behaviors:
#   - The VGW is attached to the VPC and becomes the target for VPN tunnels.
#   - Route propagation is enabled on private route tables so that on-premises
#     CIDRs learned via BGP (or static routes) are automatically injected.
#   - The Amazon-side BGP ASN is configurable for BGP peering with on-prem.
#
# Design Decisions:
#   - Route propagation is enabled on ALL private route tables to ensure
#     consistent reachability across availability zones.
#   - Only one VGW per VPC is supported by AWS.
###############################################################################

# -----------------------------------------------------------------------------
# Virtual Private Gateway
# The AWS-side termination point for the IPsec VPN tunnels.
# -----------------------------------------------------------------------------
resource "aws_vpn_gateway" "this" {
  vpc_id          = var.vpc_id
  amazon_side_asn = var.amazon_side_asn

  tags = merge(var.tags, {
    Name        = var.vgw_name
    Environment = var.environment
  })
}

# -----------------------------------------------------------------------------
# Route Propagation
# Enables automatic injection of routes learned from the VPN (via BGP or
# static) into the specified private route tables. This ensures that
# on-premises CIDRs are routable from private subnets without manual route
# management.
# -----------------------------------------------------------------------------
resource "aws_vpn_gateway_route_propagation" "private" {
  count = length(var.private_route_table_ids)

  vpn_gateway_id = aws_vpn_gateway.this.id
  route_table_id = var.private_route_table_ids[count.index]
}
