# Secure Deployment Runner — Technical Architecture

> **Audience:** Platform engineers and contributors.
> **Purpose:** Deep-dive reference for the state machine, service layer, data flow, type contracts, and component dependencies.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React UI (Browser / PWA)               │
│                                                         │
│  ┌──────────────┐   ┌─────────────────────────────────┐ │
│  │  App.tsx     │   │  Component Tree                 │ │
│  │  (tab router)│   │  ImageMonitor · ImageRack       │ │
│  └──────┬───────┘   │  DeviceStatusTable · BulkActions│ │
│         │           │  LogViewer · DeploymentHistory  │ │
│         ▼           │  RemoteDesktop · Modals         │ │
│  ┌──────────────┐   └──────────────────┬──────────────┘ │
│  │  AppContext  │◄─────────────────────┘                │
│  │  useReducer  │   (dispatch actions)                   │
│  └──────┬───────┘                                       │
│         │  (calls service functions)                     │
│         ▼                                               │
│  ┌──────────────┐                                       │
│  │ Deployment   │   Mock service layer.                 │
│  │ Service      │   Production: replace with API        │
│  │              │   adapter targeting real backend.     │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

---

## State Machine

All application state is owned by `contexts/AppContext.tsx` via a single `useReducer`. State is never mutated outside the reducer.

### Device Lifecycle (Deployment Runner)

```
Pending
  └─► Pending Validation
        └─► Waking Up
              └─► Connecting
                    ├─► Retrying... (on connection failure, until max retries)
                    └─► Checking Info
                          └─► Checking BIOS
                                └─► Checking DCU
                                      └─► Checking Windows
                                            ├─► Success          (all checks pass)
                                            ├─► Scan Complete    (one or more checks failed)
                                            └─► Offline          (retries exhausted)

Scan Complete
  └─► Updating
        ├─► Updating BIOS
        ├─► Updating DCU
        └─► Updating Windows
              └─► Update Complete (Reboot Pending)
                    └─► Rebooting...
                          ├─► Success
                          └─► Failed

Pending File
  └─► Ready for Execution
        └─► Executing Script
              ├─► Execution Complete
              └─► Execution Failed
```

### Imaging Device Lifecycle (Image Monitor)

```
Imaging (0–100% progress)
  └─► Checking Compliance
        └─► Completed ✅ or Completed with flags ⚠️
              └─► [Transfer Selected] → Device appears in Deployment Runner as Pending
```

---

## Action Type Reference

All reducer actions are defined in `contexts/AppContext.tsx`. Key actions:

| Action | Payload | Effect |
|---|---|---|
| `ADD_DEVICES` | `Device[]` | Appends devices to runner queue |
| `UPDATE_DEVICE` | `Device` | Replaces device by `id` in runner queue |
| `REMOVE_DEVICE` | `number` (id) | Removes device from runner queue |
| `START_DEPLOYMENT_CONFIRMED` | `{ credentials }` | Sets credentials, triggers scan via `runDeploymentFlow` |
| `DEPLOYMENT_FINISHED` | — | Clears running flag, resets credentials |
| `CANCEL_DEPLOYMENT` | — | Sets cancellation flag; scan loop checks this each iteration |
| `ARCHIVE_RUN` | `DeploymentRun` | Prepends run to history (max 10); evicts oldest |
| `ADD_LOG` | `LogEntry` | Appends entry to log stream |
| `ADD_IMAGING_DEVICE` | `ImagingDevice` | Adds device to monitor queue |
| `UPDATE_IMAGING_DEVICE` | `ImagingDevice` | Updates device in monitor queue |
| `REMOVE_IMAGING_DEVICE` | `string` (id) | Removes device from monitor queue |
| `TRANSFER_IMAGING_DEVICES_TO_RUNNER` | `string[]` (ids) | Converts imaging devices to runner devices via `transformImagingToRunnerDevices` |
| `BULK_UPDATE` | `{ deviceIds, ... }` | Runs `updateDevice` for each selected device |
| `BULK_EXECUTE` | `{ deviceIds, file }` | Runs `executeScript` for each selected device |
| `RESCAN_ALL_DEVICES_CONFIRMED` | — | Re-runs `validateDevices` on all devices |

---

## Service Layer Contract

All functions in `services/deploymentService.ts` are designed to match the shape a real backend would expose. To integrate a real backend, replace each function body with an API call while keeping the signature identical.

### Function Reference

| Function | Signature | Simulates |
|---|---|---|
| `parseDevicesFromCsv` | `(csvText: string) → { devices: Device[], errors: string[] }` | CSV parsing with row-level validation |
| `runDeploymentFlow` | `(devices, settings, dispatch, isCancelled) → Promise<void>` | Full sequential scan run |
| `validateDevice` | `(device, settings, onProgress, isCancelled) → Promise<Device>` | Per-device WoL → connect → validate |
| `validateDevices` | `(devices, settings, onProgress, isCancelled) → Promise<void>` | Re-validation sweep |
| `updateDevice` | `(device, settings, onProgress, isCancelled) → Promise<void>` | BIOS → DCU → Windows update |
| `executeScript` | `(device, file, onProgress) → Promise<Device>` | Post-image script execution |
| `performDeploymentOperation` | `(device, type, file, onProgress) → Promise<Device>` | Run / Install / Delete file op |
| `runComplianceChecks` | `(device: ImagingDevice) → Promise<ComplianceResult>` | BitLocker, Citrix, LAPS, SCCM checks |
| `transformImagingToRunnerDevices` | `(devices: ImagingDevice[]) → Device[]` | Monitor → Runner conversion |
| `generateRunArchive` | `(devices, startTime, endTime) → DeploymentRun` | End-of-run summary aggregation |
| `buildRemoteDesktopFile` | `(device, credentials?) → string` | RDP file string builder |

