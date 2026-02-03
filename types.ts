export interface Device {
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
  deviceType?: 'desktop' | 'laptop';
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
  updatesNeededCounts?: {
    bios: number;
    dcu: number;
    windows: number;
  };
  failureCounts?: {
    offline: number;
    cancelled: number;
    failed: number;
  };
}

// Script safety analysis types (deterministic, no AI)
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

// Device scope enforcement
export interface ScopePolicy {
  allowedHostnames: string[];
  allowedMacs: string[];
  maxDeviceCount: number;
  requireExplicitSelection: boolean;
  blockBroadcastCommands: boolean;
  blockSubnetWideOperations: boolean;
  blockRegistryWrites: boolean;
  blockServiceStops: boolean;
  enforceHostnameWhitelist: boolean;
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
