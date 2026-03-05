# Secure Deployment Runner — Full Process Document

> **Audience:** Single technician, new or experienced. No handoff required.
> **Goal:** Walk one person through every step from the moment a physical device arrives until it is
> fully compliant, verified, and removed from all queues.

---

## Table of Contents

1. [Overview of the Full Pipeline](#1-overview-of-the-full-pipeline)
2. [Before You Start — Prerequisites](#2-before-you-start--prerequisites)
3. [Phase 1 — Device Intake via AutoTag (PXE Boot)](#3-phase-1--device-intake-via-autotag-pxe-boot)
4. [Phase 2 — Live Imaging (Image Monitor)](#4-phase-2--live-imaging-image-monitor)
5. [Phase 3 — Post-Image Compliance Check](#5-phase-3--post-image-compliance-check)
6. [Phase 4 — Transfer to Deployment Runner](#6-phase-4--transfer-to-deployment-runner)
7. [Phase 5 — Scan and Validate](#7-phase-5--scan-and-validate)
8. [Phase 6 — Remediation (Bring to Compliance)](#8-phase-6--remediation-bring-to-compliance)
9. [Phase 7 — Verify Closure (Re-Scan)](#9-phase-7--verify-closure-re-scan)
10. [Phase 8 — Evidence and Archiving](#10-phase-8--evidence-and-archiving)
11. [Phase 9 — Remove Devices (Clean Queue)](#11-phase-9--remove-devices-clean-queue)
12. [Troubleshooting](#12-troubleshooting)
13. [Quick Reference Card](#13-quick-reference-card)

---

## 1. Overview of the Full Pipeline

The diagram below shows the complete journey of a single device from physical arrival to queue
removal. Each box maps to a numbered Phase in this document.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  SECURE DEPLOYMENT RUNNER — FULL DEVICE PIPELINE            │
└─────────────────────────────────────────────────────────────────────────────┘

   PHYSICAL                 IMAGING PHASE                   DEPLOYMENT PHASE
   ─────────                 ─────────────                   ────────────────

  ┌──────────┐   PXE Boot   ┌───────────────┐   Transfer   ┌─────────────────┐
  │  Device  │─────────────▶│ Image Monitor │─────────────▶│ Deployment      │
  │ arrives  │              │               │              │ Runner          │
  └──────────┘              │ • Rack view   │              │                 │
       │                    │ • Progress %  │              │ • Scan          │
       │ Phase 1            │ • Compliance  │              │ • Update        │
       ▼                    │   checks      │              │ • Script        │
  ┌──────────┐              └───────────────┘              │ • Verify        │
  │ AutoTag  │                     │                       └─────────────────┘
  │ (WinPE)  │               Phase 2–3                            │
  │          │                                               Phase 5–7
  │ Collects:│                                                    │
  │ MAC      │                                                    ▼
  │ Serial   │                                           ┌─────────────────┐
  │ Model    │                                           │   Archive Run   │
  │ Slot     │                                           │   + Remove      │
  │ Hostname │                                           │   Device        │
  └──────────┘                                          └─────────────────┘
                                                          Phase 8–9
```

### Full State Transitions (Device's eye view)

```
[Physical] → [PXE Boot] → [AutoTag runs] → [Appears in Image Monitor]
    → [Imaging 0%→100%] → [Compliance check] → [Completed]
    → [Transfer Selected] → [Appears in Deployment Runner]
    → [Start Scan] → [Waking Up] → [Connecting] → [Checking Info/BIOS/DCU/Win]
    → [Scan Complete] or [Success]
    → (if Scan Complete) → [Updating BIOS/DCU/Windows] → [Reboot] → [Success]
    → [Re-Scan All] → [Success confirmed]
    → [Archive Run] → [Bulk Remove]
    → [Device gone from system ✓]
```

---

## 2. Before You Start — Prerequisites

### Physical requirements

| Requirement | Detail |
|---|---|
| Power | Device plugged in and powered on |
| Ethernet | Connected to imaging/provisioning VLAN (not end-user VLAN) |
| Rack placement | Device in labeled rack slot (e.g., `R1-S03`) |
| BIOS boot order | Network / PXE boot enabled (may need to press F12 or ESC on POST) |

### Access requirements

| Requirement | Detail |
|---|---|
| Web UI access | Secure Deployment Runner loaded in browser |
| PXE / WDS access | Permission to boot devices from network |
| Admin credentials | Available for scan start (prompted at scan time, never stored) |
| Network share path | AutoTag write target accessible from WinPE environment |

### What you need to know before starting each device

- The **rack slot label** printed on the physical rack (e.g., `R2-S14`)
- The **intended hostname** for the device (from your asset list or build sheet)
- **Your own name** (recorded for audit trail in AutoTag)

---

## 3. Phase 1 — Device Intake via AutoTag (PXE Boot)

### What happens in this phase

AutoTag is a PowerShell script that runs inside the WinPE (Windows Preinstallation Environment)
during the imaging task sequence. It collects hardware identity automatically, asks the tech for
three inputs, and publishes a JSON record to a network share. Image Monitor reads that record and
creates a live device card in the rack view.

### Code that runs this phase

- **`services/powershellScript.ts`** — contains the full AutoTag PowerShell script source (visible
  in the Imaging Script Viewer tab)
- **`components/ImagingScriptViewer.tsx`** — displays the script for reference
- **`components/ImageMonitor.tsx`** — polls the network share for new JSON records

### Step-by-step

#### Step 1.1 — Physically place and connect the device

```
Action:
  1. Place device in labeled rack slot
  2. Plug in power cable
  3. Plug in ethernet to provisioning VLAN port
  4. Power on device

Verify: Device POSTs (screen lights up, fan spins)
```

#### Step 1.2 — PXE boot into the Task Sequence Wizard

```
Action:
  1. During POST/boot, open Boot Menu
     Common keys: F12 (Dell), ESC (HP), F9 (HP), F10 (HP)
  2. Select: Network Boot / PXE / LAN
  3. Wait for WDS/MDT boot image to load
  4. Task Sequence Wizard screen appears

Verify: You see the imaging/task sequence selection screen
```

#### Step 1.3 — Open PowerShell via F8

```
Action:
  1. On the Task Sequence Wizard screen, press F8
  2. A command prompt (cmd.exe) window opens
  3. Type:  powershell
  4. Press Enter

Verify: PowerShell prompt (PS X:\> or similar) is active
```

#### Step 1.4 — Run AutoTag

```
Action:
  Run the AutoTag script. Common path (confirm with your environment):
    X:\Tools\autotag.bat
  or
    \\server\share\scripts\autotag.bat

  The script runs and begins collecting device information automatically.
```

#### Step 1.5 — Enter the three required inputs

```
AutoTag Prompt 1 — Rack Slot:
  Type exactly what is printed on the physical rack label.
  Example: R2-S14
  Press Enter.

AutoTag Prompt 2 — Hostname:
  Type the intended device hostname from your build sheet.
  Example: HQ-LT-042
  Press Enter.

AutoTag Prompt 3 — Technician Name:
  Type your name (for audit trail).
  Example: Sam Jackson
  Press Enter.

AutoTag displays a confirmation summary and asks Y/N.
  Type: Y
  Press Enter.
```

#### Step 1.6 — What AutoTag collects automatically (no input required)

```
Collected automatically from WinPE hardware APIs:
  • MAC address (primary device identity — used for matching)
  • Serial number
  • Model name
  • IP address (if DHCP leased)
  • Asset tag (if written to BIOS)
  • Timestamp of intake
  • Rack slot (from your input)
  • Hostname (from your input)
  • Technician name (from your input)
```

#### Step 1.7 — Verify AutoTag published successfully

```
AutoTag output should show:
  "Intake published successfully"
  "Event ID: ####"
  "Log saved: <path>"

If it shows an error:
  → Check ethernet is connected
  → Check network share path is accessible from WinPE
  → Re-run the script once
  → If still failing: document device details manually and escalate
```

#### Step 1.8 — Verify device appears in Image Monitor

```
Action:
  1. Open Secure Deployment Runner in browser
  2. Click Image Monitor tab
  3. Find your device by hostname

Expected fields:
  ✓ Hostname matches what you entered
  ✓ Rack slot matches what you entered
  ✓ Tech name matches what you entered
  ✓ MAC / Serial / Model populated by AutoTag
  ✓ Status: Imaging (or Pending Imaging)

Wait: Up to 60 seconds for the monitor to poll and display

If not visible after 60 seconds: → See Troubleshooting section
```

---

## 4. Phase 2 — Live Imaging (Image Monitor)

### What happens in this phase

The Task Sequence runs the imaging process (OS installation, driver injection, domain join, etc.).
Image Monitor shows a progress bar for each device and automatically updates status as imaging
progresses. The tech does not need to do anything during this phase except monitor.

### Code that runs this phase

- **`components/ImageMonitor.tsx`** — polls the network share and updates device state
- **`components/ImageRack.tsx`** — renders the rack grid with `DeviceCard` per device
- **`contexts/AppContext.tsx`** — `UPDATE_IMAGING_DEVICE` action updates progress %, status, fields

### Step-by-step

#### Step 2.1 — Return to the Task Sequence Wizard

```
Action:
  Close the PowerShell / cmd window (or Alt+Tab back to the TS wizard)
  Continue the task sequence normally — select your task sequence, confirm settings
  The imaging process begins
```

#### Step 2.2 — Monitor progress in Image Monitor

```
In the Image Monitor tab, watch:
  • Progress bar: 0% → 100%
  • Status field:
    - "Imaging" — task sequence running
    - "Checking Compliance" — OS installed, running post-image checks
    - "Completed" — ready to transfer

Do NOT click Transfer until status = Completed.
Imaging time varies: 20–60 minutes per device depending on image size and network.
```

#### Step 2.3 — Rack grid view details

```
Each device card shows:
  ┌──────────────────────────────────────────┐
  │ Hostname: HQ-LT-042        [R2-S14]      │
  │ Model: Latitude 5540       Progress: 67% │
  │ Serial: ABC123             Tech: S.J.    │
  │ MAC: 00:1A:2B:3C:4D:5E                   │
  │ [████████████░░░░░░░] Imaging            │
  └──────────────────────────────────────────┘

Expand a card to see:
  • Full IP address
  • Additional metadata
  • Compliance status icons (after checking compliance phase)
  • Edit hostname button
  • Remove button (if device needs to be removed from queue)
```

---

## 5. Phase 3 — Post-Image Compliance Check

### What happens in this phase

After the OS image finishes installing, the imaging system (WinPE or the newly installed OS)
runs `runComplianceChecks()`. This verifies that key security baseline items are present before
the device is cleared for transfer to the Deployment Runner. This phase is automatic.

### Code that runs this phase

- **`services/deploymentService.ts:runComplianceChecks()`** — checks BitLocker, Citrix, LAPS, SCCM
- **`components/ImageRack.tsx:ComplianceStatusIcon`** — renders pass/fail icons per check
- **`components/ComplianceDetailsModal.tsx`** — drill-down detail per device

### Compliance checks performed

```
┌─────────────────────────────────────────────────────────────────┐
│              POST-IMAGE COMPLIANCE CHECKS                       │
├─────────────────────┬───────────────────────────────────────────┤
│ Check               │ What it verifies                         │
├─────────────────────┼───────────────────────────────────────────┤
│ BitLocker Volume    │ Encryption volume is present and active  │
│ Citrix Workspace    │ Citrix Workspace application is installed │
│ LAPS                │ Local Admin Password Solution installed   │
│ SCCM Client         │ SCCM/ConfigMgr client installed +running │
└─────────────────────┴───────────────────────────────────────────┘
```

### Step-by-step

#### Step 3.1 — Watch for "Checking Compliance" status

```
Image Monitor status transitions:
  Imaging → Checking Compliance → Completed
                                → Completed (with compliance flags)
```

#### Step 3.2 — Review compliance result

```
Green icons = passed that check
Red/amber icons = failed that check

Safe rule for new techs:
  • All green → transfer now
  • Any red → check if it's a known expected gap (e.g., Citrix not required on all devices)
  • If unsure → transfer anyway; Deployment Runner will re-check everything
  • If BIOS/DCU/Windows are wrong → Deployment Runner updates them

Click the device card to expand compliance details, or click the compliance icon
to open ComplianceDetailsModal for full per-check detail.
```

---

## 6. Phase 4 — Transfer to Deployment Runner

### What happens in this phase

Completed devices are moved from Image Monitor into the Deployment Runner queue. This is a one-click
operation. The transfer converts `ImagingDevice` objects into `Device` objects with all collected
metadata preserved.

### Code that runs this phase

- **`components/ImageMonitor.tsx`** — "Transfer Selected" / "Transfer All Completed" buttons
- **`services/deploymentService.ts:transformImagingToRunnerDevices()`** — converts data types
- **`contexts/AppContext.tsx:TRANSFER_IMAGING_DEVICES_TO_RUNNER`** — reducer case that moves devices

### Step-by-step

#### Step 4.1 — Select completed devices

```
In Image Monitor:
  • Select checkbox next to device(s) with status "Completed"
  OR
  • Use "Select All Completed" if transferring a full batch

Only transfer Completed devices.
Do not transfer devices still showing "Imaging" or "Checking Compliance".
```

#### Step 4.2 — Click Transfer Selected

```
Click: Transfer Selected (or Transfer All Completed)

What happens automatically:
  • Device records are converted from ImagingDevice → Device format
  • All metadata (hostname, MAC, serial, model, rack slot, tech) is preserved
  • Devices appear instantly in the Deployment Runner tab device list
  • Image Monitor still shows them until you explicitly remove them from monitor view
```

#### Step 4.3 — Verify in Deployment Runner

```
Click: Deployment Runner tab

Verify:
  ✓ Device hostname appears in the device list
  ✓ Status shows: Pending
  ✓ MAC address matches the physical device
  ✓ Device type icon matches (laptop, desktop, tower, etc.)
```

---

## 7. Phase 5 — Scan and Validate

### What happens in this phase

The Deployment Runner performs a comprehensive scan of each device. This is more detailed than the
post-image compliance check — it verifies specific version targets for BIOS, DCU, and Windows, plus
encryption, CrowdStrike, and SCCM. Results drive all remediation decisions.

### Code that runs this phase

- **`services/deploymentService.ts:runDeploymentFlow()`** — orchestrates the full scan run
- **`services/deploymentService.ts:validateDevice()`** — per-device scan logic with retry loop
- **`contexts/AppContext.tsx:START_DEPLOYMENT_CONFIRMED`** — triggers the deployment flow
- **`components/SecureCredentialModal.tsx`** — captures session-only admin credentials
- **`components/DeviceStatusTable.tsx`** — renders live status transitions per row

### How `validateDevice()` works internally

```
validateDevice(device, credentials, settings):
  1. Send Wake-on-LAN packet → status: "Waking Up"
  2. Attempt TCP connection → status: "Connecting"
     If fails: wait retryDelay seconds
     Retry up to maxRetries times → status: "Retrying..."
     If all retries exhausted → status: "Offline" (terminal)
  3. Gather system info → status: "Checking Info"
     Collects: model, serial, asset tag, RAM, disk space, IP
  4. Check BIOS version → status: "Checking BIOS"
     Compare device.biosVersion to TARGET_BIOS_VERSION ('A24')
  5. Check DCU version → status: "Checking DCU"
     Compare device.dcuVersion to TARGET_DCU_VERSION ('5.1.0')
  6. Check Windows version → status: "Checking Windows"
     Compare device.winVersion to TARGET_WIN_VERSION ('23H2')
  7. Check encryption, CrowdStrike, SCCM
  8. Determine terminal status:
     → "Success" if all checks pass
     → "Scan Complete" if any check fails (needs remediation)
```

### Step-by-step

#### Step 5.1 — Configure scan settings

```
In Deployment Runner → Advanced Settings panel:

  Max Retries:    [3]   ← how many times to retry a connection before giving up
  Retry Delay:   [2s]   ← how long to wait between retries
  Auto Reboot:  [OFF]   ← safer OFF for new techs; turn ON if confident

Recommended defaults for new tech:
  Max Retries = 3
  Retry Delay = 2s
  Auto Reboot = OFF
```

#### Step 5.2 — Start Scan

```
Click: Start Scan

SecureCredentialModal opens:
  Enter: Username (admin account for device access)
  Enter: Password
  Click: Confirm

Credentials are used only for this scan session.
They are NEVER stored in browser, localStorage, or application state.
(See: components/SecureCredentialModal.tsx)
```

#### Step 5.3 — Watch live status transitions

```
Each device row updates in real time:

  Pending → Pending Validation → Waking Up → Connecting
         → Retrying... (if connection fails on first try)
         → Checking Info → Checking BIOS → Checking DCU → Checking Windows

Terminal outcomes (bold = action needed):
  ✅ Success          — all checks passed, device is compliant
  ⚠️  Scan Complete   — checks done, one or more failed → needs remediation
  ❌  Offline         — could not connect after all retries → check power/network
  ❌  Failed          — scan error (not connectivity) → see logs
```

#### Step 5.4 — Review per-device compliance detail

```
Click any device row to expand compliance checklist:

  ┌────────────────────────────────────────────────┐
  │ HQ-LT-042 — Scan Complete                      │
  ├────────────────────────────────────────────────┤
  │ ✅ BIOS: A24 (current)                         │
  │ ❌ DCU:  4.8.0 → needs 5.1.0                  │
  │ ❌ Win:  22H2 → needs 23H2                     │
  │ ✅ BitLocker: Enabled                           │
  │ ✅ CrowdStrike: Running                         │
  │ ✅ SCCM: Healthy                               │
  └────────────────────────────────────────────────┘

Model: Dell Latitude 5540   Serial: ABC123   Asset: XYZ789
IP: 10.10.5.42              RAM: 16 GB       Disk: 450 GB free / 512 GB
```

---

## 8. Phase 6 — Remediation (Bring to Compliance)

### What happens in this phase

Devices showing `Scan Complete` need one or more updates. The operator applies updates
(BIOS / DCU / Windows), executes post-imaging scripts, or runs file operations. After updates,
devices may require a reboot before reaching `Success`.

### Code that runs this phase

- **`services/deploymentService.ts:updateDevice()`** — BIOS, DCU, Windows update logic
- **`services/deploymentService.ts:executeScript()`** — post-image script execution
- **`services/deploymentService.ts:performDeploymentOperation()`** — Run / Install / Delete
- **`components/BulkActions.tsx`** — bulk update, validate, execute, cancel, remove, file ops
- **`components/DeviceStatusTable.tsx`** — per-device update and reboot buttons

### `updateDevice()` internal flow

```
updateDevice(device, settings):
  1. If BIOS needs update:
     → status: "Updating BIOS"
     → ~15% chance of failure (simulated real-world failure rate)
     → sets rebootRequired = true (BIOS always requires reboot)
  2. If DCU needs update:
     → status: "Updating DCU"
     → ~15% chance of failure
  3. If Windows needs update:
     → status: "Updating Windows"
     → ~15% chance of failure
  4. If all updates succeed:
     → status: "Update Complete (Reboot Pending)" if reboot needed
     → status: "Success" if no reboot needed
  5. If any update fails:
     → status: "Failed"
     → error reason logged
```

### Step-by-step

#### Step 6.1 — Sort devices by status

```
Review the device list. Focus on:
  ⚠️ Scan Complete → these need updates
  ❌ Offline        → fix power/network before acting
  ✅ Success        → done, no action needed
```

#### Step 6.2 — Update a single device

```
For one device in Scan Complete:
  Find the device row → click Update button
  Watch status transition:
    Scan Complete → Updating → Updating BIOS / DCU / Windows
    → Update Complete (Reboot Pending) OR Failed OR Success
```

#### Step 6.3 — Bulk update a group of devices

```
For multiple devices all in Scan Complete (same update needs):
  1. Select checkboxes next to target devices
  2. Click Bulk Update in BulkActions panel
  3. Watch all selected devices update in parallel (Promise.all)
     Note: bulk update runs all selected devices simultaneously —
     use this only on homogeneous cohorts (same update needs)

Outcomes per device:
  → Success (if all updates completed and no reboot needed)
  → Update Complete (Reboot Pending) (if reboot required)
  → Failed (check logs for reason)
```

#### Step 6.4 — Handle reboot pending

```
If devices show "Update Complete (Reboot Pending)":

  Option A — Manual reboot (recommended for new techs):
    Click Reboot button on individual device
    Device reboots, reconnects, re-validates automatically

  Option B — Enable Auto Reboot (before starting scan):
    Go to Advanced Settings → Auto Reboot → ON
    Devices will reboot automatically after updates
    Do this only if you're confident in your environment

After reboot:
  Device status should transition back through Connecting → Checking → Success
```

#### Step 6.5 — Execute post-image script

```
If a device needs a post-imaging script run:
  1. Click the script attach button for the device
  2. Select the script file (e.g., postimage.ps1)
  3. Status changes to: "Ready for Execution"
  4. Click Execute

  For multiple devices with scripts attached:
    Select all "Ready for Execution" devices
    Click Bulk Execute

Outcomes:
  → Execution Complete
  → Execution Failed (check logs; re-run or escalate)
```

#### Step 6.6 — File operations (Run / Install / Delete)

```
Use Bulk Actions file operations for:
  • Running a one-time executable on devices
  • Installing a package from a file
  • Deleting a program or file on devices

Steps:
  1. Select target devices
  2. Click "Select Deploy File" → choose file
  3. Click Run / Install / Delete as appropriate
  4. Review per-device outcome in device rows and logs
```

---

## 9. Phase 7 — Verify Closure (Re-Scan)

### What happens in this phase

After all remediation actions, perform a final validation sweep. This confirms that every device
that received updates is now compliant, and surfaces any that still need attention.

### Code that runs this phase

- **`services/deploymentService.ts:validateDevices()`** — re-validation for selected or all
- **`components/RescanConfirmationModal.tsx`** — confirmation gate before re-scan-all
- **`contexts/AppContext.tsx:RE_SCAN_ALL`** — triggers full re-scan

### Step-by-step

#### Step 7.1 — Re-scan all devices

```
Click: Re-Scan All
A confirmation modal appears (RescanConfirmationModal):
  "This will re-validate all devices. Continue?"
  Click: Confirm

All devices cycle through Connecting → Checking → terminal status again.
```

#### Step 7.2 — Confirm closure

```
After re-scan completes:

  Expected result:
    ✅ Success — all remediated devices pass
    ⚠️  Scan Complete — still failing → check logs, re-update, escalate if repeated
    ❌  Offline → device lost power or network; fix and re-scan individually

  Acceptable closure threshold (define per your environment):
    Example: 95%+ Success = proceed to archive
    Example: 100% Success = required for high-security environments
```

---

## 10. Phase 8 — Evidence and Archiving

### What happens in this phase

The run is archived. An immutable summary is generated capturing total devices, success counts,
failure reasons, and timing. This becomes the audit record for the run.

### Code that runs this phase

- **`services/deploymentService.ts:generateRunArchive()`** — produces the `DeploymentRun` record
- **`contexts/AppContext.tsx:ARCHIVE_RUN`** — stores run in `state.runner.history` (last 10)
- **`components/DeploymentHistory.tsx`** — displays history list with CSV export
- **`components/DeploymentAnalytics.tsx`** — bar and trend charts for the run history

### Step-by-step

#### Step 8.1 — Archive the run

```
After final re-scan:
  The run archive is generated automatically (or via a manual Archive button).

  Archive contains:
    • Run timestamp (start + end)
    • Total devices processed
    • Success count + percentage
    • Scan Complete (needs action) count
    • Offline count
    • Failed count
    • Failure categories (top error types)
    • Individual device outcomes
```

#### Step 8.2 — Review history and analytics

```
Click: Deployment History section (in Deployment Runner tab)

Shows:
  • Last 10 run summaries
  • Success rate trend bar chart
  • Top update types (BIOS / DCU / Windows frequency)
  • Top failure reasons

Use "Export to CSV" to save run data for shift handoff or reporting.
```

#### Step 8.3 — Complete shift handoff

```
Fill out the Shift Handoff Template (from README.md Appendix):

  # Shift Handoff
  Start: [time]   End: [time]   Operator: [your name]
  Total: 18  |  Success: 16  |  Scan Complete: 1  |  Offline: 1  |  Failed: 0
  Actions: 2 scans, 3 update waves, 1 bulk script exec, 1 re-scan
  Issues: HQ-LT-039 offline (power cable loose — resolved)
  Next shift: Re-scan HQ-LT-039 after confirming ethernet
```

---

## 11. Phase 9 — Remove Devices (Clean Queue)

### What happens in this phase

Confirmed successful devices are removed from the Deployment Runner queue, leaving only
outstanding items. This keeps the queue clean and prevents stale device records from polluting
future runs.

### Code that runs this phase

- **`contexts/AppContext.tsx:REMOVE_DEVICES`** — removes selected device IDs from `state.runner.devices`
- **`components/BulkActions.tsx`** — "Remove Selected" button
- **`components/DeviceStatusTable.tsx`** — per-device remove button

### Step-by-step

#### Step 9.1 — Select devices to remove

```
In Deployment Runner device list:
  • Select all devices with status: Success
  • Do NOT remove devices still in Offline, Scan Complete, or Failed
    unless you are intentionally deferring them to a separate queue

Tip: sort by status column to group Success devices at top.
```

#### Step 9.2 — Bulk Remove

```
With Success devices selected:
  Click: Bulk Remove (in BulkActions panel)
  OR
  Click: Remove button on an individual device row

Confirm: devices disappear from the active list.
```

#### Step 9.3 — Confirm Image Monitor is clean

```
Click: Image Monitor tab

Devices that are fully processed:
  • May still show in Image Monitor if not manually removed there
  • Click Remove on the Image Monitor card to clear them
  • Or leave them — Image Monitor records are reference, not active work items
```

#### Step 9.4 — Final state check

```
After removal:

  Deployment Runner device list should show:
    • Empty (if all devices were successful) — ideal
    • Only outstanding items (Offline, Scan Complete, Failed) — document and hand off

  Log: All activity is preserved in the log panel for this session.
  History: The archived run appears in Deployment History.

  ✓ Device lifecycle complete.
```

---

## 12. Troubleshooting

### AutoTag not showing device in Image Monitor

```
Symptom: You ran AutoTag successfully but device doesn't appear in Image Monitor.

Checks:
  1. Did AutoTag print "Intake published successfully"?
     → No: re-run autotag.bat; check network share path from WinPE
     → Yes but still not showing: wait 60 more seconds (polling interval)
  2. Is ethernet connected to the imaging VLAN port?
     → Verify physical cable and switch port VLAN assignment
  3. Is the network share accessible from WinPE?
     → Test: ping the share server from the WinPE cmd prompt
  4. If all checks pass and still not showing:
     → Document manually: hostname + MAC + rack slot
     → Load into Deployment Runner via CSV as fallback
     → Escalate to platform engineer if repeated
```

### Device shows Offline in Deployment Runner

```
Symptom: Device status stays "Offline" after scan.

Checks:
  1. Is device powered on?
  2. Is ethernet cable plugged in?
  3. Is device on the correct VLAN (not imaging VLAN if already deployed)?
  4. Increase Max Retries to 5 and Retry Delay to 5s, then re-scan individually
  5. Try Wake-on-LAN: right-click device → Send WoL
  6. RDP to device manually to confirm it's reachable (Remote Desktop tab)
  7. If still offline after all checks: remove from queue, troubleshoot separately
```

### Bulk Update failed on some devices

```
Symptom: After bulk update, some devices show "Failed".

Checks:
  1. Check per-device logs (expand device row, view log section)
  2. Common reasons:
     - BIOS update file not staged (missing from update path)
     - Insufficient disk space
     - Update service not running on device
     - Device rebooted mid-update
  3. Re-try update on failed devices individually (not bulk)
  4. If same device fails 3+ times: remove and escalate
```

### Credentials modal keeps appearing / scan won't start

```
Symptom: Credential modal opens but scan doesn't begin after confirming.

Checks:
  1. Confirm username format (domain\username or just username)
  2. Check that password is correct (no Caps Lock)
  3. Close and reopen the modal once
  4. Refresh the browser tab and retry (note: this clears device list if not yet archived)
     → Archive or note device list before refreshing
```

### Device showing wrong device type icon

```
Symptom: A laptop shows as desktop icon (or vice versa).

Reason: Device type is detected from hostname substrings (utils/helpers.ts:detectDeviceType).

Fix options:
  1. Rename the hostname to include the type substring (e.g., 'lt' for laptop)
  2. This is cosmetic only — does not affect scan or compliance results
```

---

## 13. Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│           SECURE DEPLOYMENT RUNNER — QUICK REFERENCE            │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 1 — INTAKE (AutoTag)                                      │
│   Power + Ethernet → PXE Boot → F8 → powershell → autotag.bat  │
│   Enter: Slot / Hostname / Your Name → Y to confirm            │
│   Verify: "published successfully" + visible in Image Monitor   │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 2 — IMAGING (Image Monitor)                               │
│   Continue task sequence → watch progress bar                   │
│   Wait for status: Completed (do NOT transfer until then)       │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 3 — COMPLIANCE CHECK (automatic)                          │
│   Imaging → Checking Compliance → Completed                     │
│   Review icons: green = pass, red = flag                        │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 4 — TRANSFER                                              │
│   Select Completed devices → Transfer Selected                  │
│   Verify: device appears in Deployment Runner → status: Pending │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 5 — SCAN                                                  │
│   Settings: Retries=3, Delay=2s, AutoReboot=OFF                 │
│   Start Scan → enter credentials → watch status transitions     │
│   Outcomes: Success / Scan Complete / Offline                   │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 6 — REMEDIATION                                           │
│   Scan Complete → Bulk Update (homogeneous cohorts only)        │
│   Reboot Pending → Reboot → re-validate                         │
│   Script needed → attach → Execute                              │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 7 — VERIFY                                                │
│   Re-Scan All → confirm Completes → confirm Success rate        │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 8 — ARCHIVE                                               │
│   Archive run → export CSV → fill shift handoff template        │
├─────────────────────────────────────────────────────────────────┤
│ PHASE 9 — REMOVE                                                │
│   Select Success devices → Bulk Remove → queue clean            │
├─────────────────────────────────────────────────────────────────┤
│ WAVE SIZE GUIDE (see CAPACITY.md for full detail)               │
│   New tech:         5–10 devices per wave                       │
│   Experienced:     10–25 devices per wave                       │
│   With automation: 25–50 devices per wave                       │
│   100+ devices:    Requires backend infra + parallelism         │
└─────────────────────────────────────────────────────────────────┘
```
