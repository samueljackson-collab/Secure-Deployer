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

### State Shape

```typescript
// contexts/AppContext.tsx — AppState interface

interface AppState {
  runner: {
    devices: Device[];              // Active deployment queue
    logs: string[];                 // Real-time log entries (all phases)
    deploymentState:                // Overall run state
      'idle' | 'running' | 'complete';
    selectedDeviceIds: Set<number>; // Checkboxes in device table
    history: DeploymentRun[];       // Last 10 archived runs
    settings: {
      maxRetries: number;           // Default: 3
      retryDelay: number;           // Default: 2 (seconds)
      autoRebootEnabled: boolean;   // Default: false
    };
    batchHistory: BatchSummary[];   // Batch operation summaries
  };
  monitor: {
    devices: ImagingDevice[];       // Devices in imaging pipeline
  };
  ui: {
    activeTab: TabId;               // 'monitor'|'runner'|'build'|'script'|'remote'
    csvFile: File | null;           // Uploaded CSV file
    isCredentialModalOpen: boolean;
    isComplianceModalOpen: boolean;
    selectedComplianceDeviceId: number | null;
    isAllComplianceModalOpen: boolean;
    isPassedComplianceModalOpen: boolean;
    isRescanConfirmationModalOpen: boolean;
  };
}
```

### Initial State (Default Values)

```typescript
// contexts/AppContext.tsx — initialState
const initialState: AppState = {
  runner: {
    devices: [],
    logs: [],
    deploymentState: 'idle',
    selectedDeviceIds: new Set(),
    history: [],
    settings: {
      maxRetries: 3,
      retryDelay: 2,
      autoRebootEnabled: false,
    },
    batchHistory: [],
  },
  monitor: {
    devices: [],
  },
  ui: {
    activeTab: 'monitor',
    csvFile: null,
    isCredentialModalOpen: false,
    isComplianceModalOpen: false,
    selectedComplianceDeviceId: null,
    isAllComplianceModalOpen: false,
    isPassedComplianceModalOpen: false,
    isRescanConfirmationModalOpen: false,
  },
};
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

### Key Action Types

| Action | Type | Triggered by | What it does |
|---|---|---|---|
| `START_DEPLOYMENT_CONFIRMED` | Async | Credential modal confirm | Starts `runDeploymentFlow`; passes credentials |
| `VALIDATE_DEVICES` | Async | Re-validate button | Calls `validateDevices` for selection or all |
| `BULK_UPDATE` | Async | Bulk Update button | Runs `updateDevice` for all selected via `Promise.all` |
| `BULK_DEPLOY_OPERATION` | Async | Run/Install/Delete file button | Calls `performDeploymentOperation` for selected |
| `EXECUTE_SCRIPT` | Async | Execute button | Calls `executeScript` per selected device |
| `ARCHIVE_RUN` | Sync | Archive action | Calls `generateRunArchive`; prepends to `history.slice(0,10)` |
| `UPDATE_DEVICE_STATUS` | Sync | Dispatched by service callbacks | Updates a single device's status field in `devices[]` |
| `ADD_LOG` | Sync | Dispatched by service callbacks | Appends a log entry to `logs[]` |
| `TRANSFER_IMAGING_DEVICES_TO_RUNNER` | Sync | Transfer button in Image Monitor | Converts `ImagingDevice[]` to `Device[]` via `transformImagingToRunnerDevices` |
| `ADD_IMAGING_DEVICE` | Sync | AutoTag polling | Adds a new device to `monitor.devices` |
| `UPDATE_IMAGING_DEVICE` | Sync | Polling update | Updates progress, status, compliance result |
| `REMOVE_IMAGING_DEVICE` | Sync | Remove button in rack | Removes device from `monitor.devices` |
| `REMOVE_DEVICES` | Sync | Bulk Remove button | Filters out selected device IDs from `runner.devices` |
| `CANCEL_DEPLOYMENT` | Sync | Cancel button | Sets cancellation flag; scan loop checks this on each iteration |
| `SET_ACTIVE_TAB` | Sync | Tab click | Updates `ui.activeTab` |
| `OPEN_CREDENTIAL_MODAL` | Sync | Start Scan button | Sets `isCredentialModalOpen: true` |
| `UPDATE_SETTINGS` | Sync | Settings panel inputs | Updates `runner.settings` fields |
| `TOGGLE_DEVICE_SELECTION` | Sync | Device row checkbox | Adds/removes device ID from `selectedDeviceIds` Set |

---

## 4. Service Layer Design

`services/deploymentService.ts` is the boundary between the UI and backend behavior. Every
function here is designed to be **swappable** — replace the mock implementation with real API
calls without changing the function signature or the components that call it.

### Function Contracts

```typescript
// ─────────────────────────────────────────────────────────────────────
// PARSING
// ─────────────────────────────────────────────────────────────────────

