# Secure Deployment Runner — Troubleshooting Guide

> **How to use this document:** Find your symptom in the left column. Each entry explains what the
> code is doing when the symptom appears, which file/function to look at, and what to try.

---

## Table of Contents

1. [Image Monitor — Device Not Appearing](#1-image-monitor--device-not-appearing)
2. [Image Monitor — Compliance Checks Not Running](#2-image-monitor--compliance-checks-not-running)
3. [Image Monitor — Compliance Shows Failed Unexpectedly](#3-image-monitor--compliance-shows-failed-unexpectedly)
4. [Transfer — Device Doesn't Move to Deployment Runner](#4-transfer--device-doesnt-move-to-deployment-runner)
5. [Scan — Credential Modal Opens But Scan Won't Start](#5-scan--credential-modal-opens-but-scan-wont-start)
6. [Scan — All or Most Devices Go Offline](#6-scan--all-or-most-devices-go-offline)
7. [Scan — Scan Runs But Finishes Instantly With No Results](#7-scan--scan-runs-but-finishes-instantly-with-no-results)
8. [Scan — Devices Stay on "Connecting" Forever](#8-scan--devices-stay-on-connecting-forever)
9. [Update — Bulk Update Fails on Multiple Devices](#9-update--bulk-update-fails-on-multiple-devices)
10. [Update — Device Stuck on "Update Complete (Reboot Pending)"](#10-update--device-stuck-on-update-complete-reboot-pending)
11. [Script — Execution Always Fails](#11-script--execution-always-fails)
12. [File Operations — "File Not Found" on Run/Install](#12-file-operations--file-not-found-on-runinstall)
13. [File Operations — "File In Use" on Delete](#13-file-operations--file-in-use-on-delete)
14. [RDP — Remote Desktop File Won't Download or Connect](#14-rdp--remote-desktop-file-wont-download-or-connect)
15. [History — Run Archive Shows Wrong Counts](#15-history--run-archive-shows-wrong-counts)
16. [CSV — No Devices Loaded After CSV Import](#16-csv--no-devices-loaded-after-csv-import)
17. [CSV — Devices Missing From List After Import](#17-csv--devices-missing-from-list-after-import)
18. [State — App State Lost After Browser Refresh](#18-state--app-state-lost-after-browser-refresh)
19. [Performance — UI Sluggish With Large Device List](#19-performance--ui-sluggish-with-large-device-list)
20. [General — Unexpected Behavior After Cancel](#20-general--unexpected-behavior-after-cancel)

---

## 1. Image Monitor — Device Not Appearing

**Symptom:** AutoTag ran and said "published successfully" but no device card appears in Image
Monitor.

**What the code does:**
Image Monitor reads from `state.monitor.devices`. Devices are added via the `SET_IMAGING_DEVICES`
or `UPDATE_IMAGING_DEVICE_STATE` actions dispatched from a polling function. If nothing polls,
devices never appear. In the current implementation, devices are injected directly into the monitor
state — there is no live polling loop in the production build; the polling depends on your
integration setup connecting AutoTag's JSON output to a state update.

**Code location:** `contexts/AppContext.tsx` — `SET_IMAGING_DEVICES` action; `components/ImageMonitor.tsx`

**Diagnose:**

```
Checklist:
  □ Did AutoTag print "Intake published successfully" + an Event ID + a log path?
    → No: re-run autotag.bat; check ethernet; check network share path in script config
    → Yes: AutoTag did its job; the problem is on the polling/integration side

  □ Is the app served and accessible?
    → Open browser dev tools → Console tab → any JavaScript errors?
    → Reload the app; check for network errors on the image monitor polling endpoint

  □ Is the network share path correct?
    → In ImagingScriptViewer (Script tab): confirm $NetworkSharePath matches your environment
    → Test from a cmd prompt: dir \\SERVER\SHARE\imaging_data

  □ Is the monitoring polling enabled?
    → In production: the app must have a polling loop or webhook that reads new JSON files
      and dispatches SET_IMAGING_DEVICES or UPDATE_IMAGING_DEVICE_STATE
    → In the current build: devices must be added manually or via integration
```

**Immediate workaround:** Load the device via CSV into Deployment Runner directly, bypassing
Image Monitor. The deployment scan does not depend on Image Monitor data.

---

## 2. Image Monitor — Compliance Checks Not Running

**Symptom:** Device shows `Completed` but compliance icons never update; status stays
"Completed" with no check results.

**What the code does:**
`AppContext.tsx` lines 439–448 run a `useEffect` that watches `state.monitor.devices`. When
any device is `status === 'Completed'` and lacks a `complianceCheck` object, it calls
`api.runComplianceChecks()` automatically. If this effect isn't triggering, the state update
that set `status = 'Completed'` may have also pre-populated `complianceCheck`, or the effect
cleanup is cancelling the call.

**Code location:** `contexts/AppContext.tsx:439`, `services/deploymentService.ts:runComplianceChecks()`

**Diagnose:**

```
  □ Open React DevTools → AppContext state → monitor.devices
    → Is the device status === 'Completed'?
    → Does it have a complianceCheck field already? (if yes, effect won't re-run)

  □ Is the device stuck on 'Checking Compliance'?
    → runComplianceChecks() for each device takes 2–5 seconds (simulated sleep)
    → Wait 10–15 seconds and check again

  □ Did the compliance run but all checks passed/failed with no icons updating?
    → Check if ImageRack.tsx is rendering ComplianceStatusIcon correctly
    → Ensure ComplianceResult has non-null 'details' array

  □ Try REVALIDATE_IMAGING_DEVICES action (re-validate button in rack card)
    → This forces a fresh compliance run via revalidateImagingDevices()
    → It clears complianceCheck first, so the effect will re-trigger
```

---

## 3. Image Monitor — Compliance Shows Failed Unexpectedly

**Symptom:** Device shows compliance as "Failed" but you believe it is correctly configured.

**What the code does:**
`runSingleComplianceCheck()` in `deploymentService.ts` uses `Math.random()` for all checks.
This is the mock simulation — real results depend on actual device state. In the mock:
- BitLocker: 90% pass rate
- Citrix: 90% pass rate
- LAPS: 90% pass rate
- SCCM: 85% pass rate

**Code location:** `services/deploymentService.ts:runSingleComplianceCheck()` (private function)

**Resolution in mock environment:** Re-run revalidation. Each run is independent with new
random outcomes — a "failed" check may pass on re-run (and vice versa). This is expected
mock behavior. In production, replace `runSingleComplianceCheck` with real WMI/registry checks.

**Safe rule:** A failed post-image compliance check does not block transfer. You can still
transfer and let Deployment Runner's full scan determine the real compliance state.

---

## 4. Transfer — Device Doesn't Move to Deployment Runner

**Symptom:** Click "Transfer Selected" or "Transfer All" but no device appears in
Deployment Runner.

**What the code does:**
`TRANSFER_ALL_COMPLETED_DEVICES` and `TRANSFER_SELECTED_IMAGING_DEVICES` both filter devices
by `status === 'Completed'` before transferring. If no devices are `Completed`, nothing transfers.
After transfer, the app also switches to the runner tab (`activeTab: 'runner'`).

**Code location:** `contexts/AppContext.tsx:130-150`

**Diagnose:**

```
  □ Is the device status exactly 'Completed' (not 'Imaging' or 'Checking Compliance')?
    → Wait for imaging and compliance checks to fully complete

  □ Did you select the device before clicking Transfer Selected?
    → Use checkboxes in the rack view; or use Transfer All (no selection needed)

  □ After clicking Transfer: did the tab switch to Deployment Runner?
    → If yes: look in the runner device list for the device (may need to scroll)
    → If no: open browser dev tools console for JavaScript errors

  □ Does the device appear in runner with status 'Pending File'?
    → This is correct — transferred devices start at 'Pending File'
    → If it shows something else, check transformImagingToRunnerDevices()
```

---

## 5. Scan — Credential Modal Opens But Scan Won't Start

**Symptom:** Credential modal appears, you fill in username/password, click Confirm, but the
scan never begins (devices stay on 'Pending' or 'Pending File').

**What the code does:**
`START_DEPLOYMENT_CONFIRMED` (effectRunner) closes the modal, then:
1. If `ui.csvFile` is set: runs Papa.parse → if parsing yields 0 devices, no scan starts
2. If `runner.devices.length > 0`: dispatches `INITIALIZE_DEPLOYMENT` → scan starts

If neither condition is true, nothing happens after modal close.

**Code location:** `contexts/AppContext.tsx:234-250` (effectRunner `START_DEPLOYMENT_CONFIRMED` case)

**Diagnose:**

```
  □ Are devices already in the runner list?
    → If yes: scan should start automatically. Check for console errors.
    → If no: you need to either upload a CSV or transfer from Image Monitor first

  □ Is a CSV file selected?
    → Check the file picker — is a file name shown?
    → Try re-selecting the CSV file (sometimes browsers clear file selection on re-renders)

  □ Does the CSV parse successfully?
    → After confirming credentials, log panel should show:
      "Validated and loaded N devices from filename.csv"
    → If log shows errors instead: CSV format is wrong (see Section 16)

  □ Does the scan start but finish instantly?
    → See Section 7 (Scan Runs But Finishes Instantly)
```

---

## 6. Scan — All or Most Devices Go Offline

**Symptom:** After starting a scan, most or all devices immediately show `Offline`.

**What the code does:**
`validateDevice` attempts connection up to `maxRetries` times. Each attempt has a 30% chance
of failure (`Math.random() > 0.3`). With `maxRetries = 3`, the probability of all 3 attempts
failing is: `0.3³ = 2.7%` per device. With 50 devices, expect roughly 1–2 offline devices.
If you see much more, your retry settings may be too low for your network conditions.

**Code location:** `services/deploymentService.ts:validateDevice` (private) lines 107–119

**What to try:**

```
  □ Increase Max Retries:
    → Settings panel → Max Retries = 5 (reduces offline probability to 0.3⁵ = 0.24%)

  □ Increase Retry Delay:
    → Settings panel → Retry Delay = 5s (gives more time between attempts)

  □ Re-scan offline devices after fixing network:
    → Select all Offline devices
    → Use VALIDATE_DEVICES (Validate Selected) to re-run just those devices
    → Or use RESCAN_ALL_DEVICES_PROMPT to reset and re-scan everything

  □ Check actual network conditions (production):
    → Ping devices from the management server
    → Check firewall rules for WinRM/port 5985 (production integration)
    → Verify devices are on the correct VLAN
```

---

## 7. Scan — Scan Runs But Finishes Instantly With No Results

**Symptom:** Scan appears to start and finish in under a second, devices stay on their initial
status.

**What the code does:**
`runDeploymentFlow` is called with the devices array. If the array is empty or all devices are
in a terminal status (the loop skips them), it returns immediately. Also, if `isCancelled()`
returns `true` at the start of the loop, the loop breaks immediately.

**Code location:** `services/deploymentService.ts:runDeploymentFlow` lines 77–87

**Diagnose:**

```
  □ Is runner.devices empty?
    → Log panel should show "Deployment process initiated" + device count
    → If no count shown: no devices were loaded

  □ Were devices previously cancelled?
    → Cancelled devices are kept in the list but the scan loop skips them
    → Solution: Use Bulk Remove to remove cancelled devices, then reload

  □ Is isCancelled still true from a previous run?
    → Check state.runner.isCancelled in React DevTools
    → This should reset to false when INITIALIZE_DEPLOYMENT dispatches
    → If stuck true: reload the page (loses state) or dispatch CANCEL_DEPLOYMENT to reset

  □ Are all devices already in a terminal status (Success, Offline, etc.)?
    → The loop still processes them but immediately calls validateDevice
    → Terminal devices should cycle through scan states again
    → If not: check effectRunner INITIALIZE_DEPLOYMENT case for errors
```

---

## 8. Scan — Devices Stay on "Connecting" Forever

**Symptom:** Scan starts, devices show "Connecting" status, but never progress.

**What the code does:**
Inside `validateDevice`, the connection attempt has a `sleep(1000 + random*500)` delay per
attempt. With `maxRetries = 3` and `retryDelay = 2s`, the maximum blocking time for one device
is approximately `3 × (1.5s sleep + 2s delay) = ~10.5s`. If all devices are stalling, the
sequential loop is working through them one by one.

**Code location:** `services/deploymentService.ts:validateDevice` lines 107–114

**Diagnose:**

```
  □ Is it just slow? (not frozen)
    → With 20 devices, scan can take 1–4 minutes
    → Watch the log panel for per-device progress messages

  □ Has the browser tab frozen?
    → Open Task Manager / Activity Monitor → check browser CPU usage
    → If frozen: reduce cohort size; large sequential async loops can appear to freeze React

  □ Is one device causing a bottleneck?
    → The sequential loop means one slow device blocks all others
    → Cancel the scan → remove the slow device → restart

  □ Check browser console for unhandled promise rejections
    → effectRunner catches errors in try/catch, but internal errors in mock functions
      might cause unexpected hangs
```

---

## 9. Update — Bulk Update Fails on Multiple Devices

**Symptom:** After Bulk Update, several devices show `Failed` with update errors.

**What the code does:**
`updateDevice` has a ~15% failure rate per update component (`Math.random() > 0.15` for success).
On failure, it immediately breaks out of the component loop — so if BIOS fails, DCU and Windows
are not attempted. The `lastUpdateResult` field records `{ succeeded: string[], failed: string[] }`.

**Code location:** `services/deploymentService.ts:updateDevice` lines 185–202

**Expected failure rate:**
With 3 components (BIOS + DCU + Windows), probability of zero failures = `0.85³ = 61%`.
Probability of at least one failure = 39%. For 20 devices, expect roughly 7–8 with failures.
This is intentional simulation of real-world update failure rates.

**What to try:**

```
  □ Re-run Bulk Update on failed devices
    → Select only 'Failed' devices
    → Click Bulk Update again
    → Each attempt is independent — some will succeed on retry

  □ Update devices individually for better isolation
    → Per-device Update button shows clearer log output
    → Helps identify if one device has a systemic issue

  □ Check lastUpdateResult in React DevTools
    → state.runner.devices[n].lastUpdateResult.failed shows which component failed

  □ In production: a real failed BIOS update should be investigated before retrying
    → Check WDS/MDT logs, device BIOS event logs
    → A ~15% rate in mock = normal simulation; in production, repeated BIOS failures
      on the same device usually indicate a hardware or media issue
```

---

## 10. Update — Device Stuck on "Update Complete (Reboot Pending)"

**Symptom:** Device updated successfully but stays on `Update Complete (Reboot Pending)`
indefinitely.

**What the code does:**
BIOS updates always set `requiresReboot = true`. If `settings.autoRebootEnabled = false` (default),
the device stays at `Update Complete (Reboot Pending)` until a manual reboot action is triggered.
The `REBOOT_DEVICE` effectRunner case calls `rebootDevice()` (an 8–12s sleep) then sets `Success`.

**Code location:** `services/deploymentService.ts:updateDevice` line 214; `contexts/AppContext.tsx:REBOOT_DEVICE` case

**Resolution:**

```
  Option A — Manual reboot (recommended):
    → Find the device in the runner list
    → Click the Reboot button on the device row
    → Status: Rebooting... → (8–12s) → Success

  Option B — Enable Auto Reboot before next update run:
    → Settings panel → Auto Reboot → ON
    → Devices with reboot-pending updates will reboot automatically
    → Only enable this if you're confident devices can reboot safely (no unsaved work)

  Option C — Bulk reboot (if many devices pending):
    → There is no dedicated Bulk Reboot action in the current version
    → Select devices → BULK_UPDATE (it will detect they already have updates applied
      and skip to reboot if auto-reboot is ON)
    → Or: manually reboot each device in sequence
```

---

## 11. Script — Execution Always Fails

**Symptom:** Every script execution returns "Execution Failed".

**What the code does:**
`executeScript()` returns `Math.random() > 0.2` — an 80% success rate. If you're seeing 100%
failures, it's statistically very unlikely (probability of 10 consecutive failures: `0.2¹⁰ = 0.0001%`).
More likely cause: device doesn't have a `scriptFile` attached, or the device is not in
`'Ready for Execution'` status.

**Code location:** `services/deploymentService.ts:executeScript` lines 223–225;
`contexts/AppContext.tsx:EXECUTE_SCRIPT` case line 325

**Diagnose:**

```
  □ Is the device in 'Ready for Execution' status?
    → Status must be exactly 'Ready for Execution' for BULK_EXECUTE to include the device
    → Use SET_SCRIPT_FILE action (script file picker on the device row) to set a script
    → This changes status to 'Ready for Execution' automatically

  □ Does the device have a scriptFile attached?
    → Check React DevTools: state.runner.devices[n].scriptFile
    → If undefined: the file picker was not used for this device

  □ Is executeScript receiving the device correctly?
    → EXECUTE_SCRIPT action: effectRunner finds device by action.payload (id)
    → If device not found: nothing executes; check device IDs

  □ Are you seeing failures in the 80/20 distribution?
    → This is normal mock behavior
    → Re-execute failed devices; most will succeed on retry
```

---

## 12. File Operations — "File Not Found" on Run/Install

**Symptom:** Run or Install operation returns `'File Not Found'` reason.

**What the code does:**
`performDeploymentOperation` checks if `targetFile.name` is in `device.availableFiles` before
running or installing. Devices loaded from CSV get: `['install_printer.exe', 'map_network_drive.bat', 'troubleshoot.ps1']`. Devices transferred from Image Monitor get: `['CorpInstaller.msi', 'Onboarding.ps1', 'LegacyAgent.exe']`. If the file you're operating on isn't in that list, it fails.

**Code location:** `services/deploymentService.ts:performDeploymentOperation` lines 250–263

**Diagnose:**

```
  □ What is the exact filename you selected?
    → The check is case-sensitive: device.availableFiles.has(targetFile.name)
    → The file name from the browser file picker must EXACTLY match one of the
      pre-staged available files

  □ Check the device's availableFiles in React DevTools:
    → state.runner.devices[n].availableFiles
    → Only these file names will succeed

  □ In production:
    → Replace the hardcoded availableFiles arrays with a real file discovery step
    → Or populate availableFiles based on what's on the deployment share
```

---

## 13. File Operations — "File In Use" on Delete

**Symptom:** Delete operation returns `'File In Use'` reason.

**What the code does:**
If `targetFile.name` is in `device.runningPrograms`, delete is blocked. The `'run'` operation
adds to `runningPrograms`. Until the program is stopped (no "stop program" action exists in
current version), the file can't be deleted.

**Code location:** `services/deploymentService.ts:performDeploymentOperation` lines 266–272

**Resolution:**

```
  □ There is no "stop program" action in the current version
  □ Workaround: Reboot the device (REBOOT_DEVICE) — this clears runningPrograms
    (runningPrograms is not persisted across device state resets)
  □ Or: Archive the run and reload — running programs won't carry over

  In production:
  → Add a 'stop' operation type to DeploymentOperationType
  → Implement in performDeploymentOperation to remove from runningPrograms[]
```

---

## 14. RDP — Remote Desktop File Won't Download or Connect

**Symptom:** Clicking Remote-In (or Remote-In with Credentials) doesn't download a file, or
the downloaded `.rdp` file fails to connect.

**What the code does:**
`buildRemoteDesktopFile` constructs an RDP file string. The download uses `URL.createObjectURL`
with a `Blob` + an `<a>` element click. Some browsers block programmatic clicks or blob downloads.

**Code location:** `services/deploymentService.ts:buildRemoteDesktopFile`; `contexts/AppContext.tsx:REMOTE_IN_DEVICE` case

**Diagnose:**

```
  □ File doesn't download:
    → Some browsers (Safari) block programmatic anchor clicks
    → Try a different browser (Chrome, Edge)
    → Check browser download settings for popup/download blocking

  □ File downloads but RDP won't connect:
    → Open the downloaded .rdp file in a text editor
    → Verify 'full address' line shows the correct hostname/IP
    → The app uses device.ipAddress first, then falls back to device.hostname
    → If device has no ipAddress (mock default), hostname is used
    → Ensure the hostname is resolvable from your client machine

  □ RDP connection refused:
    → Verify Remote Desktop is enabled on the target device
    → Verify port 3389 is open through firewalls
    → Verify the target device IP matches the device you intend to connect to

  □ Credential prompt appears even though you used Remote-In with Credentials:
    → The RDP file contains 'prompt for credentials:i:1' (hardcoded)
    → The username pre-fill may not suppress the prompt depending on RDP client config
    → In production: change to 'prompt for credentials:i:0' in buildRemoteDesktopFile
```

---

## 15. History — Run Archive Shows Wrong Counts

**Symptom:** The Deployment History panel shows different counts than you expect (e.g.,
"failed" higher than expected, "compliant" lower).

**What the code does:**
`generateRunArchive` counts devices by their **current status at archive time**, not by what
they were during the run. The mapping is:

```
compliant   = ['Success', 'Execution Complete']
needsAction = ['Scan Complete', 'Update Complete (Reboot Pending)', 'Ready for Execution', 'Pending File']
failed (combined field) = Offline + Cancelled + Failed + Execution Failed
```

**Code location:** `services/deploymentService.ts:generateRunArchive` lines 274–290

**Common confusion:**

```
  □ "I updated devices but they still show in needsAction"
    → Devices in 'Update Complete (Reboot Pending)' count as needsAction, not compliant
    → Reboot the devices first → status becomes 'Success' → then archive

  □ "Offline devices are showing in 'failed' but I wanted them separate"
    → In the current data model, the top-level 'failed' field combines offline +
      cancelled + actual-failed
    → failureCounts.offline shows the isolated offline count
    → failureCounts.cancelled shows isolated cancelled count

  □ "Archive shows 0 devices"
    → ARCHIVE_RUN returns early if runner.devices.length === 0
    → Ensure you archive before removing all devices from the queue

  □ "I can only see the last run"
    → History is capped at 10 runs (slice(0, 10) in ARCHIVE_RUN reducer)
    → Export runs to CSV before they scroll off: DeploymentHistory → Export button
```

---

## 16. CSV — No Devices Loaded After CSV Import

**Symptom:** You select a CSV file, start scan, enter credentials, but no devices appear
and no scan runs.

**What the code does:**
`START_DEPLOYMENT_CONFIRMED` (effectRunner) calls `Papa.parse(csvFile)` → passes results to
`parseDevicesFromCsv()`. If ALL rows fail validation, `devices.length === 0`, so
`INITIALIZE_DEPLOYMENT` is never dispatched and no scan runs. The log panel should show
the validation errors.

**Code location:** `contexts/AppContext.tsx:234-250`; `services/deploymentService.ts:parseDevicesFromCsv`

**Diagnose:**

```
  □ Check the log panel immediately after confirming credentials
    → Look for "[Validation Skip]" messages — these explain why rows were rejected

  □ Common CSV errors and fixes:
    ─────────────────────────────────────────────────────────────────────
    Error: "CSV must contain 'Hostname' and 'MAC' columns"
    Fix: Check your header row. Headers must contain 'hostname' and 'mac'
         as substrings (case-insensitive). Example valid headers:
         "Hostname", "hostname", "Device Hostname", "MAC Address", "mac"

    Error: "MAC address is missing or empty"
    Fix: Every row needs a MAC value. Remove rows without MACs or add them.

    Error: "Contains invalid characters"
    Fix: MAC must only contain hex digits (0-9, A-F, a-f) and separators : - .
         Example valid: 00:1A:2B:3C:4D:5E  or  00-1A-2B-3C-4D-5E

    Error: "Incorrect length"
    Fix: After stripping separators, MAC must be exactly 12 hex characters.
         00:1A:2B:3C:4D:5E → 001A2B3C4D5E (12 chars) = valid
         001A2B3C4D5 (11 chars) = invalid — a digit is missing

    Error: "Missing hostname"
    Fix: Row has empty hostname column. Remove or fill in the row.
    ─────────────────────────────────────────────────────────────────────

  □ Minimal valid CSV example:
    Hostname,MAC
    HQ-LT-001,00:1A:2B:3C:4D:5E
    HQ-SFF-002,AA-BB-CC-DD-EE-FF
```

---

## 17. CSV — Devices Missing From List After Import

**Symptom:** CSV has 50 rows but only 40 devices appear.

**What the code does:**
Validation errors are collected in `errors[]` but the valid rows in `devices[]` are still
returned and loaded. Skipped rows are logged individually.

**Code location:** `services/deploymentService.ts:parseDevicesFromCsv`

**Resolution:**

```
  □ Check the log panel for "[Validation Skip]" messages
    → Each skipped row is logged with the device hostname (if available) and reason
    → Fix the identified rows in your CSV and re-import

  □ Are there duplicate MACs?
    → The current parser does NOT deduplicate — two rows with the same MAC
      both load as separate devices
    → In production: add deduplication logic in parseDevicesFromCsv

  □ Are there blank rows in the CSV?
    → papaparse is configured with skipEmptyLines: true
    → Truly blank rows are ignored; rows with partial data may fail validation
```

---

## 18. State — App State Lost After Browser Refresh

**Symptom:** Refreshing the browser tab clears all devices, logs, and history.

**What the code does:**
All application state lives in React `useReducer` in memory. The `useLocalStorage` hook exists
in `hooks/useLocalStorage.ts` but its current scope in the app should be verified against your
build. If it's not wired to the runner/monitor state, a page refresh resets everything.

**Code location:** `hooks/useLocalStorage.ts`; `contexts/AppContext.tsx`

**Immediate mitigation:**

```
  □ Export run history to CSV before closing/refreshing:
    → Deployment Runner → Deployment History section → Export button
    → Save the file; it contains all current run data

  □ Note down any outstanding device statuses before refreshing

  □ Do not refresh during an active scan — the scan will be lost and
    devices may be in mid-operation states that won't be recovered
```

**Long-term fix:**

```
  □ Wire useLocalStorage to state.runner.history for run persistence
  □ Consider adding a session recovery mechanism (serialize runner.devices
    to localStorage on each update; restore on mount)
  □ Or implement a backend API that persists state server-side
```

---

## 19. Performance — UI Sluggish With Large Device List

**Symptom:** With 50+ devices in the runner list, the UI feels slow to respond, status
updates lag, and scrolling is choppy.

**What the code does:**
`DeviceStatusTable` renders one table row per device with compliance checklists, metadata
fields, and status badges. React re-renders all rows on each state update (every device
status change dispatches `UPDATE_DEVICE_STATE` which triggers a full `devices.map()`).

**Code location:** `components/DeviceStatusTable.tsx`

**Immediate mitigations:**

```
  □ Use smaller waves: process 20–25 devices at a time; remove finished devices
    between waves to keep the list size manageable

  □ Close the Deployment Analytics / History panel if open
    → Recharts charts are expensive to re-render; keeping them closed helps

  □ Use a higher-end browser: Chrome typically handles large React lists better
    than Firefox or Safari

  □ Collapse device rows: keep most rows collapsed (non-expanded) during scan
    → Expanded rows with full compliance checklists are more expensive to render
```

**Long-term fix:**

```
  □ Implement React.memo on DeviceRow component to skip re-render
    when that device's status hasn't changed

  □ Add virtual scrolling (react-window or react-virtualized) to DeviceStatusTable
    → Only renders visible rows; 500 devices perform like 20

  □ Batch status dispatches: instead of UPDATE_DEVICE_STATE per device,
    batch multiple device updates into a single SET_DEVICES dispatch
```

---

## 20. General — Unexpected Behavior After Cancel

**Symptom:** After clicking Cancel, some devices are in unexpected states; restarting
a scan behaves oddly.

**What the code does:**
`CANCEL_DEPLOYMENT` (reducer) sets `isCancelled: true` and maps any device in a "cancellable"
status to `'Cancelled'`. However, async service calls that are already mid-flight (inside
`await sleep()`) will complete before checking `isCancelled()`. There can be a brief delay
where some devices update to a terminal status after cancel is clicked.

**Code location:** `contexts/AppContext.tsx:87-97` (CANCEL_DEPLOYMENT reducer case)

**Cancellable statuses (mapped to 'Cancelled'):**
`Connecting`, `Retrying...`, `Updating`, `Waking Up`, `Checking Info`, `Checking BIOS`,
`Checking DCU`, `Checking Windows`, `Updating BIOS`, `Updating DCU`, `Updating Windows`,
`Rebooting...`, `Executing Script`

**Resolution:**

```
  □ After cancel, wait 2–3 seconds for in-flight operations to complete
    → Devices in mid-sleep() calls will resolve and then see isCancelled=true

  □ Devices that finished between cancel click and isCancelled check
    may show Success/Offline instead of Cancelled — this is expected

  □ Before restarting a scan after cancel:
    → Use BULK_REMOVE to remove Cancelled devices (they won't scan again usefully)
    → Or use RESCAN_ALL_DEVICES (resets all devices to 'Pending Validation' and clears
      isCancelled via RESCAN_ALL_DEVICES_CONFIRMED reducer case)

  □ Check: is isCancelled still true?
    → React DevTools → AppContext state → runner.isCancelled
    → It should reset to false when INITIALIZE_DEPLOYMENT or RESCAN_ALL_DEVICES_CONFIRMED
      dispatches
    → If stuck true and you can't start a new scan: refresh the page (last resort)
```

---

## Quick Reference: Status-to-Action Matrix

```
┌─────────────────────────────────────┬─────────────────────────────────────────────┐
│ Device Status                       │ Recommended Action                          │
├─────────────────────────────────────┼─────────────────────────────────────────────┤
│ Pending / Pending File              │ Start Scan (no action needed first)         │
│ Pending Validation                  │ Waiting for re-scan to start                │
│ Connecting / Retrying...            │ Wait; scan in progress                      │
│ Waking Up                           │ Wait; WoL sent (manual action)              │
│ Checking Info/BIOS/DCU/Windows      │ Wait; scan in progress                      │
│ Success                             │ Done — can Remove                           │
│ Scan Complete                       │ Run Update or investigate compliance        │
│ Offline                             │ Check power/network; increase retries       │
│ Failed                              │ Check logs; retry Update individually       │
│ Cancelled                           │ Remove or Rescan All                        │
│ Updating / Updating BIOS/DCU/Win    │ Wait; update in progress                   │
│ Update Complete (Reboot Pending)    │ Click Reboot or enable Auto Reboot          │
│ Rebooting...                        │ Wait; reboot in progress                    │
│ Pending File                        │ Attach script file (if using scripts)       │
│ Ready for Execution                 │ Click Execute (or Bulk Execute)             │
│ Executing Script                    │ Wait; script running                        │
│ Execution Complete                  │ Done — can Remove                           │
│ Execution Failed                    │ Re-execute or investigate script            │
│ Deploying Action                    │ Wait; file operation in progress            │
│ Action Complete                     │ File operation succeeded — can Remove       │
│ Action Failed                       │ Check reason in logs; retry or escalate     │
└─────────────────────────────────────┴─────────────────────────────────────────────┘
```
