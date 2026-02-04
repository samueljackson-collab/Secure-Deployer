###############################################################################
# VPN Connection Module - Outputs
###############################################################################

output "vpn_connection_id" {
  description = "ID of the VPN connection."
  value       = aws_vpn_connection.this.id
}

output "vpn_connection_arn" {
  description = "ARN of the VPN connection."
  value       = aws_vpn_connection.this.arn
}

# -- Tunnel 1 ----------------------------------------------------------------

output "tunnel1_address" {
  description = "Public IP address of VPN tunnel 1 (AWS side)."
  value       = aws_vpn_connection.this.tunnel1_address
}

output "tunnel1_bgp_asn" {
  description = "BGP ASN of tunnel 1 (AWS side)."
  value       = aws_vpn_connection.this.tunnel1_bgp_asn
}

output "tunnel1_bgp_holdtime" {
  description = "BGP hold time for tunnel 1."
  value       = aws_vpn_connection.this.tunnel1_bgp_holdtime
}

output "tunnel1_cgw_inside_address" {
  description = "CGW inside IP address for tunnel 1."
  value       = aws_vpn_connection.this.tunnel1_cgw_inside_address
}

output "tunnel1_vgw_inside_address" {
  description = "VGW inside IP address for tunnel 1."
  value       = aws_vpn_connection.this.tunnel1_vgw_inside_address
}

output "tunnel1_preshared_key" {
  description = "Pre-shared key for tunnel 1 (auto-generated if not specified)."
  value       = aws_vpn_connection.this.tunnel1_preshared_key
  sensitive   = true
}

# -- Tunnel 2 ----------------------------------------------------------------

output "tunnel2_address" {
  description = "Public IP address of VPN tunnel 2 (AWS side)."
  value       = aws_vpn_connection.this.tunnel2_address
}

output "tunnel2_bgp_asn" {
  description = "BGP ASN of tunnel 2 (AWS side)."
  value       = aws_vpn_connection.this.tunnel2_bgp_asn
}

output "tunnel2_bgp_holdtime" {
  description = "BGP hold time for tunnel 2."
  value       = aws_vpn_connection.this.tunnel2_bgp_holdtime
}

output "tunnel2_cgw_inside_address" {
  description = "CGW inside IP address for tunnel 2."
  value       = aws_vpn_connection.this.tunnel2_cgw_inside_address
}

output "tunnel2_vgw_inside_address" {
  description = "VGW inside IP address for tunnel 2."
  value       = aws_vpn_connection.this.tunnel2_vgw_inside_address
}

output "tunnel2_preshared_key" {
  description = "Pre-shared key for tunnel 2 (auto-generated if not specified)."
  value       = aws_vpn_connection.this.tunnel2_preshared_key
  sensitive   = true
}

# -- Alarm --------------------------------------------------------------------

output "tunnel_alarm_arn" {
  description = "ARN of the CloudWatch alarm for tunnel health."
  value       = aws_cloudwatch_metric_alarm.tunnel_down.arn
}
