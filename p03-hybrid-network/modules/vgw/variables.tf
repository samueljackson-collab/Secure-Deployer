###############################################################################
# VGW Module - Variables
###############################################################################

variable "vpc_id" {
  description = "ID of the VPC to attach the Virtual Private Gateway to."
  type        = string
}

variable "vgw_name" {
  description = "Name tag for the Virtual Private Gateway."
  type        = string
}

variable "amazon_side_asn" {
  description = "BGP ASN for the Amazon side of the VPN gateway. Must be in the private ASN range."
  type        = number
  default     = 64512

  validation {
    condition     = var.amazon_side_asn >= 64512 && var.amazon_side_asn <= 65534
    error_message = "amazon_side_asn must be a valid private ASN between 64512 and 65534."
  }
}

variable "private_route_table_ids" {
  description = "List of private route table IDs to enable VGW route propagation on."
  type        = list(string)
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)."
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources."
  type        = map(string)
  default     = {}
}
