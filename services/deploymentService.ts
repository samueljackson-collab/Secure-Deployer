

import { sleep, normalizeMacAddress, detectDeviceType } from '../utils/helpers';
// FIX: Import DeploymentStatus to correctly type the device state.
import type { Device, DeploymentStatus, ImagingDevice, DeploymentRun, ChecklistItem, ComplianceResult } from '../types';
import { TARGET_BIOS_VERSION, TARGET_DCU_VERSION, TARGET_WIN_VERSION } from '../App';
import { ParseResult } from 'papaparse';

// --- HELPERS ---

const generateRandomVersion = (base: string, pass: boolean): string => {
    if (pass) return base;
    const parts = base.split('.');
    if (base.startsWith('A')) return `A${Math.floor(18 + Math.random() * 6)}`; // BIOS
    if (parts.length === 3) return `${parts[0]}.${Math.floor(Math.random() * (parseInt(parts[1], 10)))}.${Math.floor(Math.random() * 9)}`; // DCU
    return ['22H2', '21H2'][Math.floor(Math.random() * 2)]; // Windows
};

// --- MOCK API SERVICE ---

export const parseDevicesFromCsv = (results: ParseResult<Record<string, string>>): { devices: Device[], errors: string[] } => {
    const devices: Device[] = [];
    const errors: string[] = [];

    if (results.errors.length > 0) {
        errors.push(`CSV parsing errors: ${JSON.stringify(results.errors)}`);
    }

    const header = results.meta.fields;
    if (!header) {
        errors.push('Could not detect header row in CSV.');
        return { devices, errors };
    }
    const hostnameCol = header.find(h => h.toLowerCase().includes('hostname'));
    const macCol = header.find(h => h.toLowerCase().includes('mac'));

    if (!hostnameCol || !macCol) {
        errors.push("CSV must contain 'Hostname' and 'MAC' columns.");
        return { devices, errors };
    }

    results.data.forEach((row, index) => {
        const hostname = (row[hostnameCol] || '').trim();
        if (!hostname) {
            errors.push(`[Validation Skip] Skipping row ${index + 2}. Reason: Missing hostname.`);
            return;
        }

        const rawMac = (row[macCol] || '').trim();
        let macValidationError = '';
        let normalizedMac = '';

        if (!rawMac) macValidationError = 'MAC address is missing or empty.';
        else if (/[^0-9A-Fa-f:.-]/.test(rawMac)) macValidationError = 'Contains invalid characters (only A-F, 0-9, :, -, . are allowed).';
        else {
            normalizedMac = normalizeMacAddress(rawMac);
            if (normalizedMac.length !== 12) macValidationError = `Incorrect length. Must be 12 characters without separators. Example: 00:1A:2B:3C:4D:5E.`;
        }
        
        if (macValidationError) {
            errors.push(`[Validation Skip] Device "${hostname}" (Row ${index + 2}) has an invalid MAC address. Reason: ${macValidationError} | Raw Value: "${rawMac}"`);
            return;
        }

        devices.push({
            id: index, hostname, mac: normalizedMac, status: 'Pending',
            deviceType: detectDeviceType(hostname),
            availableFiles: ['install_printer.exe', 'map_network_drive.bat', 'troubleshoot.ps1'],
            installedPackages: ['Microsoft Office', 'Google Chrome', 'Adobe Reader'],
            runningPrograms: ['Google Chrome'],
        });
    });

    if (devices.length === 0 && errors.length === 0) {
        errors.push('No valid devices found in the CSV file to process.');
    }
    
    return { devices, errors };
};

export const runDeploymentFlow = async (
    devices: Device[],
    settings: { maxRetries: number; retryDelay: number },
    onProgress: (device: Device) => void,
    isCancelled: () => boolean
): Promise<void> => {
    await sleep(2000); // Simulate WoL
    
    for (const device of devices) {
        if (isCancelled()) break;
        await validateDevice(device, settings, onProgress, isCancelled);
    }
};

export const validateDevices = async (
    devices: Device[],
    onProgress: (device: Device) => void,
    isCancelled: () => boolean
): Promise<void> => {
     for (const device of devices) {
        if (isCancelled()) break;
        onProgress({ ...device, status: 'Validating' });
        await validateDevice(device, {maxRetries: 1, retryDelay: 1}, onProgress, isCancelled);
    }
}

