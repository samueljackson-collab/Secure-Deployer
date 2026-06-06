# Secure Deployment Runner — Production Readiness Checklist

Use this checklist before every production release or Netlify deployment. Each section must reach
a green state. Items marked **BLOCKING** must be resolved before any production push.

---

## Section 1 — Test Coverage Gate

> **Status: BLOCKED** — vitest.config.ts is broken; no tests exist yet.

- [ ] **BLOCKING** — Install missing test dependencies:
  ```bash
  npm install --save-dev vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
  ```
- [ ] **BLOCKING** — Fix `vitest.config.ts`: add `environment: 'jsdom'`, `globals: true`, and
      `setupFiles` pointing to a test setup file. The current config is missing all three fields
      and tests cannot run without them.
- [ ] **BLOCKING** — Create `tests/setup.ts` with `@testing-library/jest-dom` import and
      `cleanup()` registered in `afterEach`.
- [ ] **BLOCKING** — Add `test`, `test:watch`, and `test:coverage` scripts to `package.json`
      (none currently exist).
- [ ] Line coverage threshold ≥ 70% (enforced by `vitest.config.ts` coverage thresholds).
- [ ] Function coverage threshold ≥ 70%.
- [ ] `npm test` exits with code 0 before any merge to `main`.
- [ ] `npm run test:coverage` report reviewed; no untested critical paths in
      `services/deploymentService.ts` or `contexts/AppContext.tsx`.

**Priority test areas (implement in this order):**
1. `parseDevicesFromCsv()` — valid rows, missing headers, malformed MACs, empty file
2. `AppContext` reducer — all action types: `START_DEPLOYMENT_CONFIRMED`, `VALIDATE_DEVICES`,
   `BULK_UPDATE`, `ARCHIVE_RUN`, `TRANSFER_IMAGING_DEVICES_TO_RUNNER`
3. `normalizeMacAddress()` and `detectDeviceType()` in `utils/helpers.ts`
4. `validateDevice()` and `updateDevice()` in `services/deploymentService.ts` (mock `sleep`)
5. Component smoke tests: `DeviceStatusTable`, `BulkActions`, `SecureCredentialModal`

---

## Section 2 — Build Verification

- [ ] `npm run lint` passes with **zero errors and zero warnings**.
      The lint command uses `--max-warnings 0`; any warning is a failure.
  ```bash
  npm run lint
  # Expected: no output after the command header; exit code 0
  ```
- [ ] `npx tsc --noEmit` passes with **zero TypeScript errors**.
  ```bash
  npx tsc --noEmit
  # Expected: no output; exit code 0
  ```
- [ ] `npm run build` completes successfully and produces `dist/` output.
  ```bash
  npm run build
  # Expected: "✓ built in X.XXs" with no errors
  ```
- [ ] `dist/sw.js` exists and is non-empty — confirms PWA service worker was generated.
- [ ] `dist/index.html` references hashed asset filenames — confirms cache-busting is active.
- [ ] PWA manifest (`dist/manifest.webmanifest` or `dist/manifest.json`) is present and valid JSON.
- [ ] `npm run preview` serves the production build at `http://localhost:4173` without errors.
- [ ] All tabs load and are interactive in the preview build.

---

## Section 3 — Environment and Secrets

- [ ] No Gemini API keys hardcoded in any source file.
  ```bash
  grep -r "AIza" src/ components/ services/ contexts/ utils/
  # Expected: no matches
  ```
- [ ] `.env` is listed in `.gitignore` and is not tracked by git.
- [ ] `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` are set as GitHub repository secrets (not
      hardcoded in `ci.yml`).
- [ ] `.env.example` contains only placeholder values — no real keys committed.
- [ ] No `console.log` statements that print credentials or sensitive runtime values exist in
      production code.
- [ ] `vite.config.ts` `define` block injects `process.env.GEMINI_API_KEY` only at build time;
      the key is not embedded in dev bundles unless explicitly set.

---

## Section 4 — Security

- [ ] App is served over **HTTPS** in all non-localhost environments. HTTPS is required for:
      PWA installation, service worker registration, and secure credential handling.
- [ ] `SecureCredentialModal` cannot be bypassed — the scan start action is blocked until
      `START_DEPLOYMENT_CONFIRMED` is dispatched with valid credentials. Verify this in the
      browser by attempting to trigger a scan without submitting the modal.
- [ ] Credential payloads are not persisted — verify no credential data appears in:
      - `localStorage` after a scan
      - React DevTools component state tree after modal close
      - Network tab (no outbound requests containing credentials)
