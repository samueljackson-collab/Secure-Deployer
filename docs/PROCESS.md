# Secure Deployment Runner — End-to-End Process SOP

> **Audience:** Imaging technicians, deployment operators, and shift leads.
> **Purpose:** Step-by-step standard operating procedure for the full add → image → deploy → close workflow.

---

## Prerequisites

Before starting a deployment window:

- [ ] Node.js 18+ installed; app running (`npm run dev` or served from `dist/`)
- [ ] Network share accessible from the WDS/MDT server (for AutoTag)
- [ ] Device list (CSV) or Image Monitor feed is ready
- [ ] Credentials for scan (domain account with local admin on targets) are on hand
- [ ] Retry/delay settings reviewed and set to match network conditions (see [CAPACITY.md](./CAPACITY.md))
- [ ] Escalation path documented for shift

---

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FULL DEPLOYMENT WORKFLOW                        │
│                                                                     │
│  [Add Devices] ──► [Image Monitor] ──► [Transfer] ──► [Run Scan]   │
│                                                                     │
│  [Run Scan] ──► [Remediate] ──► [Re-Scan] ──► [Archive] ──► [Done] │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 1 — Add Devices

### Option A: CSV Import

1. Prepare a CSV file with at minimum two columns: `Hostname` and `MAC`.

   ```csv
   Hostname,MAC
   HQ-LT-001,00:1A:2B:3C:4D:5E
   BRANCH-SFF-007,10-20-30-40-50-60
   REMOTE-TOWER-03,00.11.22.33.44.55
   ```

2. Open the **Deployment Runner** tab.
3. Use the **Upload CSV** control in the Bulk Actions panel.
4. Review row-level errors surfaced in the log panel — correct invalid MACs or missing hostnames before proceeding.

> **MAC formats accepted:** colon-separated (`00:1A:2B`), hyphen-separated (`00-1A-2B`), dot-separated (`00.1A.2B`). All are normalized to uppercase hex internally.

### Option B: Image Monitor Transfer

See Step 2 below. Devices that complete imaging and pass initial compliance checks are available to transfer directly.

---

## Step 2 — Image Monitor (PXE Imaging Flow)

1. Open the **Image Monitor** tab.
2. Ensure the WDS/MDT server is running and the AutoTag script is deployed to the task sequence. See [AUTOMATION.md](./AUTOMATION.md) for PXE setup.
3. As each device completes WinPE boot and the AutoTag script runs, a device card appears in the rack view within ~30 seconds.
4. Monitor the **progress bar** on each card (0–100%). When a device reaches 100%, Image Monitor runs:
   - BitLocker volume check
   - Citrix Workspace installation check
   - LAPS installation check
   - SCCM client health check
5. Devices show **Completed ✅** (all checks pass) or **Completed with flags ⚠️** (one or more checks failed).
6. Review the compliance icons on each card. Click the compliance badge to open the drill-down modal.
7. Select devices to transfer (individual cards or **Select All**), then click **Transfer Selected**.

> Transferred devices appear immediately in the Deployment Runner queue with status `Pending`.

---

## Step 3 — Configure Scan Settings

Before starting a scan, verify settings in the Deployment Runner **Advanced Settings** panel:

| Setting | Recommended | Notes |
|---|---|---|
| Max Retries | 2–3 | Increase to 4–5 for remote/unstable sites |
| Retry Delay | 2s | Increase to 6–10s for WAN links |
| Auto Reboot | Off (first scan) | Enable for subsequent remediation runs |

---

## Step 4 — Start Scan

1. Click **Start Scan** in the Deployment Runner.
2. The **Secure Credential Modal** opens — enter your domain account credentials.
   - Credentials are session-only; they are never persisted to disk or browser storage.
3. Click **Confirm & Start**.
4. The scan iterates devices sequentially:
   - **Waking Up** → **Connecting** → **Checking Info** → **Checking BIOS/DCU/Windows/Encryption/CrowdStrike/SCCM**
5. Watch the **Log Viewer** for real-time output. Each device settles into one of:
   - `Success` — all checks passed
   - `Scan Complete` — one or more checks failed; remediation needed
   - `Offline` — retries exhausted

---

## Step 5 — Remediate (Scan Complete Devices)

For each `Scan Complete` device, the compliance checklist shows exactly which checks failed.

### Per-device actions (row context menu or row buttons):

| Action | When to use |
|---|---|
| **Update BIOS** | BIOS version below `A24` |
| **Update DCU** | DCU version below `5.1.0` |
| **Update Windows** | Windows version below `23H2` |
| **Execute Script** | Post-image config script needs to run |
| **Reboot** | Updates applied; manual reboot needed |
| **Remote In** | Manual intervention required via RDP |

### Bulk actions (for homogeneous cohorts):

1. Select all `Scan Complete` devices using the checkbox column header.
2. Click the appropriate bulk action button (Update, Validate, Execute, etc.).
3. Monitor logs for progress.

> **Safety rule:** Never run bulk actions on mixed-status cohorts. Separate `Scan Complete` from `Offline` before acting.

---

## Step 6 — Re-Scan

After remediation:

1. Select the remediated devices (or use **Re-Scan All**).
2. Click **Re-Scan Selected** or confirm the **Re-Scan All** dialog.
3. Devices go through the validation cycle again.
4. Confirm all remediated devices now show `Success`.

> Repeat Steps 5–6 as needed for any devices that require multiple remediation cycles.

---

## Step 7 — Archive Run & Hand Off

1. When the run is complete (no more `Scan Complete` devices requiring action), click **Archive Run**.
2. The run summary is saved to **Deployment History** (last 10 runs).
3. Export the run as CSV for shift documentation if required.
4. Complete the **Shift Handoff Template** (see README Appendix) with:
   - Total processed, Success, Scan Complete (outstanding), Offline, Failed counts
   - Actions taken, notable issues, next shift priorities

---

## Step 8 — Remove Devices

After archiving:

1. Select all `Success` devices.
2. Click **Remove Selected** to clear them from the queue.
3. Leave `Offline` devices in place if they need to be retried next shift, or remove and log as escalations.

---

## Error Scenarios

| Symptom | Likely Cause | Resolution |
|---|---|---|
| Device stays `Connecting` | Firewall blocking WinRM/ICMP, device offline | Check network path; increase retry count |
| BIOS update fails | BIOS utility not pre-staged or wrong model | Stage BIOS update tool; verify model match |
| Script execution fails | Script path wrong or permissions issue | Check script path; verify admin rights |
| CSV imports 0 devices | Missing headers or all rows invalid | Check header row; correct MAC formats |
| Most devices `Offline` | Mock service simulating instability | Increase retries + delay; re-scan |

---

## Related Documents

- [Capacity & Scalability Guide](./CAPACITY.md)
- [Automation Tiers & PXE Guide](./AUTOMATION.md)
- [Technical Architecture](./ARCHITECTURE.md)