const validateDevice = async (
    device: Device,
    settings: { maxRetries: number, retryDelay: number },
    onProgress: (device: Device) => void,
    isCancelled: () => boolean
) => {
    let currentDeviceState = { ...device };

    // Connection
    onProgress({ ...currentDeviceState, status: 'Connecting' });
    let isConnected = false;
    for (let attempt = 1; attempt <= settings.maxRetries; attempt++) {
        if (isCancelled()) return;
        await sleep(1000 + Math.random() * 500);
        if (Math.random() > 0.3) { isConnected = true; break; } 
        else if (attempt < settings.maxRetries) {
            onProgress({ ...currentDeviceState, status: 'Retrying...', retryAttempt: attempt });
            await sleep(settings.retryDelay * 1000);
        }
    }

    if (!isConnected) {
        onProgress({ ...currentDeviceState, status: 'Offline' });
        return;
    }

    // Scan
    const checks = [
        { status: 'Checking Info', duration: 500, key: 'info' },
        { status: 'Checking BIOS', duration: 1500, key: 'bios' },
        { status: 'Checking DCU', duration: 1000, key: 'dcu' },
        { status: 'Checking Windows', duration: 2000, key: 'win' },
    ] as const;

    for (const check of checks) {
        if (isCancelled()) return;
        onProgress({ ...currentDeviceState, status: check.status });
        await sleep(check.duration + Math.random() * 500);

        switch (check.key) {
            case 'info':
                currentDeviceState = { ...currentDeviceState, encryptionStatus: Math.random() > 0.2 ? 'Enabled' : 'Disabled', model: 'OptiPlex 7020', serialNumber: 'ABC1234', assetTag: 'ASSET-XYZ' };
                break;
            case 'bios':
                const isBiosUpToDate = Math.random() > 0.3;
                currentDeviceState = { ...currentDeviceState, isBiosUpToDate, biosVersion: generateRandomVersion(TARGET_BIOS_VERSION, isBiosUpToDate) };
                break;
            case 'dcu':
                 const isDcuUpToDate = Math.random() > 0.3;
                currentDeviceState = { ...currentDeviceState, isDcuUpToDate, dcuVersion: generateRandomVersion(TARGET_DCU_VERSION, isDcuUpToDate) };
                break;
            case 'win':
                const isWinUpToDate = Math.random() > 0.3;
                currentDeviceState = { ...currentDeviceState, isWinUpToDate, winVersion: generateRandomVersion(TARGET_WIN_VERSION, isWinUpToDate) };
                break;
        }
    }

    // Finalize
    const isEncryptionOk = currentDeviceState.encryptionStatus === 'Enabled';
    const isCrowdstrikeOk = Math.random() > 0.1;
    const isSccmOk = Math.random() > 0.15;

    currentDeviceState.crowdstrikeStatus = isCrowdstrikeOk ? 'Running' : 'Not Found';
    currentDeviceState.sccmStatus = isSccmOk ? 'Healthy' : 'Unhealthy';

    const allUpToDate = !!currentDeviceState.isBiosUpToDate && !!currentDeviceState.isDcuUpToDate && !!currentDeviceState.isWinUpToDate && isEncryptionOk && isCrowdstrikeOk && isSccmOk;
    
    currentDeviceState.updatesNeeded = { bios: !currentDeviceState.isBiosUpToDate, dcu: !currentDeviceState.isDcuUpToDate, windows: !currentDeviceState.isWinUpToDate, encryption: !isEncryptionOk, crowdstrike: !isCrowdstrikeOk, sccm: !isSccmOk };
    currentDeviceState.status = allUpToDate ? 'Success' : 'Scan Complete';

    onProgress(currentDeviceState);
};


