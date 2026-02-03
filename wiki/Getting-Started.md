# Getting Started

> Everything you need to go from zero to running your first deployment.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [First Run Walkthrough](#first-run-walkthrough)
- [Loading Devices](#loading-devices)
- [Running Your First Scan](#running-your-first-scan)
- [Using the Image Monitor](#using-the-image-monitor)
- [USB Deployment Setup](#usb-deployment-setup)
- [Verifying the Installation](#verifying-the-installation)

---

## Prerequisites

### For Running the Portable Build (USB Deployment)

| Requirement | Details |
|-------------|---------|
| **Operating System** | Windows 10 version 1809 or later |
| **RAM** | 4 GB minimum |
| **Disk Space** | 200 MB on USB drive |
| **Network** | LAN access to target devices (no internet required) |
| **Display** | 1280x800 minimum resolution |
| **Permissions** | Standard user account (no admin rights required for the app itself) |

### For Development

| Requirement | Details |
|-------------|---------|
| **Node.js** | 18.x or later |
| **npm** | 9.x or later (ships with Node.js) |
| **Git** | Any recent version |
| **Operating System** | Windows, macOS, or Linux |

---

## Installation

### Option A: Portable Build (Recommended for Hospital Use)

The portable build requires no installation. It runs directly from a USB drive.

1. **Build the portable executable** (on a development machine):

```bash
# Clone the repository
git clone <repository-url>
cd Secure-Deployer

# Install dependencies
npm install

# Build the portable executable
npm run build:portable
```

2. **Prepare the USB drive**:

```
USB:\
├── LaunchFromUSB.bat                              ← Copy from project root scripts/
├── Secure-Deployment-Runner-Portable-1.0.0.exe    ← Copy from release/ after build
└── scripts/
    ├── Gather-DeviceMetadata.bat                  ← Copy from project scripts/
    └── Gather-DeviceMetadata.ps1                  ← Copy from project scripts/
```

3. **Run**: Insert USB into any Windows machine and double-click `LaunchFromUSB.bat`.

### Option B: Development Mode

```bash
# Clone the repository
git clone <repository-url>
cd Secure-Deployer

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application opens at `http://127.0.0.1:3000` (localhost only — not exposed to the network).

### Option C: Installed Application

```bash
# Build the installer
npm run build:app

# The installer is in release/Secure-Deployment-Runner-1.0.0-Setup.exe
```

---

## First Run Walkthrough

When you first launch the application, you'll see the **Deployment Runner** view with an empty device list. Here's how to get started:

### Step 1: Prepare Your CSV File

Create a CSV file with your device hostnames and MAC addresses:

```csv
Hostname,MAC Address
ELSLE-LAT5450-001,AA:BB:CC:DD:EE:01
EWSSF-OPT7020-002,AA:BB:CC:DD:EE:02
WYSE-5070-003,AA-BB-CC-DD-EE-03
```

**Accepted column names for Hostname**: `hostname`, `computername`, `devicename`, `computer`, `name`, `device`

**Accepted column names for MAC Address**: `macaddress`, `mac address`, `mac`

**Accepted MAC formats**:
- `AA:BB:CC:DD:EE:FF` (colon-separated)
- `AA-BB-CC-DD-EE-FF` (hyphen-separated)
- `AABBCCDDEEFF` (no separator)

### Step 2: Upload the CSV

1. Click the **"Upload Device CSV"** card in the configuration area
2. Select your CSV file
3. Devices appear in the Device Status Table with auto-detected form factor icons

### Step 3: Upload a Deployment Script (Optional)

1. Click the **"Upload Deployment Script"** card
2. Select a `.bat` or `.cmd` file
3. The **Script Safety Analyzer** runs automatically
4. If the script is safe (no BLOCKED patterns), you'll see a green indicator
5. If the script is blocked, review the findings in the Script Analysis Modal

### Step 4: Enter Credentials

1. Click the **"Enter Credentials"** card (or use the modal that appears)
2. Enter your domain credentials (username and password)
3. Credentials are stored in memory only — never written to disk
4. Credentials auto-expire after 30 minutes of inactivity

### Step 5: Start Deployment

1. Select devices using the checkboxes in the Device Status Table
2. Click **"Start Scan & Deploy"** in the header
3. The deployment flow begins:
   - **Wake-on-LAN** — Magic packets sent to all selected devices
   - **Connecting** — Establishes remote connections
   - **Scanning** — Checks BIOS, DCU, and Windows versions
   - **Results** — Devices show compliance status

### Step 6: Run Updates

1. After scanning, devices needing updates show a **"Run Updates"** button
2. For individual devices, click the button on that device's card
3. For bulk updates, select devices and click **"Update Selected"**
4. **Device Scope Guard** opens — verify each device, confirm the count, and set safety policies
5. Updates proceed only on verified devices

---

## Loading Devices

### From CSV File

The primary method. Upload a CSV with hostnames and MAC addresses. The application:

1. Parses the CSV using PapaParse
2. Detects hostname and MAC address columns automatically
3. Validates MAC addresses (must be 12 hex characters after normalization)
4. Detects the Dell form factor from the hostname pattern
5. Assigns a unique numeric ID to each device
6. Displays devices in the Device Status Table

### From Image Monitor (Promotion)

Devices that have completed imaging in the Image Monitor can be promoted to the Deployment Runner:

1. Switch to the **Image Monitor** tab
2. Load device metadata JSON files (drag-and-drop or file picker)
3. When a device reaches "Imaging Complete", click **"Promote to Deployment"**
4. The device appears in the Deployment Runner with its hardware metadata pre-populated

---

## Running Your First Scan

A "scan" checks each device's current software versions against your compliance targets.

### What Gets Scanned

| Component | Target Version | How It's Checked |
|-----------|---------------|-----------------|
| BIOS | `A25` (configurable) | Remote WMI query |
| Dell Command Update (DCU) | `5.2.0` (configurable) | Remote registry/version check |
| Windows | `23H2` (configurable) | Remote OS version query |

### Scan Results

After scanning, each device shows one of these compliance states:

| Icon | Meaning |
|------|---------|
| Green check | Component is up to date |
| Red X | Component needs updating |

### Changing Target Versions

Edit these constants in `App.tsx`:

```typescript
const TARGET_BIOS_VERSION = 'A25';    // Change to your fleet's target
const TARGET_DCU_VERSION = '5.2.0';   // Change to your DCU target
const TARGET_WIN_VERSION = '23H2';    // Change to your Windows target
```

---

## Using the Image Monitor

The Image Monitor is for watching SCCM/MDT imaging in real time.

### Setting Up the Task Sequence Script

1. Copy `scripts/Gather-DeviceMetadata.bat` and `scripts/Gather-DeviceMetadata.ps1` to your USB drive
2. In your SCCM/MDT task sequence, add a "Run Command Line" step that executes:

```
X:\scripts\Gather-DeviceMetadata.bat
```

(Replace `X:` with your USB drive letter)

3. The script collects hardware metadata and outputs a JSON file to:
   - Local: `%TEMP%\DeviceMetadata\<COMPUTERNAME>.json`
   - Network share: `\\DEPLOYSERVER\ImageMetadata$\<COMPUTERNAME>.json`

### Loading Metadata in the Image Monitor

1. Switch to the **Image Monitor** tab in the application
2. Drag and drop the `.json` metadata files onto the monitor
3. Or use the file picker to select them from the network share
4. Each device appears with its hardware details and imaging progress

### Promoting Devices

When a device's imaging status shows "Imaging Complete":

1. Select the device(s) you want to promote
2. Click **"Promote to Deployment Runner"**
3. Switch to the Deployment Runner tab — the devices are now there with all metadata pre-filled

---

## USB Deployment Setup

### Step-by-Step USB Preparation

1. **Format the USB drive** (FAT32 or NTFS, NTFS preferred for files > 4GB)

2. **Build the portable executable**:
```bash
npm run build:portable
```

3. **Copy files to USB**:
```
USB:\
├── LaunchFromUSB.bat
├── Secure-Deployment-Runner-Portable-1.0.0.exe
└── scripts/
    ├── Gather-DeviceMetadata.bat
    └── Gather-DeviceMetadata.ps1
```

4. **Configure the network share** (optional, for metadata collection):
   - Create a shared folder on your deployment server: `\\DEPLOYSERVER\ImageMetadata$`
   - Grant write access to the computer accounts that will be imaging
   - Edit `Gather-DeviceMetadata.bat` to set the correct `SHARE_PATH`

### USB Drive Compatibility Notes

| File System | Max File Size | Recommended For |
|------------|--------------|----------------|
| FAT32 | 4 GB | Simple deployments without large scripts |
| NTFS | No practical limit | Recommended — supports large metadata logs |
| exFAT | No practical limit | Works, but NTFS is preferred for Windows |

---

## Verifying the Installation

After launching the application, verify these elements are working:

### Checklist

- [ ] Application launches without errors
- [ ] "Image Monitor" and "Deployment Runner" tabs are both visible
- [ ] CSV upload accepts your device list
- [ ] Devices show the correct form factor icons
- [ ] Script upload triggers the Script Safety Analyzer
- [ ] Credential modal appears and accepts input
- [ ] No browser console errors (if running in dev mode)

### Quick Smoke Test

1. Create a test CSV with 2–3 devices
2. Upload the CSV — verify devices appear with icons
3. Create a test `.bat` script with safe content (e.g., `echo Hello`)
4. Upload the script — verify it passes safety analysis
5. Enter test credentials — verify the credential card shows "Authenticated"
6. The application is ready for production use

---

## Next Steps

- [Architecture](./Architecture.md) — Understand how the system is designed
- [Operations](./Operations.md) — Learn the day-to-day operational workflow
- [Security](./Security.md) — Review the security hardening in detail
- [Troubleshooting](./Troubleshooting.md) — Common issues and fixes
