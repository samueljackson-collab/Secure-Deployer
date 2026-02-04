###############################################################################
# Customer Gateway (CGW) Module
#
# Creates an AWS Customer Gateway resource representing the on-premises VPN
# device (router, firewall, or software VPN appliance).
#
# The CGW defines:
#   - The public IP address of the on-premises VPN endpoint
#   - The BGP ASN used by the on-premises device
#   - The VPN type (always ipsec.1 for AWS Site-to-Site VPN)
#
# Design Decisions:
#   - The CGW is a logical representation only; it does not create any
#     infrastructure. It tells AWS where to expect the on-prem tunnel endpoint.
#   - BGP ASN must match the actual configuration on the on-premises device.
#   - If the on-prem public IP changes, the CGW must be recreated. Use a
#     lifecycle rule to create_before_destroy if needed.
###############################################################################

# -----------------------------------------------------------------------------
# Customer Gateway
# Represents the on-premises VPN device. AWS uses this information to
# configure its side of the IPsec tunnels.
# -----------------------------------------------------------------------------
resource "aws_customer_gateway" "this" {
  bgp_asn    = var.cgw_bgp_asn
  ip_address = var.cgw_ip_address
  type       = var.cgw_type

  tags = merge(var.tags, {
    Name        = var.cgw_name
    Environment = var.environment
    Description = "On-premises VPN endpoint at ${var.cgw_ip_address}"
  })

  lifecycle {
    # Create the new CGW before destroying the old one during IP changes.
    # This minimizes VPN downtime during CGW replacement.
    create_before_destroy = true
  }
}