parseDevicesFromCsv(file: File): Promise<{
  devices: Device[];
  errors: string[];
}>
// Uses papaparse to parse CSV; validates Hostname + MAC per row;
// normalizes MAC via normalizeMacAddress(); detects device type via detectDeviceType()


// ─────────────────────────────────────────────────────────────────────
// IMAGING ↔ RUNNER BRIDGE
// ─────────────────────────────────────────────────────────────────────

transformImagingToRunnerDevices(imagingDevices: ImagingDevice[]): Device[]
// Converts ImagingDevice objects (monitor state) to Device objects (runner state)
// Preserves: hostname, MAC, serial, model, IP, rack slot, device type


// ─────────────────────────────────────────────────────────────────────
// POST-IMAGE COMPLIANCE
// ─────────────────────────────────────────────────────────────────────

runComplianceChecks(device: ImagingDevice): Promise<ComplianceResult>
// Checks: BitLocker volume | Citrix Workspace | LAPS | SCCM client + service
// Returns: ComplianceResult { bitlocker, citrix, laps, sccm } — all boolean
// Called by Image Monitor after imaging completes


// ─────────────────────────────────────────────────────────────────────
// SCANNING
// ─────────────────────────────────────────────────────────────────────

runDeploymentFlow(
  devices: Device[],
  credentials: Credentials,
  settings: Settings,
  callbacks: {
    onDeviceUpdate: (id: number, updates: Partial<Device>) => void;
    onLog: (message: string) => void;
    isCancelled: () => boolean;
  }
): Promise<void>
// Sequential for..of loop over all devices
// Calls validateDevice per device; respects isCancelled() check each iteration

validateDevice(
  device: Device,
  credentials: Credentials,
  settings: Settings,
  callbacks: { onDeviceUpdate, onLog }
): Promise<void>
// Per-device scan:
//   WoL → connect (retry loop) → gather info → BIOS check → DCU check → Windows check
//   → encryption / CrowdStrike / SCCM checks
//   → sets terminal status: Success | Scan Complete | Offline

validateDevices(
  devices: Device[],        // subset or all
  credentials: Credentials,
  settings: Settings,
  callbacks
): Promise<void>
// Same as runDeploymentFlow but for a specific selection (re-validation use case)


// ─────────────────────────────────────────────────────────────────────
// UPDATES
// ─────────────────────────────────────────────────────────────────────

updateDevice(
  device: Device,
  settings: Settings,
  callbacks: { onDeviceUpdate, onLog }
): Promise<void>
// Runs: BIOS update → DCU update → Windows update (skips if already current)
// ~15% simulated failure rate per component update
// Sets rebootRequired flag; auto-reboots if settings.autoRebootEnabled


// ─────────────────────────────────────────────────────────────────────
// SCRIPTS AND FILE OPERATIONS
// ─────────────────────────────────────────────────────────────────────

executeScript(
  device: Device,
  callbacks: { onDeviceUpdate, onLog }
): Promise<void>
// Simulates executing device.scriptFile
// Probabilistic success/failure; updates status to Execution Complete | Execution Failed

performDeploymentOperation(
  device: Device,
  operation: 'run' | 'install' | 'delete',
  file: File,
  callbacks: { onDeviceUpdate, onLog }
): Promise<void>
// Run: adds to device.runningPrograms[]
// Install: adds to device.installedPackages[]
// Delete: removes from runningPrograms[] or installedPackages[]


