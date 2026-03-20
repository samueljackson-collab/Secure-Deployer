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
