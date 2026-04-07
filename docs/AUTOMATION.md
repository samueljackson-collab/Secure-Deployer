# Secure Deployment Runner — Automation Tiers & PXE Guide

> **Audience:** Platform engineers and senior operators configuring the imaging and deployment automation pipeline.
> **Purpose:** Describes the five automation tiers from fully manual to zero-touch PXE, with prerequisites and configuration for each.

---

## Automation Tiers Overview

| Tier | Name | Description | Prerequisites |
|---|---|---|---|
| 1 | Manual | Operator manually enters all device data; no imaging automation | None |
| 2 | Semi-automated | Bulk actions, CSV import, credential gate | Secure Deployment Runner app |
| 3 | Assisted PXE | AutoTag script collects device data; Image Monitor polls share | WDS/MDT, AutoTag script, network share |
| 4 | Zero-touch PXE | Full imaging task sequence with AutoTag; auto-transfer to runner | Tier 3 + MDT task sequence integration |
| 5 | Full orchestration | API backend, RBAC, vault secrets, automated remediation | Tier 4 + backend API + identity/policy infrastructure |

Most deployments operate at **Tier 2–3** today. Tiers 4–5 are roadmap items.

---

## Tier 1 — Manual

**Who:** Small teams, one-off devices, or environments without PXE infrastructure.

**How:**
1. Build a CSV with device hostnames and MAC addresses.
2. Upload via the CSV import control in Deployment Runner.
3. Manually start scan, apply updates, run scripts.

No infrastructure setup required beyond the app itself.

---

## Tier 2 — Semi-automated

**Who:** Teams using the app for daily compliance sweeps without PXE imaging.

**Additional capabilities over Tier 1:**
- Bulk update / validate / execute / cancel / remove
- Selection-gated bulk actions
- Deployment history and analytics
- Session-only credential gate (no persistent storage)
- Re-scan loops for closure verification

**Setup:** None beyond the app. See [PROCESS.md](./PROCESS.md) for the full workflow.

---

## Tier 3 — Assisted PXE (AutoTag + Image Monitor)

**Who:** Teams using WDS/MDT for PXE imaging who want automatic device intake.

### Infrastructure Required

| Component | Role |
|---|---|
| WDS/MDT server | PXE boot and task sequence engine |
| Network share | AutoTag writes JSON records here; Image Monitor polls it |
| AutoTag PowerShell script | Runs in WinPE; collects device identity and writes to share |
| Secure Deployment Runner | Polls share via Image Monitor; hosts deployment workflow |

### Network Share Setup

1. Create a share accessible from WinPE (typically a DFS share or direct UNC path):
   ```
   \\DEPLOY-SRV\AutoTagShare
   ```
2. Grant write access to the WinPE machine account **or** configure the AutoTag script to run with explicit credentials.
3. Grant read access to the workstation running Secure Deployment Runner (for Image Monitor polling).

### AutoTag Script Deployment

The AutoTag PowerShell script is viewable in the **Imaging Script** tab of the app. To deploy:

1. Copy `autotag.ps1` to your MDT deployment share:
   ```
   \\MDT-SRV\DeploymentShare$\Scripts\autotag.ps1
   ```
2. In MDT Workbench, create a custom task sequence step:
   - Type: **Run PowerShell Script**
   - Script: `%SCRIPTROOT%\autotag.ps1`
   - Parameters: `-SharePath "\\DEPLOY-SRV\AutoTagShare"`
   - Position: After network initialization, before OS apply

3. Ensure the WinPE boot image includes the **PowerShell** optional component.

### Image Monitor Configuration

In the app, go to the **Image Monitor** tab. Set the **Share Path** field to match your network share UNC path. The monitor polls every 30 seconds and creates device cards automatically.

---

## Tier 4 — Zero-touch PXE

**Who:** Teams wanting full hands-off imaging with minimal operator interaction per device.

**Additional requirements over Tier 3:**
- MDT task sequence configured to run AutoTag automatically at the correct step
- Network share permissions set up for machine account access (no operator needed at WinPE console)
- Image Monitor transfer set to auto-transfer on imaging completion (requires API/automation; currently manual in the UI)

### Recommended Task Sequence Order

```
1. Partition disk (diskpart)
2. Apply OS image (DISM)
3. Inject drivers
4. Initialize networking (ipconfig /renew)
5. Run AutoTag (autotag.ps1) ← writes JSON to share
6. Create boot files (BCDBoot)
7. Configure WinRE
8. Apply unattend.xml
9. Reboot into OS
```

### USB Portable Workflow (Remote AutoTag)

For sites where devices cannot reach the network share directly from WinPE:

1. Copy `autotag.ps1` and the launcher scripts to a USB drive:
   ```
   D:\AutoTag\
       AutoTag.bat
       AutoTag.ps1
   ```
2. Use the **PXE Task Sequence** tab in the app → **Step 4 — Deployment** → **Test Remote Execution**.
3. Enter the imaging device's IP address and click **Connect & Run**.
4. The app (via Tauri/PowerShell WinRM) copies and executes AutoTag remotely.

> **WinRM prerequisite:** `winrm quickconfig` must have been run on the target, or WinRM must be enabled in the WinPE image. Port 5985 must be reachable.

---

## Tier 5 — Full Orchestration (Planned)

**Status:** Roadmap Sprint +4 and beyond.

**Components:**
- REST/gRPC API backend replaces `services/deploymentService.ts` mock
- Vault-backed secrets brokering (Azure Key Vault, HashiCorp Vault, AWS Secrets Manager)
- RBAC with scoped permissions: scan-only, remediate, admin
- SSO/MFA via SAML or OIDC
- Immutable, signed audit log (write-once backend store)
- Change ticket reference enforcement before scan authorization
- Four-eyes approval for destructive bulk operations
- Real-time dashboard via WebSocket state sync (multi-operator)

See the README roadmap for planned sprint targets.

---

## PXE Infrastructure Reference

### WDS Prerequisites

- Windows Server 2016 or later
- WDS role installed and configured with PXE response enabled
- Boot images imported (WinPE-based; include PowerShell optional component)
- Install images configured for your OS edition

### MDT Prerequisites

- MDT 8456 or later
- Deployment Share created and shared
- Task sequences created for each hardware model
- AutoTag script staged in `%SCRIPTROOT%`

### Network Requirements

| Port | Protocol | Direction | Purpose |
|---|---|---|---|
| 67, 68 | UDP | LAN | DHCP (PXE boot) |
| 69 | UDP | Client → WDS | TFTP (boot file download) |
| 4011 | UDP | Client → WDS | PXE boot negotiation |
| 445 | TCP | Client → MDT | SMB (deployment share access) |
| 5985 | TCP | Runner → Target | WinRM (remote AutoTag execution) |

---

## Related Documents

- [End-to-End Process SOP](./PROCESS.md)
- [Capacity & Scalability Guide](./CAPACITY.md)
- [Technical Architecture](./ARCHITECTURE.md)
