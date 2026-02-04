# =============================================================================
# AWS Compute Module - Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names (e.g., 'myapp-staging')"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "ami_id" {
  description = "AMI ID for the EC2 instance. Leave empty to use the latest Amazon Linux 2023."
  type        = string
  default     = ""
}

variable "ssh_public_key" {
  description = "SSH public key content for the key pair"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed for SSH inbound access"
  type        = string
  default     = "0.0.0.0/0"
}

variable "root_volume_size" {
  description = "Size of the root EBS volume in GB"
  type        = number
  default     = 20
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
