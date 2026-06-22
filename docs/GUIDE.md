# Secure Deployment Runner — Comprehensive Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Gemini API Key Setup](#gemini-api-key-setup)
5. [Usage](#usage)
   - [Device Onboarding via CSV Upload](#device-onboarding-via-csv-upload)
   - [Deployment Actions per Device](#deployment-actions-per-device)
   - [Bulk Execution](#bulk-execution)
   - [Imaging Intake and Transfer](#imaging-intake-and-transfer)
   - [Deployment History Archives](#deployment-history-archives)
   - [Credential Gates for Sensitive Operations](#credential-gates-for-sensitive-operations)
6. [PWA: Install as a Desktop App](#pwa-install-as-a-desktop-app)
7. [Testing](#testing)
8. [Production Build and Deployment](#production-build-and-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Secure Deployment Runner is a React 19 + TypeScript operations dashboard for coordinating endpoint
imaging handoff, compliance validation, and remote remediation workflows at scale. It is designed
for IT teams that need a centralized interface to track device readiness, run deployment actions in
bulk, and preserve an auditable history of each deployment run.

The application runs entirely in the browser — there is no backend server. All state lives in the
React component tree via a central `useReducer` in `contexts/AppContext.tsx`. The deployment
service layer (`services/deploymentService.ts`) is currently a **simulated PowerShell-style
service** — it models real-world behavior including connectivity failures, retries, compliance
outcomes, and the update/reboot lifecycle, making it suitable for workflow validation, UI
prototyping, and operator training before integration with live infrastructure.

### Key Capabilities

| Capability | Description |
|---|---|
| CSV device onboarding | Import devices with `Hostname`/`MAC` columns; row-level error reporting |
| Deployment actions | Validate, update (BIOS/DCU/Windows), execute script, reboot, cancel, remove |
| Bulk execution | Apply any action to all or selected devices at once, gated by a credential modal |
| Imaging intake and transfer | Accept devices from the Image Monitor rack and move them into the deployment queue |
| Deployment history | Per-run archives, analytics charts (Recharts), CSV export |
| Credential gates | Session-only credential capture — never persisted to localStorage or state |
| PWA | Installable as an offline-capable desktop app via Chrome or Edge |
| Remote Desktop | Generate `.rdp` files for direct RDP access to any device |
| Gemini AI | Optional AI-assisted features (requires user-supplied API key) |

---

## Prerequisites

### Required

- **Node.js 20 LTS or higher** — download from [nodejs.org](https://nodejs.org/en/download/) or
  install via a version manager (`nvm`, `fnm`, `volta`)
- **npm 10+** — bundled with Node.js 20; verify with `npm --version`
- **Git 2.x+** — for cloning the repository
- **Modern browser** — latest Chrome, Edge, Firefox, or Safari

Verify your Node.js version before proceeding:

```bash
node --version
# Must print v20.x.x or higher
```

### Optional

- **Gemini API key** — only required if you want to use AI-assisted features. Core deployment
  functionality (scanning, updates, CSV import, history) works without it.
- **Rust + Tauri prerequisites** — only required if building the native desktop (Tauri) variant.
  See [Tauri prerequisites](https://tauri.app/start/prerequisites/) for platform-specific
  instructions.

---

## Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/samueljackson-collab/secure-deployer.git
cd secure-deployer
```

### Step 2 — Install dependencies

```bash
npm ci
```

Using `npm ci` (instead of `npm install`) is recommended for repeatable installs — it installs
exactly the versions recorded in `package-lock.json` without modifying it.

Expected output:

```
added 412 packages, and audited 413 packages in 14s
found 0 vulnerabilities
```

**If this fails:**

| Error | Cause | Fix |
|---|---|---|
| `ENOENT` | Not inside the project folder | Run `cd secure-deployer` first |
| `engine` error | Node version too old | Upgrade to Node 20+ |
| `EACCES` | Permission error on macOS/Linux | Do not use `sudo npm ci`; fix npm prefix: `npm config set prefix ~/.npm-global` |

### Step 3 — Configure environment variables (optional)

```bash
cp .env.example .env
```

The app works without any environment variables. The `.env` file is only needed if you want to
pre-bake a Gemini API key into the bundle at build time. See [Gemini API Key Setup](#gemini-api-key-setup) below.

### Step 4 — Start the development server

```bash
npm run dev
```

The dev server starts at **http://localhost:3000** with hot module replacement. You should see the
Secure Deployment Runner dashboard with the Image Monitor tab active.

```
  VITE v6.2.x  ready in 312 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

Open `http://localhost:3000` in your browser to confirm setup is complete.

---

## Gemini API Key Setup

AI-assisted features (script analysis, AI-assisted anomaly summaries) use the Google Gemini API
via `@google/genai`. The API key is **optional** — all core deployment functionality works without
it.

### Option A — Enter key at runtime (recommended for most users)

No environment setup is needed. When the app loads, a prompt will appear in the UI if an AI
feature is invoked without a key. Enter your Gemini API key in the field provided; it is stored
in `localStorage` under the key `geminiApiKey` and reused on subsequent sessions.

Get a key at [aistudio.google.com](https://aistudio.google.com/app/apikey).

### Option B — Pre-bake key into the build (for shared/hosted deployments)

1. Create a `.env` file in the project root:
   ```
   GEMINI_API_KEY=your_key_here
   ```
2. Run `npm run build`. Vite injects the key into the bundle at build time via:
   ```typescript
   // vite.config.ts
   define: {
     'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
   }
   ```

**Security note:** Do not commit `.env` files containing real API keys. Add `.env` to `.gitignore`
and use GitHub Actions secrets for CI/CD builds.

---

## Usage

### Device Onboarding via CSV Upload

Devices can be imported into the Deployment Runner using a CSV file.

**Required columns** (case-insensitive header match):
- `Hostname`
- `MAC` or `MACAddress`

**Optional columns:**
- `Model` — Dell hardware model string (e.g., `Latitude 5450`, `OptiPlex 7020 SFF`). When
  present, enables accurate form-factor detection and device imagery regardless of hostname format.
  This is the recommended approach.

**Example CSV (with model — recommended):**

```csv
Hostname,MAC,Model
CORP-LT-001,00:1A:2B:3C:4D:5E,Latitude 5450
CORP-SFF-002,10-20-30-40-50-60,OptiPlex 7020 SFF
CORP-MICRO-003,00.11.22.33.44.55,OptiPlex 7020 Micro
CORP-LT-004,AA:BB:CC:DD:EE:FF,Latitude 5650
```

**Example CSV (hostname fallback):**

```csv
Hostname,MAC
HQ-LT-001,00:1A:2B:3C:4D:5E
BRANCH-SFF-007,10-20-30-40-50-60
```

**MAC format:** Colon-separated (`AA:BB:CC:DD:EE:FF`), hyphen-separated (`AA-BB-CC-DD-EE-FF`), or
dot-separated (`AABB.CCDD.EEFF`) are all accepted. Values are normalized to uppercase by
`normalizeMacAddress()` in `utils/helpers.ts`.

**How to upload:**
1. Open the **Deployment Runner** tab.
2. Click **Upload CSV** in the device list area.
3. Select your `.csv` file.
4. The app parses the file using Papa Parse and displays each imported device in the status table.
   Row-level errors (missing hostname, invalid MAC) are logged in the log panel — valid rows are
   still imported.

**Common parsing errors:**
- `CSV imports 0 devices` — check that your header row matches `Hostname` and `MAC` (or
  `MACAddress`) exactly (case-insensitive).
- `MAC rejected` — the MAC contains unsupported characters or resolves to a length other than
  12 hex characters after normalization.

---

### Deployment Actions per Device

Each device row in the Deployment Runner exposes the following per-device actions once a scan is
underway or complete:

| Action | When Available | What It Does |
|---|---|---|
| **Validate** | Any time | Re-runs compliance checks for this device |
| **Update** | After `Scan Complete` | Applies BIOS, DCU, and/or Windows updates as needed |
| **Execute Script** | After script attachment | Runs the attached post-imaging PowerShell script |
| **Reboot** | After `Update Complete (Reboot Pending)` | Triggers device reboot |
| **Cancel** | While action is in progress | Cancels the running task |
| **Remove** | Any time | Removes the device from the current deployment queue |

Device status transitions flow as follows:

```
Pending → Pending Validation → Connecting → Checking Info
  → Checking BIOS / DCU / Windows
    ├─ Success (all checks pass)
    ├─ Scan Complete (one or more checks failed — action required)
    └─ Offline (retries exhausted)

Scan Complete → Updating → Update Complete (Reboot Pending)
  → Rebooting... → Success | Failed
```

The compliance checklist per device covers:
- BIOS version (target: `A24`)
- DCU version (target: `5.1.0`)
- Windows version (target: `23H2`)
- BitLocker encryption status
- CrowdStrike endpoint protection
- SCCM management agent health

---

### Bulk Execution

The **Bulk Actions** bar at the top of the Deployment Runner allows operations to be applied to
all devices or a selected subset simultaneously.

**Available bulk operations:**
- Validate All / Validate Selected
- Update All / Update Selected
- Execute Script (all/selected)
- Reboot All / Reboot Selected
- Cancel All
- Remove Selected
- File operations: Run / Install / Delete (requires file selection)

**Credential gate:**
Any bulk operation that initiates a scan or destructive action prompts a
`SecureCredentialModal` before executing. Credentials entered are used only for the duration of
that operation and are never written to localStorage, component state, or any persisted store.

**Safe bulk execution checklist:**
- [ ] Device list is current; duplicates reviewed
- [ ] Retry/delay values match site network stability (configure in Advanced Settings)
- [ ] Bulk action cohorts are homogeneous — apply bulk updates only to `Scan Complete` devices,
      not a mixed-status group
- [ ] Log panel is visible before any bulk action starts
- [ ] Escalation path is known for recurring failures

---

### Imaging Intake and Transfer

The **Image Monitor** tab provides a rack grid view of all devices currently being imaged via
PXE boot. Devices populate automatically when the AutoTag PowerShell script runs during imaging.

**Imaging lifecycle:**
1. Device boots into WinPE via PXE.
2. Tech runs `autotag.bat` (opens a WinPE prompt → `AutoTag.ps1` runs automatically).
3. AutoTag collects hostname, MAC, model, serial, IP, and rack slot; writes a JSON record to the
   configured network share.
4. Image Monitor polls the share every 30 seconds; device card appears in the rack view.
5. Imaging progress bar advances from 0% to 100%.
6. Post-image compliance checks run automatically (`runComplianceChecks`): BitLocker, LAPS, Citrix
   Workspace, SCCM client.
7. Device status becomes `Completed` (pass) or `Completed with flags` (issues found).

**Transferring devices to the Deployment Runner:**
1. In the Image Monitor rack, select the devices you want to transfer (or use "Select All
   Completed").
2. Click **Transfer Selected** (or **Transfer All**).
3. The `TRANSFER_IMAGING_DEVICES_TO_RUNNER` reducer action fires; `transformImagingToRunnerDevices`
   converts each `ImagingDevice` to a `Device` record and adds it to the runner queue.
4. Switch to the **Deployment Runner** tab — transferred devices appear immediately.

---

### Deployment History Archives

The **Deployment History** panel (within the Deployment Runner tab) shows the last 10 completed
run archives.

Each run archive includes:
- Run ID and timestamp
- Total devices / success count / failed count / offline count
- Per-category failure breakdown
- Trend charts (Recharts bar and line charts)

**Exporting a run:**
Click the **Export CSV** button on any run card to download a comma-separated summary of that
run's device outcomes.

**Analytics view:**
The **Trends & Analytics** tab shows aggregate charts across all archived runs — success rates
over time, update type breakdown, failure pattern trends.

---

### Credential Gates for Sensitive Operations

Scan start and bulk operations that affect device state require credential entry via the
`SecureCredentialModal`. This is by design.

**Key properties of the credential gate:**
- Credentials are captured in a modal prompt and dispatched as a one-time ephemeral payload via
  the `START_DEPLOYMENT_CONFIRMED` reducer action.
- They are never written to `localStorage`, React state, or any browser storage mechanism.
- The modal cannot be bypassed in the UI — the scan does not start until valid credentials are
  submitted.
- Session ends when the browser tab is closed or refreshed.

For production integration, credentials should be replaced with vault-backed secrets (Azure Key
Vault, HashiCorp Vault, AWS Secrets Manager) and SSO/RBAC controls.

---

## PWA: Install as a Desktop App

Secure Deployment Runner is a full Progressive Web App (PWA). Once deployed to an HTTPS host, it
can be installed as a standalone desktop application in Chrome or Edge — no Electron or native
installer required.

**Requirements:** The app must be served over **HTTPS**. PWA installation is blocked by browsers
on plain HTTP (except `localhost`).

### Installing in Chrome or Edge

1. Open the hosted URL in Chrome or Edge.
2. Look for the install icon (a computer with a down-arrow, or a `+` icon) in the browser address
   bar.
3. Click the icon and confirm installation.
4. The app opens in a standalone window (no browser chrome) with its own icon on the desktop and
   taskbar.

### Offline capability

After first load, the service worker (generated by `vite-plugin-pwa`) caches all application
assets. The app functions fully offline — it does not require internet access for deployment
scanning, CSV imports, or history review. AI features require internet connectivity to reach the
Gemini API.

### PWA manifest and icons

PWA metadata (app name, icons, display mode) is configured in `vite.config.ts` under the
`VitePWA(...)` plugin options. Static icons are in the `public/` directory. If the install prompt
does not appear, verify:
- The site is served over HTTPS.
- `public/manifest.webmanifest` (or `manifest.json`) is reachable.
- Icons at the sizes declared in the manifest exist and load without 404 errors.

---

## Testing

### Current Status: No Tests Yet

There are **no automated tests** in the repository at this time. The `vitest.config.ts` file
exists but is broken and will not run tests correctly.

### The Broken vitest.config.ts

The current `vitest.config.ts` is missing three required fields for browser-based React component
testing:

```typescript
// vitest.config.ts — current (broken)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
  },
});
```

**What is missing:**

| Missing field | Why it is required |
|---|---|
| `environment: 'jsdom'` | Vitest needs a DOM environment to render React components; without it, calls to `document`, `window`, and React DOM mount will throw |
| `globals: true` | Enables global `describe`, `it`, `expect`, `beforeEach` etc. without explicit imports in every test file |
| `setupFiles: ['./tests/setup.ts']` | Required to configure `@testing-library/react` cleanup and any global mocks before each test |

**What needs to be done before tests can run:**

1. Install missing test dependencies:
   ```bash
   npm install --save-dev vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
   ```

2. Fix `vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       globals: true,
       setupFiles: ['./tests/setup.ts'],
       coverage: {
         provider: 'v8',
         thresholds: {
           lines: 70,
           functions: 70,
         },
       },
     },
   });
   ```

3. Create `tests/setup.ts`:
   ```typescript
   import '@testing-library/jest-dom';
   import { afterEach } from 'vitest';
   import { cleanup } from '@testing-library/react';

   afterEach(() => {
     cleanup();
   });
   ```

4. Add a `test` script to `package.json` (currently absent):
   ```json
   "test": "vitest run",
   "test:watch": "vitest",
   "test:coverage": "vitest run --coverage"
   ```

### Planned Test Areas

Once the test harness is fixed, the following areas are planned for unit and integration coverage:

| Area | Test target | Priority |
|---|---|---|
| CSV parsing | `parseDevicesFromCsv()` in `services/deploymentService.ts` — valid rows, missing headers, malformed MACs, empty file | High |
| AppContext reducer | All action types in `contexts/AppContext.tsx` — state transitions for `START_DEPLOYMENT_CONFIRMED`, `VALIDATE_DEVICES`, `BULK_UPDATE`, `ARCHIVE_RUN`, `TRANSFER_IMAGING_DEVICES_TO_RUNNER` | High |
| Utility functions | `normalizeMacAddress()` and `detectDeviceType()` in `utils/helpers.ts` | High |
| Service simulation | `validateDevice()`, `updateDevice()` in `services/deploymentService.ts` — mock `sleep`, verify status transitions | Medium |
| Component rendering | `DeviceStatusTable`, `BulkActions`, `SecureCredentialModal` — render smoke tests | Medium |

---

## Production Build and Deployment

### Build

```bash
npm run build
```

This produces a fully self-contained static bundle in `dist/`. No server-side runtime is required.

What the build produces:

| File | Purpose |
|---|---|
| `dist/index.html` | Single HTML entry point |
| `dist/assets/index-[hash].css` | All Tailwind and component styles |
| `dist/assets/index-[hash].js` | All React components, services, utilities |
| `dist/sw.js` | PWA service worker (offline caching) |
| `dist/registerSW.js` | Registers the service worker on first load |

### Lint and type-check before building

```bash
npm run lint        # ESLint — must exit with 0 warnings and 0 errors
```

The lint command uses `--max-warnings 0` — any warning is a build failure.

For an explicit TypeScript-only check:
```bash
npx tsc --noEmit
```

### Deploying to Netlify

CI/CD is handled by GitHub Actions (`.github/workflows/ci.yml`). On every push to `main`, the
workflow:
1. Runs lint (`npm run lint`)
2. Runs tests (`npm test`) — currently fails due to broken vitest config; fix this before enabling
3. Runs build (`npm run build`)
4. Uploads `dist/` as an artifact
5. Deploys to Netlify using `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` secrets

To configure Netlify deployment:
1. Create a Netlify site and copy the **Site ID** from Site Settings.
2. Generate a **Personal Access Token** in Netlify user settings.
3. Add both as repository secrets in GitHub: `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`.

**Netlify redirect rules:** Add a `public/_redirects` file (or `netlify.toml`) to handle SPA
client-side routing:

```
/* /index.html 200
```

Without this, direct URL navigation (e.g., refreshing on a deep route) returns a 404.

### Preview the production build locally

```bash
npm run build && npm run preview
# Serves dist/ at http://localhost:4173
```

---

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---|---|---|
| **CSV imports 0 devices** | Missing or mismatched column headers | Verify the header row contains `Hostname` and `MAC` (or `MACAddress`). Headers are case-insensitive but must match exactly after normalization. |
| **MAC address rejected** | Invalid characters or wrong length | MAC must resolve to exactly 12 hex characters. Accepted separators: `:`, `-`, `.`. |
| **Bulk actions failing / credential modal blocked** | Credentials not entered or modal dismissed | Ensure you submit valid credentials in the `SecureCredentialModal`. The scan will not start without them. |
| **PWA install prompt not appearing** | App not served over HTTPS | PWA installation requires HTTPS. `localhost` is an exception. Verify the manifest is reachable and icons load correctly. |
| **App fails to start / `EADDRINUSE`** | Port 3000 already in use | Kill the process using port 3000, or change `server.port` in `vite.config.ts`. |
| **Most devices show Offline** | Mock service simulates connectivity instability | Increase Max Retries and Retry Delay in Advanced Settings and re-scan. |
| **Blank page after `npm run dev`** | JavaScript error in browser | Open DevTools (F12) → Console tab; copy the error message and investigate. |
| **Device image shows SVG icon** | Dell CDN image failed to load | Expected fallback in dev/offline environments. SVG icon renders automatically — no action needed. |
| **`npm test` errors immediately** | Broken vitest.config.ts | See the [Testing](#testing) section for the exact fix required before tests can run. |
| **Device not appearing in Image Monitor** | AutoTag did not publish to network share | Re-run `autotag.bat`; verify the network share path and credentials in the app settings. |
| **Scan starts then hangs** | Long retry chain on large cohort | Reduce cohort size, cancel the scan, and restart with shorter retry settings. |
