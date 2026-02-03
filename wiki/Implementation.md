# Implementation

This document covers the complete implementation details for the **Secure Deployment Runner** -- a hospital network deployment tool built with Electron, React 19, TypeScript, Vite 6, and Tailwind CSS (bundled via PostCSS). The application runs entirely from USB, requires no internet connectivity, and contains no AI dependencies.

---

## 1. Build & Deployment Guide

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18+ | LTS recommended |
| npm | 9+ | Ships with Node.js |
| Windows | 10/11 | Required for electron-builder Windows targets |

### Development Setup

```bash
# Clone the repository
git clone <repo-url> && cd Secure-Deployer

# Install all dependencies (React 19, PapaParse, Electron, Vite 6, Tailwind, etc.)
npm install

# Start the Vite development server on http://127.0.0.1:3000
npm run dev
```

The development server binds exclusively to `127.0.0.1` (localhost) and never exposes itself to the hospital network. This is enforced in `vite.config.ts`:

```typescript
server: {
  port: 3000,
  host: '127.0.0.1',   // Security: never expose to hospital network
  open: false,
},
```

### Production Build

```bash
# Build the Vite production bundle (outputs to dist/)
npm run build

# Build the production bundle AND package as a Windows installer + portable .exe
npm run build:app

# Build the production bundle AND package as a portable .exe only (for USB deployment)
npm run build:portable
```

| Script | Command | Output |
|---|---|---|
| `dev` | `vite` | Local dev server at `http://127.0.0.1:3000` |
| `build` | `vite build` | Optimized static bundle in `dist/` |
| `build:app` | `vite build && electron-builder --win --publish never` | NSIS installer + portable .exe in `release/` |
| `build:portable` | `vite build && electron-builder --win portable --publish never` | Portable .exe only in `release/` |
| `preview` | `vite preview` | Preview the production build locally |

The `--publish never` flag is critical. It ensures electron-builder never attempts to contact update servers or publish artifacts online.

### Production Build Security Settings

The Vite production build disables source maps to prevent exposing internal logic on deployed machines:

```typescript
build: {
  sourcemap: false,       // Security: no source maps in production
  assetsInlineLimit: 0,
},
```

### electron-builder Configuration Explained

The `build` section in `package.json` defines how Electron packages the application:

```json
{
  "build": {
    "appId": "com.hospital.secure-deployment-runner",
    "productName": "Secure Deployment Runner",
    "files": [
      "dist/**",
      "electron/main.cjs",
      "package.json"
    ],
    "directories": {
      "output": "release"
    },
    "win": {
      "target": ["nsis", "portable"],
      "artifactName": "Secure-Deployment-Runner-${version}.${ext}"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": false,
      "runAfterFinish": false
    },
    "portable": {
      "artifactName": "Secure-Deployment-Runner-Portable-${version}.${ext}"
    },
    "extraResources": [
      {
        "from": "scripts/",
        "to": "scripts/",
        "filter": ["**/*"]
      }
    ]
  }
}
```

**Key fields:**

| Field | Purpose |
|---|---|
| `appId` | Unique identifier for the application; uses reverse-domain notation |
| `files` | Only bundles the Vite output (`dist/`), the Electron main process (`electron/main.cjs`), and `package.json` |
| `directories.output` | All built artifacts go into `release/` |
| `win.target` | Produces both an NSIS installer and a portable .exe |
| `nsis.oneClick` | Disabled so the user can choose the installation directory |
| `nsis.createDesktopShortcut` | Disabled -- hospital machines should not have random desktop shortcuts |
| `nsis.runAfterFinish` | Disabled -- the installer closes silently after completion |
| `portable.artifactName` | Names the portable executable clearly with version number |

### extraResources for the Scripts Directory

The `extraResources` block copies the entire `scripts/` directory into the packaged application's resources folder at build time. This ensures that `Gather-DeviceMetadata.bat`, `Gather-DeviceMetadata.ps1`, and `LaunchFromUSB.bat` are available at runtime alongside the Electron executable.

At runtime, these scripts are located at:

```
<app-root>/resources/scripts/Gather-DeviceMetadata.bat
<app-root>/resources/scripts/Gather-DeviceMetadata.ps1
<app-root>/resources/scripts/LaunchFromUSB.bat
```

---

## 2. Configuration Reference

### Target Version Constants (App.tsx)

These constants define the compliance targets against which each device is validated. They are declared at the top of `App.tsx`:

```typescript
const TARGET_BIOS_VERSION = 'A25';
const TARGET_DCU_VERSION  = '5.2.0';
const TARGET_WIN_VERSION  = '23H2';
```

