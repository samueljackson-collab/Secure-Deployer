# Operations

This page is the operational reference for hospital IT staff running the **Secure Deployment Runner**. It covers day-to-day procedures, monitoring, maintenance, incident response, and operational security. Keep this document accessible on the USB drive alongside the portable executable.

---

## 1. Day-to-Day Runbook

### 1.1 Starting a New Deployment Session

1. Insert the USB drive containing the portable executable into a workstation on the hospital deployment VLAN.
2. Launch `Secure-Deployment-Runner-Portable-<version>.exe` from the USB drive. No installation is required.
3. The application opens to the **Image Monitor** view by default. Use the tab bar at the top to switch between **Image Monitor** and **Secure Deployment Runner**.
4. Verify the **Session Active** indicator is not yet visible -- credentials have not been entered and no session is running.

### 1.2 Loading Devices from CSV

1. In the **Secure Deployment Runner** view, locate **Step 1 -- Select Device List** in the Configuration panel.
2. Click the file input and select a `.csv` file. The CSV must contain at minimum two columns:
   - A hostname column (detected by header names containing `hostname`, `computername`, `devicename`, `computer`, `name`, or `device`).
   - A MAC address column (detected by header names containing `macaddress` or `mac`).
3. The parser validates every row on load:
   - Rows with empty hostnames are skipped with a WARNING log.
   - Rows with invalid MAC address formats (must be 12 hex characters after normalization) are skipped with a WARNING log.
   - A summary log reports how many entries were skipped.
4. Valid devices appear in the **Device Status Table** with status `Pending` once the scan begins.

**Tip:** Device form factors (laptop-14, laptop-16, detachable, sff, micro, tower, wyse, vdi, desktop) are auto-detected from hostname naming conventions. For example, hostnames containing `ELSLE` or `LAT14` are classified as `laptop-14`, and hostnames containing `WYSE` are classified as `wyse`.

### 1.3 Running the Imaging Workflow (Image Monitor -> Promote -> Deploy)

This is the full lifecycle for freshly imaged devices.

1. **Load imaging metadata into Image Monitor:**
   - Switch to the **Image Monitor** tab.
   - Drag and drop one or more `.json` metadata files onto the drop zone (or click to browse). These files are produced by your SCCM/MDT task sequence and should contain at minimum `hostname` and `macAddress` fields.
   - The monitor validates each JSON file. Invalid files or entries appear in the red **Validation Issues** panel.
   - Successfully loaded devices appear in the device list with their imaging status and progress bar.

2. **Wait for imaging to complete:**
   - Monitor the per-device progress bars and the summary stats panel (Total, In Progress, Complete, Ready, Failed).
   - Devices reaching 100% progress automatically transition to **Ready for Deployment** status.

3. **Promote devices to the Deployment Runner:**
   - Select individual devices by checkbox, or click **Select All Ready** to select every device with `Ready for Deployment` status.
   - Click **Promote to Deployment**. Only devices with `Ready for Deployment` status are eligible.
   - The app automatically switches to the **Secure Deployment Runner** tab. Promoted devices appear in the device list with status `Pending`.

4. **Run the deployment scan and update cycle** (see Section 1.4 below).

### 1.4 Executing a Full Scan-and-Update Cycle

1. Ensure a CSV device list (Step 1) and a deployment batch script (Step 2) are both selected in the Configuration panel. The **Start System Scan** button enables only when both files are loaded.
2. Click **Start System Scan**.
3. The **Secure Session Authentication** modal appears. Enter your single-use administrative credentials (username and password). These credentials are held in memory only for the duration of the session and are never written to disk.
4. Click **Confirm & Deploy**. The system performs the following automatically:
   - **Script safety analysis:** The batch file is analyzed by the deterministic (AI-free) script safety analyzer. If any BLOCKED-severity patterns are detected, deployment halts and the Script Analysis Modal opens. You must fix the script before proceeding.
   - **CSV parsing and validation:** The device list is parsed. Devices are loaded into the table with status `Pending`.
   - **Wake-on-LAN:** All devices transition to `Waking Up`. WoL magic packets are sent. The system waits 30 seconds for devices to boot.
   - **Per-device scan:** Each device is scanned sequentially:
     - `Connecting` -- attempting connection (up to Max Retries, with the configured Retry Delay).
     - `Retrying...` -- connection failed, retrying (shows attempt count).
     - `Checking Info` -- gathering metadata (IP, serial number, model, RAM, disk, encryption).
     - `Checking BIOS` -- querying BIOS version against target (`A25`).
     - `Checking DCU` -- querying Dell Command Update version against target (`5.2.0`).
     - `Checking Windows` -- querying Windows version against target (`23H2`).
     - `Scan Complete` -- scan finished; device needs updates.
     - `Success` -- all components already at target versions.
     - `Offline` -- device did not respond after all retry attempts.
