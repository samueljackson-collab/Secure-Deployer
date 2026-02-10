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
import { DeviceScopeGuard } from './components/DeviceScopeGuard';
import { ScriptAnalysisModal } from './components/ScriptAnalysisModal';
import { ImagingScriptPage } from './components/ImagingScriptPage';
import { BuildOutputPage } from './components/BuildOutputPage';
import { TrendsAnalyticsPage } from './components/TrendsAnalyticsPage';
import { AdminGateModal } from './components/AdminGateModal';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { analyzeScript } from './services/scriptSafetyAnalyzer';
import type { Device, DeviceFormFactor, LogEntry, DeploymentStatus, Credentials, DeploymentRun, ScopePolicy, ScriptSafetyResult } from './types';
import { DeploymentState } from './types';
import Papa from 'papaparse';

// --- Utility Functions ---
// Developer note: These helpers normalize incoming device metadata so downstream logic
// can focus on business rules (deployment flow) instead of repeated parsing.

const normalizeMacAddress = (mac: string): string => {
    if (!mac) return '';
    return mac.replace(/[:\-.\s]/g, '').toUpperCase();
};

const isValidMacAddress = (mac: string): boolean => {
    if (!mac) return false;
    const normalized = mac.replace(/[:\-.\s]/g, '').toUpperCase();
    return /^[0-9A-F]{12}$/.test(normalized);
};

/**
 * Detects the Dell business device form factor from hostname naming conventions.
 *
 * Enterprise hostname patterns (examples):
 *   ELSLE / ESLSC / L14 / LAT14            → laptop-14  (Standard 14" Latitude)
 *   EPLPR / L16 / LAT16 / PRE16 / PRE56    → laptop-16  (Pro 16" / Precision Mobile)
 *   EDTCH / DET / 2IN1 / DTCH              → detachable (Latitude Detachable 2-in-1)
 *   WYSE / WYS / THIN / TC                 → wyse       (Wyse Thin Client)
 *   VDI / VIRT / VD-                        → vdi        (Virtual Desktop)
 *   EWSSF / SFF                             → sff        (Standard Form Factor)
 *   EWSMF / EWSMC / MFF / MICRO            → micro      (Micro Form Factor)
 *   EWSTW / TWR / TOWER                    → tower      (Tower)
 *   EWSLE / other desktop patterns          → desktop    (Generic desktop fallback)
 *   Remaining laptops without size hint     → laptop     (Generic laptop fallback)
 *
 * Order matters: more specific patterns are tested before generic fallbacks.
 */
const detectDeviceType = (hostname: string): DeviceFormFactor => {
    const upper = hostname.toUpperCase();

    // --- Thin Clients & VDI (check first - they are distinct categories) ---
    if (upper.includes('WYSE') || upper.includes('WYS') || upper.includes('THIN') || /\bTC\d/.test(upper)) {
        return 'wyse';
    }
    if (upper.includes('VDI') || upper.includes('VIRT') || /\bVD[-_]/.test(upper)) {
        return 'vdi';
    }

    // --- Detachable 2-in-1 ---
    if (upper.includes('EDTCH') || upper.includes('DET') || upper.includes('2IN1') || upper.includes('DTCH')) {
        return 'detachable';
    }

    // --- Pro 16" Laptop (Precision Mobile / large Latitude) ---
    if (upper.includes('EPLPR') || upper.includes('L16') || upper.includes('LAT16') || upper.includes('PRE16') || upper.includes('PRE56') || upper.includes('PRE57')) {
        return 'laptop-16';
    }

    // --- Standard 14" Laptop ---
    if (upper.includes('ELSLE') || upper.includes('ESLSC') || upper.includes('L14') || upper.includes('LAT14') || upper.includes('LAT54') || upper.includes('LAT74')) {
        return 'laptop-14';
    }

    // --- Tower desktop ---
    if (upper.includes('EWSTW') || upper.includes('TWR') || upper.includes('TOWER') || upper.includes('PRETW')) {
        return 'tower';
    }

    // --- Micro Form Factor desktop ---
    if (upper.includes('EWSMF') || upper.includes('EWSMC') || upper.includes('MFF') || upper.includes('MICRO')) {
        return 'micro';
    }

    // --- Standard Form Factor desktop ---
    if (upper.includes('EWSSF') || upper.includes('SFF')) {
        return 'sff';
    }

    // --- Generic laptop (any remaining laptop-like hostname) ---
    if (upper.includes('LAT') || upper.includes('LAPTOP') || upper.includes('NB') || upper.includes('PRE5') || upper.includes('PRE7')) {
        return 'laptop';
    }

    // --- Generic desktop (any remaining desktop-like hostname, including EWSLE) ---
    return 'desktop';
};

const sanitizeLogMessage = (message: string): string => {
    // Developer note: scrub common secret patterns before logs are stored or rendered.
    return message
        .replace(/password\s*[:=]\s*\S+/gi, 'password: [REDACTED]')
        .replace(/token\s*[:=]\s*\S+/gi, 'token: [REDACTED]')
        .replace(/secret\s*[:=]\s*\S+/gi, 'secret: [REDACTED]');
};

