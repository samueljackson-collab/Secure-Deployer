# =============================================================================
# Azure Compute Module - Outputs
# =============================================================================

output "vm_id" {
  description = "Azure Linux VM resource ID"
  value       = azurerm_linux_virtual_machine.main.id
}

output "public_ip" {
  description = "Public IP address of the Azure Linux VM"
  value       = azurerm_public_ip.main.ip_address
}

output "private_ip" {
  description = "Private IP address of the Azure Linux VM"
  value       = azurerm_network_interface.main.private_ip_address
  sensitive   = true
}

output "resource_group_name" {
  description = "Azure resource group name"
  value       = azurerm_resource_group.main.name
}

output "vnet_id" {
  description = "Azure virtual network ID"
  value       = azurerm_virtual_network.main.id
}

output "subnet_id" {
  description = "Azure subnet ID"
  value       = azurerm_subnet.main.id
}

output "nsg_id" {
  description = "Azure network security group ID"
  value       = azurerm_network_security_group.main.id
}

output "nic_id" {
  description = "Azure network interface ID"
  value       = azurerm_network_interface.main.id
}
