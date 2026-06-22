import { describe, it, expect } from 'vitest';
import { validateWindowsPath, generatePKCEPair, generateState } from '../../utils/security';

describe('validateWindowsPath', () => {
  it('accepts a valid absolute Windows path', () => {
    const result = validateWindowsPath('C:\\Users\\Test');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts a valid path with spaces and nested directories', () => {
    const result = validateWindowsPath('C:\\Program Files\\My App\\bin');
    expect(result.valid).toBe(true);
  });

  it('accepts a relative path containing no shell metacharacters', () => {
    // The implementation only checks for shell metacharacters, not path shape,
    // so a relative path with no special characters is considered valid.
    const result = validateWindowsPath('relative\\path\\file.txt');
    expect(result.valid).toBe(true);
  });

  it('accepts a path containing ".." since it has no shell metacharacters', () => {
    // The implementation does not perform traversal detection - it only
    // rejects strings containing shell metacharacters.
    const result = validateWindowsPath('C:\\Users\\Test\\..\\Other');
    expect(result.valid).toBe(true);
  });

  it.each([
    [';', 'C:\\Users\\Test;rm -rf /'],
    ['&', 'C:\\Users\\Test & calc.exe'],
    ['|', 'C:\\Users\\Test | more'],
    ['`', 'C:\\Users\\`whoami`'],
    ['$', 'C:\\Users\\$HOME'],
    ['(', 'C:\\Users\\(Test'],
    [')', 'C:\\Users\\Test)'],
    ['{', 'C:\\Users\\{Test'],
    ['}', 'C:\\Users\\Test}'],
    ['<', 'C:\\Users\\Test<file'],
    ['>', 'C:\\Users\\Test>file'],
    ["'", "C:\\Users\\Test'quote"],
    ['"', 'C:\\Users\\Test"quote'],
    ['\n', 'C:\\Users\\Test\nC:\\Other'],
    ['\r', 'C:\\Users\\Test\rC:\\Other'],
  ])('rejects a path containing the shell metacharacter %s', (char, path) => {
    const result = validateWindowsPath(path);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(char);
  });

  it('returns an error message identifying the offending character', () => {
    const result = validateWindowsPath('C:\\Users\\Test;evil');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid character in path: ;');
  });

  it('accepts an empty string', () => {
    const result = validateWindowsPath('');
    expect(result.valid).toBe(true);
  });
});

describe('generatePKCEPair', () => {
  it('returns a verifier and challenge', async () => {
    const { verifier, challenge } = await generatePKCEPair();
    expect(typeof verifier).toBe('string');
    expect(typeof challenge).toBe('string');
    expect(verifier.length).toBeGreaterThan(0);
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('produces a verifier within the PKCE spec length range (43-128 chars)', async () => {
    const { verifier } = await generatePKCEPair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('produces a verifier and challenge using only base64url characters', async () => {
    const { verifier, challenge } = await generatePKCEPair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces a challenge that is the base64url SHA-256 digest of the verifier', async () => {
    const { verifier, challenge } = await generatePKCEPair();

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const expectedChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(challenge).toBe(expectedChallenge);
  });

  it('generates different verifiers on subsequent calls', async () => {
    const first = await generatePKCEPair();
    const second = await generatePKCEPair();
    expect(first.verifier).not.toBe(second.verifier);
    expect(first.challenge).not.toBe(second.challenge);
  });
});

describe('generateState', () => {
  it('returns a non-empty string', () => {
    const state = generateState();
    expect(typeof state).toBe('string');
    expect(state.length).toBeGreaterThan(0);
  });

  it('returns a base64url-encoded string with no padding', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(state).not.toContain('=');
    expect(state).not.toContain('+');
    expect(state).not.toContain('/');
  });

  it('produces a value derived from 16 random bytes (expected length around 22 chars)', () => {
    const state = generateState();
    // base64 of 16 bytes is 24 chars with padding, 22 without padding ('=')
    expect(state.length).toBeLessThanOrEqual(24);
    expect(state.length).toBeGreaterThanOrEqual(20);
  });

  it('generates different values on subsequent calls', () => {
    const first = generateState();
    const second = generateState();
    expect(first).not.toBe(second);
  });
});
