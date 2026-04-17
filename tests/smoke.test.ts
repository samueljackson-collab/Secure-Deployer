import { describe, it, expect } from 'vitest';
import { normalizeMacAddress, detectDeviceType } from '../utils/helpers';
import { validateWindowsPath } from '../utils/security';

describe('normalizeMacAddress', () => {
  it('strips colons and uppercases', () => {
    expect(normalizeMacAddress('aa:bb:cc:dd:ee:ff')).toBe('AABBCCDDEEFF');
  });
  it('handles dot notation', () => {
    expect(normalizeMacAddress('0011.2233.4455')).toBe('001122334455');
  });
  it('returns empty string for empty input', () => {
    expect(normalizeMacAddress('')).toBe('');
  });
});

describe('detectDeviceType', () => {
  it('identifies laptops by hostname prefix', () => {
    expect(detectDeviceType('LAP-001')).toBe('laptop');
  });
  it('defaults to desktop for unknown hostnames', () => {
    expect(detectDeviceType('DESKTOP-XYZ')).toBe('desktop');
  });
});

describe('validateWindowsPath', () => {
  it('rejects paths with shell metacharacters', () => {
    expect(validateWindowsPath('C:\\foo;rm -rf /').valid).toBe(false);
  });
  it('accepts clean Windows paths', () => {
    expect(validateWindowsPath('C:\\Users\\Operator\\scripts').valid).toBe(true);
  });
});
