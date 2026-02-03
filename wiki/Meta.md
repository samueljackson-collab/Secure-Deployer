# Meta

> Changelog, architecture decision records, contributing guide, interview talking points, and project metrics.

---

## Table of Contents

- [Changelog](#changelog)
- [Architecture Decision Records](#architecture-decision-records)
- [Contributing Guide](#contributing-guide)
- [Interview Talking Points](#interview-talking-points)
- [Project Metrics](#project-metrics)

---

## Changelog

### v1.0.0 — Production Security Overhaul (Current)

**Security Hardening**
- Hardened Electron main process: sandbox, context isolation, CSP, certificate validation, single-instance lock, storage clearing, navigation blocking, permission blocking
- Bound Vite dev server to `127.0.0.1` (was `0.0.0.0` — exposed to entire network)
- Removed source maps from production builds
- Added 30-minute credential auto-wipe on inactivity
- Added credential sanitization in all log messages (password/token/secret → `[REDACTED]`)

**AI Removal**
- Removed `@google/genai` dependency (Gemini AI)
- Removed `react-markdown` dependency
- Removed `GEMINI_API_KEY` from Vite build config
- Gutted `geminiService.ts` — replaced with deprecation notice

**New Features**
- **Script Safety Analyzer** — Deterministic regex-based analyzer with 60+ rules across BLOCKED/DANGER/WARNING tiers
- **Device Scope Guard** — Per-device verification modal with checklist, count confirmation, and safety policy toggles
- **Image Monitor** — Live SCCM/MDT imaging monitor with metadata ingestion and device promotion
- **10 Device Form Factors** — SVG icons for laptop-14, laptop-16, detachable, laptop, sff, micro, tower, wyse, vdi, desktop
- **Task Sequence Scripts** — `Gather-DeviceMetadata.bat` + `.ps1` for metadata collection during imaging
- **USB Portable Build** — `npm run build:portable` with `LaunchFromUSB.bat` launcher
- **Comprehensive Wiki** — 10-section documentation in wiki/ directory

**Bug Fixes**
- Fixed broken JSX in App.tsx (extra closing tags, `)}` instead of `);`)
- Removed 267 lines of merged portfolio project code from App.tsx
- Added missing `isValidMacAddress()` function (was called but never defined)
- Deleted empty `DeploymentAnalytics.tsx` (0 bytes)

**Infrastructure**
- Removed CDN dependencies (Tailwind, esm.sh) — all assets bundled locally
- Added Tailwind CSS via PostCSS (tailwind.config.js, postcss.config.js, styles.css)
- Version bumped from `0.0.0` to `1.0.0`
- Added `extraResources` for scripts directory in electron-builder config

### v0.0.0 — Initial Scaffold

- React 19 + TypeScript project scaffold
- AI-powered script analysis via Google Gemini API
- CDN-dependent Tailwind CSS styling
- Vite dev server bound to `0.0.0.0:3000`
- Basic device list and deployment status tracking
- CSV upload with PapaParse
- Wake-on-LAN and remote connectivity (simulated)
- DeploymentAnalytics component (empty, 0 bytes)

---

## Architecture Decision Records

### ADR-001: Remove All AI Dependencies

**Status**: Accepted

**Context**: The original application used Google's Gemini AI (`@google/genai`) for script analysis. This required an API key, internet connectivity, and sent deployment script content to Google's servers. On a hospital network, this means potentially sending operational data (hostnames, IP addresses, script content) to an external third party.

**Decision**: Remove all AI dependencies. Replace AI script analysis with deterministic regex-based pattern matching.

**Consequences**:
- (+) Zero external API calls — no data leaves the hospital network
- (+) Works completely offline from USB
- (+) Deterministic — same script always produces same result
- (+) Auditable — every rule is visible and reviewable
- (+) No API key management or rotation
- (-) Regex patterns may miss novel attack vectors that AI could catch
- (-) Patterns must be manually maintained as new threats emerge
- Mitigation: Broad patterns are intentionally used. False positives are preferred over false negatives on a hospital network.

---

### ADR-002: Deterministic Script Analysis Over Machine Learning

**Status**: Accepted

**Context**: Script safety analysis could be implemented via AI/ML (pattern learning), static analysis (regex/AST), or a combination. Hospital compliance teams need to understand and audit every safety rule.

**Decision**: Use pure regex pattern matching with three severity tiers (BLOCKED/DANGER/WARNING).

**Consequences**:
- (+) Every rule is a readable regex with a description and recommendation
- (+) Compliance teams can review rule-by-rule: "Show me what stops a format command"
- (+) No model training data, no model drift, no hallucination risk
- (+) Millisecond analysis (vs. seconds for API calls)
- (-) Manual pattern authoring required for new threats
- (-) Cannot detect semantically dangerous scripts that don't match syntactic patterns
- Mitigation: 60+ patterns covering 3 tiers, plus scope violation detection for hostnames and subnets.

---

### ADR-003: Device Scope Guard as Mandatory Gate

**Status**: Accepted

**Context**: Bulk operations on hospital networks risk affecting non-target devices. A single accidental `\\*` in a script or an operator selecting too many devices could disrupt clinical systems.

**Decision**: Require per-device verification through a modal gate (Device Scope Guard) before any bulk operation proceeds.

**Consequences**:
- (+) Every device is consciously reviewed before operations execute
- (+) Count confirmation prevents "I didn't realize I had 200 devices selected"
- (+) Safety toggles give operators control over what commands are allowed
- (+) Hostname whitelist enforcement during execution prevents scope creep
- (-) Adds friction to the deployment workflow (intentional)
- (-) Operators deploying to 50+ devices must check each one individually
- Mitigation: The friction is the feature. On hospital networks, speed should never be prioritized over safety.

---

### ADR-004: USB-First Portable Architecture

**Status**: Accepted

**Context**: Hospital IT teams often need to deploy from machines that don't have development tools, internet access, or admin rights to install software. A client-server architecture would require server installation, database setup, and open network ports.

**Decision**: Build as a single portable Electron executable that runs from USB with no installation.

**Consequences**:
- (+) Zero installation required — double-click and run
- (+) No server to configure, no database to maintain
- (+) Works on any Windows 10+ machine without admin rights
- (+) No internet required at any point
- (-) Electron bundles Chromium (~150MB executable)
- (-) No centralized state — each USB session is independent
- (-) Cannot centrally manage multiple operators' sessions
- Mitigation: The 150MB size is acceptable for USB drives (16GB+ standard). Independent sessions are a feature — no shared state means no shared risk.

---

### ADR-005: In-Memory-Only Credential Storage

**Status**: Accepted

**Context**: Deployment operations require domain credentials to connect to target devices. Credentials could be stored in environment variables, config files, encrypted local storage, or in-memory.

**Decision**: Store credentials only in React component state (RAM). Never write to disk in any form.

**Consequences**:
- (+) Credentials cannot be recovered from disk, USB, or registry after session ends
- (+) If the USB drive is stolen, no credentials are stored on it
- (+) 30-minute auto-wipe protects against unattended terminals
- (+) Log sanitization prevents accidental credential exposure
- (-) Credentials must be re-entered every session
- (-) 30-minute timeout may interrupt long deployment windows
- Mitigation: Re-entering credentials is a small cost for strong credential security. For long sessions, any mouse/keyboard activity resets the timer.

---

### ADR-006: Ten-Category Device Form Factor System

**Status**: Accepted

**Context**: Hospital fleets contain diverse device types — from 14" laptops on nursing carts to Wyse thin clients at registration desks to tower workstations in radiology. A deployment tool should help operators visually distinguish device categories at a glance.

**Decision**: Implement hostname-based detection for 10 Dell business device form factors, each with a unique SVG icon and color.

**Consequences**:
- (+) Operators immediately see what type of device they're deploying to
- (+) Prevents confusion between, e.g., a thin client and a tower
- (+) Color-coded icons make large device lists scannable
- (+) Detection is extensible — add new patterns with 3 code changes
- (-) Hostname pattern detection is organization-specific
- (-) Non-Dell devices fall to generic fallback icons
- Mitigation: Detection patterns are documented and easily customizable. Generic fallback icons ensure non-matching devices still display properly.

---

## Contributing Guide

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd Secure-Deployer

# Install dependencies
npm install

# Start development server (localhost:3000)
npm run dev

# Type check without building
npx tsc --noEmit

# Build for production
npm run build

# Build portable executable
npm run build:portable
```

### Code Style Conventions

| Convention | Requirement |
|-----------|-------------|
| **TypeScript** | Strict mode, no `any` types |
| **Components** | Functional components with React.FC typing |
| **State** | React useState/useCallback hooks only (no external state libraries) |
| **Styling** | Tailwind CSS utility classes (no custom CSS beyond styles.css) |
| **Imports** | Named imports, `type` prefix for type-only imports |
| **Files** | PascalCase for components, camelCase for services/utilities |
| **Comments** | JSDoc for public interfaces, inline for non-obvious logic |

### Security Review Requirements

Any change to these files requires security review:

| File | Why |
|------|-----|
| `electron/main.cjs` | Controls Electron security sandbox |
| `scriptSafetyAnalyzer.ts` | Safety patterns protecting hospital systems |
| `DeviceScopeGuard.tsx` | Device verification gate |
| `vite.config.ts` | Network binding and build settings |
| `index.html` | Security meta tags |

### Submitting Changes

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Run `npx tsc --noEmit` to verify type safety
4. Run `npm run build` to verify the build succeeds
5. Test the portable build: `npm run build:portable`
6. Manually verify the feature works end-to-end
7. Update documentation in `wiki/` if applicable
8. Submit a pull request with:
   - Summary of changes
   - Security impact assessment
   - Test results

---

## Interview Talking Points

### "Tell me about a project where you had to prioritize security"

**Situation**: I inherited a hospital network deployment tool that had external AI API calls (Google Gemini), a development server exposed to the entire network (bound to 0.0.0.0), API keys in the build config, CDN dependencies requiring internet, and no credential protection — all running on a network where system failures can affect patient care.

**Task**: Make it production-safe for clinical environments. Zero tolerance for network exposure, credential leaks, or unintended system effects.

**Action**: I implemented defense-in-depth security across 8 layers:
- Removed all AI dependencies and replaced with a deterministic 60+ rule regex analyzer
- Hardened Electron with sandbox, context isolation, CSP, certificate validation
- Bound the dev server to localhost only
- Built a Device Scope Guard requiring per-device verification before bulk operations
- Implemented in-memory-only credentials with 30-minute auto-wipe
- Added log sanitization that redacts passwords/tokens/secrets
- Removed all CDN dependencies and bundled everything locally
- Made the entire application USB-portable with zero internet requirements

**Result**: A deployment tool with zero external dependencies, 8 layers of security, and a Script Safety Analyzer that catches format commands, subnet sweeps, wildcard targeting, firewall disabling, and 50+ other dangerous patterns before any script executes. The tool runs entirely from a USB drive with no installation, no internet, and no risk to hospital systems.

---

### "Tell me about a complex technical decision you made"

**Situation**: The deployment tool needed script analysis to catch dangerous commands, but the existing AI-based approach (Google Gemini) was fundamentally incompatible with hospital network requirements — it required internet, sent data externally, and produced non-deterministic results.

**Task**: Build a reliable safety analyzer that catches destructive commands without AI, without network access, and with deterministic, auditable results that compliance teams can review.

**Action**: I designed a three-tier pattern system:
- **BLOCKED** (28 rules): Script cannot execute — format, diskpart, recursive deletes, firewall disable, subnet broadcasts, wildcard targeting
- **DANGER** (26 rules): Manual override required — registry writes, service stops, remote execution, scheduled tasks
- **WARNING** (18 rules): Informational — file copies to system dirs, silent installers, network commands
- Plus scope violation detection that extracts hostnames from UNC paths, `-ComputerName` parameters, and PsExec targets, then flags any hostname not in the approved device list
- Comment-aware parsing that skips REM, ::, #, and `<# ... #>` blocks to avoid false positives

**Result**: A deterministic analyzer that runs in milliseconds, produces identical results every time, requires zero network access, and catches the patterns that matter most on hospital networks. Every rule is a readable regex with a description and recommendation — compliance teams can audit rule-by-rule.

---

### "Tell me about a time you designed for usability"

**Situation**: Hospital IT staff of varying skill levels needed to safely deploy software across diverse device fleets — from 14" Latitude laptops to Wyse thin clients to Precision towers. The existing tool had no visual device differentiation, no safety guards, and no imaging integration.

**Task**: Build a tool that prevents mistakes for beginners while remaining efficient for experienced operators. The tool must handle the full lifecycle: imaging → monitoring → deployment.

**Action**:
- Designed a two-view architecture: Image Monitor for imaging and Deployment Runner for post-imaging
- Created 10 device form factor categories with unique SVG icons and colors so operators can instantly identify device types at a glance
- Built the Device Scope Guard with progressive verification: check each device → confirm count → set safety policies
- Made the Script Safety Analyzer automatic — it runs on upload, not when operators remember to check
- Added status badges with 19 distinct states and color-coded animations so deployment progress is visible at a glance
- Used Tailwind CSS for consistent visual design across all components

**Result**: A tool that guides beginners through a safe workflow (CSV → script check → credentials → scope verify → deploy) while letting experts move quickly through familiar steps. The form factor icons and status badges provide instant visual feedback across large device lists.

---

### "Tell me about when you improved an existing system"

**Situation**: The existing deployment runner had significant issues: App.tsx contained 267 lines of unrelated portfolio project code that had been accidentally merged in, JSX had broken closing tags causing render failures, the `isValidMacAddress()` function was called but never defined (causing runtime crashes), `DeploymentAnalytics.tsx` was an empty 0-byte file, and there were no safety features of any kind.

**Task**: Take a broken prototype and make it a production-grade hospital deployment tool.

**Action**: I performed a systematic overhaul:
- Complete App.tsx rewrite — removed portfolio code, fixed JSX, added missing functions
- Added Image Monitor for SCCM/MDT imaging integration (new component, ~720 lines)
- Added Script Safety Analyzer (new service, ~1000 lines, 60+ rules)
- Added Device Scope Guard (new component, ~500 lines)
- Expanded device detection from 2 types to 10 form factors with custom SVG icons
- Added task sequence metadata scripts (.bat + .ps1, ~1000 combined lines)
- Hardened Electron security with 8 defense layers
- Created USB portable build pipeline
- Deleted dead code and empty components
- Wrote comprehensive 10-section Wiki.js documentation

**Result**: From a broken prototype that crashed on load to a production-ready hospital deployment platform with comprehensive security, live imaging monitoring, deterministic script analysis, per-device scope verification, and 10 device form factor categories — all running offline from a USB drive.

---

## Project Metrics

### Code Size

| File | Lines (approx.) | Purpose |
|------|-----------------|---------|
| `App.tsx` | ~600 | Main application orchestrator |
| `scriptSafetyAnalyzer.ts` | ~1000 | Script analysis engine |
| `ImageMonitor.tsx` | ~720 | SCCM/MDT imaging monitor |
| `DeviceScopeGuard.tsx` | ~500 | Device verification gate |
| `DeviceIcon.tsx` | ~215 | 10 form factor SVG icons |
| `DeviceStatusTable.tsx` | ~200 | Device list display |
| `ScriptAnalysisModal.tsx` | ~150 | Safety results display |
| `Gather-DeviceMetadata.ps1` | ~770 | PowerShell metadata collector |
| `Gather-DeviceMetadata.bat` | ~250 | Task sequence orchestrator |
| `electron/main.cjs` | ~100 | Electron security config |
| `types.ts` | ~145 | TypeScript interfaces |

### Feature Counts

| Metric | Count |
|--------|-------|
| React components | 13 |
| TypeScript interfaces/types | 15+ |
| Script safety rules | 72 (28 BLOCKED + 26 DANGER + 18 WARNING) |
| Device form factors | 10 |
| Deployment statuses | 19 |
| Imaging statuses | 6 |
| Security defense layers | 8 |
| Runtime dependencies | 3 (react, react-dom, papaparse) |
| Dev dependencies | 8 |
| External network calls | 0 |
| AI dependencies | 0 |
| Wiki documentation pages | 10 |

### Dependency Analysis

**Runtime (3 packages)**:
- `react` — UI framework
- `react-dom` — React DOM renderer
- `papaparse` — CSV parsing

**Development (8 packages)**:
- `@types/node` — Node.js type definitions
- `@vitejs/plugin-react` — Vite React plugin
- `autoprefixer` — CSS vendor prefixing
- `electron` — Desktop app framework
- `electron-builder` — App packaging
- `postcss` — CSS processing
- `tailwindcss` — Utility-first CSS
- `typescript` — Type checker

**Removed (2 packages)**:
- `@google/genai` — Google Gemini AI (external API calls)
- `react-markdown` — Markdown renderer (for AI output)
