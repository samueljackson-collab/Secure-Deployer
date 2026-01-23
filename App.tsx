
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { StepCard } from './components/StepCard';
import { CredentialsForm } from './components/CredentialsForm';
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

const TARGET_BIOS_VERSION = 'A25';
const TARGET_DCU_VERSION = '5.2.0';
const TARGET_WIN_VERSION = '23H2';
const MAX_RETRIES = 3;

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
        const needsAction = currentDevices.filter(d => d.status === 'Scan Complete').length;
        const failed = currentDevices.filter(d => ['Failed', 'Offline', 'Cancelled'].includes(d.status)).length;
        const successRate = total > 0 ? (compliant / total) * 100 : 0;

        const newRun: DeploymentRun = {
            id: Date.now(),
            endTime: new Date(),
            totalDevices: total,
            compliant,
            needsAction,
            failed,
            successRate,
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

                    const hostnameCol = header.find(h => h.toLowerCase().includes('hostname') || h.toLowerCase().includes('computer') || h.toLowerCase().includes('name') || h.toLowerCase().includes('device'));
                    const macCol = header.find(h => h.toLowerCase().includes('mac'));

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
                            addLog(`Validation failed for row ${index + 2}: Invalid MAC address format "${rawMac}" for device "${hostname}". Skipping entry.`, 'WARNING');
                            invalidCount++;
                            return;
                        }

                        parsedDevices.push({
                            id: index,
                            hostname: hostname,
                            mac: normalizedMac,
                            status: 'Pending',
                            isSelected: false,
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
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                 if (isCancelledRef.current) break;

                await sleep(1000 + Math.random() * 500);
                if (Math.random() > 0.3) {
                    isConnected = true;
                    if(attempt > 1) {
                        addLog(`Successfully connected to ${device.hostname} on attempt ${attempt}.`, 'SUCCESS');
                    }
                    break;
                } else {
                    if (attempt < MAX_RETRIES) {
                        addLog(`[${device.hostname}] Connection failed. Retrying... (Attempt ${attempt} of ${MAX_RETRIES})`, 'WARNING');
                        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Retrying...', retryAttempt: attempt } : d));
                        await sleep(2000);
                    }
                }
            }

            if (!isConnected) {
                setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Offline' } : d));
                addLog(`Host ${device.hostname} is not responding after ${MAX_RETRIES} attempts.`, 'ERROR');
                continue;
            }

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking Info' } : d));
            addLog(`Checking system info for ${device.hostname}.`);
            await sleep(400 + Math.random() * 400);

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking BIOS' } : d));
            await sleep(1000 + Math.random() * 700);
            const biosVersion = Math.random() > 0.3 ? TARGET_BIOS_VERSION : `A${Math.floor(18 + Math.random() * 6)}`;
            const isBiosUpToDate = biosVersion === TARGET_BIOS_VERSION;
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, biosVersion, isBiosUpToDate } : d));
            addLog(`[${device.hostname}] BIOS Version: ${biosVersion}`);

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking DCU' } : d));
            await sleep(1000 + Math.random() * 700);
            const dcuVersion = Math.random() > 0.3 ? TARGET_DCU_VERSION : `5.${Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 9)}`;
            const isDcuUpToDate = dcuVersion === TARGET_DCU_VERSION;
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, dcuVersion, isDcuUpToDate } : d));
            addLog(`[${device.hostname}] DCU Version: ${dcuVersion}`);

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking Windows' } : d));
            await sleep(1000 + Math.random() * 700);
            const winVersion = Math.random() > 0.3 ? TARGET_WIN_VERSION : ['22H2', '21H2'][Math.floor(Math.random()*2)];
            const isWinUpToDate = winVersion === TARGET_WIN_VERSION;
            
            const allUpToDate = isBiosUpToDate && isDcuUpToDate && isWinUpToDate;

            setDevices(prev => prev.map(d => d.id === device.id ? {
                ...d,
                winVersion,
                isWinUpToDate,
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
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Updating' } : d));
        await sleep(1000);

        if (isCancelledRef.current) return;
        if (device.isBiosUpToDate === false) {
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Updating BIOS' } : d));
            addLog(`[${device.hostname}] Phase: BIOS Update. Status: Starting. Current version: ${device.biosVersion}`, 'INFO');
            await sleep(2000 + Math.random() * 1000);
            if (isCancelledRef.current) return;
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, biosVersion: TARGET_BIOS_VERSION, isBiosUpToDate: true } : d));
            addLog(`[${device.hostname}] Phase: BIOS Update. Status: Complete. New version: ${TARGET_BIOS_VERSION}`, 'SUCCESS');
        }
        
        if (isCancelledRef.current) return;
        if (device.isDcuUpToDate === false) {
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Updating DCU' } : d));
            addLog(`[${device.hostname}] Phase: DCU Update. Status: Starting. Current version: ${device.dcuVersion}`, 'INFO');
            await sleep(2000 + Math.random() * 1000);
            if (isCancelledRef.current) return;
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, dcuVersion: TARGET_DCU_VERSION, isDcuUpToDate: true } : d));
            addLog(`[${device.hostname}] Phase: DCU Update. Status: Complete. New version: ${TARGET_DCU_VERSION}`, 'SUCCESS');
        }

        if (isCancelledRef.current) return;
        if (device.isWinUpToDate === false) {
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Updating Windows' } : d));
            addLog(`[${device.hostname}] Phase: Windows Update. Status: Starting. Current version: ${device.winVersion}`, 'INFO');
            await sleep(2000 + Math.random() * 1000);
            if (isCancelledRef.current) return;
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, winVersion: TARGET_WIN_VERSION, isWinUpToDate: true } : d));
            addLog(`[${device.hostname}] Phase: Windows Update. Status: Complete. New version: ${TARGET_WIN_VERSION}`, 'SUCCESS');
        }

        if (isCancelledRef.current) return;
        addLog(`All updates finished for ${device.hostname}. System is now compliant.`, 'SUCCESS');
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Success' } : d));
    };
    
    const handleCancelDeployment = () => {
        isCancelledRef.current = true;
        setDeploymentState(DeploymentState.Idle);
        const cancellableStatuses: DeploymentStatus[] = ['Connecting', 'Retrying...', 'Updating', 'Waking Up', 'Checking Info', 'Checking BIOS', 'Checking DCU', 'Checking Windows', 'Updating BIOS', 'Updating DCU', 'Updating Windows'];
        setDevices(prev => {
            const updatedDevices = prev.map(d => cancellableStatuses.includes(d.status) ? { ...d, status: 'Cancelled' } : d);
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
            prev.map(d =>
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
            <Header selectedDeviceIds={selectedDeviceIds} onWakeOnLan={handleWakeOnLan} />
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
                                    disabled={!isReadyToDeploy || deploymentState === DeploymentState.Running}
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
