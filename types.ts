

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
  // New metadata fields
  ipAddress?: string;
  serialNumber?: string;
  model?: string;
  ramAmount?: number; // in GB
  diskSpace?: {
    total: number; // in GB
    free: number; // in GB
  };
  encryptionStatus?: 'Enabled' | 'Disabled' | 'Unknown';
}

export type DeploymentStatus = 'Pending' | 'Waking Up' | 'Connecting' | 'Retrying...' | 'Checking Info' | 'Checking BIOS' | 'Checking DCU' | 'Checking Windows' | 'Scan Complete' | 'Updating' | 'Updating BIOS' | 'Updating DCU' | 'Updating Windows' | 'Success' | 'Failed' | 'Offline' | 'Cancelled' | 'Update Complete (Reboot Pending)' | 'Rebooting...';

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