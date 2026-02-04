# =============================================================================
# Azure Compute Module - Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names (e.g., 'myapp-staging')"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "azure_location" {
  description = "Azure region for deployment"
  type        = string
}

variable "vm_size" {
  description = "Azure VM size"
  type        = string
  default     = "Standard_B1s"
}

variable "ssh_public_key" {
  description = "SSH public key content for VM authentication"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed for SSH inbound access"
  type        = string
  default     = "0.0.0.0/0"
}

variable "os_disk_size_gb" {
  description = "Size of the OS managed disk in GB"
  type        = number
  default     = 30
}

variable "admin_username" {
  description = "Admin username for the Linux VM"
  type        = string
  default     = "azureadmin"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
