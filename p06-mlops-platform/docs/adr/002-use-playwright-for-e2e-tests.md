# ADR 002: Use Playwright for End-to-End Tests

## Status

Accepted

## Date

2025-01-12

## Context

Our MLOps platform includes a FastAPI serving layer and will eventually incorporate a web-based UI for experiment visualization and model management. We need an end-to-end testing framework that:

- Can test both API endpoints and browser-based UI interactions
- Runs reliably in CI environments (headless mode, Docker-friendly)
- Supports automatic retries and detailed failure diagnostics
- Generates human-readable test reports for artifact archival
- Has strong TypeScript support for test authoring

### Options Considered

1. **Playwright** -- Microsoft-backed E2E testing framework with multi-browser support, API testing capabilities, auto-wait mechanisms, and built-in HTML reporter.
2. **Cypress** -- Popular E2E framework with a rich interactive runner. Limited to Chromium-family browsers (Electron/Chrome) in the open-source version. No native API testing without plugins.
3. **Selenium + pytest** -- Mature browser automation. Requires significant boilerplate, no built-in retry logic or HTML reporting, slower execution.
4. **pytest + httpx (API-only)** -- Lightweight Python-based API testing. Does not cover browser interactions or UI workflows.

## Decision

We will use **Playwright** for end-to-end testing of both API endpoints and browser-based UI flows.

## Rationale

- **API and browser testing in one framework**: Playwright's `request` API context allows testing FastAPI endpoints (health checks, predictions) alongside browser-based UI tests, all within the same test suite and reporting pipeline.
- **Reliability in CI**: Playwright's auto-wait mechanism eliminates flaky selectors, and built-in retry configuration (`retries: 2` in config) handles transient failures gracefully.
- **HTML reporter**: The built-in HTML reporter generates self-contained reports that can be uploaded as CI artifacts, providing detailed failure traces with screenshots and execution timelines.
- **Multi-browser support**: Projects can target Chromium, Firefox, and WebKit, ensuring cross-browser coverage as the UI matures.
- **TypeScript-first**: Strong typing improves test maintainability and IDE support.

## Consequences

### Positive

- Single test framework covers API validation and future UI testing needs
- HTML reports provide actionable failure diagnostics for developers reviewing CI runs
- Auto-wait and retry mechanisms reduce flaky test maintenance burden
- Playwright's trace viewer enables step-by-step debugging of failures

### Negative

- Adds a Node.js dependency to a primarily Python project
- Team members need familiarity with TypeScript for test authoring
- Browser binary downloads increase CI cache size (~200MB per browser)

### Risks

- Browser version updates may occasionally break tests (mitigated by pinning Playwright versions)
- API-only tests could be faster with pytest + httpx, but the unified reporting and future UI coverage justify the trade-off
