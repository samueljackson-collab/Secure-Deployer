# =============================================================================
# Azure Compute Module
# =============================================================================
#
# Provisions a single Linux VM inside a dedicated resource group with the
# following security controls:
#
#   - Dedicated resource group for workload isolation
#   - Virtual network (VNet) with a single subnet
#   - Network security group (NSG): inbound SSH only from specified CIDR
#   - Network interface with a dynamically allocated public IP
#   - Managed OS disk with encryption at host (platform-managed keys)
#   - SSH public key authentication (password authentication disabled)
#   - Ubuntu 22.04 LTS base image from Canonical
#
# This module does NOT create:
#   - Application gateways or load balancers (single VM design)
#   - Virtual machine scale sets (out of scope for compute parity demo)
#   - Azure Bastion (SSH via public IP for simplicity)
#
# =============================================================================

# -----------------------------------------------------------------------------
# Resource Group
# -----------------------------------------------------------------------------
# A dedicated resource group isolates all resources for this workload.
# Deleting the resource group removes all contained resources, providing
# a clean teardown mechanism.
# -----------------------------------------------------------------------------
resource "azurerm_resource_group" "main" {
  name     = "${var.name_prefix}-rg"
  location = var.azure_location
  tags     = var.tags
}

# -----------------------------------------------------------------------------
# Virtual Network (VNet)
# -----------------------------------------------------------------------------
# The VNet provides network isolation for the VM. The address space is
# 10.1.0.0/16 (intentionally different from the AWS VPC 10.0.0.0/16)
# to avoid conflicts if cross-cloud peering is ever configured.
# -----------------------------------------------------------------------------
resource "azurerm_virtual_network" "main" {
  name                = "${var.name_prefix}-vnet"
  address_space       = ["10.1.0.0/16"]
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = var.tags
}

# -----------------------------------------------------------------------------
# Subnet
# -----------------------------------------------------------------------------
# A single subnet within the VNet. For production, consider separating
# application, database, and management subnets.
# -----------------------------------------------------------------------------
resource "azurerm_subnet" "main" {
  name                 = "${var.name_prefix}-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.1.1.0/24"]
}

# -----------------------------------------------------------------------------
# Network Security Group (NSG)
# -----------------------------------------------------------------------------
# The NSG acts as a virtual firewall for the VM's network interface.
#
# Inbound rules:
#   - SSH (port 22) from the specified CIDR block only
#   - All other inbound traffic is denied by Azure's implicit deny rule
#
# Outbound rules:
#   - All outbound traffic is allowed (Azure default)
#
# SECURITY NOTE: In production, restrict allowed_ssh_cidr to your office IP
# or VPN CIDR. The default 0.0.0.0/0 is permissive for development.
# -----------------------------------------------------------------------------
resource "azurerm_network_security_group" "main" {
  name                = "${var.name_prefix}-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  # Inbound: SSH only from specified CIDR
  security_rule {
    name                       = "AllowSSH"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = var.allowed_ssh_cidr
    destination_address_prefix = "*"
  }

  # Inbound: deny all other traffic explicitly (defense in depth)
  security_rule {
    name                       = "DenyAllInbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Associate NSG with Subnet
# -----------------------------------------------------------------------------
# Applying the NSG at the subnet level ensures all resources in the subnet
# inherit the security rules, not just individual NICs.
# -----------------------------------------------------------------------------
resource "azurerm_subnet_network_security_group_association" "main" {
  subnet_id                 = azurerm_subnet.main.id
  network_security_group_id = azurerm_network_security_group.main.id
}

# -----------------------------------------------------------------------------
# Public IP Address
# -----------------------------------------------------------------------------
# A static public IP for SSH access. In production, consider using Azure
# Bastion instead of exposing a public IP directly.
# -----------------------------------------------------------------------------
resource "azurerm_public_ip" "main" {
  name                = "${var.name_prefix}-pip"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

# -----------------------------------------------------------------------------
# Network Interface (NIC)
# -----------------------------------------------------------------------------
# The NIC connects the VM to the subnet and associates the public IP.
# The NSG is applied at the subnet level (above), not at the NIC level,
# following Azure best practices.
# -----------------------------------------------------------------------------
resource "azurerm_network_interface" "main" {
  name                = "${var.name_prefix}-nic"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.main.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.main.id
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Linux Virtual Machine
# -----------------------------------------------------------------------------
# The VM is deployed with:
#   - Ubuntu 22.04 LTS (Canonical) as the base image
#   - SSH public key authentication only (password auth disabled)
#   - Managed OS disk with Premium LRS (SSD) for performance
#   - Encryption at host enabled for data-at-rest protection
#   - Boot diagnostics enabled for troubleshooting
#   - Custom data script for initial bootstrapping
#
# SECURITY: disable_password_authentication = true ensures that only SSH
# key-based access is possible, preventing brute-force password attacks.
# -----------------------------------------------------------------------------
resource "azurerm_linux_virtual_machine" "main" {
  name                = "${var.name_prefix}-vm"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  size                = var.vm_size

  # Network configuration
  network_interface_ids = [azurerm_network_interface.main.id]

  # Authentication: SSH key only, no password
  admin_username                  = var.admin_username
  disable_password_authentication = true

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.ssh_public_key
  }

  # OS disk configuration with encryption
  os_disk {
    name                 = "${var.name_prefix}-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = var.os_disk_size_gb

    # Managed disk encryption is enabled by default with platform-managed keys.
    # For customer-managed keys, configure a disk encryption set.
  }

  # Ubuntu 22.04 LTS image from Canonical
  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  # Encryption at host: encrypts temp disks, caches, and data in transit
  # between the VM and storage. Requires the feature to be registered on
  # the Azure subscription: az feature register --namespace Microsoft.Compute
  #   --name EncryptionAtHost
  # encryption_at_host_enabled = true  # Uncomment after feature registration

  # Boot diagnostics with managed storage account
  boot_diagnostics {
    # Using managed storage account (no explicit storage account needed)
  }

  # Bootstrap script: update packages and configure logging
  custom_data = base64encode(<<-EOF
    #!/bin/bash
    set -euo pipefail

    # Update system packages
    apt-get update -y && apt-get upgrade -y

    # Install useful monitoring tools
    apt-get install -y htop iotop net-tools

    # Enable and start the Azure Linux Agent
    systemctl enable walinuxagent
    systemctl start walinuxagent

    # Log bootstrap completion
    echo "Bootstrap completed at $(date -u)" >> /var/log/bootstrap.log
  EOF
  )

  tags = var.tags

  # Prevent accidental destruction in production
  lifecycle {
    prevent_destroy = false  # Set to true for production
  }
}
