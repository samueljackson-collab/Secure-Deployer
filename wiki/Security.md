# Security

> Comprehensive security hardening details, credential handling, compliance posture, and threat model.

---

## Table of Contents

- [Threat Model](#threat-model)
- [Defense-in-Depth Layers](#defense-in-depth-layers)
- [Electron Hardening](#electron-hardening)
- [Content Security Policy](#content-security-policy)
- [Script Safety Analyzer](#script-safety-analyzer)
- [Device Scope Guard](#device-scope-guard)
- [Credential Security](#credential-security)
- [Network Security](#network-security)
- [What Was Removed and Why](#what-was-removed-and-why)
- [Compliance Considerations](#compliance-considerations)
- [Security Checklist](#security-checklist)

---

## Threat Model

### Environment

This application runs on **hospital networks** where:

- Systems support patient care — downtime can be life-threatening
- Networks carry protected health information (PHI) subject to HIPAA
- Devices range from clinical workstations to thin clients to imaging stations
- IT operators may have varying levels of security awareness
- USB drives are the primary distribution mechanism

### Threat Categories

| Threat | Risk Level | Mitigation |
|--------|-----------|------------|
| **Script injection** — malicious commands in deployment scripts | Critical | Script Safety Analyzer blocks destructive patterns pre-execution |
| **Scope creep** — operations affecting unintended devices | Critical | Device Scope Guard requires per-device verification |
| **Credential theft** — passwords captured from logs or disk | High | In-memory only, 30-min auto-wipe, log sanitization |
| **Network exposure** — dev server accessible on hospital LAN | High | Vite bound to `127.0.0.1` only |
| **XSS / code injection** — malicious code in CSV or script data | High | CSP blocks inline scripts, no `eval()`, no `innerHTML` with user data |
| **Supply chain** — compromised npm packages | Medium | Minimal dependencies (3 runtime), no AI packages |
| **MITM attacks** — intercepted connections | Medium | Invalid TLS certificates rejected unconditionally |
| **Physical USB theft** — someone takes the USB drive | Medium | No credentials on disk, no sensitive data persisted |
| **Unattended session** — operator walks away from terminal | Medium | 30-minute session timeout wipes credentials |

---

## Defense-in-Depth Layers

Security is implemented across 8 independent layers. Compromising one layer does not compromise the others.

```
Layer 8: Session Timeout          ← Wipes credentials after 30 min inactivity
Layer 7: Log Sanitization         ← Redacts passwords/tokens/secrets from all logs
Layer 6: Device Scope Guard       ← Per-device verification before bulk operations
Layer 5: Script Safety Analyzer   ← Blocks destructive patterns pre-execution
Layer 4: Credential Handling      ← In-memory only, never written to disk
Layer 3: Content Security Policy  ← Blocks XSS, code injection, frame embedding
Layer 2: Electron Sandbox         ← Process isolation, context isolation, no Node.js
Layer 1: Network Binding          ← Dev server on localhost only, no external access
```

---

## Electron Hardening

### Main Process Configuration (`electron/main.cjs`)

The Electron main process implements these security controls:

#### 1. Hardware Acceleration Disabled

```javascript
app.disableHardwareAcceleration();
```

**Why**: Hardware acceleration can expose GPU-level attack surfaces. On hospital workstations with shared displays, disabling it reduces the risk of GPU memory leakage.

#### 2. Single Instance Lock

```javascript
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}
```

**Why**: Prevents multiple instances from running simultaneously. Multiple instances could lead to credential confusion (different creds in different windows) or race conditions in deployment operations.

#### 3. BrowserWindow Security Options

```javascript
webPreferences: {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webviewTag: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
}
```

| Option | Value | Purpose |
|--------|-------|---------|
| `sandbox` | `true` | Renderer process runs in OS-level sandbox |
| `contextIsolation` | `true` | Renderer JS cannot access Electron/Node.js APIs |
| `nodeIntegration` | `false` | `require()`, `process`, `__dirname` are not available |
| `webviewTag` | `false` | Prevents embedding external web content |
| `webSecurity` | `true` | Enforces same-origin policy |
| `allowRunningInsecureContent` | `false` | Blocks HTTP resources on HTTPS pages |
| `experimentalFeatures` | `false` | Disables unstable Chromium features |

#### 4. Navigation Blocking

```javascript
mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
});
```

**Why**: Prevents the renderer from navigating to external URLs. A crafted CSV or script filename cannot redirect the application to a malicious page.

#### 5. Permission Blocking

```javascript
session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
});
```

**Why**: Blocks all permission requests (geolocation, camera, microphone, notifications). A deployment tool has no legitimate need for any of these.

#### 6. Certificate Validation

```javascript
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(false);  // Reject ALL invalid certificates
});
```

**Why**: Prevents man-in-the-middle attacks. On a hospital network, an invalid certificate likely indicates a misconfigured proxy or an active attack. Both should be rejected.

#### 7. Storage Clearing

```javascript
session.defaultSession.clearStorageData();
```

**Why**: Clears all cached data from previous sessions on startup. Ensures no stale credentials, tokens, or session data persist between launches.

---

## Content Security Policy

### Policy Definition

The CSP is injected via Electron's `onHeadersReceived` handler:

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

### Directive Breakdown

| Directive | Value | What It Blocks |
|-----------|-------|---------------|
| `default-src 'self'` | All resources must come from the app itself | External scripts, stylesheets, fonts, etc. |
| `script-src 'self'` | Only bundled JS can execute | Inline scripts, `eval()`, external script tags |
| `style-src 'self' 'unsafe-inline'` | Bundled CSS + inline styles | External stylesheets (CDNs) |
| `img-src 'self' data:` | Local images + data URIs | External image loading |
| `frame-src 'none'` | No iframes allowed | Clickjacking, frame embedding |
| `object-src 'none'` | No plugins (Flash, Java, etc.) | Plugin-based exploits |
| `base-uri 'self'` | Base URL cannot be changed | Base tag injection attacks |
| `form-action 'self'` | Forms can only submit to the app | Form action hijacking |

### Why `'unsafe-inline'` for Styles?

Tailwind CSS generates inline style attributes for dynamic utility classes (e.g., `translate-x-6` on toggle switches, `animate-pulse` on status badges). Removing `'unsafe-inline'` would break these dynamic styles. This is acceptable because:

- `script-src` does NOT allow inline — the critical protection against XSS is intact
- No user input is ever rendered as raw HTML
- All CSS is generated by the application's own build pipeline

---

## Script Safety Analyzer

### How It Works

The analyzer at `services/scriptSafetyAnalyzer.ts` is a **deterministic, AI-free** static analysis engine:

1. Splits the script into individual lines
2. Tracks PowerShell block comment state (`<# ... #>`)
3. Skips comment lines (REM, ::, #)
4. Tests each non-comment line against three pattern arrays:
   - **BLOCKED_PATTERNS** (28 rules) — Script cannot execute
   - **DANGER_PATTERNS** (26 rules) — Requires manual override
   - **WARNING_PATTERNS** (18 rules) — Informational
5. Runs subnet/range targeting detection
6. Runs wildcard targeting detection
7. Extracts referenced hostnames and compares against allowed list
8. Produces a `ScriptSafetyResult` with `isSafe`, `riskLevel`, `findings`, `blockedPatterns`, `scopeViolations`

### Why Deterministic Over AI?

| Factor | AI (Gemini) | Deterministic (Regex) |
|--------|------------|----------------------|
| Network required | Yes — API call | No |
| Reproducible results | No — model may vary | Yes — same input = same output |
| Audit trail | Opaque model weights | Every rule readable and reviewable |
| False negatives | Possible (model misses pattern) | Controlled by rule coverage |
| Compliance | Hard to explain to auditors | Easy to demonstrate rule-by-rule |
| Speed | Seconds (API latency) | Milliseconds |

### Blocked Pattern Categories

| Category | Example | Why Blocked |
|----------|---------|-------------|
| Disk destruction | `format C:`, `diskpart` | Destroys OS and all data |
| Recursive deletion | `del /s /q C:\` | Wipes entire drive |
| Firewall disable | `netsh advfirewall ... state off` | Exposes host to network attacks |
| Boot config | `bcdedit` | Can prevent Windows from booting |
| Subnet broadcast | `ping x.x.x.255` | Reaches every host on subnet |
| Wildcard targeting | `psexec \\*` | Executes on all discoverable hosts |
| Critical service stop | `net stop DNS`, `net stop DHCP` | Cripples hospital infrastructure |
| Execution policy bypass | `Set-ExecutionPolicy Bypass -Force` | Disables all PowerShell security |
| Broadcast WoL | `ff:ff:ff:ff:ff:ff` to `255.255.255.255` | Wakes entire subnet |

---

## Device Scope Guard

### Multi-Step Verification

The Scope Guard (`components/DeviceScopeGuard.tsx`) is a modal gate that opens before any bulk operation:

**Step 1: Device Checklist**
- Every target device is listed with hostname, MAC, and IP
- Each must be individually checked via checkbox
- No "check all" shortcut — forces deliberate review

**Step 2: Count Confirmation**
- Operator must type the exact number of devices
- Input is validated against the actual count
- Prevents accidental submission

**Step 3: Safety Policy Configuration**
- Toggle: Block broadcast/subnet-wide commands (default: ON)
- Toggle: Block critical service modifications (default: ON)
- Toggle: Block registry writes to HKLM\SYSTEM (default: ON)
- Toggle: Enforce hostname whitelist (default: ON)

**Step 4: Max Device Limit**
- Default: 50 devices per operation
- Hard maximum: 200 (enforced in code, cannot be overridden via UI)
- Prevents accidentally deploying to hundreds of devices

### Why Per-Device Verification?

On a hospital network, the difference between deploying to 10 correct devices and accidentally including 1 critical care workstation can affect patient outcomes. The Scope Guard ensures:

- Every device is consciously reviewed
- The operator confirms they understand the scope
- Safety policies are explicitly configured
- An audit trail exists (timestamp + operator username)

---

## Credential Security

### Lifecycle

```
Entry → Memory → Use → Sanitize → Expire
  │        │       │        │         │
  │        │       │        │         └── 30-min inactivity → state wiped
  │        │       │        └── Log messages → [REDACTED]
  │        │       └── Passed to deployment functions
  │        └── React useState (RAM only)
  └── SecureCredentialModal input
```

### Key Protections

| Protection | Implementation |
|-----------|---------------|
| **Never on disk** | Credentials stored in React `useState` — RAM only |
| **Auto-expiration** | 30-minute inactivity timer resets on mouse/keyboard activity |
| **Log sanitization** | `sanitizeLogMessage()` replaces `password:`, `token:`, `secret:` with `[REDACTED]` |
| **No clipboard exposure** | Password field uses `type="password"` |
| **Single-session** | Credentials wiped on app close (React state destroyed) |
| **No local storage** | `session.defaultSession.clearStorageData()` on startup |

### sanitizeLogMessage Implementation

```typescript
const sanitizeLogMessage = (message: string): string => {
    return message
        .replace(/password\s*[:=]\s*\S+/gi, 'password: [REDACTED]')
        .replace(/token\s*[:=]\s*\S+/gi, 'token: [REDACTED]')
        .replace(/secret\s*[:=]\s*\S+/gi, 'secret: [REDACTED]');
};
```

This runs on every log message before it enters the `logs` state array. Even if a bug accidentally includes a password in a log message, it will be redacted before display.

---

## Network Security

### Vite Dev Server

```typescript
// vite.config.ts
server: {
    host: '127.0.0.1',  // Localhost only — NOT 0.0.0.0
    port: 3000,
}
```

**Previous state**: `host: '0.0.0.0'` — This exposed the development server to every device on the hospital network. Anyone on the LAN could access the application, including seeing deployment scripts and device lists.

**Current state**: `host: '127.0.0.1'` — Only accessible from the local machine.

### No External Connections

The application makes zero external network connections:

- No AI API calls (Gemini removed)
- No CDN stylesheets (Tailwind bundled locally)
- No telemetry or analytics
- No update checks
- No crash reporting

### Production Builds

```typescript
build: {
    sourcemap: false,  // No source maps in production
}
```

Source maps reveal the original TypeScript source code to anyone with browser DevTools. On a hospital network, this leaks application internals, security patterns, and implementation details.

---

## What Was Removed and Why

| Component | What It Did | Why It Was Removed |
|-----------|------------|-------------------|
| `@google/genai` | AI-powered script analysis via Google Gemini API | Required internet, sent hospital data to Google servers |
| `react-markdown` | Rendered AI-generated markdown responses | No longer needed after AI removal |
| CDN Tailwind (`cdn.tailwindcss.com`) | Loaded CSS framework from internet CDN | Required internet, potential for CDN compromise |
| ESM imports (`esm.sh`) | Loaded JavaScript modules from CDN | Required internet, supply chain risk |
| `GEMINI_API_KEY` in vite.config.ts | Exposed API key in build configuration | API keys must never appear in client-side code |
| `host: '0.0.0.0'` in vite.config.ts | Bound dev server to all network interfaces | Exposed application to entire hospital network |
| Source maps in production | Generated .map files in production builds | Leaked application source to anyone with DevTools |
| `DeploymentAnalytics.tsx` | Empty component (0 bytes) | Dead code — no functionality, potential confusion |

---

## Compliance Considerations

### HIPAA Alignment

While this tool does not process PHI directly, it operates on hospital networks where PHI is present:

| HIPAA Requirement | How This Tool Aligns |
|------------------|---------------------|
| Access controls | Credential-based authentication, session timeout |
| Audit controls | Log viewer with timestamps, scope guard audit trail |
| Transmission security | TLS certificate validation, localhost-only dev server |
| Integrity controls | Script safety analyzer prevents unauthorized modifications |
| Person authentication | Credentials required before any operation |

### NIST Cybersecurity Framework

| Function | This Tool's Controls |
|----------|---------------------|
| **Identify** | Device list management, form factor detection |
| **Protect** | CSP, sandbox, credential handling, scope guard |
| **Detect** | Script safety analyzer, scope violation detection |
| **Respond** | Blocked scripts, scope guard rejection, log viewer |
| **Recover** | No persistent state — clean restart resolves all issues |

---

## Security Checklist

### Before Every Deployment

- [ ] Verify the script passes the Safety Analyzer (no BLOCKED patterns)
- [ ] Review any DANGER-level findings manually
- [ ] Confirm the CSV device list is correct and current
- [ ] Verify the Device Scope Guard device count matches expectations
- [ ] Confirm all safety toggles are appropriate for this deployment

### After Every Deployment

- [ ] Review the log viewer for any WARNING or ERROR entries
- [ ] Verify all target devices reached SUCCESS status
- [ ] Investigate any FAILED or OFFLINE devices
- [ ] Close the application (credentials are wiped on close)

### Periodic Review

- [ ] Update script safety patterns for new threat patterns
- [ ] Review and update compliance target versions
- [ ] Rebuild portable executable after any code changes
- [ ] Verify USB drive integrity (no unexpected files added)
- [ ] Review device hostname patterns for new equipment models