5. When the scan completes, the Deployment Progress bar shows 100% and a desktop notification is sent.
6. Review the Device Status Table. For each device showing `Scan Complete`:
   - Click **Run Updates** on the individual device card, OR
   - Select multiple devices via checkboxes and click **Update Selected** in the Bulk Actions bar (this triggers the Device Scope Guard -- see Section 1.7).
7. Updates proceed component by component: `Updating BIOS` -> `Updating DCU` -> `Updating Windows`. If a component update fails, the sequence stops and the device is marked `Failed`.
8. After updates complete:
   - If a reboot is required (BIOS updates always require one): device shows `Update Complete (Reboot Pending)`. Click **Reboot Device** or enable **Auto Reboot** in Advanced Settings.
   - If no reboot is required: device transitions directly to `Success`.

### 1.5 Handling Failed Devices

| Device Status | Meaning | Action |
|---|---|---|
| `Offline` | Device did not respond to WoL or connection attempts after all retries. | Verify the device is powered on and connected to the network. Check the MAC address in the CSV. Re-run the scan or use Wake-on-LAN from the header. |
| `Failed` | One or more component updates failed during execution. | Check the Live Log for the specific component that failed (BIOS, DCU, or Windows). The device card shows which components succeeded and which failed. Fix the underlying issue, then click **Run Updates** again. |
| `Cancelled` | The operator cancelled the scan or update while this device was in progress. | Re-run the scan or manually trigger updates on the device. |

**Reviewing failure details:** Each failed device card displays an **Update Result** section listing components that succeeded (with checkmark) and components that failed (with X). Use the Live Log (filter to ERROR) for detailed error messages.

### 1.6 Re-Running Updates on Specific Devices

1. In the Device Status Table, locate the device you want to re-update.
2. If the device status is `Scan Complete` or `Failed`, the **Run Updates** button is available on the device card. Click it.
3. For bulk re-runs, select the target devices by checkbox and click **Update Selected** in the Bulk Actions bar.
4. The Device Scope Guard will require you to verify each device individually before the operation proceeds (see below).

### 1.7 Device Scope Guard Verification

The Device Scope Guard is a mandatory safety gate that appears before any bulk update operation. It prevents accidental operations on unintended devices.

1. When you click **Update Selected**, the Scope Guard modal opens.
2. You must:
   - **Check every device individually** in the device checklist (each device has its own checkbox).
   - **Type the exact number** of devices to confirm the count.
   - Review and configure the **Safety Policy** toggles:
     - Block broadcast/subnet-wide commands (default: ON)
     - Block critical service modifications (default: ON)
     - Block registry writes to HKLM\SYSTEM (default: ON)
     - Enforce hostname whitelist (default: ON)
   - Set the **Max device count** (default: 50, hard maximum: 200).
3. All checks must pass (green "All checks passed" indicator) before the **Confirm Scope & Deploy** button enables.
4. Click **Confirm Scope & Deploy** to proceed. The scope policy is enforced for the remainder of the operation.

### 1.8 Ending a Session Securely

1. After all devices are processed, review the **Deployment History** panel in the left sidebar. It shows the results of the most recent run (total devices, compliant, needs action, failed, success rate).
2. Close the application. All state is in memory only; closing the app wipes everything:
   - Credentials are cleared.
   - Device lists are cleared.
   - Logs are cleared.
   - No files are written to the USB drive or local disk.