| Constant | Default | Purpose |
|---|---|---|
| `TARGET_BIOS_VERSION` | `'A25'` | Expected Dell BIOS version. Devices not matching are flagged for BIOS update. |
| `TARGET_DCU_VERSION` | `'5.2.0'` | Expected Dell Command Update version. Non-matching devices are flagged. |
| `TARGET_WIN_VERSION` | `'23H2'` | Expected Windows feature update version. Non-matching devices are flagged. |

To change compliance targets, edit these constants and rebuild. The scan flow compares each device's reported version against these values and sets the `isBiosUpToDate`, `isDcuUpToDate`, and `isWinUpToDate` boolean flags accordingly.

### Advanced Settings (App.tsx)

These are configurable from the UI in Step 4 ("Advanced Settings") of the Deployment Runner:

| Setting | State Variable | Default | Range | Purpose |
|---|---|---|---|---|
| Max Retries | `maxRetries` | `3` | 1 -- 10 | Number of connection attempts per device before marking it Offline |
| Retry Delay | `retryDelay` | `2` (seconds) | 1 -- 30 | Seconds to wait between retry attempts |
| Auto Reboot | `autoRebootEnabled` | `false` (off) | on / off | When enabled, devices that need a reboot after update are rebooted automatically |

Validation is enforced in the input handler:

```typescript
setMaxRetries(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))
setRetryDelay(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))
```

### Session Timeout (App.tsx)

```typescript
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
```

| Setting | Value | Purpose |
|---|---|---|
| `SESSION_TIMEOUT_MS` | `1,800,000 ms` (30 minutes) | Auto-wipes credentials from memory if no mouse/keyboard activity is detected for 30 minutes |

The session timer resets on every `mousemove` or `keydown` event. When the timer expires, the credentials state is cleared:

```typescript
sessionTimerRef.current = setTimeout(() => {
    setCredentials({ username: '', password: '' });
    setSessionActive(false);
}, SESSION_TIMEOUT_MS);
```

### Device Scope Guard Limits (DeviceScopeGuard.tsx)

```typescript
const HARD_MAX_DEVICE_COUNT    = 200;
const DEFAULT_MAX_DEVICE_COUNT = 50;
```

| Constant | Value | Purpose |
|---|---|---|
| `HARD_MAX_DEVICE_COUNT` | `200` | Absolute ceiling. The operator cannot set the max device count above this value under any circumstances. |
| `DEFAULT_MAX_DEVICE_COUNT` | `50` | Default maximum shown in the Scope Guard modal. The operator can adjust down (to 1) or up (to 200). |

The input handler enforces these bounds:

```typescript
const handleMaxDeviceCountChange = (value: string) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1) {
        setMaxDeviceCount(1);
    } else if (parsed > HARD_MAX_DEVICE_COUNT) {
        setMaxDeviceCount(HARD_MAX_DEVICE_COUNT);
    } else {
        setMaxDeviceCount(parsed);
    }
};
```

### Network Share Path (Gather-DeviceMetadata.bat)

```batch
set "SHARE_PATH=\\DEPLOYSERVER\ImageMetadata$"
```

| Variable | Default | Purpose |
|---|---|---|
| `SHARE_PATH` | `\\DEPLOYSERVER\ImageMetadata$` | UNC path to the network file share where metadata JSON files are copied. The `$` suffix makes it a hidden administrative share. |
| `LOCAL_OUTPUT_DIR` | `%TEMP%\DeviceMetadata` | Local staging directory for JSON output and logs |
| `PS_TIMEOUT` | `120` (seconds) | Maximum time to wait for the PowerShell script to complete |

To adapt this for your environment, change `SHARE_PATH` to your deployment server's share path before building.

### Vite Server Configuration (vite.config.ts)

```typescript
export default defineConfig({
  server: {
    port: 3000,
    host: '127.0.0.1',
    open: false,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
```

| Setting | Value | Purpose |
|---|---|---|
| `host` | `'127.0.0.1'` | Binds to loopback only; prevents network exposure on the hospital LAN |
| `port` | `3000` | Development server port |
| `open` | `false` | Does not auto-open a browser window |
| `sourcemap` | `false` | No source maps in production builds |
| `assetsInlineLimit` | `0` | All assets are emitted as files (never inlined as data URIs) |
| `alias @` | project root | Allows `@/components/Header` style imports |

---

## 3. USB Deployment Setup

### Complete USB Preparation Steps

1. **Build the portable executable:**
   ```bash
   npm run build:portable
   ```

2. **Locate the output file** in the `release/` directory:
   ```
   release/Secure-Deployment-Runner-Portable-1.0.0.exe
   ```

3. **Format a USB drive** (NTFS recommended for file sizes > 4 GB; FAT32 is acceptable for the portable .exe alone).

