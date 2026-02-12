
import { Dispatch } from 'react';

export type DeviceFormFactor =
  | 'desktop'
  | 'laptop'
  | 'laptop-14'
  | 'laptop-16'
  | 'detachable'
  | 'sff' // Small Form Factor
  | 'micro'
  | 'tower'
  | 'wyse' // Wyse Thin Client
  | 'vdi'; // VDI Client

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
  deviceType: DeviceFormFactor;
  updatesNeeded?: {
    bios: boolean;
    dcu: boolean;
    windows: boolean;
    encryption: boolean;
    crowdstrike: boolean;
    sccm: boolean;
  };
  lastUpdateResult?: {
    succeeded: string[];
    failed: string[];
  };
  // New metadata fields
  ipAddress?: string;
  serialNumber?: string;
  model?: string;
  assetTag?: string;
  ramAmount?: number; // in GB
  diskSpace?: {
    total: number; // in GB
    free: number; // in GB
  };
  encryptionStatus?: 'Enabled' | 'Disabled' | 'Unknown';
  crowdstrikeStatus?: 'Running' | 'Not Found' | 'Unknown';
  sccmStatus?: 'Healthy' | 'Unhealthy' | 'Unknown';
  scriptFile?: File;
}

export type DeploymentStatus = 
  // Scanning Flow
  'Pending' | 'Waking Up' | 'Connecting' | 'Retrying...' | 'Checking Info' | 'Checking BIOS' | 'Checking DCU' | 'Checking Windows' | 'Scan Complete' | 'Updating' | 'Updating BIOS' | 'Updating DCU' | 'Updating Windows' | 'Success' | 'Failed' | 'Offline' | 'Cancelled' | 'Update Complete (Reboot Pending)' | 'Rebooting...' | 'Validating' |
  // Deployment Flow
  'Pending File' | 'Ready for Execution' | 'Executing Script' | 'Execution Complete' | 'Execution Failed';

export interface LogEntry {
  timestamp: Date;
  message: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
}

export interface Credentials {
    username: string;
    password: string;
}

export type DeploymentState = 'idle' | 'running' | 'complete';


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

// --- New Types for Image Monitor ---

export type ImagingStatus = 'Imaging' | 'Completed' | 'Failed' | 'Checking Compliance';

export interface ChecklistItem {
    description: string;
    expected: string;
    actual: string;
    passed: boolean;
}

export interface ComplianceResult {
    status: 'Passed' | 'Failed';
    details: ChecklistItem[];
}

export interface ImagingDevice {
  id: string; // MAC Address
  hostname: string;
  macAddress: string;
  ipAddress: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  slot: string;
  tech: string;
  startTime: number;
  status: ImagingStatus;
  progress: number;
  duration: number; // The total time this device will take to image, in seconds
  complianceCheck?: ComplianceResult;
}

// --- Types for AppContext ---

export interface AppState {
    runner: {
        devices: Device[];
        logs: LogEntry[];
        deploymentState: DeploymentState;
        selectedDeviceIds: Set<number>;
        history: DeploymentRun[];
        settings: {
            maxRetries: number;
            retryDelay: number;
            autoRebootEnabled: boolean;
        };
        isCancelled: boolean;
    };
    monitor: {
        devices: ImagingDevice[];
    };
    ui: {
        activeTab: 'monitor' | 'runner' | 'build' | 'script';
        csvFile: File | null;
        isCredentialModalOpen: boolean;
        isComplianceModalOpen: boolean;
        selectedComplianceResult: ComplianceResult | null;
        isAllComplianceModalOpen: boolean;
        isPassedComplianceModalOpen: boolean;
        isRescanModalOpen: boolean;
    };
    credentials?: Credentials;
}

export type AppAction =
  // UI Actions
  | { type: 'SET_ACTIVE_TAB'; payload: 'monitor' | 'runner' | 'build' | 'script' }
  | { type: 'SET_CSV_FILE'; payload: File | null }
  | { type: 'SET_CREDENTIAL_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_COMPLIANCE_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_ALL_COMPLIANCE_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_PASSED_COMPLIANCE_MODAL_OPEN'; payload: boolean }
  | { type: 'SHOW_COMPLIANCE_DETAILS'; payload: ComplianceResult }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'SET_RESCAN_MODAL_OPEN', payload: boolean }

  // Runner Actions
  | { type: 'START_DEPLOYMENT_PROMPT' }
  | { type: 'START_DEPLOYMENT_CONFIRMED'; payload: Credentials }
  | { type: 'INITIALIZE_DEPLOYMENT'; payload: { devices: Device[]; credentials: Credentials } }
  | { type: 'DEPLOYMENT_STARTED' }
  | { type: 'UPDATE_DEVICE_STATE'; payload: Device }
  | { type: 'DEPLOYMENT_FINISHED' }
  | { type: 'CANCEL_DEPLOYMENT' }
  | { type: 'ARCHIVE_RUN' }
  | { type: 'SET_SETTINGS'; payload: Partial<AppState['runner']['settings']> }
  | { type: 'TOGGLE_DEVICE_SELECTION'; payload: number }
  | { type: 'SELECT_ALL_DEVICES'; payload: boolean }
  | { type: 'CLEAR_SELECTIONS' }
  | { type: 'SET_DEVICES'; payload: Device[] }
  | { type: 'UPDATE_SINGLE_DEVICE'; payload: Partial<Device> & { id: number } }
  | { type: 'WAKE_ON_LAN'; payload: Set<number> }
  | { type: 'UPDATE_DEVICE'; payload: number }
  | { type: 'REBOOT_DEVICE'; payload: number }
  | { type: 'VALIDATE_DEVICES'; payload: Set<number> }
  | { type: 'SET_SCRIPT_FILE'; payload: { deviceId: number, file: File } }
  | { type: 'EXECUTE_SCRIPT'; payload: number }
  | { type: 'BULK_UPDATE' }
  | { type: 'BULK_CANCEL' }
  | { type: 'BULK_VALIDATE' }
  | { type: 'BULK_EXECUTE' }
  | { type: 'BULK_REMOVE' }
  | { type: 'RESCAN_ALL_DEVICES_PROMPT' }
  | { type: 'RESCAN_ALL_DEVICES_CONFIRMED' }
  
  // Monitor Actions
  | { type: 'SET_IMAGING_DEVICES'; payload: ImagingDevice[] }
  | { type: 'RENAME_IMAGING_DEVICE'; payload: { deviceId: string; newHostname: string } }
  | { type: 'REMOVE_IMAGING_DEVICE'; payload: string }
  | { type: 'TRANSFER_ALL_COMPLETED_DEVICES' }
  | { type: 'TRANSFER_SELECTED_IMAGING_DEVICES'; payload: Set<string> }
  | { type: 'CLEAR_SELECTED_IMAGING_DEVICES'; payload: Set<string> }
  | { type: 'REVALIDATE_IMAGING_DEVICES'; payload: Set<string> }
  | { type: 'UPDATE_IMAGING_DEVICE_STATE'; payload: ImagingDevice }
  ;

export type AppDispatch = Dispatch<AppAction>;