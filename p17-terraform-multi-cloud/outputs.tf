# =============================================================================
# Root Module Outputs
# =============================================================================
# Aggregated outputs from both cloud modules, providing a unified view of
# the multi-cloud deployment.
# =============================================================================

# -----------------------------------------------------------------------------
# AWS Outputs
# -----------------------------------------------------------------------------

output "aws_instance_id" {
  description = "AWS EC2 instance ID"
  value       = module.aws_compute.instance_id
}

output "aws_public_ip" {
  description = "Public IP address of the AWS EC2 instance"
  value       = module.aws_compute.public_ip
}

output "aws_private_ip" {
  description = "Private IP address of the AWS EC2 instance"
  value       = module.aws_compute.private_ip
  sensitive   = true
}

output "aws_vpc_id" {
  description = "AWS VPC ID"
  value       = module.aws_compute.vpc_id
}

output "aws_security_group_id" {
  description = "AWS security group ID"
  value       = module.aws_compute.security_group_id
}

output "aws_ssh_command" {
  description = "SSH command to connect to the AWS instance"
  value       = "ssh -i ~/.ssh/id_rsa ec2-user@${module.aws_compute.public_ip}"
}

# -----------------------------------------------------------------------------
# Azure Outputs
# -----------------------------------------------------------------------------

output "azure_vm_id" {
  description = "Azure Linux VM resource ID"
  value       = module.azure_compute.vm_id
}

output "azure_public_ip" {
  description = "Public IP address of the Azure Linux VM"
  value       = module.azure_compute.public_ip
}

output "azure_private_ip" {
  description = "Private IP address of the Azure Linux VM"
  value       = module.azure_compute.private_ip
  sensitive   = true
}

output "azure_resource_group_name" {
  description = "Azure resource group name"
  value       = module.azure_compute.resource_group_name
}

output "azure_nsg_id" {
  description = "Azure network security group ID"
  value       = module.azure_compute.nsg_id
}

output "azure_ssh_command" {
  description = "SSH command to connect to the Azure VM"
  value       = "ssh -i ~/.ssh/id_rsa azureadmin@${module.azure_compute.public_ip}"
}

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

output "deployment_summary" {
  description = "Summary of multi-cloud deployment"
  value = {
    aws = {
      instance_id = module.aws_compute.instance_id
      public_ip   = module.aws_compute.public_ip
      region      = var.aws_region
    }
    azure = {
      vm_id     = module.azure_compute.vm_id
      public_ip = module.azure_compute.public_ip
      location  = var.azure_location
    }
    environment = var.environment
    project     = var.project_name
  }
}