3. If you walk away without closing, the **30-minute session timeout** automatically wipes credentials after 30 minutes of inactivity (no mouse movement or keyboard input).
4. Safely eject the USB drive.

---

## 2. Monitoring

### 2.1 Log Viewer

The **Live Log** panel displays real-time operational messages. Each log entry consists of:
- **Timestamp** -- displayed as local time (HH:MM:SS).
- **Level** -- one of four severity levels, each color-coded.
- **Message** -- the operational detail, with sensitive content automatically redacted.

| Level | Color | Border | Meaning |
|---|---|---|---|
| `INFO` | Slate/gray (`text-slate-400`) | Slate border | Normal operational messages: scan progress, metadata collection, version checks. |
| `SUCCESS` | Green (`text-green-400`) | Green border | Successful completions: device scans, component updates, script analysis pass. |
| `WARNING` | Yellow (`text-yellow-400`) | Yellow border | Non-critical issues: CSV validation skips, connection retries, scope warnings, cancelled operations. |
| `ERROR` | Red (`text-red-400`) | Red border | Critical failures: CSV parsing errors, blocked scripts, device offline, update failures, missing files. |

**Filtering:** Toggle each log level on/off using the colored buttons in the log header. Dimmed buttons indicate hidden levels. All four levels are enabled by default.

**Auto-scroll:** The log panel automatically scrolls to the bottom as new entries arrive.

**Log sanitization:** All log messages pass through the sanitization filter before display. The following patterns are automatically redacted:
- `password: <value>` or `password=<value>` becomes `password: [REDACTED]`
- `token: <value>` or `token=<value>` becomes `token: [REDACTED]`
- `secret: <value>` or `secret=<value>` becomes `secret: [REDACTED]`

### 2.2 Device Status Table

The Device Status Table is the primary device monitoring interface. Each device card shows:

- **Hostname** with device form factor icon (laptop, desktop, thin client, etc.)
- **Status badge** (see Section 2.3)
- **Version Info** (after scan): BIOS version, DCU version, Windows version
- **System Details** (after scan): IP address, model, serial number, RAM, disk usage, encryption status
- **Update Result** (after update attempt): lists of succeeded and failed component updates
- **Action buttons**: "Run Updates" (when scan complete) or "Reboot Device" (when reboot pending)
- **Selection checkbox** for bulk operations

**Select All:** Use the checkbox in the table header to select/deselect all devices at once.

### 2.3 Deployment Status Badges

There are 19 possible deployment statuses. Each is rendered as a colored badge with an optional animation.

| Status | Color | Animation | Phase | Description |
|---|---|---|---|---|
| `Pending` | Slate/gray | None | Pre-scan | Device loaded from CSV, waiting for scan to begin. |
| `Waking Up` | Yellow | Pulse | WoL | Wake-on-LAN packet sent; waiting for device to boot. |
| `Connecting` | Cyan | Pulse | Connection | Attempting initial network connection to the device. |
| `Retrying...` | Cyan | Pulse | Connection | Connection failed; retrying (shows attempt number, e.g., "Retrying... (2)"). |
| `Checking Info` | Sky blue | Pulse | Scan | Gathering device metadata (IP, serial, model, RAM, disk, encryption). |
| `Checking BIOS` | Sky blue | Pulse | Scan | Querying current BIOS version and comparing against target. |
| `Checking DCU` | Sky blue | Pulse | Scan | Querying Dell Command Update version and comparing against target. |
| `Checking Windows` | Sky blue | Pulse | Scan | Querying Windows version and comparing against target. |
| `Scan Complete` | Yellow | None | Post-scan | Scan finished. One or more components need updating. Action required. |
| `Updating` | Blue | Pulse | Update | Update process starting (transitional, before specific component). |
| `Updating BIOS` | Blue | Pulse | Update | BIOS firmware update in progress. |
| `Updating DCU` | Blue | Pulse | Update | Dell Command Update software update in progress. |
| `Updating Windows` | Blue | Pulse | Update | Windows feature update in progress. |
| `Update Complete (Reboot Pending)` | Purple | None | Post-update | All updates succeeded but the device needs a reboot (typically after BIOS update). |
| `Rebooting...` | Teal | Pulse | Reboot | Device is rebooting to apply updates. |
| `Success` | Green | None | Complete | Device is fully compliant. All components at target versions. |
| `Failed` | Red | None | Terminal | One or more component updates failed. Review logs for details. |
| `Offline` | Orange | None | Terminal | Device did not respond after all connection retry attempts. |
| `Cancelled` | Gray | None | Terminal | Operation was cancelled by the operator. |

