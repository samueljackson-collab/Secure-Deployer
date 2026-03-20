# Secure Deployment Runner — Full Process SOP

> **Scope:** End-to-end standard operating procedure for device imaging intake through deployment closure. Covers all operator roles, lifecycle stages, and handoff checkpoints.

---

## Table of Contents

1. [Roles and Responsibilities](#1-roles-and-responsibilities)
2. [Process Overview — ASCII Flow](#2-process-overview--ascii-flow)
3. [Stage 1 — Device Add and Imaging Intake](#3-stage-1--device-add-and-imaging-intake)
4. [Stage 2 — Post-Image Compliance Gate](#4-stage-2--post-image-compliance-gate)
5. [Stage 3 — Transfer to Deployment Runner](#5-stage-3--transfer-to-deployment-runner)
6. [Stage 4 — Deployment Scan and Remediation](#6-stage-4--deployment-scan-and-remediation)
7. [Stage 5 — Closure and Archival](#7-stage-5--closure-and-archival)
8. [Stage 6 — Remove and Return](#8-stage-6--remove-and-return)
9. [Shift Handoff Procedure](#9-shift-handoff-procedure)
10. [Escalation and Exception Handling](#10-escalation-and-exception-handling)
11. [Known Process Gaps and Mitigations](#11-known-process-gaps-and-mitigations)

---

## 1. Roles and Responsibilities

| Role | Stage Ownership | Primary Responsibility |
|---|---|---|
| Imaging Technician | Stages 1–3 | Boot devices into WinPE, run AutoTag, monitor imaging progress, validate compliance, transfer to runner |
| Deployment Operator | Stages 4–6 | Start scan, remediate failures, archive run, remove devices, produce shift summary |
| Shift Lead | All stages | Oversight, exception approval, shift handoff sign-off |
| Platform Engineer | N/A (support) | Resolve tooling issues, update scripts, manage WDS/MDT share |

---

## 2. Process Overview — ASCII Flow

```
IMAGING INTAKE
──────────────
[Device power-on]
      │
      ▼
[PXE Boot via WDS/MDT]
      │
      ▼
[Task Sequence Wizard launches in WinPE]
      │
      ▼  (F8 console)
[autotag.bat / AutoTag.ps1 runs]
      │  Collects: MAC, Serial, Model, IP
      │  Prompts:  Rack Slot, Hostname, Tech Name
      │
      ▼
[JSON written to \\SHARE\AutoTag\]
      │
      ▼
[Image Monitor polls share every 30s]
      │
      ▼
[Device card appears in rack grid]
      │
      ▼  (imaging runs in background)
[Progress bar: 0% → 100%]
      │
      ▼
[runComplianceChecks: BitLocker · Citrix · LAPS · SCCM]
      │
      ├──(all pass)──▶ Status: Completed (PASS)
      │
      └──(any fail)──▶ Status: Completed with flags (FLAGS)

HANDOFF CHECKPOINT
──────────────────
[Tech reviews flags, corrects if possible, then clicks Transfer Selected]
      │
      ▼
[transformImagingToRunnerDevices converts ImagingDevice → Device]
      │
      ▼
[Device record appears in Deployment Runner queue]

DEPLOYMENT SCAN AND REMEDIATION
─────────────────────────────────
[Operator clicks Start Scan → enters credentials]
      │
      ▼
[runDeploymentFlow iterates queue sequentially]
      │
      ▼  per device:
[validateDevice: WoL → Connect (retry) → Gather Info → Check BIOS/DCU/Win/Enc/CS/SCCM]
      │
      ├──(all pass)──▶ Status: Success
      │
      ├──(any fail)──▶ Status: Scan Complete → operator remediates
      │                      │
      │                      ▼
      │                [updateDevice: BIOS / DCU / Windows]
      │                      │
      │                      ├──(reboot required)──▶ Rebooting → re-validate → Success
      │                      │
      │                      └──(no reboot)──▶ Success
      │
      └──(unreachable)──▶ Status: Offline → manual triage

CLOSURE
────────
[Re-scan all → verify Success rate]
      │
      ▼
[Archive Run → generateRunArchive() → history]
      │
      ▼
[Remove devices from queue]
      │
      ▼
[Shift summary produced]
```

---

## 3. Stage 1 — Device Add and Imaging Intake

### Prerequisites

- WDS/MDT server reachable on imaging VLAN
- Network share (`\\SERVER\AutoTag\`) is accessible from WinPE with write permissions
- `AutoTag.bat` / `AutoTag.ps1` deployed to Task Sequence
- Image Monitor tab is open in the browser

### Steps

1. Power on the device. Ensure PXE boot is first in BIOS boot order.
2. Allow Task Sequence to load in WinPE.
3. Press **F8** to open a command prompt. Run:
   ```
   autotag.bat
   ```
   Or if using PowerShell variant:
   ```
   powershell -ExecutionPolicy Bypass -File autotag.ps1
   ```
4. At the prompts, enter:
   - **Rack Slot**: physical slot number (e.g., `A-07`)
   - **Hostname**: target hostname following naming convention (e.g., `HQ-LT-042`)
   - **Technician Name**: your name or badge ID
5. Script confirms JSON written to share. Example output:
   ```
   [AutoTag] Collected: 00:1A:2B:3C:4D:5E / SN123456 / Latitude 5540
   [AutoTag] Written to: \\SHARE\AutoTag\HQ-LT-042.json
   ```
6. In Image Monitor, confirm the device card appears within 30 seconds.
7. If the card does not appear, see [Escalation and Exception Handling](#10-escalation-and-exception-handling).

### Troubleshooting

| Symptom | Likely Cause | Action |
|---|---|---|
| Card doesn't appear in 30s | Network share unreachable from WinPE | Check share path in script, verify VLAN routing |
| MAC listed as `00:00:00:00:00:00` | WinPE NIC driver not loaded | Inject driver into boot image via MDT Driver Library |
| Script errors on write | Insufficient permissions | Verify share ACL allows DOMAIN COMPUTERS write access |

---

## 4. Stage 2 — Post-Image Compliance Gate

After imaging reaches 100%, `runComplianceChecks()` runs automatically and checks:

| Check | Pass Condition |
|---|---|
| BitLocker | Volume encryption is enabled on OS drive |
| Citrix Workspace | Application installed at expected path |
| LAPS | Local Administrator Password Solution agent installed and active |
| SCCM | Client service installed and running |

### Reviewing Compliance Results

- **Green check** next to an item = passed
- **Red flag** next to an item = failed; click the compliance icon for details
- **Status: Completed (PASS)** — all four checks passed
- **Status: Completed with flags (FLAGS)** — one or more checks failed

### When Flags Are Present

1. Click the compliance detail icon on the device card.
2. Review which checks failed.
3. If correctable before transfer (e.g., SCCM client not running — can be triggered remotely), resolve and click **Re-validate**.
4. If not correctable at this stage, note the flag and proceed with transfer. Flags are visible to the Deployment Operator after handoff.

> **Rule:** Do not block transfer for Citrix-only failures if the deployment wave is non-VDI. Note in the shift log and proceed.

---

## 5. Stage 3 — Transfer to Deployment Runner

### Steps

1. In Image Monitor, review all device cards. Confirm:
   - All expected devices are present (no missing cards)
   - Progress is at 100% for all devices to be transferred
   - Compliance status is reviewed (flags noted)
2. Select the devices to transfer (checkboxes, or **Select All**)
3. Click **Transfer Selected**
4. Confirm: selected devices disappear from Image Monitor
5. Switch to **Deployment Runner** tab — devices appear in the queue with status `Pending`

### What Happens Internally

`TRANSFER_IMAGING_DEVICES_TO_RUNNER` is dispatched to the reducer.
`transformImagingToRunnerDevices()` in `services/deploymentService.ts` maps each `ImagingDevice` to a `Device`, copying: hostname, MAC, model, serial, rack slot, technician name, and initial compliance flags.

---

## 6. Stage 4 — Deployment Scan and Remediation

### Pre-Scan Checklist

- [ ] All devices visible in Deployment Runner queue
- [ ] Device count matches expected wave size
- [ ] Retry/delay settings match site network profile (see `docs/CAPACITY.md`)
- [ ] Log panel is visible and scrolling
- [ ] Escalation path known for repeat failures

### Starting a Scan

1. Click **Start Scan**
2. Enter administrative credentials in the modal (session-only — never stored)
3. Click **Confirm** — scan begins immediately

### Scan Flow per Device

```
Pending
  → Pending Validation
  → Waking Up        (WoL signal sent)
  → Connecting       (TCP attempt, up to maxRetries)
  → Retrying...      (if attempt N < maxRetries)
  → Checking Info    (model, serial, disk, RAM)
  → Checking BIOS    (vs TARGET_BIOS_VERSION)
  → Checking DCU     (vs TARGET_DCU_VERSION)
  → Checking Windows (vs TARGET_WIN_VERSION)
  → [terminal state]
```

### Terminal States and Actions

| Status | Meaning | Operator Action |
|---|---|---|
| Success | All compliance criteria met | No action needed — device is closure-ready |
| Scan Complete | One or more checks failed | Apply targeted updates (BIOS / DCU / Windows) then re-scan |
| Offline | Retries exhausted | Check physical connectivity; retry individually or remove for manual triage |

### Remediation Steps for Scan Complete Devices

1. Review compliance checklist for the device row — identify which checks failed
2. For BIOS/DCU/Windows: click **Update** for the specific check, or use **Bulk Update** for the cohort
3. If `autoRebootEnabled = true`, device reboots automatically and re-enters Scanning state
4. If `autoRebootEnabled = false`, click **Reboot** when prompted after update completes
5. Device transitions: `Rebooting... → Connecting → Checking → Success`
6. For script failures: click **Execute Script** on the device row; review log output

---

## 7. Stage 5 — Closure and Archival

### Closure Verification

1. After final remediation wave, click **Re-Scan All** (confirmation modal required)
2. Verify all devices reach `Success` — or confirm acceptable residual rate with shift lead
3. Click **Archive Run** — `generateRunArchive()` produces an immutable summary:
   - Total devices, success count, offline count, failed count
   - Failure category mapping
   - Timestamp and operator credentials used (credentials are ephemeral — only audit record is retained)
4. Archive appears in **Deployment History** panel (last 10 runs retained in state)
5. Optional: click **Export CSV** in History to produce a shift artifact

### Acceptable Closure Thresholds (Reference)

| Metric | Target | Escalate If |
|---|---|---|
| Success rate | >= 90% | < 80% after two remediation waves |
| Offline rate | <= 5% | > 10% — investigate network/power |
| Script failure rate | <= 5% | > 15% — review script for compatibility issues |

---

## 8. Stage 6 — Remove and Return

1. After archive is confirmed, select all `Success` devices
2. Click **Remove Selected** — devices leave the queue
3. For `Offline` or `Failed` devices remaining: tag them in shift notes with hostname, failure category, and next-action owner
4. Devices leaving the active queue does not delete the run archive — history is retained

---

## 9. Shift Handoff Procedure

Complete this at the end of every deployment shift:

```
SHIFT HANDOFF
─────────────
Window:        [Start] → [End]
Operator:      [name]
Wave size:     [N devices]

Results:
  Success:              [N]
  Scan Complete (open): [N]
  Offline:              [N]
  Failed:               [N]

Actions performed:
  Scans initiated:      [N]
  Update waves:         [N]
  Script executions:    [N]
  Re-scans:             [N]

Outstanding items:
  [hostname] — [failure class] — [next-action owner]

Carry-over to next shift:
  1. [item]
  2. [item]

Archive reference:
  Run ID / History index: [N]
```

---

## 10. Escalation and Exception Handling

| Scenario | Escalation Path |
|---|---|
| Device card never appears in Image Monitor | Platform Engineer — check AutoTag script, share path, WinPE NIC driver |
| BIOS update fails on 3+ devices in same model cohort | Platform Engineer — check BIOS payload version compatibility |
| All devices show Offline after WoL | Network team — check switch VLAN, WoL UDP broadcast, management VLAN routing |
| Script execution failure rate > 15% | Platform Engineer — inspect script for environment assumptions |
| Credential rejection at scan start | Shift Lead — confirm credential scope; check AD lockout state |
| Scan hangs indefinitely (no status transitions) | Reload browser tab; check if AppContext state is corrupted; restart dev server if in dev mode |

---

## 11. Known Process Gaps and Mitigations

| Gap | Mitigation | Owner | Target |
|---|---|---|---|
| No automated unit/integration tests | Manual operator walkthrough per sprint | Frontend maintainer | Sprint +2 |
| Lint baseline is red (unused variables) | Flag in PR; don't block deployments | Frontend maintainer | Next sprint |
| No CI pipeline (GitHub Actions) | Manual build+lint check before release | Frontend maintainer | Next sprint |
| Mock service — not live PowerShell | Explicit simulation boundary; behavior documented in `services/deploymentService.ts` | Platform Engineer | Sprint +3 (backend adapter POC) |
| No RBAC — all actions available to all users | Operator training + confirmation gates | Platform + Security | Sprint +4 |
| PXE/zero-touch not yet implemented | Manual AutoTag intake documented here | Platform Engineer | Sprint +5 |

---

*Document owner: Repo maintainer. Update per major merge. See `README.md` for full documentation index.*
# End-to-End Process SOP

> **Scope:** This document covers the full operator workflow from device power-on through final run archive — from imaging intake to compliance confirmation. It mirrors the data flow diagram in `README.md` and is intended as a start-of-shift reference for imaging technicians and deployment operators.

---

## Overview

```
Device Powers On
      │
      ▼
PXE Boot → WDS/MDT Task Sequence
      │
      ▼
AutoTag (F8 → PowerShell → autotag.bat)
      │  Collects: MAC · Serial · Model · IP
      ▼
Tech enters: Rack Slot · Hostname · Name
      │
      ▼
JSON written to Network Share
      │
      ▼
Image Monitor polls share (every 30 s)
      │
      ▼
Device card appears in rack view → imaging progresses 0 → 100%
      │
      ▼
runComplianceChecks (BitLocker · CrowdStrike · SCCM · BIOS · DCU · Windows)
      │
      ▼
Status: Completed ✅  or  Completed with flags ⚠️
      │
      ▼
Tech clicks "Transfer Selected"
      │
      ▼
transformImagingToRunnerDevices() → Device records created
      │
      ▼
Deployment Runner tab — device appears with status: Pending
      │
      ▼
Tech clicks "Start Scan" → enters credentials
      │
      ▼
runDeploymentFlow() → validateDevice() per device
      │
      ▼
Status: Scan Complete (needs updates)  or  Success (fully compliant)
      │
      ▼
Bulk updates (BIOS / DCU / Windows) → reboot → re-scan
      │
      ▼
Execute post-imaging script → Execution Complete
      │
      ▼
generateRunArchive() → run summary appended to history (last 10 retained)
```

---

## Phase 1: Imaging Intake (Image Monitor Tab)

### 1.1 Device Power-On & PXE Boot

1. Plug device into the imaging network.
2. Power on — device should PXE boot via WDS/MDT.
3. Task sequence launches automatically.
4. At the F8 prompt (WinPE shell), the tech runs:
   ```
   autotag.bat
   ```
   AutoTag collects: MAC address, serial number, model name, IP address.

### 1.2 Tech Enters Metadata

At the AutoTag prompt, the tech provides:
- **Rack Slot** — physical slot number (1–16)
- **Hostname** — target asset name (e.g., `LPT-FIN-091`)
- **Tech Name** — operator ID for audit trail

AutoTag writes a JSON record to the configured network share.

### 1.3 Image Monitor Polling

- Image Monitor polls the network share every **30 seconds**.
- New device cards appear in the rack grid automatically.
- Progress bar advances from 0% → 100% as the task sequence runs.
- Compliance checks run at completion: BIOS version · DCU version · Windows version · BitLocker · CrowdStrike · SCCM agent.

### 1.4 Resolving Imaging Flags

If a device completes with flags (⚠️):
- Click the device card to see which compliance checks failed.
- Common causes: BitLocker not yet activated, SCCM agent not enrolled, driver version mismatch.
- Resolve manually or note for post-transfer remediation.

### 1.5 Transfer to Deployment Runner

When one or more devices show **Completed** or **Completed with flags**:

1. Select devices using checkboxes (or use **Transfer All Completed**).
2. Click **Transfer Selected** (or **Transfer All**).
3. `transformImagingToRunnerDevices()` converts imaging records into `Device` records.
4. Devices appear in the **Deployment Runner** tab with status `Pending`.

---

## Phase 2: Deployment Run (Deployment Runner Tab)

### 2.1 Load Devices

Devices enter the runner via one of two paths:
- **Transfer from Image Monitor** (covered in Phase 1)
- **CSV Import** — drag-and-drop or click to upload; requires `Hostname` and `MAC` columns; `parseDevicesFromCsv()` normalizes MAC format and reports row-level errors.

### 2.2 Pre-Run Checklist

Before clicking **Start Scan**:

- [ ] Correct device cohort is loaded (verify hostnames match shift manifest)
- [ ] No stale devices from a previous run (use **Remove** for any that don't belong)
- [ ] Retry settings are appropriate (`maxRetries` and `retryDelay` in Advanced Settings)
- [ ] Credentials available for the scan credential prompt

### 2.3 Start Scan

1. Click **Start Scan** (or **Validate Selected** for a subset).
2. Enter scan credentials in the **Secure Credential Modal** — credentials are session-only and never persisted.
3. `runDeploymentFlow()` iterates devices sequentially.
4. `validateDevice()` per device: wakes device, connects, checks BIOS/DCU/Windows/BitLocker/CrowdStrike/SCCM.
5. Device status transitions:

| Status | Meaning |
|---|---|
| `Pending` | Not yet scanned |
| `Waking Up` | Wake-on-LAN sent |
| `Connecting` | TCP connection attempt |
| `Checking BIOS` / `Checking DCU` / `Checking Windows` | Compliance checks running |
| `Scan Complete` | Compliant but needs updates |
| `Success` | Fully compliant — no action required |
| `Offline` | Unreachable after max retries |

### 2.4 Run Updates

For devices in `Scan Complete`:

1. Select affected devices (or use **Select All Scan Complete**).
2. Click **Run Updates** — updates BIOS, DCU, and Windows version in sequence.
3. Devices that require a reboot transition to `Reboot Pending`.
4. Click **Reboot** (bulk or individual) — devices reboot and re-enter scanning automatically.

### 2.5 Execute Post-Imaging Script

After updates are complete:

1. Ensure target devices are in `Update Complete` or `Success` state.
2. Click **Execute Script** — runs the post-imaging PowerShell payload via `executeScript()`.
3. Monitor per-device log output in the **Log Viewer** panel.
4. Status transitions: `Pending File` → `Ready for Execution` → `Executing Script` → `Execution Complete` or `Execution Failed`.

### 2.6 Re-Scan for Final Verification

After remediation:

1. Select devices for re-scan (or use **Rescan All**).
2. Confirm the re-scan-all confirmation modal (prevents accidental re-scans during active runs).
3. Devices return to scanning states; successful ones reach `Success`.

### 2.7 Close Run & Archive

When the cohort is complete (target: all devices at `Success`):

1. Click **End Run** — `generateRunArchive()` generates an immutable run summary.
2. Summary is appended to run history (last 10 runs retained in `state.runner.history`).
3. Export the CSV run summary for shift handoff or leadership review.
4. Clear the device queue for the next cohort.

---

## Phase 3: Post-Run Reporting

### 3.1 Deployment History Tab

- View the last 10 run summaries.
- Each run shows: device count, success count, failure count, offline count, start/end time.
- Export any run as CSV.

### 3.2 Trends & Analytics Tab

- Review success rate trends across runs.
- Identify patterns: recurring offline devices, high update failure rates, slow cohorts.
- Use analytics to tune `maxRetries` and `retryDelay` settings for subsequent waves.

### 3.3 Shift Handoff

At shift end, provide the incoming operator with:
- Run archive CSV or history screenshot
- List of unresolved devices (Offline or Execution Failed) with last-known status
- Any site-specific issues observed during the shift

---

## Quick Reference: Status → Next Action

| Current Status | Recommended Action |
|---|---|
| `Pending` | Start Scan |
| `Offline` | Check physical network; retry scan |
| `Scan Complete` | Run Updates |
| `Reboot Pending` | Reboot |
| `Update Complete` | Execute Script or final re-scan |
| `Execution Failed` | Review logs; retry script or pull for manual triage |
| `Success` | Mark complete; include in run archive |

---

## Related Documents

- [README.md](../README.md) — Full project overview, scope, and architecture
- [docs/CAPACITY.md](./CAPACITY.md) — Wave sizing and scalability guidance
- [docs/AUTOMATION.md](./AUTOMATION.md) — PXE automation tiers and zero-touch options
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — Technical architecture deep-dive
