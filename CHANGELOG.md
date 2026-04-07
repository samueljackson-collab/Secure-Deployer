# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Unit and integration test suite (Vitest + Testing Library)
- Backend API adapter to replace mock service layer
- Parallelised scan loop for large device cohorts
- RBAC + SSO hardening
- Zero-touch PXE imaging (Tier 4+)

---

## [0.1.0] - 2026-04-06

### Added
- **Core deployment workflow:** validate, update (BIOS/DCU/Windows), execute script, reboot, cancel, remove — all driven by a simulated service layer matching real-backend contracts
- **Image Monitor tab:** rack grid view of devices being imaged via PXE; 30-second polling; compliance checks (BitLocker, LAPS, Citrix, SCCM); device card with hostname editing and revalidation
- **Transfer flow:** `TRANSFER_IMAGING_DEVICES_TO_RUNNER` converts `ImagingDevice[]` → `Device[]` for the runner queue
- **CSV onboarding:** hostname/MAC normalization with row-level error reporting via PapaParse
- **Deployment Runner tab:** full scan lifecycle, per-device compliance checklist, update/reboot/script actions, bulk operations
- **Bulk actions:** update, validate, execute, cancel, remove, run/install/delete file operations with selection gating
- **Deployment History tab:** archived run list with CSV export and Recharts analytics
- **Analytics tab:** bar and trend charts for run history
- **Imaging Script tab:** read-only viewer of the WinPE AutoTag PowerShell intake script
- **PXE Task Sequence tab:** 4-step wizard for network share config, SCCM boot image selection, integration method, and remote AutoTag execution
- **Remote Desktop tab:** `.rdp` file generation for operator session access
- **Templates tab:** saved deployment configuration templates
- **Build Output tab:** simulated build log stream for UI demonstration
- **SecureCredentialModal:** session-only credential capture, never persisted
- **PWA support:** offline-capable via Vite PWA plugin with service worker; installable from browser
- **Type-safe architecture:** full TypeScript coverage, strict import paths, barrel re-exports
- **CI/CD:** GitHub Actions workflow for lint + typecheck + build on every push and PR
- **Documentation:** `docs/PROCESS.md`, `docs/CAPACITY.md`, `docs/AUTOMATION.md`, `docs/ARCHITECTURE.md`
- **GitHub enterprise files:** `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE`, PR/issue templates, `CODEOWNERS`
- **Test infrastructure:** Vitest + Testing Library setup with `src/tests/` directory

### Security
- Removed all AI/external-service integrations (`@google/genai`, VideoExtractor, Gemini API key)
- Removed all CDN runtime dependencies (Tailwind CDN, esm.sh import maps)
- All dependencies bundled at build time — application runs fully offline
- No external network calls at runtime

### Fixed
- Resolved missing root-level `types.ts` barrel (all components and `App.tsx` import from `./types`)
- Removed stale `// FIX:` comments from `App.tsx` and `services/deploymentService.ts`
- Corrected placeholder version strings in `src/constants.ts` (`1.2.3` → `A24`, `4.5.6` → `5.1.0`, `10.0.19042` → `23H2`)
- Implemented `services/powershellScript.ts` (was empty); updated `ImagingScriptViewer` to import from it

---

[Unreleased]: https://github.com/samueljackson-collab/secure-deployer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/samueljackson-collab/secure-deployer/releases/tag/v0.1.0
