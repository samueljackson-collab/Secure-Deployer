# Customer Gateway (CGW) Module

## Purpose

Creates an AWS Customer Gateway resource that represents the on-premises VPN device (router, firewall, or software VPN appliance). The CGW is a logical object that tells AWS the public IP address and BGP ASN of the remote endpoint so that IPsec tunnels can be configured correctly.

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `cgw_ip_address` | Public IP of the on-premises VPN device | `string` | n/a | yes |
| `cgw_bgp_asn` | BGP ASN of the on-premises device | `number` | n/a | yes |
| `cgw_name` | Name tag for the Customer Gateway | `string` | n/a | yes |
| `cgw_type` | VPN connection type (must be `ipsec.1`) | `string` | `"ipsec.1"` | no |
| `environment` | Deployment environment | `string` | n/a | yes |
| `tags` | Tags to apply to all resources | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `cgw_id` | ID of the Customer Gateway |
| `cgw_arn` | ARN of the Customer Gateway |
| `cgw_bgp_asn` | BGP ASN of the Customer Gateway |
| `cgw_ip_address` | Public IP address of the Customer Gateway |

## Usage Example

```hcl
module "cgw" {
  source = "./modules/cgw"

  cgw_ip_address = "203.0.113.1"
  cgw_bgp_asn    = 65000
  cgw_name       = "hybrid-network-cgw"
  environment    = "production"
}
```

## Security Considerations

- The `cgw_ip_address` must be the **public** IP of your on-premises VPN device. Ensure this IP is static and does not change, as a new CGW (and VPN connection) must be created if it does.
- The BGP ASN configured here **must match** the ASN configured on the physical/virtual on-premises device. A mismatch will prevent BGP peering from establishing.
- The `create_before_destroy` lifecycle rule minimizes downtime during CGW replacement but will temporarily create two CGW resources. Verify IAM permissions allow this.
- Audit CGW changes carefully -- an attacker modifying the CGW IP could redirect VPN traffic to a malicious endpoint.
