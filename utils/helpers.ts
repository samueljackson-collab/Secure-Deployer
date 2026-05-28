
import type { DeviceFormFactor } from '../types';
import { getDellDeviceType } from './dellDeviceCatalog';

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const normalizeMacAddress = (mac: string): string => {
    if (!mac) return '';
    // Refined to also handle dot notation (e.g., 0011.2233.4455)
    return mac.replace(/[:\-.]/g, '').toUpperCase();
};

// Detects device form factor from hardware model metadata first (preferred), falling back
// to hostname pattern matching when model is absent or unrecognized.
export const detectDeviceType = (hostname: string, model?: string): DeviceFormFactor => {
    if (model) {
        const fromModel = getDellDeviceType(model);
        if (fromModel) return fromModel;
    }

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
