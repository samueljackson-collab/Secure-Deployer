###############################################################################
# VGW Module - Outputs
###############################################################################

output "vgw_id" {
  description = "ID of the Virtual Private Gateway."
  value       = aws_vpn_gateway.this.id
}

output "vgw_arn" {
  description = "ARN of the Virtual Private Gateway."
  value       = aws_vpn_gateway.this.arn
}

output "amazon_side_asn" {
  description = "BGP ASN of the Amazon side of the VPN gateway."
  value       = aws_vpn_gateway.this.amazon_side_asn
}
