# Secure Deployment Runner — Operator Runbook

> **Purpose:** Fast-access reference for operators running active deployment sessions.
> Covers wave strategies, configuration profiles, bulk operation safety rules, shift
> hand-off checklists, and escalation decision trees.
>
> **Related docs:**
> - Full SOP start-to-finish: `docs/PROCESS.md`
> - Capacity planning: `docs/CAPACITY.md`
> - Error diagnosis: `docs/TROUBLESHOOTING.md`
> - Automation options: `docs/AUTOMATION.md`

---

## Table of Contents

1. [Session Start Checklist](#1-session-start-checklist)
2. [Configuration Profiles](#2-configuration-profiles)
3. [Wave Strategy Guide](#3-wave-strategy-guide)
4. [Bulk Action Safety Rules](#4-bulk-action-safety-rules)
5. [Status Quick Reference](#5-status-quick-reference)
6. [Decision Trees](#6-decision-trees)
7. [Credential Handling Rules](#7-credential-handling-rules)
8. [Shift Hand-Off Protocol](#8-shift-hand-off-protocol)
9. [Escalation Criteria](#9-escalation-criteria)
10. [Recovery Runbook](#10-recovery-runbook)

---

## 1. Session Start Checklist

Run through this before starting any deployment session.

```
PRE-SESSION CHECKLIST
═══════════════════════════════════════════════════════════════════
□ Device list is current (CSV matches physical rack or Image Monitor state)
□ Duplicate hostnames or MACs reviewed and resolved
□ Configuration profile matches current network conditions (see Section 2)
□ You know your expected device count and have a wave plan (see Section 3)
□ Admin credentials are ready and valid (will be prompted at scan start)
□ Log panel is visible (not collapsed) before first bulk action
□ Browser notifications allowed (optional but recommended for long runs)
□ You have the shift hand-off template ready (see Section 8)
□ Export path confirmed (for CSV archive after run)
□ Escalation contact is known (see Section 9)
═══════════════════════════════════════════════════════════════════
```

---

## 2. Configuration Profiles

Set these in **Deployment Runner → Advanced Settings** before starting a scan.

### Profile A: Lab / Fast Feedback

```
Use when: Testing, UI exploration, quick iteration, < 10 devices
─────────────────────────────────────────────────────────────────
Max Retries:    1
Retry Delay:    1 second
Auto Reboot:    OFF

Behavior:  Devices go offline quickly (1 attempt only). Good for
           finding connectivity issues fast. Low time per device.
Caution:   Many devices may show Offline; this is expected at Retry=1.
```

### Profile B: Office — Stable LAN

```
Use when: Standard weekday patch window, reliable wired LAN, 10–50 devices
─────────────────────────────────────────────────────────────────
Max Retries:    3       ← default
Retry Delay:    2 seconds  ← default
Auto Reboot:    ON (experienced tech) / OFF (new tech)

Behavior:  3 attempts × 2s delay = up to 6s overhead per offline device.
           ~2.7% offline probability per device at these settings.
           Auto Reboot speeds up BIOS update flows considerably.
```

### Profile C: Remote / Unstable Site

```
Use when: VPN-connected devices, branch sites, unreliable network, WAN
─────────────────────────────────────────────────────────────────
Max Retries:    5
Retry Delay:    6 seconds
Auto Reboot:    ON

Behavior:  5 attempts × 6s = up to 30s overhead per device.
           ~0.24% offline probability (0.3^5).
           Scan time for 20 devices: ~10–20 min.
           Good for absorbing intermittent WAN drops.
```

### Profile D: Incident Recovery

```
Use when: Incident triage, many devices showing Failed/Offline, network instability
─────────────────────────────────────────────────────────────────
Max Retries:    5
Retry Delay:    8 seconds
Auto Reboot:    OFF   ← do NOT auto-reboot during incident triage

Behavior:  Very conservative; maximizes chance of connection.
           Use Validate-only mode first (do not run updates until
           you understand why devices are failing).
           Manual reboots only — preserve state for investigation.
```

### Profile E: Large Batch (50+ devices, experienced operator)

```
Use when: Large imaging event, experienced operator, stable LAN
─────────────────────────────────────────────────────────────────
Max Retries:    3
Retry Delay:    2 seconds
Auto Reboot:    ON

Waves:          20–25 devices per wave (see Section 3)
Bulk update:    Use only on homogeneous cohorts (all Scan Complete,
                same expected update profile)
```

---

## 3. Wave Strategy Guide

### Why waves matter

The scan loop is sequential: one device at a time. A 50-device scan = ~5–10 minutes.
A 50-device run where 20 fail with 5 retries each can take 40+ minutes.
Waves let you process, verify, and remove devices incrementally.

### Wave sizing rules

```
New operator (first week):         5 devices per wave
Learning operator (first month):   10 devices per wave
Experienced operator (daily ops):  20–25 devices per wave
Senior operator (known environment): up to 50 with strict cohort discipline
```

### Wave execution sequence

```
Wave N:
  1. Load devices (CSV or Image Monitor transfer) — 20–25 devices
  2. Configure profile (Section 2)
  3. Start Scan → credentials → wait
  4. Triage outcomes:
     ✅ Success    → select all → Bulk Remove (clean the queue)
     ⚠️ Scan Complete → Bulk Update (homogeneous only) → Re-scan → Remove
     ❌ Offline    → fix network → re-validate individually → Remove or defer
     ❌ Failed     → check logs → retry or escalate → Remove
  5. Re-Scan All → confirm closure → Archive Run → Export CSV
  6. Load Wave N+1

Wave N+1 should not start until Wave N is fully cleared and archived.
```

### Emergency stop

```
If something goes wrong mid-wave:
  1. Click Cancel Deployment (stops the scan loop after current device)
  2. Note current device statuses in log panel
  3. Do NOT bulk-remove yet — preserve state for diagnosis
  4. Fix the issue
  5. Use Rescan All (resets all devices to Pending Validation)
     or Validate Selected (for specific devices only)
```

---

## 4. Bulk Action Safety Rules

Bulk actions affect all selected devices simultaneously. Follow these rules every time.

### Pre-bulk action checklist

```
Before any bulk action:
  □ Are all selected devices in the SAME status class?
     → Bulk Update on mixed Success + Scan Complete = wasted operations on Success devices
     → Sort the device list by status before selecting

  □ Do you know why devices are in their current status?
     → Never bulk update without understanding the compliance check results
     → Click expand on a sample device to review the compliance checklist

  □ Is the log panel visible?
     → You must be able to see per-device log output in real time

  □ For BULK_DEPLOY_OPERATION: is the correct file selected?
     → The file picker state resets if you navigate away — confirm the file name is shown
     → BULK_DEPLOY_OPERATION is sequential (one device at a time) — not parallel
```

### Bulk action behaviors (from code)

| Bulk Action | Execution | Respects Cancel? | Clears Selection? |
|---|---|---|---|
| Bulk Update | Parallel (`Promise.all`) | Per-device `isCancelled()` check | Yes, after complete |
| Bulk Validate | Sequential (`for...of`) | Per-device check | Yes |
| Bulk Execute | Parallel (`Promise.all`) | Per-device check | Yes |
| Bulk Deploy Operation | Sequential (`for...of`) | No (runs to completion) | Yes |
| Bulk Remove | Synchronous (filter) | N/A | Yes |
| Bulk Cancel | Synchronous (map) | N/A | Yes |

> **Bulk Deploy Operation note:** Because it's sequential and does NOT check `isCancelled()`,
> the Cancel button will NOT interrupt a running Bulk Deploy Operation. Plan your cohort
> carefully before starting.

### Dangerous combinations to avoid

```
NEVER:
  □ Bulk Update on a mix of Success + Scan Complete devices
     → Wastes time re-updating already-compliant devices
     → May trigger unnecessary reboots on Success devices

  □ Bulk Execute on devices that don't have scripts attached
     → BULK_EXECUTE filters for 'Ready for Execution' status — safe by design
     → But: verify which devices are actually 'Ready for Execution' before selecting

  □ Bulk Remove on devices still in active scan/update states
     → Removing mid-scan devices leaves the async callbacks orphaned
     → Wait for terminal status before removing

  □ Bulk Deploy Operation on untested file targets
     → Test on 1–2 devices first; validate File Not Found / permission errors
     → Then scale to bulk
```

---

## 5. Status Quick Reference

```
SCANNING STATUSES (normal flow, no action needed)
─────────────────────────────────────────────────
Pending              → Waiting for scan to start (CSV loaded)
Pending File         → Waiting for scan to start (from Image Monitor)
Pending Validation   → Waiting for re-scan (RESCAN_ALL cleared version data)
Waking Up            → Manual WoL sent (separate from scan)
Connecting           → Attempting TCP connection
Retrying...          → Connection failed; waiting before next attempt
Validating           → Re-scan path: starting validateDevice
Checking Info        → Gathering model, serial, IP, encryption
Checking BIOS        → Comparing BIOS to target version (A24)
Checking DCU         → Comparing DCU to target version (5.1.0)
Checking Windows     → Comparing Windows to target version (23H2)
Updating             → Update process starting
Updating BIOS        → BIOS update in progress (always requires reboot)
Updating DCU         → DCU update in progress
Updating Windows     → Windows update in progress
Rebooting...         → Device rebooting (8–12 seconds)
Executing Script     → Post-image script running
Deploying Action     → Run/Install/Delete operation in progress

TERMINAL STATUSES (action may be required)
───────────────────────────────────────────
Success              → All checks passed ✅ → can Remove
Scan Complete        → One+ checks failed ⚠️ → Update or investigate
Offline              → Could not connect ❌ → check power/network
Failed               → Update failed ❌ → retry or escalate
Cancelled            → Scan was cancelled → Remove or Rescan
Update Complete      → Updated, reboot needed → Reboot
  (Reboot Pending)
Execution Complete   → Script ran successfully ✅ → can Remove
Execution Failed     → Script failed ❌ → check script, retry
Action Complete      → File operation succeeded ✅
Action Failed        → File operation failed ❌ → check reason in logs

COMPLIANCE INDICATORS (per device in expanded row)
───────────────────────────────────────────────────
✅ green = passed / current
❌ red   = failed / needs update / not found
❓ gray  = not yet checked (scan hasn't run yet)
```

---

## 6. Decision Trees

### Decision Tree A: What to do with "Scan Complete" devices

```
Device is Scan Complete
         │
         ▼
Expand row → Review compliance checklist
         │
    ┌────┴────────────────┬──────────────────────┬──────────────────┐
    │ BIOS/DCU/Windows    │ BitLocker: Disabled   │ CrowdStrike:     │
    │ outdated            │                       │ Not Found        │
    │                     │                       │ SCCM: Unhealthy  │
    ▼                     ▼                       ▼
Update Device         Investigate:              Check if software
(Bulk Update if       - Was encryption          deployed correctly
multiple, same        ever enabled?             - May need manual
update profile)       - Is drive encrypted      intervention
    │                 at hardware level?        - Re-image if
    ▼                 - Escalate if             chronic
Success (if all       persistent
updates apply) ─────────────────────────────▶ Resolved?
                                                    │
                                           No: Escalate (Section 9)
                                          Yes: Re-scan to confirm
```

### Decision Tree B: What to do with "Offline" devices

```
Device is Offline
         │
         ▼
Check: Is device powered on and ethernet connected?
         │
    ┌────┴──────────────────┐
    │ No: Fix physical      │ Yes: Network/config issue
    │ connection first      │
    ▼                       ▼
Validate Selected         Check:
(after fixing)            - Correct VLAN?
                          - Switch port access?
                          - Firewall rules?
                          - Device hostname/IP correct?
                               │
                          ┌────┴──────────┐
                          │ Fixed         │ Not fixed
                          ▼               ▼
                    Validate Selected   Defer: Remove from
                                        active wave;
                                        document + escalate
```

### Decision Tree C: Re-scan or Validate Selected?

```
Do you want to re-check compliance on...

All devices in the runner queue?
  → RESCAN_ALL_DEVICES_PROMPT
  → This resets ALL devices to 'Pending Validation' and clears all version data
  → Use after completing a full remediation wave

Only specific devices (after updating a subset)?
  → Select those devices
  → VALIDATE_DEVICES (Validate Selected)
  → Only re-scans selected devices; leaves others unchanged
  → More efficient; preferred for incremental validation
```

### Decision Tree D: Should I archive now?

```
Should I archive this run?
         │
         ▼
Are there still devices actively being remediated?
         │
    ┌────┴──────────────────┐
    │ Yes                   │ No
    ▼                       ▼
Wait until they reach    Archive run
a terminal status        (ARCHIVE_RUN)
before archiving               │
                         Export CSV immediately
                         (history limited to 10 runs)
                               │
                         Remove Success devices
                         (keep Offline/Failed for next wave)
```

---

## 7. Credential Handling Rules

```
CREDENTIAL RULES FOR OPERATORS
═══════════════════════════════════════════════════════════════════
RULE 1: Never pre-type credentials elsewhere
  → Do not write credentials in Notepad, sticky notes, or browser
    autofill to paste into the modal
  → Type directly into the SecureCredentialModal fields each time

RULE 2: Session credentials only
  → Credentials are used only for the current scan session
  → The modal prompts on every new scan start (intentional by design)
  → Credentials are not remembered between sessions

RULE 3: Use the correct account type
  → Use an admin account scoped to the imaging/provisioning environment
  → Do not use personal Active Directory accounts for bulk deployment
  → Use a dedicated deployment service account where possible

RULE 4: If credentials fail (scan won't start after confirming)
  → Check username format: try DOMAIN\username vs username@domain vs just username
  → Verify the account hasn't expired
  → Do not attempt more than 3 credential retries — account lockout risk

RULE 5: Remote Desktop credentials (separate flow)
  → The "Remote In with Credentials" option generates an RDP file with
    username pre-filled — the password is NOT embedded in the .rdp file
  → Password prompt will still appear in the RDP session

RULE 6: Never share credentials in log outputs or shift handoffs
  → The app logs "User: <username>" in INITIALIZE_DEPLOYMENT — this is
    intentional for audit purposes
  → Never include passwords in handoff notes or incident documents
═══════════════════════════════════════════════════════════════════
```

---

## 8. Shift Hand-Off Protocol

### When to hand off

- At shift end (even if run is incomplete)
- After any incident
- When handing to a second operator mid-run

### Hand-off package contents

```
1. Shift Handoff Form (fill out completely)
2. Exported CSV of current run (before archiving)
3. Screenshot of device list showing current statuses
4. Log export or screenshot of key log entries
5. List of outstanding devices (Offline / Failed / Scan Complete) with notes
```

### Shift Handoff Form Template

```markdown
═══════════════════════════════════════════════════════════════════
SHIFT HANDOFF — SECURE DEPLOYMENT RUNNER
═══════════════════════════════════════════════════════════════════
Date:              _______________
Shift Start:       _______________
Shift End:         _______________
Outgoing Operator: _______________
Incoming Operator: _______________

DEVICE COUNTS AT HANDOFF
────────────────────────
Total devices in queue:   ___
  ✅ Success:             ___
  ⚠️  Scan Complete:      ___
  ❌  Offline:            ___
  ❌  Failed:             ___
  ⬜  Cancelled:          ___
  Other (specify):        ___

ACTIONS COMPLETED THIS SHIFT
──────────────────────────────
□ CSV imported (filename):       _______________
□ Image Monitor transfers:       ___ devices
□ Scans started:                 ___
□ Update waves run:              ___
□ Script executions:             ___
□ Re-scans run:                  ___
□ Archive created:               □ Yes  □ No
□ Archive exported to CSV:       □ Yes  □ No
□ Devices removed from queue:    ___

OUTSTANDING ITEMS FOR NEXT SHIFT
──────────────────────────────────
1. [Device / issue / action needed]
2. [Device / issue / action needed]
3. [Device / issue / action needed]

INCIDENTS / NOTABLE EVENTS
──────────────────────────
[Describe any unexpected behavior, errors, or devices requiring escalation]

ESCALATIONS OPEN
─────────────────
□ None
□ [Issue / ticket / owner]

CONFIGURATION IN USE
─────────────────────
Max Retries:  ___
Retry Delay:  ___ s
Auto Reboot:  □ ON  □ OFF
═══════════════════════════════════════════════════════════════════
```

---

## 9. Escalation Criteria

Use this to decide when to stop trying and get help.

### Escalate immediately if:

```
□ A device fails BIOS update 3+ times in a row
   → Likely a hardware or BIOS media issue; don't keep retrying
   → Remove from queue; document hostname + serial; escalate to hardware team

□ More than 20% of a wave is Offline after increasing retries to 5
   → Likely a network infrastructure issue (VLAN, DHCP, switch port)
   → Stop the wave; escalate to network team before continuing

□ Credentials are rejected 3+ times for the same valid account
   → Account may be locked or expired
   → Stop attempting; escalate to IT security / AD team

□ Same device fails compliance check 3+ times after re-imaging
   → Device may have hardware/firmware issue or broken image
   → Remove from queue; document; consider re-imaging or hardware replacement

□ The browser tab crashes or freezes mid-run
   → If devices were in active update states, they may be in an unknown state
   → Document the last known status of all devices
   → Escalate to platform engineer for incident assessment

□ A file operation (Run/Install/Delete) fails with "Insufficient Permission" for
   most devices in a wave
   → The deployment service account may lack the required ACLs
   → Stop bulk operations; escalate to platform engineer

□ You see unexpected statuses that don't appear in the status reference table
   → May indicate a code bug or reducer state corruption
   → Document the status string and trigger; escalate to platform engineer
```

### Escalation information to capture before escalating:

```
□ Device hostname(s) and MAC address(es) affected
□ Status at time of escalation
□ Last 20 log entries related to the device(s)
□ Configuration profile in use (retries, delay, auto-reboot)
□ Number of retry attempts already made
□ Any error messages or reason codes from file operations
□ Run ID / archive timestamp if available
```

---

## 10. Recovery Runbook

### Scenario R1: Scan cancelled mid-run, devices in mixed states

```
1. Note current device statuses (screenshot or log review)
2. Do NOT bulk-remove yet — preserve state for diagnosis
3. Identify which devices are in "stuck" states vs terminal states
4. For terminal states (Success, Offline, Failed, Cancelled, Scan Complete):
   → These are safe; proceed normally
5. For stuck states (Connecting, Retrying..., Updating, etc. after cancel):
   → Wait 30 seconds for in-flight async operations to complete
   → These should resolve to a terminal status
   → If still stuck after 1 minute: these will remain until page refresh
6. Remove Cancelled devices (select all Cancelled → Bulk Remove)
7. Rescan remaining devices or start fresh wave

Expected time: 5–10 minutes to stabilize
```

### Scenario R2: Large number of Offline devices unexpectedly

```
1. Do NOT immediately bulk-retry — identify the pattern first
2. Check: are all offline devices in the same rack, VLAN, or site?
   → Yes: network/infrastructure issue — escalate to network team
   → No: individual device issues — proceed with individual diagnosis

3. Increase retries to 5, delay to 8s
4. Run Validate Selected on a small sample (3–5 devices) first
5. If sample succeeds: run Validate Selected on remaining Offline devices
6. If sample still fails: escalate network issue

Expected time: 15–30 minutes to diagnose + remediate
```

### Scenario R3: High update failure rate (> 20% of updates failing)

```
1. Stop bulk updates immediately
2. Identify if failures are on specific components (BIOS vs DCU vs Windows)
   → Check lastUpdateResult in React DevTools or log entries
3. Try Update on a single device individually with log panel open
4. Check for patterns: same error type? Same device model? Same rack?
5. If BIOS: check WDS distribution point has correct BIOS payload
6. If Windows: check distribution point has Windows update media
7. If same 3–5 devices repeatedly fail: remove from queue + escalate (hardware check)
8. For transient failures: retry Bulk Update (each attempt is independent)

Expected time: 20–45 minutes depending on root cause
```

### Scenario R4: Browser state lost (refresh / crash)

```
1. Reopen the app in browser
2. Check: is there any state recovery? (depends on useLocalStorage wiring)
3. If state is clean (no devices):
   → Re-import CSV or re-transfer from Image Monitor
   → Note: run history before the crash is gone (unless exported)
4. If some state persists but is inconsistent:
   → Do NOT trust stale statuses — run fresh Rescan All
5. For devices that were mid-update when browser closed:
   → Physical device may have completed update without the app knowing
   → Re-scan those devices to discover their actual state
6. Document what was lost; note in shift handoff

Expected time: 5–15 minutes to recover and restart
```

### Scenario R5: App showing incorrect data / UI glitch

```
1. Note the specific symptom (screenshot if possible)
2. Try: Rescan All (this resets device states to Pending Validation cleanly)
3. Try: Hard refresh (Ctrl+Shift+R / Cmd+Shift+R) — clears browser cache
   → CAUTION: hard refresh loses all current state
   → Export CSV and screenshot first
4. Try: Different browser
5. If symptom persists across browsers: likely a code bug
   → Document reproduction steps; escalate to platform engineer
6. If symptom was in history/analytics display:
   → This is chart rendering — try expanding/collapsing the history panel
   → Or export to CSV and inspect data directly

Expected time: 5–10 minutes to diagnose; escalate if not resolved
```