4. **Copy the following to the USB root:**

   | Source | Destination on USB |
   |---|---|
   | `release/Secure-Deployment-Runner-Portable-1.0.0.exe` | `E:\Secure-Deployment-Runner-Portable-1.0.0.exe` |
   | `scripts/LaunchFromUSB.bat` | `E:\LaunchFromUSB.bat` |
   | `scripts/Gather-DeviceMetadata.bat` | `E:\scripts\Gather-DeviceMetadata.bat` |
   | `scripts/Gather-DeviceMetadata.ps1` | `E:\scripts\Gather-DeviceMetadata.ps1` |

5. **Optionally place your CSV device list and deployment .bat/.cmd scripts** on the USB as well for easy access.

### Directory Layout

```
E:\                                     (USB root)
|-- LaunchFromUSB.bat                   (Double-click to start)
|-- Secure-Deployment-Runner-Portable-1.0.0.exe
|-- scripts\
|   |-- Gather-DeviceMetadata.bat       (Task sequence orchestrator)
|   |-- Gather-DeviceMetadata.ps1       (PowerShell metadata collector)
|-- devices.csv                         (Optional: your device list)
|-- deploy-package.bat                  (Optional: your deployment script)
```

### LaunchFromUSB.bat Explained Line by Line

The launcher script is located at `scripts/LaunchFromUSB.bat`. Below is a line-by-line explanation:

```batch
@echo off
```
Suppresses command echoing for a clean console output.

```batch
setlocal EnableDelayedExpansion
```
Enables delayed variable expansion so variables set inside `for` loops and `if` blocks are resolved at execution time rather than parse time.

```batch
set "USB_DIR=%~dp0"
if "%USB_DIR:~-1%"=="\" set "USB_DIR=%USB_DIR:~0,-1%"
```
Detects the directory the `.bat` file is running from (`%~dp0` = drive + path of the batch file). Strips the trailing backslash for clean path joining.

```batch
set "APP_EXE="
for %%F in ("%USB_DIR%\Secure-Deployment-Runner-Portable-*.exe") do (
    set "APP_EXE=%%F"
)
```
Searches the USB root for any file matching the portable executable naming pattern. The wildcard `*` matches any version number.

```batch
if not defined APP_EXE (
    for %%F in ("%USB_DIR%\release\Secure-Deployment-Runner-Portable-*.exe") do (
        set "APP_EXE=%%F"
    )
)
```
Fallback: also checks a `release/` subdirectory in case the user copied the entire build output.

```batch
if not defined APP_EXE (
    echo [ERROR] Could not find Secure-Deployment-Runner-Portable-*.exe
    ...
    pause
    exit /b 1
)
```
If no executable is found in either location, displays an error with instructions and pauses so the operator can read the message.

```batch
set "ELECTRON_NO_ATTACH_CONSOLE=1"
set "ELECTRON_DISABLE_GPU=0"
```
Sets Electron environment variables. `ELECTRON_NO_ATTACH_CONSOLE=1` prevents the app from attaching to the launcher's console window. GPU acceleration is left enabled (`0` = not disabled).

```batch
set "SCRIPTS_DIR=%USB_DIR%\scripts"
if not exist "%SCRIPTS_DIR%" (
    echo [WARNING] Scripts directory not found: %SCRIPTS_DIR%
    ...
)
```
Checks that the `scripts/` directory exists next to the launcher. If missing, warns the operator that metadata collection scripts will be unavailable.

```batch
start "" "%APP_EXE%"
exit /b 0
```
Launches the portable executable in a new process (`start ""`) and immediately exits the launcher script with success code 0. The empty `""` is required by `start` as a window title placeholder.

### How the Electron Portable Build Works

The portable `.exe` produced by `electron-builder --win portable` is a single self-extracting executable. When launched:

1. It extracts the application files to a temporary directory (`%TEMP%\<random>`).
2. The Electron main process (`electron/main.cjs`) starts and creates a `BrowserWindow`.
3. The window loads `dist/index.html` (the Vite production build) via `mainWindow.loadFile()`.
4. All session data is cleared on startup (cookies, localStorage, sessionStorage, IndexedDB, cache storage) to prevent stale credential leakage.
5. A strict Content Security Policy is enforced via response headers.
6. Navigation is locked to `file:` protocol only; external navigation is blocked.
7. The `sandbox: true` and `contextIsolation: true` web preferences ensure the renderer process cannot access Node.js APIs.

The portable build stores **no persistent data** on the host machine. When the application is closed, all extracted files remain in the temp directory but contain no sensitive information (credentials are only held in React state memory and are never persisted).

### WinPE Compatibility Notes for Metadata Scripts

The `Gather-DeviceMetadata.ps1` script is designed to run in both full Windows and Windows PE environments:

