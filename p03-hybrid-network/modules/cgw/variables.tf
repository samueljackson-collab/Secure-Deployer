###############################################################################
# CGW Module - Variables
###############################################################################

variable "cgw_ip_address" {
  description = "Public IP address of the on-premises VPN device."
  type        = string

  validation {
    condition     = can(regex("^(\\d{1,3}\\.){3}\\d{1,3}$", var.cgw_ip_address))
    error_message = "cgw_ip_address must be a valid IPv4 address."
  }
}

variable "cgw_bgp_asn" {
  description = "BGP Autonomous System Number of the on-premises device."
  type        = number

  validation {
    condition     = var.cgw_bgp_asn >= 1 && var.cgw_bgp_asn <= 4294967295
    error_message = "cgw_bgp_asn must be a valid BGP ASN (1-4294967295)."
  }
}

variable "cgw_name" {
  description = "Name tag for the Customer Gateway."
  type        = string
}

variable "cgw_type" {
  description = "Type of VPN connection the CGW supports. Must be ipsec.1."
  type        = string
  default     = "ipsec.1"

  validation {
    condition     = var.cgw_type == "ipsec.1"
    error_message = "cgw_type must be 'ipsec.1' (the only supported type for AWS Site-to-Site VPN)."
  }
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
