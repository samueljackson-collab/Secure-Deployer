# Advanced Topics

> Extending the analyzer, adding device form factors, customizing workflows, and CI/CD integration.

---

## Table of Contents

- [Extending the Script Safety Analyzer](#extending-the-script-safety-analyzer)
- [Adding New Device Form Factors](#adding-new-device-form-factors)
- [Customizing the Image Monitor](#customizing-the-image-monitor)
- [Customizing the Deployment Flow](#customizing-the-deployment-flow)
- [Building Custom Task Sequence Scripts](#building-custom-task-sequence-scripts)
- [CI/CD Integration](#cicd-integration)
- [Performance Considerations](#performance-considerations)

---

## Extending the Script Safety Analyzer

The analyzer at `services/scriptSafetyAnalyzer.ts` uses three pattern arrays: `BLOCKED_PATTERNS`, `DANGER_PATTERNS`, and `WARNING_PATTERNS`. Each entry is a `PatternRule` object.

### PatternRule Interface

```typescript
interface PatternRule {
    regex: RegExp;              // Tested against each line (case-insensitive)
    severity: 'BLOCKED' | 'DANGER' | 'WARNING' | 'INFO';
    description: string;        // What the pattern detects
    recommendation: string;     // How to fix/avoid it
}
```

### Adding a New BLOCKED Pattern

**Example**: Block `Clear-EventLog` (which destroys forensic evidence).

**Step 1**: Add the rule to `BLOCKED_PATTERNS` in `scriptSafetyAnalyzer.ts`:

```typescript
// In the BLOCKED_PATTERNS array:
{
    regex: /Clear-EventLog/i,
    severity: 'BLOCKED',
    description: 'Clear-EventLog command detected. This destroys Windows event log data needed for security auditing.',
    recommendation: 'Never clear event logs via deployment scripts. Event logs are critical for incident response.',
},
```

**Step 2**: Test the new pattern. Create a test `.bat` file containing `Clear-EventLog` and upload it. The analyzer should now show a BLOCKED finding.

### Adding a New DANGER Pattern

**Example**: Flag `Restart-Service` (less dangerous than stop, but still disruptive).

```typescript
// In the DANGER_PATTERNS array:
{
    regex: /Restart-Service/i,
    severity: 'DANGER',
    description: 'PowerShell service restart detected. Service disruption can affect hospital workflows.',
    recommendation: 'Verify the service and confirm the restart window with operations.',
},
```

### Adding a New WARNING Pattern

**Example**: Flag `Start-Service` (informational — operator should know about it).

```typescript
// In the WARNING_PATTERNS array:
{
    regex: /Start-Service/i,
    severity: 'WARNING',
    description: 'PowerShell service start detected.',
    recommendation: 'Verify the service is expected to be started by this script.',
},
```

### Severity Hierarchy

```
INFO (0) < WARNING (1) < DANGER (2) < BLOCKED (3)
```

The overall risk level is determined by the worst finding:
- Any BLOCKED finding → `CRITICAL` risk, `isSafe = false`
- DANGER (no BLOCKED) → `HIGH` risk, `isSafe = true` (manual override needed)
- WARNING (no DANGER) → `MEDIUM` risk, `isSafe = true`
- INFO only → `LOW` risk, `isSafe = true`

### How Scope Violation Detection Works

Three functions detect scope issues:

1. **`extractReferencedHostnames()`** — Extracts hostnames from:
   - UNC paths: `\\HOSTNAME\share`
   - `-ComputerName HOSTNAME`
   - `/node:HOSTNAME`
   - `psexec \\HOSTNAME`
   - `shutdown /m \\HOSTNAME`

2. **`detectSubnetTargeting()`** — Flags per-line:
   - CIDR notation: `10.0.0.0/24`
   - IP ranges: `10.0.0.1-10.0.0.254`
   - Wildcard IPs: `10.0.0.*`
   - Broadcast addresses: `10.0.0.255`
   - PowerShell range sweeps: `1..254`

3. **`detectWildcardTargeting()`** — Flags per-line:
   - `Get-ADComputer -Filter *`
   - `Get-ADComputer ... | ForEach`

### Comment Detection

The analyzer skips comment lines to avoid false positives:

- Batch comments: Lines starting with `REM ` or `::`
- PowerShell comments: Lines starting with `#`
- PowerShell block comments: `<# ... #>` (tracked across lines)

---

## Adding New Device Form Factors

Adding a new form factor requires changes to 3 files. Here's a complete example for adding a "Rugged" form factor for Dell Latitude Rugged devices.

### Step 1: Add to DeviceFormFactor Type (`types.ts`)

```typescript
export type DeviceFormFactor =
    | 'laptop-14'
    | 'laptop-16'
    | 'detachable'
    | 'laptop'
    | 'sff'
    | 'micro'
    | 'tower'
    | 'wyse'
    | 'vdi'
    | 'rugged'        // ← ADD THIS
    | 'desktop';
```

### Step 2: Add Detection Pattern (`App.tsx`)

Add before the generic laptop fallback (order matters — more specific first):

```typescript
// In detectDeviceType():

// --- Rugged laptop (add before generic laptop) ---
if (upper.includes('RUGGED') || upper.includes('RGD') || upper.includes('LAT72') || upper.includes('LAT54R')) {
    return 'rugged';
}
```

### Step 3: Add Icon and Label (`DeviceIcon.tsx`)

Add to `FORM_FACTOR_LABELS`:

```typescript
'rugged': 'Rugged Laptop',
```

Add a new case to the switch in the component:

```typescript
case 'rugged':
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-yellow-500`}
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <title>{label}</title>
            {/* Rugged chassis with reinforced corners */}
            <rect x="3" y="3" width="18" height="12" rx="2" />
            <path strokeLinecap="round" d="M2 18h20" />
            <path strokeLinecap="round" d="M9 20h6" />
            {/* Corner reinforcement marks */}
            <path strokeLinecap="round" d="M4 4l1.5 1.5" />
            <path strokeLinecap="round" d="M20 4l-1.5 1.5" />
            <path strokeLinecap="round" d="M4 14l1.5-1.5" />
            <path strokeLinecap="round" d="M20 14l-1.5-1.5" />
        </svg>
    );
```

### Step 4: Add Model Names (`App.tsx`)

Add to the `modelMap` in the scan simulation:

```typescript
'rugged': ['Latitude 7230 Rugged Extreme', 'Latitude 5430 Rugged', 'Latitude 7330 Rugged'],
```

### Step 5: Rebuild

```bash
npm run build:portable
```

---

## Customizing the Image Monitor

### How Metadata JSON Processing Works

`ImageMonitor.tsx` processes JSON files through these steps:

1. **File input** — Drag-and-drop or file picker triggers `processFiles()`
2. **JSON parse** — Each file is read as text and parsed as JSON
3. **Validation** — Checks for required fields (`hostname`, `macAddress`)
4. **MAC validation** — `validateMacAddress()` normalizes and validates
5. **Deduplication** — Checks for existing devices with same MAC
6. **State update** — Adds to the imaging device list

### Adding New Metadata Fields

To collect and display a new field (e.g., `tpmVersion`):

1. **Add to ImagingMetadata interface** (`types.ts`):
```typescript
export interface ImagingMetadata {
    // ... existing fields ...
    tpmVersion?: string;    // ← ADD THIS
}
```

2. **Collect in PowerShell script** (`Gather-DeviceMetadata.ps1`):
```powershell
# Add to the metadata collection steps:
$tpm = Get-CimInstance -Namespace "root\cimv2\Security\MicrosoftTpm" -ClassName Win32_Tpm
$metadata.tpmVersion = $tpm.SpecVersion
```

3. **Display in Image Monitor** (`ImageMonitor.tsx`):
Add the field to the device card rendering section.

### How the Promotion Workflow Works

1. User selects completed devices in Image Monitor
2. `handlePromoteDevices()` is called with the selected `ImagingMetadata[]`
3. `App.tsx` converts each `ImagingMetadata` to a `Device` object:
   - `hostname` → `device.hostname`
   - `macAddress` → `device.mac`
   - `model` → `device.model`
   - `serialNumber` → `device.serialNumber`
   - `totalRamMB / 1024` → `device.ramAmount`
   - Status set to `'Pending'`
   - Form factor detected from hostname
4. Devices are added to the `devices` state array
5. View switches to Deployment Runner tab

---

## Customizing the Deployment Flow

### How `runDeploymentFlow` Works

The main deployment function in `App.tsx` executes sequentially:

```
1. Wake-on-LAN     → sendWakeOnLan(device.mac) for each device
2. Wait 30 seconds → Devices boot up
3. Connect          → Per-device with retries (configurable)
4. Scan             → BIOS check → DCU check → Windows check
5. Results          → Set compliance flags, update status
```

### Adding New Compliance Dimensions

To add a new check (e.g., Dell Command Monitor version):

1. **Add fields to Device interface** (`types.ts`):
```typescript
dcmVersion?: string;
isDcmUpToDate?: boolean;
```

2. **Add target constant** (`App.tsx`):
```typescript
const TARGET_DCM_VERSION = '10.8.0';
```

3. **Add to scan phase** (`App.tsx` in the scan section):
```typescript
// After DCU check, add DCM check:
updateDeviceStatus(device.id, 'Checking DCM');
await simulateDelay(1000);
const dcmVersion = '10.7.0'; // Replace with actual WMI query
const isDcmUpToDate = dcmVersion >= TARGET_DCM_VERSION;
```

4. **Add to DeviceStatusTable** (`DeviceStatusTable.tsx`):
Add a `<DetailItem label="DCM" value={device.dcmVersion} />` row.

### How Updates Execute

`handleUpdateDevice()` processes component updates sequentially:

1. Check `isBiosUpToDate` — if false, run BIOS update
2. Check `isDcuUpToDate` — if false, run DCU update
3. Check `isWinUpToDate` — if false, run Windows update
4. Track succeeded/failed components in `lastUpdateResult`

The sequential order ensures BIOS is updated before Windows (some BIOS updates require the older OS version to apply correctly).

---

## Building Custom Task Sequence Scripts

### How `Gather-DeviceMetadata.ps1` Is Structured

The PowerShell script follows an 8-step collection process:

| Step | What It Collects | WMI/CIM Class |
|------|-----------------|---------------|
| 1 | System Identity | `Win32_ComputerSystem` |
| 2 | BIOS Info | `Win32_BIOS` |
| 3 | Network Config | `Win32_NetworkAdapterConfiguration` |
| 4 | Storage | `Win32_DiskDrive`, `Win32_LogicalDisk` |
| 5 | OS Details | `Win32_OperatingSystem` |
| 6 | Security | `Win32_Tpm`, `Confirm-SecureBootUEFI` |
| 7 | Task Sequence | `Microsoft.SMS.TSEnvironment` COM object |
| 8 | Finalization | Build JSON, write to disk and network share |

### Adding a New Collection Step

**Example**: Collect installed software list.

Add between steps 5 and 6:

```powershell
# Step 5.5: Installed Software
Write-Progress -Activity "Collecting Metadata" -Status "Step 5.5 of 8: Installed Software"

$software = Get-CimInstance -ClassName Win32_Product | Select-Object Name, Version
$metadata.installedSoftware = $software | ForEach-Object {
    @{ name = $_.Name; version = $_.Version }
}
```

### Integrating with Non-SCCM Systems

The metadata script can be adapted for other deployment systems:

- **WDS (Windows Deployment Services)**: Run from `SetupComplete.cmd`
- **Intune/Autopilot**: Run as a PowerShell script policy
- **Manual imaging**: Run from an admin PowerShell prompt
- **PXE boot**: Include in the WinPE image

The key requirement is PowerShell availability and write access to the output directory.

---

## CI/CD Integration

### Automated Builds

```yaml
# Example GitHub Actions workflow
name: Build Portable
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build:portable
      - uses: actions/upload-artifact@v4
        with:
          name: portable-build
          path: release/Secure-Deployment-Runner-Portable-*.exe
```

### Version Management

Version is set in `package.json`:

```json
"version": "1.0.0"
```

Bump the version before each release. The version appears in:
- The portable executable filename
- The Electron app title bar
- The installer filename

### Testing Strategy

| Test Type | What to Test | Tool |
|-----------|-------------|------|
| Type checking | TypeScript compilation | `npx tsc --noEmit` |
| Pattern coverage | Script analyzer patterns | Unit tests with known-dangerous scripts |
| CSV parsing | Various CSV formats | Unit tests with edge-case CSVs |
| Build verification | Portable build succeeds | `npm run build:portable` |
| Manual smoke test | End-to-end workflow | Upload CSV → script → scan → verify |

### USB Image Distribution

After building:

1. Copy `release/Secure-Deployment-Runner-Portable-*.exe` to a master USB
2. Copy `scripts/` directory to the USB
3. Copy `LaunchFromUSB.bat` to the USB
4. Create additional USBs by cloning the master
5. Verify each USB by launching the app

---

## Performance Considerations

### Large Device Lists (500+ Devices)

React handles large device lists efficiently because:

- **DeviceStatusTable** renders all devices in a scrollable container
- Status badge updates trigger re-renders only for changed devices
- `Set<number>` for `selectedDeviceIds` provides O(1) lookup

For very large lists (1000+), consider:
- Pagination in the DeviceStatusTable
- Virtual scrolling (e.g., `react-window`)
- Batching WoL packets (currently sent sequentially)

### Bulk Operation Performance

Bulk updates use `Promise.all` for parallel processing — but on a hospital network, parallelism is limited by:
- Network bandwidth to the deployment server
- Target device CPU (BIOS updates are single-threaded)
- WMI connection limits (Windows default: ~15 concurrent)

Recommended: Deploy in batches of 25–50 devices to avoid network congestion.

### Log Viewer Performance

The log viewer appends entries to a `LogEntry[]` array. For very long sessions (1000+ log entries):
- The log viewer auto-scrolls to the latest entry
- React re-renders the entire log list on each new entry
- For extremely long sessions, consider adding a "Clear Logs" button

### Memory Usage

- Each `Device` object: ~2KB
- Each `LogEntry`: ~200 bytes
- Script analysis result: ~5KB per script
- 500 devices + 1000 logs ≈ 1.2MB — well within Electron's memory limits