- [ ] CSV input does not execute code — Papa Parse processes input as data only; verify no
      `<script>` tags or formula injection (`=CMD`, `+CMD`, `-CMD`, `@CMD`) survive into device
      hostnames rendered in the table.
- [ ] Bulk destructive actions (remove, delete) require explicit selection; "select all" requires
      a visible confirmation step.
- [ ] No third-party analytics, tracking pixels, or telemetry scripts are added to `index.html`
      without explicit operator consent.

---

## Section 5 — Functionality Smoke Test

Run these manually (or via Playwright/Cypress e2e when added) before every release:

- [ ] **CSV onboarding** — upload a CSV with 10 or more devices; verify all valid rows appear in
      the status table; verify malformed-MAC rows produce log entries and are skipped cleanly.
- [ ] **Deployment simulation** — start a scan; verify each device transitions through at least
      `Pending → Connecting → Checking Info → (Success | Scan Complete | Offline)`.
- [ ] **Update action** — select a `Scan Complete` device and trigger Update; verify the device
      transitions through `Updating → Update Complete (Reboot Pending)` or `Failed`.
- [ ] **Reboot action** — trigger Reboot on an `Update Complete (Reboot Pending)` device; verify
      it transitions to `Rebooting... → Success`.
- [ ] **Script execution** — attach a script file to a device and execute; verify
      `Executing Script → Execution Complete | Execution Failed`.
- [ ] **Bulk update** — select 3+ `Scan Complete` devices; trigger bulk update; verify all
      selected devices transition correctly.
- [ ] **Cancel action** — start a scan; cancel a device mid-flight; verify the device reaches
      a terminal cancelled state and the log reflects the cancellation.
- [ ] **Remove action** — remove a device from the queue; verify it no longer appears in the
      status table.
- [ ] **Image Monitor transfer** — verify the Image Monitor tab displays the rack grid and the
      Transfer button is functional; transferred devices appear in Deployment Runner.
- [ ] **Deployment history** — archive a completed run; verify it appears in the history panel
      with correct counts.
- [ ] **PWA installs in Chrome** — open the production URL in Chrome; confirm install prompt
      appears; confirm the installed app opens as a standalone window.
- [ ] **Remote Desktop** — select a device and generate an `.rdp` file; verify the file
      downloads and contains the expected hostname/IP.

---

## Section 6 — Performance

- [ ] Run Lighthouse in Chrome DevTools on the production URL (or `http://localhost:4173`
      after `npm run preview`).
- [ ] **Performance score ≥ 75** — review and address any LCP, CLS, or FID flags.
- [ ] **Accessibility score ≥ 90** — all interactive controls have accessible labels; focus
      order is logical; color contrast meets WCAG AA.
- [ ] **Best Practices score ≥ 90**.
- [ ] **PWA score ≥ 90** — manifest valid, service worker registered, HTTPS enforced.
- [ ] No blocking render resources (large undeferred scripts or synchronous stylesheets) flagged
      by Lighthouse.
- [ ] Bundle size reviewed — `dist/assets/index-[hash].js` gzip size is under 250 KB if
      possible. Use `npx vite-bundle-visualizer` or `rollup-plugin-visualizer` to inspect if
      size is unexpectedly large.

---

## Section 7 — Deployment

- [ ] `public/_redirects` (or `netlify.toml`) contains the SPA catch-all redirect rule:
      ```
      /* /index.html 200
      ```
      Without this, refreshing on any route other than `/` returns a Netlify 404.
- [ ] `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` repository secrets are set and valid.
- [ ] CI workflow (`.github/workflows/ci.yml`) passes all steps on the release branch before
      merging: lint → test → build → artifact upload → Netlify deploy.
- [ ] PWA icons are present in `public/` at all sizes declared in the manifest (at minimum
      192×192 and 512×512). Missing icons prevent PWA installation.
- [ ] PWA manifest `start_url` and `scope` match the Netlify deployment URL (not `localhost`).
- [ ] Service worker caches all required static assets — verify in Chrome DevTools
      → Application → Cache Storage after first load.
- [ ] Netlify deploy preview URL tested on mobile device for responsive layout.
- [ ] `dist/` directory is not committed to the repository — it is generated by CI only.

---

## Section 8 — Documentation

- [ ] `README.md` Scope & Status table reflects the current implementation state.
- [ ] `docs/GUIDE.md` installation and usage steps tested on a clean machine.
- [ ] `docs/PRODUCTION_CHECKLIST.md` (this file) reviewed and items updated to match any recent
      changes.
