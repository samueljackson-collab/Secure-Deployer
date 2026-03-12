
# Secure Deployment Runner

A graphical user interface to manage and monitor the remote deployment of software packages using a PowerShell-based backend. This tool provides a centralized dashboard for IT administrators to track compliance, push updates, and manage devices across a network efficiently and securely.

## ✨ Features

-   **Live Imaging Monitor**: Real-time rack view of devices undergoing imaging, with live progress bars and post-imaging compliance checks.
-   **CSV-Based Device Loading**: Easily import target devices for deployment operations using a simple CSV file.
-   **Real-Time Deployment Tracking**: Monitor the status of each device in real-time with a comprehensive progress dashboard and a live log viewer.
-   **Detailed Compliance Scanning**: Automatically checks device compliance against target BIOS, DCU, and Windows versions, as well as security policies like disk encryption and endpoint protection status.
-   **Full Fleet Re-Scan**: Initiate a comprehensive compliance and status scan for all devices currently in the deployment runner with a single click, protected by a confirmation dialog to prevent accidental execution.
-   **Granular & Bulk Actions**: Perform actions on individual devices or in bulk, including:
    -   Running Updates
    -   Executing Post-Imaging Scripts
    -   Re-validating Compliance
    -   Rebooting Devices
    -   Sending Wake-on-LAN Signals
    -   Cancelling ongoing tasks
-   **Secure Credential Handling**: Utilizes a modal for single-use, session-based administrative credentials, ensuring they are not stored or exposed.
-   **Deployment History & Analytics**: View a history of past deployment runs with detailed analytics, success rate trends, and common failure points.

## 🚀 Getting Started

1.  **Navigate to the Image Monitor**: View devices as they come online during the imaging process. Once imaging and compliance checks are complete, transfer them to the Deployment Runner.
2.  **Navigate to the Deployment Runner**:
    -   **Load Devices**: Either use the devices transferred from the monitor or upload a `.csv` file containing device `Hostname` and `MAC` addresses.
    -   **Configure Settings**: Adjust advanced settings like connection retries and auto-reboot behavior if needed.
    -   **Start Scan**: Click "Start Scan" and enter secure, session-only administrative credentials when prompted. The application will begin connecting to devices and checking their compliance status.
3.  **Manage Devices**: Once the scan is complete, use the individual or bulk actions to bring devices into compliance.

## 🛠️ Technology Stack

-   **Frontend**: React, TypeScript, Tailwind CSS
-   **Data Parsing**: Papaparse
-   **Backend (Simulated)**: The application is designed to interface with a PowerShell backend for all remote device interactions.

---

## 📦 Distribution Options

Secure Deployment Runner can be used in three ways. Pick the option that fits your environment.

### Option 1 — Progressive Web App (PWA) · Offline, Installable from Browser

The built app is a fully offline-capable PWA. Once opened in Chrome or Edge, users see an **"Install App"** prompt in the address bar — one click installs it to the desktop with no Node.js or Rust required on end-user machines.

**Build and host:**
```bash
npm install
npm run build       # Produces dist/ — fully self-contained, no CDN required
npm run preview     # Test locally at http://localhost:4173
```

**Install as PWA:**
1. Open the hosted URL in Chrome or Edge
2. Click the install icon (⊕) in the address bar
3. The app installs as a standalone window with an icon on the desktop/taskbar
4. Works fully **offline** after first load — all assets are cached by the service worker

---

### Option 2 — USB Portable · No Installation Required

Copy the built `dist/` folder and the `scripts/` folder to a USB drive. Plug it into any Windows machine and run the launcher — no admin rights, no install, no internet required.

**Setup:**
```bash
npm run build
# Copy dist/ and scripts/ to USB root
```

**On Windows (USB):**
```
USB:\
├── dist\              ← built app
├── scripts\
│   ├── serve-usb.bat  ← double-click to launch
│   └── serve-portable.ps1
└── AutoTag\           ← your AutoTag scripts (from PXE Task Sequence wizard)
    ├── AutoTag.bat
    └── AutoTag.ps1
```

Double-click **`scripts\serve-usb.bat`** — it starts an HTTP server (Python or PowerShell built-in), opens the browser, and serves the app from the USB. No Python install required if PowerShell 5.1+ is available (included in Windows 10/11 by default).

**On Linux / macOS (USB):**
```bash
bash scripts/serve-usb.sh
```

---

### Option 3 — Native Desktop App (Tauri) · Windows Installer / macOS DMG / Linux AppImage

Tauri wraps the React frontend in a native desktop window and adds a Rust backend for **real** PowerShell execution — enabling actual USB drive detection and live SCCM queries rather than the browser simulation.

