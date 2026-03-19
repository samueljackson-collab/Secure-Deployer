# PXE Automation Tiers & Zero-Touch Imaging Guide

> **Scope:** This document describes the three tiers of PXE/imaging automation available with the Secure Deployment Runner, from fully manual to zero-touch. It covers the PowerShell AutoTag script, SCCM integration, and the requirements for each tier.

---

## Automation Tier Overview

```
Tier 1: Manual PXE Boot + AutoTag
   └─ Tech physically initiates; script collects metadata

Tier 2: Semi-Automated (SCCM Boot Image Selection)
   └─ Automated task sequence; tech selects image via PXE Task Sequence wizard

Tier 3: Zero-Touch (WDS/MDT Full Automation)
   └─ No tech intervention; device boots, images, tags, and transfers automatically
```

---

## Tier 1: Manual PXE Boot + AutoTag

**What it is:** The default mode. A tech physically PXE-boots each device, watches the task sequence run, and executes AutoTag at the WinPE F8 prompt.

**Requirements:**
- WDS or MDT server on the imaging network
- Network boot enabled in device BIOS (PXE first in boot order)
- AutoTag script (`services/powershellScript.ts`) deployed to the network share

**Workflow:**
1. Device powers on → PXE boot → task sequence loads WinPE.
2. Tech presses **F8** to open the WinPE shell.
3. Tech runs `autotag.bat` (wrapper for the AutoTag PowerShell script).
4. AutoTag prompts for: rack slot, hostname, tech name.
5. Script collects: MAC address, serial number, model, IP address.
6. JSON record is written to the configured network share path.
7. Image Monitor detects the record within 30 seconds.
8. Device card appears in the rack view; progress advances automatically.

**AutoTag Script Location:** `services/powershellScript.ts` (the `POWERSHELL_SCRIPT` constant).

**Strengths:** Simple, no additional infrastructure. Works in isolated or air-gapped environments.

**Limitations:** Requires a tech present at each device; throughput limited by technician availability.

---

## Tier 2: Semi-Automated (SCCM Boot Image Selection)

**What it is:** Uses the **PXE Task Sequence** wizard in the app to select a WIM boot image from SCCM and pre-configure the task sequence. The device still needs a tech to initiate, but image selection and task sequence configuration are done from the operator workstation.

**Requirements:**
- SCCM site server accessible from the operator workstation
- ConfigMgr PowerShell module installed (`Get-CMBootImage` cmdlet)
- Tauri native app build (browser/PWA mode simulates SCCM responses)
- Site code auto-detected via `Get-PSDrive -PSProvider CMSite`

**Workflow (PXE Task Sequence Tab):**

**Step 1 — Network Share Configuration**
1. Enter the UNC path for the imaging data share (e.g., `\\SERVER\ImagingShare`).
2. App validates share accessibility.
3. AutoTag output JSON will be written here.

**Step 2 — Boot Image Selection**
1. Enter the SCCM Site Server hostname (e.g., `SCCM-SERVER01`).
2. Enter the target device MAC address.
3. Click **Check SCCM** — app invokes `Get-CMBootImage` via Tauri IPC.
4. Available WIM packages are returned; select the desired boot image.

**Step 3 — Integration Method**
Choose deployment integration:
- **WDS Direct** — Boot image assigned directly via WDS
- **MDT Integration** — Boot image linked to MDT task sequence database
- **SCCM OSD** — Boot image referenced in SCCM Operating System Deployment task sequence

**Step 4 — Run AutoTag**
1. App remotely executes the AutoTag script on the target device via WinRM.
2. Device metadata is collected and written to the share.
3. Image Monitor detects the device within the next poll cycle.

**Strengths:** Operator can configure imaging from their workstation; reduces physical trips to devices.

**Limitations:** Requires Tauri native app; SCCM admin module required; WinRM must be enabled on target devices.

---

## Tier 3: Zero-Touch Imaging (WDS/MDT Full Automation)

**What it is:** Fully automated imaging with no tech intervention required after initial infrastructure setup. Devices boot, image themselves, run AutoTag automatically via a scheduled task or startup script, and appear in Image Monitor without any manual steps.

**Requirements:**
- WDS server with PXE boot configured
- MDT or SCCM OSD task sequence with AutoTag integrated as a task step
- Automatic DHCP-based PXE targeting (no tech needed to select boot image)
- Network share with write permissions for the imaging service account
- Image Monitor running on a workstation or server with share access

