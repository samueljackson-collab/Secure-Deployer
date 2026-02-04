# Virtual Private Gateway (VGW) Module

## Purpose

Creates an AWS Virtual Private Gateway (VGW) and attaches it to a VPC. The VGW serves as the AWS-side termination point for Site-to-Site VPN tunnels. Route propagation is enabled on private route tables to automatically inject on-premises routes learned via BGP or static configuration.

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `vpc_id` | ID of the VPC to attach the VGW to | `string` | n/a | yes |
| `vgw_name` | Name tag for the VGW | `string` | n/a | yes |
| `amazon_side_asn` | BGP ASN for the AWS side (64512-65534) | `number` | `64512` | no |
| `private_route_table_ids` | Private route table IDs for route propagation | `list(string)` | n/a | yes |
| `environment` | Deployment environment | `string` | n/a | yes |
| `tags` | Tags to apply to all resources | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `vgw_id` | ID of the Virtual Private Gateway |
| `vgw_arn` | ARN of the Virtual Private Gateway |
| `amazon_side_asn` | BGP ASN of the AWS side |

## Usage Example

```hcl
module "vgw" {
  source = "./modules/vgw"

  vpc_id                  = module.vpc.vpc_id
  vgw_name                = "hybrid-network-vgw"
  amazon_side_asn         = 64512
  private_route_table_ids = module.vpc.private_route_table_ids
  environment             = "production"
}
```

## Security Considerations

- **Route propagation** automatically adds routes to private route tables. Verify that propagated routes do not conflict with existing VPC routes or create unintended reachability.
- The VGW only accepts traffic from authenticated VPN tunnels (IPsec with IKE). Unauthorized traffic is dropped at the gateway level.
- Only one VGW can be attached per VPC. Plan ASN assignments carefully as they cannot be changed without recreating the gateway.
- Monitor VGW metrics via CloudWatch (`TunnelState`, `TunnelDataIn`, `TunnelDataOut`) to detect connectivity issues or anomalous traffic patterns.