**Build locally** (requires [Rust](https://rustup.rs) and [Tauri prerequisites](https://tauri.app/start/prerequisites/)):
```bash
npm install
npm run tauri:build    # Produces installer in src-tauri/target/release/bundle/
```

**Build via GitHub Actions (no local Rust needed):**
Push a version tag to trigger the automated release workflow:
```bash
git tag v1.0.0
git push origin v1.0.0
```
GitHub Actions builds `.msi` (Windows), `.dmg` (macOS), and `.AppImage` (Linux) automatically and attaches them to a GitHub Release.

**Capabilities unlocked in Tauri mode:**
- **Real USB detection** — automatically lists removable drives plugged into the operator's workstation
- **Real remote execution** — runs AutoTag via PowerShell WinRM on target devices (no simulation)
- **Real SCCM queries** — queries boot images directly from your SCCM site server via `Get-CMBootImage`

---

## 🖥️ AutoTag USB Workflow (Operator Guide)

This workflow lets one operator laptop handle AutoTag for all imaging devices — the USB stays in the laptop, not moving device-to-device.

### Setup (one-time)
1. Copy your AutoTag scripts to the USB drive under an `AutoTag\` folder:
   ```
   D:\AutoTag\
       AutoTag.bat
       AutoTag.ps1
   ```
2. Run the app (any mode). Go to the **PXE Task Sequence** tab.
3. In **Step 1 — Configuration**: set your network share path (e.g., `\\server\share\AutoTag`), then click **Detect USB Drives** to find the USB.
4. Select the detected USB path (e.g., `D:\`).

### Per-Device Process (during imaging)
1. The imaging device boots into WinPE via PXE.
2. Instead of plugging the USB into the imaging device, go to **Step 4 — Deployment** in the wizard.
3. Click **Test Remote Execution** → enter the imaging device's IP address.
4. Click **Connect & Run** — the app (via Tauri/PowerShell WinRM):
   - Copies `D:\AutoTag\` to `C:\Temp\AutoTag\` on the remote device
   - Executes `AutoTag.ps1` remotely
   - Collects and displays the live log output
5. Repeat for each device — the USB stays in your laptop the whole time.

> **Prerequisites for real remote execution (Tauri app):** WinRM must be enabled on target devices (`winrm quickconfig`), and the operator must have local admin credentials for the target. Port 5985 must be reachable.

---

## 🖼️ Boot Image Management (SCCM)

The **PXE Task Sequence** tab includes a **Boot Image Management** wizard step (Step 2).

### To query SCCM for available boot images:
1. Go to **PXE Task Sequence → Step 2 — Boot Image**.
2. Enter your **SCCM Site Server hostname** (e.g., `SCCM-SERVER01`).
   - *Tauri app only — browser mode uses simulated images for demonstration.*
3. Enter the **target device MAC address** (format: `00:1A:2B:3C:4D:5E`).
4. Click **Check SCCM** — the app invokes `Get-CMBootImage` via PowerShell and returns available WIM packages.
5. Select the desired boot image from the list.
6. The selected image is referenced in the task sequence and deployment configuration.

> **SCCM requirement:** The operator's machine must have the ConfigMgr PowerShell module installed (part of the SCCM Admin Console). The site code is auto-detected via `Get-PSDrive -PSProvider CMSite`.

---

## 🧭 Tab Reference

| Tab | Purpose |
|-----|---------|
| **Image Monitor** | Rack view of devices currently being imaged. Shows progress, compliance checks, and transfer controls. |
| **Deployment Runner** | Main workflow: load devices (CSV or transferred), scan compliance, update BIOS/DCU/Windows, reboot. |
| **Imaging Script** | Read-only viewer of the PowerShell intake script used during imaging. |
| **PXE Task Sequence** | 4-step wizard: configure network share, select boot image (SCCM), choose integration method, run AutoTag remotely. |
| **Build Output** | Simulated build log stream for demonstration and operator training. |
| **Remote Desktop** | Generate `.rdp` files for direct RDP access to any device in the runner. |
| **Trends & Analytics** | Historical run charts — success rates, update breakdowns, failure patterns. |
| **Templates** | Saved deployment configuration templates for repeatable batch operations. |

---

## 🔧 Development Setup

```bash
# Install all dependencies (Node 18+ required)
npm install

# Start dev server (hot reload)
npm run dev             # → http://localhost:3000

# Type check
npm run typecheck

# Lint
npm run lint

# Production build (PWA, offline-capable)
npm run build

# Preview production build
npm run preview

# Tauri dev window (requires Rust + Tauri prerequisites)
npm run tauri:dev

# Tauri production build
npm run tauri:build
```

### Requirements
- **For Web/PWA**: Node.js 18+, npm
- **For Tauri native app**: Node.js 18+ + [Rust](https://rustup.rs) + platform prerequisites ([see Tauri docs](https://tauri.app/start/prerequisites/))
- **For GitHub Actions builds**: None — just push a `v*` tag; GitHub handles everything

### Project Structure
```
Secure-Deployer/
├── components/          # React components (one per feature/tab)
├── contexts/            # AppContext — central useReducer state
├── services/            # Mock deployment service layer
├── src/                 # Entry point, types, constants, CSS
├── utils/               # Helpers (MAC normalization, sleep, etc.)
├── hooks/               # Custom React hooks
├── src-tauri/           # Tauri native app (Rust backend + config)
│   └── src/
│       ├── main.rs      # Entry point
│       └── lib.rs       # PowerShell commands (USB, SCCM, remote exec)
├── scripts/             # USB portable launchers (bat, sh, ps1)
├── public/              # Static assets (PWA manifest, icons)
├── .github/workflows/   # CI (lint+build) and Tauri release workflows
├── tailwind.config.js   # Tailwind CSS configuration
├── postcss.config.js    # PostCSS configuration
├── vite.config.ts       # Vite + PWA plugin configuration
└── README.md
```
