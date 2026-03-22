import { describe, it, expect, vi } from 'vitest';
import type { ParseResult } from 'papaparse';

// Mock App module constants to avoid pulling in the full React component tree
vi.mock('../../App', () => ({
    TARGET_BIOS_VERSION: 'A24',
    TARGET_DCU_VERSION: '5.1.0',
    TARGET_WIN_VERSION: '23H2',
}));

// Mock sleep so tests don't incur real delays
vi.mock('../../utils/helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../utils/helpers')>();
    return {
        ...actual,
        sleep: vi.fn().mockResolvedValue(undefined),
    };
});

import { parseDevicesFromCsv, buildRemoteDesktopFile } from '../../services/deploymentService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeParsedCsv(rows: Record<string, string>[]): ParseResult<Record<string, string>> {
    return {
        data: rows,
        errors: [],
        meta: { fields: Object.keys(rows[0] ?? {}), delimiter: ',', linebreak: '\n', aborted: false, truncated: false, cursor: 0 },
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('parseDevicesFromCsv', () => {
    it('returns Device[] for a valid CSV', () => {
        const result = makeParsedCsv([
            { Hostname: 'DESK-001', MAC: '00:1A:2B:3C:4D:5E' },
            { Hostname: 'DESK-002', MAC: 'AA:BB:CC:DD:EE:FF' },
        ]);

        const { devices, errors } = parseDevicesFromCsv(result);

        expect(errors).toHaveLength(0);
        expect(devices).toHaveLength(2);
        expect(devices[0].hostname).toBe('DESK-001');
        expect(devices[0].mac).toBe('001A2B3C4D5E');
        expect(devices[0].status).toBe('Pending');
    });

    it('skips rows with an invalid MAC address and returns an error', () => {
        const result = makeParsedCsv([
            { Hostname: 'DESK-BAD', MAC: 'ZZ:ZZ:ZZ:ZZ:ZZ:ZZ' },
        ]);

        const { devices, errors } = parseDevicesFromCsv(result);

        expect(devices).toHaveLength(0);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('DESK-BAD');
    });

    it('returns an error when required columns are missing', () => {
        const result = makeParsedCsv([
            { ComputerName: 'DESK-001', Address: '00:1A:2B:3C:4D:5E' },
        ]);

        const { devices, errors } = parseDevicesFromCsv(result);

        expect(devices).toHaveLength(0);
        expect(errors.some(e => e.includes("'Hostname' and 'MAC'"))).toBe(true);
    });
});

describe('buildRemoteDesktopFile', () => {
    const baseDevice = {
        id: 1,
        hostname: 'DESK-001',
        mac: '001A2B3C4D5E',
        status: 'Success' as const,
        deviceType: 'desktop' as const,
        availableFiles: [],
        installedPackages: [],
        runningPrograms: [],
    };

    it('includes the hostname in the RDP output', () => {
        const output = buildRemoteDesktopFile(baseDevice);
        expect(output).toContain('DESK-001');
    });

    it('does not include a password field in the RDP output', () => {
        const output = buildRemoteDesktopFile(baseDevice, { username: 'admin', password: 'secret' });
        expect(output).not.toContain('password');
        expect(output).not.toContain('secret');
    });

    it('includes the username when credentials are provided', () => {
        const output = buildRemoteDesktopFile(baseDevice, { username: 'admin', password: 'secret' });
        expect(output).toContain('username:s:admin');
    });
});
