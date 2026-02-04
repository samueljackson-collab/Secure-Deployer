###############################################################################
# VPN Connection Module
#
# Creates an AWS Site-to-Site VPN connection between a Virtual Private Gateway
# (VGW) and a Customer Gateway (CGW). This establishes two redundant IPsec
# tunnels for high availability.
#
# Features:
#   - Support for both static and dynamic (BGP) routing
#   - Configurable pre-shared keys for each tunnel
#   - Configurable inside tunnel CIDRs for BGP peering
#   - Static route definitions for on-premises CIDRs
#   - CloudWatch tunnel state monitoring via built-in metrics
#
# Design Decisions:
#   - Two tunnels are always created by AWS for redundancy. Both should be
#     configured on the on-premises device.
#   - Pre-shared keys are marked sensitive and should be injected via
#     environment variables or a secrets manager.
#   - When using BGP (static_routes_only = false), route propagation on the
#     VGW automatically updates route tables. When using static routes,
#     explicit aws_vpn_connection_route resources are required.
###############################################################################

# -----------------------------------------------------------------------------
# Site-to-Site VPN Connection
# Creates two IPsec tunnels between the VGW and CGW.
# -----------------------------------------------------------------------------
resource "aws_vpn_connection" "this" {
  vpn_gateway_id      = var.vgw_id
  customer_gateway_id = var.cgw_id
  type                = "ipsec.1"
  static_routes_only  = var.static_routes_only

  # Tunnel 1 options (optional -- AWS auto-generates if null)
  tunnel1_preshared_key = var.tunnel1_preshared_key
  tunnel1_inside_cidr   = var.tunnel1_inside_cidr

  # Tunnel 2 options (optional -- AWS auto-generates if null)
  tunnel2_preshared_key = var.tunnel2_preshared_key
  tunnel2_inside_cidr   = var.tunnel2_inside_cidr

  tags = merge(var.tags, {
    Name        = var.vpn_name
    Environment = var.environment
  })
}

# -----------------------------------------------------------------------------
# Static Routes
# When using static routing (static_routes_only = true), define explicit
# routes to on-premises CIDRs. These routes are pushed to the VGW and
# propagated to associated route tables.
#
# When using BGP (static_routes_only = false), these are ignored -- BGP
# handles route advertisement dynamically.
# -----------------------------------------------------------------------------
resource "aws_vpn_connection_route" "static" {
  count = var.static_routes_only ? length(var.on_prem_cidrs) : 0

  vpn_connection_id      = aws_vpn_connection.this.id
  destination_cidr_block = var.on_prem_cidrs[count.index]
}

# -----------------------------------------------------------------------------
# CloudWatch Alarm - Tunnel Health
# Alerts when both tunnels are down simultaneously, indicating a complete
# VPN connectivity failure.
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "tunnel_down" {
  alarm_name          = "${var.vpn_name}-both-tunnels-down"
  alarm_description   = "Both VPN tunnels are DOWN for ${var.vpn_name}. Investigate immediately."
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TunnelState"
  namespace           = "AWS/VPN"
  period              = 300
  statistic           = "Maximum"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    VpnId = aws_vpn_connection.this.id
  }

  tags = merge(var.tags, {
    Name = "${var.vpn_name}-tunnel-alarm"
  })
}