- **PowerShell version:** Requires PowerShell 3.0+ (available in WinPE 5.0+ / Windows 8.1+ ADK).
- **WMI/CIM fallback:** The script prefers `Get-CimInstance` (modern) but falls back to `Get-WmiObject` (legacy) if CIM is unavailable:
  ```powershell
  if (Get-Command -Name Get-CimInstance -ErrorAction SilentlyContinue) {
      return Get-CimInstance @params
  } else {
      return Get-WmiObject @wmiParams
  }
  ```
- **BitLocker queries** may fail in WinPE (the `Win32_EncryptableVolume` class requires the full Windows environment). The script handles this gracefully and logs a warning.
- **Secure Boot detection** uses `Confirm-SecureBootUEFI` when available, falling back to a registry check (`HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\State`). Neither may work in WinPE; the script catches and logs the failure.
- **Task Sequence COM object:** The script attempts to create `Microsoft.SMS.TSEnvironment` to read SCCM/MDT variables. If not running in a task sequence, this fails silently and the script records `"Standalone Collection"` as the task sequence name.
- **No internet required.** All WMI/CIM queries are local. No external calls are made.

### Network Share Configuration for Metadata

The metadata collection workflow writes JSON to two locations:

1. **Local:** `%TEMP%\DeviceMetadata\<COMPUTERNAME>.json`
2. **Network:** `\\DEPLOYSERVER\ImageMetadata$\<COMPUTERNAME>.json`

To configure the network share:

1. Create a shared folder on your deployment server (e.g., `D:\ImageMetadata`).
2. Share it with a hidden share name: `ImageMetadata$`.
3. Grant **Write** permissions to the computer accounts or the service account used during task sequences.
4. Update `SHARE_PATH` in `Gather-DeviceMetadata.bat`:
   ```batch
   set "SHARE_PATH=\\YOUR-SERVER\ImageMetadata$"
   ```

If the network share is unreachable (common in early WinPE stages before network drivers load), the script logs a warning and preserves the local copy. You can manually retrieve it later.

---

## 4. Task Sequence Integration

### How Gather-DeviceMetadata.bat Fits into SCCM/MDT Task Sequences

The `Gather-DeviceMetadata.bat` script is designed to be inserted as a "Run Command Line" step in an SCCM or MDT task sequence. It collects hardware and software metadata from the device being imaged, writes the data as JSON, and copies it to a network share where the Image Monitor can read it.

### Where to Add the Step

Insert the metadata collection step **after the OS is applied** (so WMI classes are fully available) but **before the final reboot** (so the results can be written before the device restarts):

```
Task Sequence Steps:
  1. Partition Disk
  2. Apply Operating System Image
  3. Apply Windows Settings
  4. Apply Network Settings
  5. Apply Device Drivers
  6. Setup Windows and ConfigMgr
  7. Install Updates
  ====> 8. Run Command Line: Gather-DeviceMetadata.bat  <====
  9. Apply Final Configuration
  10. Final Reboot
```

**SCCM "Run Command Line" step configuration:**

| Field | Value |
|---|---|
| Name | `Gather Device Metadata` |
| Command line | `cmd.exe /c "X:\Scripts\Gather-DeviceMetadata.bat"` |
| Package | (none -- script runs from USB or local path) |
| Run in | (leave default) |
| Timeout | `300` seconds |
| Continue on error | `Yes` (metadata collection is non-critical) |

