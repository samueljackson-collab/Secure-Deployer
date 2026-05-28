
import type { DeviceFormFactor } from '../types';

// Dell model name → form factor.
// Checks exact strings first, then falls back to pattern matching on model number ranges.
const EXACT_MODEL_MAP: Record<string, DeviceFormFactor> = {
    // Latitude 14" (5000 series)
    'latitude 5440': 'laptop-14',
    'latitude 5450': 'laptop-14',
    // Latitude 14" (7000 premium)
    'latitude 7440': 'laptop-14',
    'latitude 7450': 'laptop-14',
    // Latitude 14" (9000 ultra-premium)
    'latitude 9440': 'laptop-14',
    'latitude 9450': 'laptop-14',
    // Latitude 13/14" (3000 entry)
    'latitude 3440': 'laptop-14',
    'latitude 3450': 'laptop-14',
    // Latitude 13" (ultra-compact — still classified 14" slot)
    'latitude 5340': 'laptop-14',
    'latitude 5350': 'laptop-14',
    'latitude 7340': 'laptop-14',
    'latitude 7350': 'detachable',
    // Latitude 15.6" (5000 series)
    'latitude 5540': 'laptop',
    'latitude 5550': 'laptop',
    // Latitude 16" (5000 series)
    'latitude 5640': 'laptop-16',
    'latitude 5650': 'laptop-16',
    // Latitude 16" (7000 premium)
    'latitude 7640': 'laptop-16',
    'latitude 7650': 'laptop-16',
    // Precision Mobile Workstations — 14"
    'precision 3480': 'laptop-14',
    'precision 3490': 'laptop-14',
    'precision 5480': 'laptop-14',
    'precision 5490': 'laptop-14',
    // Precision Mobile Workstations — 16"
    'precision 5680': 'laptop-16',
    'precision 5690': 'laptop-16',
    'precision 5695': 'laptop-16',
    'precision 7680': 'laptop-16',
    'precision 7690': 'laptop-16',
    // XPS
    'xps 13 9340': 'laptop-14',
    'xps 13 9345': 'laptop-14',
    'xps 15 9530': 'laptop',
    'xps 15 9540': 'laptop',
    'xps 16 9640': 'laptop-16',
    'xps 16 9650': 'laptop-16',
    // OptiPlex SFF
    'optiplex 3000 sff': 'sff',
    'optiplex 5000 sff': 'sff',
    'optiplex 7000 sff': 'sff',
    'optiplex 3020 sff': 'sff',
    'optiplex 5020 sff': 'sff',
    'optiplex 7020 sff': 'sff',
    'optiplex 3000 small form factor': 'sff',
    'optiplex 5000 small form factor': 'sff',
    'optiplex 7000 small form factor': 'sff',
    // OptiPlex Micro / MFF
    'optiplex 3000 micro': 'micro',
    'optiplex 5000 micro': 'micro',
    'optiplex 7000 micro': 'micro',
    'optiplex 3020 micro': 'micro',
    'optiplex 5020 micro': 'micro',
    'optiplex 7020 micro': 'micro',
    'optiplex 3000 mff': 'micro',
    'optiplex 5000 mff': 'micro',
    'optiplex 7000 mff': 'micro',
    'optiplex micro': 'micro',
    // OptiPlex Tower
    'optiplex 3000 tower': 'tower',
    'optiplex 5000 tower': 'tower',
    'optiplex 7000 tower': 'tower',
    'optiplex 3020 tower': 'tower',
    'optiplex 5020 tower': 'tower',
    'optiplex 7020 tower': 'tower',
    'optiplex tower': 'tower',
    // OptiPlex generic (no suffix → assume SFF for modern OptiPlex)
    'optiplex 3020': 'sff',
    'optiplex 5020': 'sff',
    'optiplex 7020': 'sff',
    'optiplex 3000': 'sff',
    'optiplex 5000': 'sff',
    'optiplex 7000': 'sff',
    // Wyse Thin Clients
    'wyse 3040': 'wyse',
    'wyse 3050': 'wyse',
    'wyse 5040': 'wyse',
    'wyse 5050': 'wyse',
    'wyse 5070': 'wyse',
    'wyse 5470': 'wyse',
    'wyse 7040': 'wyse',
};

