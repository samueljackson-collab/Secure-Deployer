export function validateWindowsPath(path: string): { valid: boolean; error?: string } {
    const shellMetacharacters = [';', '&', '|', '`', '$', '(', ')', '{', '}', '<', '>', "'", '"', '\n', '\r'];
    for (const char of shellMetacharacters) {
        if (path.includes(char)) {
            return { valid: false, error: `Invalid character in path: ${char}` };
        }
    }
    return { valid: true };
}

export async function generatePKCEPair(): Promise<{ verifier: string; challenge: string }> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);

    const verifier = btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(verifier)
    );

    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return { verifier, challenge };
}

export function generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