- [ ] `docs/PROCESS.md` start-to-finish SOP is current with current service behavior.
- [ ] `docs/CAPACITY.md` wave-sizing guidance is current.
- [ ] `docs/AUTOMATION.md` automation tier descriptions are accurate.
- [ ] `docs/ARCHITECTURE.md` component responsibility map matches current component tree.
- [ ] All evidence links in `README.md` resolve to existing files in the repository.
- [ ] Changelog or release notes updated for the version being shipped.

---

## Section 9 — Monitoring

- [ ] Plan in place to capture client-side errors in production. Options:
      - Sentry (free tier available) — add `@sentry/react` and initialize in `src/index.tsx`
      - Netlify Analytics (basic page view data, no JS errors)
      - Custom error boundary logging to a serverless endpoint
- [ ] Error boundary (`ErrorBoundary.tsx` or equivalent) is mounted at the app root so unhandled
      render errors show a graceful fallback rather than a blank page.
- [ ] At least one observability signal is defined and monitored post-launch:
      - Script execution failure rate (target: < 15%)
      - Offline device rate per run (investigate spikes > 10%)
      - Mean Time to Compliance (MTTC) trend
- [ ] Rollback procedure documented: revert to previous Netlify deploy via Netlify dashboard
      → Deploys → select prior deploy → Publish Deploy.
- [ ] On-call or response owner identified for production issues.

---

## Section 10 — App-Specific Checks

These checks are unique to Secure Deployment Runner's domain and must be verified on every release.

- [ ] **CSV large-file performance** — upload a CSV with 100 devices; verify parsing completes
      in under 3 seconds and all valid rows appear in the status table without browser freeze.
- [ ] **All deployment action buttons functional** — in the Device Status Table, verify that
      Validate, Update, Script Execute, Reboot, Cancel, and Remove are each reachable and
      trigger the correct state transition for a device in the appropriate pre-condition state.
- [ ] **Bulk execution with credential gate** — trigger a bulk scan start; verify the
      `SecureCredentialModal` appears, blocks execution until credentials are submitted, and that
      the scan proceeds after confirmation. Verify dismissing the modal without submitting leaves
      all devices in `Pending` state.
- [ ] **Imaging transfer completes** — verify that clicking Transfer Selected in the Image Monitor
      tab moves all selected devices to the Deployment Runner queue within 1 second; no duplicate
      devices should appear.
- [ ] **Run archive integrity** — after a completed scan, verify `generateRunArchive()` produces
      a run record with correct `total`, `success`, `failed`, and `offline` counts that match the
      visible status table.
- [ ] **MAC normalization edge cases** — verify that devices with colon-separated, hyphen-separated,
      and dot-separated MAC addresses all import correctly and appear with a normalized uppercase
      MAC in the status table.
- [ ] **Offline fallback rendering** — disconnect network; verify the PWA loads from service worker
      cache; verify the status table renders and CSV upload UI is accessible.
- [ ] **Compliance target version constants** — verify `TARGET_BIOS_VERSION = 'A24'`,
      `TARGET_DCU_VERSION = '5.1.0'`, and `TARGET_WIN_VERSION = '23H2'` in `App.tsx` match the
      current target versions for the deployment environment. Update if targets have changed.
- [ ] **Log viewer** — verify the log panel streams entries in real time during a scan and does
      not freeze or overflow with 100+ log lines.
- [ ] **Deployment history limit** — verify history retains last 10 runs; runs beyond 10 are
      pruned without errors.

---

## Release Gate Summary

| Section | Gate | Status |
|---|---|---|
| 1. Test Coverage | `npm test` passes; coverage ≥ 70% | BLOCKED (vitest config broken) |
| 2. Build Verification | lint 0 warnings, tsc 0 errors, build succeeds | — |
| 3. Environment & Secrets | No hardcoded keys; secrets in GitHub | — |
| 4. Security | HTTPS, no credential bypass, CSV sanitized | — |
| 5. Functionality Smoke Test | All core workflows exercised | — |
| 6. Performance | Lighthouse ≥ 75 perf, ≥ 90 a11y | — |
| 7. Deployment | Redirect rules, PWA icons, CI green | — |
| 8. Documentation | Docs current and links resolve | — |
| 9. Monitoring | Error capture plan active | — |
| 10. App-Specific | CSV 100-device test, all actions verified | — |

**All sections must be green before production release.**
