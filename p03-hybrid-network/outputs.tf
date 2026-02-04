###############################################################################
# P03 Hybrid Network - Root Outputs
#
# Exposes key resource identifiers and VPN tunnel details for downstream
# consumers, monitoring dashboards, and on-premises configuration.
###############################################################################

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
output "vpc_id" {
  description = "ID of the created VPC."
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC."
  value       = module.vpc.vpc_cidr
}

output "public_subnet_ids" {
  description = "IDs of the public subnets."
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets."
  value       = module.vpc.private_subnet_ids
}

output "nat_gateway_public_ip" {
  description = "Elastic IP address of the NAT gateway."
  value       = module.vpc.nat_gateway_public_ip
}

# -----------------------------------------------------------------------------
# Virtual Private Gateway
# -----------------------------------------------------------------------------
output "vgw_id" {
  description = "ID of the Virtual Private Gateway."
  value       = module.vgw.vgw_id
}

# -----------------------------------------------------------------------------
# Customer Gateway
# -----------------------------------------------------------------------------
output "cgw_id" {
  description = "ID of the Customer Gateway."
  value       = module.cgw.cgw_id
}

# -----------------------------------------------------------------------------
# VPN Connection
# -----------------------------------------------------------------------------
output "vpn_connection_id" {
  description = "ID of the Site-to-Site VPN connection."
  value       = module.vpn_connection.vpn_connection_id
}

output "vpn_tunnel1_address" {
  description = "Public IP address of VPN tunnel 1 (AWS side)."
  value       = module.vpn_connection.tunnel1_address
}

output "vpn_tunnel2_address" {
  description = "Public IP address of VPN tunnel 2 (AWS side)."
  value       = module.vpn_connection.tunnel2_address
}

output "vpn_tunnel1_bgp_asn" {
  description = "BGP ASN of VPN tunnel 1 (AWS side)."
  value       = module.vpn_connection.tunnel1_bgp_asn
}

output "vpn_tunnel2_bgp_asn" {
  description = "BGP ASN of VPN tunnel 2 (AWS side)."
  value       = module.vpn_connection.tunnel2_bgp_asn
}

output "vpn_tunnel1_inside_cidr" {
  description = "Inside CIDR of VPN tunnel 1."
  value       = module.vpn_connection.tunnel1_cgw_inside_address
}

output "vpn_tunnel2_inside_cidr" {
  description = "Inside CIDR of VPN tunnel 2."
  value       = module.vpn_connection.tunnel2_cgw_inside_address
}

# -----------------------------------------------------------------------------
# Security Groups
# -----------------------------------------------------------------------------
output "vpn_traffic_sg_id" {
  description = "Security group ID for VPN-originated traffic."
  value       = module.security_groups.vpn_traffic_sg_id
}

output "bastion_sg_id" {
  description = "Security group ID for bastion host access."
  value       = module.security_groups.bastion_sg_id
}

output "internal_sg_id" {
  description = "Security group ID for internal VPC communication."
  value       = module.security_groups.internal_sg_id
}
