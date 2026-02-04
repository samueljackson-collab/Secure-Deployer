# VPN Connection Module

## Purpose

Establishes an AWS Site-to-Site VPN connection between a Virtual Private Gateway (VGW) and a Customer Gateway (CGW). AWS always creates two redundant IPsec tunnels for high availability. This module supports both static routing and BGP dynamic routing, configurable pre-shared keys, and includes a CloudWatch alarm for tunnel health monitoring.

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `vgw_id` | ID of the Virtual Private Gateway | `string` | n/a | yes |
| `cgw_id` | ID of the Customer Gateway | `string` | n/a | yes |
| `vpn_name` | Name tag for the VPN connection | `string` | n/a | yes |
| `static_routes_only` | Use static routes (true) or BGP (false) | `bool` | `false` | no |
| `on_prem_cidrs` | On-prem CIDRs for static routes | `list(string)` | `[]` | no |
| `environment` | Deployment environment | `string` | n/a | yes |
| `tunnel1_preshared_key` | Pre-shared key for tunnel 1 (sensitive) | `string` | `null` | no |
| `tunnel2_preshared_key` | Pre-shared key for tunnel 2 (sensitive) | `string` | `null` | no |
| `tunnel1_inside_cidr` | Inside CIDR for tunnel 1 (/30) | `string` | `null` | no |
| `tunnel2_inside_cidr` | Inside CIDR for tunnel 2 (/30) | `string` | `null` | no |
| `tags` | Tags to apply to all resources | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `vpn_connection_id` | ID of the VPN connection |
| `vpn_connection_arn` | ARN of the VPN connection |
| `tunnel1_address` | Public IP of tunnel 1 (AWS side) |
| `tunnel1_bgp_asn` | BGP ASN of tunnel 1 |
| `tunnel1_bgp_holdtime` | BGP hold time for tunnel 1 |
| `tunnel1_cgw_inside_address` | CGW inside IP for tunnel 1 |
| `tunnel1_vgw_inside_address` | VGW inside IP for tunnel 1 |
| `tunnel1_preshared_key` | Pre-shared key for tunnel 1 (sensitive) |
| `tunnel2_address` | Public IP of tunnel 2 (AWS side) |
| `tunnel2_bgp_asn` | BGP ASN of tunnel 2 |
| `tunnel2_bgp_holdtime` | BGP hold time for tunnel 2 |
| `tunnel2_cgw_inside_address` | CGW inside IP for tunnel 2 |
| `tunnel2_vgw_inside_address` | VGW inside IP for tunnel 2 |
| `tunnel2_preshared_key` | Pre-shared key for tunnel 2 (sensitive) |
| `tunnel_alarm_arn` | ARN of the tunnel health CloudWatch alarm |

## Usage Example

```hcl
module "vpn_connection" {
  source = "./modules/vpn-connection"

  vgw_id             = module.vgw.vgw_id
  cgw_id             = module.cgw.cgw_id
  vpn_name           = "hybrid-network-vpn"
  static_routes_only = false
  on_prem_cidrs      = ["192.168.0.0/16"]
  environment        = "production"

  # Optional: specify pre-shared keys (inject via TF_VAR_* in production)
  # tunnel1_preshared_key = var.tunnel1_preshared_key
  # tunnel2_preshared_key = var.tunnel2_preshared_key
}
```

## Security Considerations

- **Pre-shared keys** are marked as `sensitive` in Terraform and will not appear in plan output or state file diffs. However, they **are stored in the state file** -- ensure remote state is encrypted (S3 with SSE, Terraform Cloud, etc.).
- **Never commit pre-shared keys** to version control. Use `TF_VAR_tunnel1_preshared_key` environment variables or a secrets manager (AWS Secrets Manager, HashiCorp Vault).
- AWS VPN uses **IKEv1/IKEv2** with AES-256 encryption and SHA-256 integrity by default. Verify your on-premises device supports these algorithms.
- The CloudWatch alarm triggers when **both tunnels** are simultaneously down. Configure SNS notifications to alert your operations team.
- Both tunnels should be configured on the on-premises device for redundancy. A single-tunnel configuration creates a single point of failure.
- Tunnel inside CIDRs use link-local addressing (169.254.x.x/30). These are not routable and are used solely for BGP peering between the VGW and CGW.
