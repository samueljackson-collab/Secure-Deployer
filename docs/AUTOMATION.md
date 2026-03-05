# Secure Deployment Runner — Automation Guide

> **What this document covers:**
> - 5 tiers of imaging automation, from today's assisted manual to full zero-touch PXE
> - How to automate the task sequence to reduce or eliminate tech input during imaging
> - How to run the app remotely via browser, RDP, VPN, and PXE4 triggers
> - Specific options for starting imaging from a remote location
> - Code references for each automation integration point

---

## Table of Contents

1. [The Automation Spectrum](#1-the-automation-spectrum)
2. [Tier 0 — Current State (Assisted Manual)](#2-tier-0--current-state-assisted-manual)
3. [Tier 1 — Pre-Staged CSV (No Imaging Change)](#3-tier-1--pre-staged-csv-no-imaging-change)
4. [Tier 2 — Silent AutoTag via Task Sequence Variables](#4-tier-2--silent-autotag-via-task-sequence-variables)
5. [Tier 3 — WDS/MDT Zero-Touch via DHCP Policy](#5-tier-3--wdsmdot-zero-touch-via-dhcp-policy)
6. [Tier 4 — Full Pipeline Automation with Webhook Callbacks](#6-tier-4--full-pipeline-automation-with-webhook-callbacks)
7. [Tier 5 — PXE Remote Imaging (Fully Off-Site)](#7-tier-5--pxe-remote-imaging-fully-off-site)
8. [Remote App Access Options](#8-remote-app-access-options)
9. [PXE4 and Starting Imaging Remotely](#9-pxe4-and-starting-imaging-remotely)
10. [Security Considerations for Remote Automation](#10-security-considerations-for-remote-automation)
11. [Automation Decision Matrix](#11-automation-decision-matrix)

---

## 1. The Automation Spectrum

Every step in the imaging and deployment pipeline can be automated to some degree. The question is
how much effort to invest and what trade-offs to accept. This guide presents 5 tiers, each building
on the previous.

```
AUTOMATION TIERS — OVERVIEW
═══════════════════════════════════════════════════════════════════════════════

  TIER 0                TIER 1               TIER 2               TIER 3
  Assisted              Pre-Staged           Silent               Zero-Touch
  Manual                CSV                  AutoTag              WDS/MDT
  ────────              ─────────            ────────             ─────────
  Tech runs             CSV loaded           AutoTag reads        DHCP assigns
  autotag.bat           before scan          TS variables         TS auto;
  manually;             starts;              instead of           no F8 needed
  enters 3              no AutoTag           prompting tech
  inputs                needed for
                        deployment

  TIER 4                TIER 5
  Full Pipeline         PXE Remote
  Automation            Imaging
  ──────────────        ────────────────
  App auto-             Device boots
  transfers +           via iPXE/WDS
  auto-scans;           from remote
  webhooks              location;
  trigger               app accessed
  actions               via VPN/browser

═══════════════════════════════════════════════════════════════════════════════
  Tech effort: HIGH ─────────────────────────────────────────────▶ LOW
  Setup effort: LOW  ─────────────────────────────────────────────▶ HIGH
```

---

## 2. Tier 0 — Current State (Assisted Manual)

### What it is

The baseline implementation that ships with the application today. Every action in the imaging
phase requires manual tech input. The deployment scan requires credential entry. No automation
infrastructure is needed.

### How it works

```
Physical Steps (tech required at device):
  1. Place device in rack
  2. Connect power + ethernet
  3. Power on device
  4. Select PXE boot from boot menu (F12 / ESC)
  5. Wait for Task Sequence Wizard
  6. Press F8 to open command prompt
  7. Type: powershell → Enter
  8. Run: autotag.bat
  9. Enter rack slot, hostname, tech name
  10. Confirm with Y

Application Steps (tech at computer):
  11. Watch Image Monitor for device to appear
  12. Monitor progress to Completed
  13. Transfer to Deployment Runner
  14. Start Scan → enter credentials
  15. Remediate → Re-scan → Archive → Remove
```

### Code involved

- **`services/powershellScript.ts`** — the PowerShell script that runs as autotag.bat
- **`components/ImagingScriptViewer.tsx`** — displays the script in UI for reference
- **`components/SecureCredentialModal.tsx`** — prompts credentials at scan start

### Limitations at Tier 0

- Requires a tech physically at each device (or within eyeshot for F8/PXE boot)
- Each device takes 3–5 minutes of hands-on setup per imaging session
- Human error in rack slot or hostname entry is possible
- Not scalable beyond ~10–15 devices per tech per hour for the intake phase

---

## 3. Tier 1 — Pre-Staged CSV (No Imaging Change)

### What it is

Pre-populate a CSV file with device hostnames and MAC addresses from your asset database **before**
devices arrive. Load it into Deployment Runner at scan time instead of relying on AutoTag for the
deployment phase. The imaging phase (AutoTag/WinPE) still runs manually.

### How it works

```
Before devices arrive:
  1. Pull device list from CMDB / asset database
  2. Export CSV:
     Hostname,MAC
     HQ-LT-001,00:1A:2B:3C:4D:5E
     HQ-LT-002,00:1A:2B:3C:4D:5F
     ...
  3. Upload CSV to Deployment Runner when devices complete imaging

No AutoTag data entry needed for the deployment phase —
MAC addresses are already known from the asset database.
```

### Code that supports this

**`services/deploymentService.ts:parseDevicesFromCsv()`**

```typescript
// Accepts a File object from the browser file picker
// Validates each row: requires Hostname + valid MAC
// Uses papaparse for CSV parsing with header normalization
// Returns: { devices: Device[], errors: string[] }

export const parseDevicesFromCsv = (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Row validation: normalize MAC, detect device type from hostname
        // Error rows are surfaced to operator, not silently dropped
      }
    });
  });
};
```

### Advantages over Tier 0

- Deployment phase doesn't depend on AutoTag data being written correctly
- Faster scan start — no waiting for image monitor transfer
- Can be prepared by a separate person (asset manager) before imaging begins
- Works even if AutoTag fails (network share issues in WinPE)

### Remaining manual steps

- AutoTag still needs to run during imaging (for Image Monitor visibility)
- Or skip Image Monitor entirely and go straight from physical imaging to CSV load

---

## 4. Tier 2 — Silent AutoTag via Task Sequence Variables

### What it is

Modify the AutoTag PowerShell script to read rack slot, hostname, and tech name from **task sequence
variables** instead of prompting the tech interactively. The tech still initiates PXE boot, but
the F8 / PowerShell / autotag.bat steps are eliminated or reduced to a single command.

### How it works

```
Standard MDT/SCCM task sequence variables you can inject:
  OSDComputerName    → maps to "Hostname" input
  CustomRackSlot     → maps to "Rack Slot" input (custom variable)
  CustomTechName     → maps to "Tech Name" input (custom variable)

These variables are set in:
  • MDT CustomSettings.ini (rules-based, keyed by MAC)
  • SCCM collection variables (pre-staged per device)
  • PXE policy / deployment settings

Modified autotag.bat calls the PowerShell script with variables pre-loaded:
  autotag.bat OSDComputerName CustomRackSlot CustomTechName

AutoTag script reads from $env: or TS environment instead of Read-Host prompts.
```

### PowerShell script modification (in `services/powershellScript.ts`)

Current script uses `Read-Host` for all three inputs:

```powershell
# Current — interactive (Tier 0)
$rackSlot    = Read-Host "Enter Rack Slot (e.g., R1-S03)"
$hostname    = Read-Host "Enter Hostname (e.g., HQ-LT-042)"
$techName    = Read-Host "Enter Your Name"
```

Modified for Tier 2 — reads from task sequence variables:

```powershell
# Tier 2 — silent mode via TS variables
$tsEnv = New-Object -ComObject Microsoft.SMS.TSEnvironment -ErrorAction SilentlyContinue

if ($tsEnv) {
  # Running inside a task sequence — read from TS variables
  $rackSlot  = $tsEnv.Value("CustomRackSlot")
  $hostname  = $tsEnv.Value("OSDComputerName")
  $techName  = $tsEnv.Value("CustomTechName")
  Write-Host "Silent mode: using TS variables"
} else {
  # Fallback — interactive mode (Tier 0) for manual runs
  $rackSlot  = Read-Host "Enter Rack Slot"
  $hostname  = Read-Host "Enter Hostname"
  $techName  = Read-Host "Enter Your Name"
}
```

### MDT CustomSettings.ini setup for automatic variable injection

```ini
; MDT CustomSettings.ini — rules-based device assignment
[Settings]
Priority=MACAddress, Default

; Match by MAC address — set variables for each known device
[00:1A:2B:3C:4D:5E]
OSDComputerName=HQ-LT-001
CustomRackSlot=R1-S01
CustomTechName=AutoImaging

[00:1A:2B:3C:4D:5F]
OSDComputerName=HQ-LT-002
CustomRackSlot=R1-S02
CustomTechName=AutoImaging

[Default]
; Unknown devices fall back to interactive prompts
CustomRackSlot=UNKNOWN-SLOT
```

### Advantages

- Eliminates F8 / PowerShell / autotag.bat manual steps entirely
- Tech only initiates PXE boot; the rest runs automatically
- Hostname and rack slot data comes from asset database, not human memory
- Error rate drops to near zero for the intake phase

### What still requires a tech

- Physically connecting the device and initiating PXE boot (unless Tier 3+)

---

## 5. Tier 3 — WDS/MDT Zero-Touch via DHCP Policy

### What it is

Configure WDS (Windows Deployment Services) and DHCP so that eligible devices automatically select
a task sequence without any tech interaction at the boot menu. The tech powers on the device and
walks away — imaging begins, AutoTag runs silently, and Image Monitor shows the device progressing.

### How it works

```
DHCP Configuration (on your DHCP server):
  Option 66 (TFTP server):  <WDS server IP>
  Option 67 (Boot file):    boot\x64\wdsnbp.com  (or pxeboot.n12)

WDS Policy (on WDS server):
  WDS Properties → Boot tab:
    "Known clients": Always continue the PXE boot
    "Unknown clients": Always continue the PXE boot  (or prompt once)

  WDS deployment policy: Auto-answer with specified task sequence
    → Select task sequence to run automatically (no wizard needed)
    → Set unattended mode = true

Result:
  Device powers on → DHCP offers PXE boot parameters → WDS serves boot image →
  Task sequence wizard loads and auto-starts selected TS → Imaging begins →
  AutoTag runs (silent, Tier 2 variables) → JSON written to share →
  Image Monitor shows device with progress bar
```

### Network diagram

```
┌──────────┐     DHCP       ┌──────────┐    TFTP     ┌──────────┐
│  Device  │──────────────▶ │   DHCP   │             │   WDS    │
│  boots   │ Option 66/67   │  Server  │             │  Server  │
│ (PXE)    │◀────────────── │          │◀────────────│          │
└──────────┘                └──────────┘   boot img  └──────────┘
     │                                                      │
     │ receives: WDS IP + boot file                         │ task sequence
     ▼                                                      ▼
┌──────────┐    auto-starts  ┌──────────────────────────────────────┐
│ WinPE    │────────────────▶│ Task Sequence (unattended)           │
│ loads    │                 │ 1. Apply OS image                    │
└──────────┘                 │ 2. Inject drivers                    │
                             │ 3. Run AutoTag (silent, TS vars)      │
                             │ 4. Join domain                        │
                             │ 5. Install baseline apps             │
                             └──────────────────────────────────────┘
```

### Tech involvement at Tier 3

- Power on the device
- Connect ethernet
- That's it — no boot menu interaction, no F8, no typing

### WDS unattended configuration (registry/WDS admin)

```powershell
# Set WDS auto-answer policy for unknown clients (run on WDS server as admin)
wdsutil /Set-Server /AnswerClients:All /ResponseDelay:0

# Or via WDS MMC:
# WDS Server → Properties → Boot tab
#   "Always continue the PXE boot" for both known and unknown clients
```

---

## 6. Tier 4 — Full Pipeline Automation with Webhook Callbacks

### What it is

Add automation triggers so that:
1. When a device reaches `Completed` in Image Monitor, it is **automatically transferred** to
   Deployment Runner (no click required)
2. When a wave is transferred, the scan **automatically starts** (with pre-stored credentials)
3. When a scan completes, compliant devices are **automatically archived and removed**

### How it works

This tier requires changes to the frontend application (or a backend service). Two approaches:

**Approach A: Frontend polling timer (modify `contexts/AppContext.tsx`)**

```typescript
// Add to AppContext.tsx — polling interval for auto-transfer
useEffect(() => {
  const interval = setInterval(() => {
    const completedDevices = state.monitor.devices.filter(d => d.status === 'Completed');
    if (completedDevices.length > 0) {
      dispatch({ type: 'TRANSFER_IMAGING_DEVICES_TO_RUNNER', payload: completedDevices });
      // Optional: auto-start scan if credentials are pre-stored (Tier 4 requires this)
    }
  }, 30_000); // Check every 30 seconds
  return () => clearInterval(interval);
}, [state.monitor.devices]);
```

**Approach B: Backend webhook (requires API server)**

```
WDS task sequence completion step calls webhook:
  POST http://deployment-runner-api/webhook/imaging-complete
  Body: { mac: "00:1A:2B:3C:4D:5E", hostname: "HQ-LT-001", rackSlot: "R1-S01" }

API server:
  → Updates Image Monitor state to "Completed"
  → Triggers transfer to runner queue
  → Starts scan with service account credentials
  → Monitors scan completion
  → Archives and removes Success devices automatically
```

### Credential handling at Tier 4

Auto-starting a scan requires pre-stored credentials. Security options:

| Option | Security Level | How |
|---|---|---|
| Environment variable on API server | Medium | `DEPLOY_USERNAME`, `DEPLOY_PASSWORD` env vars |
| Azure Key Vault / HashiCorp Vault | High | API server fetches credentials at scan time |
| Managed Identity (Azure) | Very High | No stored secret; identity-based auth |
| LAPS (per-device local admin) | High | Per-device unique passwords fetched at scan time |

> **Never store credentials in browser localStorage or React state across sessions.**
> The current `SecureCredentialModal` correctly enforces session-only credential handling.
> Tier 4 automation that bypasses this modal must implement equivalent security at the API layer.

---

## 7. Tier 5 — PXE Remote Imaging (Fully Off-Site)

### What it is

A technician (or fully automated system) at a remote location initiates PXE imaging over a WAN
connection. The device boots from the network, images itself, runs AutoTag silently, and appears
in the Image Monitor being watched by a remote operator. The operator monitors and manages the
entire pipeline through a browser pointing at the Deployment Runner web app.

### Architecture

```
REMOTE SITE (branch office, warehouse, etc.)
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────┐  PXE Request  ┌──────────────────────┐   │
│  │ Device   │──────────────▶│ Local DHCP / Router  │   │
│  │ boots    │               │ with DHCP option 66  │   │
│  └──────────┘               └──────────┬───────────┘   │
│                                         │               │
└─────────────────────────────────────────┼───────────────┘
                                          │ VPN tunnel / WAN
                                          ▼
HQ / DATA CENTER
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐    │
│  │ WDS/MDT  │   │ Network  │   │ Deployment Runner │    │
│  │ Server   │   │ Share    │   │ Web App           │    │
│  │          │   │ (JSON)   │   │ (served on LAN)   │    │
│  └──────────┘   └──────────┘   └────────┬─────────┘    │
│                                          │              │
└──────────────────────────────────────────┼──────────────┘
                                           │ HTTPS / VPN
                                           ▼
REMOTE OPERATOR
┌──────────────────────────────────────────────────────────┐
│  Browser → https://deployer.company.com                  │
│  Watches Image Monitor, manages Deployment Runner        │
│  No physical access to devices needed once imaging starts│
└──────────────────────────────────────────────────────────┘
```

### What's needed for Tier 5

#### 1. WAN-accessible WDS/MDT server

The WDS server must be reachable from the remote site. Options:

**Option A: VPN + WDS**
- Site-to-site VPN between remote site and HQ
- DHCP at remote site relays PXE requests to HQ WDS server via IP helper/relay agent
- WDS serves boot image across VPN (slow on high-latency links; consider BranchCache)

```
# Cisco router — IP helper for PXE relay
interface GigabitEthernet0/0
  ip helper-address 10.0.0.5   ! WDS server IP at HQ
```

**Option B: Local WDS/MDT server + DFS replication**
- Install a WDS server at each site
- Replicate WIM images and MDT content via DFS-R
- Each site boots from local WDS (fast) but logs to central share (for Image Monitor)

**Option C: iPXE + HTTPS chainloading**
- Deploy iPXE on devices (embedded in BIOS, USB, or via DHCP)
- iPXE fetches boot script from HTTPS endpoint (cloud-hosted)
- Works over internet without VPN for boot phase
- Example iPXE script:

```
#!ipxe
dhcp
set base-url https://pxe.company.com/boot
chain ${base-url}/menu.ipxe
```

#### 2. Deployment Runner app served on network

```bash
# Build the app
npm run build

# Serve on LAN/WAN
npx serve dist -p 3000 --cors
# Or use nginx with HTTPS for production

# nginx config snippet:
server {
  listen 443 ssl;
  server_name deployer.company.com;
  root /var/www/secure-deployer/dist;
  try_files $uri /index.html;  # SPA fallback
}
```

#### 3. Network share accessible from WinPE and app server

```
AutoTag writes JSON to:  \\hq-fileserver\imaging-monitor\
Image Monitor reads from: \\hq-fileserver\imaging-monitor\ (or via HTTP API)

Both the WinPE environment (remote device during imaging) and
the Image Monitor polling logic must reach the same share path.
For WAN scenarios: use DFS namespaces or a REST API endpoint instead of direct SMB share.
```

#### 4. Remote operator access

```
Method 1: VPN + browser
  Remote tech connects to company VPN → opens browser → https://deployer.company.lan
  All traffic over VPN; no external exposure

Method 2: HTTPS + zero-trust access (Cloudflare Access, Azure App Proxy)
  App served publicly with authentication gate
  Tech authenticates via SSO → accesses app without VPN client

Method 3: Jump server + RDP
  Tech RDPs to management server at HQ → operates browser locally
  Device traffic stays on HQ network; no WAN exposure for deployment actions
```

---

## 8. Remote App Access Options

### Option A: LAN Serve (Vite preview / static server)

```bash
npm run build
npx serve dist -p 3000
# Accessible at: http://<server-ip>:3000
```

Suitable for: same-network access (imaging lab, office LAN).
Not suitable for: WAN access without reverse proxy.

### Option B: nginx Reverse Proxy with HTTPS

```nginx
# /etc/nginx/sites-available/deployer
server {
    listen 443 ssl http2;
    server_name deployer.company.com;

    ssl_certificate     /etc/ssl/certs/deployer.crt;
    ssl_certificate_key /etc/ssl/private/deployer.key;

    root /var/www/secure-deployer/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Content-Security-Policy "default-src 'self'";
}
```

Suitable for: multi-site access over HTTPS.
Security note: Credential modal (`SecureCredentialModal.tsx`) sends no data to a server; credentials
stay in-browser session only. However, ensure HTTPS so session data is not intercepted in transit.

### Option C: Caddy (zero-config HTTPS)

```
# Caddyfile
deployer.company.com {
    root * /var/www/secure-deployer/dist
    try_files {path} /index.html
    file_server
    encode gzip
}
```

Caddy auto-provisions Let's Encrypt TLS. Simplest production-grade option for a small team.

### Option D: VPN + LAN access

Tech connects company VPN → accesses `http://deployer-server.company.lan:3000`.
No public exposure. Best for security-conscious environments where internet access to the tool
is not required.

### Option E: RDP to Management Server

Tech RDPs to a Windows server in HQ that has a browser open to the Deployment Runner.
Deployment actions execute from the management server's network perspective, not the tech's home
network. This matters when WinRM connections to imaging targets are restricted by source IP.

```
Remote Tech                Management Server             Imaging Devices
┌──────────┐  RDP          ┌──────────────┐  WinRM       ┌─────────────┐
│ Laptop   │──────────────▶│ HQ Windows   │─────────────▶│ Device 1   │
│ (home)   │               │ Server       │              │ Device 2   │
└──────────┘               │ (browser     │              │ Device 3   │
                           │  open to     │              └─────────────┘
                           │  deployer)   │
                           └──────────────┘
```

---

## 9. PXE4 and Starting Imaging Remotely

"PXE4" refers to PXE boot over IPv4, the standard WDS/MDT boot mechanism. Starting imaging
remotely means triggering a PXE boot on a device that is powered off or at a pre-boot state
without physically pressing keys on the device.

### Method 1: Wake-on-LAN + PXE

The most common remote imaging trigger. The Deployment Runner already implements WoL
(`validateDevice()` sends a WoL magic packet before connecting). For imaging, the same principle
applies:

```
Pre-condition:
  • Device is powered off but plugged into ethernet
  • BIOS has WoL enabled (usually under power management)
  • Network switch preserves WoL packets on VLAN

Steps:
  1. Send WoL magic packet to device MAC address
     (from PowerShell: Send-WakeOnLan -MacAddress "00:1A:2B:3C:4D:5E")
  2. Device receives WoL packet → powers on
  3. BIOS executes PXE boot (if WoL boot option is set to Network)
  4. WDS/MDT boots device → task sequence runs → imaging begins

Tools for sending WoL:
  • PowerShell: custom WoL function (already in deploymentService.ts logic)
  • wolcmd.exe (Windows command line)
  • wakeonlan (Linux: apt install wakeonlan)
  • Scheduled task or API endpoint on management server
```

### Method 2: IPMI / iDRAC / iLO (Out-of-Band Management)

Enterprise servers and many business-class workstations include an out-of-band management
interface (Dell iDRAC, HP iLO, Supermicro IPMI) that can:
- Power on a device remotely
- Mount a virtual ISO/image
- Force PXE boot on next power cycle
- View console (KVM over IP) without physical access

```powershell
# Dell iDRAC — force PXE boot and power on (via Redfish API)
$headers = @{ Authorization = "Basic <base64creds>" }
$body = @{
  Boot = @{
    BootSourceOverrideTarget = "Pxe"
    BootSourceOverrideEnabled = "Once"
  }
} | ConvertTo-Json

# Set one-time PXE boot
Invoke-RestMethod -Method PATCH `
  -Uri "https://idrac-ip/redfish/v1/Systems/System.Embedded.1" `
  -Headers $headers -Body $body -ContentType "application/json"

# Power on
Invoke-RestMethod -Method POST `
  -Uri "https://idrac-ip/redfish/v1/Systems/System.Embedded.1/Actions/ComputerSystem.Reset" `
  -Headers $headers `
  -Body '{"ResetType":"On"}' -ContentType "application/json"
```

### Method 3: SCCM / Intune OSD Remote Initiation

If devices already have an SCCM client or are enrolled in Intune, imaging can be triggered
remotely through the console:

**SCCM:**
```
SCCM Console → Assets and Compliance → Devices
  Right-click device → Deploy → Operating System Image
  Choose task sequence → Deploy → Required
  Schedule: As soon as possible

  Device will receive deployment advertisement and initiate imaging on next check-in
  (or immediately if SCCM Fast Channel / CMG is configured)
```

**Intune (Autopilot reset):**
```
Intune portal → Devices → All devices → Select device
  → ... (Actions) → Autopilot Reset

  Causes device to reinstall Windows, re-run Autopilot provisioning,
  and re-apply Intune profiles on next user sign-in
```

### Method 4: Network Boot via Scheduled Task + WoL

Automate the WoL + PXE sequence for a batch of devices on a schedule:

```powershell
# PowerShell scheduled task — runs at 3:00 AM, sends WoL to all devices in list
# devices.csv contains: Hostname, MAC, BroadcastIP
$devices = Import-Csv "C:\imaging\devices.csv"

foreach ($device in $devices) {
    # Send WoL magic packet
    $mac = $device.MAC -replace '[-:]',''
    $macBytes = [byte[]] ($mac -split '(?<=\G..)' | Where-Object { $_ } | ForEach-Object { [Convert]::ToByte($_, 16) })
    $payload = ([byte[]] @(0xFF) * 6) + ($macBytes * 16)
    $udpClient = New-Object System.Net.Sockets.UdpClient
    $udpClient.Connect($device.BroadcastIP, 9)
    $udpClient.Send($payload, $payload.Length)
    $udpClient.Close()

    Write-Host "WoL sent to $($device.Hostname) ($($device.MAC))"
    Start-Sleep -Seconds 30  # Stagger boots to avoid WDS overload
}
```

### Combining WoL with Image Monitor Monitoring

```
Remote tech workflow with WoL + Tier 3 automation:

  1. Remote tech sends WoL batch script (above) for rack of devices
  2. Devices power on → PXE boot → Task Sequence starts automatically (Tier 3)
  3. AutoTag runs silently (Tier 2 variables pre-set in MDT rules)
  4. Image Monitor shows all devices progressing (watched via browser / VPN)
  5. Devices complete imaging → auto-transfer to runner (Tier 4) OR manual transfer
  6. Scan runs → remediation → verification → archive → remove

  Net result: Remote tech sends ONE command, then manages the entire pipeline
              from a browser. Zero physical access needed after initial rack setup.
```

---

## 10. Security Considerations for Remote Automation

| Risk | Description | Mitigation |
|---|---|---|
| WoL on open network | WoL can be exploited to power devices at unintended times | Restrict WoL to management VLAN; use directed broadcast, not broadcast |
| Credential exposure via browser | Operator enters credentials in browser running on remote machine | Ensure HTTPS; use VPN; avoid public internet exposure of app |
| Unattended task sequence | Zero-touch TS can image wrong device if DHCP assignment is misconfigured | Validate DHCP scope and option 66/67 assignments carefully; use MAC-based TS assignment |
| AutoTag silent mode | Silent TS variable mode skips operator validation of hostname/rack slot | Pre-validate asset database accuracy before importing to MDT rules |
| PXE boot of non-target devices | DHCP options 66/67 apply to all DHCP clients on the VLAN | Segregate imaging VLAN; only imaging-eligible devices should be connected |
| Compromised network share | AutoTag writes JSON to a share; if share is compromised, monitor data can be poisoned | Apply write ACLs to share; only imaging service accounts should write |
| iDRAC/IPMI exposure | OOB management interfaces are high-value targets | Network-segregate IPMI interfaces; require VPN for access; rotate credentials regularly |
| Credential auto-start (Tier 4) | Pre-stored credentials for auto-scan increase credential exposure surface | Use vault-backed secrets; rotate frequently; prefer managed identity |

---

## 11. Automation Decision Matrix

Use this table to pick the right tier for your environment:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    AUTOMATION DECISION MATRIX                              │
├─────────────────┬────────┬────────┬────────┬─────────┬────────────────────┤
│ Criterion       │ Tier 0 │ Tier 1 │ Tier 2 │ Tier 3  │ Tier 4/5           │
├─────────────────┼────────┼────────┼────────┼─────────┼────────────────────┤
│ MDT/SCCM infra  │ Not    │ Not    │ Req'd  │ Req'd   │ Req'd              │
│ required        │ needed │ needed │        │         │                    │
├─────────────────┼────────┼────────┼────────┼─────────┼────────────────────┤
│ Tech at device  │ Yes    │ Partial│ PXE    │ Power   │ WoL only           │
│                 │        │        │ only   │ only    │ (remote)           │
├─────────────────┼────────┼────────┼────────┼─────────┼────────────────────┤
│ Asset DB needed │ No     │ Yes    │ Yes    │ Yes     │ Yes                │
├─────────────────┼────────┼────────┼────────┼─────────┼────────────────────┤
│ Code changes    │ None   │ None   │ PS     │ WDS     │ App + API          │
│ needed          │        │        │ script │ config  │ server             │
├─────────────────┼────────┼────────┼────────┼─────────┼────────────────────┤
│ Human error     │ High   │ Medium │ Low    │ Very    │ Minimal            │
│ risk            │        │        │        │ Low     │                    │
├─────────────────┼────────┼────────┼────────┼─────────┼────────────────────┤
│ Setup effort    │ None   │ Low    │ Medium │ Medium  │ High               │
├─────────────────┼────────┼────────┼────────┼─────────┼────────────────────┤
│ Best for        │ Pilots │ Daily  │ 25–100 │ 50–500  │ 100+ / multi-site  │
│                 │ & labs │ ops    │ devices│ devices │                    │
└─────────────────┴────────┴────────┴────────┴─────────┴────────────────────┘

RECOMMENDATION FOR MOST TEAMS:
  • Start at Tier 0 to learn the workflow
  • Move to Tier 1 immediately (pre-staged CSV costs nothing)
  • Move to Tier 2 when you have MDT/SCCM and want to reduce intake errors
  • Move to Tier 3 for large imaging events (> 30 devices per window)
  • Move to Tier 4/5 for regular multi-site operations or unattended overnight imaging
```
