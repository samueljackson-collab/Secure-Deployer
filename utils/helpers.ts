
import type { DeviceFormFactor } from '../types';

/**
 * Returns a Promise that resolves after `ms` milliseconds.
 * Used to introduce artificial delays in async mock service flows
 * (e.g. simulating scan/update latency). Replace call-sites with real
 * API calls when production integrations are implemented.
 *
 * @param ms - Duration to sleep in milliseconds.
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Strips all MAC address separator characters (colons, hyphens, dots) and
 * uppercases the result, producing a canonical 12-character hex string.
 *
 * Handles common formats:
 * - `AA:BB:CC:DD:EE:FF` → `AABBCCDDEEFF`
 * - `AA-BB-CC-DD-EE-FF` → `AABBCCDDEEFF`
 * - `0011.2233.4455`    → `001122334455`
 *
 * @param mac - Raw MAC address string in any common format.
 * @returns   Normalised uppercase hex string, or empty string if input is falsy.
 */
export const normalizeMacAddress = (mac: string): string => {
    if (!mac) return '';
    return mac.replace(/[:\-.]/g, '').toUpperCase();
};

/**
 * Infers a device form-factor from its hostname using simple substring matching.
 *
 * Convention-based detection — works for hostnames that follow the fleet naming
 * standard (e.g. `LAP-HOSP-001`, `SFF-ICU-042`). Falls back to `'desktop'` when
 * no known pattern is matched.
 *
 * NOTE: Detection is English-locale and case-insensitive. Hostnames that don't
 * embed form-factor tokens will always resolve to `'desktop'`.
 *
 * @param hostname - The device hostname string.
 * @returns A `DeviceFormFactor` value used to select the correct icon in DeviceIcon.
 */
export const detectDeviceType = (hostname: string): DeviceFormFactor => {
    const lowerHostname = hostname.toLowerCase();
    if (lowerHostname.includes('l14') || lowerHostname.includes('lap14')) return 'laptop-14';
    if (lowerHostname.includes('l16') || lowerHostname.includes('lap16')) return 'laptop-16';
    if (lowerHostname.includes('lap') || lowerHostname.includes('lt')) return 'laptop';
    if (lowerHostname.includes('sff')) return 'sff';
    if (lowerHostname.includes('micro')) return 'micro';
    if (lowerHostname.includes('twr') || lowerHostname.includes('tower')) return 'tower';
    if (lowerHostname.includes('wyse')) return 'wyse';
    if (lowerHostname.includes('vdi')) return 'vdi';
    if (lowerHostname.includes('detach')) return 'detachable';
    return 'desktop';
};
