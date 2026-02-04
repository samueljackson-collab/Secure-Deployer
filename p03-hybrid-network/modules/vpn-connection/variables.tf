###############################################################################
# VPN Connection Module - Variables
###############################################################################

variable "vgw_id" {
  description = "ID of the Virtual Private Gateway (AWS-side VPN endpoint)."
  type        = string
}

variable "cgw_id" {
  description = "ID of the Customer Gateway (on-premises VPN endpoint)."
  type        = string
}

variable "vpn_name" {
  description = "Name tag for the VPN connection."
  type        = string
}

variable "static_routes_only" {
  description = "Use static routes only (true) or BGP dynamic routing (false)."
  type        = bool
  default     = false
}

variable "on_prem_cidrs" {
  description = "On-premises CIDR blocks for static VPN routes. Only used when static_routes_only is true."
  type        = list(string)
  default     = []
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)."
  type        = string
}

# -- Tunnel Configuration (optional) -----------------------------------------

variable "tunnel1_preshared_key" {
  description = "Pre-shared key for tunnel 1. 8-64 chars. Sensitive. Null lets AWS auto-generate."
  type        = string
  default     = null
  sensitive   = true
}

variable "tunnel2_preshared_key" {
  description = "Pre-shared key for tunnel 2. 8-64 chars. Sensitive. Null lets AWS auto-generate."
  type        = string
  default     = null
  sensitive   = true
}

variable "tunnel1_inside_cidr" {
  description = "Inside tunnel CIDR for tunnel 1 (/30 in 169.254.0.0/16). Null lets AWS auto-assign."
  type        = string
  default     = null
}

variable "tunnel2_inside_cidr" {
  description = "Inside tunnel CIDR for tunnel 2 (/30 in 169.254.0.0/16). Null lets AWS auto-assign."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to all resources."
  type        = map(string)
  default     = {}
}