### 2.4 Deployment Progress Tracking

The **Deployment Progress** section at the top of the Deployment Status panel provides an at-a-glance summary during bulk operations:

- **Scan Progress bar:** Percentage of devices that have reached a terminal or actionable state (Success + Scan Complete + Update Complete + Failed + Offline + Cancelled) out of total devices.
- **Total:** Total number of devices in the current run.
- **Compliant:** Devices that reached `Success` status.
- **Needs Action:** Devices at `Scan Complete` or `Update Complete (Reboot Pending)`.
- **Failed/Offline:** Devices at `Failed`, `Offline`, or `Cancelled`.

### 2.5 Image Monitor Status Meanings

Devices in the Image Monitor have a separate set of imaging-specific statuses:

| Imaging Status | Color | Animation | Description |
|---|---|---|---|
| `Not Started` | Slate/gray | None | Metadata loaded but no imaging activity detected (progress 0%, no serial/MAC). |
| `Collecting Metadata` | Yellow | Pulse | Task sequence has started. Serial number and MAC collected, but imaging not yet underway (progress 0%). |
| `Imaging In Progress` | Sky blue | Pulse | OS imaging is actively running. Progress bar shows percentage (1-99%). |
| `Imaging Complete` | Green | None | Imaging finished (progress reached 100%), but device has not been explicitly marked ready. |
| `Imaging Failed` | Red | None | Imaging process encountered an error. |
| `Ready for Deployment` | Cyan | None | Imaging completed successfully. Device is eligible to be promoted to the Deployment Runner. |

The Image Monitor also provides summary stats: **Total**, **In Progress**, **Complete**, **Ready**, and **Failed** counts.

---

## 3. Maintenance

### 3.1 No Database to Maintain

The Secure Deployment Runner is entirely **stateless**. All data exists only in React component state (in-memory) while the application is running:
- Device lists, scan results, update results, and deployment history are never written to disk.
- Closing the application or navigating away discards all state.
- There is no SQLite database, no localStorage usage, and no file-system writes.

**Implication:** There is nothing to back up, no database migrations to run, and no data corruption to worry about. Each session starts completely clean.

### 3.2 No Logs Persisted to Disk

Logs shown in the Live Log panel exist only in memory for the duration of the session. They are not written to any file. If you need a record of a deployment session, take screenshots of the log viewer and the deployment history panel before closing the application.

### 3.3 Updating Compliance Target Versions

When Dell releases new BIOS firmware, a new version of DCU, or Microsoft releases a new Windows feature update, you must update the target version constants in the source code.

**File:** `/App.tsx` (lines 107-109)

```typescript
const TARGET_BIOS_VERSION = 'A25';
const TARGET_DCU_VERSION = '5.2.0';
const TARGET_WIN_VERSION = '23H2';
```

**Procedure:**

1. Open `App.tsx` in a text editor.
2. Change the value of the appropriate constant:
   - `TARGET_BIOS_VERSION` -- the BIOS revision string (e.g., `'A26'`).
   - `TARGET_DCU_VERSION` -- the DCU version string (e.g., `'5.3.0'`).
   - `TARGET_WIN_VERSION` -- the Windows feature update ID (e.g., `'24H2'`).
3. Save the file.
4. Rebuild the portable executable (see Section 3.5).

### 3.4 Updating Script Safety Patterns

The script safety analyzer in `services/scriptSafetyAnalyzer.ts` uses three tiers of pattern arrays:

| Array | Severity | Effect |
|---|---|---|
| `BLOCKED_PATTERNS` | BLOCKED / CRITICAL | Script is **rejected**. Deployment cannot proceed. |
| `DANGER_PATTERNS` | DANGER / HIGH | Script is allowed but flagged for manual review. |
| `WARNING_PATTERNS` | WARNING / MEDIUM | Informational warning shown to the operator. |

