# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `main` branch | Yes |
| Tagged releases | Yes (current release only) |
| Older releases | No |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately:

1. Navigate to the repository on GitHub.
2. Click **Security** → **Report a vulnerability** (GitHub private security advisory).
3. Provide a clear description, steps to reproduce, and potential impact.
4. We will acknowledge within 72 hours and aim to resolve critical issues within 14 days.

---

## Security Architecture

### Design Principles

This application is designed for use in **offline and air-gapped environments**. All security decisions follow from this constraint:

- **No external network calls at runtime.** All dependencies are bundled at build time. No CDN scripts, no telemetry, no external API calls in the deployed application.
- **No AI/ML integrations.** No external AI API keys, no data sent to external services.
- **No persistent credential storage.** Credentials entered at scan start are held only in ephemeral React state for the duration of the scan. They are never written to localStorage, sessionStorage, cookies, or any persistent store.
- **No backend server.** The application is a static PWA. There is no server to compromise, no session tokens to steal, and no server-side attack surface.

### Current Security Controls

| Control | Implementation | Location |
|---|---|---|
| Credential isolation | Session-only dispatch; not persisted | `components/SecureCredentialModal.tsx` |
| Path injection prevention | Shell metacharacter blocklist | `utils/security.ts:validateWindowsPath` |
| PKCE support | `generatePKCEPair` utility (for future OAuth integration) | `utils/security.ts` |
| Confirmation gates | Modal confirmation required for bulk destructive actions | `components/RescanConfirmationModal.tsx` |
| Action gating | Bulk actions disabled unless valid device selection exists | `components/BulkActions.tsx` |
| MAC normalization | Strict hex + length validation on CSV import | `services/deploymentService.ts:parseDevicesFromCsv` |

### What This Application Does NOT Do

- Does not execute real PowerShell or shell commands in the browser version (simulation only)
- Does not send device data, credentials, or logs to any external service
- Does not store any sensitive information in browser storage
- Does not use cookies or tracking

---

## Production Hardening (When Integrating a Real Backend)

Before connecting this application to real infrastructure:

- [ ] Route all secrets through a vault (Azure Key Vault, HashiCorp Vault, AWS Secrets Manager) — replace interactive credential prompts with vault-issued short-lived tokens
- [ ] Implement RBAC with scoped permissions: scan-only, remediate, admin
- [ ] Require SSO/MFA for all operator access
- [ ] Enforce change ticket reference validation before scan authorization
- [ ] Require four-eyes approval for destructive bulk operations
- [ ] Write immutable, signed audit records for all credentialed actions (write-once backend store)
- [ ] Enable LAPS for per-device local admin credential rotation
- [ ] Deploy behind HTTPS with HSTS; add `Content-Security-Policy` headers
- [ ] Conduct a penetration test before production rollout

---

## Dependency Security

- Dependencies are pinned in `package-lock.json`.
- Run `npm audit` regularly to check for known vulnerabilities.
- Review Dependabot alerts on the repository (if enabled).

---

## Scope

This security policy applies to the Secure Deployment Runner codebase at `github.com/samueljackson-collab/secure-deployer`. It does not cover the underlying infrastructure (WDS/MDT servers, network shares, target devices) — those are the responsibility of the deploying organisation.
