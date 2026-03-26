import { useEffect } from 'react';

// ---------------------------------------------------------------------------
// Path validation — mirrors the Rust validate_windows_path pattern used in
// the native backend. Kept in sync so the frontend rejects bad paths before
// they ever reach the IPC bridge.
// ---------------------------------------------------------------------------

const SHELL_METACHAR = /[&|;`$()<>!^%'"]/;

/**
 * Validate a Windows UNC network share path.
 *
 * Rules (identical to the Rust backend):
 *   1. Must not be empty or whitespace-only.
 *   2. Must not contain shell metacharacters (&  |  ;  `  $  (  )  <  >  !  ^  %  '  ").
 *   3. Must match the UNC pattern: \\server\share[\optional\subpath]
 */
export function validateWindowsPath(path: string): { valid: boolean; error?: string } {
    if (!path || path.trim() === '') {
        return { valid: false, error: 'Path cannot be empty.' };
    }

    if (SHELL_METACHAR.test(path)) {
        return { valid: false, error: 'Path contains invalid characters (&  |  ;  $  etc.).' };
    }

    // UNC: two backslashes, a server name, another backslash, then the share
    // name and optional sub-path components.
    const UNC_PATTERN = /^\\\\[a-zA-Z0-9._-]+\\[a-zA-Z0-9._\-\\ ]+$/;
    if (!UNC_PATTERN.test(path)) {
        return {
            valid: false,
            error: 'Path must be a valid UNC share (e.g. \\\\server\\share\\folder).',
        };
    }

    return { valid: true };
}

// ---------------------------------------------------------------------------
// Credential input validation
// ---------------------------------------------------------------------------

/**
 * Validate an administrative username before it is dispatched to the backend.
 * Rejects values that could inject commands if interpolated into a PowerShell
 * or WinRM call.
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
    if (!username || username.trim() === '') {
        return { valid: false, error: 'Username is required.' };
    }

    if (username !== username.trim()) {
        return { valid: false, error: 'Username must not have leading or trailing spaces.' };
    }

    if (username.length > 64) {
        return { valid: false, error: 'Username must be 64 characters or fewer.' };
    }

    if (SHELL_METACHAR.test(username)) {
        return { valid: false, error: 'Username contains invalid characters.' };
    }

    return { valid: true };
}

// ---------------------------------------------------------------------------
// PKCE utilities — fully offline, uses Web Crypto API only.
// Suitable for local OAuth-style code-exchange flows (e.g. Tauri deep-link
// redirect after an ADFS/OIDC handshake) with no external dependencies.
// ---------------------------------------------------------------------------

function base64UrlEncode(bytes: Uint8Array): string {
    // btoa expects a binary string; spread the byte array to get char codes.
    return btoa(String.fromCharCode(...Array.from(bytes)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Generate a PKCE code_verifier: 32 cryptographically random bytes,
 * base64url-encoded (RFC 7636 §4.1).
 */
export function generateCodeVerifier(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

/**
 * Derive a PKCE code_challenge from a verifier using SHA-256
 * (RFC 7636 §4.2). Returns a promise because crypto.subtle.digest is async.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoded = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return base64UrlEncode(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// Session timeout hook — fully offline, resets on user activity.
// ---------------------------------------------------------------------------

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart'] as const;

/**
 * Calls `onTimeout` after `timeoutMs` milliseconds of inactivity.
 * Resets the timer on any of: mousemove, keydown, click, touchstart.
 * Cleans up all listeners and timers when the component unmounts.
 *
 * @param timeoutMs   Idle threshold in milliseconds (e.g. 900_000 for 15 min).
 * @param onTimeout   Callback invoked when the session expires.
 */
export function useSessionTimeout(timeoutMs: number, onTimeout: () => void): void {
    useEffect(() => {
        let timerId: ReturnType<typeof setTimeout>;

        const reset = () => {
            clearTimeout(timerId);
            timerId = setTimeout(onTimeout, timeoutMs);
        };

        // Start the initial timer.
        reset();

        // Attach activity listeners.
        ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset));

        return () => {
            clearTimeout(timerId);
            ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
        };
    // onTimeout is intentionally excluded from deps to avoid restarting the
    // timer if the parent component re-renders with a new callback reference.
    // Callers should memoize the callback with useCallback if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeoutMs]);
}
