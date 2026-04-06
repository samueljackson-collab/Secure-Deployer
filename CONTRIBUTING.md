# Contributing to Secure Deployment Runner

Thank you for contributing. This guide covers the development workflow, code standards, and PR requirements.

---

## Getting Started

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/samueljackson-collab/secure-deployer.git
   cd secure-deployer
   npm install
   ```

2. Start the dev server:
   ```bash
   npm run dev   # → http://localhost:3000
   ```

3. Run quality checks before committing:
   ```bash
   npm run typecheck   # TypeScript type check
   npm run lint        # ESLint (target: 0 errors, 0 warnings)
   npm run test        # Vitest unit tests
   npm run build       # Production build
   ```

---

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes. Keep commits focused and atomic.

3. Ensure all checks pass (see above) before opening a PR.

4. Open a pull request against `main` using the PR template.

---

## Code Standards

### TypeScript
- All new code must be typed. Avoid `any`.
- Add types to `src/types.ts` for new domain interfaces.
- Do not use `// @ts-ignore` or `// @ts-expect-error` without an explanation comment.

### React
- Functional components only (no class components).
- Use `useCallback` / `useMemo` only where profiling shows a measurable benefit.
- All state mutations go through `AppContext` dispatch — never mutate state directly.

### Service Layer
- Keep `services/deploymentService.ts` function signatures production-shaped.
- Any new service function must have the same signature a real API endpoint would return.
- Do not add browser-only APIs (DOM, localStorage) to service files.

### Styling
- Use Tailwind CSS utility classes. Bundled at build time — no CDN calls.
- Do not add `<style>` tags or inline `style` attributes except for dynamic values.
- Dark theme is the default; all new components must be readable on a black background.

### Security
- **Never persist credentials** to localStorage, sessionStorage, or component state beyond the current session.
- **Never make external network calls** outside the mock service layer. This app is designed for offline/air-gapped environments.
- Run `utils/security.ts:validateWindowsPath` on any user-supplied file paths before use.

---

## PR Guidelines

- Use the PR template (auto-populated when you open a PR).
- **Every behavior change** requires an update to the Scope & Status table in `README.md`.
- **Every new service function** requires a row in the Data Flow table in `README.md` and `docs/ARCHITECTURE.md`.
- **Evidence links** in the Evidence Index must resolve after your change.
- Include test evidence for any reducer or service changes (even if just a manual walkthrough description).

---

## Commit Message Format

```
<type>: <short summary>

<optional body — explain why, not what>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`

Examples:
```
feat: add batch size control to scan settings
fix: resolve type error in deploymentService updateDevice
docs: update CAPACITY.md with parallelisation guidance
test: add reducer tests for ARCHIVE_RUN action
```

---

## Review Process

- All PRs require at least one approval from a repository maintainer.
- CI must pass (lint + typecheck + build) before merge.
- Squash merges are preferred for feature branches; merge commits for releases.
- Documentation PRs (README, docs/) are additive only — do not remove existing guidance.

---

## Reporting Issues

Use the GitHub issue templates:
- **Bug report** — for defects, broken behavior, or incorrect output
- **Feature request** — for enhancements or new capabilities

For security vulnerabilities, see [SECURITY.md](./SECURITY.md).