// ─────────────────────────────────────────────────────────────────────
// ARCHIVING AND HISTORY
// ─────────────────────────────────────────────────────────────────────

generateRunArchive(
  devices: Device[],
  startTime: Date,
  endTime: Date
): DeploymentRun
// Aggregates: totalDevices, successCount, needsActionCount, offlineCount, failedCount
// Calculates successRate (percentage)
// Maps failure statuses to failure categories for analytics charts


// ─────────────────────────────────────────────────────────────────────
// REMOTE DESKTOP
// ─────────────────────────────────────────────────────────────────────

buildRemoteDesktopFile(
  device: Device,
  username?: string
): string
// Returns an RDP file string formatted for Microsoft Remote Desktop
// Fields: full address (hostname or IP), username pre-fill, color depth, resolution
// Called by RemoteDesktop.tsx; downloaded as Blob in browser
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

```
                         ┌──────────┐
                         │ Pending  │
                         └────┬─────┘
                              │ scan starts
                              ▼
                    ┌──────────────────┐
                    │ Pending          │
                    │ Validation       │
                    └────────┬─────────┘
                             │ WoL sent
                             ▼
                    ┌──────────────────┐
                    │   Waking Up      │
                    └────────┬─────────┘
                             │ WoL sent; attempting connection
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

### `ImagingDevice` (Image Monitor device record)

```typescript
interface ImagingDevice {
  id: string;                         // MAC address used as ID
  hostname: string;
  mac: string;
  ipAddress?: string;
  serialNumber?: string;
  model?: string;
  assetTag?: string;
  rackSlot: string;                   // e.g., "R2-S14"
  techName: string;                   // Entered by tech via AutoTag
  status: ImagingStatus;              // Imaging | Checking Compliance | Completed | Failed
  progress: number;                   // 0–100
  deviceType: DeviceFormFactor;
  complianceResult?: ComplianceResult;
  timestamp: Date;
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

### `DeploymentRun` (archived run summary)

```typescript
interface DeploymentRun {
  id: string;                         // UUID
  startTime: Date;
  endTime: Date;
  totalDevices: number;
  successCount: number;
  needsActionCount: number;
  offlineCount: number;
  failedCount: number;
  successRate: number;                // 0–100 percentage
  deviceResults: DeviceRunResult[];   // Per-device outcome
  failureCategories: Record<string, number>;  // Failure type → count
}
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

```
╔══════════════════════════════════════════════════════════════════════╗
║                    CREDENTIAL SECURITY MODEL                         ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  1. Operator clicks "Start Scan"                                     ║
║     → dispatch({ type: 'OPEN_CREDENTIAL_MODAL' })                   ║
║     → ui.isCredentialModalOpen = true                               ║
║                                                                      ║
║  2. SecureCredentialModal renders                                    ║
║     → Component-local state: { username: '', password: '' }         ║
║     → Input fields: type="password" (masked)                        ║
║     → No autocomplete (autoComplete="off")                          ║
║                                                                      ║
║  3. Operator enters credentials and clicks Confirm                  ║
║     → dispatch({ type: 'START_DEPLOYMENT_CONFIRMED',               ║
║                   payload: { username, password } })                ║
║     → Modal closes; credentials in payload only                     ║
║                                                                      ║
║  4. Reducer passes credentials to runDeploymentFlow()               ║
║     → Credentials exist only in function call stack                 ║
║     → Never written to state.runner or any persistent store         ║
║                                                                      ║
║  5. Scan completes; credentials are garbage collected               ║
║     → No session token, no localStorage entry, no cookie            ║
║                                                                      ║
║  WHAT THIS PREVENTS:                                                 ║
║  • Credentials visible in React DevTools state inspector            ║
║  • Credentials persisted across browser sessions                    ║
║  • Credentials logged in application logs                           ║
║                                                                      ║
║  WHAT THIS DOES NOT PREVENT:                                         ║
║  • Credentials captured by a compromised browser extension           ║
║  • Network interception if app is served over HTTP (use HTTPS)      ║
║  • Memory forensics (mitigate by ensuring HTTPS + short sessions)   ║
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
| `services/powershellScript.ts` | ~120 | AutoTag PowerShell script string constant |
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