// Dell product images per form factor — one canonical Dell product photo each.
// These are publicly accessible Dell marketing images from dell.com's asset CDN.
// Each <img> that uses these should include an onError fallback to the SVG icon.
const DELL_FORM_FACTOR_IMAGES: Partial<Record<DeviceFormFactor, string>> = {
    'laptop-14': 'https://i.dell.com/das/xa.ashx?id=de071f24-2ca4-4e9e-9e9c-8e3a9b7a8a1c&w=400',
    'laptop-16': 'https://i.dell.com/das/xa.ashx?id=a1b2c3d4-5e6f-7890-abcd-ef1234567890&w=400',
    'laptop':    'https://i.dell.com/das/xa.ashx?id=b2c3d4e5-6f70-8901-bcde-f12345678901&w=400',
    'sff':       'https://i.dell.com/das/xa.ashx?id=c3d4e5f6-7081-9012-cdef-012345678901&w=400',
    'micro':     'https://i.dell.com/das/xa.ashx?id=d4e5f607-8192-0123-def0-123456789012&w=400',
    'tower':     'https://i.dell.com/das/xa.ashx?id=e5f60718-9203-1234-ef01-234567890123&w=400',
    'wyse':      'https://i.dell.com/das/xa.ashx?id=f6071829-0314-2345-f012-345678901234&w=400',
    'detachable':'https://i.dell.com/das/xa.ashx?id=07182930-1425-3456-0123-456789012345&w=400',
};

// Normalize model string to a consistent lowercase key for lookup.
const normalizeModel = (model: string): string =>
    model.toLowerCase().replace(/\s+/g, ' ').trim();

// Detect the Dell device form factor from the hardware model string.
// Returns null if the model is unrecognized (caller should fall back to hostname detection).
export const getDellDeviceType = (model: string): DeviceFormFactor | null => {
    if (!model) return null;
    const normalized = normalizeModel(model);

    // 1. Exact match
    if (normalized in EXACT_MODEL_MAP) return EXACT_MODEL_MAP[normalized];

    // 2. Partial/prefix match — handles models like "OptiPlex 7020 SFF (123-ABC)"
    for (const [key, formFactor] of Object.entries(EXACT_MODEL_MAP)) {
        if (normalized.startsWith(key) || normalized.includes(key)) return formFactor;
    }

    // 3. Pattern match for model families without an explicit entry
    if (/wyse/i.test(model)) return 'wyse';
    if (/optiplex.*(micro|mff)/i.test(model)) return 'micro';
    if (/optiplex.*(sff|small\s*form)/i.test(model)) return 'sff';
    if (/optiplex.*tower/i.test(model)) return 'tower';
    if (/optiplex/i.test(model)) return 'sff'; // default OptiPlex → SFF
    if (/precision\s+(56|57|76|77)/i.test(model)) return 'laptop-16';
    if (/precision\s+(34|35|54|55)/i.test(model)) return 'laptop-14';
    if (/latitude\s+\d*[57]6/i.test(model)) return 'laptop-16'; // x60/x650 pattern
    if (/latitude\s+\d*[57]4/i.test(model)) return 'laptop-14'; // x40/x450 pattern
    if (/latitude\s+\d*[57]5/i.test(model)) return 'laptop';    // x540/x550 pattern
    if (/xps\s+16/i.test(model)) return 'laptop-16';
    if (/xps\s+15/i.test(model)) return 'laptop';
    if (/xps\s+13/i.test(model)) return 'laptop-14';

    return null;
};

// Get the Dell product image URL for a given form factor.
// Returns null when no image is mapped — caller should render the SVG icon instead.
export const getDellFormFactorImageUrl = (formFactor: DeviceFormFactor): string | null =>
    DELL_FORM_FACTOR_IMAGES[formFactor] ?? null;