If running from USB during the task sequence, the drive letter will depend on the USB mount point (often `X:\` in WinPE or the next available letter in full Windows).

### How Gather-DeviceMetadata.ps1 Collects Data

The PowerShell script uses WMI/CIM cmdlets to query local hardware and software information. The collection happens in 8 sequential steps, each reporting progress to a polling file:

| Step | Progress | WMI/CIM Classes Used | Data Collected |
|---|---|---|---|
| 1. System Identity | 0-10% | `Win32_ComputerSystem`, `Win32_SystemEnclosure` | Manufacturer, model, total RAM, serial number, asset tag |
| 2. BIOS Information | 15-25% | `Win32_BIOS` | BIOS version (`SMBIOSBIOSVersion`), BIOS release date |
| 3. Network Configuration | 30-40% | `Win32_NetworkAdapterConfiguration`, `Win32_NetworkAdapter` | MAC addresses (all physical NICs), primary IP, default gateway, DNS servers |
| 4. Storage Information | 45-55% | `Win32_DiskDrive`, `Win32_LogicalDisk`, `Win32_DiskPartition` | Total disk capacity, system drive free space, partition layout |
| 5. Operating System | 60-65% | `Win32_OperatingSystem` | OS version, build number, caption, install date |
| 6. Security | 70-80% | `Win32_EncryptableVolume`, `Win32_Tpm`, Secure Boot registry/cmdlet | BitLocker status, TPM version, Secure Boot state, encryption readiness |
| 7. Task Sequence | 85-90% | `Microsoft.SMS.TSEnvironment` COM object | Task sequence name, current step, TS progress percentage |
| 8. Finalize | 95-100% | (none) | Final timestamp, completion flag |

Each WMI query is wrapped in `Get-WmiPropertySafe`, which catches `COMException`, `CimException`, `UnauthorizedAccessException`, and general exceptions. If a query fails, the field defaults to `'Unknown'` or `0` and the script continues.

### JSON Output Format (ImagingMetadata Interface)

The output JSON file conforms exactly to the `ImagingMetadata` TypeScript interface defined in `types.ts`:

```json
{
  "hostname": "EWSLE-PC01",
  "serialNumber": "ABC1234",
  "macAddress": "A4B1C2D3E4F5",
  "model": "OptiPlex 7090",
  "manufacturer": "Dell Inc.",
  "biosVersion": "A25",
  "biosDate": "2024-03-15",
  "totalRamMB": 16384,
  "diskSizeGB": 512,
  "osVersion": "10.0.22631",
  "ipAddress": "10.1.50.42",
  "taskSequenceName": "Win11 23H2 Hospital Standard",
  "collectedAt": "2025-06-15T14:30:00.000Z",
  "imageProgress": 100,
  "encryptionReady": true
}
```

| Field | Type | Source |
|---|---|---|
| `hostname` | `string` | `$env:COMPUTERNAME` |
| `serialNumber` | `string` | `Win32_SystemEnclosure.SerialNumber` |
| `macAddress` | `string` | First MAC from `Win32_NetworkAdapterConfiguration` (normalized: no colons, uppercase) |
| `model` | `string` | `Win32_ComputerSystem.Model` |
| `manufacturer` | `string` | `Win32_ComputerSystem.Manufacturer` |
| `biosVersion` | `string` | `Win32_BIOS.SMBIOSBIOSVersion` |
| `biosDate` | `string` | `Win32_BIOS.ReleaseDate` (formatted as `yyyy-MM-dd`) |
| `totalRamMB` | `number` | `Win32_ComputerSystem.TotalPhysicalMemory / 1MB` |
| `diskSizeGB` | `number` | Sum of `Win32_DiskDrive.Size / 1GB` for all disks |
| `osVersion` | `string` | `Win32_OperatingSystem.Version` |
| `ipAddress` | `string` | First non-APIPA, non-loopback IPv4 from `Win32_NetworkAdapterConfiguration` |
| `taskSequenceName` | `string` | SCCM `_SMSTSPackageName` or MDT `TaskSequenceName` or `"Standalone Collection"` |
| `collectedAt` | `string` | ISO 8601 timestamp at completion |
| `imageProgress` | `number` | From `_SMSTSProgressPercentComplete` or `100` if standalone |
| `encryptionReady` | `boolean` | `true` if BitLocker enabled or TPM 2.0 detected |

### Progress Polling File

The PowerShell script writes real-time progress to:

```
%TEMP%\imaging_progress.json
```

This file is updated at each collection step and has the following structure:

```json
{
  "hostname": "EWSLE-PC01",
  "status": "Collecting Metadata",
  "progress": 55,
  "currentStep": "Storage information collected",
  "timestamp": "2025-06-15T14:29:45.123Z"
}
```

The `Gather-DeviceMetadata.bat` script also copies this progress file to the network share as `<COMPUTERNAME>_progress.json`, enabling the Image Monitor to poll imaging status from the share.

### Error Handling and Logging in the Scripts

**Batch script (`Gather-DeviceMetadata.bat`):**

- Uses a `:LogMessage` function that writes timestamped `[LEVEL] Message` entries to both the console and `%TEMP%\DeviceMetadata\Gather-DeviceMetadata.log`.
- Exit codes are passed through from the PowerShell script to the task sequence:

| Exit Code | Meaning |
|---|---|
| `0` | Success -- metadata collected and written |
| `1` | PowerShell script internal error (unhandled exception, write failure) |
| `2` | PowerShell script not found (`.ps1` missing from the same directory) |
| `3` | `powershell.exe` not found in PATH (WinPE without PowerShell component) |
| `4` | PowerShell script failed AND no output JSON was generated |
| `5` | Expected JSON output file does not exist after script completed |

- Even on partial failure (non-zero exit code), the script attempts to copy whatever JSON was generated.
- Network copy failures are logged as warnings but do not fail the task sequence step.

**PowerShell script (`Gather-DeviceMetadata.ps1`):**

- Runs under `Set-StrictMode -Version Latest` with `$ErrorActionPreference = 'Continue'`.
- Every WMI query is wrapped in `Get-WmiPropertySafe` with typed `catch` blocks for `COMException`, `CimException`, `UnauthorizedAccessException`, and a general catch-all.
- The top-level `try/catch/finally` ensures an exit code is always set:
  ```powershell
  catch {
      Write-Log "Unhandled exception: $_" -Level ERROR
      Write-Log "Stack trace: $($_.ScriptStackTrace)" -Level ERROR
      $script:ExitCode = 1
      # Attempt to write error state to progress file
      Update-ProgressFile -Hostname $hostname -Status 'Imaging Failed' -Progress 0 -CurrentStep "Error: $_"
  }
  finally {
      exit $script:ExitCode
  }
  ```
- If metadata collection fails catastrophically, the progress file is updated with `"status": "Imaging Failed"` so the Image Monitor reflects the failure.

---

## 5. Device Form Factor System

### How detectDeviceType() Works

The `detectDeviceType()` function in `App.tsx` determines the physical form factor of a Dell enterprise device based on its hostname. It performs case-insensitive substring matching against known naming convention patterns.

```typescript
const detectDeviceType = (hostname: string): DeviceFormFactor => {
    const upper = hostname.toUpperCase();
    // Pattern matching in priority order...
};
```

**Priority order matters.** More specific patterns (Wyse, VDI, detachable) are tested before generic fallbacks (laptop, desktop). The function returns the **first match**, so ordering prevents a device like `WYSE-PC01` from falling through to the generic desktop fallback.

### All 10 Form Factors with Hostname Patterns

The detection rules are evaluated in this exact order:

| Priority | Form Factor | Type Key | Hostname Patterns | Example Hostnames |
|---|---|---|---|---|
| 1 | Wyse Thin Client | `wyse` | `WYSE`, `WYS`, `THIN`, `TC` + digit | `WYSE5070-001`, `THIN-LAB3`, `TC4200-RX` |
| 2 | Virtual Desktop | `vdi` | `VDI`, `VIRT`, `VD-` or `VD_` | `VDI-USER42`, `VIRT-PC01`, `VD-CLINIC3` |
| 3 | Detachable 2-in-1 | `detachable` | `EDTCH`, `DET`, `2IN1`, `DTCH` | `EDTCH-NURSE1`, `2IN1-WARD5`, `DET-MOBILE` |
| 4 | Pro 16" Laptop | `laptop-16` | `EPLPR`, `L16`, `LAT16`, `PRE16`, `PRE56`, `PRE57` | `EPLPR-DEV01`, `LAT16-ADMIN`, `PRE5690-ENG` |
| 5 | Standard 14" Laptop | `laptop-14` | `ELSLE`, `ESLSC`, `L14`, `LAT14`, `LAT54`, `LAT74` | `ELSLE-HR002`, `LAT14-CLINIC`, `LAT5450-01` |
| 6 | Tower Desktop | `tower` | `EWSTW`, `TWR`, `TOWER`, `PRETW` | `EWSTW-SERVER1`, `TWR-LAB4`, `TOWER-IT01` |
| 7 | Micro Form Factor | `micro` | `EWSMF`, `EWSMC`, `MFF`, `MICRO` | `EWSMF-RECEP`, `MFF-LOBBY`, `MICRO-NURSE` |
| 8 | Small Form Factor | `sff` | `EWSSF`, `SFF` | `EWSSF-OFFICE3`, `SFF-FINANCE01` |
| 9 | Generic Laptop | `laptop` | `LAT`, `LAPTOP`, `NB`, `PRE5`, `PRE7` | `LAT-SPARE`, `LAPTOP-TEMP`, `NB-TEST01` |
| 10 | Generic Desktop (default) | `desktop` | (everything else) | `PC-ADMIN01`, `WS-PHARM`, `UNKNOWN-001` |

### How to Add Custom Patterns for Your Organization

To add a new hostname pattern:

1. Open `App.tsx` and locate the `detectDeviceType()` function.
2. Add your pattern at the appropriate priority position. For example, to detect rugged tablets with hostnames containing `RGD`:

```typescript
// --- Rugged tablets (add before detachable check) ---
if (upper.includes('RGD') || upper.includes('RUGGED')) {
    return 'detachable'; // Map to existing form factor
}
```

3. If you need a **new form factor** (not one of the 10 existing ones), you must also:
   - Add the new literal to the `DeviceFormFactor` union type in `types.ts`:
     ```typescript
     export type DeviceFormFactor =
       | 'laptop-14'
       | 'laptop-16'
       // ... existing ...
       | 'rugged';   // NEW
     ```
   - Add an SVG icon case in `DeviceIcon.tsx`.
   - Add a label in `FORM_FACTOR_LABELS` in `DeviceIcon.tsx`.
   - Add model name options in the `modelMap` in `App.tsx`.

### How DeviceIcon.tsx Maps Form Factors to SVG Icons

`DeviceIcon.tsx` exports a single React component that renders an inline SVG based on the `DeviceFormFactor` type:

```typescript
export const DeviceIcon: React.FC<DeviceIconProps> = ({ type }) => {
    const base = 'h-5 w-5 flex-shrink-0';
    const label = FORM_FACTOR_LABELS[type] ?? 'Device';

    switch (type) {
        case 'laptop-14':  // Blue laptop with "14" text
        case 'laptop-16':  // Indigo laptop with "16" text
        case 'detachable': // Teal tablet with detached keyboard
        case 'laptop':     // Slate generic clamshell
        case 'sff':        // Emerald monitor + short chassis
        case 'micro':      // Amber monitor + tiny box
        case 'tower':      // Orange monitor + tall chassis
        case 'wyse':       // Cyan slim vertical box
        case 'vdi':        // Violet cloud + monitor
        case 'desktop':    // Slate generic desktop (default)
    }
};
```

Each icon uses a distinct Tailwind color class for instant visual differentiation:

| Form Factor | Icon Color | Tailwind Class |
|---|---|---|
| `laptop-14` | Blue | `text-blue-400` |
| `laptop-16` | Indigo | `text-indigo-400` |
| `detachable` | Teal | `text-teal-400` |
| `laptop` | Slate | `text-slate-400` |
| `sff` | Emerald | `text-emerald-400` |
| `micro` | Amber | `text-amber-400` |
| `tower` | Orange | `text-orange-400` |
| `wyse` | Cyan | `text-cyan-400` |
| `vdi` | Violet | `text-violet-400` |
| `desktop` | Slate | `text-slate-400` |

Every SVG includes an accessible `<title>` element with a human-readable label (e.g., "Standard 14\" Laptop", "Wyse Thin Client") from the `FORM_FACTOR_LABELS` record.

### How modelMap Generates Simulated Model Names

During the scan simulation phase, the `modelMap` in `App.tsx` assigns a realistic Dell model name based on the detected form factor:

```typescript
const modelMap: Record<DeviceFormFactor, string[]> = {
    'laptop-14':  ['Latitude 5450', 'Latitude 7450', 'Latitude 5440'],
    'laptop-16':  ['Latitude 9640', 'Precision 5690', 'Precision 5680'],
    'detachable': ['Latitude 7350 Detachable', 'Latitude 7230 Rugged Extreme'],
    'laptop':     ['Latitude 7420', 'Latitude 5430', 'Precision 5560'],
    'sff':        ['OptiPlex 7020 SFF', 'OptiPlex 5000 SFF', 'OptiPlex 7010 SFF'],
    'micro':      ['OptiPlex 7020 Micro', 'OptiPlex 7010 Micro', 'OptiPlex 3000 Micro'],
    'tower':      ['OptiPlex 7020 Tower', 'Precision 3680 Tower', 'OptiPlex 5000 Tower'],
    'wyse':       ['Wyse 5070', 'Wyse 5470', 'Wyse 3040'],
    'vdi':        ['VDI Virtual Desktop', 'VMware Horizon Client', 'Citrix Workspace'],
    'desktop':    ['OptiPlex 7090', 'OptiPlex 5000', 'Precision 3650'],
};
```

A random model is selected from the array for each device:

```typescript
const models = modelMap[deviceFormFactor];
const model = models[Math.floor(Math.random() * models.length)];
```

In a production deployment with real WMI data, this simulated model name would be replaced by the actual `Win32_ComputerSystem.Model` value returned by `Gather-DeviceMetadata.ps1`.

---

## 6. CSV Import System

### How PapaParse Is Configured

The CSV import uses [PapaParse](https://www.papaparse.com/) v5.5.3 with the following configuration in `App.tsx`:

```typescript
Papa.parse<Record<string, string>>(csvFile, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => { /* ... */ }
});
```

| Option | Value | Purpose |
|---|---|---|
| `header` | `true` | Treats the first row as column headers. Each data row becomes a `Record<string, string>` keyed by header names. |
| `skipEmptyLines` | `true` | Ignores blank rows in the CSV (common at end of file). |
| `dynamicTyping` | not set (defaults to `false`) | All values remain as strings. MAC addresses and hostnames are never coerced to numbers. |

Note: `dynamicTyping` is intentionally left at its default (`false`). If it were set to `true`, MAC addresses like `001122334455` could be interpreted as numbers and lose leading zeros.

### Column Name Auto-Detection

PapaParse returns the detected header names in `results.meta.fields`. The application uses case-insensitive substring matching to find the hostname and MAC address columns:

```typescript
const hostnameCol = header.find(h =>
    h.toLowerCase().includes('hostname') ||
    h.toLowerCase().includes('computername') ||
    h.toLowerCase().includes('devicename') ||
    h.toLowerCase().includes('computer') ||
    h.toLowerCase().includes('name') ||
    h.toLowerCase().includes('device')
);

