import { describe, it, expect } from 'vitest';
import { normalizeMacAddress, detectDeviceType, sleep } from '../../utils/helpers';

describe('normalizeMacAddress', () => {
    it('normalizes colon-separated MAC to uppercase hex', () => {
        expect(normalizeMacAddress('00:1a:2b:3c:4d:5e')).toBe('001A2B3C4D5E');
    });

    it('normalizes hyphen-separated MAC', () => {
        expect(normalizeMacAddress('00-1A-2B-3C-4D-5E')).toBe('001A2B3C4D5E');
    });

    it('normalizes dot-separated MAC', () => {
        expect(normalizeMacAddress('0011.2233.4455')).toBe('001122334455');
    });

    it('returns empty string for empty input', () => {
        expect(normalizeMacAddress('')).toBe('');
    });

    it('uppercases all hex characters', () => {
        expect(normalizeMacAddress('aa:bb:cc:dd:ee:ff')).toBe('AABBCCDDEEFF');
    });

    it('handles already-normalized input without stripping valid chars', () => {
        expect(normalizeMacAddress('001A2B3C4D5E')).toBe('001A2B3C4D5E');
    });
});

describe('detectDeviceType', () => {
    it('detects laptop-14 from l14 hostname', () => {
        expect(detectDeviceType('HQ-L14-001')).toBe('laptop-14');
    });

    it('detects laptop-14 from lap14 hostname', () => {
        expect(detectDeviceType('BRANCH-LAP14-007')).toBe('laptop-14');
    });

    it('detects laptop-16 from l16 hostname', () => {
        expect(detectDeviceType('HQ-L16-002')).toBe('laptop-16');
    });

    it('detects laptop from lap prefix', () => {
        expect(detectDeviceType('HQ-LAP-005')).toBe('laptop');
    });

    it('detects laptop from lt prefix', () => {
        expect(detectDeviceType('BRANCH-LT-010')).toBe('laptop');
    });

    it('detects sff', () => {
        expect(detectDeviceType('HQ-SFF-003')).toBe('sff');
    });

    it('detects micro', () => {
        expect(detectDeviceType('HQ-MICRO-004')).toBe('micro');
    });

    it('detects tower from tower keyword', () => {
        expect(detectDeviceType('HQ-TOWER-006')).toBe('tower');
    });

    it('detects tower from twr shorthand', () => {
        expect(detectDeviceType('HQ-TWR-008')).toBe('tower');
    });

    it('detects wyse thin client', () => {
        expect(detectDeviceType('WYSE-001')).toBe('wyse');
    });

    it('detects vdi', () => {
        expect(detectDeviceType('VDI-CLIENT-001')).toBe('vdi');
    });

    it('detects detachable', () => {
        expect(detectDeviceType('HQ-DETACH-001')).toBe('detachable');
    });

    it('defaults to desktop for unrecognized hostname', () => {
        expect(detectDeviceType('WORKSTATION-001')).toBe('desktop');
    });

    it('is case-insensitive', () => {
        expect(detectDeviceType('hq-sff-001')).toBe('sff');
        expect(detectDeviceType('HQ-SFF-001')).toBe('sff');
    });
});

describe('sleep', () => {
    it('resolves after the specified delay', async () => {
        const start = Date.now();
        await sleep(50);
        expect(Date.now() - start).toBeGreaterThanOrEqual(40);
    });

    it('resolves immediately for 0ms', async () => {
        await expect(sleep(0)).resolves.toBeUndefined();
    });
});
