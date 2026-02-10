/**
 * types.ts
 *
 * Central type definitions for the Secure Deployment Runner.
 * Every interface used across the application is defined here to keep
 * a single source of truth and avoid circular import issues.
 *
 * Key design decisions:
 *   - DeviceFormFactor is a union of 10 string literals (not an enum)
 *     so it can be used as a Record key and is easier to serialize.
 *   - DeploymentStatus is a union of 19 string literals representing
 *     every possible state in the deployment state machine.
 *   - All imaging-related fields on Device are optional because they
 *     are only populated when a device enters via the Image Monitor.
 *   - ScriptSafetyResult / ScriptFinding are the output of the
 *     deterministic script analyzer.
 *   - ScopePolicy / ScopeVerification enforce that bulk operations
 *     only affect explicitly verified devices.
 */

/**
 * Represents a single device in the fleet — used in both the
 * Image Monitor and Deployment Runner views.
 *
 * Core fields (hostname, mac, status) are always present.
 * Scan fields (biosVersion, dcuVersion, etc.) are populated after
 * the device is scanned during deployment.
 * Imaging fields (imagingStatus, imagingProgress, etc.) are only
 * populated for devices that entered via Image Monitor promotion.
 */
export interface Device {
  // Developer note: this is intentionally a superset model shared by imaging and
  // deployment flows to reduce adapter code between pages and modals.
  id: number;
  hostname: string;
  mac: string;
  status: DeploymentStatus;
  isSelected?: boolean;
  biosVersion?: string;
  dcuVersion?: string;
  winVersion?: string;
  isBiosUpToDate?: boolean;
  isDcuUpToDate?: boolean;
  isWinUpToDate?: boolean;
  retryAttempt?: number;
  deviceType?: DeviceFormFactor;
  updatesNeeded?: {
    bios: boolean;
    dcu: boolean;
    windows: boolean;
  };
  lastUpdateResult?: {
    succeeded: string[];
    failed: string[];
  };
  ipAddress?: string;
  serialNumber?: string;
  model?: string;
  ramAmount?: number;
  diskSpace?: {
    total: number;
    free: number;
  };
  encryptionStatus?: 'Enabled' | 'Disabled' | 'Unknown';
  // Imaging metadata fields
  imagingStatus?: ImagingStatus;
  imagingProgress?: number;
  imagingStartTime?: Date;
  imagingTaskSequence?: string;
  scopeVerified?: boolean;
  scopeVerifiedAt?: Date;
  metadataCollectedAt?: Date;
}

// Dell business device form factors for icon rendering and fleet categorization.
// Detection is hostname-pattern-based (see detectDeviceType in App.tsx).
export type DeviceFormFactor =
  | 'laptop-14'        // Standard 14" Latitude (e.g. 5450, 7450)
  | 'laptop-16'        // Pro 16" Latitude / Precision Mobile (e.g. 9640, 5690)
  | 'detachable'       // 2-in-1 Detachable (e.g. Latitude 7350 Detachable)
  | 'laptop'           // Generic laptop fallback
  | 'sff'              // Standard Form Factor desktop (e.g. OptiPlex SFF)
  | 'micro'            // Micro Form Factor desktop (e.g. OptiPlex Micro)
  | 'tower'            // Tower desktop (e.g. OptiPlex Tower, Precision Tower)
  | 'wyse'             // Wyse Thin Client (e.g. Wyse 5070, 5470)
  | 'vdi'              // Virtual Desktop Infrastructure client
  | 'desktop';         // Generic desktop fallback

export type DeploymentStatus = 'Pending' | 'Waking Up' | 'Connecting' | 'Retrying...' | 'Checking Info' | 'Checking BIOS' | 'Checking DCU' | 'Checking Windows' | 'Scan Complete' | 'Updating' | 'Updating BIOS' | 'Updating DCU' | 'Updating Windows' | 'Success' | 'Failed' | 'Offline' | 'Cancelled' | 'Update Complete (Reboot Pending)' | 'Rebooting...';

export type ImagingStatus = 'Not Started' | 'Collecting Metadata' | 'Imaging In Progress' | 'Imaging Complete' | 'Imaging Failed' | 'Ready for Deployment';

export interface LogEntry {
  timestamp: Date;
  message: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
}

export interface Credentials {
  username: string;
  password: string;
}

export enum DeploymentState {
  Idle = 'idle',
  Running = 'running',
  Complete = 'complete',
}

export interface DeploymentRun {
  id: number;
  endTime: Date;
  totalDevices: number;
  compliant: number;
  needsAction: number;
  failed: number;
  successRate: number;
  updatesNeededCounts: {
    bios: number;
    dcu: number;
    windows: number;
  };
  failureCounts: {
    offline: number;
    cancelled: number;
    failed: number;
  };
}

// Script safety analysis types (deterministic)
export interface ScriptSafetyResult {
  isSafe: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  findings: ScriptFinding[];
  summary: string;
  blockedPatterns: string[];
  scopeViolations: string[];
}

export interface ScriptFinding {
  line: number;
  pattern: string;
  severity: 'INFO' | 'WARNING' | 'DANGER' | 'BLOCKED';
  description: string;
  recommendation: string;
}

// Device scope enforcement policy
// NOTE: Most policy flags (blockBroadcastCommands, blockSubnetWideOperations,
// blockRegistryWrites, blockServiceStops) are enforced at the script analysis
// level (see scriptSafetyAnalyzer.ts) before deployment begins.
// Only enforceHostnameWhitelist is enforced at runtime during device updates.
export interface ScopePolicy {
  // Developer note: this structure is persisted in UI state as the source-of-truth
  // approval contract for the currently authorized bulk action.
  allowedHostnames: string[];
  allowedMacs: string[];
  maxDeviceCount: number;
  requireExplicitSelection: boolean;
  blockBroadcastCommands: boolean;         // Enforced during script analysis
  blockSubnetWideOperations: boolean;      // Enforced during script analysis
  blockRegistryWrites: boolean;             // Enforced during script analysis
  blockServiceStops: boolean;               // Enforced during script analysis
  enforceHostnameWhitelist: boolean;        // Enforced at runtime AND during script analysis
}

export interface ScopeVerification {
  deviceId: number;
  hostname: string;
  mac: string;
  verified: boolean;
  verifiedAt: Date;
  verifiedBy: string;
  reason?: string;
}

// Imaging metadata from task sequence .bat script
export interface ImagingMetadata {
  hostname: string;
  serialNumber: string;
  macAddress: string;
  model: string;
  manufacturer: string;
  biosVersion: string;
  biosDate: string;
  totalRamMB: number;
  diskSizeGB: number;
  osVersion: string;
  ipAddress: string;
  taskSequenceName: string;
  collectedAt: string;
  imageProgress: number;
  encryptionReady: boolean;
}