const macCol = header.find(h =>
    h.toLowerCase().replace(/[\s_-]/g, '').includes('macaddress') ||
    h.toLowerCase().trim() === 'mac'
);
```

**Hostname column** matches any header containing (case-insensitive):

| Pattern | Example Headers That Match |
|---|---|
| `hostname` | `Hostname`, `HostName`, `Device Hostname` |
| `computername` | `ComputerName`, `Computer_Name` |
| `devicename` | `DeviceName`, `Device Name` |
| `computer` | `Computer`, `Target Computer` |
| `name` | `Name`, `Device Name`, `Machine Name` |
| `device` | `Device`, `Device ID` |

**MAC column** matches any header where (case-insensitive, after stripping spaces/underscores/hyphens):

| Pattern | Example Headers That Match |
|---|---|
| `macaddress` (normalized) | `MAC Address`, `Mac_Address`, `MACAddress`, `mac-address` |
| `mac` (exact) | `MAC`, `mac` |

If either column cannot be found, the import fails with:
```
CSV must contain columns for 'Hostname' and 'MAC Address'.
```

### MAC Address Validation and Normalization

**Normalization** strips all common delimiter characters and converts to uppercase:

```typescript
const normalizeMacAddress = (mac: string): string => {
    if (!mac) return '';
    return mac.replace(/[:\-.\s]/g, '').toUpperCase();
};
```

**Validation** checks that the normalized result is exactly 12 hexadecimal characters:

```typescript
const isValidMacAddress = (mac: string): boolean => {
    if (!mac) return false;
    const normalized = mac.replace(/[:\-.\s]/g, '').toUpperCase();
    return /^[0-9A-F]{12}$/.test(normalized);
};
```

### Accepted MAC Formats

All of the following formats are accepted and normalized to `A4B1C2D3E4F5`:

| Input Format | Example | Normalized |
|---|---|---|
| Colon-separated | `A4:B1:C2:D3:E4:F5` | `A4B1C2D3E4F5` |
| Hyphen-separated | `A4-B1-C2-D3-E4-F5` | `A4B1C2D3E4F5` |
| Dot-separated (Cisco style) | `A4B1.C2D3.E4F5` | `A4B1C2D3E4F5` |
| Space-separated | `A4 B1 C2 D3 E4 F5` | `A4B1C2D3E4F5` |
| No delimiters | `A4B1C2D3E4F5` | `A4B1C2D3E4F5` |
| Lowercase | `a4:b1:c2:d3:e4:f5` | `A4B1C2D3E4F5` |
| Mixed case | `a4:B1:c2:D3:e4:F5` | `A4B1C2D3E4F5` |

**Rejected formats** (any of these will cause the row to be skipped):

| Issue | Example | Why Rejected |
|---|---|---|
| Too short | `A4:B1:C2:D3:E4` | Only 10 hex chars after normalization |
| Too long | `A4:B1:C2:D3:E4:F5:00` | 14 hex chars after normalization |
| Non-hex characters | `A4:B1:C2:D3:E4:GG` | `G` is not a valid hex digit |
| Empty | (blank cell) | Fails the `!mac` check |

### Error Handling for Invalid Rows

The CSV parser processes each row individually with detailed error reporting:

1. **Both hostname and MAC empty:** The row is silently skipped (common for trailing blank rows).

2. **Hostname empty, MAC present:**
   ```
   Skipping row 5: Hostname is empty.
   ```

3. **Hostname present, invalid MAC:**
   ```
   [Validation Skip] Skipping device "PC-ADMIN01" from row 5. Reason: Invalid MAC address format.
   ```

4. **CSV parsing errors** (malformed CSV syntax): PapaParse returns these in `results.errors`. If any parsing errors exist, the entire import is aborted:
   ```
   CSV parsing errors: 3 error(s) found.
   ```

5. **Missing required columns** (no hostname or MAC column detected):
   ```
   CSV must contain columns for 'Hostname' and 'MAC Address'.
   ```

6. **No valid devices after parsing:**
   ```
   No valid devices found in the CSV file to process.
   ```

After parsing completes, a summary is logged:
```
Skipped 3 invalid or incomplete entries from CSV. See logs for details.
Validated and loaded 47 devices from devices.csv.
```

All skipped rows include the 1-indexed row number (accounting for the header row: data row 1 = CSV row 2, so the log shows `row ${index + 2}`), making it straightforward to locate and fix issues in the source CSV file.