/**
 * Sanitizes hostname to prevent injection attacks
 * Only allows alphanumeric characters, hyphens, and underscores
 */
const sanitizeHostname = (hostname: string): string => {
    if (!hostname) return '';
    return hostname.replace(/[^a-zA-Z0-9\-_]/g, '');
};

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const TARGET_BIOS_VERSION = 'A25';
const TARGET_DCU_VERSION = '5.2.0';
const TARGET_WIN_VERSION = '23H2';

type PendingAdminAction =
    | { type: 'startDeployment' }
    | { type: 'bulkUpdate' }
    | { type: 'wakeOnLan'; deviceIds: Set<number> }
    | { type: 'updateDevice'; deviceId: number }
    | { type: 'rebootDevice'; deviceId: number };

const App: React.FC = () => {
    // Developer note: UI state below mirrors the main workflow phases:
    // config (file selection), auth (credentials), scan/update execution, then reporting.
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [batchFile, setBatchFile] = useState<File | null>(null);
    const [credentials, setCredentials] = useState<Credentials>({ username: '', password: '' });
    const [operatorName, setOperatorName] = useState('');
    const [devices, setDevices] = useState<Device[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [deploymentState, setDeploymentState] = useState<DeploymentState>(DeploymentState.Idle);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<number>>(new Set());
    const [deploymentHistory, setDeploymentHistory] = useState<DeploymentRun[]>([]);
    const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
    const [maxRetries, setMaxRetries] = useState(3);
    const [retryDelay, setRetryDelay] = useState(2);
    const [autoRebootEnabled, setAutoRebootEnabled] = useState(false);

    const [activeView, setActiveView] = useState<'imaging' | 'deployment' | 'imagingScript' | 'buildOutput' | 'trendsAnalytics'>('imaging');

    const [isScopeGuardOpen, setIsScopeGuardOpen] = useState(false);
    const [activeScopePolicy, setActiveScopePolicy] = useState<ScopePolicy | null>(null);
    const [pendingAction, setPendingAction] = useState<'scan' | 'bulkUpdate' | null>(null);

    const [isScriptAnalysisOpen, setIsScriptAnalysisOpen] = useState(false);
    const [scriptAnalysisResult, setScriptAnalysisResult] = useState<ScriptSafetyResult | null>(null);
    const [scriptAnalysisLoading, setScriptAnalysisLoading] = useState(false);

    const [sessionActive, setSessionActive] = useState(false);
    const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastActivityRef = useRef<number>(Date.now());
    const [isAdminVerified, setIsAdminVerified] = useState(false);
    const [adminGateOpen, setAdminGateOpen] = useState(false);
    const [pendingAdminAction, setPendingAdminAction] = useState<PendingAdminAction | null>(null);
    const [confirmAction, setConfirmAction] = useState<PendingAdminAction | null>(null);

    const isCancelledRef = useRef(false);

    const resetSessionTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
        if (sessionTimerRef.current) {
            clearTimeout(sessionTimerRef.current);
        }
        // Always set timer when this function is called, regardless of current sessionActive state
        // This ensures the timer is refreshed on every activity event
        sessionTimerRef.current = setTimeout(() => {
            // Developer note: on timeout we wipe operator context and prompt re-auth.
            setCredentials({ username: '', password: '' });
            setOperatorName('');
            setSessionActive(false);
            setIsAdminVerified(false);
            addLog('Session expired due to inactivity. Please re-authenticate.', 'WARNING');
        }, SESSION_TIMEOUT_MS);
    }, []);

    useEffect(() => {
        if (sessionActive) {
            // Start the timer when session becomes active
            resetSessionTimer();
            const handleActivity = () => resetSessionTimer();
            window.addEventListener('mousemove', handleActivity);
            window.addEventListener('keydown', handleActivity);
            return () => {
                window.removeEventListener('mousemove', handleActivity);
                window.removeEventListener('keydown', handleActivity);
                if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
            };
        } else {
            // Clear timer when session becomes inactive
            if (sessionTimerRef.current) {
                clearTimeout(sessionTimerRef.current);
                sessionTimerRef.current = null;
            }
        }
    }, [sessionActive, resetSessionTimer]);

    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }, []);

    const sendNotification = (title: string, body: string) => {
        // Developer note: notifications are best-effort operator signals only; all
        // authoritative state still comes from table/log updates in the active session.
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.svg' });
        }
    };

    const addLog = useCallback((message: string, level: LogEntry['level'] = 'INFO') => {
        // Developer note: all app logs funnel through this helper so redaction policy
        // is applied consistently, regardless of where messages originate.
        const sanitized = sanitizeLogMessage(message);
        setLogs(prev => [...prev, { timestamp: new Date(), message: sanitized, level }]);
    }, []);

    const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setter(e.target.files[0]);
            // Reset script analysis when a new batch file is selected
            if (setter === setBatchFile) {
                setScriptAnalysisResult(null);
            }
        }
    };

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleAnalyzeScript = async () => {
        // Developer note: this is a pre-flight safety check for uploaded scripts.
        if (!batchFile) return;

        setScriptAnalysisLoading(true);
        setIsScriptAnalysisOpen(true);

        try {
            const scriptContent = await batchFile.text();
            const allowedHostnames = devices.map(d => d.hostname);
            const result = analyzeScript(scriptContent, allowedHostnames);
            setScriptAnalysisResult(result);

            if (!result.isSafe) {
                addLog(`SCRIPT BLOCKED: ${result.blockedPatterns.length} dangerous pattern(s) detected. Risk level: ${result.riskLevel}`, 'ERROR');
            } else if (result.riskLevel === 'MEDIUM' || result.riskLevel === 'HIGH') {
                addLog(`Script analysis: ${result.findings.length} finding(s). Risk level: ${result.riskLevel}. Review recommended.`, 'WARNING');
            } else {
                addLog('Script analysis complete. No critical issues found.', 'SUCCESS');
            }
        } catch (error) {
            addLog(`Script analysis failed: ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
        } finally {
            setScriptAnalysisLoading(false);
        }
    };

    const archiveCurrentRun = (currentDevices: Device[]) => {
        // Developer note: snapshot aggregate metrics so the history panel can render.
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
        setDeploymentHistory(prev => [newRun, ...prev].slice(0, 10));
    };

    const handleConfirmCredentialsAndDeploy = async (sessionCredentials: Credentials) => {
        // Developer note: validates credentials locally, parses CSV, and kicks off flow.
        setIsCredentialModalOpen(false);
        if (!csvFile || !batchFile) {
            addLog("CSV or Batch file is missing.", 'ERROR');
            return;
        }

        // NOTE: Full authentication and authorization are enforced server-side.
        // This client-side check only validates basic credential format and complexity.
        const username = sessionCredentials.username.trim();
        const password = sessionCredentials.password;

        const usernamePattern = /^[A-Za-z0-9@._\\-\\\\]{3,256}$/;
        if (!usernamePattern.test(username)) {
            addLog("Invalid username format. Use 3-256 characters: letters, numbers, and @ . _ - \\\\ only.", 'ERROR');
            return;
        }

        const MIN_PASSWORD_LENGTH = 12;
        const passwordTooShortOrLong = password.length < MIN_PASSWORD_LENGTH || password.length > 256;
        const passwordComplexityPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\da-zA-Z]).+$/;
        if (passwordTooShortOrLong || !passwordComplexityPattern.test(password)) {
            addLog("Invalid password format. Password must be 12-256 characters and include upper case, lower case, number, and special character.", 'ERROR');
            return;
        }

        isCancelledRef.current = false;
        setOperatorName(username);
        setCredentials({ username: '', password: '' });
        setSessionActive(true);
        resetSessionTimer();
        setDeploymentState(DeploymentState.Running);
        setLogs([]);
        setSelectedDeviceIds(new Set());
        addLog("Deployment process initiated. Credentials cleared after authentication.", 'INFO');

        try {
            Papa.parse<Record<string, string>>(csvFile, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    // Developer note: normalize device records and guard against CSV errors.
                    if (results.errors.length > 0) {
                        addLog(`CSV parsing errors: ${results.errors.length} error(s) found.`, 'ERROR');
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
                    const seenHostnames = new Set<string>();
                    const seenMacs = new Set<string>();
                    let invalidCount = 0;
                    results.data.forEach((row, index) => {
                        const rawHostname = (row[hostnameCol] || '').trim();
                        const hostname = sanitizeHostname(rawHostname);
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

                        if (rawHostname && rawHostname !== hostname) {
                            addLog(`Sanitized hostname in row ${index + 2}: "${rawHostname}" → "${hostname}".`, 'WARNING');
                        }

                        if (!isValidMacAddress(normalizedMac)) {
                            addLog(`[Validation Skip] Skipping device "${hostname}" from row ${index + 2}. Reason: Invalid MAC address format.`, 'WARNING');
                            invalidCount++;
                            return;
                        }

                        const hostnameKey = hostname.toUpperCase();
                        if (seenHostnames.has(hostnameKey)) {
                            addLog(`[Validation Skip] Duplicate hostname "${hostname}" detected in row ${index + 2}.`, 'WARNING');
                            invalidCount++;
                            return;
                        }

                        if (seenMacs.has(normalizedMac)) {
                            addLog(`[Validation Skip] Duplicate MAC address "${normalizedMac}" detected in row ${index + 2}.`, 'WARNING');
                            invalidCount++;
                            return;
                        }

                        seenHostnames.add(hostnameKey);
                        seenMacs.add(normalizedMac);

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

                    const scriptContent = await batchFile.text();
                    const allowedHostnames = parsedDevices.map(d => d.hostname);
                    const safetyResult = analyzeScript(scriptContent, allowedHostnames);

                    if (!safetyResult.isSafe) {
                        addLog(`DEPLOYMENT BLOCKED: Script contains ${safetyResult.blockedPatterns.length} dangerous pattern(s).`, 'ERROR');
                        safetyResult.blockedPatterns.forEach(p => addLog(`  BLOCKED: ${p}`, 'ERROR'));
                        setScriptAnalysisResult(safetyResult);
                        setIsScriptAnalysisOpen(true);
                        setDeploymentState(DeploymentState.Idle);
                        sendNotification('Deployment Blocked', 'Script failed safety analysis.');
                        return;
                    }

                    if (safetyResult.scopeViolations.length > 0) {
                        addLog('SCOPE WARNING: Script may target devices outside the selected list.', 'WARNING');
                        safetyResult.scopeViolations.forEach(v => addLog(`  SCOPE: ${v}`, 'WARNING'));
                    }

                    addLog(`Script safety check passed. Risk level: ${safetyResult.riskLevel}`, 'SUCCESS');

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

    const startDeploymentFlow = () => {
        // Developer note: this function only opens credential capture; actual device
        // processing starts after credential confirmation and CSV/script validation.
        if (!csvFile || !batchFile) {
            addLog("Please select a device list and deployment package first.", 'ERROR');
            return;
        }
        setIsCredentialModalOpen(true);
    };

    const requestAdminAction = (action: PendingAdminAction) => {
        // Developer note: stage privileged actions so admin gate can approve and return
        // to the exact pending intent without reconstructing arguments.
        setPendingAdminAction(action);
        setAdminGateOpen(true);
    };

    const handleStartDeployment = () => {
        const action: PendingAdminAction = { type: 'startDeployment' };
        if (!isAdminVerified) {
            requestAdminAction(action);
            return;
        }
        setConfirmAction(action);
    };

    const runDeploymentFlow = async (parsedDevices: Device[]) => {
        // Developer note: main scan sequence (WoL → device metadata → compliance checks).
        if (isCancelledRef.current) return;

        addLog("Sending Wake-on-LAN packets...", 'INFO');
        setDevices(prev => prev.map(d => ({ ...d, status: 'Waking Up' as DeploymentStatus })));
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
            // Developer note: each device is scanned independently, with retry logic.
            if (isCancelledRef.current) {
                addLog('Deployment cancelled by user.', 'WARNING');
                setDeploymentState(DeploymentState.Idle);
                break;
            }

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Connecting' as DeploymentStatus } : d));

            let isConnected = false;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                if (isCancelledRef.current) break;

                await sleep(1000 + Math.random() * 500);
                if (Math.random() > 0.3) {
                    isConnected = true;
                    if (attempt > 1) {
                        addLog(`Successfully connected to ${device.hostname} on attempt ${attempt}.`, 'SUCCESS');
                    }
                    break;
                } else {
                    if (attempt < maxRetries) {
                        addLog(`[${device.hostname}] Connection failed. Retrying... (Attempt ${attempt} of ${maxRetries})`, 'WARNING');
                        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Retrying...' as DeploymentStatus, retryAttempt: attempt } : d));
                        await sleep(retryDelay * 1000);
                    }
                }
            }

            if (!isConnected) {
                setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Offline' as DeploymentStatus } : d));
                addLog(`Host ${device.hostname} is not responding after ${maxRetries} attempts.`, 'ERROR');
                continue;
            }

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking Info' as DeploymentStatus } : d));
            addLog(`Gathering metadata for ${device.hostname}...`);
            await sleep(1500 + Math.random() * 1000);

            const ipAddress = `10.1.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
            const serialNumber = Math.random().toString(36).substring(2, 9).toUpperCase();
            const modelMap: Record<DeviceFormFactor, string[]> = {
                // Developer note: mock inventory metadata used for demo/UX coverage.
                'laptop-14':  ['Latitude 5450', 'Latitude 7450', 'Latitude 5440'],
                'laptop-16':  ['Latitude 9640', 'Precision 5690', 'Precision 5680'],
                'detachable': ['Latitude 7350 Detachable', 'Latitude 7230 Rugged Extreme'],
                'laptop':     ['Latitude 7420', 'Latitude 5430', 'Precision 5560'],
                'sff':        ['OptiPlex 7020 SFF', 'OptiPlex 5000 SFF', 'OptiPlex 7010 SFF'],
                'micro':      ['OptiPlex 7020 Micro', 'OptiPlex 7010 Micro', 'OptiPlex 3000 Micro'],
                'tower':      ['OptiPlex 7020 Tower', 'Precision 3680 Tower', 'OptiPlex 5000 Tower'],
                'wyse':       ['Wyse 5070', 'Wyse 5470', 'Wyse 3040'],
                'vdi':        ['VDI Virtual Desktop', 'VMware Horizon Client', 'Citrix Workspace'],
                'desktop':    ['OptiPlex 7090', 'OptiPlex 5000', 'Precision 3650'],
            };
            const deviceFormFactor = device.deviceType || 'desktop';
            const models = modelMap[deviceFormFactor];
            const model = models[Math.floor(Math.random() * models.length)];
            const ramAmount = [8, 16, 32, 64][Math.floor(Math.random() * 4)];
            const diskTotal = [256, 512, 1024][Math.floor(Math.random() * 3)];
            const diskFree = Math.floor(diskTotal * (0.1 + Math.random() * 0.8));
            const encryptionStatus: 'Enabled' | 'Disabled' = Math.random() > 0.2 ? 'Enabled' : 'Disabled';

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

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking BIOS' as DeploymentStatus } : d));
            await sleep(1500 + Math.random() * 1000);
            const biosVersion = Math.random() > 0.3 ? TARGET_BIOS_VERSION : `A${Math.floor(18 + Math.random() * 6)}`;
            const isBiosUpToDate = biosVersion === TARGET_BIOS_VERSION;
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, biosVersion, isBiosUpToDate } : d));
            addLog(`[${device.hostname}] BIOS Version: ${biosVersion}`);

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking DCU' as DeploymentStatus } : d));
            await sleep(1200 + Math.random() * 800);
            const dcuVersion = Math.random() > 0.3 ? TARGET_DCU_VERSION : `5.${Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 9)}`;
            const isDcuUpToDate = dcuVersion === TARGET_DCU_VERSION;
            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, dcuVersion, isDcuUpToDate } : d));
            addLog(`[${device.hostname}] DCU Version: ${dcuVersion}`);

            setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'Checking Windows' as DeploymentStatus } : d));
            await sleep(1800 + Math.random() * 1200);
            const winVersion = Math.random() > 0.3 ? TARGET_WIN_VERSION : ['22H2', '21H2'][Math.floor(Math.random() * 2)];
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
                status: (allUpToDate ? 'Success' : 'Scan Complete') as DeploymentStatus,
            } : d));
            addLog(`[${device.hostname}] Windows Version: ${winVersion}`);
            addLog(`Scan complete for ${device.hostname}.`, allUpToDate ? 'SUCCESS' : 'INFO');
        }

        if (!isCancelledRef.current) {
            addLog("Deployment scan process complete.", 'INFO');
            sendNotification('Deployment Complete', `Scan finished for ${parsedDevices.length} devices.`);
            setDeploymentState(DeploymentState.Complete);
        }

        setDevices(currentDevices => {
            archiveCurrentRun(currentDevices);
            return currentDevices;
        });
    };

    const updateDeviceFlow = async (deviceId: number) => {
        // Developer note: update flow runs after scans and can be scoped by policy.
        const device = devices.find(d => d.id === deviceId);
        if (!device) return;

        // Runtime scope policy enforcement: Only hostname/MAC whitelist is checked here.
        // Other policy flags (blockBroadcastCommands, blockRegistryWrites, etc.) are
        // enforced at the script analysis level before deployment begins.
        if (activeScopePolicy && activeScopePolicy.enforceHostnameWhitelist) {
            if (!activeScopePolicy.allowedHostnames.includes(device.hostname)) {
                addLog(`BLOCKED: ${device.hostname} is not in the verified scope. Update denied.`, 'ERROR');
                return;
            }
        }

        addLog(`Initiating updates for ${device.hostname}...`, 'INFO');
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Updating' as DeploymentStatus, lastUpdateResult: undefined } : d));
        await sleep(1000);

        let needsReboot = false;
        const succeeded: string[] = [];
        const failed: string[] = [];

        const componentsToUpdate = [
            // Developer note: track per-component update status for logging + UI state.
            { name: 'BIOS', versionKey: 'biosVersion', isUpToDateKey: 'isBiosUpToDate', needsUpdate: device.isBiosUpToDate === false, currentVersion: device.biosVersion, targetVersion: TARGET_BIOS_VERSION, requiresReboot: true },
            { name: 'DCU', versionKey: 'dcuVersion', isUpToDateKey: 'isDcuUpToDate', needsUpdate: device.isDcuUpToDate === false, currentVersion: device.dcuVersion, targetVersion: TARGET_DCU_VERSION, requiresReboot: false },
            { name: 'Windows', versionKey: 'winVersion', isUpToDateKey: 'isWinUpToDate', needsUpdate: device.isWinUpToDate === false, currentVersion: device.winVersion, targetVersion: TARGET_WIN_VERSION, requiresReboot: false },
        ];

        for (const comp of componentsToUpdate) {
            if (isCancelledRef.current) break;
            if (!comp.needsUpdate) continue;

            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: `Updating ${comp.name}` as DeploymentStatus } : d));
            addLog(`[${device.hostname}] Phase: ${comp.name} Update. Status: Starting. Current version: ${comp.currentVersion}`, 'INFO');

            await sleep(2000 + Math.random() * 1000);

            if (isCancelledRef.current) break;

            const updateSucceeded = Math.random() > 0.15;

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
                break;
            }
        }

        if (isCancelledRef.current) {
            addLog(`Update for ${device.hostname} was cancelled.`, 'WARNING');
            return;
        }

        const finalUpdateResult = { succeeded, failed };

        if (failed.length > 0) {
            addLog(`Update process for ${device.hostname} failed on ${failed[0]} component.`, 'ERROR');
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Failed' as DeploymentStatus, lastUpdateResult: finalUpdateResult } : d));
        } else if (succeeded.length > 0) {
            const successSummary = `Updates finished for ${device.hostname}. Components updated: ${succeeded.join(', ')}.`;
            if (needsReboot) {
                addLog(`${successSummary} A reboot is required to complete the installation.`, 'INFO');
                setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Update Complete (Reboot Pending)' as DeploymentStatus, lastUpdateResult: finalUpdateResult } : d));
                if (autoRebootEnabled) {
                    addLog(`[${device.hostname}] Auto-reboot is enabled. Initiating reboot now...`, 'INFO');
                    await handleRebootDevice(deviceId);
                }
            } else {
                addLog(`${successSummary} System is now compliant.`, 'SUCCESS');
                setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Success' as DeploymentStatus, lastUpdateResult: finalUpdateResult } : d));
            }
        } else {
            addLog(`No updates were needed for ${device.hostname}. System is already compliant.`, 'INFO');
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Success' as DeploymentStatus } : d));
        }
    };

    const handleUpdateDevice = async (deviceId: number) => {
        const action: PendingAdminAction = { type: 'updateDevice', deviceId };
        if (!isAdminVerified) {
            requestAdminAction(action);
            return;
        }
        setConfirmAction(action);
    };

    const rebootDeviceFlow = async (deviceId: number) => {
        const device = devices.find(d => d.id === deviceId);
        if (!device) return;

        addLog(`[${device.hostname}] Initiating reboot as required by recent updates.`, 'INFO');
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Rebooting...' as DeploymentStatus } : d));

        await sleep(8000 + Math.random() * 4000);

        if (isCancelledRef.current) {
            addLog(`[${device.hostname}] Reboot cancelled during process.`, 'WARNING');
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Cancelled' as DeploymentStatus } : d));
            return;
        }

        addLog(`[${device.hostname}] Reboot complete. System is now compliant.`, 'SUCCESS');
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'Success' as DeploymentStatus } : d));
    };

    const handleRebootDevice = async (deviceId: number) => {
        const action: PendingAdminAction = { type: 'rebootDevice', deviceId };
        if (!isAdminVerified) {
            requestAdminAction(action);
            return;
        }
        setConfirmAction(action);
    };

    const handleCancelDeployment = () => {
        // Developer note: cancellation is cooperative; loops check isCancelledRef and
        // this handler immediately marks active transient states as Cancelled in UI.
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

    const wakeOnLanFlow = (deviceIds: Set<number>) => {
        if (deviceIds.size === 0) return;
        const hostnames: string[] = [];
        setDevices(prev => prev.map(d => {
            if (deviceIds.has(d.id)) {
                hostnames.push(d.hostname);
                return { ...d, status: 'Waking Up' as DeploymentStatus };
            }
            return d;
        }));
        addLog(`Sent Wake-on-LAN to ${deviceIds.size} device(s): ${hostnames.join(', ')}`, 'INFO');
        setSelectedDeviceIds(new Set());
    };

    const handleWakeOnLan = (deviceIds: Set<number>) => {
        const action: PendingAdminAction = { type: 'wakeOnLan', deviceIds };
        if (!isAdminVerified) {
            requestAdminAction(action);
            return;
        }
        setConfirmAction(action);
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

    const bulkUpdateFlow = async () => {
        setPendingAction('bulkUpdate');
        setIsScopeGuardOpen(true);
    };

    const handleBulkUpdate = async () => {
        const action: PendingAdminAction = { type: 'bulkUpdate' };
        if (!isAdminVerified) {
            requestAdminAction(action);
            return;
        }
        setConfirmAction(action);
    };

    const handleScopeVerified = async (verifiedDevices: Device[], policy: ScopePolicy) => {
        // Developer note: scope guard returns an immutable approval snapshot used
        // for the current bulk action run; it is reset after completion.
        setIsScopeGuardOpen(false);
        setActiveScopePolicy(policy);

        if (pendingAction === 'bulkUpdate') {
            const verifiedIds = new Set(verifiedDevices.map(d => d.id));
            addLog(`Scope verified. Initiating bulk update for ${verifiedIds.size} verified devices...`, 'INFO');
            const updatePromises = [...verifiedIds].map(id => handleUpdateDevice(id));
            await Promise.all(updatePromises);
            addLog('Bulk update process complete.', 'SUCCESS');
            setSelectedDeviceIds(new Set());
        }

        setPendingAction(null);
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

    const handlePromoteDevices = (promotedDevices: Device[]) => {
        const existingHostnames = new Set(devices.map(d => d.hostname));
        const newDevices = promotedDevices.filter(d => !existingHostnames.has(d.hostname));

        if (newDevices.length === 0) {
            addLog('All promoted devices are already in the deployment list.', 'WARNING');
            return;
        }

        const reindexed = newDevices.map((d, i) => ({
            ...d,
            id: devices.length + i,
            status: 'Pending' as DeploymentStatus,
            imagingStatus: 'Ready for Deployment' as const,
        }));

        setDevices(prev => [...prev, ...reindexed]);
        addLog(`Promoted ${reindexed.length} device(s) from Image Monitor to Deployment Runner.`, 'SUCCESS');
        setActiveView('deployment');
    };

    const handleConfirmAction = async () => {
        // Developer note: central dispatcher after admin gating + confirmation.
        if (!confirmAction) return;
        const action = confirmAction;
        setConfirmAction(null);
        switch (action.type) {
            case 'startDeployment':
                startDeploymentFlow();
                break;
            case 'bulkUpdate':
                await bulkUpdateFlow();
                break;
            case 'wakeOnLan':
                wakeOnLanFlow(action.deviceIds);
                break;
            case 'updateDevice':
                await updateDeviceFlow(action.deviceId);
                break;
            case 'rebootDevice':
                await rebootDeviceFlow(action.deviceId);
                break;
            default:
                break;
        }
    };

    const confirmDetails = (() => {
        if (!confirmAction) return null;
        switch (confirmAction.type) {
            case 'startDeployment':
                return {
                    title: 'Confirm System Scan',
                    description: 'This will initiate a scan and may send network commands to all listed devices.',
                    count: devices.length,
                };
            case 'bulkUpdate':
                return {
                    title: 'Confirm Bulk Update',
                    description: 'This will apply updates to the selected devices and can change device state.',
                    count: selectedDeviceIds.size,
                };
            case 'wakeOnLan':
                return {
                    title: 'Confirm Wake-on-LAN',
                    description: 'This will send Wake-on-LAN packets to the selected devices.',
                    count: confirmAction.deviceIds.size,
                };
            case 'updateDevice':
                return {
                    title: 'Confirm Device Update',
                    description: 'This will apply updates to the selected device and can change device state.',
                    count: 1,
                };
            case 'rebootDevice':
                return {
                    title: 'Confirm Reboot',
                    description: 'This will reboot the selected device and interrupt any active session.',
                    count: 1,
                };
            default:
                return null;
        }
    })();

    const isReadyToDeploy = csvFile && batchFile && (!scriptAnalysisResult || scriptAnalysisResult.isSafe);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
            <Header
                selectedDeviceIds={selectedDeviceIds}
                onWakeOnLan={handleWakeOnLan}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2 bg-slate-800/50 p-2 rounded-lg border border-slate-700 w-fit">
                <button
                    onClick={() => setActiveView('imaging')}
                    className={`px-4 py-2 text-sm font-semibold rounded-md transition duration-200 ${
                        activeView === 'imaging'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                >
                    Image Monitor
                </button>
                <button
                    onClick={() => setActiveView('deployment')}
                    className={`px-4 py-2 text-sm font-semibold rounded-md transition duration-200 ${
                        activeView === 'deployment'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                >
                    Secure Deployment Runner
                </button>
                <button
                    onClick={() => setActiveView('imagingScript')}
                    className={`px-4 py-2 text-sm font-semibold rounded-md transition duration-200 ${
                        activeView === 'imagingScript'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                >
                    Imaging Script
                </button>
                <button
                    onClick={() => setActiveView('buildOutput')}
                    className={`px-4 py-2 text-sm font-semibold rounded-md transition duration-200 ${
                        activeView === 'buildOutput'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                >
                    Build Output
                </button>
                <button
                    onClick={() => setActiveView('trendsAnalytics')}
                    className={`px-4 py-2 text-sm font-semibold rounded-md transition duration-200 ${
                        activeView === 'trendsAnalytics'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                >
                    Trends &amp; Analytics
                </button>
                {sessionActive && (
                    <span className="ml-4 text-xs text-green-400 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Session Active
                    </span>
                )}
            </div>

            {activeView === 'imaging' && (
                <div className="mt-8">
                    <ImageMonitor
                        onPromoteDevices={handlePromoteDevices}
                        onLog={addLog}
                    />
                </div>
            )}

            {activeView === 'deployment' && (
                <main className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 flex flex-col gap-8">
                        <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">
                            <h2 className="text-xl font-bold text-cyan-400 mb-4 border-b border-slate-600 pb-2">Configuration</h2>
                            <div className="space-y-6">
                                <StepCard step="1" title="Select Device List" description="Upload a CSV file with 'Hostname' and 'MAC' columns.">
                                    <input type="file" accept=".csv" onChange={handleFileChange(setCsvFile)} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 w-full text-sm text-slate-400" />
                                    {csvFile && <p className="text-xs text-green-400 mt-2">Selected: {csvFile.name}</p>}
                                </StepCard>
                                <StepCard step="2" title="Select Deployment Package" description="Choose the .bat or .cmd script to execute remotely.">
                                    <input type="file" accept=".bat,.cmd" onChange={handleFileChange(setBatchFile)} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 w-full text-sm text-slate-400" />
                                    {batchFile && (
                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-xs text-green-400">Selected: {batchFile.name}</p>
                                            <button onClick={handleAnalyzeScript} className="text-xs text-amber-400 hover:text-amber-300 underline">
                                                Analyze Safety
                                            </button>
                                        </div>
                                    )}
                                </StepCard>
                                <StepCard step="3" title="Enter Credentials" description="Secure credentials will be requested when you start the scan.">
                                    <p className="text-xs text-slate-500 pt-2">Authentication will be prompted before the scan begins. Credentials are never stored.</p>
                                </StepCard>
                                <StepCard step="4" title="Advanced Settings" description="Configure connection retry and reboot behavior.">
                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="maxRetries" className="text-sm text-slate-300">Max Retries</label>
                                            <input type="number" id="maxRetries" value={maxRetries} onChange={(e) => setMaxRetries(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))} className="w-20 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-center" min={1} max={10} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="retryDelay" className="text-sm text-slate-300">Retry Delay (sec)</label>
                                            <input type="number" id="retryDelay" value={retryDelay} onChange={(e) => setRetryDelay(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))} className="w-20 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-center" min={1} max={30} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="autoReboot" className="text-sm text-slate-300 cursor-pointer">Auto Reboot</label>
                                            <button
                                                id="autoReboot"
                                                role="switch"
                                                aria-checked={autoRebootEnabled}
                                                onClick={() => setAutoRebootEnabled(!autoRebootEnabled)}
                                                className={`${autoRebootEnabled ? 'bg-cyan-600' : 'bg-slate-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800`}
                                            >
                                                <span className={`${autoRebootEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
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
                                <div className="flex flex-col items-end gap-2">
                                    {deploymentState === DeploymentState.Running ? (
                                        <button onClick={handleCancelDeployment} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50">
                                            Cancel Scan
                                        </button>
                                    ) : (
                                        <>
                                            <button onClick={handleStartDeployment} disabled={!isReadyToDeploy} className="px-6 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50">
                                                Start System Scan
                                            </button>
                                            {scriptAnalysisResult && !scriptAnalysisResult.isSafe && (
                                                <p className="text-xs text-red-400 max-w-xs text-right">
                                                    Deployment blocked: Script failed safety analysis. Fix the script or select a different file.
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <DeploymentProgress devices={devices} />
                        </div>

                        <BulkActions selectedCount={selectedDeviceIds.size} onUpdate={handleBulkUpdate} onCancel={handleBulkCancel} />

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
            )}

            {activeView === 'imagingScript' && (
                <main className="mt-8">
                    <ImagingScriptPage />
                </main>
            )}

            {activeView === 'buildOutput' && (
                <main className="mt-8">
                    <BuildOutputPage />
                </main>
            )}

            {activeView === 'trendsAnalytics' && (
                <main className="mt-8">
                    <TrendsAnalyticsPage />
                </main>
            )}

            <SecureCredentialModal
                isOpen={isCredentialModalOpen}
                onClose={() => setIsCredentialModalOpen(false)}
                onConfirm={handleConfirmCredentialsAndDeploy}
            />

            <AdminGateModal
                isOpen={adminGateOpen}
                onConfirm={() => {
                    setIsAdminVerified(true);
                    setAdminGateOpen(false);
                    if (pendingAdminAction) {
                        setConfirmAction(pendingAdminAction);
                        setPendingAdminAction(null);
                    }
                }}
                onCancel={() => {
                    setAdminGateOpen(false);
                    setPendingAdminAction(null);
                }}
            />

            <ConfirmActionModal
                isOpen={confirmAction !== null}
                title={confirmDetails?.title ?? 'Confirm Action'}
                description={confirmDetails?.description ?? ''}
                deviceCount={confirmDetails?.count ?? 0}
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmAction(null)}
            />

            <DeviceScopeGuard
                isOpen={isScopeGuardOpen}
                devices={devices}
                selectedDeviceIds={selectedDeviceIds}
                onVerificationComplete={handleScopeVerified}
                onCancel={() => { setIsScopeGuardOpen(false); setPendingAction(null); }}
                username={operatorName || 'operator'}
            />

            <ScriptAnalysisModal
                isOpen={isScriptAnalysisOpen}
                result={scriptAnalysisResult}
                isLoading={scriptAnalysisLoading}
                onClose={() => setIsScriptAnalysisOpen(false)}
            />
        </div>
    );
};

export default App;
