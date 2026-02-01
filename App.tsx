

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { StepCard } from './components/StepCard';
import { DeploymentProgress } from './components/DeploymentProgress';
import { DeviceStatusTable } from './components/DeviceStatusTable';
import { LogViewer } from './components/LogViewer';
import { BulkActions } from './components/BulkActions';
import { DeploymentHistory } from './components/DeploymentHistory';
import { SecureCredentialModal } from './components/SecureCredentialModal';
import type { Device, LogEntry, DeploymentStatus, Credentials, DeploymentRun } from './types';
import { DeploymentState } from './types';
import Papa from 'papaparse';

const normalizeMacAddress = (mac: string): string => {
    if (!mac) return '';
    return mac.replace(/[:-]/g, '').toUpperCase();
};

const isValidMacAddress = (mac: string): boolean => {
    // After normalization, a valid MAC address is 12 hexadecimal characters.
    return /^[0-9A-F]{12}$/.test(mac);
};

const detectDeviceType = (hostname: string): 'laptop' | 'desktop' => {
    const upperHostname = hostname.toUpperCase();
    
    // ELS Enterprise Laptop Standard (ELSLE) or ESLSC
    if (upperHostname.includes('ELSLE') || upperHostname.includes('ESLSC')) {
        return 'laptop';
    }

    // Default to desktop if no specific laptop identifier is found.
    // EWSLE (Enterprise Workstation Standard) would fall into this category.
    return 'desktop';
};

const TARGET_BIOS_VERSION = 'A25';
const TARGET_DCU_VERSION = '5.2.0';
const TARGET_WIN_VERSION = '23H2';

