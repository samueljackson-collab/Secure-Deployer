###############################################################################
# CGW Module - Outputs
###############################################################################

output "cgw_id" {
  description = "ID of the Customer Gateway."
  value       = aws_customer_gateway.this.id
}

output "cgw_arn" {
  description = "ARN of the Customer Gateway."
  value       = aws_customer_gateway.this.arn
}

output "cgw_bgp_asn" {
  description = "BGP ASN of the Customer Gateway."
  value       = aws_customer_gateway.this.bgp_asn
}

output "cgw_ip_address" {
  description = "Public IP address of the Customer Gateway."
  value       = aws_customer_gateway.this.ip_address
}