**To add a new safety pattern:**

1. Open `services/scriptSafetyAnalyzer.ts`.
2. Locate the appropriate pattern array (`BLOCKED_PATTERNS`, `DANGER_PATTERNS`, or `WARNING_PATTERNS`).
3. Add a new object to the array following this structure:

```typescript
{
  regex: /your-regex-here/i,
  severity: 'BLOCKED',  // or 'DANGER' or 'WARNING'
  description: 'Human-readable explanation of what this pattern does.',
  recommendation: 'What the operator should do instead.',
},
```

4. Save the file and rebuild the portable executable.

**Important:** The analyzer is **deterministic and AI-free**. It uses only regex pattern matching. False negatives are considered worse than false positives on a hospital network, so err on the side of broader patterns.

### 3.5 Rebuilding the Portable Executable

After making any source code changes:

```bash
npm run build:portable
```

This runs `vite build` followed by `electron-builder --win portable --publish never`. The output is written to the `release/` directory as `Secure-Deployment-Runner-Portable-<version>.exe`.

Copy the new portable executable to the USB drive, replacing the previous version.

For a full installer (NSIS) build:

```bash
npm run build:app
```

---

## 4. Incident Response

### 4.1 Script Blocked by the Analyzer

**Symptom:** When you click "Start System Scan" or manually click "Analyze Safety," the Script Analysis Modal opens showing risk level **CRITICAL** and one or more entries in the **Blocked Patterns** section. The log shows `DEPLOYMENT BLOCKED: Script contains X dangerous pattern(s)`.

**Response:**

1. Read each blocked pattern entry. It shows the line number, the matched pattern, a description of the risk, and a recommendation.
2. Do **not** attempt to bypass the analyzer. It does not have an override mechanism by design.
3. Open the batch script in a text editor. Fix each flagged line according to the recommendation:
   - If a `shutdown` command lacks `/t timeout`, add one.
   - If a command uses wildcard targets (`\\*`, `-ComputerName *`), replace with explicit hostnames.
   - If a command disables the firewall, remove it and use specific firewall rules instead.
   - If `diskpart` or `bcdedit` commands are present, remove them from the deployment script entirely.
4. Save the corrected script.
5. Re-select the corrected script in Step 2 of the Configuration panel.
6. Optionally click "Analyze Safety" to verify the fix before starting the scan.
7. Retry the deployment.

### 4.2 Device Scope Guard Prevents Operation

**Symptom:** The Device Scope Guard modal opens when you attempt a bulk update. One or more of the readiness conditions is not met:
- Not all devices are individually checked.
- The typed device count does not match the selected count.
- The selected count exceeds the Max device count setting.

**Response:**

1. If you cannot check all devices: verify each device hostname and MAC address are correct. If a device should not be in the list, deselect it in the Device Status Table before retrying.
2. If the count does not match: type the exact number shown in the "You are about to execute operations on X devices" banner.
3. If the selected count exceeds the max: either reduce the selection or increase the Max device count in the Safety Policy Configuration section (hard maximum: 200).
4. If a device is blocked after scope verification due to hostname whitelist enforcement, the log shows `BLOCKED: <hostname> is not in the verified scope. Update denied.` -- This means the device was not in the scope policy's allowed hostnames list. Re-run the Scope Guard with the correct devices selected.

### 4.3 Credentials Expire Mid-Deployment

**Symptom:** Devices begin showing connection failures partway through a scan, or updates fail with authentication errors. The **Session Active** indicator is still green.

**Response:**

1. Click **Cancel Scan** to stop the current deployment. All in-progress devices transition to `Cancelled`.
2. Note which devices completed successfully and which are still `Pending` or `Cancelled`.
3. Obtain fresh credentials from your credential management system.
4. Click **Start System Scan** to begin a new session. The credential modal will open for new credentials.
5. The CSV file is re-parsed and all devices restart from `Pending`. Previously successful devices will be re-scanned and will show `Success` again quickly (their versions have not changed).

### 4.4 Devices Show as Offline

