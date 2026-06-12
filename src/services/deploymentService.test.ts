import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { parseDevicesFromCsv } from '../../services/deploymentService';

describe('parseDevicesFromCsv', () => {
  it('parses a valid CSV with multiple device rows into device objects', () => {
    const csv = [
      'Hostname,MAC,Model',
      'DESK-001,00:1A:2B:3C:4D:5E,OptiPlex 7020',
      'LAP14-002,00-1A-2B-3C-4D-5F,Latitude 5440',
    ].join('\n');

    const results = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const { devices, errors } = parseDevicesFromCsv(results);

    expect(errors).toEqual([]);
    expect(devices).toHaveLength(2);

    expect(devices[0]).toMatchObject({
      id: 0,
      hostname: 'DESK-001',
      mac: '001A2B3C4D5E',
      status: 'Pending',
      model: 'OptiPlex 7020',
    });
    expect(devices[1]).toMatchObject({
      id: 1,
      hostname: 'LAP14-002',
      mac: '001A2B3C4D5F',
      status: 'Pending',
      model: 'Latitude 5440',
    });

    // Default file/package/program scaffolding populated for each device.
    devices.forEach(device => {
      expect(device.availableFiles).toEqual([
        'install_printer.exe',
        'map_network_drive.bat',
        'troubleshoot.ps1',
      ]);
      expect(device.installedPackages).toEqual([
        'Microsoft Office',
        'Google Chrome',
        'Adobe Reader',
      ]);
      expect(device.runningPrograms).toEqual(['Google Chrome']);
    });
  });

  it('parses devices without a Model column, leaving model undefined', () => {
    const csv = ['Hostname,MAC', 'DESK-010,00:1A:2B:3C:4D:60'].join('\n');
    const results = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const { devices, errors } = parseDevicesFromCsv(results);

    expect(errors).toEqual([]);
    expect(devices).toHaveLength(1);
    expect(devices[0].hostname).toBe('DESK-010');
    expect(devices[0].mac).toBe('001A2B3C4D60');
    expect(devices[0].model).toBeUndefined();
  });

  it('returns an error when the CSV is missing required Hostname/MAC columns', () => {
    const csv = ['Name,Address', 'DESK-001,00:1A:2B:3C:4D:5E'].join('\n');
    const results = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const { devices, errors } = parseDevicesFromCsv(results);

    expect(devices).toEqual([]);
    expect(errors).toEqual(["CSV must contain 'Hostname' and 'MAC' columns."]);
  });

  it('skips rows with a missing hostname and records a validation error', () => {
    const csv = [
      'Hostname,MAC',
      ',00:1A:2B:3C:4D:5E',
      'DESK-002,00:1A:2B:3C:4D:5F',
    ].join('\n');
    const results = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const { devices, errors } = parseDevicesFromCsv(results);

    expect(devices).toHaveLength(1);
    expect(devices[0].hostname).toBe('DESK-002');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Missing hostname');
  });

  it('skips rows with an invalid (wrong length) MAC address', () => {
    const csv = [
      'Hostname,MAC',
      'DESK-003,00:1A:2B:3C:4D',
    ].join('\n');
    const results = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const { devices, errors } = parseDevicesFromCsv(results);

    expect(devices).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('DESK-003');
    expect(errors[0]).toContain('Incorrect length');
  });

  it('skips rows with a MAC address containing invalid characters', () => {
    const csv = [
      'Hostname,MAC',
      'DESK-004,ZZ:1A:2B:3C:4D:5E',
    ].join('\n');
    const results = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const { devices, errors } = parseDevicesFromCsv(results);

    expect(devices).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('DESK-004');
    expect(errors[0]).toContain('invalid characters');
  });

  it('skips rows with a missing/empty MAC address', () => {
    const csv = [
      'Hostname,MAC',
      'DESK-005,',
    ].join('\n');
    const results = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const { devices, errors } = parseDevicesFromCsv(results);

    expect(devices).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('DESK-005');
    expect(errors[0]).toContain('missing or empty');
  });

  it('returns an empty devices array and a "no valid devices" error for an empty CSV body', () => {
    const csv = 'Hostname,MAC\n';
    const results = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const { devices, errors } = parseDevicesFromCsv(results);

    expect(devices).toEqual([]);
    expect(errors).toEqual(['No valid devices found in the CSV file to process.']);
  });

  it('returns a header-detection error when meta.fields is not set', () => {
    const results = {
      data: [],
      errors: [],
      meta: {} as any,
    };

    const { devices, errors } = parseDevicesFromCsv(results as any);

    expect(devices).toEqual([]);
    expect(errors).toEqual(['Could not detect header row in CSV.']);
  });

  it('reports missing required columns for an empty CSV input (no header detected)', () => {
    const results = Papa.parse<Record<string, string>>('', { header: true, skipEmptyLines: true });
    const { devices, errors } = parseDevicesFromCsv(results);

    expect(devices).toEqual([]);
    expect(errors).toContain("CSV must contain 'Hostname' and 'MAC' columns.");
  });

  it('surfaces PapaParse-reported parsing errors alongside any device errors', () => {
    const results = {
      data: [],
      errors: [{ type: 'Quotes', code: 'MissingQuotes', message: 'Unescaped quote', row: 0 } as any],
      meta: { fields: ['Hostname', 'MAC'] } as any,
    };

    const { devices, errors } = parseDevicesFromCsv(results as any);

    expect(devices).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('CSV parsing errors');
    expect(errors[0]).toContain('MissingQuotes');
  });
});
