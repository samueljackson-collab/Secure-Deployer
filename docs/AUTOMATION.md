# Secure Deployment Runner — Automation Tiers and PXE Remote Imaging Guide

> **Scope:** Five automation tiers from fully assisted manual to zero-touch PXE; WinRM remote AutoTag workflow; operator prerequisites and environment setup.

---

## Table of Contents

1. [Automation Philosophy](#1-automation-philosophy)
2. [The Five Automation Tiers](#2-the-five-automation-tiers)
3. [Tier 1 — Fully Manual (Baseline)](#3-tier-1--fully-manual-baseline)
4. [Tier 2 — AutoTag Assisted (Current Implementation)](#4-tier-2--autotag-assisted-current-implementation)
5. [Tier 3 — Remote AutoTag via WinRM (Tauri App)](#5-tier-3--remote-autotag-via-winrm-tauri-app)
6. [Tier 4 — Scheduled Batch Scan and Remediation](#6-tier-4--scheduled-batch-scan-and-remediation)
7. [Tier 5 — Full Zero-Touch PXE Pipeline (Planned)](#7-tier-5--full-zero-touch-pxe-pipeline-planned)
8. [WinRM Remote AutoTag — Detailed Setup](#8-winrm-remote-autotag--detailed-setup)
9. [PXE and WDS/MDT Integration](#9-pxe-and-wdsmdт-integration)
10. [AutoTag Script Reference](#10-autotag-script-reference)
11. [Automation Prerequisites by Tier](#11-automation-prerequisites-by-tier)

---

## 1. Automation Philosophy

The Secure Deployment Runner is designed to evolve progressively — starting at whatever automation level is feasible in a given environment and advancing tier-by-tier as prerequisites are met. No tier requires discarding work from the previous tier. The interface contracts (`Device`, `ImagingDevice`, `ComplianceResult`) remain constant across all tiers; only the service layer internals change.

**Key principle:** Automate data collection first, then automate decisions, then automate actions. Never automate destructive actions (bulk update, bulk reboot) before confidence in device identity and compliance data is high.

---

## 2. The Five Automation Tiers

| Tier | Name | AutoTag | Scan | Remediation | Transfer | Status |
|---|---|---|---|---|---|---|
| 1 | Fully Manual | Manual CSV | Manual start | Manual per-device | Manual | Available |
| 2 | AutoTag Assisted | AutoTag script (local USB or manual run) | Manual start | Manual per-device | Manual click | Available (current) |
| 3 | Remote AutoTag (WinRM) | AutoTag runs remotely from operator laptop via WinRM | Manual start | Bulk actions | Manual click | Available (Tauri app) |
| 4 | Scheduled Batch | AutoTag + automated scan trigger on imaging completion | Automated scan | Bulk auto-remediation | Automated | Planned (Sprint +4) |
| 5 | Zero-Touch PXE | Full PXE pipeline — device appears and reaches Success with zero operator interaction | Automated | Automated | Automated | Planned (Sprint +5) |

---

## 3. Tier 1 — Fully Manual (Baseline)

**Who uses this:** Environments with no WDS/PXE; air-gapped labs; one-off device onboarding.

**How it works:**

1. Imaging technician images each device using a local USB or manually invoked task sequence.
2. After imaging, the technician manually compiles a CSV with `Hostname` and `MAC` columns.
3. Operator imports the CSV in Deployment Runner (**Load from CSV** button).
4. Operator starts scan, remediates per-device manually.
5. No Image Monitor involvement — the imaging handoff checkpoint is skipped.

**When to use:**
- No network share available from WinPE
- Ad-hoc device additions during a run
- Replacing or correcting a device record that AutoTag captured incorrectly

**Limitations:**
- Manual re-entry risk (hostname typos, MAC format errors)
- No compliance gate between imaging and scanning
- No imaging progress visibility

---

## 4. Tier 2 — AutoTag Assisted (Current Implementation)

**Who uses this:** Standard deployment operations with WDS/MDT and a reachable network share.

**How it works:**

1. Device boots into WinPE via PXE.
2. Technician presses F8, runs `autotag.bat` or `autotag.ps1`.
3. Script prompts for rack slot, hostname, tech name; collects MAC, serial, model, IP automatically.
4. JSON record written to `\\SERVER\AutoTag\`.
5. Image Monitor polls share every 30 seconds — device card appears.
6. Imaging progresses; post-image compliance checks run automatically.
7. Technician clicks **Transfer Selected** when devices are ready.
8. Operator starts scan in Deployment Runner.

**Automation gain vs Tier 1:**
- Eliminates manual MAC/serial collection
- Adds imaging progress visibility
- Adds post-image compliance gate (BitLocker, Citrix, LAPS, SCCM)
- Reduces re-entry risk for device identity data

**Remaining manual steps:**
- Technician must physically interact with each device at F8 prompt
- Transfer and scan start are manual operator actions

---

## 5. Tier 3 — Remote AutoTag via WinRM (Tauri App)

**Who uses this:** High-throughput environments where one operator laptop handles multiple simultaneous imaging devices.

**How it works:**

The operator's laptop (running the Tauri native app) uses WinRM to push and execute AutoTag scripts on imaging devices remotely — the USB stays in the laptop, not the device.

```
Operator Laptop (Tauri App)
       │
       │ WinRM (port 5985)
       ▼
Imaging Device (WinPE)
       │
       ├─ Receives: AutoTag.ps1 copied to C:\Temp\AutoTag\
       ├─ Executes: AutoTag.ps1 remotely
       └─ Returns: live log output + JSON record
```

**Step-by-step:**

1. Copy AutoTag scripts to USB:
   ```
   D:\AutoTag\
       AutoTag.bat
       AutoTag.ps1
   ```
2. Open the Tauri app. Go to **PXE Task Sequence** tab → **Step 1 — Configuration**.
3. Set the network share path and detect USB drives (**Detect USB Drives** button).
4. Select the USB path (e.g., `D:\`).
5. When an imaging device is in WinPE, go to **Step 4 — Deployment**.
6. Enter the imaging device's IP address.
7. Click **Connect & Run** — the Tauri app:
   - Copies `D:\AutoTag\` to `C:\Temp\AutoTag\` on the remote device via WinRM
   - Executes `AutoTag.ps1` remotely
   - Streams live log output back to the UI
8. Device card appears in Image Monitor automatically after AutoTag writes to share.

**Automation gain vs Tier 2:**
- Eliminates per-device F8 physical interaction
- One operator can handle N simultaneous imaging devices
- Live log output visible in UI without physical console access

**Prerequisites:**
- Tauri app (not browser PWA mode)
- WinRM enabled on imaging devices (enabled in Task Sequence before this step)
- Port 5985 reachable from operator laptop
- Local admin credentials for the imaging device

---

## 6. Tier 4 — Scheduled Batch Scan and Remediation

**Who uses this:** Large-scale deployments (100+ devices per shift) where manual scan initiation is a bottleneck.

**How it works (planned):**

1. Image Monitor detects when an imaging device reaches 100% and passes compliance gate.
2. An event is raised (`IMAGING_COMPLETE`) that automatically triggers a `TRANSFER_IMAGING_DEVICES_TO_RUNNER` dispatch.
3. A background service (or scheduled job) polls the runner queue and automatically initiates a scan when a configurable threshold of pending devices is reached (e.g., "scan when 10 devices are pending").
4. Remediation policies (auto-update BIOS, auto-update Windows, auto-reboot) run without operator interaction.
5. Devices that reach `Success` are auto-archived and removed from the queue.
6. Devices that fail after N remediation attempts are escalated to a human review queue.

**Implementation requirements (planned — Sprint +4):**
- Backend adapter (Sprint +3) must be in place
- Policy configuration UI (thresholds, remediation rules)
- Escalation queue with notification (email/Slack/Teams alert)
- Audit trail for all automated decisions (who/what authorized each action)

**Risk controls required before enabling:**
- Four-eyes approval for bulk remediation policy changes
- Mandatory change ticket reference per batch run
- Automatic rollback policy for failed BIOS updates
- Human review required for any device in escalation queue

---

## 7. Tier 5 — Full Zero-Touch PXE Pipeline (Planned)

**Who uses this:** Enterprise environments managing hundreds to thousands of endpoints per week.

**How it works (planned):**

```
[Network Admin provisions device in CMDB / Active Directory]
       │
       ▼
[DHCP assigns IP; PXE server identifies device by MAC]
       │
       ▼
[WDS/MDT auto-selects task sequence based on device model + OU]
       │
       ▼
[Task sequence runs fully unattended — no F8, no prompts]
       │  AutoTag runs automatically at defined task sequence step
       ▼
[Device record written to share; Image Monitor picks it up]
       │
       ▼
[Imaging completes; compliance checks pass automatically]
       │  (Failed compliance → escalation queue, not auto-transfer)
       ▼
[Auto-transfer to Deployment Runner]
       │
       ▼
[Auto-scan initiates (Tier 4 policy engine)]
       │
       ▼
[Auto-remediation runs; device reaches Success]
       │
       ▼
[Auto-archive; device provisioned in CMDB; alert sent to asset team]
```

**Implementation requirements (planned — Sprint +5+):**
- All of Tier 4
- DHCP/PXE server integration (SCCM PXE or WDS with MAC-based task sequence selection)
- CMDB/AD integration for device pre-provisioning
- Automated driver injection pipeline
- Policy-based task sequence selection by model
- End-to-end audit trail with tamper-evident log

**Timeline:** Dependent on WDS/MDT server configuration, CMDB integration, and RBAC implementation from Sprint +4. Not expected before Sprint +5 at earliest.

---

## 8. WinRM Remote AutoTag — Detailed Setup

This section covers the full setup for Tier 3 remote AutoTag via WinRM (Tauri app).

### Enable WinRM on Imaging Devices

Add the following step to your WDS/MDT Task Sequence (runs in WinPE before AutoTag step):

```powershell
# Enable WinRM and configure firewall
winrm quickconfig -quiet
Set-Item WSMan:\localhost\Service\AllowUnencrypted -Value $true
Set-Item WSMan:\localhost\Service\Auth\Basic -Value $true
netsh advfirewall firewall add rule name="WinRM HTTP" dir=in action=allow protocol=TCP localport=5985
```

> **Security note:** `AllowUnencrypted` and Basic auth are acceptable in an isolated imaging VLAN. Do **not** enable these settings on production networks. The imaging VLAN should be isolated from corporate network segments.

### Operator Laptop Prerequisites

- Tauri app installed (built from `npm run tauri:build` or downloaded from GitHub Release)
- Port 5985 reachable from laptop to imaging VLAN
- Local admin credentials for imaging devices (typically the WinPE local admin account set by Task Sequence)
- AutoTag scripts on USB drive under `D:\AutoTag\` (or chosen drive letter)

### Verify Connectivity

Before running remote AutoTag, test WinRM connectivity:

```powershell
Test-WSMan -ComputerName <IMAGING_DEVICE_IP> -Authentication Basic -Credential (Get-Credential)
```

Expected output: WinRM protocol version info — confirms the session can be established.

### USB Drive Setup

```
D:\
└── AutoTag\
    ├── AutoTag.bat       ← original batch launcher
    └── AutoTag.ps1       ← PowerShell script (primary)
```

The Tauri app copies the entire `AutoTag\` folder to `C:\Temp\AutoTag\` on the remote device, then invokes `AutoTag.ps1`.

### Remote Execution Flow in Tauri (lib.rs)

The Rust backend's `execute_remote_script` command:
1. Receives `ipAddress` and `scriptContent` from the frontend via IPC
2. Spawns `PowerShell.exe` with WinRM invocation
3. Captures stdout/stderr
4. Returns `{ success: bool, output: String }` to the React UI

Live output is streamed back to the **Step 4 — Deployment** log panel in real time.

---

## 9. PXE and WDS/MDT Integration

### Minimum WDS/MDT Requirements

| Component | Minimum Version | Notes |
|---|---|---|
| Windows Deployment Services | Windows Server 2016+ | For PXE boot and TFTP |
| MDT | MDT 8456 (for Windows 11 support) | Task Sequence engine |
| Boot Image | Windows PE 10+ (ADK 10.1.26100+) | For NIC driver compatibility on modern hardware |
| Network Share | SMB share accessible from WinPE | For AutoTag JSON output |

### Recommended Task Sequence Structure

```
TASK SEQUENCE: Secure Deployment Standard Image
────────────────────────────────────────────────
Phase 1: WinPE Pre-Stage
  [Step] Initialize Disks
  [Step] Enable WinRM (Tier 3+)
  [Step] Run AutoTag (or wait for remote execution — Tier 3)

Phase 2: Apply Image
  [Step] Apply OS Image (WIM)
  [Step] Apply Drivers
  [Step] Configure BCD / bootmgr

Phase 3: Windows PE Post-Stage
  [Step] Enable BitLocker (if pre-encryption model)

Phase 4: Windows OOBE (first boot)
  [Step] Install SCCM Client
  [Step] Install LAPS
  [Step] Install Citrix Workspace (if applicable)
  [Step] Join Domain
  [Step] Apply GPO Baseline
  [Step] Signal imaging complete to monitor (Tier 4+)
```

### Boot Image Queries (SCCM Integration)

The **Boot Image Management** tab (Step 2 in PXE Task Sequence wizard) can query SCCM for available WIM packages:

1. Enter SCCM Site Server hostname
2. Enter target device MAC address
3. Click **Check SCCM** — invokes `Get-CMBootImage` via PowerShell
4. Select desired boot image from returned list

> **Tauri-only:** Boot image queries require the native Tauri app with ConfigMgr PowerShell module installed on the operator's machine. Browser/PWA mode returns simulated data.

---

## 10. AutoTag Script Reference

### What AutoTag Collects

| Field | Source | Method |
|---|---|---|
| MAC Address | Network adapter | `ipconfig /all` → first non-loopback MAC |
| IP Address | Network adapter | `ipconfig /all` → first non-APIPA IP |
| Serial Number | BIOS/UEFI | `wmic bios get serialnumber` |
| Model | BIOS/UEFI | `wmic computersystem get model` |
| Asset Tag | BIOS/UEFI | `wmic csproduct get name` |

### What AutoTag Prompts For

| Prompt | Validation | Example Input |
|---|---|---|
| Rack Slot | Non-empty string | `A-07` |
| Hostname | Non-empty, no spaces | `HQ-LT-042` |
| Technician Name | Non-empty string | `J.Smith` |

### JSON Output Format

```json
{
  "hostname": "HQ-LT-042",
  "macAddress": "00:1A:2B:3C:4D:5E",
  "ipAddress": "192.168.10.42",
  "serialNumber": "SN123456",
  "model": "Latitude 5540",
  "assetTag": "ASSET-042",
  "rackSlot": "A-07",
  "techName": "J.Smith",
  "timestamp": "2026-03-20T09:15:00Z"
}
```

Output is written to: `\\SERVER\AutoTag\<HOSTNAME>.json`

Image Monitor reads this file on each poll cycle and creates/updates the `ImagingDevice` record in state.

---

## 11. Automation Prerequisites by Tier

| Prerequisite | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---|---|---|---|---|---|
| WDS/MDT server | Not required | Required | Required | Required | Required |
| Network share from WinPE | Not required | Required | Required | Required | Required |
| AutoTag script in task sequence | Not required | Required | Required | Required | Required |
| WinRM enabled in WinPE | Not required | Not required | Required | Required | Required |
| Tauri native app | Not required | Not required | Required | Optional | Optional |
| Backend adapter (real API) | Not required | Not required | Not required | Required | Required |
| CMDB / AD integration | Not required | Not required | Not required | Optional | Required |
| PXE auto-task-sequence selection | Not required | Not required | Not required | Not required | Required |
| RBAC + audit trail | Not required | Not required | Not required | Required | Required |

---

*Document owner: Platform engineer. Update when automation tier is advanced or prerequisites change. See `README.md` for full documentation index.*
