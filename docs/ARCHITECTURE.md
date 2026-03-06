# Secure Deployment Runner — Technical Architecture

> **Audience:** Platform engineers, frontend developers, and technical leads integrating this
> application with backend infrastructure.
>
> **What this document covers:** Full technical architecture from state management to service
> contracts to data types, with ASCII diagrams showing exactly how data flows through the system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [State Management Architecture](#2-state-management-architecture)
3. [Action / Reducer Flow](#3-action--reducer-flow)
4. [Service Layer Design](#4-service-layer-design)
5. [Complete Device State Machine](#5-complete-device-state-machine)
6. [Component Tree and Responsibilities](#6-component-tree-and-responsibilities)
7. [Data Type Reference](#7-data-type-reference)
8. [CSV Import Pipeline](#8-csv-import-pipeline)
9. [Credential Flow and Security Model](#9-credential-flow-and-security-model)
10. [RDP File Generation](#10-rdp-file-generation)
11. [Backend Integration Guide](#11-backend-integration-guide)
12. [Key File Index](#12-key-file-index)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SYSTEM ARCHITECTURE OVERVIEW                          │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         BROWSER (React SPA)                          │  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │  App.tsx — Tab Router                                        │   │  │
│  │  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────┐ ┌────────┐  │   │  │
│  │  │  │ Image   │ │Deployment│ │Imaging │ │ Build │ │Remote  │  │   │  │
│  │  │  │ Monitor │ │ Runner   │ │Script  │ │Output │ │Desktop │  │   │  │
│  │  │  └─────────┘ └──────────┘ └────────┘ └───────┘ └────────┘  │   │  │
│  │  └───────────────────────────┬──────────────────────────────────┘   │  │
│  │                              │ useContext                            │  │
│  │  ┌───────────────────────────▼──────────────────────────────────┐   │  │
│  │  │  AppContext (contexts/AppContext.tsx)                         │   │  │
│  │  │  useReducer hook — single source of truth                    │   │  │
│  │  │                                                              │   │  │
│  │  │  state.runner  ─────── devices, logs, settings, history     │   │  │
│  │  │  state.monitor ─────── imaging devices                      │   │  │
│  │  │  state.ui      ─────── activeTab, modal flags, csvFile      │   │  │
│  │  └───────────────────────────┬──────────────────────────────────┘   │  │
│  │                              │ async calls (via dispatch callbacks)  │  │
│  │  ┌───────────────────────────▼──────────────────────────────────┐   │  │
│  │  │  deploymentService.ts  (services/deploymentService.ts)       │   │  │
│  │  │  Mock service layer — mirrors backend contracts              │   │  │
│  │  │                                                              │   │  │
│  │  │  runDeploymentFlow   validateDevice   updateDevice           │   │  │
│  │  │  runComplianceChecks executeScript    generateRunArchive     │   │  │
│  │  │  parseDevicesFromCsv buildRemoteDesktopFile                 │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  EXTERNAL INTEGRATIONS (current: mocked; future: real)               │  │
│  │                                                                      │  │
│  │  Network Share  ──▶  Image Monitor polling (JSON device records)     │  │
│  │  WinRM/PS       ──▶  Device scan, BIOS/DCU/Windows checks           │  │
│  │  WDS/MDT        ──▶  PXE boot, task sequence, AutoTag script        │  │
│  │  DHCP           ──▶  Device IP assignment, WoL routing              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. State Management Architecture

All application state lives in a single `useReducer` hook inside `AppContext`. This is the
canonical React Context + Reducer pattern. No external state library (Redux, Zustand, Jotai) is
used — the built-in React primitives handle the scope of this application.

### Dual-Layer Dispatch Architecture

`AppContext` implements a **two-layer dispatch pattern** that is critical to understand:

```
Component calls wrappedDispatch(action)
             │
    ┌────────┴────────────────────────────┐
    │                                     │
    ▼                                     ▼
appReducer(state, action)         effectRunner(newState, action)
(synchronous, pure)               (async, side-effect handler)
    │                                     │
    ▼                                     │
New state → React re-render       Async service calls → more dispatches
                                         │
                                  api.runDeploymentFlow(...)
                                  api.updateDevice(...)
                                  api.executeScript(...)
                                  etc.
```

The `appReducer` handles all synchronous state transforms (modal flags, device list mutations,
settings). The `effectRunner` (a `useCallback` async function) handles all async side effects —
it receives the *already-updated* state and calls service functions, dispatching additional actions
as each operation progresses.

### State Shape (from `src/types.ts` — `AppState` interface)

```typescript
interface AppState {
  runner: {
    devices: Device[];              // Active deployment queue
    logs: LogEntry[];               // LogEntry objects {timestamp, message, level}
    deploymentState: DeploymentState; // 'idle' | 'running' | 'complete'
    selectedDeviceIds: Set<number>; // IDs of checked rows in device table
    history: DeploymentRun[];       // Last 10 archived runs (slice(0,10))
    settings: {
      maxRetries: number;           // Default: 3
      retryDelay: number;           // Default: 2 (seconds)
      autoRebootEnabled: boolean;   // Default: false
    };
    isCancelled: boolean;           // Cancellation flag; checked each iteration
    batchHistory: DeploymentBatchSummary[];  // Last 5 bulk op summaries
  };
  monitor: {
    devices: ImagingDevice[];       // Devices in imaging pipeline
  };
  ui: {
    activeTab: 'monitor' | 'runner' | 'build' | 'script' | 'remote';
    csvFile: File | null;           // CSV file selected but not yet parsed
    isCredentialModalOpen: boolean;
    isComplianceModalOpen: boolean;
    selectedComplianceResult: ComplianceResult | null;  // NOT a device ID
    isAllComplianceModalOpen: boolean;
    isPassedComplianceModalOpen: boolean;
    isRescanModalOpen: boolean;           // NOTE: not "isRescanConfirmationModalOpen"
    isRemoteCredentialModalOpen: boolean;
    remoteTargetDeviceId: number | null;
  };
  credentials?: Credentials;             // Stored at top level after INITIALIZE_DEPLOYMENT
}
```

### Initial State (Default Values — `contexts/AppContext.tsx`)

```typescript
const initialState: AppState = {
  runner: {
    devices: [],
    logs: [],
    deploymentState: 'idle',
    selectedDeviceIds: new Set(),
    history: [],
    settings: { maxRetries: 3, retryDelay: 2, autoRebootEnabled: false },
    isCancelled: false,
    batchHistory: [],
  },
  monitor: { devices: [] },
  ui: {
    activeTab: 'monitor',
    csvFile: null,
    isCredentialModalOpen: false,
    isComplianceModalOpen: false,
    selectedComplianceResult: null,
    isAllComplianceModalOpen: false,
    isPassedComplianceModalOpen: false,
    isRescanModalOpen: false,
    isRemoteCredentialModalOpen: false,
    remoteTargetDeviceId: null,
  },
};
```

### Automatic Compliance Trigger

`AppProvider` includes a `useEffect` that watches `state.monitor.devices`. When any device
reaches `status === 'Completed'` without a `complianceCheck` result, `runComplianceChecks()`
fires automatically — no manual dispatch required:

```typescript
// contexts/AppContext.tsx:439-448
useEffect(() => {
  const checkCompliance = async () => {
    const devicesToCheck = state.monitor.devices
      .filter(d => d.status === 'Completed' && !d.complianceCheck);
    if (devicesToCheck.length === 0) return;
    const onProgress = (device) => dispatch({ type: 'UPDATE_IMAGING_DEVICE_STATE', payload: device });
    await api.runComplianceChecks(devicesToCheck, onProgress);
  };
  checkCompliance();
}, [state.monitor.devices]);
```

---

## 3. Action / Reducer Flow

Every state change in the application flows through the reducer via a typed `Action` dispatch.
There is no direct state mutation outside this path.

### Action Flow Diagram

```
Operator interaction                                     State update
(button click, form submit)                              (re-render)
        │                                                      ▲
        ▼                                                      │
  Component calls dispatch({ type: 'ACTION_NAME', payload })  │
        │                                                      │
        ▼                                                      │
  AppContext reducer receives action                           │
        │                                                      │
        ├─ Synchronous actions (UI state, settings)            │
        │   → Return new state immediately                     │
        │                                                      │
        └─ Async actions (scan, update, script)                │
            → Dispatch starts async service function           │
            → Service function dispatches intermediate         │
            │  status updates via callback                     │
            │  (device status: Connecting → Checking → Done)  │
            └─ Final dispatch when operation completes ────────┘
```

### Complete Action Type Catalog (from `src/types.ts` — `AppAction`)

The table below lists every action type, where it is handled (reducer `R` = synchronous pure
transform, effect runner `E` = async side-effect), what triggers it, and what it does.

**UI / Modal Actions**

| Action | Layer | Trigger | Effect |
|---|---|---|---|
| `SET_ACTIVE_TAB` | R | Tab button click | Sets `ui.activeTab` |
| `SET_CSV_FILE` | R | File picker | Sets `ui.csvFile` |
| `SET_CREDENTIAL_MODAL_OPEN` | R | Internal | Opens/closes credential modal |
| `SHOW_COMPLIANCE_DETAILS` | R | Compliance icon click | Sets `selectedComplianceResult` + opens modal |
| `SET_COMPLIANCE_MODAL_OPEN` | R | Modal close | Closes compliance detail modal |
| `SET_ALL_COMPLIANCE_MODAL_OPEN` | R | Fleet compliance button | Opens/closes all-compliance modal |
| `SET_PASSED_COMPLIANCE_MODAL_OPEN` | R | Passed filter button | Opens/closes passed-compliance modal |
| `SET_RESCAN_MODAL_OPEN` | R | Internal | Opens/closes re-scan confirmation modal |
| `ADD_LOG` | R | effectRunner dispatches | Appends `LogEntry` to `runner.logs[]` |

**Deployment Runner — Scan / Update Actions**

| Action | Layer | Trigger | Effect |
|---|---|---|---|
| `START_DEPLOYMENT_PROMPT` | R | "Start Scan" button | Validates devices exist; opens credential modal |
| `START_DEPLOYMENT_CONFIRMED` | E | Credential modal confirm | Receives `Credentials`; parses CSV if `csvFile` set; then dispatches `INITIALIZE_DEPLOYMENT` |
| `INITIALIZE_DEPLOYMENT` | R+E | Dispatched by `START_DEPLOYMENT_CONFIRMED` | R: stores devices, credentials, sets `deploymentState:'running'`; E: calls `runDeploymentFlow(devices, settings, onProgress, isCancelled)` |
| `DEPLOYMENT_STARTED` | R | Internal | Sets `deploymentState:'running'` |
| `UPDATE_DEVICE_STATE` | R | effectRunner callbacks | Replaces full `Device` object in `devices[]` by id |
| `UPDATE_SINGLE_DEVICE` | R | effectRunner callbacks | Merges `Partial<Device>` into existing device by id |
| `DEPLOYMENT_FINISHED` | R | After scan/rescan completes | Sets `deploymentState:'complete'` |
| `CANCEL_DEPLOYMENT` | R+E | Cancel button | R: sets `isCancelled:true`, marks active devices `'Cancelled'`; E: logs warning, dispatches `ARCHIVE_RUN` |
| `ARCHIVE_RUN` | R | After run/rescan/cancel | Calls `generateRunArchive(devices)`, prepends to `history.slice(0,10)` |
| `SET_SETTINGS` | R | Settings panel inputs | Merges `Partial<settings>` into `runner.settings` |
| `RESCAN_ALL_DEVICES_PROMPT` | R | Re-scan button | Opens confirmation modal if devices exist |
| `RESCAN_ALL_DEVICES_CONFIRMED` | R+E | Confirmation modal confirm | R: resets all device states to `'Pending Validation'` + clears version/compliance data; E: calls `validateDevices(devices, onProgress, isCancelled)` |
| `UPDATE_DEVICE` | E | Per-device update button | Calls `updateDevice(device, settings, onProgress, isCancelled)` |
| `BULK_UPDATE` | E | Bulk Update button | Calls `updateDevice` for all selected via `Promise.all` (parallel) |
| `REBOOT_DEVICE` | E | Reboot button | Sets status `'Rebooting...'`; calls `rebootDevice()`; sets `'Success'` |
| `VALIDATE_DEVICES` | E | Re-validate button (selection) | Calls `validateDevices(selectedDevices, onProgress, isCancelled)` |
| `BULK_VALIDATE` | E | Bulk Validate button | Same as `VALIDATE_DEVICES` but uses full `selectedDeviceIds` Set |
| `EXECUTE_SCRIPT` | E | Execute button (single) | Sets `'Executing Script'`; calls `executeScript(device)`; sets `'Execution Complete'/'Failed'` |
| `BULK_EXECUTE` | E | Bulk Execute button | Same as `EXECUTE_SCRIPT` but for all selected `'Ready for Execution'` devices via `Promise.all` (parallel) |
| `BULK_DEPLOY_OPERATION` | E | Run/Install/Delete file op | Sequential `for...of` (not parallel) over selected devices; calls `performDeploymentOperation`; tracks `failuresByReason` in `batchHistory` |
| `BULK_REMOVE` | E | Bulk Remove button | Filters selected device IDs from `runner.devices` |
| `BULK_CANCEL` | E | Bulk Cancel button | Sets active selected devices to `'Cancelled'` |
| `WAKE_ON_LAN` | E | WoL button | Sets selected devices to `'Waking Up'`; logs WoL sent |
| `SET_SCRIPT_FILE` | E | Script file picker for device | Sets `device.scriptFile` and `device.status = 'Ready for Execution'` |

**Remote Desktop Actions**

| Action | Layer | Trigger | Effect |
|---|---|---|---|
| `REMOTE_IN_DEVICE` | E | Right-click → Remote-In | Calls `buildRemoteDesktopFile(device)` (no credentials); downloads `.rdp` file |
| `PROMPT_REMOTE_CREDENTIALS` | R | Right-click → Remote-In with credentials | Opens `RemoteCredentialModal`; sets `remoteTargetDeviceId` |
| `REMOTE_IN_WITH_CREDENTIALS` | E | `RemoteCredentialModal` confirm | Calls `buildRemoteDesktopFile(device, credentials)`; downloads `.rdp`; closes modal |
| `CLOSE_REMOTE_CREDENTIAL_MODAL` | R | Modal close | Clears `isRemoteCredentialModalOpen` and `remoteTargetDeviceId` |

**Image Monitor Actions**

| Action | Layer | Trigger | Effect |
|---|---|---|---|
| `SET_IMAGING_DEVICES` | R | Initial load or polling | Replaces entire `monitor.devices` array |
| `UPDATE_IMAGING_DEVICE_STATE` | R | Compliance check callbacks | Replaces single `ImagingDevice` in `monitor.devices` by id |
| `RENAME_IMAGING_DEVICE` | R | Inline hostname edit in rack card | Updates `hostname` on specific imaging device |
| `REMOVE_IMAGING_DEVICE` | R | Remove button in rack card | Filters device out of `monitor.devices` |
| `CLEAR_SELECTED_IMAGING_DEVICES` | R | Clear selection action | Filters selected IDs out of `monitor.devices` |
| `TRANSFER_ALL_COMPLETED_DEVICES` | R | "Transfer All" button | Moves all `status === 'Completed'` devices to runner; switches to runner tab |
| `TRANSFER_SELECTED_IMAGING_DEVICES` | R | "Transfer Selected" button | Moves selected completed devices to runner; switches to runner tab |
| `REVALIDATE_IMAGING_DEVICES` | E | Re-validate button in Image Monitor | Calls `revalidateImagingDevices(selectedDevices, onProgress)` |

**State Persistence**

| Action | Layer | Trigger | Effect |
|---|---|---|---|
| `SET_DEVICES` | R | Internal (after remove/cancel) | Replaces entire `runner.devices` array |
| `SET_BATCH_HISTORY` | R | After `BULK_DEPLOY_OPERATION` | Sets `batchHistory.slice(0,5)` |
| `TOGGLE_DEVICE_SELECTION` | R | Row checkbox | Adds/removes id from `selectedDeviceIds` Set |
| `SELECT_ALL_DEVICES` | R | Select all checkbox | Sets all or clears all device IDs in selection Set |
| `CLEAR_SELECTIONS` | R | After bulk ops | Clears `selectedDeviceIds` Set |

---

## 4. Service Layer Design

`services/deploymentService.ts` is the boundary between the UI and backend behavior. Every
function here is designed to be **swappable** — replace the mock implementation with real API
calls without changing the function signature or the components that call it.

### Function Contracts (Accurate — from `services/deploymentService.ts`)

```typescript
// ─────────────────────────────────────────────────────────────────────
// PARSING — receives PRE-PARSED Papa Parse results, not a File object
// CSV parsing is done by AppContext (Papa.parse inside effectRunner).
// deploymentService only receives the already-parsed results object.
// ─────────────────────────────────────────────────────────────────────

parseDevicesFromCsv(
  results: ParseResult<Record<string, string>>  // Papa Parse result object
): { devices: Device[]; errors: string[] }
// NOT async — synchronous validation of already-parsed rows
// Row-level validation: Hostname required, MAC normalized + validated
// Detects device type via detectDeviceType(hostname)
// New devices start with status: 'Pending' and default file lists


// ─────────────────────────────────────────────────────────────────────
// IMAGING ↔ RUNNER BRIDGE
// ─────────────────────────────────────────────────────────────────────

transformImagingToRunnerDevices(
  imagingDevices: ImagingDevice[]
): Device[]
// Converts ImagingDevice[] → Device[]
// Maps: d.macAddress (not d.mac) → device.mac
//       d.slot → device metadata
//       d.hostname, d.ipAddress, d.serialNumber, d.model → preserved
// IMPORTANT: returned devices have status: 'Pending File' (not 'Pending')
// Default files staged: ['CorpInstaller.msi', 'Onboarding.ps1', 'LegacyAgent.exe']
// Default installed: ['VPNClient.msi']


// ─────────────────────────────────────────────────────────────────────
// POST-IMAGE COMPLIANCE (called automatically by AppContext useEffect)
// ─────────────────────────────────────────────────────────────────────

runComplianceChecks(
  devices: ImagingDevice[],
  onProgress: (device: ImagingDevice) => void
): Promise<void>
// Sequential for...of over devices
// Per device: sets status 'Checking Compliance' → runs runSingleComplianceCheck()
// Checks (probabilistic): BitLocker Volume | Citrix Workspace | LAPS | SCCM Client+Running
// Returns ComplianceResult { status: 'Passed'|'Failed', details: ChecklistItem[] }
// Sets device status to 'Completed' with complianceCheck attached

revalidateImagingDevices(
  devices: ImagingDevice[],
  onProgress: (device: ImagingDevice) => void
): Promise<void>
// Same as runComplianceChecks but also clears complianceCheck first
// Used by REVALIDATE_IMAGING_DEVICES action


// ─────────────────────────────────────────────────────────────────────
// SCANNING — NO CREDENTIALS PARAMETER
// Credentials are stored in AppState.credentials after INITIALIZE_DEPLOYMENT
// but are NOT passed to or used by the service layer functions
// ─────────────────────────────────────────────────────────────────────

runDeploymentFlow(
  devices: Device[],
  settings: { maxRetries: number; retryDelay: number },  // NOT autoRebootEnabled
  onProgress: (device: Device) => void,
  isCancelled: () => boolean
): Promise<void>
// Sends a global Wake-on-LAN signal: await sleep(2000) before loop starts
// Sequential for...of: one device at a time
// Calls validateDevice(device, settings, onProgress, isCancelled) per device
// Checks isCancelled() before each device starts

validateDevices(
  devices: Device[],
  onProgress: (device: Device) => void,
  isCancelled: () => boolean
): Promise<void>
// Re-validation path (used by RESCAN_ALL_DEVICES_CONFIRMED and VALIDATE_DEVICES)
// Sets each device to 'Validating' before calling validateDevice
// Uses hardcoded settings: { maxRetries: 1, retryDelay: 1 }
// Sequential for...of (same as runDeploymentFlow)

// validateDevice — private function (not exported)
// ─────────────────────────────────────────────────────────────────────
// Connection: status → 'Connecting' → retry loop
//   70% connect chance per attempt (Math.random() > 0.3)
//   If retry: status → 'Retrying...', retryAttempt incremented
//   If all retries exhausted: status → 'Offline' (terminal) and returns
// Scan stages (each with sleep delay):
//   'Checking Info' (500ms): sets model='OptiPlex 7020', serialNumber, assetTag, encryptionStatus
//   'Checking BIOS' (1500ms): compares biosVersion to TARGET_BIOS_VERSION
//   'Checking DCU'  (1000ms): compares dcuVersion to TARGET_DCU_VERSION
//   'Checking Windows' (2000ms): compares winVersion to TARGET_WIN_VERSION
// Post-scan: checks crowdstrikeStatus, sccmStatus
// Terminal: 'Success' if ALL pass; 'Scan Complete' if ANY fail


// ─────────────────────────────────────────────────────────────────────
// UPDATES
// ─────────────────────────────────────────────────────────────────────

updateDevice(
  device: Device,
  settings: { autoRebootEnabled: boolean },  // ONLY autoRebootEnabled (not maxRetries/retryDelay)
  onProgress: (device: Device) => void,
  isCancelled: () => boolean
): Promise<void>
// Components checked: BIOS (requiresReboot=true), DCU, Windows
// Only updates components where device.updatesNeeded?.{bios|dcu|windows} === true
// ~15% failure rate per component (Math.random() > 0.15 = success)
// Stops at first failure (break on failed[])
// Status transitions: 'Updating' → 'Updating BIOS'/'DCU'/'Windows' → terminal
// Terminal outcomes:
//   failed.length > 0                     → 'Failed'
//   succeeded, no reboot needed           → 'Success'
//   succeeded, reboot needed, autoReboot  → auto-calls rebootDevice() → 'Success'
//   succeeded, reboot needed, no auto     → 'Update Complete (Reboot Pending)'
// Stores result in device.lastUpdateResult: { succeeded: string[], failed: string[] }

rebootDevice(): Promise<void>
// sleep(8000 + random * 4000) — simulates reboot time only


// ─────────────────────────────────────────────────────────────────────
// SCRIPTS AND FILE OPERATIONS
// ─────────────────────────────────────────────────────────────────────

executeScript(): Promise<boolean>
// No parameters — probabilistic: 80% success (Math.random() > 0.2)
// Returns boolean; caller sets 'Execution Complete' or 'Execution Failed'
// Sleep: 5000–10000ms

performDeploymentOperation(
  device: Device,
  operation: DeploymentOperationType,  // 'run' | 'install' | 'delete'
  targetFile: File
): Promise<{ ok: boolean; reason?: string; message: string; patch: Partial<Device> }>
// Returns patch object — caller applies via UPDATE_SINGLE_DEVICE
// 'run':     checks file exists in availableFiles; ~15% random permission failure
//            success: adds to runningPrograms[]; patch.status = 'Action Complete'
//            failure: patch.status = 'Action Failed', reason: 'File Not Found'|'Already Running'|'Insufficient Permission'
// 'install': checks file exists in availableFiles; ~12% random failure
//            success: adds to installedPackages[]; patch.status = 'Action Complete'
//            failure: patch.status = 'Action Failed', reason: 'File Not Found'|'Already Installed'|'Cannot Access File'
// 'delete':  checks file exists anywhere; blocks if currently running
//            success: removes from availableFiles[] and installedPackages[]; patch.status = 'Action Complete'
//            failure: patch.status = 'Action Failed', reason: 'Already Deleted'|'File In Use'
// IMPORTANT: BULK_DEPLOY_OPERATION processes devices SEQUENTIALLY (for...of), not in parallel


// ─────────────────────────────────────────────────────────────────────
// ARCHIVING AND HISTORY
// ─────────────────────────────────────────────────────────────────────

generateRunArchive(
  devices: Device[]   // NOTE: only one parameter — no startTime/endTime
): DeploymentRun
// compliant = devices with status in ['Success', 'Execution Complete']
// needsAction = devices with status in ['Scan Complete', 'Update Complete (Reboot Pending)',
//               'Ready for Execution', 'Pending File']
// failureCounts.offline = status === 'Offline'
// failureCounts.cancelled = status === 'Cancelled'
// failureCounts.failed = status in ['Failed', 'Execution Failed']
// id = Date.now() (number, not UUID string)
// endTime = new Date()
// updatesNeededCounts = { bios, dcu, windows } — counts from device.updatesNeeded


// ─────────────────────────────────────────────────────────────────────
// REMOTE DESKTOP
// ─────────────────────────────────────────────────────────────────────

buildRemoteDesktopFile(
  device: Device,
  credentials?: Credentials  // optional — if provided, adds username:s: line
): string
// Constructs minimal RDP file string (not a full template)
// Fields: screen mode, resolution (1600x900), full address, auth level, clipboard
// Downloaded in browser as: ${device.hostname}.rdp via Blob + createObjectURL
// Two access paths:
//   REMOTE_IN_DEVICE → no credentials (direct download)
//   REMOTE_IN_WITH_CREDENTIALS → with credentials from RemoteCredentialModal
```

---

## 5. Complete Device State Machine

### Imaging Device States (`ImagingDevice`)

```
                        ┌─────────────────┐
                        │     Imaging     │
                        │  (0% → 100%)    │
                        └────────┬────────┘
                                 │ imaging completes
                                 ▼
                        ┌─────────────────┐
                        │   Checking      │
                        │   Compliance    │  ← runComplianceChecks()
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
          ┌──────────────────┐     ┌──────────────────────┐
          │    Completed     │     │  Completed           │
          │    ✅ all pass   │     │  ⚠️ with flags       │
          └────────┬─────────┘     └──────────┬───────────┘
                   │                           │
                   └──────────┬────────────────┘
                              ▼
                   Transfer to Deployment Runner
```

### Deployment Device States (`Device`)

> **Important WoL clarification:** `runDeploymentFlow` sends a global WoL via `sleep(2000)` before
> the scan loop — it does NOT set per-device `'Waking Up'` status during a scan. The `'Waking Up'`
> status is set by the `WAKE_ON_LAN` action (bulk WoL button) and by `CANCEL_DEPLOYMENT`'s
> cancellable list. During `validateDevice`, the device goes directly to `'Connecting'`.
>
> **'Validating':** Set by `validateDevices()` before each device's `validateDevice()` call
> (used in re-scan path, not initial scan).

```
ENTRY POINTS:
  From CSV import:         status = 'Pending'
  From Image Monitor:      status = 'Pending File'  ← transformImagingToRunnerDevices always sets this

  ┌──────────────────────────────────────────┐
  │         'Pending'                        │◀─── CSV import
  │         'Pending File'                   │◀─── Image Monitor transfer
  │         'Pending Validation'             │◀─── Re-scan (RESCAN_ALL_DEVICES_CONFIRMED resets here)
  └────┬──────────────────────────────┬──────┘
       │ runDeploymentFlow            │ WAKE_ON_LAN action (separate button)
       │ validateDevice called        │
       │                              ▼
       │                    ┌──────────────────┐
       │                    │   Waking Up      │ ← WoL bulk action only
       │                    └────────┬─────────┘
       │                             │ (no further scan until user starts scan)
       ▼
  ┌──────────────────┐
  │   Connecting     │
                    └────────┬─────────┘
                             │
               ┌─────────────┴──────────────┐
               │ connection fails            │ connection succeeds
               ▼                             ▼
    ┌──────────────────┐           ┌──────────────────┐
    │   Retrying...    │──────────▶│  Checking Info   │
    │ (up to maxRetries│ retry OK  │ model/serial/IP  │
    │   times)         │           └────────┬─────────┘
    └────────┬─────────┘                    │
             │ retries exhausted            ▼
             ▼                    ┌──────────────────┐
         ┌────────┐               │  Checking BIOS   │
         │Offline │               │  vs TARGET_BIOS  │
         │❌ term │               └────────┬─────────┘
         └────────┘                        │
                                           ▼
                                  ┌──────────────────┐
                                  │  Checking DCU    │
                                  │  vs TARGET_DCU   │
                                  └────────┬─────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │ Checking Windows │
                                  │ vs TARGET_WIN    │
                                  └────────┬─────────┘
                                           │
                          ┌────────────────┴────────────────┐
                          │ all pass                         │ any fail
                          ▼                                  ▼
                   ┌──────────┐                    ┌──────────────────┐
                   │ Success  │                    │  Scan Complete   │
                   │ ✅ term  │                    │  ⚠️ needs action │
                   └──────────┘                    └────────┬─────────┘
                                                            │ updateDevice() called
                                                            ▼
                                                  ┌──────────────────┐
                                                  │    Updating      │
                                                  └────────┬─────────┘
                                                           │
                                              ┌────────────┼────────────┐
                                              ▼            ▼            ▼
                                     ┌──────────────┐ ┌────────┐ ┌──────────┐
                                     │Updating BIOS │ │Updating│ │Updating  │
                                     │(if needed)   │ │ DCU    │ │ Windows  │
                                     └──────┬───────┘ └───┬────┘ └────┬─────┘
                                            │             │            │
                                            └──────┬──────┘────────────┘
                                                   │
                                 ┌─────────────────┴────────────────┐
                                 │ all updates OK, no reboot needed  │ reboot needed
                                 ▼                                   ▼
                          ┌──────────┐             ┌────────────────────────────┐
                          │ Success  │             │ Update Complete             │
                          │ ✅ term  │             │ (Reboot Pending)           │
                          └──────────┘             └──────────────┬─────────────┘
                                                                  │ reboot action
                                                                  ▼
                                                         ┌──────────────────┐
                                                         │   Rebooting...   │
                                                         └────────┬─────────┘
                                                                  │
                                                  ┌───────────────┴───────────────┐
                                                  │ reboot OK, re-validate        │ reboot failed
                                                  ▼                               ▼
                                           ┌──────────┐                    ┌──────────┐
                                           │ Success  │                    │  Failed  │
                                           │ ✅ term  │                    │ ❌ term  │
                                           └──────────┘                    └──────────┘

SCRIPT / DEPLOYMENT STATES (parallel track):
─────────────────────────────────────────────
Pending File
  → [script attached to device]
  → Ready for Execution
  → Executing Script
  → Execution Complete ✅  |  Execution Failed ❌

FILE OPERATION STATES:
──────────────────────
(Run / Install / Delete selected)
  → Running / Installing / Deleting
  → Operation Complete ✅  |  Operation Failed ❌
```

---

## 6. Component Tree and Responsibilities

```
App.tsx  (tab router, exports version constants)
│
├── Header.tsx  (app title, tab navigation buttons)
│
├── [activeTab === 'monitor']
│   └── ImageMonitor.tsx  (device polling, transfer UI)
│       ├── ImageRack.tsx  (rack grid layout, 16 slots/rack)
│       │   ├── DeviceCard  (expandable device detail card)
│       │   │   ├── ComplianceStatusIcon  (per-check icon with tooltip)
│       │   │   └── DetailItemWithCopy    (copyable metadata field)
│       │   └── EmptySlotCard  (placeholder for unused rack slots)
│       ├── ImageTrends.tsx  (imaging analytics charts)
│       ├── ComplianceDetailsModal.tsx  (per-device compliance drill-down)
│       ├── AllComplianceDetailsModal.tsx  (fleet compliance overview)
│       └── PassedComplianceDetailsModal.tsx  (passed-only filter)
│
├── [activeTab === 'runner']
│   ├── [Configuration Panel]
│   │   ├── CSV file upload input
│   │   └── Advanced Settings (maxRetries, retryDelay, autoRebootEnabled)
│   ├── DeploymentProgress.tsx  (overall progress bar + status counts)
│   ├── BulkActions.tsx  (bulk action bar with file picker)
│   ├── DeviceStatusTable.tsx  (device rows with compliance checklists)
│   │   ├── StatusBadge  (colored status pill)
│   │   ├── ComplianceChecklistItem  (BIOS/DCU/Win/Enc/CS/SCCM indicators)
│   │   ├── MetadataItem  (copyable metadata cell)
│   │   └── DeviceContextMenu  (right-click menu — remote-in etc.)
│   ├── LogViewer.tsx  (real-time log stream)
│   └── DeploymentHistory.tsx  (run archive list + export)
│       ├── HistoryItem  (single run summary)
│       └── DeploymentAnalytics.tsx  (bar/trend Recharts)
│
├── [activeTab === 'build']
│   └── BuildOutput.tsx  (simulated build log stream)
│
├── [activeTab === 'script']
│   └── ImagingScriptViewer.tsx  (AutoTag PS script display)
│
├── [activeTab === 'remote']
│   └── RemoteDesktop.tsx  (RDP file generator)
│
├── SecureCredentialModal.tsx  (session credential gate, shown on Start Scan)
├── RescanConfirmationModal.tsx  (Re-scan-all confirmation)
├── SystemInfoModal.tsx  (full system info panel for a device)
└── ScriptAnalysisModal.tsx  (script analysis view)
```

---

## 7. Data Type Reference

All types are defined in `src/types.ts`.

### `Device` (Deployment Runner device record)

```typescript
interface Device {
  id: number;                          // Auto-incremented unique ID
  hostname: string;                    // Computer name
  mac: string;                         // Normalized MAC (uppercase, no separators)
  status: DeploymentStatus;            // Current state (see state machine)
  isSelected?: boolean;                // Checkbox state in table
  deviceType: DeviceFormFactor;        // laptop | desktop | tower | etc.

  // Version compliance
  biosVersion?: string;
  dcuVersion?: string;
  winVersion?: string;
  isBiosUpToDate?: boolean;
  isDcuUpToDate?: boolean;
  isWinUpToDate?: boolean;

  // Update tracking
  updatesNeeded?: {
    bios: boolean;
    dcu: boolean;
    windows: boolean;
    encryption: boolean;
    crowdstrike: boolean;
    sccm: boolean;
  };

  // Network info
  ipAddress?: string;
  retryAttempt?: number;

  // Hardware identity
  serialNumber?: string;
  model?: string;
  assetTag?: string;
  ramAmount?: number;                  // GB
  diskSpace?: { total: number; free: number };  // GB

  // Security posture
  encryptionStatus?: 'Enabled' | 'Disabled' | 'Unknown';
  crowdstrikeStatus?: 'Running' | 'Not Found' | 'Unknown';
  sccmStatus?: 'Healthy' | 'Unhealthy' | 'Unknown';

  // Script / file operations
  scriptFile?: File;
  availableFiles?: string[];
  installedPackages?: string[];
  runningPrograms?: string[];

  // Progress and results
  progress?: number;                   // 0–100
  updateResult?: UpdateResult;
  executionResult?: string;
  complianceChecks?: ComplianceResult;
}
```

### `ImagingDevice` (Image Monitor device record — from `src/types.ts`)

> **Field name corrections:** `macAddress` (not `mac`), `slot` (not `rackSlot`), `tech` (not
> `techName`), `startTime: number` (Unix timestamp, not Date), and most fields are **required**
> (not optional). The `id` field equals the MAC address string.

```typescript
interface ImagingDevice {
  id: string;          // MAC address used as unique ID
  hostname: string;
  macAddress: string;  // NOT mac — the field is macAddress
  ipAddress: string;   // Required (not optional)
  model: string;       // Required
  serialNumber: string; // Required
  assetTag: string;    // Required
  slot: string;        // Rack slot — e.g., "R2-S14" (NOT rackSlot)
  tech: string;        // Technician name (NOT techName)
  startTime: number;   // Unix timestamp (Date.now()) when imaging began
  status: ImagingStatus; // 'Imaging' | 'Checking Compliance' | 'Completed' | 'Failed'
  progress: number;    // 0–100
  duration: number;    // Total expected imaging time in seconds (for progress calc)
  complianceCheck?: ComplianceResult;  // Set after runComplianceChecks completes
}
```

### `DeploymentStatus` (all valid status strings)

```typescript
type DeploymentStatus =
  | 'Pending'
  | 'Pending Validation'
  | 'Waking Up'
  | 'Connecting'
  | 'Retrying...'
  | 'Validating'
  | 'Checking Info'
  | 'Checking BIOS'
  | 'Checking DCU'
  | 'Checking Windows'
  | 'Scan Complete'
  | 'Success'
  | 'Offline'
  | 'Failed'
  | 'Updating'
  | 'Updating BIOS'
  | 'Updating DCU'
  | 'Updating Windows'
  | 'Update Complete (Reboot Pending)'
  | 'Rebooting...'
  | 'Pending File'
  | 'Ready for Execution'
  | 'Executing Script'
  | 'Execution Complete'
  | 'Execution Failed'
  | 'Cancelling...'
  | 'Cancelled';
```

### `DeviceFormFactor` (device type values)

```typescript
type DeviceFormFactor =
  | 'desktop'
  | 'laptop'
  | 'laptop-14'
  | 'laptop-16'
  | 'detachable'
  | 'sff'       // Small Form Factor
  | 'micro'
  | 'tower'
  | 'wyse'      // Wyse Thin Client
  | 'vdi';      // VDI Client
```

### `ComplianceResult` (post-image check results)

```typescript
interface ComplianceResult {
  bitlocker: boolean;
  citrix: boolean;
  laps: boolean;
  sccm: boolean;
}
```

### `DeploymentRun` (archived run summary — from `src/types.ts`)

> **Corrections:** `id` is `number` (not UUID string), no `startTime` field, fields named
> `compliant`/`needsAction`/`failed` (not `successCount`/etc.), `offlineCount` is inside
> `failureCounts.offline` not a top-level field.

```typescript
interface DeploymentRun {
  id: number;          // Date.now() at archive time — NOT a UUID
  endTime: Date;       // No startTime field
  totalDevices: number;
  compliant: number;   // Devices with status in ['Success', 'Execution Complete']
  needsAction: number; // Devices with status in ['Scan Complete', 'Update Complete (Reboot Pending)',
                       //   'Ready for Execution', 'Pending File']
  failed: number;      // Sum of offline + cancelled + failed statuses combined
  successRate: number; // compliant / totalDevices * 100
  updatesNeededCounts?: {
    bios: number;
    dcu: number;
    windows: number;
  };
  failureCounts?: {
    offline: number;    // status === 'Offline'
    cancelled: number;  // status === 'Cancelled'
    failed: number;     // status in ['Failed', 'Execution Failed']
  };
}
```

### `LogEntry` (log stream entries — from `src/types.ts`)

> **Correction:** Logs are structured objects, not plain strings.

```typescript
interface LogEntry {
  timestamp: Date;
  message: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
}
```

### `DeploymentBatchSummary` (bulk operation result — from `src/types.ts`)

```typescript
interface DeploymentBatchSummary {
  id: number;                              // Date.now()
  operation: 'run' | 'install' | 'delete';
  targetName: string;                      // File name used in operation
  startedAt: Date;
  failuresByReason: Record<string, string[]>; // reason → [hostname, hostname, ...]
}
// Stored in runner.batchHistory — last 5 entries kept
```

---

## 8. CSV Import Pipeline

```
Operator selects file
       │
       ▼
parseDevicesFromCsv(file: File) called
       │
       ▼
Papa.parse() runs with:
  header: true           (first row = column names)
  skipEmptyLines: true   (ignore blank rows)
       │
       ▼
For each row:
  1. Extract hostname (case-insensitive header match: includes 'hostname')
  2. Extract mac (case-insensitive header match: includes 'mac')
  3. If hostname is missing → skip row, add error
  4. normalizeMacAddress(mac):
       - Strip separators (: - .)
       - Uppercase
       - Validate: only 0-9 A-F allowed, exactly 12 chars
       - If invalid → skip row, add error
  5. detectDeviceType(hostname):
       - Substring match: 'l14'/'lap14' → laptop-14
       - Substring match: 'l16'/'lap16' → laptop-16
       - Substring match: 'lap'/'lt'   → laptop
       - Substring match: 'sff'        → sff
       - Substring match: 'micro'      → micro
       - Substring match: 'tower'      → tower
       - Substring match: 'wyse'       → wyse
       - Substring match: 'vdi'        → vdi
       - Default: desktop
  6. Create Device object with status: 'Pending', id: Date.now() + index
       │
       ▼
Return { devices: Device[], errors: string[] }
       │
       ▼
Errors displayed in log panel
Valid devices dispatched to state.runner.devices
```

---

## 9. Credential Flow and Security Model

The credential flow is a three-dispatch chain. Credentials are stored at `state.credentials`
after `INITIALIZE_DEPLOYMENT` but are **not passed to the service layer** — the mock service
functions do not require or use them.

```
╔══════════════════════════════════════════════════════════════════════╗
║                    CREDENTIAL FLOW — 3-STEP CHAIN                   ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  STEP 1: Operator clicks "Start Scan"                                ║
║    → dispatch({ type: 'START_DEPLOYMENT_PROMPT' })                  ║
║    → Reducer checks: devices.length === 0 && !csvFile?              ║
║      If empty: logs error "Please select a device list..."          ║
║      If ok: sets ui.isCredentialModalOpen = true                    ║
║                                                                      ║
║  STEP 2: SecureCredentialModal renders                               ║
║    → Component-local state: { username: '', password: '' }          ║
║    → Operator enters credentials → clicks Confirm                   ║
║    → dispatch({ type: 'START_DEPLOYMENT_CONFIRMED',                 ║
║                 payload: { username, password } })                  ║
║                                                                      ║
║  STEP 3: effectRunner handles START_DEPLOYMENT_CONFIRMED             ║
║    → Closes credential modal                                        ║
║    → If csvFile: Papa.parse(csvFile) → parseDevicesFromCsv(results) ║
║    → dispatch({ type: 'INITIALIZE_DEPLOYMENT',                      ║
║                 payload: { devices, credentials } })                ║
║                                                                      ║
║  STEP 3b: INITIALIZE_DEPLOYMENT handled by both layers              ║
║    → Reducer: stores devices in runner.devices                      ║
║               stores credentials in state.credentials               ║
║               logs "Deployment process initiated" + username        ║
║               sets deploymentState: 'running'                       ║
║               resets isCancelled: false                             ║
║    → effectRunner: calls runDeploymentFlow(devices, settings,       ║
║                    onProgress, () => state.runner.isCancelled)      ║
║      NOTE: credentials are NOT passed to runDeploymentFlow          ║
║            The mock service does not use credentials at all         ║
║                                                                      ║
║  WHAT THIS MEANS FOR PRODUCTION:                                     ║
║  When integrating a real backend, add credential passing to the     ║
║  effectRunner → runDeploymentFlow call, or use the stored           ║
║  state.credentials to construct authenticated API requests.         ║
║                                                                      ║
║  WHAT THIS PREVENTS:                                                 ║
║  • Credentials visible as component props or in JSX                 ║
║  • Credentials persisted to localStorage (not passed to hooks)      ║
║  • Credentials appearing in most log entries (username logged       ║
║    once in INITIALIZE_DEPLOYMENT — by design for audit)             ║
║                                                                      ║
║  WHAT THIS DOES NOT PREVENT:                                         ║
║  • Credentials visible in React DevTools (state.credentials exists) ║
║  • Browser extension capture                                        ║
║  • Network interception over HTTP (use HTTPS in production)         ║
║                                                                      ║
║  REMOTE IN CREDENTIAL FLOW (separate path):                         ║
║  PROMPT_REMOTE_CREDENTIALS(deviceId)                                ║
║    → Opens RemoteCredentialModal with device hostname               ║
║    → REMOTE_IN_WITH_CREDENTIALS(credentials)                        ║
║    → buildRemoteDesktopFile(device, credentials) → .rdp download   ║
║    → CLOSE_REMOTE_CREDENTIAL_MODAL                                  ║
║  OR:                                                                 ║
║  REMOTE_IN_DEVICE(deviceId)                                         ║
║    → buildRemoteDesktopFile(device) — no credentials — .rdp download║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 10. RDP File Generation

```typescript
// services/deploymentService.ts:buildRemoteDesktopFile()

// Input: Device object + optional username
// Output: string (RDP file contents)

// Generated file format:
`full address:s:${device.ipAddress || device.hostname}
username:s:${username || ''}
screen mode id:i:2
use multimon:i:0
desktopwidth:i:1920
desktopheight:i:1080
session bpp:i:32
winposstr:s:0,3,0,0,800,600
compression:i:1
keyboardhook:i:2
audiocapturemode:i:0
videoplaybackmode:i:1
connection type:i:7
networkautodetect:i:1
bandwidthautodetect:i:1
displayconnectionbar:i:1
enableworkspacereconnect:i:0
disable wallpaper:i:0
allow font smoothing:i:0
allow desktop composition:i:0
disable full window drag:i:1
disable menu anims:i:1
disable themes:i:0
disable cursor setting:i:0
bitmapcachepersistenable:i:1
audiomode:i:0
redirectprinters:i:1
redirectcomports:i:0
redirectsmartcards:i:1
redirectclipboard:i:1
redirectposdevices:i:0
autoreconnection enabled:i:1
authentication level:i:2
prompt for credentials:i:0
negotiate security layer:i:1
remoteapplicationmode:i:0
alternate shell:s:
shell working directory:s:
gatewayhostname:s:
gatewayusagemethod:i:4
gatewaycredentialssource:i:4
gatewayprofileusagemethod:i:0
promptcredentialonce:i:0
use redirection server name:i:0
rdgiskdcproxy:i:0
kdcproxyname:s:`

// Downloaded as: ${device.hostname}.rdp
// Browser creates: URL.createObjectURL(new Blob([rdpContent], { type: 'text/plain' }))
// Anchor click triggers download
```

---

## 11. Backend Integration Guide

When you are ready to replace the mock service layer with real backend calls, follow this pattern
for each function in `services/deploymentService.ts`:

### Step 1: Define API endpoint contracts

```typescript
// Example: validateDevice → real API call
const API_BASE = process.env.VITE_API_URL || 'https://deployer-api.company.com';

// POST /api/device/scan
// Body: { hostname, mac, credentials: { username, password } }
// Response stream: server-sent events (SSE) or WebSocket
//   Event: { deviceId, statusUpdate: { status, biosVersion, ... } }
//   Event: { deviceId, log: "Checking BIOS..." }
//   Event: { deviceId, complete: true, finalStatus: 'Success' | 'Scan Complete' | 'Offline' }
```

### Step 2: Create an adapter module

```typescript
// services/deploymentServiceAdapter.ts
// (new file — does not modify deploymentService.ts)

export const validateDevice_API = async (
  device: Device,
  credentials: Credentials,
  settings: Settings,
  callbacks: { onDeviceUpdate, onLog }
) => {
  const eventSource = new EventSource(
    `${API_BASE}/api/device/${device.id}/scan?` +
    `hostname=${encodeURIComponent(device.hostname)}`
  );
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.statusUpdate) callbacks.onDeviceUpdate(device.id, data.statusUpdate);
    if (data.log) callbacks.onLog(data.log);
    if (data.complete) eventSource.close();
  };
};
```

### Step 3: Swap via environment flag

```typescript
// services/deploymentService.ts — add at top
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

export const validateDevice = USE_REAL_API
  ? validateDevice_API       // Real backend
  : validateDevice_MOCK;     // Current mock (renamed)
```

### Step 4: No reducer or component changes needed

The `AppContext.tsx` reducer dispatches actions regardless of which service implementation runs.
Components call the same exported functions. The swap is fully encapsulated in the service layer.

---

## 12. Key File Index

| File | Lines | Primary Responsibility |
|---|---|---|
| `App.tsx` | ~226 | Tab router; exports `TARGET_BIOS_VERSION`, `TARGET_DCU_VERSION`, `TARGET_WIN_VERSION` |
| `contexts/AppContext.tsx` | ~370 | `useReducer` state; all action types; initial state |
| `services/deploymentService.ts` | ~395 | All deployment logic: scan, update, compliance, archive, RDP |
| `services/powershellScript.ts` | 1 | **Empty file** — the AutoTag PowerShell script is in `components/ImagingScriptViewer.tsx` as an inline string constant |
| `src/types.ts` | ~150 | All TypeScript interfaces |
| `utils/helpers.ts` | ~30 | `normalizeMacAddress`, `detectDeviceType`, `sleep` |
| `components/ImageMonitor.tsx` | ~200 | Image Monitor tab — polling, transfer |
| `components/ImageRack.tsx` | ~379 | Rack grid, device cards, compliance icons |
| `components/DeviceStatusTable.tsx` | ~344 | Device rows, compliance checklists, actions |
| `components/BulkActions.tsx` | ~94 | Bulk action buttons + file picker |
| `components/DeploymentHistory.tsx` | ~213 | Run archive list, CSV export, charts |
| `components/SecureCredentialModal.tsx` | ~60 | Session-only credential capture |
| `components/RemoteDesktop.tsx` | ~100 | RDP file generation UI |
| `hooks/useLocalStorage.ts` | ~30 | Local storage persistence hook |
