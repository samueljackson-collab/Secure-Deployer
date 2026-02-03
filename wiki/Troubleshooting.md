# Troubleshooting

> Common issues, diagnostic procedures, decision trees, and frequently asked questions.

---

## Table of Contents

- [Quick Diagnostic Decision Tree](#quick-diagnostic-decision-tree)
- [Common Issues](#common-issues)
- [Script Safety Analyzer Issues](#script-safety-analyzer-issues)
- [CSV and Device Loading Issues](#csv-and-device-loading-issues)
- [Deployment Issues](#deployment-issues)
- [Image Monitor Issues](#image-monitor-issues)
- [USB and Build Issues](#usb-and-build-issues)
- [Credential and Session Issues](#credential-and-session-issues)
- [Log Analysis](#log-analysis)
- [FAQ](#faq)

---

## Quick Diagnostic Decision Tree

```
START: What is the problem?
│
├── App won't launch
│   ├── Portable .exe? → Check Windows version (need 1809+)
│   ├── Dev mode? → Run `npm run dev`, check terminal for errors
│   └── Second instance? → Close other window (single-instance lock)
│
├── CSV not loading
│   ├── No devices appear? → Check column headers (hostname/mac required)
│   ├── Some devices missing? → Check MAC address format (need 12 hex chars)
│   └── Wrong form factor icons? → Check hostname patterns match your convention
│
├── Script blocked
│   ├── CRITICAL risk? → Script contains BLOCKED patterns — must be rewritten
│   ├── HIGH risk? → DANGER patterns need manual review and override
│   └── False positive? → Add exception or modify pattern in scriptSafetyAnalyzer.ts
│
├── Devices show Offline
│   ├── Single device? → Check device power, network cable, ping manually
│   ├── All devices? → Check operator network connectivity, firewall rules
│   └── After WoL? → Device may need longer boot time, check Wake-on-LAN BIOS setting
│
├── Credentials disappeared
│   ├── Were you away? → 30-min session timeout — re-enter credentials
│   ├── App restarted? → Credentials are in-memory only — re-enter
│   └── Never saved? → Credentials are never written to disk (by design)
│
├── Image Monitor empty
│   ├── No devices? → Drag-and-drop metadata JSON files into the monitor
│   ├── JSON rejected? → Check JSON format matches ImagingMetadata interface
│   └── Metadata not generated? → Check PowerShell availability in WinPE
│
└── Build/USB issues
    ├── Build fails? → Run `npm install` first, check Node.js version (18+)
    ├── USB app won't start? → Check .exe is at USB root, use LaunchFromUSB.bat
    └── Scripts missing? → Copy scripts/ directory to USB root
```

---

## Common Issues

### 1. Application Won't Launch

| Symptom | Cause | Fix |
|---------|-------|-----|
| Nothing happens when double-clicking .exe | Windows SmartScreen blocking | Right-click → Properties → Unblock |
| "Another instance is running" | Single-instance lock | Close the other instance |
| Black window | GPU driver issue | Hardware acceleration is disabled — try updating GPU drivers |
| Dev server won't start | Port 3000 in use | Kill the process on port 3000 or change port in vite.config.ts |

### 2. CSV Upload Fails

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No devices found" after upload | Column headers not recognized | Use accepted names: `hostname`/`computername`/`devicename` + `macaddress`/`mac` |
| Some devices missing | Invalid MAC addresses | Check MAC is 12 hex chars (after removing separators) |
| Duplicate devices | Same hostname appears twice in CSV | Remove duplicates from source CSV |
| Wrong file type | Not a CSV file | Ensure file has .csv extension and comma-separated values |

### 3. Devices Show Wrong Form Factor Icon

| Symptom | Cause | Fix |
|---------|-------|-----|
| All devices show generic desktop icon | Hostnames don't match any specific pattern | Add your hostname convention to `detectDeviceType()` in App.tsx |
| Laptop showing as desktop | Missing laptop hostname indicator | Ensure hostname contains `ELSLE`, `ESLSC`, `LAT`, `L14`, `L16`, or similar |
| Wrong specific icon | Hostname matches unexpected pattern first | Check detection priority order — more specific patterns match first |

### 4. Script Blocked by Safety Analyzer

| Symptom | Cause | Fix |
|---------|-------|-----|
| CRITICAL risk — script blocked | Contains BLOCKED patterns | Open Script Analysis Modal, review each finding, rewrite the script |
| HIGH risk — manual override needed | Contains DANGER patterns | Review each finding, assess if the command is necessary and safe |
| Scope violation — hostname not in list | Script references devices not in CSV | Add the hostname to your CSV or remove it from the script |
| False positive on a safe command | Pattern is too broad | Narrow the pattern in `scriptSafetyAnalyzer.ts` or restructure the script |

---

## Script Safety Analyzer Issues

### Understanding Analysis Results

The Script Analysis Modal shows:

1. **Risk Level Banner** — Overall risk (LOW/MEDIUM/HIGH/CRITICAL)
2. **Blocked Patterns** — Commands that will prevent execution (red)
3. **Scope Violations** — Hostnames or IPs not in the approved list (orange)
4. **Individual Findings** — Per-line results with severity, description, and recommendation

### Common Blocked Pattern Solutions

| Blocked Pattern | Example | How to Fix |
|----------------|---------|-----------|
| `shutdown` without `/t` | `shutdown /r` | Add timeout: `shutdown /r /t 60` |
| `shutdown` with wildcard | `shutdown /r /m \\*` | Target specific hostname: `shutdown /r /m \\HOSTNAME` |
| `net stop` critical service | `net stop DNS` | Don't stop infrastructure services via deployment scripts |
| `format` command | `format D:` | Never include format commands in deployment scripts |
| `diskpart` | `diskpart /s script.txt` | Use proper imaging workflows instead |
| Firewall disable | `netsh advfirewall set allprofiles state off` | Add specific rules: `netsh advfirewall firewall add rule ...` |
| Subnet ping sweep | `for /L %i in (1,1,254) do ping ...` | Ping only specific target hostnames |
| Broadcast WoL | Send to `255.255.255.255` | Send to specific MAC addresses via directed broadcast |
| `Set-ExecutionPolicy Bypass -Force` | PowerShell security bypass | Use `RemoteSigned` or `AllSigned` instead |

### Handling False Positives

If the analyzer flags a command that is genuinely safe for your use case:

1. **Review the finding** — understand why it was flagged
2. **Consider restructuring** — can the script achieve the same result without the flagged pattern?
3. **If restructuring is not possible**, you can modify the analyzer pattern in `services/scriptSafetyAnalyzer.ts`:
   - Move the pattern from `BLOCKED_PATTERNS` to `DANGER_PATTERNS` (requires manual override instead of blocking)
   - Narrow the regex to exclude your specific use case
   - **Never delete a safety pattern** — downgrade it if needed, but keep the detection

---

## CSV and Device Loading Issues

### Column Name Detection

The CSV parser auto-detects columns using case-insensitive matching:

**Hostname column** — matches any of:
`hostname`, `computername`, `devicename`, `computer`, `name`, `device`

**MAC address column** — matches any of:
`macaddress`, `mac address`, `mac`

If your CSV uses different column names, rename the headers in the CSV file.

### MAC Address Validation

Valid MAC address formats (all normalize to 12 uppercase hex characters):

| Format | Example | Valid? |
|--------|---------|--------|
| Colon-separated | `AA:BB:CC:DD:EE:FF` | Yes |
| Hyphen-separated | `AA-BB-CC-DD-EE-FF` | Yes |
| No separator | `AABBCCDDEEFF` | Yes |
| Dot-separated | `AABB.CCDD.EEFF` | Yes |
| Lowercase | `aa:bb:cc:dd:ee:ff` | Yes (auto-uppercased) |
| Mixed case | `Aa:Bb:Cc:Dd:Ee:Ff` | Yes |
| Spaces | `AA BB CC DD EE FF` | Yes (spaces stripped) |
| Too short | `AABBCCDDEE` | **No** — must be 12 hex chars |
| Too long | `AABBCCDDEEFF00` | **No** — must be exactly 12 hex chars |
| Non-hex chars | `GGHHIIJJKKLL` | **No** — must be 0-9 and A-F only |

### Debugging CSV Issues

1. Open your CSV in a text editor (not Excel — Excel can change formatting)
2. Verify the first row contains column headers
3. Verify each row has at least hostname and MAC address
4. Check for BOM markers (UTF-8 BOM is handled by PapaParse)
5. Check for inconsistent delimiters (must be commas, not semicolons or tabs)

---

## Deployment Issues

### Wake-on-LAN Not Working

| Check | How |
|-------|-----|
| WoL enabled in BIOS | Enter BIOS setup → Network Boot → Enable Wake on LAN |
| WoL enabled in Windows | Device Manager → Network Adapter → Power Management → "Allow this device to wake the computer" |
| MAC address correct | Compare CSV MAC with actual device MAC (run `ipconfig /all` on device) |
| Same subnet | WoL magic packets are broadcast — devices must be on the same subnet |
| Switch supports WoL | Some managed switches block broadcast frames — check switch config |

### Devices Stuck in "Connecting" or "Retrying"

1. Verify the device is powered on and connected to the network
2. Ping the device manually: `ping <hostname>`
3. Check Windows Firewall on the target device allows remote management
4. Verify WinRM is enabled: `winrm quickconfig` on the target
5. Check credentials are correct (domain\username format)
6. Increase max retries in the UI settings (default: 3, max: 10)

### Updates Failing

| Error Pattern | Likely Cause | Fix |
|--------------|-------------|-----|
| BIOS update fails | BIOS file not found or incompatible | Verify BIOS update package matches device model |
| DCU update fails | Dell Command Update not installed | Install DCU manually on the target device first |
| Windows update fails | WSUS or update service issue | Check Windows Update service status on target |
| All updates fail | Credential/permission issue | Verify account has admin rights on target devices |

---

## Image Monitor Issues

### Metadata JSON Not Loading

1. Verify the JSON file is valid: open in a text editor, check for syntax errors
2. Verify the JSON matches the `ImagingMetadata` interface:

```json
{
    "hostname": "DEVICE-001",
    "serialNumber": "ABC123",
    "macAddress": "AABBCCDDEEFF",
    "model": "Latitude 5450",
    "manufacturer": "Dell Inc.",
    "biosVersion": "A25",
    "biosDate": "2024-01-15",
    "totalRamMB": 16384,
    "diskSizeGB": 512,
    "osVersion": "10.0.22631",
    "ipAddress": "10.0.1.50",
    "taskSequenceName": "Win11-Enterprise-23H2",
    "collectedAt": "2025-01-15T10:30:00Z",
    "imageProgress": 0,
    "encryptionReady": true
}
```

3. Check that `hostname` and `macAddress` are present (minimum required fields)
4. Drag-and-drop the file directly onto the Image Monitor area

### Metadata Script Not Generating JSON

1. Verify PowerShell is available in WinPE (requires WinPE PowerShell optional component)
2. Check `Gather-DeviceMetadata.bat` can detect the USB drive
3. Look for error output in the task sequence log
4. Verify `%TEMP%` is writable during the task sequence
5. Check the network share path is accessible: `dir \\DEPLOYSERVER\ImageMetadata$`

### Devices Not Promoting

1. Device must be in "Imaging Complete" status to promote
2. Select the device(s) in the Image Monitor
3. Click "Promote to Deployment Runner"
4. Switch to the Deployment Runner tab — devices should appear

---

## USB and Build Issues

### Build Failures

| Error | Fix |
|-------|-----|
| `npm install` fails | Check Node.js version (18+), delete `node_modules` and retry |
| `vite build` fails | Check for TypeScript errors: `npx tsc --noEmit` |
| `electron-builder` fails | Verify electron-builder is installed, check build config in package.json |
| Portable build too large | Normal — Electron bundles Chromium (~150MB) |

### USB App Won't Start

1. Verify `Secure-Deployment-Runner-Portable-*.exe` is at the USB root
2. Verify `LaunchFromUSB.bat` is at the USB root
3. Try running the .exe directly (without the .bat launcher)
4. Check Windows Event Viewer for application errors
5. Try on a different machine (driver/compatibility issues)

---

## Credential and Session Issues

### Credentials Auto-Wiped

The 30-minute session timeout is working as designed. Credentials are wiped after 30 minutes of no mouse or keyboard activity.

**To prevent this**:
- Move the mouse or press a key periodically
- Re-enter credentials when prompted

**You cannot disable the timeout** — it's a security feature for hospital environments where workstations may be unattended.

### Credentials Not Accepted

1. Verify the username format: `DOMAIN\username` or `username@domain.com`
2. Verify the password is correct
3. Check the account is not locked in Active Directory
4. Verify the account has admin rights on the target devices

---

## Log Analysis

### Log Format

Each log entry contains:

| Field | Description |
|-------|-------------|
| **Timestamp** | When the event occurred |
| **Level** | INFO (blue), SUCCESS (green), WARNING (yellow), ERROR (red) |
| **Message** | Event description (credentials are redacted) |

### Common Log Patterns

| Pattern | Meaning |
|---------|---------|
| `[INFO] Sending WoL to DEVICE-001 (AA:BB:CC:DD:EE:FF)` | Wake-on-LAN packet sent |
| `[INFO] Connecting to DEVICE-001...` | Connection attempt started |
| `[WARNING] Connection to DEVICE-001 failed, retrying (1/3)` | Connection failed, will retry |
| `[ERROR] Device DEVICE-001 is offline after 3 attempts` | Device unreachable |
| `[SUCCESS] DEVICE-001 scan complete` | Scan finished successfully |
| `[INFO] Updating BIOS on DEVICE-001...` | BIOS update started |
| `[SUCCESS] All updates complete on DEVICE-001` | All components updated |
| `[ERROR] BIOS update failed on DEVICE-001` | Update component failed |
| `password: [REDACTED]` | Credential was sanitized from log |

### Filtering Log Messages

The log viewer shows all messages chronologically. To find specific entries:
- Look for RED entries — these are errors requiring attention
- Look for YELLOW entries — these are warnings to review
- GREEN entries confirm successful operations
- BLUE entries are informational

---

## FAQ

### General

**Q: Does this application require internet access?**
A: No. It is designed to run completely offline from a USB drive. There are zero external network dependencies.

**Q: Does this application use AI?**
A: No. The original version used Google Gemini for script analysis. All AI dependencies have been removed and replaced with a deterministic regex-based analyzer.

**Q: Is my data sent anywhere?**
A: No. There is no telemetry, no analytics, no crash reporting, and no external API calls. All data stays on the local machine.

**Q: Can I run this on macOS or Linux?**
A: The development environment works on any OS. The portable build and USB deployment are Windows-only (hospital networks run Windows).

### Security

**Q: Where are credentials stored?**
A: In React component state (RAM only). They are never written to disk, localStorage, sessionStorage, or cookies.

**Q: What happens if I walk away from the computer?**
A: After 30 minutes of no mouse/keyboard activity, credentials are automatically wiped from memory.

**Q: Can the script analyzer be bypassed?**
A: BLOCKED patterns cannot be bypassed. DANGER patterns require explicit review. The analyzer cannot be disabled from the UI.

**Q: What if someone tampers with the USB drive?**
A: The application itself contains no credentials or sensitive data. However, you should physically secure the USB drive and verify its contents before use.

### Operations

**Q: How many devices can I deploy to at once?**
A: The Device Scope Guard has a default limit of 50 devices and a hard maximum of 200 devices per operation.

**Q: What if a device fails during deployment?**
A: Failed devices are marked with a red "Failed" status. You can retry individual devices or re-run the deployment on just the failed devices.

**Q: Can I use this with non-Dell devices?**
A: Yes. The form factor detection is Dell-specific (hostname patterns), but the deployment workflow works with any Windows device. Non-Dell devices will show the generic desktop or laptop icon.

**Q: How do I update the compliance target versions?**
A: Edit `TARGET_BIOS_VERSION`, `TARGET_DCU_VERSION`, and `TARGET_WIN_VERSION` in `App.tsx`, then rebuild.
