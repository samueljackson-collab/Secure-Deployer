import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { StepCard } from './components/StepCard';
import { DeploymentProgress } from './components/DeploymentProgress';
import { DeviceStatusTable } from './components/DeviceStatusTable';
import { LogViewer } from './components/LogViewer';
import { BulkActions } from './components/BulkActions';
import { DeploymentHistory } from './components/DeploymentHistory';
import { SecureCredentialModal } from './components/SecureCredentialModal';
import { ImageMonitor } from './components/ImageMonitor';
import { BuildOutput } from './components/BuildOutput';
import { ImagingScriptViewer } from './components/ImagingScriptViewer';
import type { Device, LogEntry, DeploymentStatus, Credentials, DeploymentRun, ImagingDevice, DeviceFormFactor } from './types';
import { DeploymentState } from './types';
import Papa from 'papaparse';

const normalizeMacAddress = (mac: string): string => {
    if (!mac) return '';
    // Refined to also handle dot notation (e.g., 0011.2233.4455)
    return mac.replace(/[:\-.]/g, '').toUpperCase();
};

export const detectDeviceType = (hostname: string): DeviceFormFactor => {
    const upper = hostname.toUpperCase();
    // Prioritize specific models first
    if (upper.includes('PRECISION-T') || upper.includes('OPTIPLEX-T')) return 'tower';
    if (upper.includes('OPTIPLEX-SFF')) return 'sff';
    if (upper.includes('OPTIPLEX-MICRO')) return 'micro';
    if (upper.includes('LATITUDE-94')) return 'laptop-14';
    if (upper.includes('LATITUDE-76')) return 'laptop-16';
    if (upper.includes('LATITUDE-72')) return 'detachable';
    if (upper.includes('WYSE')) return 'wyse';
    if (upper.includes('VDI')) return 'vdi';
    // Broader categories
    if (upper.includes('LATITUDE') || upper.includes('PRECISION-M') || upper.includes('ELSLE') || upper.includes('ESLSC')) return 'laptop';
    // Fallback to generic desktop
    return 'desktop';
};

const TARGET_BIOS_VERSION = 'A25';
const TARGET_DCU_VERSION = '5.2.0';
const TARGET_WIN_VERSION = '23H2';