export const updateDevice = async (
    device: Device,
    settings: { autoRebootEnabled: boolean },
    onProgress: (device: Device) => void,
    isCancelled: () => boolean
): Promise<void> => {
    // FIX: Changed `as const` to `as DeploymentStatus` to widen the type of the status property,
    // allowing it to be updated to other valid deployment statuses. This resolves multiple type errors.
    let currentDeviceState: Device = { ...device, status: 'Updating' };
    onProgress(currentDeviceState);
    
    let needsReboot = false;
    const succeeded: string[] = [];
    const failed: string[] = [];

    const componentsToUpdate = [
        { name: 'BIOS', needsUpdate: device.updatesNeeded?.bios, requiresReboot: true },
        { name: 'DCU', needsUpdate: device.updatesNeeded?.dcu, requiresReboot: false },
        { name: 'Windows', needsUpdate: device.updatesNeeded?.windows, requiresReboot: false },
    ] as const;

    for (const comp of componentsToUpdate) {
        if (isCancelled() || !comp.needsUpdate) continue;

        currentDeviceState = { ...currentDeviceState, status: `Updating ${comp.name}` };
        onProgress(currentDeviceState);
        await sleep(2000 + Math.random() * 1000);
        if (isCancelled()) return;

        if (Math.random() > 0.15) {
            succeeded.push(comp.name);
            if (comp.requiresReboot) needsReboot = true;
        } else {
            failed.push(comp.name);
            break; // Stop on first failure
        }
    }

    if (isCancelled()) return;

    currentDeviceState.lastUpdateResult = { succeeded, failed };

    if (failed.length > 0) {
        currentDeviceState.status = 'Failed';
    } else if (succeeded.length > 0) {
        currentDeviceState.status = needsReboot ? 'Update Complete (Reboot Pending)' : 'Success';
    } else {
        currentDeviceState.status = 'Success'; // No updates were needed
    }
    
    onProgress(currentDeviceState);

    if (currentDeviceState.status === 'Update Complete (Reboot Pending)' && settings.autoRebootEnabled) {
        await rebootDevice();
        onProgress({ ...currentDeviceState, status: 'Success' });
    }
};

export const rebootDevice = async (): Promise<void> => {
    await sleep(8000 + Math.random() * 4000);
};

export const executeScript = async (device: Device): Promise<boolean> => {
    await sleep(5000 + Math.random() * 5000);
    return Math.random() > 0.2;
};

export const buildRemoteDesktopFile = (device: Device): string => {
    const address = device.ipAddress || device.hostname;
    return [
        'screen mode id:i:2',
        'use multimon:i:0',
        'session bpp:i:32',
        'desktopwidth:i:1600',
        'desktopheight:i:900',
        'full address:s:' + address,
        'prompt for credentials:i:1',
        'authentication level:i:2',
        'redirectclipboard:i:1',
    ].join('\n');
};

export const performDeploymentOperation = async (
    device: Device,
    operation: DeploymentOperationType,
    targetFile: File,
): Promise<{ ok: boolean; reason?: string; message: string; patch: Partial<Device> }> => {
    await sleep(1200 + Math.random() * 1000);
    const targetName = targetFile.name;
    const files = new Set(device.availableFiles || []);
    const installed = new Set(device.installedPackages || []);
    const running = new Set(device.runningPrograms || []);

    if (operation === 'run') {
        if (!files.has(targetName)) {
            return { ok: false, reason: 'File Not Found', message: `[${device.hostname}] Run failed for "${targetName}" (file not found on target).`, patch: { status: 'Action Failed' } };
        }
        if (running.has(targetName)) {
            return { ok: false, reason: 'Already Running', message: `[${device.hostname}] Run skipped for "${targetName}" (already running).`, patch: { status: 'Action Failed' } };
        }
        if (Math.random() < 0.15) {
            return { ok: false, reason: 'Insufficient Permission', message: `[${device.hostname}] Run failed for "${targetName}" (insufficient permission).`, patch: { status: 'Action Failed' } };
        }
        running.add(targetName);
        return { ok: true, message: `[${device.hostname}] Run operation succeeded for "${targetName}".`, patch: { status: 'Action Complete', runningPrograms: [...running] } };
    }

    if (operation === 'install') {
        if (!files.has(targetName)) {
            return { ok: false, reason: 'File Not Found', message: `[${device.hostname}] Install failed for "${targetName}" (file not found on target).`, patch: { status: 'Action Failed' } };
        }
        if (installed.has(targetName)) {
            return { ok: false, reason: 'Already Installed', message: `[${device.hostname}] Install skipped for "${targetName}" (already installed).`, patch: { status: 'Action Failed' } };
        }
        if (Math.random() < 0.12) {
            return { ok: false, reason: 'Cannot Access File', message: `[${device.hostname}] Install failed for "${targetName}" (file cannot be accessed).`, patch: { status: 'Action Failed' } };
        }
        installed.add(targetName);
        return { ok: true, message: `[${device.hostname}] Install operation succeeded for "${targetName}".`, patch: { status: 'Action Complete', installedPackages: [...installed] } };
    }

    if (!files.has(targetName) && !installed.has(targetName) && !running.has(targetName)) {
        return { ok: false, reason: 'Already Deleted', message: `[${device.hostname}] Delete skipped for "${targetName}" (already removed).`, patch: { status: 'Action Failed' } };
    }
    if (running.has(targetName)) {
        return { ok: false, reason: 'File In Use', message: `[${device.hostname}] Delete failed for "${targetName}" (program currently running).`, patch: { status: 'Action Failed' } };
    }
    files.delete(targetName);
    installed.delete(targetName);
    return {
        ok: true,
        message: `[${device.hostname}] Delete operation succeeded for "${targetName}".`,
        patch: { status: 'Action Complete', availableFiles: [...files], installedPackages: [...installed] },
    };
};

