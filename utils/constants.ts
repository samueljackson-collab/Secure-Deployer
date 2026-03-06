/**
 * @file constants.ts
 * @description Centralised compile-time constants shared across the application.
 *
 * Keeping constants here prevents duplication (e.g. TARGET_* previously lived in App.tsx and
 * were imported back into services, creating a backward dependency), ensures a single place to
 * update values, and makes it easy to audit what values the app considers "current".
 */

// ---------------------------------------------------------------------------
// Compliance Version Targets
// ---------------------------------------------------------------------------

/**
 * Minimum acceptable BIOS version for Dell endpoints in this fleet.
 * Update this when a new BIOS becomes the baseline for compliance.
 * Used by deploymentService.ts to flag devices that need a BIOS update.
 */
export const TARGET_BIOS_VERSION = 'A24';

/**
 * Minimum acceptable Dell Command | Update (DCU) version.
 * Update when IT publishes a new DCU baseline.
 */
export const TARGET_DCU_VERSION = '5.1.0';

/**
 * Minimum acceptable Windows feature release version (e.g. "23H2").
 * Update each time a new Windows release becomes the fleet baseline.
 */
export const TARGET_WIN_VERSION = '23H2';

// ---------------------------------------------------------------------------
// Log Level Options
// ---------------------------------------------------------------------------

/**
 * Ordered list of valid globalLevelFilter values used by LogViewer.
 * The order matters: 'ALL' < 'INFO' < 'WARNING' < 'ERROR'.
 * Use this array for validation before casting select element values.
 *
 * @example
 * const raw = e.target.value;
 * if (LOG_LEVEL_OPTIONS.includes(raw as typeof LOG_LEVEL_OPTIONS[number])) {
 *     dispatch({ type: 'SET_SETTINGS', payload: { logLevelFilter: raw as ... } });
 * }
 */
export const LOG_LEVEL_OPTIONS = ['ALL', 'INFO', 'WARNING', 'ERROR'] as const;
export type LogLevelOption = typeof LOG_LEVEL_OPTIONS[number];

// ---------------------------------------------------------------------------
// Deployment Status Colour Map
// ---------------------------------------------------------------------------

/**
 * Maps every DeploymentStatus value to a Tailwind text-colour class (and optional animation).
 *
 * Centralised here so DeploymentProgress, DeviceStatusTable, and ImageRack all render
 * consistent colours without copy-pasting the same object.
 *
 * The Record<string, string> type is intentionally broader than Record<DeploymentStatus, string>
 * so new statuses don't require updating this file before the TypeScript compiler is satisfied —
 * callers should fall back to 'text-gray-400' for unknown statuses.
 */
export const STATUS_COLORS: Record<string, string> = {
    Pending: 'text-gray-400',
    'Pending Validation': 'text-purple-400',
    'Waking Up': 'text-yellow-400 animate-pulse',
    Connecting: 'text-cyan-400 animate-pulse',
    'Retrying...': 'text-yellow-500 animate-pulse',
    Validating: 'text-cyan-400 animate-pulse',
    'Checking Info': 'text-cyan-400 animate-pulse',
    'Checking BIOS': 'text-cyan-400 animate-pulse',
    'Checking DCU': 'text-cyan-400 animate-pulse',
    'Checking Windows': 'text-cyan-400 animate-pulse',
    'Scan Complete': 'text-yellow-400',
    Updating: 'text-blue-400 animate-pulse',
    'Updating BIOS': 'text-blue-400 animate-pulse',
    'Updating DCU': 'text-blue-400 animate-pulse',
    'Updating Windows': 'text-blue-400 animate-pulse',
    'Update Complete (Reboot Pending)': 'text-purple-400',
    'Rebooting...': 'text-teal-400 animate-pulse',
    Success: 'text-[#39FF14]',
    Failed: 'text-red-400',
    Offline: 'text-orange-400',
    Cancelled: 'text-gray-500',
    'Pending File': 'text-blue-400',
    'Ready for Execution': 'text-yellow-400',
    'Executing Script': 'text-blue-400 animate-pulse',
    'Execution Complete': 'text-[#39FF14]',
    'Execution Failed': 'text-red-400',
    'Deploying Action': 'text-cyan-400 animate-pulse',
    'Action Complete': 'text-[#39FF14]',
    'Action Failed': 'text-red-400',
};