const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'monitor' | 'runner' | 'build' | 'script'>('monitor');
    // State for Deployment Runner
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [credentials, setCredentials] = useState<Credentials>({ username: '', password: '' });
    const [devices, setDevices] = useState<Device[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [deploymentState, setDeploymentState] = useState<DeploymentState>(DeploymentState.Idle);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<number>>(new Set());
    const [deploymentHistory, setDeploymentHistory] = useState<DeploymentRun[]>([]);
    const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
    const [maxRetries, setMaxRetries] = useState(3);
    const [retryDelay, setRetryDelay] = useState(2); // in seconds
    const [autoRebootEnabled, setAutoRebootEnabled] = useState(false);
    const isCancelledRef = useRef(false);

    // State for Image Monitor
    const [imagingDevices, setImagingDevices] = useState<ImagingDevice[]>([]);

    const addLog = useCallback((message: string, level: LogEntry['level'] = 'INFO') => {
        setLogs(prev => [...prev, { timestamp: new Date(), message, level }]);
    }, []);
    
    const sendNotification = (title: string, body: string) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.svg' });
        }
    };
    
    const handleRenameImagingDevice = (deviceId: string, newHostname: string) => {
        setImagingDevices(prev => prev.map(d => d.id === deviceId ? { ...d, hostname: newHostname } : d));
        addLog(`Renamed device ${deviceId} to ${newHostname} in Image Monitor.`, 'INFO');
    };

    const handleRemoveImagingDevice = (deviceId: string) => {
        setImagingDevices(prev => prev.filter(d => d.id !== deviceId));
        addLog(`Removed device ${deviceId} from Image Monitor.`, 'INFO');
    };

    const transferAllCompletedDevices = useCallback(() => {
        const completedDevices = imagingDevices.filter(d => d.status === 'Completed');
        if (completedDevices.length === 0) return;

        const newRunnerDevices: Device[] = completedDevices.map((d, index) => ({
            id: Date.now() + index, // Unique ID for the runner
            hostname: d.hostname,
            mac: d.macAddress,
            status: 'Pending File',
            isSelected: false,
            deviceType: detectDeviceType(d.hostname),
            ipAddress: d.ipAddress,
            serialNumber: d.serialNumber,
            model: d.model,
        }));
        
        setDevices(prev => [...prev, ...newRunnerDevices]);
        setImagingDevices(prev => prev.filter(d => d.status !== 'Completed'));
        setActiveTab('runner');
        addLog(`Transferred ${completedDevices.length} completed devices from Image Monitor.`, 'SUCCESS');
    }, [imagingDevices, addLog]);
    
    const transferSelectedImagingDevices = useCallback((ids: Set<string>) => {
        const devicesToTransfer = imagingDevices.filter(d => ids.has(d.id) && d.status === 'Completed');
        if (devicesToTransfer.length === 0) {
            addLog(`No completed devices were selected for transfer.`, 'WARNING');
            return;
        }

        const newRunnerDevices: Device[] = devicesToTransfer.map((d, index) => ({
            id: Date.now() + index,
            hostname: d.hostname,
            mac: d.macAddress,
            status: 'Pending File',
            deviceType: detectDeviceType(d.hostname),
            ipAddress: d.ipAddress,
            serialNumber: d.serialNumber,
            model: d.model,
        }));
        
        setDevices(prev => [...prev, ...newRunnerDevices]);
        setImagingDevices(prev => prev.filter(d => !ids.has(d.id)));
        setActiveTab('runner');
        addLog(`Transferred ${devicesToTransfer.length} selected devices from Image Monitor.`, 'SUCCESS');
    }, [imagingDevices, addLog]);

    const clearSelectedImagingDevices = useCallback((ids: Set<string>) => {
        setImagingDevices(prev => prev.filter(d => !ids.has(d.id)));
        addLog(`Cleared ${ids.size} selected devices from Image Monitor.`, 'INFO');
    }, []);

    useEffect(() => {
      if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }, []);

    const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setter(e.target.files[0]);
        }
    };
    
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const archiveCurrentRun = (currentDevices: Device[]) => {
        if (currentDevices.length === 0) return;

        const total = currentDevices.length;
        const compliant = currentDevices.filter(d => ['Success', 'Execution Complete'].includes(d.status)).length;
        const needsAction = currentDevices.filter(d => ['Scan Complete', 'Update Complete (Reboot Pending)', 'Ready for Execution', 'Pending File'].includes(d.status)).length;
        const successRate = total > 0 ? (compliant / total) * 100 : 0;

        const updatesNeededCounts = { bios: 0, dcu: 0, windows: 0 };
        currentDevices.forEach(d => {
            if (d.updatesNeeded?.bios) updatesNeededCounts.bios++;
            if (d.updatesNeeded?.dcu) updatesNeededCounts.dcu++;
            if (d.updatesNeeded?.windows) updatesNeededCounts.windows++;
        });

        const failureCounts = {
            offline: currentDevices.filter(d => d.status === 'Offline').length,
            cancelled: currentDevices.filter(d => d.status === 'Cancelled').length,
            failed: currentDevices.filter(d => ['Failed', 'Execution Failed'].includes(d.status)).length,
        };
        const failedTotal = failureCounts.offline + failureCounts.cancelled + failureCounts.failed;

        const newRun: DeploymentRun = {
            id: Date.now(),
            endTime: new Date(),
            totalDevices: total,
            compliant,
            needsAction,
            failed: failedTotal,
            successRate,
            updatesNeededCounts,
            failureCounts,
        };
        setDeploymentHistory(prev => [newRun, ...prev].slice(0, 10));
    };

    const handleConfirmCredentialsAndDeploy = async (sessionCredentials: Credentials) => {
        setIsCredentialModalOpen(false);
        if (!csvFile && devices.length === 0) {
            addLog("No devices loaded. Either upload a CSV or transfer from Image Monitor.", 'ERROR');
            return;
        }

        isCancelledRef.current = false;
        setCredentials(sessionCredentials);
        setDeploymentState(DeploymentState.Running);
        setLogs([]);
        setSelectedDeviceIds(new Set());
        addLog("Deployment process initiated.", 'INFO');
        addLog(`User: ${sessionCredentials.username}`, 'INFO');
        
        if (devices.length > 0 && !csvFile) { // Devices were transferred
             await runDeploymentFlow(devices.filter(d => d.status !== 'Pending File')); // Only run scan on non-transferred devices
        } else if(csvFile) { // Devices from CSV
            try {
                Papa.parse<Record<string, string>>(csvFile, {
                    header: true,
                    skipEmptyLines: true,
                    complete: async (results) => {
                        if (results.errors.length > 0) {
                            addLog(`CSV parsing errors: ${JSON.stringify(results.errors)}`, 'ERROR');
                            setDeploymentState(DeploymentState.Idle); return;
                        }
                        const header = results.meta.fields;
                        if (!header) {
                            addLog('Could not detect header row in CSV.', 'ERROR'); setDeploymentState(DeploymentState.Idle); return;
                        }
                        const hostnameCol = header.find(h => h.toLowerCase().includes('hostname'));
                        const macCol = header.find(h => h.toLowerCase().includes('mac'));
                        if (!hostnameCol || !macCol) {
                             addLog("CSV must contain 'Hostname' and 'MAC' columns.", 'ERROR'); setDeploymentState(DeploymentState.Idle); return;
                        }

                        const parsedDevices: Device[] = [];
                        let invalidMacCount = 0;
                        let skippedHostnameCount = 0;
                        results.data.forEach((row, index) => {
                            const hostname = (row[hostnameCol] || '').trim();
                            const rawMac = row[macCol] || '';
                            
                            if (!hostname) { 
                                addLog(`[Validation Skip] Skipping row ${index + 2}. Reason: Missing hostname.`, 'WARNING');
                                skippedHostnameCount++;
                                return; 
                            }

                            const normalizedMac = normalizeMacAddress(rawMac);
                            let macValidationError = '';
                            if (!normalizedMac) {
                                macValidationError = 'MAC address is missing or empty.';
                            } else if (normalizedMac.length !== 12) {
                                macValidationError = `Invalid length. MAC address must be 12 hexadecimal characters (e.g., AABBCCDD1122). Received ${normalizedMac.length} chars after normalization.`;
                            } else if (!/^[0-9A-F]{12}$/.test(normalizedMac)) {
                                macValidationError = `Invalid characters. MAC address can only contain numbers (0-9) and letters (A-F).`;
                            }

                            if (macValidationError) {
                                addLog(`[Validation Skip] Skipping device "${hostname}" from row ${index + 2}. Reason: ${macValidationError} Received: "${rawMac}".`, 'WARNING');
                                invalidMacCount++;
                                return;
                            }
                            
                            const deviceType = detectDeviceType(hostname);

                            parsedDevices.push({
                                id: index,
                                hostname: hostname,
                                mac: normalizedMac,
                                status: 'Pending',
                                isSelected: false,
                                deviceType,
                            });
                        });

                        if (skippedHostnameCount > 0) {
                            addLog(`Skipped ${skippedHostnameCount} row${skippedHostnameCount > 1 ? 's' : ''} due to missing hostname. See logs for details.`, 'INFO');
                        }
                        if (invalidMacCount > 0) {
                            addLog(`Skipped ${invalidMacCount} device${invalidMacCount > 1 ? 's' : ''} due to invalid MAC addresses. See logs for details.`, 'INFO');
                        }

                        if (parsedDevices.length === 0) {
                            addLog('No valid devices found in the CSV file to process.', 'ERROR');
                            setDeploymentState(DeploymentState.Idle);
                            return;
                        }
                        
                        setDevices(parsedDevices);
                        addLog(`Validated and loaded ${parsedDevices.length} devices from ${csvFile.name}.`, 'INFO');
                        await runDeploymentFlow(parsedDevices);
                    }
                });
            } catch (error) {
                addLog(`Failed to parse CSV: ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
                setDeploymentState(DeploymentState.Idle);
            }
        }
    };

    const handleStartDeployment = () => {
        if (!csvFile && devices.length === 0) {
            addLog("Please select a device list or transfer devices from the monitor.", 'ERROR');
            return;
        }
        setIsCredentialModalOpen(true);
    };
    
    const runDeploymentFlow = async (parsedDevices: Device[]) => {
        if(isCancelledRef.current) return;
        addLog("Sending Wake-on-LAN packets...", 'INFO');
        setDevices(prev => prev.map(d => ({ ...d, status: 'Waking Up' })));
        await sleep(2000); 

        const wolWaitSeconds = 30; 
        addLog(`Waiting ${wolWaitSeconds} seconds for devices to boot...`, 'INFO');
        await sleep(wolWaitSeconds * 1000);

        addLog("Starting system scan on individual devices...", 'INFO');
        for (const device of parsedDevices) {
            if (isCancelledRef.current) { addLog('Deployment cancelled.', 'WARNING'); break; }

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Connecting' } : d));
            
            let isConnected = false;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                if (isCancelledRef.current) break;
                await sleep(1000 + Math.random() * 500);
                if (Math.random() > 0.3) { isConnected = true; break; } 
                else if (attempt < maxRetries) {
                    addLog(`[${device.hostname}] Connection failed. Retrying... (Attempt ${attempt} of ${maxRetries}). Waiting ${retryDelay} seconds.`, 'WARNING');
                    setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Retrying...', retryAttempt: attempt } : d));
                    await sleep(retryDelay * 1000);
                }
            }

            if (!isConnected) {
                setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Offline' } : d));
                addLog(`Host ${device.hostname} is not responding after ${maxRetries} attempts.`, 'ERROR'); continue;
            }

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking Info' } : d));
            await sleep(500 + Math.random() * 500);
            const encryptionStatus = Math.random() > 0.2 ? 'Enabled' : 'Disabled';
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, encryptionStatus } : d));
            
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking BIOS' } : d));
            await sleep(1000 + Math.random() * 1500); 
            const biosVersion = Math.random() > 0.3 ? TARGET_BIOS_VERSION : `A${Math.floor(18 + Math.random() * 6)}`;
            const isBiosUpToDate = biosVersion === TARGET_BIOS_VERSION;
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, biosVersion, isBiosUpToDate } : d));

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking DCU' } : d));
            await sleep(1000 + Math.random() * 1000); 
            const dcuVersion = Math.random() > 0.3 ? TARGET_DCU_VERSION : `5.${Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 9)}`;
            const isDcuUpToDate = dcuVersion === TARGET_DCU_VERSION;
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, dcuVersion, isDcuUpToDate } : d));

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking Windows' } : d));
            await sleep(1500 + Math.random() * 2000); 
            const winVersion = Math.random() > 0.3 ? TARGET_WIN_VERSION : ['22H2', '21H2'][Math.floor(Math.random()*2)];
            const isWinUpToDate = winVersion === TARGET_WIN_VERSION;
            
            const allUpToDate = isBiosUpToDate && isDcuUpToDate && isWinUpToDate;
            const updatesNeeded = { bios: !isBiosUpToDate, dcu: !isDcuUpToDate, windows: !isWinUpToDate };

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, winVersion, isWinUpToDate, updatesNeeded, status: allUpToDate ? 'Success' : 'Scan Complete' } : d));
            addLog(`Scan complete for ${device.hostname}.`, allUpToDate ? 'SUCCESS' : 'INFO');
        }

        if (!isCancelledRef.current) {
             addLog("Deployment scan complete.", 'INFO'); sendNotification('Deployment Complete', `Scan finished.`);
             setDeploymentState(DeploymentState.Complete);
        }
        setDevices(currentDevices => { archiveCurrentRun(currentDevices); return currentDevices; });
    };

    const handleUpdateDevice = async (deviceId: number) => {
        const device = devices.find(d => d.id === deviceId); if (!device) return;
        addLog(`Initiating updates for ${device.hostname}...`, 'INFO');
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Updating', lastUpdateResult: undefined } : d));
        await sleep(1000);
        let needsReboot = false; const succeeded: string[] = []; const failed: string[] = [];
        
        const componentsToUpdate = [
            { name: 'BIOS', needsUpdate: device.isBiosUpToDate === false, targetVersion: TARGET_BIOS_VERSION, requiresReboot: true },
            { name: 'DCU', needsUpdate: device.isDcuUpToDate === false, targetVersion: TARGET_DCU_VERSION, requiresReboot: false },
            { name: 'Windows', needsUpdate: device.isWinUpToDate === false, targetVersion: TARGET_WIN_VERSION, requiresReboot: false },
        ] as const;

        for (const comp of componentsToUpdate) {
            if (isCancelledRef.current || !comp.needsUpdate) continue;
            
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: `Updating ${comp.name}` } : d));
            addLog(`[${device.hostname}] Phase: ${comp.name} Update. Status: Starting.`, 'INFO');
            await sleep(2000 + Math.random() * 1000);
            if (isCancelledRef.current) break;

            const updateSucceeded = Math.random() > 0.15;
            if (updateSucceeded) {
                succeeded.push(comp.name);
                if (comp.requiresReboot) needsReboot = true;
                addLog(`[${device.hostname}] Phase: ${comp.name} Update. Status: Complete.`, 'SUCCESS');
            } else {
                failed.push(comp.name);
                addLog(`[${device.hostname}] Phase: ${comp.name} Update. Status: FAILED.`, 'ERROR');
                break; 
            }
        }

        if (isCancelledRef.current) return;

        const finalUpdateResult = { succeeded, failed };
        if (failed.length > 0) {
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Failed', lastUpdateResult: finalUpdateResult } : d));
        } else if (succeeded.length > 0) {
            if (needsReboot) {
                setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Update Complete (Reboot Pending)', lastUpdateResult: finalUpdateResult } : d));
                if (autoRebootEnabled) {
                    addLog(`[${device.hostname}] Auto-reboot enabled. Initiating reboot...`, 'INFO');
                    await handleRebootDevice(deviceId);
                }
            } else {
                setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Success', lastUpdateResult: finalUpdateResult } : d));
            }
        } else {
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Success' } : d));
        }
    };
    
    const handleRebootDevice = async (deviceId: number) => {
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Rebooting...' } : d));
        await sleep(8000 + Math.random() * 4000);
        if (isCancelledRef.current) return;
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Success' } : d));
        addLog(`[${devices.find(d=>d.id===deviceId)?.hostname}] Reboot complete.`, 'SUCCESS');
    };

    const handleCancelDeployment = () => {
        isCancelledRef.current = true; setDeploymentState(DeploymentState.Idle);
        const cancellableStatuses: DeploymentStatus[] = ['Connecting', 'Retrying...', 'Updating', 'Waking Up', 'Checking Info', 'Checking BIOS', 'Checking DCU', 'Checking Windows', 'Updating BIOS', 'Updating DCU', 'Updating Windows', 'Rebooting...', 'Executing Script'];
        setDevices(prev => {
            const updated = prev.map((d): Device => cancellableStatuses.includes(d.status) ? { ...d, status: 'Cancelled' } : d);
            archiveCurrentRun(updated); return updated;
        });
        addLog('Deployment cancelled by user.', 'WARNING'); sendNotification('Deployment Cancelled', 'The process was stopped.');
    };

    const handleWakeOnLan = (deviceIds: Set<number>) => {
        if (deviceIds.size === 0) return; const hostnames: string[] = [];
        setDevices(prev => prev.map(d => { if (deviceIds.has(d.id)) { hostnames.push(d.hostname); return { ...d, status: 'Waking Up' }; } return d; }));
        addLog(`Sent Wake-on-LAN to ${deviceIds.size} device(s).`, 'INFO'); setSelectedDeviceIds(new Set());
    };

    const handleDeviceSelection = (deviceId: number) => {
        setSelectedDeviceIds(prev => { const newSet = new Set(prev); if (newSet.has(deviceId)) newSet.delete(deviceId); else newSet.add(deviceId); return newSet; });
    };

    const handleSelectAll = (select: boolean) => {
        setSelectedDeviceIds(select ? new Set(devices.map(d => d.id)) : new Set());
    };

    const handleBulkUpdate = async () => {
        addLog(`Initiating bulk update for ${selectedDeviceIds.size} devices...`, 'INFO');
        await Promise.all([...selectedDeviceIds].map(id => handleUpdateDevice(id)));
        addLog('Bulk update complete.', 'SUCCESS'); setSelectedDeviceIds(new Set()); 
    };

    const handleBulkCancel = () => {
        addLog(`Cancelling tasks for ${selectedDeviceIds.size} devices...`, 'WARNING');
        const cancellableStatuses: DeploymentStatus[] = ['Connecting', 'Retrying...', 'Updating', 'Waking Up', 'Checking Info', 'Checking BIOS', 'Checking DCU', 'Checking Windows', 'Updating BIOS', 'Updating DCU', 'Updating Windows', 'Executing Script'];
        setDevices(prev => prev.map((d): Device => selectedDeviceIds.has(d.id) && cancellableStatuses.includes(d.status) ? { ...d, status: 'Cancelled' } : d));
        setSelectedDeviceIds(new Set());
    };

    const handleValidateDevices = async (deviceIdsToValidate: Set<number>) => {
        addLog(`Initiating manual validation for ${deviceIdsToValidate.size} device(s)...`, 'INFO');
        setDevices(prev => prev.map(d => deviceIdsToValidate.has(d.id) ? { ...d, status: 'Validating' } : d));
    
        const devicesToValidate = devices.filter(d => deviceIdsToValidate.has(d.id));
    
        for (const device of devicesToValidate) {
            if (isCancelledRef.current) break;
            await sleep(1000 + Math.random() * 500);
            const isConnected = Math.random() > 0.2;
    
            if (!isConnected) {
                setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Offline' } : d));
                addLog(`[${device.hostname}] Validation failed: Host is not responding.`, 'ERROR');
                continue;
            }
    
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking BIOS' } : d));
            await sleep(1000 + Math.random() * 1500); 
            const biosVersion = Math.random() > 0.3 ? TARGET_BIOS_VERSION : `A${Math.floor(18 + Math.random() * 6)}`;
            const isBiosUpToDate = biosVersion === TARGET_BIOS_VERSION;
    
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking DCU', biosVersion, isBiosUpToDate } : d));
            await sleep(1000 + Math.random() * 1000); 
            const dcuVersion = Math.random() > 0.3 ? TARGET_DCU_VERSION : `5.${Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 9)}`;
            const isDcuUpToDate = dcuVersion === TARGET_DCU_VERSION;
    
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking Windows', dcuVersion, isDcuUpToDate } : d));
            await sleep(1500 + Math.random() * 2000); 
            const winVersion = Math.random() > 0.3 ? TARGET_WIN_VERSION : ['22H2', '21H2'][Math.floor(Math.random()*2)];
            const isWinUpToDate = winVersion === TARGET_WIN_VERSION;
            
            const allUpToDate = isBiosUpToDate && isDcuUpToDate && isWinUpToDate;
            const updatesNeeded = { bios: !isBiosUpToDate, dcu: !isDcuUpToDate, windows: !isWinUpToDate };
    
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, winVersion, isWinUpToDate, updatesNeeded, status: allUpToDate ? 'Success' : 'Scan Complete' } : d));
            addLog(`Validation complete for ${device.hostname}.`, allUpToDate ? 'SUCCESS' : 'INFO');
        }
        
        setSelectedDeviceIds(new Set());
        addLog('Manual validation scan complete.', 'INFO');
    };

    const handleValidateSingleDevice = (deviceId: number) => {
        handleValidateDevices(new Set([deviceId]));
    };
    
    const handleBulkValidate = () => {
        handleValidateDevices(selectedDeviceIds);
    };
    
    const handleSetScriptFile = (deviceId: number, file: File) => {
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, scriptFile: file, status: 'Ready for Execution' } : d));
        const device = devices.find(d => d.id === deviceId);
        if (device) {
            addLog(`Script "${file.name}" selected for ${device.hostname}.`, 'INFO');
        }
    };

    const handleExecuteScript = async (deviceId: number) => {
        const device = devices.find(d => d.id === deviceId);
        if (!device || !device.scriptFile) return;
        
        addLog(`Executing script "${device.scriptFile.name}" on ${device.hostname}...`, 'INFO');
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Executing Script' } : d));

        await sleep(5000 + Math.random() * 5000); // Simulate script execution time

        if (isCancelledRef.current) return;
        
        const executionSucceeded = Math.random() > 0.2;
        if (executionSucceeded) {
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Execution Complete' } : d));
            addLog(`Script execution succeeded on ${device.hostname}.`, 'SUCCESS');
        } else {
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Execution Failed' } : d));
            addLog(`Script execution failed on ${device.hostname}.`, 'ERROR');
        }
    };
    
    const handleBulkExecute = () => {
        const devicesToExecute = devices.filter(d => selectedDeviceIds.has(d.id) && d.status === 'Ready for Execution');
        if (devicesToExecute.length === 0) {
            addLog('No selected devices are ready for execution.', 'WARNING');
            return;
        }
        addLog(`Initiating bulk execution for ${devicesToExecute.length} devices...`, 'INFO');
        devicesToExecute.forEach(d => handleExecuteScript(d.id));
        setSelectedDeviceIds(new Set());
    };

    const handleBulkRemove = () => {
        if (selectedDeviceIds.size === 0) return;
        addLog(`Removing ${selectedDeviceIds.size} selected device(s) from the runner.`, 'WARNING');
        setDevices(prev => prev.filter(d => !selectedDeviceIds.has(d.id)));
        setSelectedDeviceIds(new Set());
    };


    const isReadyToDeploy = csvFile || devices.length > 0;

    const TabButton: React.FC<{tabName: 'monitor' | 'runner' | 'build' | 'script', label: string, icon: React.ReactNode}> = ({ tabName, label, icon }) => (
      <button
        onClick={() => setActiveTab(tabName)}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-colors duration-200 ${
          activeTab === tabName
            ? 'border-[#39FF14] text-[#39FF14]'
            : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
        }`}
      >
        {icon}
        {label}
      </button>
    );

    return (
        <div className="min-h-screen bg-black text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <Header selectedDeviceIds={selectedDeviceIds} onWakeOnLan={handleWakeOnLan} />
            <div className="mt-6">
                <div className="flex border-b border-gray-800 flex-wrap">
                    <TabButton tabName="monitor" label="Image Monitor" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>} />
                    <TabButton tabName="runner" label="Deployment Runner" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" /></svg>} />
                    <TabButton tabName="script" label="Imaging Script" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>} />
                    <TabButton tabName="build" label="Build Output" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v1H5V4zM5 7h10v9a2 2 0 01-2 2H7a2 2 0 01-2-2V7z" /><path d="M10 11a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z" /></svg>} />
                </div>
            </div>

            <main className="mt-8">
                {activeTab === 'monitor' && (
                    <ImageMonitor 
                        devices={imagingDevices}
                        history={deploymentHistory}
                        onTransferAllCompleted={transferAllCompletedDevices}
                        onTransferSelected={transferSelectedImagingDevices}
                        onClearSelected={clearSelectedImagingDevices}
                        onRenameDevice={handleRenameImagingDevice}
                        onRemoveDevice={handleRemoveImagingDevice}
                    />
                )}
                {activeTab === 'runner' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 flex flex-col gap-8">
                            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800">
                                <h2 className="text-xl font-bold text-[#39FF14] mb-4 border-b border-gray-700 pb-2">Configuration</h2>
                                <div className="space-y-6">
                                    <StepCard step="1" title="Select Device List" description="Upload CSV for scanning or use transferred devices.">
                                        <input type="file" accept=".csv" onChange={handleFileChange(setCsvFile)} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-[#39FF14] hover:file:bg-gray-700 w-full text-sm text-gray-400 font-bold"/>
                                        {csvFile && <p className="text-xs text-[#39FF14] mt-2">Selected: {csvFile.name}</p>}
                                        {devices.length > 0 && <p className="text-xs text-gray-400 font-bold mt-2">{devices.filter(d => d.status === 'Pending File' || d.status === 'Ready for Execution').length} device(s) ready for deployment.</p>}
                                    </StepCard>
                                    <StepCard step="2" title="Advanced Settings" description="Configure connection and reboot behavior.">
                                        <div className="space-y-3 pt-2">
                                             <div className="flex items-center justify-between">
                                                <label htmlFor="maxRetries" className="text-sm text-gray-300 font-bold">Max Retries</label>
                                                <input 
                                                    type="number" 
                                                    id="maxRetries" 
                                                    value={maxRetries}
                                                    onChange={(e) => setMaxRetries(Math.max(1, parseInt(e.target.value, 10)))}
                                                    className="w-20 bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-center"
                                                />
                                            </div>
                                             <div className="flex items-center justify-between">
                                                <label htmlFor="retryDelay" className="text-sm text-gray-300 font-bold">Retry Delay (sec)</label>
                                                <input 
                                                    type="number" 
                                                    id="retryDelay"
                                                    value={retryDelay}
                                                    onChange={(e) => setRetryDelay(Math.max(1, parseInt(e.target.value, 10)))}
                                                    className="w-20 bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-center"
                                                />
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    id="autoReboot"
                                                    type="checkbox"
                                                    checked={autoRebootEnabled}
                                                    onChange={(e) => setAutoRebootEnabled(e.target.checked)}
                                                    className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-2 focus:ring-[#39FF14] focus:ring-offset-2 focus:ring-offset-gray-950 cursor-pointer"
                                                />
                                                <label htmlFor="autoReboot" className="ml-3 text-sm text-gray-300 cursor-pointer font-bold">
                                                    Automatically reboot when required
                                                </label>
                                            </div>
                                        </div>
                                    </StepCard>
                                </div>
                            </div>
                             <DeploymentHistory history={deploymentHistory} />
                        </div>
                        <div className="lg:col-span-2 flex flex-col gap-8">
                            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-[#39FF14]">Deployment Status</h2>
                                    {deploymentState === DeploymentState.Running ? <button onClick={handleCancelDeployment} className="px-4 py-2 bg-red-600 rounded-lg">Cancel</button> : <button onClick={handleStartDeployment} disabled={!isReadyToDeploy} className="px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg disabled:bg-gray-700">Start Scan</button>}
                                </div>
                                <DeploymentProgress devices={devices} />
                            </div>
                            <BulkActions selectedCount={selectedDeviceIds.size} onUpdate={handleBulkUpdate} onCancel={handleBulkCancel} onValidate={handleBulkValidate} onExecute={handleBulkExecute} onRemove={handleBulkRemove} />
                            <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 flex-grow min-h-[400px] flex flex-col">
                                <h2 className="text-xl font-bold text-[#39FF14] mb-4 border-b border-gray-700 pb-2">Live Logs & Device Status</h2>
                                <div className="grid xl:grid-cols-2 gap-6 flex-grow min-h-0">
                                     <DeviceStatusTable devices={devices} onUpdateDevice={handleUpdateDevice} onRebootDevice={handleRebootDevice} onValidateDevice={handleValidateSingleDevice} onSetScriptFile={handleSetScriptFile} onExecuteScript={handleExecuteScript} selectedDeviceIds={selectedDeviceIds} onDeviceSelect={handleDeviceSelection} onSelectAll={handleSelectAll} />
                                     <LogViewer logs={logs} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'build' && (
                    <BuildOutput />
                )}
                {activeTab === 'script' && (
                    <ImagingScriptViewer />
                )}
            </main>
            <SecureCredentialModal 
                isOpen={isCredentialModalOpen} 
                onClose={() => setIsCredentialModalOpen(false)} 
                onConfirm={handleConfirmCredentialsAndDeploy}
            />
        </div>
    );
};
export default App;