### Mock Behavior Parameters

- **Offline probability:** ~15% per device on connection attempt (simulates network instability)
- **Update failure rate:** ~15% per update step (simulates firmware/OS update failures)
- **Script execution failure rate:** ~10% (simulates script errors)
- **Delays:** `sleep()` calls simulate real-world network and operation latency

---

## Type Contract Reference

All types are defined in `src/types.ts` and re-exported via the root `types.ts` barrel.

### Core Types

```typescript
// Device record in the Deployment Runner queue
interface Device {
    id: number;
    hostname: string;
    mac: string;
    status: DeploymentStatus;
    deviceType: DeviceFormFactor;
    biosVersion?: string;
    dcuVersion?: string;
    winVersion?: string;
    encryptionStatus?: 'Enabled' | 'Disabled' | 'Unknown';
    crowdstrikeStatus?: 'Running' | 'Not Found' | 'Unknown';
    sccmStatus?: 'Healthy' | 'Unhealthy' | 'Unknown';
    // ... (see src/types.ts for full definition)
}

// Imaging device in the Image Monitor queue
interface ImagingDevice {
    id: string;
    hostname: string;
    mac: string;
    rackSlot: number;
    techName: string;
    model: string;
    serialNumber: string;
    ipAddress: string;
    imagingStatus: ImagingStatus;
    progress: number;
    complianceResult?: ComplianceResult;
}

// Archived run summary
interface DeploymentRun {
    id: string;
    startTime: string;
    endTime: string;
    totalDevices: number;
    successCount: number;
    failedCount: number;
    offlineCount: number;
    devices: Device[];
}

// Session credentials (never persisted)
interface Credentials {
    username: string;
    password: string;
}
```

### Compliance Target Versions

Defined in `App.tsx` (exported) and mirrored in `src/constants.ts`:

```typescript
export const TARGET_BIOS_VERSION = 'A24';
export const TARGET_DCU_VERSION  = '5.1.0';
export const TARGET_WIN_VERSION  = '23H2';
```

---

## Component Dependency Map

```
App.tsx
├── components/Header.tsx
├── components/ImageMonitor.tsx
│   ├── components/ImageRack.tsx
│   │   └── components/ComplianceDetailsModal.tsx
│   └── components/ImageTrends.tsx
├── components/DeviceStatusTable.tsx
│   ├── components/DeviceIcon.tsx
│   ├── components/DeviceContextMenu.tsx
│   └── components/SystemInfoModal.tsx
├── components/BulkActions.tsx
├── components/LogViewer.tsx
├── components/DeploymentProgress.tsx
├── components/DeploymentHistory.tsx
│   └── components/DeploymentAnalytics.tsx
├── components/ImagingScriptViewer.tsx
│   └── services/powershellScript.ts  (AUTOTAG_WINPE_SCRIPT constant)
├── components/PxeTaskSequence.tsx
├── components/RemoteDesktop.tsx
│   └── components/RemoteCredentialModal.tsx
├── components/AnalyticsTab.tsx
├── components/DeploymentTemplates.tsx
├── components/PackageManager.tsx
├── components/StepCard.tsx
├── components/BuildOutput.tsx
├── components/SecureCredentialModal.tsx
│   └── components/CredentialsForm.tsx
├── components/AllComplianceDetailsModal.tsx
├── components/PassedComplianceDetailsModal.tsx
└── components/RescanConfirmationModal.tsx

Shared:
├── contexts/AppContext.tsx  (global state — all components read/dispatch via useAppContext)
├── services/deploymentService.ts  (called by AppContext action handlers)
├── utils/helpers.ts  (normalizeMacAddress, detectDeviceType, sleep)
├── utils/security.ts  (validateWindowsPath, generatePKCEPair, generateState)
├── hooks/useLocalStorage.ts  (persists runner settings between sessions)
└── types.ts → src/types.ts  (all TypeScript interfaces)
```

---

## Backend Integration Path

To replace the mock service with a real API:

1. Create `services/apiClient.ts` with your HTTP client setup (fetch, axios, etc.).
2. For each function in `services/deploymentService.ts`, create a matching function in an `services/apiDeploymentService.ts` that calls your backend.
3. In `contexts/AppContext.tsx`, replace the import:
   ```typescript
   // Before:
   import * as api from '../services/deploymentService';
   // After:
   import * as api from '../services/apiDeploymentService';
   ```
4. The rest of the app requires no changes — all components interact only with `AppContext`, not the service layer directly.

---

## Related Documents

- [End-to-End Process SOP](./PROCESS.md)
- [Capacity & Scalability Guide](./CAPACITY.md)
- [Automation Tiers & PXE Guide](./AUTOMATION.md)
