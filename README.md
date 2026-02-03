# Secure Deployment Runner

**Hospital Network Device Deployment & Imaging Management Platform**

A production-hardened, AI-free, USB-portable Electron application for hospital IT teams to image, scan, and deploy software updates across enterprise fleets of Dell business devices. Built with React 19, TypeScript, and Electron with defense-in-depth security — zero internet dependencies, zero external API calls, zero risk to patient-facing systems.

---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
- [Security Model](#security-model)
- [Device Form Factor Detection](#device-form-factor-detection)
- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [USB Deployment](#usb-deployment)
- [Imaging Workflow](#imaging-workflow)
- [Deployment Workflow](#deployment-workflow)
- [CSV File Format](#csv-file-format)
- [Script Safety Analyzer](#script-safety-analyzer)
- [Device Scope Guard](#device-scope-guard)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Configuration Reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)
- [Wiki Documentation](#wiki-documentation)
- [License](#license)

---

## Why This Exists

Hospital networks are uniquely high-stakes environments. A misrouted deployment script, an accidental subnet-wide reboot, or a leaked credential can take down systems that clinicians rely on for patient care. Commercial deployment tools often require internet connectivity, cloud APIs, or AI services — none of which belong on an air-gapped clinical network.

**Secure Deployment Runner** was built from scratch to solve these problems:

| Problem | Solution |
|---------|----------|
| Commercial tools require internet | Fully offline, runs from USB |
| AI-based analysis phones home | Deterministic regex-based script analyzer — zero AI, zero network |
| Deployment scripts can affect unintended devices | Device Scope Guard with per-device verification + hostname whitelisting |
| Credentials get logged or cached | In-memory only, auto-wiped after 30 min inactivity, sanitized from all logs |
| No visibility during imaging | Image Monitor shows live SCCM/MDT progress per device |
| One tool for imaging, another for deployment | Single platform: Image Monitor → Promote → Deployment Runner |

---

## Key Features

### Image Monitor
- Live monitoring of SCCM/MDT task sequence imaging progress
- Drag-and-drop JSON metadata ingestion from task sequence scripts
- Per-device progress bars, metadata display, and status tracking
- Promote completed devices directly to the Deployment Runner

### Secure Deployment Runner
- CSV-based device list management with MAC address validation
- Remote script execution for `.bat` and `.cmd` deployment packages
- Wake-on-LAN (WoL) with per-device targeting
- Real-time progress tracking with color-coded status badges
- BIOS, DCU, and Windows version compliance scanning
- Bulk operations with Device Scope Guard enforcement

### Script Safety Analyzer
- **Deterministic, AI-free** static analysis of deployment scripts
- 60+ blocked/danger/warning pattern rules covering:
  - Disk destruction (`format`, `diskpart`, recursive deletes)
  - Firewall disabling, boot config modifications
  - Subnet-wide broadcasts, wildcard targeting (`\\*`, `-ComputerName *`)
  - Critical service stops, execution policy bypasses
- Scope violation detection: flags hostnames not in the approved device list
- Blocks unsafe scripts before they can execute

### Device Scope Guard
- Per-device checkbox verification before any bulk operation
- Confirmation by typing exact device count
- Safety toggles: block broadcasts, block registry writes, block service stops
- Hostname whitelist enforcement during execution
- Hard cap of 200 devices per operation

### Dell Business Device Detection
- Automatic form factor identification from hostname patterns
- 10 distinct device categories with unique SVG icons:

| Form Factor | Icon Color | Hostname Patterns | Example Models |
|-------------|-----------|-------------------|----------------|
| Standard 14" Laptop | Blue | `ELSLE`, `ESLSC`, `L14`, `LAT14` | Latitude 5450, 7450 |
| Pro 16" Laptop | Indigo | `EPLPR`, `L16`, `LAT16`, `PRE16` | Latitude 9640, Precision 5690 |
| Detachable 2-in-1 | Teal | `EDTCH`, `DET`, `2IN1`, `DTCH` | Latitude 7350 Detachable |
| Generic Laptop | Slate | `LAT`, `LAPTOP`, `NB` | Latitude 7420, 5430 |
| SFF Desktop | Emerald | `EWSSF`, `SFF` | OptiPlex 7020 SFF |
| Micro Desktop | Amber | `EWSMF`, `EWSMC`, `MFF`, `MICRO` | OptiPlex 7020 Micro |
| Tower Desktop | Orange | `EWSTW`, `TWR`, `TOWER` | OptiPlex 7020 Tower, Precision 3680 |
| Wyse Thin Client | Cyan | `WYSE`, `WYS`, `THIN`, `TC` | Wyse 5070, 5470 |
| VDI Client | Violet | `VDI`, `VIRT`, `VD-` | VMware Horizon, Citrix |
| Generic Desktop | Slate | Everything else | OptiPlex 7090, 5000 |

### Security Hardening
- Electron sandbox with `contextIsolation: true`, `nodeIntegration: false`
- Strict Content Security Policy: `default-src 'self'`, `frame-src 'none'`
- Vite dev server bound to `127.0.0.1` only
- No source maps in production builds
- All CDN dependencies removed — Tailwind CSS bundled via PostCSS
- Single-instance lock prevents duplicate app windows
- Invalid TLS certificates rejected unconditionally
- Session storage cleared on every launch
- 30-minute credential auto-wipe on inactivity

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     USB Drive / Local Machine                   │
│                                                                 │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │   Gather-DeviceMetadata │  │    Secure Deployment Runner  │  │
│  │   .bat + .ps1           │  │    (Electron + React)        │  │
│  │                         │  │                              │  │
│  │  Runs during SCCM/MDT  │  │  ┌────────────────────────┐  │  │
│  │  task sequence to       │──│─>│   Image Monitor         │  │  │
│  │  collect device HW      │  │  │   (live imaging view)   │  │  │
│  │  metadata as JSON       │  │  └────────┬───────────────┘  │  │
│  └─────────────────────────┘  │           │ Promote          │  │
│                               │  ┌────────▼───────────────┐  │  │
│                               │  │ Deployment Runner       │  │  │
│                               │  │ (scan + update + WoL)   │  │  │
│                               │  └────────────────────────┘  │  │
│                               │                              │  │
│                               │  ┌────────────────────────┐  │  │
│                               │  │ Script Safety Analyzer  │  │  │
│                               │  │ (deterministic regex)   │  │  │
│                               │  └────────────────────────┘  │  │
│                               │                              │  │
│                               │  ┌────────────────────────┐  │  │
│                               │  │ Device Scope Guard      │  │  │
│                               │  │ (per-device verify)     │  │  │
│                               │  └────────────────────────┘  │  │
│                               └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Model

### Defense-in-Depth Layers

| Layer | What It Protects | How |
|-------|-----------------|-----|
| **Electron Process Isolation** | OS access | `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` |
| **Content Security Policy** | XSS / code injection | `default-src 'self'`, `frame-src 'none'`, `object-src 'none'` |
| **Script Safety Analyzer** | Hospital systems | 60+ regex rules block destructive patterns pre-execution |
| **Device Scope Guard** | Non-targeted devices | Per-device verification + hostname whitelist enforcement |
| **Credential Handling** | Auth tokens | In-memory only, 30-min auto-wipe, regex-sanitized from logs |
| **Network Binding** | Network exposure | Dev server on `127.0.0.1` only, no external connections |
| **Certificate Validation** | MITM attacks | All invalid TLS certs rejected unconditionally |
| **Single Instance Lock** | Session confusion | Only one app instance allowed at a time |

### What Was Removed (and Why)

| Removed | Reason |
|---------|--------|
| `@google/genai` (Gemini AI) | External API calls have no place on a hospital network |
| `react-markdown` | Rendered AI-generated markdown; no longer needed |
| CDN Tailwind (`cdn.tailwindcss.com`) | Required internet; now bundled locally |
| ESM CDN imports (`esm.sh`) | Required internet; all deps are local |
| `GEMINI_API_KEY` in Vite config | API keys must never appear in build config |
| `host: '0.0.0.0'` in Vite | Exposed dev server to entire hospital network |
| Source maps in production | Leak application internals to anyone with DevTools |
| `DeploymentAnalytics.tsx` | Was an empty file (0 bytes) |

---

## Device Form Factor Detection

The `detectDeviceType()` function in `App.tsx` identifies Dell business device categories from hostname substrings. This drives which SVG icon appears next to each device and which simulated model names are shown.

### Detection Priority Order

Detection follows a priority order (first match wins):

1. **Wyse / Thin Client** — `WYSE`, `WYS`, `THIN`, `TC[0-9]`
2. **VDI** — `VDI`, `VIRT`, `VD-`
3. **Detachable** — `EDTCH`, `DET`, `2IN1`, `DTCH`
4. **Pro 16" Laptop** — `EPLPR`, `L16`, `LAT16`, `PRE16`, `PRE56`, `PRE57`
5. **Standard 14" Laptop** — `ELSLE`, `ESLSC`, `L14`, `LAT14`, `LAT54`, `LAT74`
6. **Tower** — `EWSTW`, `TWR`, `TOWER`, `PRETW`
7. **Micro** — `EWSMF`, `EWSMC`, `MFF`, `MICRO`
8. **SFF** — `EWSSF`, `SFF`
9. **Generic Laptop** — `LAT`, `LAPTOP`, `NB`, `PRE5`, `PRE7`
10. **Generic Desktop** — everything else (default fallback)

### Customizing Detection

To add your organization's hostname patterns, edit the `detectDeviceType()` function in `App.tsx:31`. Each pattern is a simple `upper.includes('PATTERN')` check. Add your patterns to the appropriate form factor block.

---

## System Requirements

| Requirement | Minimum |
|-------------|---------|
| OS | Windows 10 1809+ (for USB deployment) |
| Node.js | 18.x+ (for development only) |
| RAM | 4 GB |
| Disk | 200 MB (portable build) |
| Network | LAN access to target devices (no internet required) |
| Display | 1280x800 minimum |

---

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start the dev server (localhost:3000 only)
npm run dev
```

### Production Build

```bash
# Web build only
npm run build

# Electron installer (.exe)
npm run build:app

# Portable USB build (.exe, no install needed)
npm run build:portable
```

---

## USB Deployment

The application is designed to run entirely from a USB drive with no installation:

### Setup

1. Build the portable executable: `npm run build:portable`
2. Copy `release/Secure-Deployment-Runner-Portable-*.exe` to the USB root
3. Copy `scripts/LaunchFromUSB.bat` to the USB root
4. Copy the `scripts/` directory to the USB root

### USB Drive Layout

```
USB:\
├── LaunchFromUSB.bat                              ← Double-click to launch
├── Secure-Deployment-Runner-Portable-1.0.0.exe    ← Electron portable app
└── scripts/
    ├── Gather-DeviceMetadata.bat                  ← Task sequence orchestrator
    └── Gather-DeviceMetadata.ps1                  ← PowerShell metadata collector
```

### Running

1. Insert USB into any Windows machine
2. Double-click `LaunchFromUSB.bat`
3. The application opens — no admin rights, no internet, no installation

---

## Imaging Workflow

### Phase 1: Metadata Collection (During SCCM/MDT Task Sequence)

During the Windows imaging process, the task sequence runs `Gather-DeviceMetadata.bat`, which:

1. Detects the USB drive path
2. Validates PowerShell availability
3. Runs `Gather-DeviceMetadata.ps1` to collect hardware metadata via WMI/CIM:
   - System identity (manufacturer, model, serial, RAM)
   - BIOS information (version, date)
   - Network configuration (MAC, IP, DNS, gateway)
   - Storage (disk size, partitions, BitLocker status)
   - TPM and Secure Boot status
   - Task sequence environment variables
4. Outputs JSON to `%TEMP%\DeviceMetadata\<COMPUTERNAME>.json`
5. Copies JSON to network share `\\DEPLOYSERVER\ImageMetadata$\`

### Phase 2: Live Monitoring (Image Monitor)

In the Secure Deployment Runner UI:

1. Switch to the **Image Monitor** tab
2. Drag-and-drop the device metadata JSON files (or load from network share)
3. Watch live progress per device as imaging continues
4. When a device reaches "Imaging Complete", promote it to the Deployment Runner

### Phase 3: Post-Imaging Deployment

1. Promoted devices appear in the **Secure Deployment Runner** tab
2. Upload your deployment script (`.bat`/`.cmd`)
3. Script Safety Analyzer runs automatically — blocks unsafe scripts
4. Enter credentials (in-memory only) and start the system scan
5. Review compliance, then run updates on devices that need them

---

## Deployment Workflow

```
CSV Upload → Script Safety Check → Credentials → WoL → Connect → Scan → Update
                    │                                                       │
            BLOCKED if unsafe                              Device Scope Guard
                                                         (per-device verify)
```

1. **Upload CSV** — Device list with hostnames and MAC addresses
2. **Upload Script** — `.bat` or `.cmd` deployment package
3. **Auto Safety Check** — Script analyzed before any execution
4. **Credentials** — Prompted via modal, stored in memory only
5. **Wake-on-LAN** — Packets sent to all devices, 30s boot wait
6. **Connect** — Per-device connection with configurable retries
7. **System Scan** — BIOS, DCU, Windows version checks
8. **Update** — Per-device or bulk (requires Scope Guard verification)

---

## CSV File Format

### Required Columns

| Column | Accepted Names |
|--------|---------------|
| Hostname | `hostname`, `computername`, `devicename`, `computer`, `name`, `device` |
| MAC Address | `macaddress`, `mac address`, `mac` |

### Example

```csv
Hostname,MAC Address
ELSLE-LAT5450-001,AA:BB:CC:DD:EE:01
EWSSF-OPT7020-002,AA:BB:CC:DD:EE:02
WYSE-5070-003,AA-BB-CC-DD-EE-03
VDI-HORIZON-004,AABBCCDDEEF4
```

### MAC Address Formats

All of these are accepted and normalized to uppercase 12-character hex:
- Colon-separated: `AA:BB:CC:DD:EE:FF`
- Hyphen-separated: `AA-BB-CC-DD-EE-FF`
- No separator: `AABBCCDDEEFF`

---

## Script Safety Analyzer

The analyzer at `services/scriptSafetyAnalyzer.ts` performs **deterministic, AI-free** static analysis:

### Risk Levels

| Level | Color | Meaning |
|-------|-------|---------|
| **CRITICAL** | Red | Script is **blocked** — contains destructive patterns |
| **HIGH** | Orange | Manual review required — dangerous commands detected |
| **MEDIUM** | Yellow | Informational warnings — review recommended |
| **LOW** | Green | No issues found |

### Blocked Pattern Categories (Script Will NOT Run)

- `format` / `diskpart` — disk destruction
- Recursive `del /s /q` on drive roots
- `shutdown` without timeout or with wildcards
- `net stop` on critical services (DNS, DHCP, AD, SQL, IIS)
- Firewall disable (`netsh advfirewall ... state off`)
- `bcdedit` — boot config modification
- Subnet sweeps (`ping` loops, `1..254` ranges)
- Wildcard targeting (`\\*`, `-ComputerName *`, `psexec \\*`)
- Broadcast WoL to entire subnet
- `Set-ExecutionPolicy Bypass/Unrestricted -Force`

### Scope Violation Detection

The analyzer also extracts hostnames from UNC paths, `-ComputerName`, `/node:`, and PsExec targets, then flags any hostname **not** in the approved CSV device list.

---

## Device Scope Guard

The Scope Guard at `components/DeviceScopeGuard.tsx` provides a multi-step verification gate before any bulk operation:

1. **Device Checklist** — Every target device must be individually checked
2. **Count Confirmation** — Operator must type the exact number of devices
3. **Safety Toggles** — Enable/disable broadcast blocking, registry write blocking, service stop blocking
4. **Hostname Whitelisting** — During execution, only verified hostnames can receive commands

### Limits

- Default max devices per operation: 50
- Hard maximum: 200 (cannot be overridden in UI)
- All selections are audit-logged with timestamp and operator username

---

## Project Structure

```
Secure-Deployer/
├── App.tsx                          # Main application component (imaging + deployment)
├── index.tsx                        # React entry point with StrictMode
├── index.html                       # HTML shell with security meta tags
├── types.ts                         # All TypeScript interfaces and types
├── styles.css                       # Tailwind CSS entry (bundled locally)
├── vite.config.ts                   # Vite config (localhost-only, no source maps)
├── package.json                     # Dependencies and build scripts
├── tailwind.config.js               # Tailwind content paths
├── postcss.config.js                # PostCSS plugins (Tailwind + Autoprefixer)
├── tsconfig.json                    # TypeScript compiler configuration
├── electron/
│   └── main.cjs                     # Electron main process (security hardening)
├── components/
│   ├── DeviceIcon.tsx               # 10 Dell form factor SVG icons
│   ├── DeviceScopeGuard.tsx         # Per-device verification gate
│   ├── DeviceStatusTable.tsx        # Device list with status badges
│   ├── ImageMonitor.tsx             # SCCM/MDT imaging live monitor
│   ├── ScriptAnalysisModal.tsx      # Script safety results display
│   ├── Header.tsx                   # App header with WoL controls
│   ├── StepCard.tsx                 # Configuration step cards
│   ├── DeploymentProgress.tsx       # Overall progress bar
│   ├── LogViewer.tsx                # Live log display
│   ├── BulkActions.tsx              # Bulk operation toolbar
│   ├── DeploymentHistory.tsx        # History of deployment runs
│   ├── CredentialsForm.tsx          # Credential input form
│   └── SecureCredentialModal.tsx    # Modal credential prompt
├── services/
│   ├── scriptSafetyAnalyzer.ts      # Deterministic script analysis (60+ rules)
│   └── geminiService.ts             # Deprecated stub (AI removed)
└── scripts/
    ├── Gather-DeviceMetadata.bat    # Task sequence orchestrator
    ├── Gather-DeviceMetadata.ps1    # PowerShell metadata collector
    └── LaunchFromUSB.bat            # USB portable launcher
```

---

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.8 | Type safety |
| Electron | 35.x | Desktop packaging with security sandbox |
| Vite | 6.x | Build tool (localhost-only dev server) |
| Tailwind CSS | 3.4 | Utility-first styling (bundled via PostCSS) |
| PapaParse | 5.5 | CSV parsing |
| PostCSS | 8.5 | CSS processing pipeline |
| Autoprefixer | 10.4 | Cross-browser CSS compatibility |
| electron-builder | 24.x | Portable and installer builds |

**Removed dependencies**: `@google/genai`, `react-markdown` (AI services have no place on hospital networks)

---

## Configuration Reference

### Target Compliance Versions

Edit these constants in `App.tsx` to match your fleet's targets:

```typescript
const TARGET_BIOS_VERSION = 'A25';
const TARGET_DCU_VERSION = '5.2.0';
const TARGET_WIN_VERSION = '23H2';
```

### Retry Settings (UI-Configurable)

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Max Retries | 3 | 1–10 | Connection attempts per device |
| Retry Delay | 2 sec | 1–30 | Wait between retry attempts |
| Auto Reboot | Off | On/Off | Automatically reboot after updates |

### Session Timeout

```typescript
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
```

Credentials are wiped from memory after 30 minutes of no mouse/keyboard activity.

### Network Share (Metadata Scripts)

Edit in `Gather-DeviceMetadata.bat`:

```batch
set "SHARE_PATH=\\DEPLOYSERVER\ImageMetadata$"
```

---

## Troubleshooting

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| CSV not loading | Missing hostname/MAC columns | Check column headers match accepted names |
| All devices show as Offline | Network connectivity | Verify LAN access, check firewall rules |
| Script blocked by analyzer | Dangerous patterns detected | Review the findings in the Script Analysis Modal |
| No form factor icon showing | Hostname doesn't match patterns | Add your naming convention to `detectDeviceType()` |
| USB launcher can't find .exe | Wrong directory structure | Ensure `.exe` is at USB root or in `release/` subfolder |
| Credentials disappeared | Session timeout | Re-enter credentials (30-min inactivity auto-wipe) |
| Metadata JSON not appearing | PowerShell not available | Ensure WinPE has PowerShell support enabled |

### Log Levels

| Level | Color | Description |
|-------|-------|-------------|
| INFO | Blue | General operational messages |
| SUCCESS | Green | Completed operations |
| WARNING | Yellow | Non-critical issues requiring attention |
| ERROR | Red | Critical failures |

All log messages are sanitized — passwords, tokens, and secrets are replaced with `[REDACTED]`.

---

## Wiki Documentation

Comprehensive documentation is available in the [`wiki/`](./wiki/) directory, organized into 10 sections:

1. **Home** — Project overview and quick navigation
2. **Getting Started** — Prerequisites, installation, first run
3. **Architecture** — System design, component diagram, data flow, tech stack
4. **Implementation** — Deployment guide, configuration reference, USB setup
5. **Operations** — Runbook, monitoring, maintenance, incident response
6. **Security** — Hardening details, access control, credential handling, compliance
7. **Troubleshooting** — Common issues, decision trees, log analysis, FAQ
8. **Reference** — CSV format, status codes, script patterns, glossary
9. **Advanced** — Customization, extending the analyzer, CI/CD
10. **Meta** — Changelog, contributing, interview talking points

---

## License

This project is provided as-is for enterprise hospital deployment management purposes. All data stays on the local network — no telemetry, no analytics, no external connections.

---

*Built for hospital IT teams who need tools they can trust on networks where failure is not an option.*