export const generateRunArchive = (devices: Device[]): DeploymentRun => {
    const total = devices.length;
    const compliant = devices.filter(d => ['Success', 'Execution Complete'].includes(d.status)).length;
    const needsAction = devices.filter(d => ['Scan Complete', 'Update Complete (Reboot Pending)', 'Ready for Execution', 'Pending File'].includes(d.status)).length;
    
    const updatesNeededCounts = { bios: 0, dcu: 0, windows: 0 };
    devices.forEach(d => {
        if (d.updatesNeeded?.bios) updatesNeededCounts.bios++;
        if (d.updatesNeeded?.dcu) updatesNeededCounts.dcu++;
        if (d.updatesNeeded?.windows) updatesNeededCounts.windows++;
    });

    const failureCounts = {
        offline: devices.filter(d => d.status === 'Offline').length,
        cancelled: devices.filter(d => d.status === 'Cancelled').length,
        failed: devices.filter(d => ['Failed', 'Execution Failed'].includes(d.status)).length,
    };
    const failedTotal = failureCounts.offline + failureCounts.cancelled + failureCounts.failed;

    return {
        id: Date.now(),
        endTime: new Date(),
        totalDevices: total,
        compliant, needsAction, failed: failedTotal,
        successRate: total > 0 ? (compliant / total) * 100 : 0,
        updatesNeededCounts, failureCounts,
    };
};

export const transformImagingToRunnerDevices = (imagingDevices: ImagingDevice[]): Device[] => {
    return imagingDevices.map((d, index) => ({
        id: Date.now() + index,
        hostname: d.hostname, mac: d.macAddress, status: 'Pending File', isSelected: false,
        deviceType: detectDeviceType(d.hostname),
        ipAddress: d.ipAddress, serialNumber: d.serialNumber, model: d.model,
        availableFiles: ['CorpInstaller.msi', 'Onboarding.ps1', 'LegacyAgent.exe'],
        installedPackages: ['VPNClient.msi'],
        runningPrograms: [],
    }));
};

const runSingleComplianceCheck = async (): Promise<ComplianceResult> => {
    await sleep(2000 + Math.random() * 3000);
    const check = (desc: string, pass: boolean): ChecklistItem => ({ description: desc, expected: 'Yes', passed: pass, actual: pass ? 'Yes' : 'No' });
    
    const details: ChecklistItem[] = [
        check('Bitlocker Volume Status', Math.random() > 0.1),
        check('Citrix Workspace Installed', Math.random() > 0.1),
        check('LAPS Installed', Math.random() > 0.1),
        check('SCCM Client Installed & Running', Math.random() > 0.15),
    ];
    
    const overallStatus = details.every(item => item.passed) ? 'Passed' : 'Failed';
    return { status: overallStatus, details };
};

export const runComplianceChecks = async (devices: ImagingDevice[], onProgress: (device: ImagingDevice) => void): Promise<void> => {
    for (const device of devices) {
        onProgress({ ...device, status: 'Checking Compliance' });
        const result = await runSingleComplianceCheck();
        onProgress({ ...device, complianceCheck: result, status: 'Completed' });
    }
};

export const revalidateImagingDevices = async (devices: ImagingDevice[], onProgress: (device: ImagingDevice) => void): Promise<void> => {
     for (const device of devices) {
        onProgress({ ...device, status: 'Checking Compliance', complianceCheck: undefined });
        const result = await runSingleComplianceCheck();
        onProgress({ ...device, complianceCheck: result, status: 'Completed' });
    }
}
