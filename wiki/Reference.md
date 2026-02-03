# Reference

> CSV formats, status codes, script safety patterns, device form factors, type definitions, and glossary.

---

## Table of Contents

- [CSV File Format](#csv-file-format)
- [Deployment Status Codes](#deployment-status-codes)
- [Imaging Status Codes](#imaging-status-codes)
- [Device Form Factor Reference](#device-form-factor-reference)
- [Script Safety Pattern Reference](#script-safety-pattern-reference)
- [Type Definitions](#type-definitions)
- [Configuration Constants](#configuration-constants)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Glossary](#glossary)

---

## CSV File Format

### Required Columns

| Column Purpose | Accepted Header Names (case-insensitive) |
|---------------|------------------------------------------|
| **Hostname** | `hostname`, `computername`, `devicename`, `computer`, `name`, `device` |
| **MAC Address** | `macaddress`, `mac address`, `mac` |

### Optional Columns

Any additional columns are ignored by the parser. You can include columns like `Location`, `Department`, `Asset Tag`, etc. for your own reference.

### MAC Address Formats

| Format | Example | Normalized To |
|--------|---------|--------------|
| Colon-separated | `AA:BB:CC:DD:EE:FF` | `AABBCCDDEEFF` |
| Hyphen-separated | `AA-BB-CC-DD-EE-FF` | `AABBCCDDEEFF` |
| Dot-separated | `AABB.CCDD.EEFF` | `AABBCCDDEEFF` |
| No separator | `AABBCCDDEEFF` | `AABBCCDDEEFF` |
| Lowercase | `aa:bb:cc:dd:ee:ff` | `AABBCCDDEEFF` |
| With spaces | `AA BB CC DD EE FF` | `AABBCCDDEEFF` |

**Validation rule**: After normalization (remove separators, uppercase), must be exactly 12 hexadecimal characters (0-9, A-F).

### Example CSV Files

**Minimal (hostnames and MACs only)**:
```csv
Hostname,MAC Address
ELSLE-LAT5450-001,AA:BB:CC:DD:EE:01
EWSSF-OPT7020-002,AA:BB:CC:DD:EE:02
```

**With extra columns (ignored by parser)**:
```csv
Hostname,MAC Address,Location,Department,Asset Tag
ELSLE-LAT5450-001,AA:BB:CC:DD:EE:01,Building A Room 101,Radiology,AT-001
EWSSF-OPT7020-002,AA:BB:CC:DD:EE:02,Building B Room 205,Nursing,AT-002
WYSE-5070-003,AA-BB-CC-DD-EE-03,Building A Room 300,Registration,AT-003
```

**Different column names**:
```csv
ComputerName,MACAddress
DEVICE-001,AABBCCDDEEFF
DEVICE-002,112233445566
```

---

## Deployment Status Codes

### Full Status Lifecycle

| Status | Color | Badge Animation | Description |
|--------|-------|----------------|-------------|
| `Pending` | Slate | None | Device loaded, no operation started |
| `Waking Up` | Yellow | Pulse | Wake-on-LAN magic packet sent |
| `Connecting` | Cyan | Pulse | Establishing remote connection |
| `Retrying...` | Cyan | Pulse | Connection failed, retrying (shows attempt count) |
| `Checking Info` | Sky | Pulse | Gathering basic system information |
| `Checking BIOS` | Sky | Pulse | Querying BIOS version |
| `Checking DCU` | Sky | Pulse | Querying Dell Command Update version |
| `Checking Windows` | Sky | Pulse | Querying Windows version |
| `Scan Complete` | Yellow | None | All version checks done — review results |
| `Updating` | Blue | Pulse | Update operation started |
| `Updating BIOS` | Blue | Pulse | BIOS update in progress |
| `Updating DCU` | Blue | Pulse | Dell Command Update in progress |
| `Updating Windows` | Blue | Pulse | Windows update in progress |
| `Update Complete (Reboot Pending)` | Purple | None | All updates done, device needs reboot |
| `Rebooting...` | Teal | Pulse | Reboot command sent |
| `Success` | Green | None | All operations completed successfully |
| `Failed` | Red | None | An operation failed |
| `Offline` | Orange | None | Device unreachable after all retry attempts |
| `Cancelled` | Gray | None | Operation cancelled by operator |

### Status Flow Diagram

```
Pending
  │
  ▼
Waking Up → Connecting → Retrying... (loop up to maxRetries)
                │                │
                ▼                ▼
        Checking Info         Offline
                │
                ▼
        Checking BIOS → Checking DCU → Checking Windows
                                                │
                                                ▼
                                          Scan Complete
                                                │
                                    ┌───────────┤
                                    ▼           ▼
                                 Updating    (no updates needed)
                                    │              │
                                    ▼              ▼
                    Updating BIOS/DCU/Win       Success
                                    │
                                    ▼
                    Update Complete (Reboot Pending)
                                    │
                                    ▼
                              Rebooting...
                                    │
                                    ▼
                                 Success

At any point: → Failed (on error)
              → Cancelled (by operator)
```

---

## Imaging Status Codes

| Status | Description |
|--------|-------------|
| `Not Started` | Metadata JSON loaded, imaging not yet detected |
| `Collecting Metadata` | PowerShell script is gathering hardware data |
| `Imaging In Progress` | SCCM/MDT task sequence is running |
| `Imaging Complete` | Image applied successfully — ready for promotion |
| `Imaging Failed` | Task sequence failed |
| `Ready for Deployment` | Device promoted to Deployment Runner |

---

## Device Form Factor Reference

### Detection Patterns (Priority Order)

Detection tests each pattern from top to bottom. First match wins.

| Priority | Form Factor | Type Value | Icon Color | Hostname Patterns | Example Models |
|----------|-------------|-----------|-----------|-------------------|----------------|
| 1 | Wyse Thin Client | `wyse` | Cyan | `WYSE`, `WYS`, `THIN`, `TC[0-9]` | Wyse 5070, 5470, 3040 |
| 2 | VDI Client | `vdi` | Violet | `VDI`, `VIRT`, `VD-` or `VD_` | VMware Horizon, Citrix Workspace |
| 3 | Detachable 2-in-1 | `detachable` | Teal | `EDTCH`, `DET`, `2IN1`, `DTCH` | Latitude 7350 Detachable, 7230 Rugged |
| 4 | Pro 16" Laptop | `laptop-16` | Indigo | `EPLPR`, `L16`, `LAT16`, `PRE16`, `PRE56`, `PRE57` | Latitude 9640, Precision 5690, 5680 |
| 5 | Standard 14" Laptop | `laptop-14` | Blue | `ELSLE`, `ESLSC`, `L14`, `LAT14`, `LAT54`, `LAT74` | Latitude 5450, 7450, 5440 |
| 6 | Tower Desktop | `tower` | Orange | `EWSTW`, `TWR`, `TOWER`, `PRETW` | OptiPlex 7020 Tower, Precision 3680 |
| 7 | Micro Desktop | `micro` | Amber | `EWSMF`, `EWSMC`, `MFF`, `MICRO` | OptiPlex 7020 Micro, 7010 Micro |
| 8 | SFF Desktop | `sff` | Emerald | `EWSSF`, `SFF` | OptiPlex 7020 SFF, 5000 SFF |
| 9 | Generic Laptop | `laptop` | Slate | `LAT`, `LAPTOP`, `NB`, `PRE5`, `PRE7` | Latitude 7420, Precision 5560 |
| 10 | Generic Desktop | `desktop` | Slate | (default fallback) | OptiPlex 7090, 5000, Precision 3650 |

### Enterprise Hostname Convention Guide

Common Dell enterprise hostname patterns and what they encode:

| Prefix | Meaning |
|--------|---------|
| `ELSLE` | Enterprise Laptop Standard LE |
| `ESLSC` | Enterprise Standard Laptop SC |
| `EPLPR` | Enterprise Pro Laptop PR |
| `EWSLE` | Enterprise Workstation LE |
| `EWSSF` | Enterprise Workstation SFF |
| `EWSMF` | Enterprise Workstation Micro Form |
| `EWSMC` | Enterprise Workstation Micro Compact |
| `EWSTW` | Enterprise Workstation Tower |
| `EDTCH` | Enterprise Detachable |
| `PRETW` | Precision Tower Workstation |
| `LAT` | Latitude series |
| `PRE` | Precision series |

---

## Script Safety Pattern Reference

### BLOCKED Patterns (28 rules — Script Will Not Execute)

| # | Category | Pattern (simplified) | Description |
|---|----------|---------------------|-------------|
| 1 | Shutdown | `shutdown /r` without `/t` | Shutdown without timeout |
| 2 | Shutdown | `shutdown \\*` | Wildcard machine shutdown |
| 3 | Service | `net stop <critical-service>` | Stopping critical infrastructure services |
| 4 | Delete | `del /s /q C:\` | Recursive silent deletion on drive root |
| 5 | Delete | `del /q /s C:\` | Same, alternate flag order |
| 6 | Delete | `rd /s /q C:\` | Recursive directory removal on drive root |
| 7 | Delete | `rmdir /s /q C:\` | Same command, full name |
| 8 | Delete | `Remove-Item -Recurse C:\` | PowerShell recursive removal |
| 9 | Format | `format C:` | Disk format command |
| 10 | Registry | `reg delete HKLM\SYSTEM` | Delete system registry root |
| 11 | Registry | `reg delete HKLM\SOFTWARE` | Delete software registry root |
| 12 | Firewall | `netsh advfirewall set allprofiles state off` | Disable all firewall profiles |
| 13 | Firewall | `netsh advfirewall set <profile> state off` | Disable specific firewall profile |
| 14 | Firewall | `Set-NetFirewallProfile -Enabled False` | PowerShell firewall disable |
| 15 | Boot | `bcdedit` | Boot Configuration Data modification |
| 16 | Disk | `diskpart` | Disk partition utility |
| 17 | Broadcast | `ping x.x.x.255` | Broadcast address ping |
| 18 | Broadcast | `ping 255.255.255.255` | Global broadcast ping |
| 19 | Sweep | `for /L ... ping` | Loop-based ping sweep |
| 20 | Sweep | `1..254 ... ping` | PowerShell range ping sweep |
| 21 | Sweep | `for %i in (1,1,254) ping` | Batch subnet sweep |
| 22 | Wildcard | `psexec \\*` | PsExec to all machines |
| 23 | Wildcard | `wmic /node:*` | WMI to all machines |
| 24 | Wildcard | `Invoke-Command -ComputerName *` | PowerShell to all machines |
| 25 | Wildcard | `Stop-Service *` | Stop all services |
| 26 | Wildcard | `\\*` UNC path | Wildcard network target |
| 27 | Policy | `Set-ExecutionPolicy Unrestricted -Force` | Disable PowerShell security |
| 28 | Policy | `Set-ExecutionPolicy Bypass -Force` | Bypass PowerShell security |

### DANGER Patterns (26 rules — Requires Manual Override)

| Category | Pattern | Risk |
|----------|---------|------|
| Registry | `reg add HKLM` | Machine-wide config change |
| Registry | `reg delete HKLM` | Machine-wide config deletion |
| Service | `net stop <any>` | Service disruption |
| Service | `sc config`, `sc delete` | Service configuration change |
| Scheduled Tasks | `schtasks /create`, `Register-ScheduledTask` | Persistent task creation |
| WMI | `wmic`, `Invoke-WmiMethod`, `Invoke-CimMethod` | Remote system modification |
| Remoting | `Enter-PSSession`, `Invoke-Command`, `New-PSSession` | Remote shell access |
| Network | `netsh`, `route add`, `route delete` | Network configuration change |
| Group Policy | `gpupdate /force` | Policy change enforcement |
| Disk | `cipher /w` | Disk wipe (free space) |
| Environment | `setx /M`, `[Environment]::SetEnvironmentVariable(...Machine)` | System env var change |
| Permissions | `takeown`, `icacls` | File ownership/ACL change |

### WARNING Patterns (18 rules — Informational)

| Category | Pattern | Risk |
|----------|---------|------|
| File Copy | `copy`/`xcopy`/`robocopy`/`Copy-Item` to Windows or Program Files | System directory modification |
| Install | `msiexec` | Software installation |
| Cert | `certutil` | Certificate/file utility |
| Network | `ping` | Reconnaissance potential |
| Process | `taskkill`, `Stop-Process` | Process termination |
| Drive Map | `net use` | Network drive mapping |
| Download | `Invoke-WebRequest`, `Invoke-RestMethod`, `wget`, `curl`, `Start-BitsTransfer`, `DownloadString` | File download |

---

## Type Definitions

### Device Interface

```typescript
interface Device {
    id: number;                                // Unique numeric ID (auto-assigned)
    hostname: string;                          // Device hostname from CSV or metadata
    mac: string;                               // Normalized MAC (12 hex chars)
    status: DeploymentStatus;                  // Current deployment state
    deviceType?: DeviceFormFactor;             // Detected form factor
    biosVersion?: string;                      // Current BIOS version
    dcuVersion?: string;                       // Current DCU version
    winVersion?: string;                       // Current Windows version
    isBiosUpToDate?: boolean;                  // Compared against TARGET_BIOS_VERSION
    isDcuUpToDate?: boolean;                   // Compared against TARGET_DCU_VERSION
    isWinUpToDate?: boolean;                   // Compared against TARGET_WIN_VERSION
    ipAddress?: string;                        // Device IP address
    model?: string;                            // Device model name
    serialNumber?: string;                     // Serial number
    ramAmount?: number;                        // RAM in GB
    diskSpace?: { total: number; free: number }; // Disk in GB
    encryptionStatus?: 'Enabled' | 'Disabled' | 'Unknown';
    retryAttempt?: number;                     // Current retry count
    lastUpdateResult?: {                       // Last update results
        succeeded: string[];
        failed: string[];
    };
    // Imaging fields (populated via Image Monitor promotion)
    imagingStatus?: ImagingStatus;
    imagingProgress?: number;
    imagingTaskSequence?: string;
    imagingStartedAt?: Date;
    imagingCompletedAt?: Date;
    // Scope verification
    scopeVerified?: boolean;
    scopeVerifiedAt?: Date;
}
```

### DeviceFormFactor Type

```typescript
type DeviceFormFactor =
    | 'laptop-14'    // Standard 14" Latitude
    | 'laptop-16'    // Pro 16" Latitude / Precision Mobile
    | 'detachable'   // 2-in-1 Detachable
    | 'laptop'       // Generic laptop fallback
    | 'sff'          // Standard Form Factor desktop
    | 'micro'        // Micro Form Factor desktop
    | 'tower'        // Tower desktop
    | 'wyse'         // Wyse Thin Client
    | 'vdi'          // Virtual Desktop Infrastructure
    | 'desktop';     // Generic desktop fallback
```

### ScriptSafetyResult Interface

```typescript
interface ScriptSafetyResult {
    isSafe: boolean;                    // false if any BLOCKED patterns found
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    findings: ScriptFinding[];          // All individual findings
    summary: string;                    // Human-readable summary
    blockedPatterns: string[];          // Patterns that block execution
    scopeViolations: string[];          // Hostnames/IPs outside approved list
}

interface ScriptFinding {
    line: number;                       // Line number (1-indexed, 0 for global)
    pattern: string;                    // Regex pattern that matched
    severity: 'INFO' | 'WARNING' | 'DANGER' | 'BLOCKED';
    description: string;               // What was found
    recommendation: string;            // How to fix it
}
```

### ScopePolicy Interface

```typescript
interface ScopePolicy {
    allowedHostnames: string[];         // Hostnames verified by operator
    allowedMacs: string[];              // MAC addresses of verified devices
    maxDeviceCount: number;             // Max devices this policy allows
    requireExplicitSelection: boolean;  // Must select devices individually
    blockBroadcastCommands: boolean;    // Block subnet-wide operations
    blockSubnetWideOperations: boolean; // Block IP range operations
    blockRegistryWrites: boolean;       // Block HKLM\SYSTEM writes
    blockServiceStops: boolean;         // Block critical service stops
    enforceHostnameWhitelist: boolean;  // Only allow listed hostnames
}
```

---

## Configuration Constants

| Constant | File | Default | Description |
|----------|------|---------|-------------|
| `TARGET_BIOS_VERSION` | App.tsx | `'A25'` | Expected BIOS version for compliance |
| `TARGET_DCU_VERSION` | App.tsx | `'5.2.0'` | Expected DCU version |
| `TARGET_WIN_VERSION` | App.tsx | `'23H2'` | Expected Windows version |
| `SESSION_TIMEOUT_MS` | App.tsx | `1800000` (30 min) | Credential auto-wipe timeout |
| `HARD_MAX_DEVICE_COUNT` | DeviceScopeGuard.tsx | `200` | Absolute maximum devices per operation |
| `DEFAULT_MAX_DEVICE_COUNT` | DeviceScopeGuard.tsx | `50` | Default device limit |
| `host` | vite.config.ts | `'127.0.0.1'` | Dev server bind address |
| `port` | vite.config.ts | `3000` | Dev server port |
| `SHARE_PATH` | Gather-DeviceMetadata.bat | `\\DEPLOYSERVER\ImageMetadata$` | Network share for metadata |

---

## Keyboard Shortcuts

The application is primarily mouse-driven. Standard browser shortcuts apply:

| Shortcut | Action |
|----------|--------|
| `Ctrl+R` / `F5` | Reload application (clears all state) |
| `Ctrl+Shift+I` | Open DevTools (development only) |
| `Tab` | Navigate between form fields |
| `Enter` | Submit focused form/button |
| `Escape` | Close open modals |

---

## Glossary

| Term | Definition |
|------|-----------|
| **BIOS** | Basic Input/Output System — firmware that initializes hardware before the OS boots |
| **CSP** | Content Security Policy — HTTP header that controls which resources the browser can load |
| **DCU** | Dell Command Update — Dell's driver and firmware update utility |
| **Deterministic** | Always produces the same output for the same input (no randomness or AI) |
| **DeviceFormFactor** | TypeScript type representing one of 10 Dell device categories |
| **Electron** | Framework for building desktop apps with web technologies (Chromium + Node.js) |
| **HIPAA** | Health Insurance Portability and Accountability Act — US healthcare data privacy law |
| **HKLM** | HKEY_LOCAL_MACHINE — Windows registry root for machine-wide settings |
| **ImagingMetadata** | JSON structure containing device hardware data collected during imaging |
| **Magic Packet** | Special network frame used for Wake-on-LAN (contains target MAC address 16 times) |
| **MDT** | Microsoft Deployment Toolkit — free Windows deployment automation tool |
| **NIST** | National Institute of Standards and Technology — US standards organization |
| **PHI** | Protected Health Information — data subject to HIPAA regulations |
| **PostCSS** | CSS processing tool used to compile Tailwind utility classes at build time |
| **PsExec** | Sysinternals tool for remote command execution on Windows |
| **SCCM** | System Center Configuration Manager (now Microsoft Endpoint Configuration Manager) |
| **Scope Guard** | UI component requiring per-device verification before bulk operations |
| **SFF** | Small Form Factor — compact desktop chassis |
| **Task Sequence** | SCCM/MDT workflow that automates OS deployment steps |
| **Vite** | Modern JavaScript build tool (French for "fast") |
| **VDI** | Virtual Desktop Infrastructure — hosted virtual desktops |
| **WinPE** | Windows Preinstallation Environment — minimal Windows used during imaging |
| **WMI** | Windows Management Instrumentation — Windows system management interface |
| **WoL** | Wake-on-LAN — protocol for remotely powering on network devices |
| **Wyse** | Dell thin client product line |
| **XSS** | Cross-Site Scripting — web attack that injects malicious scripts |