**Infrastructure Setup:**
1. Deploy AutoTag as a task sequence step in MDT/SCCM.
2. Configure the task sequence to:
   - Collect hardware inventory (MAC, serial, model)
   - Generate hostname via your naming convention (or prompt if required)
   - Write JSON to the imaging share
3. Set boot order via DHCP option 66/67 or SCCM PXE responder.
4. Add MDT/SCCM rules for automatic image selection based on device model.

**AutoTag Integration in Task Sequence:**

Add a `Run Command Line` step after WinPE loads:

```
powershell.exe -ExecutionPolicy Bypass -File \\SERVER\ImagingShare\autotag.ps1 -Automated -SharePath \\SERVER\ImagingShare
```

The `-Automated` flag suppresses interactive prompts and generates metadata from WMI:
- MAC: `Get-WmiObject Win32_NetworkAdapter | Where-Object {$_.MACAddress}`
- Serial: `Get-WmiObject Win32_BIOS | Select-Object SerialNumber`
- Model: `Get-WmiObject Win32_ComputerSystem | Select-Object Model`
- IP: `Get-NetIPAddress -AddressFamily IPv4`
- Hostname: Generated from naming convention or read from MDT variable `%OSDComputerName%`

**Strengths:** Maximum throughput; no tech presence required at devices; scales to 100+ devices simultaneously.

**Limitations:** Requires WDS/MDT/SCCM server infrastructure; naming convention must be automatable; troubleshooting requires server-side log access.

---

## AutoTag Script Reference

The AutoTag PowerShell script is embedded in `services/powershellScript.ts` as the `POWERSHELL_SCRIPT` constant. The **Imaging Script** tab in the app provides a read-only viewer of this script.

**Key actions the script performs:**

| Action | WMI/CIM Query | Output Field |
|---|---|---|
| MAC address collection | `Win32_NetworkAdapter` | `macAddress` |
| Serial number | `Win32_BIOS.SerialNumber` | `serial` |
| Device model | `Win32_ComputerSystem.Model` | `model` |
| IP address | `Win32_NetworkAdapterConfiguration` | `ipAddress` |
| Write JSON to share | `[System.IO.File]::WriteAllText()` | Network share path |

**Output JSON format (written to share):**
```json
{
  "hostname": "LPT-FIN-091",
  "macAddress": "00:1A:2B:3C:4D:5E",
  "serial": "ABC123XYZ",
  "model": "Latitude 5540",
  "ipAddress": "10.10.5.91",
  "rackSlot": 7,
  "techName": "J.Smith",
  "timestamp": "2024-01-15T09:23:11Z"
}
```

---

## Choosing Your Tier

| Factor | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Infrastructure required | WDS/MDT only | WDS/MDT + SCCM | WDS/MDT + SCCM + automation |
| Tech presence required | Yes (per device) | Workstation only | No |
| Setup complexity | Low | Medium | High |
| Throughput | Limited by tech | Medium | High |
| Best for | Small labs, air-gap | Standard enterprise | High-volume, repeatable |
| App mode required | Browser/PWA/Tauri | Tauri (native) | Tauri (native) |

---

## Troubleshooting PXE & AutoTag

| Symptom | Likely Cause | Resolution |
|---|---|---|
| Device not PXE booting | PXE not enabled in BIOS, or DHCP not configured | Enable PXE in BIOS; verify DHCP options 66/67 |
| AutoTag JSON not appearing in share | Share path wrong, or write permissions missing | Check UNC path; verify service account has write access |
| Image Monitor not detecting device | JSON format malformed, or poll cycle timing | Validate JSON with a text editor; wait for next 30s poll |
| SCCM boot images not returning | ConfigMgr module not installed, or site unreachable | Install Admin Console; verify `Get-CMBootImage` works in PowerShell |
| WinRM execution fails (Tier 2/3) | WinRM not enabled on target | Run `Enable-PSRemoting -Force` on target; check firewall port 5985/5986 |

---

## Related Documents

- [README.md](../README.md) — Full project overview
- [docs/PROCESS.md](./PROCESS.md) — End-to-end operator process SOP
- [docs/CAPACITY.md](./CAPACITY.md) — Wave sizing and scalability guidance
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — Technical architecture and IPC bridge details
