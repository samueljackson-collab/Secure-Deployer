/**
 * security.ts — Client-side security utilities
 *
 * validateWindowsPath  : Rejects shell metacharacters before paths reach PowerShell.
 *                        Mirrors the Rust validate_windows_path() in src-tauri/src/lib.rs.
 * generatePKCEPair     : RFC 7636 PKCE verifier + challenge using Web Crypto (no deps).
 * generateState        : Random OAuth2 state parameter using Web Crypto (no deps).
 */

// Characters that have special meaning in cmd.exe / PowerShell and must never
// appear in user-supplied paths that are forwarded to a shell.
const SHELL_METACHARACTERS = [
  ';', '&', '|', '`', '$', '(', ')', '{', '}', '<', '>', "'", '"', '\n', '\r',
];

/**
 * Validate a Windows file-system path for safe use as a PowerShell argument.
 * Returns { valid: true } if the path is clean, or { valid: false, error } if
 * it contains characters that could be used for shell injection.
 */
export function validateWindowsPath(path: string): { valid: boolean; error?: string } {
  if (!path) {
    return { valid: false, error: 'Path must not be empty.' };
  }
  const found = SHELL_METACHARACTERS.find((ch) => path.includes(ch));
  if (found !== undefined) {
    const display = found === '\n' ? '\\n' : found === '\r' ? '\\r' : found;
    return {
      valid: false,
      error: `Path contains a disallowed character: "${display}". Shell metacharacters are not permitted.`,
    };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// PKCE — RFC 7636 (Proof Key for Code Exchange)
// Uses the browser's built-in Web Crypto API. No npm packages required.
// ---------------------------------------------------------------------------

/** Convert a Uint8Array to a base64url string (no padding). */
function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a PKCE verifier/challenge pair.
 * - verifier  : 32 random bytes encoded as base64url (43 chars, 256 bits of entropy)
 * - challenge : SHA-256(verifier) encoded as base64url
 */
export async function generatePKCEPair(): Promise<{ verifier: string; challenge: string }> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const verifier = toBase64Url(randomBytes);

  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  const challenge = toBase64Url(new Uint8Array(hashBuffer));

  return { verifier, challenge };
}

/**
 * Generate a random OAuth2 state parameter (16 bytes → 22 base64url chars).
 * Used to prevent CSRF in the authorization redirect.
 */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}