const App: React.FC = () => {
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [batchFile, setBatchFile] = useState<File | null>(null);
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

    useEffect(() => {
      if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }, []);

    const sendNotification = (title: string, body: string) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.svg' });
        }
    };

    const addLog = useCallback((message: string, level: LogEntry['level'] = 'INFO') => {
        setLogs(prev => [...prev, { timestamp: new Date(), message, level }]);
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
        const compliant = currentDevices.filter(d => d.status === 'Success').length;
        const needsAction = currentDevices.filter(d => ['Scan Complete', 'Update Complete (Reboot Pending)'].includes(d.status)).length;
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
            failed: currentDevices.filter(d => d.status === 'Failed').length,
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
        setDeploymentHistory(prev => [newRun, ...prev].slice(0, 10)); // Keep last 10 runs
    };

    const handleConfirmCredentialsAndDeploy = async (sessionCredentials: Credentials) => {
        setIsCredentialModalOpen(false);
        if (!csvFile || !batchFile) {
            addLog("CSV or Batch file is missing.", 'ERROR');
            return;
        }

        isCancelledRef.current = false;
        setCredentials(sessionCredentials); // Set credentials for the run
        setDeploymentState(DeploymentState.Running);
        setLogs([]);
        setSelectedDeviceIds(new Set());
        addLog("Deployment process initiated.", 'INFO');
        addLog(`User: ${sessionCredentials.username}`, 'INFO');

        try {
            Papa.parse<Record<string, string>>(csvFile, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    if (results.errors.length > 0) {
                        const errorMsg = `CSV parsing errors: ${JSON.stringify(results.errors)}`;
                        addLog(errorMsg, 'ERROR');
                        sendNotification('Critical Error', 'Failed to parse device list CSV.');
                        setDeploymentState(DeploymentState.Idle);
                        return;
                    }
                    
                    const header = results.meta.fields;
                    if (!header) {
                         addLog('Could not detect header row in CSV.', 'ERROR');
                         sendNotification('Critical Error', 'Could not detect header in CSV.');
                         setDeploymentState(DeploymentState.Idle);
                         return;
                    }

                    const hostnameCol = header.find(h => h.toLowerCase().includes('hostname') || h.toLowerCase().includes('computername') || h.toLowerCase().includes('devicename') || h.toLowerCase().includes('computer') || h.toLowerCase().includes('name') || h.toLowerCase().includes('device'));
                    const macCol = header.find(h => h.toLowerCase().replace(/[\s_-]/g, '').includes('macaddress') || h.toLowerCase().trim() === 'mac');

                    if (!hostnameCol || !macCol) {
                        addLog("CSV must contain columns for 'Hostname' and 'MAC Address'.", 'ERROR');
                        sendNotification('Critical Error', 'CSV is missing required columns.');
                        setDeploymentState(DeploymentState.Idle);
                        return;
                    }

                    const parsedDevices: Device[] = [];
                    let invalidCount = 0;
                    results.data.forEach((row, index) => {
                        const hostname = (row[hostnameCol] || '').trim();
                        const rawMac = row[macCol] || '';
                        
                        if (!hostname && !rawMac) {
                            return;
                        }

                        const normalizedMac = normalizeMacAddress(rawMac);

                        if (!hostname) {
                            addLog(`Skipping row ${index + 2}: Hostname is empty.`, 'WARNING');
                            invalidCount++;
                            return;
                        }

                        if (!isValidMacAddress(normalizedMac)) {
                            addLog(`[Validation Skip] Skipping device "${hostname}" from row ${index + 2}. Reason: Invalid MAC address format. Received: "${rawMac}".`, 'WARNING');
                            invalidCount++;
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

                    if (invalidCount > 0) {
                        addLog(`Skipped ${invalidCount} invalid or incomplete entr${invalidCount > 1 ? 'ies' : 'y'} from CSV. See logs for details.`, 'INFO');
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
            const errorMsg = `Failed to parse CSV: ${error instanceof Error ? error.message : String(error)}`;
            addLog(errorMsg, 'ERROR');
            sendNotification('Critical Error', errorMsg);
            setDeploymentState(DeploymentState.Idle);
        }
    };

    const handleStartDeployment = () => {
        if (!csvFile || !batchFile) {
            addLog("Please select a device list and deployment package first.", 'ERROR');
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
        for (let i = wolWaitSeconds; i > 0; i -= 5) {
            if (isCancelledRef.current) {
                addLog('Deployment cancelled by user during WoL wait.', 'WARNING');
                setDeploymentState(DeploymentState.Idle);
                setDevices(currentDevices => {
                    archiveCurrentRun(currentDevices);
                    return currentDevices;
                });
                return;
            }
            await sleep(2500);
        }

        addLog("Starting system scan on individual devices...", 'INFO');
        for (const device of parsedDevices) {
            if (isCancelledRef.current) {
                addLog('Deployment cancelled by user.', 'WARNING');
                setDeploymentState(DeploymentState.Idle);
                break;
            }

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Connecting' } : d));
            
            let isConnected = false;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                 if (isCancelledRef.current) break;

                await sleep(1000 + Math.random() * 500);
                if (Math.random() > 0.3) {
                    isConnected = true;
                    if(attempt > 1) {
                        addLog(`Successfully connected to ${device.hostname} on attempt ${attempt}.`, 'SUCCESS');
                    }
                    break;
                } else {
                    if (attempt < maxRetries) {
                        addLog(`[${device.hostname}] Connection failed. Retrying... (Attempt ${attempt} of ${maxRetries})`, 'WARNING');
                        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Retrying...', retryAttempt: attempt } : d));
                        await sleep(retryDelay * 1000);
                    }
                }
            }

            if (!isConnected) {
                setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Offline' } : d));
                addLog(`Host ${device.hostname} is not responding after ${maxRetries} attempts.`, 'ERROR');
                continue;
            }

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking Info' } : d));
            addLog(`Gathering metadata for ${device.hostname}...`);
            await sleep(1500 + Math.random() * 1000);

            // Simulate gathering detailed metadata
            const ipAddress = `10.1.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
            const serialNumber = Math.random().toString(36).substring(2, 9).toUpperCase();
            const model = device.deviceType === 'laptop'
                ? ['Latitude 7420', 'Latitude 5430', 'Precision 5560'][Math.floor(Math.random() * 3)]
                : ['OptiPlex 7090', 'OptiPlex 5000', 'Precision 3650'][Math.floor(Math.random() * 3)];
            const ramAmount = [8, 16, 32, 64][Math.floor(Math.random() * 4)];
            const diskTotal = [256, 512, 1024][Math.floor(Math.random() * 3)];
            const diskFree = Math.floor(diskTotal * (0.1 + Math.random() * 0.8));
            const encryptionStatus = Math.random() > 0.2 ? 'Enabled' : 'Disabled';

            const newMetadata = {
                ipAddress,
                serialNumber,
                model,
                ramAmount,
                diskSpace: { total: diskTotal, free: diskFree },
                encryptionStatus,
            };

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, ...newMetadata } : d));
            addLog(`[${device.hostname}] IP: ${ipAddress}, Model: ${model}, SN: ${serialNumber}`);
            addLog(`[${device.hostname}] RAM: ${ramAmount}GB, Disk: ${diskFree}GB/${diskTotal}GB Free, Encryption: ${encryptionStatus}`);

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking BIOS' } : d));
            await sleep(1500 + Math.random() * 1000);
            const biosVersion = Math.random() > 0.3 ? TARGET_BIOS_VERSION : `A${Math.floor(18 + Math.random() * 6)}`;
            const isBiosUpToDate = biosVersion === TARGET_BIOS_VERSION;
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, biosVersion, isBiosUpToDate } : d));
            addLog(`[${device.hostname}] BIOS Version: ${biosVersion}`);

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking DCU' } : d));
            await sleep(1200 + Math.random() * 800);
            const dcuVersion = Math.random() > 0.3 ? TARGET_DCU_VERSION : `5.${Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 9)}`;
            const isDcuUpToDate = dcuVersion === TARGET_DCU_VERSION;
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, dcuVersion, isDcuUpToDate } : d));
            addLog(`[${device.hostname}] DCU Version: ${dcuVersion}`);

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking Windows' } : d));
            await sleep(1800 + Math.random() * 1200);
            const winVersion = Math.random() > 0.3 ? TARGET_WIN_VERSION : ['22H2', '21H2'][Math.floor(Math.random()*2)];
            const isWinUpToDate = winVersion === TARGET_WIN_VERSION;
            
            const allUpToDate = isBiosUpToDate && isDcuUpToDate && isWinUpToDate;
            const updatesNeeded = {
                bios: !isBiosUpToDate,
                dcu: !isDcuUpToDate,
                windows: !isWinUpToDate,
            };

            setDevices(prev => prev.map(d => d.id === device.id ? {
                ...d,
                winVersion,
                isWinUpToDate,
                updatesNeeded,
                status: allUpToDate ? 'Success' : 'Scan Complete',
            } : d));
             addLog(`[${device.hostname}] Windows Version: ${winVersion}`);
            addLog(`Scan complete for ${device.hostname}.`, allUpToDate ? 'SUCCESS' : 'INFO');
        }

        if (!isCancelledRef.current) {
             addLog("Deployment scan process complete.", 'INFO');
             sendNotification('Deployment Complete', `Scan finished for ${parsedDevices.length} devices.`);
             setDeploymentState(DeploymentState.Complete);
        }
        
        // Archive the final state of devices for history
        setDevices(currentDevices => {
            archiveCurrentRun(currentDevices);
            return currentDevices;
        });
    };

    const handleUpdateDevice = async (deviceId: number) => {
        const device = devices.find(d => d.id === deviceId);
        if (!device) return;
    
        addLog(`Initiating updates for ${device.hostname}...`, 'INFO');
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Updating', lastUpdateResult: undefined } : d));
        await sleep(1000);
    
        let needsReboot = false;
        const succeeded: string[] = [];
        const failed: string[] = [];
    
        const componentsToUpdate = [
            { name: 'BIOS', key: 'bios', versionKey: 'biosVersion', isUpToDateKey: 'isBiosUpToDate', needsUpdate: device.isBiosUpToDate === false, currentVersion: device.biosVersion, targetVersion: TARGET_BIOS_VERSION, requiresReboot: true },
            { name: 'DCU', key: 'dcu', versionKey: 'dcuVersion', isUpToDateKey: 'isDcuUpToDate', needsUpdate: device.isDcuUpToDate === false, currentVersion: device.dcuVersion, targetVersion: TARGET_DCU_VERSION, requiresReboot: false },
            { name: 'Windows', key: 'windows', versionKey: 'winVersion', isUpToDateKey: 'isWinUpToDate', needsUpdate: device.isWinUpToDate === false, currentVersion: device.winVersion, targetVersion: TARGET_WIN_VERSION, requiresReboot: false },
        ];
    
        for (const comp of componentsToUpdate) {
            if (isCancelledRef.current) break;
            if (!comp.needsUpdate) continue;
            
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: `Updating ${comp.name}` } : d));
            addLog(`[${device.hostname}] Phase: ${comp.name} Update. Status: Starting. Current version: ${comp.currentVersion}`, 'INFO');
            
            await sleep(2000 + Math.random() * 1000);
    
            if (isCancelledRef.current) break;
    
            const updateSucceeded = Math.random() > 0.15; // 85% success chance
    
            if (updateSucceeded) {
                succeeded.push(comp.name);
                if (comp.requiresReboot) {
                    needsReboot = true;
                }
                setDevices(prev => prev.map(d => d.id === deviceId ? { 
                    ...d,
                    [comp.versionKey]: comp.targetVersion, 
                    [comp.isUpToDateKey]: true 
                } : d));
                addLog(`[${device.hostname}] Phase: ${comp.name} Update. Status: Complete. New version: ${comp.targetVersion}`, 'SUCCESS');
            } else {
                failed.push(comp.name);
                addLog(`[${device.hostname}] Phase: ${comp.name} Update. Status: FAILED.`, 'ERROR');
                break; // Stop updating this device if one component fails
            }
        }
        
        if (isCancelledRef.current) {
             addLog(`Update for ${device.hostname} was cancelled.`, 'WARNING');
             return;
        }
    
        const finalUpdateResult = { succeeded, failed };
    
        if (failed.length > 0) {
            addLog(`Update process for ${device.hostname} failed on ${failed[0]} component.`, 'ERROR');
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Failed', lastUpdateResult: finalUpdateResult } : d));
        } else if (succeeded.length > 0) {
            const successSummary = `Updates finished for ${device.hostname}. Components updated: ${succeeded.join(', ')}.`;
            if (needsReboot) {
                addLog(`${successSummary} A reboot is required to complete the installation.`, 'INFO');
                setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Update Complete (Reboot Pending)', lastUpdateResult: finalUpdateResult } : d));
                 if (autoRebootEnabled) {
                    addLog(`[${device.hostname}] Auto-reboot is enabled. Initiating reboot now...`, 'INFO');
                    await handleRebootDevice(deviceId);
                }
            } else {
                addLog(`${successSummary} System is now compliant.`, 'SUCCESS');
                setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Success', lastUpdateResult: finalUpdateResult } : d));
            }
        } else {
            addLog(`No updates were needed for ${device.hostname}. System is already compliant.`, 'INFO');
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Success' } : d));
        }
    };
    
    const handleRebootDevice = async (deviceId: number) => {
        const device = devices.find(d => d.id === deviceId);
        if (!device) return;

        addLog(`[${device.hostname}] Initiating reboot as required by recent updates.`, 'INFO');
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Rebooting...' } : d));
        
        await sleep(8000 + Math.random() * 4000);

        if (isCancelledRef.current) {
            addLog(`[${device.hostname}] Reboot cancelled during process.`, 'WARNING');
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Cancelled' } : d));
            return;
        }

        addLog(`[${device.hostname}] Reboot complete. System is now compliant.`, 'SUCCESS');
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Success' } : d));
    };

    const handleCancelDeployment = () => {
        isCancelledRef.current = true;
        setDeploymentState(DeploymentState.Idle);
        const cancellableStatuses: DeploymentStatus[] = ['Connecting', 'Retrying...', 'Updating', 'Waking Up', 'Checking Info', 'Checking BIOS', 'Checking DCU', 'Checking Windows', 'Updating BIOS', 'Updating DCU', 'Updating Windows', 'Rebooting...'];
        setDevices(prev => {
            const updatedDevices = prev.map((d): Device => cancellableStatuses.includes(d.status) ? { ...d, status: 'Cancelled' } : d);
            archiveCurrentRun(updatedDevices);
            return updatedDevices;
        });
        addLog('Deployment has been cancelled by the user.', 'WARNING');
        sendNotification('Deployment Cancelled', 'The scan process was stopped by the user.');
    };

    const handleWakeOnLan = (deviceIds: Set<number>) => {
        if (deviceIds.size === 0) return;
        const hostnames: string[] = [];
        setDevices(prev => prev.map(d => {
            if (deviceIds.has(d.id)) {
                hostnames.push(d.hostname);
                return { ...d, status: 'Waking Up' };
            }
            return d;
        }));
        addLog(`Sent Wake-on-LAN to ${deviceIds.size} device(s): ${hostnames.join(', ')}`, 'INFO');
        setSelectedDeviceIds(new Set());
    };

    const handleDeviceSelection = (deviceId: number) => {
        setSelectedDeviceIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(deviceId)) newSet.delete(deviceId);
            else newSet.add(deviceId);
            return newSet;
        });
    };

    const handleSelectAll = (select: boolean) => {
        if (select) {
            setSelectedDeviceIds(new Set(devices.map(d => d.id)));
        } else {
            setSelectedDeviceIds(new Set());
        }
    };

    const handleBulkUpdate = async () => {
        addLog(`Initiating bulk update for ${selectedDeviceIds.size} devices...`, 'INFO');
        const updatePromises = [...selectedDeviceIds].map(id => handleUpdateDevice(id));
        await Promise.all(updatePromises);
        addLog('Bulk update process complete.', 'SUCCESS');
        setSelectedDeviceIds(new Set()); 
    };

    const handleBulkCancel = () => {
        addLog(`Cancelling tasks for ${selectedDeviceIds.size} selected devices...`, 'WARNING');
        const cancellableStatuses: DeploymentStatus[] = ['Connecting', 'Retrying...', 'Updating', 'Waking Up', 'Checking Info', 'Checking BIOS', 'Checking DCU', 'Checking Windows', 'Updating BIOS', 'Updating DCU', 'Updating Windows'];
        setDevices(prev =>
            prev.map((d): Device =>
                selectedDeviceIds.has(d.id) && cancellableStatuses.includes(d.status)
                    ? { ...d, status: 'Cancelled' }
                    : d
            )
        );
        setSelectedDeviceIds(new Set());
    };

    const isReadyToDeploy = csvFile && batchFile;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
            <Header
                selectedDeviceIds={selectedDeviceIds}
                onWakeOnLan={handleWakeOnLan}
            />
            <main className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-8">
                    <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">
                        <h2 className="text-xl font-bold text-cyan-400 mb-4 border-b border-slate-600 pb-2">Configuration</h2>
                        <div className="space-y-6">
                            <StepCard
                                step="1"
                                title="Select Device List"
                                description="Upload a CSV file with 'Hostname' and 'MAC' columns."
                            >
                                <input type="file" accept=".csv" onChange={handleFileChange(setCsvFile)} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 w-full text-sm text-slate-400"/>
                                {csvFile && <p className="text-xs text-green-400 mt-2">Selected: {csvFile.name}</p>}
                            </StepCard>
                            <StepCard
                                step="2"
                                title="Select Deployment Package"
                                description="Choose the .bat or .cmd script to execute remotely."
                            >
                                <input type="file" accept=".bat,.cmd" onChange={handleFileChange(setBatchFile)} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 w-full text-sm text-slate-400"/>
                                {batchFile && <p className="text-xs text-green-400 mt-2">Selected: {batchFile.name}</p>}
                            </StepCard>
                             <StepCard
                                step="3"
                                title="Enter Credentials"
                                description="Secure credentials will be requested when you start the scan."
                            >
                                <p className="text-xs text-slate-500 pt-2">Authentication will be prompted before the scan begins.</p>
                            </StepCard>
                             <StepCard
                                step="4"
                                title="Advanced Settings"
                                description="Configure connection retry and reboot behavior."
                            >
                                <div className="space-y-3 pt-2">
                                     <div className="flex items-center justify-between">
                                        <label htmlFor="maxRetries" className="text-sm text-slate-300">Max Retries</label>
                                        <input 
                                            type="number" 
                                            id="maxRetries" 
                                            value={maxRetries}
                                            onChange={(e) => setMaxRetries(Math.max(1, parseInt(e.target.value, 10)))}
                                            className="w-20 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-center"
                                        />
                                    </div>
                                     <div className="flex items-center justify-between">
                                        <label htmlFor="retryDelay" className="text-sm text-slate-300">Retry Delay (sec)</label>
                                        <input 
                                            type="number" 
                                            id="retryDelay"
                                            value={retryDelay}
                                            onChange={(e) => setRetryDelay(Math.max(1, parseInt(e.target.value, 10)))}
                                            className="w-20 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-center"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="autoReboot" className="text-sm text-slate-300 cursor-pointer">Auto Reboot</label>
                                        <button
                                            id="autoReboot"
                                            role="switch"
                                            aria-checked={autoRebootEnabled}
                                            onClick={() => setAutoRebootEnabled(!autoRebootEnabled)}
                                            className={`${
                                                autoRebootEnabled ? 'bg-cyan-600' : 'bg-slate-600'
                                            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800`}
                                        >
                                            <span
                                                className={`${
                                                autoRebootEnabled ? 'translate-x-6' : 'translate-x-1'
                                                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </StepCard>
                        </div>
                    </div>
                     <DeploymentHistory history={deploymentHistory} />
                </div>

                <div className="lg:col-span-2 flex flex-col gap-8">
                    <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">
                         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                            <h2 className="text-xl font-bold text-cyan-400 mb-2 sm:mb-0">Deployment Status</h2>
                            {deploymentState === DeploymentState.Running ? (
                                <button
                                    onClick={handleCancelDeployment}
                                    className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                                >
                                    Cancel Scan
                                </button>
                            ) : (
                                 <button
                                    onClick={handleStartDeployment}
                                    disabled={!isReadyToDeploy}
                                    className="px-6 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50"
                                >
                                    Start System Scan
                                </button>
                            )}
                        </div>
                        <DeploymentProgress devices={devices} />
                    </div>
                    
                    <BulkActions 
                        selectedCount={selectedDeviceIds.size} 
                        onUpdate={handleBulkUpdate} 
                        onCancel={handleBulkCancel} 
                    />

                    <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700 flex-grow min-h-[400px] flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2">
                            <h2 className="text-xl font-bold text-cyan-400">Live Logs & Device Status</h2>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-grow min-h-0">
                             <DeviceStatusTable 
                                devices={devices} 
                                onUpdateDevice={handleUpdateDevice} 
                                onRebootDevice={handleRebootDevice}
                                selectedDeviceIds={selectedDeviceIds}
                                onDeviceSelect={handleDeviceSelection}
                                onSelectAll={handleSelectAll}
                             />
                             <LogViewer logs={logs} />
                        </div>
                    </div>
                </div>
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