**Symptom:** One or more devices show `Offline` status (orange badge) after the scan. The log shows `Host <hostname> is not responding after X attempts.`

**Response -- check in order:**

1. **Physical connectivity:** Verify the device is powered on and the network cable is connected (or Wi-Fi is associated).
2. **Wake-on-LAN:** Select the offline device(s) by checkbox and click the **Wake-on-LAN** button in the header. Wait 2-3 minutes for the device to boot.
3. **MAC address:** Verify the MAC address in the CSV matches the actual device. A common cause of `Offline` is a stale or incorrect MAC address.
4. **Network VLAN:** Ensure the device is on the same VLAN as the deployment workstation, or that routing between VLANs is configured for WoL and management traffic.
5. **Firewall rules:** Ensure the device's Windows Firewall allows inbound WinRM and WMI traffic.
6. **Retry settings:** Consider increasing **Max Retries** (up to 10) and **Retry Delay** (up to 30 seconds) in Advanced Settings for unreliable network segments.

### 4.5 Application Crashes

**Symptom:** The Electron window closes unexpectedly, becomes unresponsive, or shows a white screen.

**Response:**

1. Relaunch the portable executable from the USB drive.
2. There is **no data loss** because nothing is persisted to disk. However, you will need to re-select the CSV file, batch script, and re-enter credentials.
3. Any devices that were mid-update when the crash occurred should be checked manually:
   - For BIOS updates: verify the BIOS version by checking the device's BIOS setup screen on next boot. If the update was interrupted, the device may need a manual BIOS recovery.
   - For DCU and Windows updates: these are typically transactional and will either complete or roll back on the device side.
4. Re-run the full scan. Devices that already received updates will show `Success` on re-scan since their versions now match the targets.

### 4.6 Recovery Procedures

Because the Secure Deployment Runner is entirely stateless (no database, no persisted logs, no saved credentials), recovery from any failure follows the same general pattern:

1. Close and relaunch the application.
2. Re-load the CSV device list and batch script.
3. Re-enter credentials.
4. Re-run the scan.

Devices that were already updated will scan as compliant. Devices that failed or were interrupted will be re-attempted. There is no need to restore from backups, repair a database, or recover corrupted state files.

---

## 5. Operational Security

### 5.1 Credential Handling Best Practices

- **Never reuse credentials** across deployment sessions. Use single-use or time-limited administrative credentials from your privileged access management (PAM) system.
- **Never share credentials** between operators. Each operator should authenticate with their own account.
- Credentials entered in the Secure Session Authentication modal are stored **only in React component state** (JavaScript heap memory). They are:
  - Never written to disk.
  - Never sent to any external service.
  - Never logged (the log sanitizer redacts any password/token/secret values).
  - Automatically wiped on session timeout or application close.
- The credential modal resets its internal state after every submission, so credentials do not persist in the modal's form fields.

### 5.2 Session Timeout Behavior

The application enforces a **30-minute inactivity timeout** (`SESSION_TIMEOUT_MS = 30 * 60 * 1000`).

**How it works:**

1. The timeout timer starts when credentials are submitted and the session becomes active.
2. Any mouse movement or keyboard input on the application window resets the 30-minute timer.
3. If 30 minutes pass without any user interaction:
   - Credentials are automatically cleared (set to empty strings).
   - The `sessionActive` flag is set to `false`.
   - The **Session Active** indicator disappears from the tab bar.
4. To continue working after a timeout, you must re-authenticate by starting a new scan.

**Important:** The timeout only wipes credentials. It does not close the application, clear the device list, or clear logs. An operator returning after a timeout will see the previous scan results but must re-authenticate to perform new operations.

### 5.3 Log Sanitization

All log messages pass through the `sanitizeLogMessage()` function before being displayed. The following patterns are matched (case-insensitive) and replaced:

| Pattern | Replacement |
|---|---|
| `password: <value>` or `password=<value>` | `password: [REDACTED]` |
| `token: <value>` or `token=<value>` | `token: [REDACTED]` |
| `secret: <value>` or `secret=<value>` | `secret: [REDACTED]` |

This ensures that even if an underlying operation produces a log line containing a credential, it is never displayed to the screen in cleartext. Since logs are only held in memory and are never written to disk, the exposure window is limited to the current session.

