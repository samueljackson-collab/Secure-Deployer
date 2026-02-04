# P17: Terraform Multi-Cloud Infrastructure

## Overview

This project implements a **multi-cloud compute deployment strategy** using Terraform, provisioning equivalent infrastructure across **AWS** and **Azure**. The goal is to eliminate single-cloud vendor lock-in, improve geographic redundancy, and maintain a consistent security posture across cloud providers.

## Multi-Cloud Strategy

| Concern | Approach |
|---|---|
| **Vendor Lock-in** | Abstract compute behind Terraform modules with unified variable interfaces |
| **Parity** | AWS EC2 and Azure Linux VM modules expose identical logical outputs (instance ID, public IP, private IP) |
| **Security Baseline** | Both modules enforce encryption at rest, SSH-key-only auth, restrictive network security groups, and IMDSv2 (AWS) |
| **Cost Visibility** | Outputs include resource identifiers for cost-tagging integration |
| **Disaster Recovery** | Deploy to both clouds simultaneously; failover at DNS layer |

## AWS and Azure Parity Matrix

| Feature | AWS Module | Azure Module |
|---|---|---|
| Compute | EC2 instance (t3.micro default) | Linux VM (Standard_B1s default) |
| Network | VPC + Subnet + Security Group | VNet + Subnet + NSG |
| Disk Encryption | EBS encryption enabled | Managed disk encryption at host |
| Auth | SSH key pair | SSH public key on VM |
| Metadata Protection | IMDSv2 required | N/A (Azure IMDS is read-only by design) |
| OS | Amazon Linux 2023 | Ubuntu 22.04 LTS |

## Module Structure

```
.
├── main.tf                          # Root module: wires AWS and Azure modules
├── variables.tf                     # Shared input variables
├── outputs.tf                       # Aggregated outputs from both clouds
├── providers.tf                     # AWS and AzureRM provider configs
├── modules/
│   ├── aws-compute/
│   │   ├── main.tf                  # EC2 + VPC + SG + EBS encryption
│   │   ├── variables.tf             # AWS-specific variables
│   │   └── outputs.tf               # AWS resource outputs
│   └── azure-compute/
│       ├── main.tf                  # VM + VNet + NSG + managed disk
│       ├── variables.tf             # Azure-specific variables
│       └── outputs.tf               # Azure resource outputs
├── docs/
│   ├── threat-model.md              # STRIDE analysis for multi-cloud
│   └── adr/
│       └── 001-use-terraform-for-multi-cloud.md
└── CHANGELOG.md
```

## Prerequisites

- Terraform >= 1.5.0
- AWS CLI configured (`aws configure`) with appropriate IAM permissions
- Azure CLI authenticated (`az login`) with a valid subscription
- SSH key pair generated locally (`~/.ssh/id_rsa.pub`)

## Deployment

### Initialize

```bash
terraform init
```

### Plan

```bash
terraform plan \
  -var="environment=staging" \
  -var="project_name=myapp" \
  -var="aws_region=us-east-1" \
  -var="azure_location=eastus"
```

### Apply

```bash
terraform apply \
  -var="environment=staging" \
  -var="project_name=myapp" \
  -auto-approve
```

### Destroy

```bash
terraform destroy \
  -var="environment=staging" \
  -var="project_name=myapp" \
  -auto-approve
```

## Environment Variables

Alternatively, export variables instead of passing them inline:

```bash
export TF_VAR_environment="production"
export TF_VAR_project_name="myapp"
export TF_VAR_aws_region="us-west-2"
export TF_VAR_azure_location="westus2"
export TF_VAR_ssh_public_key_path="~/.ssh/id_rsa.pub"
```

## Security Considerations

- All storage volumes are encrypted at rest by default.
- SSH is the only allowed inbound protocol; password authentication is disabled.
- AWS instances require IMDSv2 to mitigate SSRF-based credential theft.
- Network security groups restrict inbound traffic to port 22 from a configurable CIDR.
- See `docs/threat-model.md` for the full STRIDE analysis.

## License

MIT
