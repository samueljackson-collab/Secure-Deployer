# Architecture

> System design, component relationships, data flow, and technology decisions.

---

## Table of Contents

- [System Overview](#system-overview)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Security Architecture](#security-architecture)
- [State Management](#state-management)
- [Technology Stack Decisions](#technology-stack-decisions)
- [File Structure](#file-structure)

---

## System Overview

Secure Deployment Runner is a three-layer system:

```
┌──────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                        │
│                                                                  │
│  React 19 + TypeScript + Tailwind CSS                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  App.tsx (main orchestrator)                              │   │
│  │  ┌─────────────────┐  ┌───────────────────────────────┐  │   │
│  │  │  Image Monitor   │  │  Deployment Runner            │  │   │
│  │  │  (tab view)      │  │  (tab view)                   │  │   │
│  │  └─────────────────┘  └───────────────────────────────┘  │   │
│  │  ┌─────────────────┐  ┌───────────────────────────────┐  │   │
│  │  │ DeviceScopeGuard │  │  ScriptAnalysisModal          │  │   │
│  │  │  (modal overlay) │  │  (modal overlay)              │  │   │
│  │  └─────────────────┘  └───────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│                        SERVICE LAYER                             │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────┐     │
│  │ scriptSafetyAnalyzer  │  │  PapaParse (CSV parsing)     │     │
│  │ (60+ regex rules)    │  │                              │     │
│  └──────────────────────┘  └──────────────────────────────┘     │
├──────────────────────────────────────────────────────────────────┤
│                       PLATFORM LAYER                             │
│                                                                  │
│  Electron 35 (main process: electron/main.cjs)                  │
│  - Sandbox: true                                                 │
│  - Context Isolation: true                                       │
│  - Node Integration: false                                       │
│  - CSP enforcement                                               │
│  - Certificate validation                                        │
│  - Single-instance lock                                          │
└──────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

**Single-page application in Electron** was chosen because:

1. **Offline operation** — No server required. The entire application runs in the browser process within Electron's sandbox.
2. **USB portability** — Everything is bundled into a single `.exe` with no installation.
3. **Security isolation** — Electron's sandbox, context isolation, and CSP provide defense-in-depth without requiring a backend server.
4. **Simple deployment** — Hospital IT teams copy one file to a USB drive. No services to configure, no databases to set up.

**Why not a client-server architecture?**

A server component would require:
- Installation and configuration on a hospital machine
- Open network ports (security risk)
- Service management (start/stop/restart)
- Database administration

None of this complexity is justified for a deployment tool that one operator runs from a USB drive.

---

## Component Architecture

### Component Hierarchy

```
App.tsx (root)
├── Header.tsx
│   └── WoL controls, deployment start button
├── [View Toggle: Image Monitor | Deployment Runner]
│
├── ImageMonitor.tsx (if imaging view)
│   ├── Drag-and-drop metadata ingestion
│   ├── Device cards with progress bars
│   └── Promote-to-deployment workflow
│
├── StepCard.tsx × 3 (if deployment view)
│   ├── CSV Upload step
│   ├── Script Upload step (triggers analyzer)
│   └── Credentials step
│
├── DeviceStatusTable.tsx (if deployment view)
│   ├── DeviceIcon.tsx (per device, 10 form factors)
│   └── StatusBadge (per device)
│
├── BulkActions.tsx (if deployment view)
│   └── Update Selected / Reboot Selected buttons
│
├── DeploymentProgress.tsx (during deployment)
├── LogViewer.tsx (always visible)
├── DeploymentHistory.tsx (completed runs)
│
├── DeviceScopeGuard.tsx (modal, on demand)
│   └── Device checklist + count confirmation + safety toggles
│
├── ScriptAnalysisModal.tsx (modal, on demand)
│   └── Findings display with severity badges
│
├── SecureCredentialModal.tsx (modal, on demand)
│   └── Username + password input
│
└── CredentialsForm.tsx (inline credential display)
```

### Component Responsibilities

| Component | File | Purpose | Key Props |
|-----------|------|---------|-----------|
| **App** | `App.tsx` | Root orchestrator. Manages all state, deployment flow, view routing. | — |
| **Header** | `Header.tsx` | Top bar with WoL, start scan, system status. | `onStartDeploy`, `credentials`, `deviceCount` |
| **ImageMonitor** | `ImageMonitor.tsx` | SCCM/MDT imaging live monitor with metadata ingestion. | `onPromoteDevices`, `onLog` |
| **DeviceStatusTable** | `DeviceStatusTable.tsx` | Device list with checkboxes, status badges, detail panels. | `devices`, `selectedDeviceIds`, `onUpdateDevice` |
| **DeviceIcon** | `DeviceIcon.tsx` | SVG icon per form factor (10 types). | `type: DeviceFormFactor` |
| **DeviceScopeGuard** | `DeviceScopeGuard.tsx` | Modal gate requiring per-device verification before bulk ops. | `devices`, `selectedDeviceIds`, `onVerificationComplete` |
| **ScriptAnalysisModal** | `ScriptAnalysisModal.tsx` | Displays script safety analysis results. | `result: ScriptSafetyResult`, `isOpen` |
| **BulkActions** | `BulkActions.tsx` | Toolbar for update-selected, reboot-selected bulk actions. | `selectedCount`, `onBulkUpdate`, `onBulkReboot` |
| **StepCard** | `StepCard.tsx` | Configuration step cards (CSV, script, credentials). | `title`, `status`, `onAction` |
| **DeploymentProgress** | `DeploymentProgress.tsx` | Overall progress bar during deployment. | `current`, `total`, `phase` |
| **LogViewer** | `LogViewer.tsx` | Scrollable log display with severity colors. | `logs: LogEntry[]` |
| **DeploymentHistory** | `DeploymentHistory.tsx` | Historical deployment run summaries. | `runs: DeploymentRun[]` |

---

## Data Flow

### 1. CSV Upload Flow

```
User selects CSV file
    │
    ▼
PapaParse.parse() with header: true
    │
    ▼
Auto-detect hostname + MAC columns (case-insensitive matching)
    │
    ▼
For each row:
    ├── Validate MAC address (normalize → uppercase → 12 hex check)
    ├── Detect device form factor (detectDeviceType → hostname pattern)
    ├── Assign numeric ID
    └── Create Device object with status: 'Pending'
    │
    ▼
setDevices([...parsedDevices])
    │
    ▼
DeviceStatusTable renders with DeviceIcon per device
```

### 2. Script Safety Analysis Flow

```
User uploads .bat/.cmd file
    │
    ▼
FileReader reads script content as text
    │
    ▼
analyzeScript(scriptContent, allowedHostnames)
    │
    ├── Split into lines
    ├── For each non-comment, non-empty line:
    │   ├── Check against BLOCKED_PATTERNS (28 rules)
    │   ├── Check against DANGER_PATTERNS (26 rules)
    │   ├── Check against WARNING_PATTERNS (18 rules)
    │   ├── detectSubnetTargeting() — CIDR, IP ranges, wildcards, broadcasts
    │   └── detectWildcardTargeting() — AD queries, pipelines
    │
    ├── extractReferencedHostnames() — UNC paths, -ComputerName, /node:, psexec
    ├── Compare against allowedHostnames → flag scope violations
    │
    └── Return ScriptSafetyResult {
            isSafe: boolean,
            riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
            findings: ScriptFinding[],
            blockedPatterns: string[],
            scopeViolations: string[]
        }
    │
    ▼
If !isSafe → Script blocked, ScriptAnalysisModal shown
If isSafe → Script approved for deployment
```

### 3. Deployment Flow

```
User clicks "Start Scan & Deploy"
    │
    ▼
Phase 1: Wake-on-LAN
    ├── Send magic packet per device (targeted by MAC address)
    └── Wait 30 seconds for devices to boot
    │
    ▼
Phase 2: Connect
    ├── Per-device connection attempt
    ├── Retry up to maxRetries times with retryDelay between
    └── Mark device as Connected or Offline
    │
    ▼
Phase 3: System Scan
    ├── Query BIOS version (compare against TARGET_BIOS_VERSION)
    ├── Query DCU version (compare against TARGET_DCU_VERSION)
    ├── Query Windows version (compare against TARGET_WIN_VERSION)
    ├── Collect: IP, model, serial, RAM, disk, encryption status
    └── Mark device as 'Scan Complete'
    │
    ▼
Phase 4: Update (user-initiated)
    ├── User selects devices → clicks "Update Selected"
    ├── DeviceScopeGuard opens → per-device verification
    ├── On confirmation → update proceeds ONLY on verified devices
    └── Sequential component updates: BIOS → DCU → Windows
    │
    ▼
Phase 5: Reboot (if needed)
    └── Remote reboot command sent to individual devices
```

### 4. Imaging Metadata Flow

```
SCCM/MDT Task Sequence runs on target device
    │
    ▼
Gather-DeviceMetadata.bat (orchestrator)
    ├── Detect USB drive
    ├── Validate PowerShell
    └── Call Gather-DeviceMetadata.ps1
        │
        ▼
    PowerShell collects via WMI/CIM:
        ├── Win32_ComputerSystem (hostname, manufacturer, model, RAM)
        ├── Win32_BIOS (version, date, serial)
        ├── Win32_NetworkAdapterConfiguration (MAC, IP, DNS, gateway)
        ├── Win32_DiskDrive + Win32_LogicalDisk (size, free space)
        ├── Win32_OperatingSystem (version, build)
        ├── Win32_Tpm (TPM status)
        ├── Confirm-SecureBootUEFI (Secure Boot)
        └── Task sequence environment variables
        │
        ▼
    Output: JSON file conforming to ImagingMetadata interface
        ├── Local: %TEMP%\DeviceMetadata\<HOSTNAME>.json
        └── Network: \\DEPLOYSERVER\ImageMetadata$\<HOSTNAME>.json
    │
    ▼
User loads JSON in Image Monitor (drag-and-drop or file picker)
    │
    ▼
ImageMonitor.tsx parses JSON → creates monitoring entries
    │
    ▼
User promotes completed devices → App.tsx converts to Device objects
    │
    ▼
Devices appear in Deployment Runner with metadata pre-populated
```

### 5. Credential Lifecycle

```
User enters credentials in SecureCredentialModal
    │
    ▼
Stored in React state (in-memory only)
    │
    ▼
Session timeout timer starts (30 minutes)
    │
    ├── On mouse/keyboard activity → timer resets
    ├── On 30 min inactivity → credentials wiped from state
    └── On app close → React state destroyed (nothing on disk)
    │
    ▼
When used in log messages:
    sanitizeLogMessage() replaces password/token/secret with [REDACTED]
```

---

## Security Architecture

### Electron Process Model

```
┌─────────────────────────────────────────────┐
│              Main Process                    │
│              electron/main.cjs               │
│                                             │
│  - Single instance lock                      │
│  - Certificate validation                    │
│  - CSP injection via onHeadersReceived       │
│  - Navigation blocking                       │
│  - Permission blocking                       │
│  - Storage clearing on startup               │
│  - Hardware acceleration disabled            │
│                                             │
│  Creates BrowserWindow with:                 │
│    sandbox: true                             │
│    contextIsolation: true                    │
│    nodeIntegration: false                    │
│    webviewTag: false                         │
│    webSecurity: true                         │
│    allowRunningInsecureContent: false         │
└──────────────────┬──────────────────────────┘
                   │
                   │ IPC (if needed)
                   │
┌──────────────────▼──────────────────────────┐
│            Renderer Process                  │
│            (sandboxed)                       │
│                                             │
│  React Application                           │
│  - No Node.js APIs available                 │
│  - No require() / process / __dirname        │
│  - CSP enforced by main process              │
│  - Cannot navigate away from app             │
│  - Cannot open new windows                   │
│  - Cannot request permissions (geolocation,  │
│    camera, microphone, etc.)                 │
└─────────────────────────────────────────────┘
```

### Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
```

**Why `'unsafe-inline'` for styles?** Tailwind CSS generates inline styles for dynamic classes (e.g., `translate-x-6` on toggle switches). Removing `'unsafe-inline'` would break the UI. This is an acceptable trade-off because:
- Scripts are not inline-allowed (`script-src 'self'` only)
- No user input is ever rendered as HTML
- All content is locally generated

---

## State Management

### Why React useState (Not Redux/Zustand/etc.)?

The application uses React's built-in `useState` and `useCallback` hooks exclusively. No external state management library is used because:

1. **Single component tree** — All state lives in `App.tsx` and is passed down via props. There is no deeply nested state that would benefit from a context or store.
2. **No persistent state** — Nothing is saved to disk. On close, all state is gone. A state management library's persistence features would be wasted.
3. **Security** — Fewer dependencies mean fewer supply chain risks. Every package added to `node_modules` is a potential attack vector.
4. **Simplicity** — The application has a clear unidirectional data flow. Adding Redux would increase complexity without solving a real problem.

### Key State Variables (App.tsx)

| State Variable | Type | Purpose |
|---------------|------|---------|
| `devices` | `Device[]` | The fleet device list |
| `selectedDeviceIds` | `Set<number>` | Currently selected devices |
| `credentials` | `Credentials \| null` | In-memory auth credentials |
| `deploymentState` | `DeploymentState` | Current deployment phase |
| `logs` | `LogEntry[]` | Operation log messages |
| `activeView` | `'imaging' \| 'deployment'` | Current tab view |
| `safetyResult` | `ScriptSafetyResult \| null` | Last script analysis result |
| `scopeGuardOpen` | `boolean` | Whether scope guard modal is showing |
| `scriptContent` | `string` | Uploaded script text |
| `deploymentRuns` | `DeploymentRun[]` | History of completed deployments |

---

## Technology Stack Decisions

### React 19 Over Alternatives

| Considered | Rejected Because |
|-----------|-----------------|
| Vue 3 | Smaller TypeScript ecosystem for enterprise tooling |
| Svelte | Compiler-based approach harder to audit for security |
| Vanilla JS | Type safety is non-negotiable for a security-critical tool |
| Angular | Too heavy for a single-purpose deployment tool |

React 19 was chosen for its mature TypeScript support, large component ecosystem, and familiarity for developers who might maintain this tool.

### Vite 6 Over Webpack

| Feature | Vite 6 | Webpack 5 |
|---------|--------|-----------|
| Dev server startup | ~200ms | ~5s |
| HMR speed | Near-instant | 1-3s |
| Configuration | Minimal (~15 lines) | Extensive (~50+ lines) |
| Localhost binding | Simple `server.host` | Requires `devServer.host` |

Vite's minimal configuration was the deciding factor — less config means less surface area for misconfiguration.

### Tailwind CSS Over CSS Modules / Styled Components

| Feature | Tailwind | CSS Modules | Styled Components |
|---------|----------|-------------|-------------------|
| Bundle size | Purged at build time | Per-module CSS | Runtime JS overhead |
| Offline capability | Fully offline via PostCSS | Yes | Yes |
| CDN dependency | **None** (bundled) | None | None |
| Learning curve | Low (utility classes) | Medium | Medium |

Tailwind was originally loaded via CDN — a security risk and internet dependency. It's now bundled locally through PostCSS, producing only the CSS classes actually used in the source code.

### PapaParse Over Manual CSV Parsing

PapaParse handles edge cases that manual parsing misses:
- Quoted fields containing commas
- UTF-8 BOM markers
- Inconsistent line endings (CRLF vs LF)
- Empty rows and trailing commas

For a tool processing hospital device lists, robust CSV parsing prevents data loss and misidentified devices.

---

## File Structure

```
Secure-Deployer/
│
├── App.tsx                          # Root component: state management, deployment flow,
│                                    # view routing, device detection, credential handling
│
├── index.tsx                        # React entry point (StrictMode wrapper, CSS import)
├── index.html                       # HTML shell with security meta tags
├── types.ts                         # All TypeScript interfaces and type unions
├── styles.css                       # Tailwind entry (@tailwind base/components/utilities)
│
├── vite.config.ts                   # Build config: localhost-only, no source maps
├── package.json                     # Dependencies, scripts, electron-builder config
├── tsconfig.json                    # TypeScript strict mode configuration
├── tailwind.config.js               # Tailwind content paths
├── postcss.config.js                # PostCSS plugin chain (Tailwind + Autoprefixer)
│
├── electron/
│   └── main.cjs                     # Electron main process: security hardening,
│                                    # CSP, sandbox, cert validation, single instance
│
├── components/
│   ├── DeviceIcon.tsx               # 10 Dell form factor SVG icons with unique colors
│   ├── DeviceScopeGuard.tsx         # Per-device verification modal (checklist + policy)
│   ├── DeviceStatusTable.tsx        # Device list with status badges and detail panels
│   ├── ImageMonitor.tsx             # SCCM/MDT imaging live monitor
│   ├── ScriptAnalysisModal.tsx      # Script safety findings display
│   ├── Header.tsx                   # App header bar
│   ├── StepCard.tsx                 # Configuration step cards
│   ├── DeploymentProgress.tsx       # Progress bar component
│   ├── LogViewer.tsx                # Scrollable log viewer
│   ├── BulkActions.tsx              # Bulk operation toolbar
│   ├── DeploymentHistory.tsx        # Deployment run history
│   ├── CredentialsForm.tsx          # Inline credential display
│   └── SecureCredentialModal.tsx    # Modal credential input
│
├── services/
│   ├── scriptSafetyAnalyzer.ts      # Deterministic script analysis engine
│   └── geminiService.ts             # Deprecated stub (AI removed)
│
├── scripts/
│   ├── Gather-DeviceMetadata.bat    # Task sequence orchestrator (.bat)
│   ├── Gather-DeviceMetadata.ps1    # PowerShell metadata collector
│   └── LaunchFromUSB.bat            # USB portable app launcher
│
└── wiki/                            # This documentation
    ├── Home.md
    ├── Getting-Started.md
    ├── Architecture.md              # (this file)
    └── ...
```