### 5.4 Physical USB Security

Because the application runs as a portable executable from a USB drive:

- **Encrypt the USB drive** using BitLocker To Go or an equivalent full-disk encryption tool. The deployment scripts and executable should not be accessible if the drive is lost.
- **Label the USB drive** clearly as a hospital IT deployment tool. Include an asset tag.
- **Store the USB drive** in a locked cabinet or safe when not in active use.
- **Do not leave the USB drive unattended** in a patient-accessible area.
- **Maintain a chain-of-custody log** for the USB drive, recording who checked it out and when it was returned.
- **Periodically verify** the contents of the USB drive against a known-good hash. The portable executable and deployment scripts should not have been modified.

### 5.5 Network Isolation Requirements

The Secure Deployment Runner should be used on a **dedicated deployment/management VLAN** that is segmented from:

- **Clinical VLANs** carrying electronic health record (EHR) traffic and medical device communication.
- **Guest/public Wi-Fi networks**.
- **Internet-facing networks** (the application makes no outbound internet calls by design).

**Required network access from the deployment workstation:**

| Protocol | Port(s) | Direction | Purpose |
|---|---|---|---|
| UDP | 9 (or 7) | Outbound | Wake-on-LAN magic packets |
| TCP | 5985-5986 | Outbound | WinRM (HTTP/HTTPS) for remote management |
| TCP | 135, 445 | Outbound | RPC/SMB for WMI queries and file transfer |
| ICMP | -- | Outbound | Connectivity verification (ping) |

**Ensure the following are in place:**

1. Firewall rules permit the deployment workstation to reach target devices on the management VLAN.
2. Target devices have WinRM enabled and configured for the appropriate authentication method.
3. No general internet egress is needed. The application is fully offline-capable.
4. If the deployment and target VLANs differ, ensure a directed broadcast relay is configured for Wake-on-LAN packets to reach the target subnet.

### 5.6 Script Safety as a Security Layer

The deterministic script safety analyzer provides a defense-in-depth layer specifically designed for hospital environments. It prevents deployment scripts from:

- Executing broadcast or subnet-wide operations (ping sweeps, wildcard PsExec, wildcard WMI queries).
- Stopping critical Windows infrastructure services (DNS, DHCP, Active Directory, SQL Server, IIS, Certificate Services).
- Performing destructive disk operations (format, diskpart, recursive delete on drive roots).
- Modifying boot configuration (bcdedit).
- Disabling the Windows Firewall.
- Targeting hosts not in the approved device list (scope violation detection).

This analyzer runs entirely locally with no network calls. It uses regex pattern matching only -- no AI, no cloud services, no telemetry. Every pattern check is documented in `services/scriptSafetyAnalyzer.ts`.

---

## Quick Reference Card

### Keyboard & Mouse Shortcuts

| Action | Method |
|---|---|
| Switch views | Click **Image Monitor** or **Secure Deployment Runner** tab |
| Select a device | Click the checkbox on the device card |
| Select all devices | Click "Select All" checkbox in the Device Status Table header |
| Filter logs | Click the colored level buttons (INFO, SUCCESS, WARNING, ERROR) in the Log header |
| Wake selected devices | Click the **Wake-on-LAN** button in the application header |

### Session Lifecycle Summary

```
USB inserted
  -> Launch portable .exe
    -> Select CSV + batch script
      -> Click "Start System Scan"
        -> Enter credentials (modal)
          -> Script safety check (automatic)
            -> CSV parsed, devices loaded
              -> WoL -> Connect -> Scan (per device)
                -> Review results
                  -> Update (individual or bulk via Scope Guard)
                    -> Reboot if needed
                      -> Verify Success
                        -> Close application (all state wiped)
                          -> Eject USB
```

### Target Compliance Versions

| Component | Current Target | Constant in App.tsx |
|---|---|---|
| BIOS | A25 | `TARGET_BIOS_VERSION` |
| Dell Command Update | 5.2.0 | `TARGET_DCU_VERSION` |
| Windows | 23H2 | `TARGET_WIN_VERSION` |
